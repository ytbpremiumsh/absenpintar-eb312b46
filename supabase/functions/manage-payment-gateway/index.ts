import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KEYS = [
  "active_payment_gateway",
  "doku_client_id",
  "doku_secret_key",
  "doku_env",
];

function mask(v: string) {
  if (!v) return "";
  if (v.length <= 12) return "•".repeat(v.length);
  return v.slice(0, 6) + "••••••••" + v.slice(-4);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ok = (d: any) => new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return ok({ error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: claims, error: claimsErr } = await admin.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return ok({ error: "Unauthorized" });
    const userId = claims.claims.sub;

    const { data: hasRole } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!hasRole) return ok({ error: "Forbidden: Super admin only" });

    const { action, updates } = await req.json();

    if (action === "get") {
      const { data } = await admin.from("platform_settings").select("key,value").in("key", KEYS);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
      return ok({
        active_payment_gateway: map.active_payment_gateway || "mayar",
        doku_env: map.doku_env || "production",
        doku_client_id: map.doku_client_id || "",
        doku_client_id_masked: mask(map.doku_client_id || ""),
        doku_secret_key_masked: mask(map.doku_secret_key || ""),
        has_doku_client_id: !!map.doku_client_id,
        has_doku_secret_key: !!map.doku_secret_key,
      });
    }

    if (action === "set") {
      const rows = Object.entries(updates || {}).filter(([k]) => KEYS.includes(k));
      for (const [key, value] of rows) {
        const { data: existing } = await admin.from("platform_settings").select("id").eq("key", key).maybeSingle();
        if (existing) {
          await admin.from("platform_settings").update({ value: String(value ?? ""), updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await admin.from("platform_settings").insert({ key, value: String(value ?? "") });
        }
      }
      return ok({ success: true });
    }

    return ok({ error: "Invalid action" });
  } catch (e: any) {
    return ok({ error: e.message || "Internal error" });
  }
});
