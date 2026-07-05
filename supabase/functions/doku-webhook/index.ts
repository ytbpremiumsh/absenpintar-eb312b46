// Doku Checkout notification webhook.
// Endpoint should be registered in Doku Merchant Dashboard as:
//   https://<project-ref>.functions.supabase.co/doku-webhook
// Doku sends POST with JSON body. Signature is verified via the same
// HMAC-SHA256 scheme as outbound requests (see spp-doku/index.ts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, client-id, request-id, request-timestamp, signature, digest",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isPaidStatus(s: unknown) {
  const v = String(s || "").toUpperCase();
  return ["PAID", "SUCCESS", "SETTLED", "COMPLETED", "SUCCESSFUL"].includes(v);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 to Doku so it does not retry storm us on soft errors.
  const ok = (data: any) =>
    new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const rawBody = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(rawBody); } catch { /* keep empty */ }

    // Load Doku secret (platform_settings first, then env)
    const { data: cfgRows } = await supabaseAdmin
      .from("platform_settings")
      .select("key,value")
      .in("key", ["doku_client_id", "doku_secret_key", "doku_webhook_verify"]);
    const cfg: Record<string, string> = {};
    (cfgRows || []).forEach((r: any) => { cfg[r.key] = r.value || ""; });
    const clientId = cfg.doku_client_id || Deno.env.get("DOKU_CLIENT_ID") || "";
    const secretKey = cfg.doku_secret_key || Deno.env.get("DOKU_SECRET_KEY") || "";
    const verifyEnabled = (cfg.doku_webhook_verify || "true").toLowerCase() !== "false";

    // Signature verification (optional; skip if secret missing or admin disabled it)
    let signatureOk = true;
    if (verifyEnabled && secretKey && clientId) {
      const sig = req.headers.get("signature") || req.headers.get("Signature") || "";
      const reqId = req.headers.get("request-id") || req.headers.get("Request-Id") || "";
      const reqTs = req.headers.get("request-timestamp") || req.headers.get("Request-Timestamp") || "";
      const url = new URL(req.url);
      const target = url.pathname; // e.g. /doku-webhook
      const digest = createHash("sha256").update(rawBody, "utf8").digest("base64");
      const stringToSign =
        `Client-Id:${clientId}\n` +
        `Request-Id:${reqId}\n` +
        `Request-Timestamp:${reqTs}\n` +
        `Request-Target:${target}\n` +
        `Digest:${digest}`;
      const expected = "HMACSHA256=" + createHmac("sha256", secretKey)
        .update(stringToSign, "utf8")
        .digest("base64");
      signatureOk = sig === expected;
    }

    // Extract order + status from various Doku payload shapes
    const invoiceNumber =
      payload?.order?.invoice_number ||
      payload?.transaction?.original_request_id ||
      payload?.response?.order?.invoice_number ||
      null;
    const status =
      payload?.transaction?.status ||
      payload?.order?.status ||
      payload?.response?.order?.status ||
      null;

    await supabaseAdmin.from("spp_logs").insert({
      school_id: null,
      invoice_id: null,
      event_type: "doku_webhook",
      status: signatureOk ? "received" : "sig_mismatch",
      payload: { headers: Object.fromEntries(req.headers), body: payload },
      message: `invoice=${invoiceNumber || "-"} status=${status || "-"}`,
    });

    if (!signatureOk) return ok({ verified: false });
    if (!invoiceNumber) return ok({ ignored: "no invoice_number" });
    if (!isPaidStatus(status)) return ok({ ignored: `status=${status}` });

    // Locate invoice by stored id (schema-compat: uses mayar_invoice_id column)
    const { data: inv } = await supabaseAdmin
      .from("spp_invoices")
      .select("id, school_id, status")
      .eq("mayar_invoice_id", invoiceNumber)
      .maybeSingle();
    if (!inv) return ok({ ignored: "invoice not found" });
    if (inv.status === "paid") return ok({ already: true });

    const paidAt = new Date().toISOString();
    await supabaseAdmin
      .from("spp_invoices")
      .update({ status: "paid", paid_at: paidAt, payment_method: "doku" })
      .eq("id", inv.id);
    await supabaseAdmin
      .from("payment_transactions")
      .update({ status: "paid", paid_at: paidAt })
      .eq("school_id", inv.school_id)
      .eq("mayar_transaction_id", invoiceNumber)
      .eq("status", "pending");
    await supabaseAdmin.from("spp_logs").insert({
      school_id: inv.school_id,
      invoice_id: inv.id,
      event_type: "doku_webhook_paid",
      status: "paid",
      payload: payload,
      message: "SPP paid (Doku webhook)",
    });

    return ok({ marked_paid: true, invoice_id: inv.id });
  } catch (e: any) {
    console.error("doku-webhook error:", e);
    return ok({ error: e?.message || "internal" });
  }
});
