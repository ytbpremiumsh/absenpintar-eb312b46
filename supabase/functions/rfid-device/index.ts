import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id, x-secret-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function writeLog(
  sb: ReturnType<typeof admin>,
  device: { id: string; device_id: string; school_id: string | null },
  event_type: string,
  payload: Record<string, unknown> = {},
) {
  await sb.from("rfid_device_logs").insert({
    device_ref: device.id,
    device_id: device.device_id,
    school_id: device.school_id,
    event_type,
    payload,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_body" });
  }

  const action = String(body.action || "");
  const sb = admin();

  try {
    if (action === "activate") {
      const device_id = String(body.device_id || "").trim();
      const activation_code = String(body.activation_code || "").trim();
      const mac_address = body.mac_address ? String(body.mac_address).trim() : null;
      if (!device_id || !activation_code) {
        return json({ ok: false, error: "device_id_and_code_required" });
      }

      const { data: dev } = await sb
        .from("rfid_devices")
        .select("*")
        .eq("device_id", device_id)
        .maybeSingle();
      if (!dev) return json({ ok: false, error: "device_not_found" });
      if (dev.activation_code !== activation_code)
        return json({ ok: false, error: "invalid_activation_code" });
      if (dev.status === "revoked") return json({ ok: false, error: "device_revoked" });
      if (!dev.school_id) return json({ ok: false, error: "device_not_assigned_to_school" });

      // Enforce license quota: active/assigned devices in that school
      const [{ data: license }, { count: activeCount }] = await Promise.all([
        sb.from("rfid_device_licenses").select("license_count").eq("school_id", dev.school_id).maybeSingle(),
        sb
          .from("rfid_devices")
          .select("id", { count: "exact", head: true })
          .eq("school_id", dev.school_id)
          .in("status", ["active", "inactive"]),
      ]);
      const licenseCount = license?.license_count ?? 0;
      const currentActive = activeCount ?? 0;
      // Only enforce if this device wasn't already counted (i.e. first activation)
      const wasActivated = dev.status === "active" || dev.status === "inactive";
      if (!wasActivated && currentActive >= licenseCount) {
        return json({ ok: false, error: "license_quota_exceeded", quota: licenseCount });
      }

      // Generate a fresh secret token (32 hex)
      const rand = crypto.getRandomValues(new Uint8Array(16));
      const secret_token = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
      const secret_token_hash = await sha256(secret_token);

      const nowIso = new Date().toISOString();
      const { error: upErr } = await sb
        .from("rfid_devices")
        .update({
          secret_token_hash,
          mac_address: mac_address || dev.mac_address,
          status: "active",
          activated_at: dev.activated_at || nowIso,
          last_heartbeat_at: nowIso,
          last_online_at: nowIso,
        })
        .eq("id", dev.id);
      if (upErr) return json({ ok: false, error: upErr.message });

      await writeLog(sb, { id: dev.id, device_id: dev.device_id, school_id: dev.school_id }, "activation", {
        mac_address,
      });
      return json({
        ok: true,
        secret_token,
        device_id: dev.device_id,
        school_id: dev.school_id,
        message: "device_activated",
      });
    }

    // Common auth for heartbeat/scan: device_id + secret_token
    if (action === "heartbeat" || action === "scan") {
      const device_id = String(body.device_id || "").trim();
      const secret_token = String(body.secret_token || "").trim();
      if (!device_id || !secret_token) return json({ ok: false, error: "auth_required" });
      const secret_token_hash = await sha256(secret_token);

      const { data: dev } = await sb
        .from("rfid_devices")
        .select("*")
        .eq("device_id", device_id)
        .maybeSingle();
      if (!dev) return json({ ok: false, error: "device_not_found" });
      if (dev.secret_token_hash !== secret_token_hash) return json({ ok: false, error: "invalid_token" });
      if (dev.status === "revoked") return json({ ok: false, error: "device_revoked" });
      if (!dev.school_id) return json({ ok: false, error: "device_not_assigned" });

      const nowIso = new Date().toISOString();

      if (action === "heartbeat") {
        const wasInactive = dev.status === "inactive";
        await sb
          .from("rfid_devices")
          .update({
            last_heartbeat_at: nowIso,
            last_online_at: nowIso,
            status: "active",
            firmware_version: body.firmware_version || dev.firmware_version,
          })
          .eq("id", dev.id);

        // Log online transition or throttle heartbeat logs to 1 per 5 minutes
        if (wasInactive) {
          await writeLog(sb, dev, "online", {});
        } else {
          const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { count } = await sb
            .from("rfid_device_logs")
            .select("id", { count: "exact", head: true })
            .eq("device_ref", dev.id)
            .eq("event_type", "heartbeat")
            .gte("created_at", cutoff);
          if (!count || count === 0) await writeLog(sb, dev, "heartbeat", {});
        }
        return json({ ok: true, status: "active" });
      }

      // scan
      const card_number = String(body.card_number || "").trim();
      if (!card_number) return json({ ok: false, error: "card_number_required" });

      // Require device active AND heartbeat < 3 minutes
      const lastHb = dev.last_heartbeat_at ? new Date(dev.last_heartbeat_at).getTime() : 0;
      const staleness = Date.now() - lastHb;
      if (dev.status !== "active" || staleness > 3 * 60 * 1000) {
        await writeLog(sb, dev, "scan", { card_number, result: "device_offline" });
        return json({ ok: false, error: "device_offline" });
      }

      // Delegate attendance to existing public-scan-attendance
      const scanRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/public-scan-attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:
              Deno.env.get("SUPABASE_ANON_KEY") ||
              Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
              "",
          },
          body: JSON.stringify({
            school_id: dev.school_id,
            student_code: card_number,
            method: "rfid",
          }),
        },
      );
      const scanJson = await scanRes.json().catch(() => ({}));

      await writeLog(sb, dev, "scan", {
        card_number,
        result: scanJson?.error ? "error" : "ok",
        attendance_type: scanJson?.attendance_type || null,
      });

      // Also update last_online since a scan implies liveness
      await sb
        .from("rfid_devices")
        .update({ last_online_at: nowIso, last_heartbeat_at: nowIso })
        .eq("id", dev.id);

      return json({ ok: !scanJson?.error, ...scanJson });
    }

    return json({ ok: false, error: "unknown_action" });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "unexpected_error" });
  }
});
