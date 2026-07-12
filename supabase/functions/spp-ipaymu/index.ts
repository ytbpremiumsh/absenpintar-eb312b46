// iPaymu Redirect Payment (Direct API v2) integration for ATSkolla SPP.
// Mirrors spp-doku / spp-mayar contract:
//   actions: parent_create_payment | create_payment_link | regenerate_payment_link
//            | test_connection | sync_paid_invoices
//
// iPaymu signature spec (v2):
//   stringToSign = METHOD + ":" + va + ":" + sha256Hex(body).toLowerCase() + ":" + apiKey
//   signature    = HMAC-SHA256(stringToSign, apiKey) hex
// Headers required: signature, va, timestamp (YYYYMMDDHHmmss), Content-Type, Accept
//
// Endpoints:
//   Sandbox: https://sandbox.ipaymu.com
//   Prod:    https://my.ipaymu.com
//   Redirect Payment: POST /api/v2/payment
//   Transaction check: POST /api/v2/transaction

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brandPaymentUrl } from "../_shared/brandUrl.ts";
import { createHmac, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LINK_TTL_MIN = 60 * 24 * 3; // 3 days
const DEFAULT_FEES: Record<string, number> = { va: 5000, qris: 5000, retail: 8000 };
const QRIS_MIN_FEE = 3000;
const QRIS_PERCENT_DEFAULT = 0.01;

function computeQrisFee(amount: number, percent = QRIS_PERCENT_DEFAULT): number {
  const base = Math.max(0, Number(amount) || 0);
  const p = Number.isFinite(percent) && percent >= 0 ? percent : QRIS_PERCENT_DEFAULT;
  return Math.max(QRIS_MIN_FEE, Math.round(base * p));
}
async function getQrisPercent(admin: any): Promise<number> {
  try {
    const { data } = await admin.from("platform_settings").select("value").eq("key", "fee_qris_percent").maybeSingle();
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
async function serviceFeeFor(admin: any, c: any, amount = 0): Promise<number> {
  const v = normalizeChannel(c);
  if (!v) return 0;
  if (v === "qris") return computeQrisFee(amount, await getQrisPercent(admin));
  try {
    const { data } = await admin.from("platform_settings").select("value").eq("key", `fee_${v}`).maybeSingle();
    const n = parseInt(data?.value ?? "", 10);
    if (Number.isFinite(n) && n >= 0) return n;
  } catch (_) {}
  return DEFAULT_FEES[v];
}

async function getIpaymuConfig(admin: any) {
  const { data } = await admin
    .from("platform_settings")
    .select("key,value")
    .in("key", ["ipaymu_va", "ipaymu_api_key", "ipaymu_env"]);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
  const env = (map.ipaymu_env || "production").toLowerCase();
  return {
    va: map.ipaymu_va || Deno.env.get("IPAYMU_VA") || "",
    apiKey: map.ipaymu_api_key || Deno.env.get("IPAYMU_API_KEY") || "",
    env,
    baseUrl: env === "sandbox" ? "https://sandbox.ipaymu.com" : "https://my.ipaymu.com",
  };
}

// Base URL untuk halaman parent yang ditampilkan di tombol "Kembali ke Merchant"
// pada halaman pembayaran iPaymu. Bisa dioverride via platform_settings.app_base_url
// (mis. domain VPS sendiri). Fallback ke https://absenpintar.online.
async function getAppBaseUrl(admin: any): Promise<string> {
  try {
    const { data } = await admin.from("platform_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const raw = String(data?.value ?? "").trim().replace(/\/+$/, "");
    if (raw) return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  } catch (_) {}
  return "https://absenpintar.online";
}

function ipaymuTimestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function buildIpaymuSignature(opts: { method: string; va: string; apiKey: string; body: string }) {
  const bodyHash = String(createHash("sha256").update(opts.body, "utf8").digest("hex")).toLowerCase();
  const stringToSign = `${opts.method.toUpperCase()}:${opts.va}:${bodyHash}:${opts.apiKey}`;
  return createHmac("sha256", opts.apiKey).update(stringToSign, "utf8").digest("hex");
}

async function ipaymuFetch(
  cfg: { va: string; apiKey: string; baseUrl: string },
  path: string,
  bodyObj: any,
) {
  const body = JSON.stringify(bodyObj);
  const signature = buildIpaymuSignature({ method: "POST", va: cfg.va, apiKey: cfg.apiKey, body });
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "va": cfg.va,
      "signature": signature,
      "timestamp": ipaymuTimestamp(),
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Map ATSkolla channel → iPaymu paymentMethod + optional paymentChannel filter.
// Leaving paymentChannel empty on VA/Retail lets user pick any bank/store on iPaymu page.
function channelToIpaymu(
  ch: string | null,
  sub?: string | null,
): { paymentMethod?: string; paymentChannel?: string } {
  switch (ch) {
    case "va":
      return sub
        ? { paymentMethod: "va", paymentChannel: sub.toLowerCase() }
        : { paymentMethod: "va" };
    case "qris":   return { paymentMethod: "qris", paymentChannel: "qris" };
    case "retail": return { paymentMethod: "cstore", paymentChannel: (sub === "indomaret" ? "indomaret" : "alfamart") };
    default:       return {};
  }
}

function phoneVariants(raw: string): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  const v = new Set<string>();
  if (!digits) return [];
  v.add(digits);
  if (digits.startsWith("62")) { v.add("0" + digits.slice(2)); v.add(digits.slice(2)); }
  if (digits.startsWith("0")) { v.add("62" + digits.slice(1)); v.add(digits.slice(1)); }
  if (digits.startsWith("8")) { v.add("62" + digits); v.add("0" + digits); }
  return Array.from(v);
}

async function createIpaymuPayment(
  cfg: { va: string; apiKey: string; baseUrl: string },
  inv: any,
  channel: string | null,
  notifyUrl: string,
  returnUrl: string,
  subChannel: string | null = null,
) {
  const totalCharged = Number(inv._amount_override ?? inv.total_amount) || 0;
  const amount = Math.max(1000, Math.round(totalCharged));
  const baseNo = String(inv.invoice_number || `SPP-${(inv.id || "").slice(0, 8)}`).replace(/[^A-Za-z0-9-]/g, "-");
  const referenceId = `${baseNo}-${Date.now().toString(36).slice(-4)}`;

  const studentName = String(inv.student_name || "").trim();
  const parentName = String(inv.parent_name || "").trim();
  // Nama siswa jadi identitas utama pembeli agar tampil jelas pada halaman VA / QRIS iPaymu.
  const buyerName = (studentName || parentName || "Siswa").slice(0, 100);
  const buyerPhone = String(inv.parent_phone || "081234567890").replace(/\D/g, "").slice(0, 15) || "081234567890";
  const buyerEmail = `spp-${(inv.id || "x").slice(0, 8)}@atskolla.com`;
  const isCustom = (inv.bill_type || "spp") === "custom";
  const billLabel = isCustom ? (inv.bill_category || "Tagihan") : "SPP";
  // Nama produk diawali Nama Siswa supaya jelas atas nama siapa pembayaran ini.
  const productName = (
    studentName
      ? `${studentName} - ${billLabel} ${inv.period_label || ""}`
      : `${billLabel} ${inv.period_label || ""}`
  ).replace(/\s+/g, " ").trim().slice(0, 100);

  const chMap = channelToIpaymu(channel, subChannel);
  const body: any = {
    product: [productName || `SPP ${referenceId}`],
    qty: [1],
    price: [amount],
    amount,
    returnUrl,
    notifyUrl,
    cancelUrl: returnUrl,
    referenceId,
    buyerName,
    buyerEmail,
    buyerPhone,
    expired: 72, // hours
    expiredType: "hours",
    ...chMap,
  };

  const res = await ipaymuFetch(cfg, "/api/v2/payment", body);
  const url = res.json?.Data?.Url || null;
  const sessionId = res.json?.Data?.SessionID || null;
  return {
    ok: res.ok && !!url && String(res.json?.Status) === "200",
    url,
    referenceId,
    sessionId,
    raw: res.json,
    status: res.status,
    expiry: new Date(Date.now() + LINK_TTL_MIN * 60 * 1000),
  };
}

async function checkIpaymuStatus(
  cfg: { va: string; apiKey: string; baseUrl: string },
  sessionOrRef: string,
) {
  const body: any = { transactionId: sessionOrRef };
  const res = await ipaymuFetch(cfg, "/api/v2/transaction", body);
  return { ok: res.ok, status: res.status, json: res.json };
}

function isPaidIpaymuStatus(status: unknown) {
  const s = String(status || "").toLowerCase();
  return ["berhasil", "success", "paid", "settled", "1"].includes(s);
}

async function syncPaidInvoices(admin: any, schoolId: string) {
  const cfg = await getIpaymuConfig(admin);
  if (!cfg.va || !cfg.apiKey) return { checked: 0, paid: 0, error: "iPaymu belum dikonfigurasi" };

  const { data: invoices } = await admin
    .from("spp_invoices").select("*")
    .eq("school_id", schoolId)
    .neq("status", "paid")
    .not("mayar_invoice_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  let paid = 0;
  for (const inv of invoices || []) {
    try {
      const stat = await checkIpaymuStatus(cfg, inv.mayar_invoice_id);
      const s = stat.json?.Data?.StatusDesc || stat.json?.Data?.Status;
      if (!isPaidIpaymuStatus(s)) continue;

      const paidAt = new Date().toISOString();
      await admin.from("spp_invoices").update({
        status: "paid", paid_at: paidAt, payment_method: "ipaymu",
      }).eq("id", inv.id);
      await admin.from("payment_transactions").update({
        status: "paid", paid_at: paidAt,
      }).eq("school_id", inv.school_id).eq("mayar_transaction_id", inv.mayar_invoice_id).eq("status", "pending");
      await admin.from("spp_logs").insert({
        school_id: inv.school_id, invoice_id: inv.id,
        event_type: "ipaymu_sync", status: "paid", payload: stat.json,
        message: "SPP paid (iPaymu sync)",
      });
      paid++;
    } catch (e) {
      console.error("ipaymu sync err", inv.id, e);
    }
  }
  return { checked: (invoices || []).length, paid };
}

async function ensureFreshLink(
  admin: any,
  inv: any,
  forceRegen = false,
  channel: string | null = null,
  subChannel: string | null = null,
) {
  const cfg = await getIpaymuConfig(admin);
  if (!cfg.va || !cfg.apiKey) {
    return { success: false, error: "iPaymu VA / API Key belum dikonfigurasi" };
  }
  const now = Date.now();
  const isExpired = inv.expired_at ? new Date(inv.expired_at).getTime() < now : false;
  const serviceFee = await serviceFeeFor(admin, channel, inv.total_amount || 0);
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
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const notifyUrl = `${supaUrl}/functions/v1/ipaymu-webhook`;
  const returnUrl = `${await getAppBaseUrl(admin)}/parent`;
  const created = await createIpaymuPayment(cfg, { ...inv, _amount_override: totalCharged }, channel, notifyUrl, returnUrl, subChannel);
  await admin.from("spp_logs").insert({
    school_id: inv.school_id, invoice_id: inv.id,
    event_type: "create_invoice_ipaymu",
    status: created.ok ? "ok" : "error",
    payload: created.raw,
    message: created.raw?.Message || created.raw?.message || null,
  });
  if (!created.ok || !created.url) {
    const msg = created.raw?.Message || created.raw?.message || JSON.stringify(created.raw).slice(0, 300);
    return { success: false, error: `Gagal buat pembayaran iPaymu: ${msg}` };
  }
  // Store iPaymu SessionID (Data.SessionID) as mayar_invoice_id (schema-compat) so webhook can match.
  const ref = created.sessionId || created.referenceId;
  await admin.from("spp_invoices").update({
    mayar_invoice_id: ref,
    payment_url: created.url,
    expired_at: created.expiry.toISOString(),
    status: "pending",
    service_fee: serviceFee,
    payment_channel: channel,
  }).eq("id", inv.id);
  const { data: anyPlan } = await admin.from("subscription_plans").select("id").limit(1).maybeSingle();
  await admin.from("payment_transactions").insert({
    school_id: inv.school_id,
    plan_id: anyPlan?.id || inv.school_id,
    amount: totalCharged,
    status: "pending",
    mayar_transaction_id: ref,
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
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ok = (data: any) => new Response(JSON.stringify({ success: true, ...data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const err = (m: string) => new Response(JSON.stringify({ success: false, error: m }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "parent_create_installment_payment") {
      const parentToken = req.headers.get("x-parent-token") || body.parent_token;
      if (!parentToken) return err("Unauthorized");
      const { data: ses } = await admin.from("parent_sessions").select("phone, expires_at").eq("token", parentToken).maybeSingle();
      if (!ses || new Date(ses.expires_at).getTime() < Date.now()) return err("Sesi tidak valid");

      const invoiceId = body.invoice_id as string;
      const amount = Math.round(Number(body.amount) || 0);
      const channel = normalizeChannel(body.channel);
      const subChannel = body.sub_channel || null;
      if (!invoiceId) return err("invoice_id wajib");
      if (!amount || amount < 10000) return err("Nominal cicilan minimum Rp 10.000");

      const { data: inv } = await admin.from("spp_invoices").select("*").eq("id", invoiceId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah lunas");
      if ((inv.bill_type || "spp") === "spp") return err("Tagihan SPP wajib dibayar penuh, tidak dapat dicicil");
      if (!inv.allow_installment) return err("Cicilan belum diaktifkan bendahara untuk tagihan ini");

      const { data: schoolRow } = await admin.from("schools").select("installment_enabled").eq("id", inv.school_id).maybeSingle();
      if ((schoolRow as any)?.installment_enabled === false) return err("Fitur cicilan dinonaktifkan sekolah");

      const { data: studentRow } = await admin.from("students").select("parent_phone").eq("id", inv.student_id).maybeSingle();
      const sesV = phoneVariants(ses.phone || "");
      const owned =
        sesV.some((p) => phoneVariants(studentRow?.parent_phone || "").includes(p)) ||
        sesV.some((p) => phoneVariants(inv.parent_phone || "").includes(p));
      if (!owned) return err("Akses ditolak");

      const { data: existing } = await admin
        .from("spp_installments").select("amount,status,expired_at").eq("invoice_id", inv.id);
      const nowMs = Date.now();
      const locked = (existing || []).reduce((s: number, r: any) => {
        if (r.status === "paid") return s + (r.amount || 0);
        if (r.status === "pending" && (!r.expired_at || new Date(r.expired_at).getTime() > nowMs)) return s + (r.amount || 0);
        return s;
      }, 0);
      const remaining = Math.max(0, (inv.total_amount || 0) - locked);
      if (amount > remaining) return err(`Nominal melebihi sisa tagihan (${remaining})`);

      const cfg = await getIpaymuConfig(admin);
      if (!cfg.va || !cfg.apiKey) return err("iPaymu belum dikonfigurasi");

      const serviceFee = await serviceFeeFor(admin, channel, amount);
      const totalCharged = amount + serviceFee;
      const supaUrl = Deno.env.get("SUPABASE_URL")!;
      const notifyUrl = `${supaUrl}/functions/v1/ipaymu-webhook`;
      const returnUrl = `${await getAppBaseUrl(admin)}/parent`;
      const cicilanInv = {
        ...inv,
        _amount_override: totalCharged,
        period_label: `Cicilan ${inv.period_label || ""}`.trim(),
        invoice_number: `${inv.invoice_number || "SPP"}-CIC${Date.now().toString().slice(-6)}`,
      };
      const created = await createIpaymuPayment(cfg, cicilanInv, channel, notifyUrl, returnUrl, subChannel);
      await admin.from("spp_logs").insert({
        school_id: inv.school_id, invoice_id: inv.id,
        event_type: "create_installment_ipaymu",
        status: created.ok ? "ok" : "error",
        payload: created.raw,
        message: created.raw?.Message || created.raw?.message || null,
      });
      if (!created.ok || !created.url) {
        const msg = created.raw?.Message || created.raw?.message || "Gagal buat pembayaran iPaymu";
        return err(String(msg));
      }

      const ref = created.sessionId || created.referenceId;
      const { data: instRow, error: insErr } = await admin.from("spp_installments").insert({
        invoice_id: inv.id,
        school_id: inv.school_id,
        student_id: inv.student_id,
        amount,
        payment_method: "online_ipaymu",
        payment_channel: channel,
        gateway: "ipaymu",
        mayar_invoice_id: ref,
        mayar_transaction_id: ref,
        mayar_payment_url: created.url,
        expired_at: created.expiry.toISOString(),
        status: "pending",
        notes: `Cicilan online oleh wali murid — ${channel || "va"}`,
      }).select("id").single();
      if (insErr) return err("Gagal simpan cicilan: " + insErr.message);

      const { data: anyPlan } = await admin.from("subscription_plans").select("id").limit(1).maybeSingle();
      await admin.from("payment_transactions").insert({
        school_id: inv.school_id,
        plan_id: anyPlan?.id || inv.school_id,
        amount: totalCharged,
        status: "pending",
        mayar_transaction_id: ref,
        mayar_payment_url: created.url,
        payment_method: "spp_installment",
        service_fee: serviceFee,
        payment_channel: channel,
      });

      return ok({
        payment_url: brandPaymentUrl(created.url),
        installment_id: instRow?.id,
        invoice_id: inv.id,
        service_fee: serviceFee,
        total_charged: totalCharged,
      });
    }

    if (action === "parent_create_payment") {
      const parentToken = req.headers.get("x-parent-token") || body.parent_token;
      if (!parentToken) return err("Unauthorized");
      const { data: ses } = await admin.from("parent_sessions").select("phone, expires_at").eq("token", parentToken).maybeSingle();
      if (!ses || new Date(ses.expires_at).getTime() < Date.now()) return err("Sesi tidak valid");
      const invoiceId = body.invoice_id as string;
      const { data: inv } = await admin.from("spp_invoices").select("*").eq("id", invoiceId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah lunas");
      const { data: studentRow } = await admin
        .from("students")
        .select("parent_phone")
        .eq("id", inv.student_id)
        .maybeSingle();
      const sesVariants = phoneVariants(ses.phone || "");
      const studentVariants = phoneVariants(studentRow?.parent_phone || "");
      const invVariants = phoneVariants(inv.parent_phone || "");
      const owned =
        sesVariants.some((p) => studentVariants.includes(p)) ||
        sesVariants.some((p) => invVariants.includes(p));
      if (!owned) return err("Akses ditolak");
      const result = await ensureFreshLink(admin, inv, false, normalizeChannel(body.channel), body.sub_channel || null);
      if (!result.success) return err(result.error || "Gagal");
      return ok({
        payment_url: brandPaymentUrl(result.payment_url),
        invoice_id: result.invoice_id,
        service_fee: result.service_fee || 0,
        total_charged: result.total_charged || inv.total_amount,
      });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return err("Unauthorized");
    const { data: claimsRes, error: claimsErr } = await admin.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) return err("Unauthorized");
    const userId = claimsRes.claims.sub as string;

    if (action === "test_connection") {
      const cfg = await getIpaymuConfig(admin);
      if (!cfg.va || !cfg.apiKey) return ok({ connected: false, message: "iPaymu VA / API Key belum di-set" });
      const supaUrl = Deno.env.get("SUPABASE_URL")!;
      const testRes = await ipaymuFetch(cfg, "/api/v2/payment", {
        product: ["Test ATSkolla"],
        qty: [1],
        price: [10000],
        amount: 10000,
        returnUrl: "https://absenpintar.online/parent",
        notifyUrl: `${supaUrl}/functions/v1/ipaymu-webhook`,
        cancelUrl: "https://absenpintar.online/parent",
        referenceId: `TEST-${Date.now()}`,
        buyerName: "Test ATSkolla",
        buyerEmail: "test@atskolla.com",
        buyerPhone: "081234567890",
      });
      const connected = testRes.ok && String(testRes.json?.Status) === "200" && !!testRes.json?.Data?.Url;
      const message = connected
        ? `iPaymu ${cfg.env.toUpperCase()} Connected`
        : (testRes.json?.Message || testRes.json?.message || `HTTP ${testRes.status}`);
      return ok({ connected, message });
    }

    const { data: profile } = await admin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();
    const schoolId = profile?.school_id;

    if (action === "create_payment_link" || action === "regenerate_payment_link") {
      if (!schoolId) return err("Akun tidak terhubung sekolah");
      const { invoice_id } = body;
      const { data: inv } = await admin.from("spp_invoices").select("*").eq("id", invoice_id).eq("school_id", schoolId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah dibayar");
      const result = await ensureFreshLink(admin, inv, action === "regenerate_payment_link", normalizeChannel(body.channel), body.sub_channel || null);
      if (!result.success) return err(result.error || "Gagal");
      return ok({ payment_url: brandPaymentUrl(result.payment_url), invoice_id: result.invoice_id });
    }

    if (action === "sync_paid_invoices") {
      if (!schoolId) return err("Akun tidak terhubung sekolah");
      const result = await syncPaidInvoices(admin, schoolId);
      return ok(result);
    }

    return err("Unknown action");
  } catch (e: any) {
    console.error("spp-ipaymu error:", e);
    return err(e.message || "Internal error");
  }
});
