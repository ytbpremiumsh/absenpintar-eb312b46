// Doku Jokul Checkout API integration for SPP payments.
// Mirrors spp-mayar interface: same actions (parent_create_payment,
// create_payment_link, regenerate_payment_link, test_connection, sync_paid_invoices).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brandPaymentUrl } from "../_shared/brandUrl.ts";
import { createHmac, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-parent-token",
};

const DOKU_LINK_TTL_MIN = 60 * 24 * 3; // 3 days
const DEFAULT_FEES: Record<string, number> = { va: 5000, qris: 5000, retail: 8000 };
const QRIS_MIN_FEE = 3000;
const QRIS_PERCENT_DEFAULT = 0.01;
function computeQrisFee(amount: number, percent: number = QRIS_PERCENT_DEFAULT): number {
  const base = Math.max(0, Number(amount) || 0);
  const p = Number.isFinite(percent) && percent >= 0 ? percent : QRIS_PERCENT_DEFAULT;
  return Math.max(QRIS_MIN_FEE, Math.round(base * p));
}
async function getQrisPercent(supabaseAdmin: any): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from("platform_settings").select("value").eq("key", "fee_qris_percent").maybeSingle();
    const raw = String(data?.value ?? "").replace(",", ".");
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0) return n / 100;
  } catch (_) {}
  return QRIS_PERCENT_DEFAULT;
}
function normalizeChannel(c: any): string | null {
  const v = String(c || "").toLowerCase();
  return v in DEFAULT_FEES ? v : null;
}
async function serviceFeeFor(supabaseAdmin: any, c: any, amount = 0): Promise<number> {
  const v = normalizeChannel(c);
  if (!v) return 0;
  if (v === "qris") return computeQrisFee(amount, await getQrisPercent(supabaseAdmin));
  try {
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", `fee_${v}`)
      .maybeSingle();
    const n = parseInt(data?.value ?? "", 10);
    if (Number.isFinite(n) && n >= 0) return n;
  } catch (_) {}
  return DEFAULT_FEES[v];
}

async function getDokuConfig(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key,value")
    .in("key", [
      "doku_client_id",
      "doku_secret_key",
      "doku_env",
      "doku_va_methods",
      "doku_qris_methods",
      "doku_retail_methods",
    ]);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
  const clientId = map.doku_client_id || Deno.env.get("DOKU_CLIENT_ID") || "";
  const secretKey = map.doku_secret_key || Deno.env.get("DOKU_SECRET_KEY") || "";
  const env = (map.doku_env || "production").toLowerCase();
  const baseUrl = env === "sandbox"
    ? "https://api-sandbox.doku.com"
    : "https://api.doku.com";
  return {
    clientId, secretKey, baseUrl, env,
    vaMethods: map.doku_va_methods || "",
    qrisMethods: map.doku_qris_methods || "",
    retailMethods: map.doku_retail_methods || "",
  };
}

// Doku SNAP signature (Jokul HMAC scheme):
// stringToSign =
//   Client-Id:{clientId}\n
//   Request-Id:{requestId}\n
//   Request-Timestamp:{ts}\n
//   Request-Target:{target}\n
//   Digest:{digest}
// signature = "HMACSHA256=" + base64(HMAC-SHA256(stringToSign, secret))
function buildDokuSignature(opts: {
  clientId: string;
  secretKey: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  body: string;
}) {
  const digest = createHash("sha256").update(opts.body, "utf8").digest("base64");
  const stringToSign =
    `Client-Id:${opts.clientId}\n` +
    `Request-Id:${opts.requestId}\n` +
    `Request-Timestamp:${opts.requestTimestamp}\n` +
    `Request-Target:${opts.requestTarget}\n` +
    `Digest:${digest}`;
  const signature = createHmac("sha256", opts.secretKey)
    .update(stringToSign, "utf8")
    .digest("base64");
  return { digest, signature: `HMACSHA256=${signature}` };
}

async function dokuFetch(cfg: { clientId: string; secretKey: string; baseUrl: string },
                         target: string, bodyObj: any) {
  const body = JSON.stringify(bodyObj);
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().split(".")[0] + "Z";
  const { digest, signature } = buildDokuSignature({
    clientId: cfg.clientId,
    secretKey: cfg.secretKey,
    requestId,
    requestTimestamp,
    requestTarget: target,
    body,
  });
  const res = await fetch(`${cfg.baseUrl}${target}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": cfg.clientId,
      "Request-Id": requestId,
      "Request-Timestamp": requestTimestamp,
      "Signature": signature,
      "Digest": digest,
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, requestId };
}

// Default Doku Checkout payment_method_types per channel.
// Admin bisa override via platform_settings key `doku_va_methods` /
// `doku_qris_methods` / `doku_retail_methods` (comma-separated).
// Set nilainya menjadi "*" atau kosong untuk MENGIZINKAN semua metode
// yang aktif di Doku Merchant Dashboard tampil di halaman checkout
// (rekomendasi: kalau Mandiri / bank tertentu tidak muncul, gunakan "*").
const DEFAULT_VA_METHODS = [
  "VIRTUAL_ACCOUNT_BCA",
  "VIRTUAL_ACCOUNT_BANK_MANDIRI",
  "VIRTUAL_ACCOUNT_MANDIRI",
  "VIRTUAL_ACCOUNT_DOKU",
  "VIRTUAL_ACCOUNT_BRI",
  "VIRTUAL_ACCOUNT_BNI",
  "VIRTUAL_ACCOUNT_BANK_PERMATA",
  "VIRTUAL_ACCOUNT_BANK_CIMB",
  "VIRTUAL_ACCOUNT_BANK_SYARIAH_INDONESIA",
  "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI",
  "VIRTUAL_ACCOUNT_BANK_DANAMON",
];
const DEFAULT_QRIS_METHODS = [
  "QRIS", "EMONEY_SHOPEEPAY", "EMONEY_OVO", "EMONEY_DANA",
];
const DEFAULT_RETAIL_METHODS = [
  "ONLINE_TO_OFFLINE_ALFA", "PERURI_INDOMARET",
];

function parseMethodOverride(raw: string, fallback: string[]): string[] | null {
  const v = (raw || "").trim();
  if (!v) return fallback;
  // "*" atau "all" berarti JANGAN kirim filter → semua metode aktif tampil
  if (v === "*" || v.toLowerCase() === "all") return null;
  return v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

function paymentMethodsFor(
  channel: string | null,
  cfg: { vaMethods: string; qrisMethods: string; retailMethods: string },
): string[] | null {
  switch (channel) {
    case "va":     return parseMethodOverride(cfg.vaMethods, DEFAULT_VA_METHODS);
    case "qris":   return parseMethodOverride(cfg.qrisMethods, DEFAULT_QRIS_METHODS);
    case "retail": return parseMethodOverride(cfg.retailMethods, DEFAULT_RETAIL_METHODS);
    default:       return null; // no channel → tampil semua
  }
}

async function createDokuPayment(
  cfg: { clientId: string; secretKey: string; baseUrl: string; vaMethods: string; qrisMethods: string; retailMethods: string },
  inv: any,
  channel: string | null,
) {
  const totalCharged = Number(inv._amount_override ?? inv.total_amount) || 0;
  const invoiceNumber = `SPP-${(inv.id || "").slice(0, 8)}-${Date.now().toString(36).slice(-4)}`;
  const expiredAt = new Date(Date.now() + DOKU_LINK_TTL_MIN * 60 * 1000);

  const body: any = {
    order: {
      amount: Math.max(1000, Math.round(totalCharged)),
      invoice_number: invoiceNumber,
      line_items: [{
        name: `SPP ${inv.period_label} - ${inv.student_name}`,
        price: Math.max(1000, Math.round(totalCharged)),
        quantity: 1,
      }],
    },
    payment: {
      payment_due_date: DOKU_LINK_TTL_MIN,
    },
    customer: {
      // Doku VA menampilkan customer.name sebagai pemilik VA. Pakai nama SISWA
      // supaya tampilan mutasi bank / halaman pembayaran menampilkan nama anak,
      // bukan nama wali (yang bisa berbeda per invoice).
      name: (inv.student_name || inv.parent_name || "Siswa").slice(0, 100),
      email: `spp-${(inv.id || "x").slice(0, 8)}@atskolla.com`,
      phone: String(inv.parent_phone || "081234567890").replace(/\D/g, "").slice(0, 15) || "081234567890",
    },
  };

  const methods = paymentMethodsFor(channel, cfg);
  // null → jangan kirim override_configuration (semua metode Doku Dashboard aktif tampil)
  if (methods && methods.length) {
    body.override_configuration = { payment_method_types: methods };
  }

  const res = await dokuFetch(cfg, "/checkout/v1/payment", body);
  const url =
    res.json?.response?.payment?.url ||
    res.json?.payment?.url ||
    res.json?.response?.payment?.payment_url ||
    null;
  const dokuInvoiceId =
    res.json?.response?.order?.invoice_number ||
    res.json?.order?.invoice_number ||
    invoiceNumber;
  const sessionId =
    res.json?.response?.payment?.session_id ||
    res.json?.response?.payment?.token_id ||
    null;
  return {
    ok: res.ok && !!url,
    url,
    dokuInvoiceId,
    sessionId,
    raw: res.json,
    status: res.status,
    expiry: expiredAt,
  };
}

async function checkDokuStatus(
  cfg: { clientId: string; secretKey: string; baseUrl: string },
  invoiceNumber: string,
) {
  const target = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const body = ""; // Doku status: GET-like but we use empty body for signing consistency
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().split(".")[0] + "Z";
  const { digest, signature } = buildDokuSignature({
    clientId: cfg.clientId,
    secretKey: cfg.secretKey,
    requestId,
    requestTimestamp,
    requestTarget: target,
    body,
  });
  const res = await fetch(`${cfg.baseUrl}${target}`, {
    method: "GET",
    headers: {
      "Client-Id": cfg.clientId,
      "Request-Id": requestId,
      "Request-Timestamp": requestTimestamp,
      "Signature": signature,
      "Digest": digest,
    },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function isPaidDokuStatus(status: unknown) {
  const s = String(status || "").toUpperCase();
  return ["PAID", "SUCCESS", "SETTLED", "COMPLETED"].includes(s);
}

async function syncPaidInvoices(supabaseAdmin: any, schoolId: string) {
  const cfg = await getDokuConfig(supabaseAdmin);
  if (!cfg.clientId || !cfg.secretKey) return { checked: 0, paid: 0, error: "DOKU belum dikonfigurasi" };

  const { data: invoices } = await supabaseAdmin
    .from("spp_invoices")
    .select("*")
    .eq("school_id", schoolId)
    .neq("status", "paid")
    .not("mayar_invoice_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  let paid = 0;
  for (const inv of invoices || []) {
    try {
      // mayar_invoice_id column is reused to store Doku invoice_number (schema-compat).
      const stat = await checkDokuStatus(cfg, inv.mayar_invoice_id);
      const s = stat.json?.response?.order?.status || stat.json?.order?.status;
      if (!isPaidDokuStatus(s)) continue;

      const paidAt = new Date().toISOString();
      await supabaseAdmin.from("spp_invoices").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "doku",
      }).eq("id", inv.id);
      await supabaseAdmin.from("payment_transactions").update({
        status: "paid",
        paid_at: paidAt,
      }).eq("school_id", inv.school_id).eq("mayar_transaction_id", inv.mayar_invoice_id).eq("status", "pending");
      await supabaseAdmin.from("spp_logs").insert({
        school_id: inv.school_id,
        invoice_id: inv.id,
        event_type: "doku_sync",
        status: "paid",
        payload: stat.json,
        message: "SPP paid (Doku sync)",
      });
      paid++;
    } catch (e) {
      console.error("doku sync err", inv.id, e);
    }
  }
  return { checked: (invoices || []).length, paid };
}

async function ensureFreshLink(
  supabaseAdmin: any,
  inv: any,
  forceRegen = false,
  channel: string | null = null,
) {
  const cfg = await getDokuConfig(supabaseAdmin);
  if (!cfg.clientId || !cfg.secretKey) {
    return { success: false, error: "Doku Client-Id / Secret-Key belum dikonfigurasi" };
  }
  const now = Date.now();
  const isExpired = inv.expired_at ? new Date(inv.expired_at).getTime() < now : false;
  const serviceFee = await serviceFeeFor(supabaseAdmin, channel, inv.total_amount || 0);
  const sameChannel = channel ? inv.payment_channel === channel : true;
  if (!forceRegen && inv.payment_url && !isExpired && sameChannel) {
    return {
      success: true,
      payment_url: inv.payment_url,
      invoice_id: inv.id,
      service_fee: inv.service_fee || 0,
      total_charged: (inv.total_amount || 0) + (inv.service_fee || 0),
    };
  }
  const totalCharged = (Number(inv.total_amount) || 0) + serviceFee;
  const created = await createDokuPayment(cfg, { ...inv, _amount_override: totalCharged }, channel);
  await supabaseAdmin.from("spp_logs").insert({
    school_id: inv.school_id,
    invoice_id: inv.id,
    event_type: "create_invoice_doku",
    status: created.ok ? "ok" : "error",
    payload: created.raw,
    message: created.raw?.message || null,
  });
  if (!created.ok || !created.url) {
    const msg = created.raw?.message || created.raw?.error?.message || JSON.stringify(created.raw).slice(0, 300);
    return { success: false, error: `Gagal buat pembayaran Doku: ${msg}` };
  }
  await supabaseAdmin.from("spp_invoices").update({
    mayar_invoice_id: created.dokuInvoiceId,
    payment_url: created.url,
    expired_at: created.expiry.toISOString(),
    status: "pending",
    service_fee: serviceFee,
    payment_channel: channel,
  }).eq("id", inv.id);
  const { data: anyPlan } = await supabaseAdmin.from("subscription_plans").select("id").limit(1).maybeSingle();
  await supabaseAdmin.from("payment_transactions").insert({
    school_id: inv.school_id,
    plan_id: anyPlan?.id || inv.school_id,
    amount: totalCharged,
    status: "pending",
    mayar_transaction_id: created.dokuInvoiceId,
    mayar_payment_url: created.url,
    payment_method: "spp",
    service_fee: serviceFee,
    payment_channel: channel,
  });
  return {
    success: true,
    payment_url: created.url,
    invoice_id: inv.id,
    service_fee: serviceFee,
    total_charged: totalCharged,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ok = (data: any) => new Response(JSON.stringify({ success: true, ...data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const err = (m: string) => new Response(JSON.stringify({ success: false, error: m }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "parent_create_payment") {
      const parentToken = req.headers.get("x-parent-token") || body.parent_token;
      if (!parentToken) return err("Unauthorized");
      const { data: ses } = await supabaseAdmin.from("parent_sessions").select("phone, expires_at").eq("token", parentToken).maybeSingle();
      if (!ses || new Date(ses.expires_at).getTime() < Date.now()) return err("Sesi tidak valid");
      const invoiceId = body.invoice_id as string;
      const { data: inv } = await supabaseAdmin.from("spp_invoices").select("*").eq("id", invoiceId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah lunas");
      const result = await ensureFreshLink(supabaseAdmin, inv, false, normalizeChannel(body.channel));
      if (!result.success) return err(result.error || "Gagal");
      return ok({
        payment_url: brandPaymentUrl(result.payment_url),
        invoice_id: result.invoice_id,
        service_fee: result.service_fee || 0,
        total_charged: result.total_charged || inv.total_amount,
      });
    }

    // School / super admin actions
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return err("Unauthorized");
    const { data: claimsRes, error: claimsErr } = await supabaseAdmin.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) return err("Unauthorized");
    const userId = claimsRes.claims.sub as string;

    if (action === "test_connection") {
      const cfg = await getDokuConfig(supabaseAdmin);
      if (!cfg.clientId || !cfg.secretKey) return ok({ connected: false, message: "DOKU_CLIENT_ID/SECRET_KEY belum di-set" });
      // Test with a small ping to checkout/v1/payment using bogus valid payload
      const testRes = await dokuFetch(cfg, "/checkout/v1/payment", {
        order: { amount: 10000, invoice_number: `TEST-${Date.now()}`, line_items: [{ name: "Test", price: 10000, quantity: 1 }] },
        payment: { payment_due_date: 60 },
        customer: { name: "Test ATSkolla", email: "test@atskolla.com", phone: "081234567890" },
      });
      const connected = testRes.ok && !!(testRes.json?.response?.payment?.url);
      return ok({ connected, message: connected ? "Doku Connected" : (testRes.json?.message || testRes.json?.error?.message || `HTTP ${testRes.status}`) });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();
    const schoolId = profile?.school_id;

    if (action === "create_payment_link" || action === "regenerate_payment_link") {
      if (!schoolId) return err("Akun tidak terhubung sekolah");
      const { invoice_id } = body;
      const { data: inv } = await supabaseAdmin.from("spp_invoices").select("*").eq("id", invoice_id).eq("school_id", schoolId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah dibayar");
      const result = await ensureFreshLink(supabaseAdmin, inv, action === "regenerate_payment_link", normalizeChannel(body.channel));
      if (!result.success) return err(result.error || "Gagal");
      return ok({ payment_url: brandPaymentUrl(result.payment_url), invoice_id: result.invoice_id });
    }

    if (action === "sync_paid_invoices") {
      if (!schoolId) return err("Akun tidak terhubung sekolah");
      const result = await syncPaidInvoices(supabaseAdmin, schoolId);
      return ok(result);
    }

    return err("Unknown action");
  } catch (e: any) {
    console.error("spp-doku error:", e);
    return err(e.message || "Internal error");
  }
});
