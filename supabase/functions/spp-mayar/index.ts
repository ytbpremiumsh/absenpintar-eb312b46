import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brandPaymentUrl } from "../_shared/brandUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-parent-token",
};

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// Mayar payment link expires in 14 days; we cap our logical expiry to that
const MAYAR_LINK_TTL_DAYS = 14;

function buildInvoiceTitle(inv: { student_name: string; class_name: string; period_label: string }) {
  return `${inv.student_name} – ${inv.class_name} – ${inv.period_label}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isPaidMayarStatus = (status: unknown) => {
  const s = String(status || "").toLowerCase();
  return ["paid", "settled", "success", "completed"].includes(s) || status === true;
};

async function getGatewayFeeConfig(supabaseAdmin: any): Promise<{ percent: number; flat: number }> {
  try {
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("key,value")
      .in("key", ["gateway_fee_percent", "gateway_fee_flat"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    const percent = parseFloat(map.gateway_fee_percent ?? "0.7");
    const flat = parseInt(map.gateway_fee_flat ?? "500", 10);
    return { percent: Number.isFinite(percent) ? percent : 0.7, flat: Number.isFinite(flat) ? flat : 500 };
  } catch {
    return { percent: 0.7, flat: 500 };
  }
}

function calcGatewayFee(amount: number, cfg: { percent: number; flat: number }) {
  return Math.round((Number(amount) || 0) * (cfg.percent / 100)) + (cfg.flat || 0);
}

function normalizePhone(raw: string) {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.slice(1);
  else if (phone.startsWith("8")) phone = "62" + phone;
  return phone;
}

function buildPaidMessage(inv: any, paidAt: string, schoolName: string) {
  const paidDate = new Date(paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `*${schoolName} — Pembayaran SPP Berhasil*\n\nYth. Bapak/Ibu *${inv.parent_name || "Wali"}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : Rp${(inv.total_amount || 0).toLocaleString("id-ID")}\n• Metode  : QRIS / Transfer Bank\n• Tanggal : ${paidDate}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
}

async function getSchoolName(supabaseAdmin: any, schoolId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from("schools").select("name").eq("id", schoolId).maybeSingle();
    return data?.name || "Sekolah";
  } catch { return "Sekolah"; }
}

async function notifySppPaid(supabaseAdmin: any, inv: any, paidAt: string) {
  if (!inv.parent_phone) return { sent: false, reason: "no_phone" };
  const schoolName = await getSchoolName(supabaseAdmin, inv.school_id);
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
    },
    body: JSON.stringify({
      school_id: inv.school_id,
      phone: normalizePhone(inv.parent_phone),
      message: buildPaidMessage(inv, paidAt, schoolName),
      message_type: "spp_paid",
      student_name: inv.student_name,
    }),
  });
  const text = await res.text().catch(() => "");
  return { sent: res.ok && !/"success"\s*:\s*false/.test(text), status: res.status, body: text.slice(0, 300) };
}

async function getMayarApiKey(supabaseAdmin: any): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("platform_settings").select("value").eq("key", "mayar_api_key").maybeSingle();
    if (data?.value) return data.value as string;
  } catch (_) {}
  return Deno.env.get("MAYAR_API_KEY") || "";
}

async function syncPaidInvoicesFromMayar(supabaseAdmin: any, schoolId: string) {
  const apiKey = await getMayarApiKey(supabaseAdmin);
  if (!apiKey) return { checked: 0, paid: 0, wa_sent: 0, error: "MAYAR_API_KEY belum dikonfigurasi" };

  const { data: invoices } = await supabaseAdmin
    .from("spp_invoices")
    .select("*")
    .eq("school_id", schoolId)
    .neq("status", "paid")
    .not("mayar_invoice_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(75);

  const feeCfg = await getGatewayFeeConfig(supabaseAdmin);
  let paid = 0;
  let waSent = 0;

  for (const inv of invoices || []) {
    try {
      const res = await fetch(`https://api.mayar.id/hl/v1/invoice/${encodeURIComponent(inv.mayar_invoice_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const detail = await res.json().catch(() => null);
      const detailData = detail?.data || detail;
      if (!res.ok || !isPaidMayarStatus(detailData?.status)) continue;

      const paidAt = detailData?.paidAt || detailData?.paid_at || new Date().toISOString();
      const gatewayFee = calcGatewayFee(inv.total_amount || 0, feeCfg);
      const netAmount = Math.max(0, (inv.total_amount || 0) - gatewayFee);

      await supabaseAdmin.from("spp_invoices").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: detailData?.paymentMethod || detailData?.payment_method || "mayar",
        gateway_fee: gatewayFee,
        net_amount: netAmount,
      }).eq("id", inv.id);

      await supabaseAdmin.from("payment_transactions").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "spp",
      }).eq("school_id", inv.school_id).eq("mayar_transaction_id", inv.mayar_invoice_id).eq("status", "pending");

      await supabaseAdmin.from("spp_logs").insert({
        school_id: inv.school_id,
        invoice_id: inv.id,
        event_type: "mayar_sync",
        status: "paid",
        payload: detail,
        message: "SPP paid (bendahara sync)",
      });

      await supabaseAdmin.from("notifications").insert({
        school_id: inv.school_id,
        title: "Pembayaran SPP Diterima",
        message: `Pembayaran SPP ${inv.student_name} (${inv.class_name}) untuk ${inv.period_label} sebesar Rp ${(inv.total_amount || 0).toLocaleString("id-ID")} telah diterima.`,
        type: "success",
      });

      const wa = await notifySppPaid(supabaseAdmin, inv, paidAt).catch((e) => ({ sent: false, error: String(e) }));
      if ((wa as any).sent) waSent++;
      console.log("SPP paid sync", inv.id, JSON.stringify(wa));
      paid++;
    } catch (e) {
      console.error("syncPaidInvoicesFromMayar failed", inv.id, e);
    }
  }

  return { checked: (invoices || []).length, paid, wa_sent: waSent };
}

// Fees are configurable via platform_settings (fee_va / fee_retail).
// QRIS uses a dynamic formula: max(Rp2.500, 1% * amount) — server & client agree.
// Fee is added to invoice total charged to wali murid.
const DEFAULT_FEES: Record<string, number> = { va: 5000, qris: 5000, retail: 8000 };
const QRIS_MIN_FEE = 2500;
const QRIS_PERCENT = 0.01;
function computeQrisFee(amount: number): number {
  const base = Math.max(0, Number(amount) || 0);
  return Math.max(QRIS_MIN_FEE, Math.round(base * QRIS_PERCENT));
}
function normalizeChannel(c: any): string | null {
  const v = String(c || "").toLowerCase();
  return v in DEFAULT_FEES ? v : null;
}
async function serviceFeeFor(supabaseAdmin: any, c: any, amount = 0): Promise<number> {
  const v = normalizeChannel(c);
  if (!v) return 0;
  if (v === "qris") return computeQrisFee(amount);
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

async function createMayarLink(apiKey: string, inv: any, attempt = 0): Promise<{ ok: boolean; json: any; expiry: Date; status: number }> {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + MAYAR_LINK_TTL_DAYS);
  // Short uniq token — keeps Mayar recipient/email unique without exposing long codes.
  // A static email/phone can make Mayar return another student's existing link.
  const uniq = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, "").slice(-6);
  // amount_override lets caller include service_fee before creating Mayar link.
  const baseAmount = Number(inv._amount_override ?? inv.total_amount) || 0;
  const safeAmount = Math.max(1000, Math.round(baseAmount));
  const buyerEmail = `spp${uniq}@atskolla.com`;
  // Use a short synthetic mobile so Mayar does not dedupe against another student sharing a parent phone.
  const mobileSeed = `${String(inv.id || "")}${Date.now()}${attempt}`;
  const mobileDigits = Array.from(mobileSeed).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 10000000, 0).toString().padStart(7, "0");
  const recipientName = `${inv.student_name} - ${inv.class_name} - ${inv.period_label}`;
  const payload = {
    name: recipientName,
    amount: safeAmount,
    description: `SPP ${inv.period_label} ${inv.student_name}`,
    email: buyerEmail,
    mobile: `0800${mobileDigits}`,
    redirectUrl: "https://atskolla.com/parent",
    expiredAt: expiry.toISOString(),
  };
  const res = await fetch("https://api.mayar.id/hl/v1/payment/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));

  const msgText = String(json?.message || json?.messages || "").toLowerCase();
  // If Mayar already has a link for this invoice, try to reuse it instead of retrying blindly.
  if ((res.status === 409 || /already exist|duplicate/i.test(msgText)) && json?.data) {
    const existing = Array.isArray(json.data) ? json.data[0] : json.data;
    const existingLink = existing?.link || existing?.paymentUrl || existing?.payment_url;
    if (existingLink) {
      console.log("Mayar 409 — reusing existing link from response");
      return { ok: true, json: { data: { ...existing, link: existingLink } }, expiry, status: 200 };
    }
  }

  // Retry with stronger uniqueness (also vary mobile suffix) for 429/409/duplicate.
  const isDuplicate =
    res.status === 429 ||
    res.status === 409 ||
    /duplicate|already exist/i.test(msgText);
  if (isDuplicate && attempt < 4) {
    const backoff = 600 + attempt * 500 + Math.floor(Math.random() * 400);
    console.log(`Mayar ${res.status} retry #${attempt + 1}: ${JSON.stringify(json).slice(0, 400)}`);
    await sleep(backoff);
    // Mutate inv copy with a tweaked phone to defeat phone-based dedupe
    const tweakedInv = { ...inv, parent_phone: `0800000${String(Date.now()).slice(-4)}` };
    return createMayarLink(apiKey, tweakedInv, attempt + 1);
  }

  return { ok: res.ok && !!json?.data?.link, json, expiry, status: res.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ok = (data: any) => new Response(JSON.stringify({ success: true, ...data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const err = (m: string) => new Response(JSON.stringify({ success: false, error: m }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const action = body.action as string;

    // ====== PARENT ACTION (no school auth, uses parent token) ======
    if (action === "parent_create_payment") {
      const parentToken = req.headers.get("x-parent-token") || body.parent_token;
      if (!parentToken) return err("Unauthorized");
      const { data: ses } = await supabaseAdmin.from("parent_sessions").select("phone, expires_at").eq("token", parentToken).maybeSingle();
      if (!ses || new Date(ses.expires_at).getTime() < Date.now()) return err("Sesi tidak valid");

      const invoiceId = body.invoice_id as string;
      const { data: inv } = await supabaseAdmin.from("spp_invoices").select("*").eq("id", invoiceId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah lunas");

      // Verify parent owns the invoice via the student's CURRENT parent_phone
      // (invoice's snapshot parent_phone may be stale/wrong; trust the student record)
      const { data: studentRow } = await supabaseAdmin
        .from("students")
        .select("parent_phone")
        .eq("id", inv.student_id)
        .maybeSingle();

      const phoneVariants = (raw: string): string[] => {
        const digits = (raw || "").replace(/\D/g, "");
        const v = new Set<string>();
        if (!digits) return [];
        v.add(digits);
        if (digits.startsWith("62")) { v.add("0" + digits.slice(2)); v.add(digits.slice(2)); }
        if (digits.startsWith("0")) { v.add("62" + digits.slice(1)); v.add(digits.slice(1)); }
        if (digits.startsWith("8")) { v.add("62" + digits); v.add("0" + digits); }
        return Array.from(v);
      };
      const sesVariants = phoneVariants(ses.phone || "");
      const studentVariants = phoneVariants(studentRow?.parent_phone || "");
      const invVariants = phoneVariants(inv.parent_phone || "");
      const owned =
        sesVariants.some((p) => studentVariants.includes(p)) ||
        sesVariants.some((p) => invVariants.includes(p));
      if (!owned) return err("Akses ditolak");

      const result = await ensureFreshLink(supabaseAdmin, inv, false, normalizeChannel(body.channel));
      if (!result.success) return err(result.error || "Gagal");
      return ok({
        payment_url: brandPaymentUrl(result.payment_url),
        invoice_id: result.invoice_id,
        service_fee: result.service_fee || 0,
        total_charged: result.total_charged || inv.total_amount,
      });
    }

    // ====== SCHOOL ACTIONS (require school admin/bendahara JWT) ======
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return err("Unauthorized");
    const { data: claimsRes, error: claimsErr } = await supabaseAdmin.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims) return err("Unauthorized");
    const userId = claimsRes.claims.sub as string;

    const { data: profile } = await supabaseAdmin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();
    const schoolId = profile?.school_id;
    if (!schoolId) return err("Akun tidak terhubung sekolah");

    // ====== TEST CONNECTION ======
    if (action === "test_connection") {
      const apiKey = await getMayarApiKey(supabaseAdmin);
      if (!apiKey) return ok({ connected: false, message: "MAYAR_API_KEY belum di-set" });
      try {
        const res = await fetch("https://api.mayar.id/hl/v1/payment/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Koneksi - ATSkolla", amount: 1000, description: "test", email: "test@atskolla.com", mobile: "08000000000" }),
        });
        const json = await res.json();
        const connected = res.ok && json?.data?.link;
        await supabaseAdmin.from("bendahara_settings").upsert({
          school_id: schoolId,
          last_test_status: connected ? "connected" : "failed",
          last_tested_at: new Date().toISOString(),
        }, { onConflict: "school_id" });
        return ok({ connected, message: connected ? "Mayar Connected" : (json?.message || "Connection Failed") });
      } catch (e: any) {
        return ok({ connected: false, message: e.message });
      }
    }

    // ====== CREATE / REGENERATE PAYMENT LINK ======
    if (action === "create_payment_link" || action === "regenerate_payment_link") {
      const { invoice_id } = body;
      const { data: inv } = await supabaseAdmin.from("spp_invoices").select("*").eq("id", invoice_id).eq("school_id", schoolId).maybeSingle();
      if (!inv) return err("Invoice tidak ditemukan");
      if (inv.status === "paid") return err("Invoice sudah dibayar");

      const result = await ensureFreshLink(supabaseAdmin, inv, action === "regenerate_payment_link");
      if (!result.success) return err(result.error || "Gagal");
      return ok({ payment_url: brandPaymentUrl(result.payment_url), invoice_id: result.invoice_id });
    }

    // ====== SYNC PAID INVOICES ======
    if (action === "sync_paid_invoices") {
      const result = await syncPaidInvoicesFromMayar(supabaseAdmin, schoolId);
      return ok(result);
    }

    return err("Unknown action");
  } catch (e: any) {
    console.error("spp-mayar error:", e);
    return err(e.message || "Internal error");
  }
});

// ─────────────────────────────────────────────
// Core: ensure invoice has a non-expired Mayar link.
// If link is fresh → return as-is.
// If link expired or absent → mark old as 'expired', create new invoice (regenerated_from), new link.
// ─────────────────────────────────────────────
async function ensureFreshLink(
  supabaseAdmin: any,
  inv: any,
  forceRegen = false,
  channel: string | null = null,
): Promise<{ success: boolean; payment_url?: string; invoice_id?: string; error?: string; service_fee?: number; total_charged?: number }> {
  const apiKey = await getMayarApiKey(supabaseAdmin);
  if (!apiKey) return { success: false, error: "MAYAR_API_KEY belum dikonfigurasi" };

  const now = Date.now();
  const isExpired = inv.expired_at ? new Date(inv.expired_at).getTime() < now : false;
  const serviceFee = await serviceFeeFor(supabaseAdmin, channel, inv.total_amount || 0);

  // Reuse if fresh & not forced AND channel matches previously chosen one.
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

  // If the invoice itself is already 'expired', find/use its latest pending sibling instead
  // of creating yet another row. This prevents duplicate -RAMLT, -RAWCV, -RE1R6 chains.
  let parentInvoiceId = inv.id;
  if (inv.status === "expired") {
    const rootId = inv.regenerated_from || inv.id;
    const { data: sibling } = await supabaseAdmin
      .from("spp_invoices")
      .select("*")
      .eq("school_id", inv.school_id)
      .eq("student_id", inv.student_id)
      .eq("period_month", inv.period_month)
      .eq("period_year", inv.period_year)
      .neq("status", "expired")
      .neq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sibling) {
      inv = sibling;
      parentInvoiceId = sibling.id;
    }
  }

  // Create Mayar link with total = tagihan + service_fee
  const totalCharged = (Number(inv.total_amount) || 0) + serviceFee;
  const linkRes = await createMayarLink(apiKey, { ...inv, _amount_override: totalCharged });
  await supabaseAdmin.from("spp_logs").insert({
    school_id: inv.school_id,
    invoice_id: inv.id,
    event_type: "create_invoice",
    status: linkRes.ok ? "ok" : "error",
    payload: linkRes.json,
    message: linkRes.json?.message || null,
  });
  if (!linkRes.ok) {
    const detail = Array.isArray(linkRes.json?.data)
      ? linkRes.json.data.map((d: any) => d?.message || d?.field).filter(Boolean).join("; ")
      : "";
    const msg = linkRes.json?.message || linkRes.json?.messages || detail || "Gagal create payment di Mayar";
    return { success: false, error: detail ? `${msg} (${detail})` : msg };
  }

  const link = linkRes.json.data;
  const mayarId = link.id || link.paymentLinkId || link.paymentLinkID || null;
  const mayarTransactionId = link.transactionId || link.transaction_id || null;
  await supabaseAdmin.from("spp_invoices").update({
    mayar_invoice_id: mayarId,
    payment_url: link.link || null,
    expired_at: linkRes.expiry.toISOString(),
    status: "pending",
    service_fee: serviceFee,
    payment_channel: channel,
  }).eq("id", inv.id);

  // Bridge to payment_transactions for webhook compatibility
  const { data: anyPlan } = await supabaseAdmin.from("subscription_plans").select("id").limit(1).maybeSingle();
  await supabaseAdmin.from("payment_transactions").insert({
    school_id: inv.school_id,
    plan_id: anyPlan?.id || inv.school_id,
    amount: totalCharged,
    status: "pending",
    mayar_transaction_id: mayarId || mayarTransactionId,
    mayar_payment_url: link.link || null,
    payment_method: "spp",
    service_fee: serviceFee,
    payment_channel: channel,
  });

  return {
    success: true,
    payment_url: link.link,
    invoice_id: parentInvoiceId,
    service_fee: serviceFee,
    total_charged: totalCharged,
  };
}

