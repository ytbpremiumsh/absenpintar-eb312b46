// DOKU Cash Disbursement API integration.
// Actions:
//   - disburse: kirim pencairan ke DOKU (dipanggil setelah OTP diverifikasi).
//   - check_status: cek status disbursement (manual sync).
//   - inquiry: validasi rekening tujuan sebelum kirim (opsional).
//
// Auth ke DOKU: HMAC-SHA256 (Client-Id / Request-Id / Timestamp / Target / Digest).
// Jika DOKU_DISBURSEMENT_PROXY_URL diset, semua request DOKU direlay lewat proxy
// VPS (agar IP asal statis untuk whitelist DOKU).
//
// verify_jwt = false, verifikasi manual via getClaims agar konsisten dgn edge lain.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(body: any) {
  // Selalu 200 agar frontend tidak crash (mengikuti pola project).
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sha256Base64(input: string): string {
  return createHash("sha256").update(input).digest("base64");
}
function hmacSha256Base64(key: string, msg: string): string {
  return createHmac("sha256", key).update(msg).digest("base64");
}
function isoTsJakarta(): string {
  // DOKU minta format ISO-8601 dgn timezone +07:00.
  const d = new Date();
  const utc = d.getTime();
  const jak = new Date(utc + 7 * 60 * 60 * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const y = jak.getUTCFullYear();
  const mo = pad(jak.getUTCMonth() + 1);
  const da = pad(jak.getUTCDate());
  const h = pad(jak.getUTCHours());
  const mi = pad(jak.getUTCMinutes());
  const s = pad(jak.getUTCSeconds());
  return `${y}-${mo}-${da}T${h}:${mi}:${s}+07:00`;
}

async function getDokuCfg(admin: any) {
  const { data } = await admin
    .from("platform_settings")
    .select("key,value")
    .in("key", [
      "doku_disbursement_client_id",
      "doku_disbursement_secret_key",
      "doku_env",
      "doku_disbursement_proxy_url",
    ]);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
  const clientId =
    map.doku_disbursement_client_id ||
    Deno.env.get("DOKU_DISBURSEMENT_CLIENT_ID") ||
    "";
  const secretKey =
    map.doku_disbursement_secret_key ||
    Deno.env.get("DOKU_DISBURSEMENT_SECRET_KEY") ||
    "";
  const env = (map.doku_env || "production").toLowerCase();
  const baseUrl = env === "sandbox"
    ? "https://api-sandbox.doku.com"
    : "https://api.doku.com";
  const proxyUrl =
    map.doku_disbursement_proxy_url ||
    Deno.env.get("DOKU_DISBURSEMENT_PROXY_URL") ||
    "";
  return { clientId, secretKey, baseUrl, env, proxyUrl };
}

async function dokuCall(
  cfg: { clientId: string; secretKey: string; baseUrl: string; proxyUrl: string },
  targetPath: string,
  bodyObj: any,
  requestId: string,
) {
  const bodyStr = JSON.stringify(bodyObj);
  const digest = sha256Base64(bodyStr);
  const ts = isoTsJakarta();
  const canonical =
    `Client-Id:${cfg.clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${ts}\n` +
    `Request-Target:${targetPath}\n` +
    `Digest:${digest}`;
  const signature = "HMACSHA256=" + hmacSha256Base64(cfg.secretKey, canonical);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Client-Id": cfg.clientId,
    "Request-Id": requestId,
    "Request-Timestamp": ts,
    "Signature": signature,
    "Digest": digest,
  };

  // Kalau ada proxy VPS statis, forward ke sana. Proxy diharapkan meneruskan
  // request ke `${baseUrl}${targetPath}` apa adanya (headers + body).
  const url = cfg.proxyUrl
    ? `${cfg.proxyUrl.replace(/\/$/, "")}${targetPath}`
    : `${cfg.baseUrl}${targetPath}`;

  if (cfg.proxyUrl) headers["X-Doku-Base-Url"] = cfg.baseUrl;

  const res = await fetch(url, { method: "POST", headers, body: bodyStr });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, ok: res.ok, body: parsed, requestId, ts };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, settlement_id } = await req.json();

    if (!action) return jsonOk({ error: "action_required" });

    const cfg = await getDokuCfg(admin);
    if (!cfg.clientId || !cfg.secretKey) {
      return jsonOk({ error: "DOKU Disbursement belum dikonfigurasi (Client-Id / Secret-Key)" });
    }

    // ---------- DISBURSE ----------
    if (action === "disburse") {
      if (!settlement_id) return jsonOk({ error: "settlement_id_required" });

      const { data: stl } = await admin
        .from("spp_settlements")
        .select("*")
        .eq("id", settlement_id)
        .maybeSingle();
      if (!stl) return jsonOk({ error: "settlement_not_found" });
      if (stl.disbursement_status === "success") {
        return jsonOk({ ok: true, status: "success", note: "already_disbursed" });
      }
      if (stl.disbursement_status === "processing") {
        return jsonOk({ ok: true, status: "processing", note: "already_in_progress" });
      }

      // Ambil kode bank DOKU dari rekening bendahara (fallback: mapping by name).
      const { data: bank } = await admin
        .from("bendahara_bank_accounts")
        .select("doku_bank_code, bank_name, account_number, account_holder")
        .eq("school_id", stl.school_id)
        .eq("account_number", stl.account_number)
        .maybeSingle();
      const BANK_CODE_MAP: Record<string, string> = {
        "bca": "014", "bri": "002", "bni": "009", "mandiri": "008", "bsi": "451",
        "cimb niaga": "022", "cimb": "022", "danamon": "011", "permata": "013",
        "btn": "200", "panin": "019", "mega": "426", "ocbc nisp": "028", "ocbc": "028",
        "maybank": "016", "bjb": "110", "bank jateng": "113", "bank dki": "111",
        "bank sumut": "117", "bank sulselbar": "126", "bank nagari": "118",
        "muamalat": "147", "btpn": "213", "jenius": "213", "seabank": "535",
        "bank neo commerce": "490", "jago": "542", "allo bank": "567",
        "blu by bca": "501", "line bank": "484",
      };
      const bankCode = bank?.doku_bank_code
        || BANK_CODE_MAP[(bank?.bank_name || stl.bank_name || "").toLowerCase().trim()]
        || "";
      if (!bankCode) {
        await admin.from("spp_settlements").update({
          disbursement_status: "failed",
          disbursement_error: `Kode bank DOKU untuk "${stl.bank_name}" tidak dikenal. Set manual di kolom doku_bank_code.`,
        }).eq("id", settlement_id);
        return jsonOk({ error: `Kode bank DOKU untuk "${stl.bank_name}" tidak dikenal.` });
      }


      const partnerRef = stl.doku_partner_reference_no || `ATS-${stl.settlement_code}-${Date.now().toString().slice(-6)}`;
      const requestId = crypto.randomUUID();
      const targetPath = "/cash-disbursement/v2/transfer";

      const body = {
        partner_reference_no: partnerRef,
        amount: { value: String(stl.final_payout), currency: "IDR" },
        beneficiary_account_no: stl.account_number,
        beneficiary_account_name: stl.account_holder,
        beneficiary_bank_code: bankCode,
        beneficiary_email: null,
        source_account_no: null,
        transaction_date: isoTsJakarta(),
        remark: (stl.settlement_code || "SPP Payout").slice(0, 50),
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/doku-disbursement-webhook`,
      };

      // Tandai processing dulu (mencegah double-click race).
      await admin.from("spp_settlements").update({
        disbursement_method: "doku",
        disbursement_status: "processing",
        doku_partner_reference_no: partnerRef,
        disbursement_error: null,
        status: "approved",
      }).eq("id", settlement_id);

      const resp = await dokuCall(cfg, targetPath, body, requestId);
      const respBody = resp.body || {};
      const statusCode = String(respBody?.response_code || respBody?.responseCode || "");
      const statusMsg = respBody?.response_message || respBody?.responseMessage || "";
      const dokuRefId = respBody?.reference_no || respBody?.referenceNo || respBody?.transaction_id || null;

      // Kode 2xx = SUCCESS, 202xx = ACCEPTED/PROCESSING, 4xx/5xx = FAILED
      const isSuccess = resp.ok && (statusCode.startsWith("200") || statusCode === "" && resp.status < 300);
      const isProcessing = statusCode.startsWith("202");

      const newStatus = isSuccess ? "success" : isProcessing ? "processing" : "failed";
      await admin.from("spp_settlements").update({
        disbursement_status: newStatus,
        doku_reference_id: dokuRefId,
        disbursement_response: respBody,
        disbursement_error: isSuccess || isProcessing ? null : (statusMsg || `HTTP ${resp.status}`),
        status: newStatus === "success" ? "paid" : "approved",
        paid_at: newStatus === "success" ? new Date().toISOString() : null,
      }).eq("id", settlement_id);

      return jsonOk({
        ok: isSuccess || isProcessing,
        status: newStatus,
        doku_reference_id: dokuRefId,
        response_code: statusCode,
        message: statusMsg,
        http_status: resp.status,
      });
    }

    // ---------- CHECK STATUS ----------
    if (action === "check_status") {
      if (!settlement_id) return jsonOk({ error: "settlement_id_required" });
      const { data: stl } = await admin
        .from("spp_settlements")
        .select("*")
        .eq("id", settlement_id)
        .maybeSingle();
      if (!stl) return jsonOk({ error: "settlement_not_found" });
      if (!stl.doku_partner_reference_no) return jsonOk({ error: "belum_ada_referensi_doku" });

      const requestId = crypto.randomUUID();
      const targetPath = "/cash-disbursement/v2/check-status";
      const body = {
        partner_reference_no: stl.doku_partner_reference_no,
        original_reference_no: stl.doku_reference_id || undefined,
      };
      const resp = await dokuCall(cfg, targetPath, body, requestId);
      const rb = resp.body || {};
      const rc = String(rb?.response_code || rb?.responseCode || "");
      const tStatus = String(rb?.transaction_status || rb?.transactionStatus || "").toUpperCase();

      let newStatus: string | null = null;
      if (["SUCCESS", "SETTLED", "COMPLETED"].includes(tStatus) || rc.startsWith("200")) newStatus = "success";
      else if (["FAILED", "REJECTED", "REVERSED"].includes(tStatus) || rc.startsWith("40") || rc.startsWith("50")) newStatus = "failed";
      else if (["PROCESSING", "PENDING"].includes(tStatus) || rc.startsWith("202")) newStatus = "processing";

      if (newStatus) {
        await admin.from("spp_settlements").update({
          disbursement_status: newStatus,
          disbursement_response: rb,
          status: newStatus === "success" ? "paid" : (newStatus === "failed" ? "rejected" : "approved"),
          paid_at: newStatus === "success" ? new Date().toISOString() : null,
        }).eq("id", settlement_id);
      }
      return jsonOk({ ok: true, status: newStatus, response_code: rc, transaction_status: tStatus, raw: rb });
    }

    // ---------- INQUIRY (optional pre-check rekening) ----------
    if (action === "inquiry") {
      const { bank_code, account_no } = await (async () => {
        try { return (await req.clone().json()) as any; } catch { return {}; }
      })();
      if (!bank_code || !account_no) return jsonOk({ error: "bank_code_and_account_no_required" });
      const requestId = crypto.randomUUID();
      const targetPath = "/cash-disbursement/v2/inquiry";
      const body = { beneficiary_bank_code: bank_code, beneficiary_account_no: account_no };
      const resp = await dokuCall(cfg, targetPath, body, requestId);
      return jsonOk({ ok: resp.ok, http_status: resp.status, data: resp.body });
    }

    return jsonOk({ error: "unknown_action" });
  } catch (e: any) {
    console.error("doku-disbursement error", e);
    return jsonOk({ error: e?.message || String(e) });
  }
});
