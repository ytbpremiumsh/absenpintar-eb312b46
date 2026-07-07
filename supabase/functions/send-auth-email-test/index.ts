import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_NAME = "ATSkolla";
const ROOT_DOMAIN = "atskolla.com";

const SUBJECT_FALLBACK: Record<string, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: must be super admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isSuper } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    // Input
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "").trim();
    const to = String(body.to || "").trim();
    if (!type || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return json({ error: "type dan email tujuan wajib diisi" }, 400);
    }

    // Load template
    const { data: tpl, error: tplErr } = await admin
      .from("auth_email_templates")
      .select("subject, html, sender_name")
      .eq("type", type)
      .maybeSingle();
    if (tplErr) return json({ error: tplErr.message }, 500);
    if (!tpl || !tpl.html) return json({ error: "Template belum tersedia" }, 404);

    // Variable substitution
    const vars: Record<string, string> = {
      site_name: SITE_NAME,
      site_url: `https://${ROOT_DOMAIN}`,
      recipient: to,
      email: to,
      confirmation_url: `https://${ROOT_DOMAIN}/verify?token=TEST_${Date.now()}`,
      token: "123456",
      old_email: to,
      new_email: to,
    };
    const replace = (s: string) =>
      s.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => vars[String(k).toLowerCase()] ?? "");

    const subject = "[TEST] " + replace(tpl.subject || SUBJECT_FALLBACK[type] || "Notification");
    const html = replace(tpl.html);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const senderName = tpl.sender_name || SITE_NAME;

    // Load SMTP settings (same source as send-email)
    const { data: settings, error: sErr } = await admin
      .from("email_settings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) return json({ error: sErr.message }, 500);
    if (!settings || !settings.is_active) {
      return json(
        {
          error:
            "SMTP Email belum dikonfigurasi. Buka halaman Pengaturan Email (SMTP) dan aktifkan terlebih dahulu.",
        },
        400,
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host,
        port: settings.smtp_port,
        tls: settings.smtp_secure,
        auth: { username: settings.smtp_username, password: settings.smtp_password },
      },
    });

    try {
      await client.send({
        from: `${senderName || settings.from_name} <${settings.from_email}>`,
        to,
        subject,
        html,
        content: text,
      });
      try { await client.close(); } catch { /* ignore */ }

      await admin.from("email_logs").insert({
        to_email: to,
        subject,
        event_type: "test",
        status: "sent",
      });
      return json({ success: true, via: "smtp", from: settings.from_email }, 200);
    } catch (e) {
      try { await client.close(); } catch { /* ignore */ }
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("email_logs").insert({
        to_email: to,
        subject,
        event_type: "test",
        status: "failed",
        error: msg,
      });
      return json({ error: "SMTP gagal mengirim: " + msg }, 500);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
