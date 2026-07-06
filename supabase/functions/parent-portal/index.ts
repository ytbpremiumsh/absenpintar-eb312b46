// Parent Dashboard API — handles login (WA OTP), session validation, and data access.
// verify_jwt = false because parents do not have Supabase auth users; we use custom session tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { brandPaymentUrl } from "../_shared/brandUrl.ts";
import { sendOtpMessage } from "../_shared/sendOtp.ts";
import { createHmac, createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-parent-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status: 200, // always 200 to avoid frontend non-2xx crash
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const normalizePhone = (raw: string) => {
  let p = (raw || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return p;
};

const genToken = () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const isPaidMayarStatus = (status: unknown) => {
  const s = String(status || "").toLowerCase();
  return ["paid", "settled", "success", "completed"].includes(s);
};

async function getGatewayFeeConfig(): Promise<{ percent: number; flat: number }> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('key,value')
      .in('key', ['gateway_fee_percent', 'gateway_fee_flat']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    const percent = parseFloat(map['gateway_fee_percent'] ?? '0.7');
    const flat = parseInt(map['gateway_fee_flat'] ?? '500', 10);
    return {
      percent: isNaN(percent) ? 0.7 : percent,
      flat: isNaN(flat) ? 500 : flat,
    };
  } catch { return { percent: 0.7, flat: 500 }; }
}

function buildSppPaidMessage(inv: any, paidAt: string, schoolName: string) {
  const paidDate = new Date(paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `*${schoolName} — Pembayaran SPP Berhasil*\n\nYth. Bapak/Ibu *${inv.parent_name || "Wali"}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : Rp${(inv.total_amount || 0).toLocaleString("id-ID")}\n• Metode  : QRIS / Transfer Bank\n• Tanggal : ${paidDate}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
}

async function getSchoolNameById(schoolId: string): Promise<string> {
  try {
    const { data } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
    return data?.name || "Sekolah";
  } catch { return "Sekolah"; }
}

async function sendSppPaidWhatsApp(inv: any, paidAt: string) {
  if (!inv.parent_phone) return { sent: false, reason: "no_phone" };
  const phone = normalizePhone(inv.parent_phone);
  const schoolName = await getSchoolNameById(inv.school_id);
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      school_id: inv.school_id,
      phone,
      message: buildSppPaidMessage(inv, paidAt, schoolName),
      message_type: "spp_paid",
      student_name: inv.student_name,
    },
  });
  if (error || data?.success === false) return { sent: false, error: error?.message || data?.error || "send_failed", details: data };
  return { sent: true, details: data };
}

async function getMayarApiKey(): Promise<string> {
  try {
    const { data } = await supabase
      .from("platform_settings").select("value").eq("key", "mayar_api_key").maybeSingle();
    if (data?.value) return data.value as string;
  } catch (_) {}
  return Deno.env.get("MAYAR_API_KEY") || "";
}

async function syncSppInvoicesFromMayar(invoices: any[]) {
  const apiKey = await getMayarApiKey();
  if (!apiKey) return invoices;
  const feeCfg = await getGatewayFeeConfig();
  const synced: any[] = [];
  for (const inv of invoices) {
    if (inv.status === "paid" || !inv.mayar_invoice_id) { synced.push(inv); continue; }
    try {
      const res = await fetch(`https://api.mayar.id/hl/v1/invoice/${encodeURIComponent(inv.mayar_invoice_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const detail = await res.json().catch(() => null);
      const data = detail?.data;
      if (!res.ok || !isPaidMayarStatus(data?.status)) { synced.push(inv); continue; }

      const paidAt = new Date().toISOString();
      const gatewayFee = Math.round((inv.total_amount || 0) * (feeCfg.percent / 100)) + (feeCfg.flat || 0);
      const netAmount = Math.max(0, (inv.total_amount || 0) - gatewayFee);
      const paymentMethod = data?.paymentMethod || data?.payment_method || "mayar";
      await supabase.from("spp_invoices").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: paymentMethod,
        gateway_fee: gatewayFee,
        net_amount: netAmount,
      }).eq("id", inv.id);
      await supabase.from("payment_transactions").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "spp",
      }).eq("school_id", inv.school_id).eq("mayar_transaction_id", inv.mayar_invoice_id).eq("status", "pending");
      await supabase.from("spp_logs").insert({
        school_id: inv.school_id,
        invoice_id: inv.id,
        event_type: "mayar_sync",
        status: "paid",
        payload: detail,
        message: "SPP paid (parent sync)",
      });

      // Notif dashboard sekolah
      await supabase.from("notifications").insert({
        school_id: inv.school_id,
        title: "Pembayaran SPP Diterima",
        message: `Pembayaran SPP ${inv.student_name} (${inv.class_name}) untuk ${inv.period_label} sebesar Rp ${(inv.total_amount || 0).toLocaleString("id-ID")} telah diterima.`,
        type: "success",
      });

      const waResult = await sendSppPaidWhatsApp(inv, paidAt).catch((waErr) => ({ sent: false, error: String(waErr) }));
      console.log("SPP WA notif (parent sync):", JSON.stringify(waResult));

      synced.push({ ...inv, status: "paid", paid_at: paidAt, payment_method: paymentMethod, gateway_fee: gatewayFee, net_amount: netAmount });
    } catch (e) {
      console.error("Mayar SPP sync failed", inv.id, e);
      synced.push(inv);
    }
  }
  return synced;
}

// ---- Doku status sync (mirrors Mayar sync) --------------------------------
async function getDokuCfg() {
  const { data } = await supabase
    .from("platform_settings")
    .select("key,value")
    .in("key", ["doku_client_id", "doku_secret_key", "doku_env"]);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
  const clientId = map.doku_client_id || Deno.env.get("DOKU_CLIENT_ID") || "";
  const secretKey = map.doku_secret_key || Deno.env.get("DOKU_SECRET_KEY") || "";
  const env = (map.doku_env || "production").toLowerCase();
  const baseUrl = env === "sandbox" ? "https://api-sandbox.doku.com" : "https://api.doku.com";
  return { clientId, secretKey, baseUrl };
}

function isPaidDokuStatus(status: unknown) {
  const s = String(status || "").toUpperCase();
  return ["PAID", "SUCCESS", "SETTLED", "COMPLETED", "SUCCESSFUL"].includes(s);
}

async function checkDokuOrder(cfg: { clientId: string; secretKey: string; baseUrl: string }, invoiceNumber: string) {
  const target = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().split(".")[0] + "Z";
  const digest = createHash("sha256").update("", "utf8").digest("base64");
  const stringToSign =
    `Client-Id:${cfg.clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${requestTimestamp}\n` +
    `Request-Target:${target}\n` +
    `Digest:${digest}`;
  const signature = "HMACSHA256=" + createHmac("sha256", cfg.secretKey).update(stringToSign, "utf8").digest("base64");
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

// Doku invoice_numbers created by spp-doku start with "SPP-".
const looksLikeDokuInvoice = (id: string | null | undefined) => !!id && /^SPP-/i.test(id);

async function syncSppInvoicesFromDoku(invoices: any[]) {
  const pending = invoices.filter((i) => i.status !== "paid" && looksLikeDokuInvoice(i.mayar_invoice_id));
  if (pending.length === 0) return invoices;
  const cfg = await getDokuCfg();
  if (!cfg.clientId || !cfg.secretKey) return invoices;
  const byId = new Map(invoices.map((i) => [i.id, i]));
  for (const inv of pending) {
    try {
      const stat = await checkDokuOrder(cfg, inv.mayar_invoice_id);
      const s = stat.json?.response?.order?.status || stat.json?.order?.status;
      if (!isPaidDokuStatus(s)) continue;
      const paidAt = new Date().toISOString();
      await supabase.from("spp_invoices").update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "doku",
      }).eq("id", inv.id);
      await supabase.from("payment_transactions").update({
        status: "paid",
        paid_at: paidAt,
      }).eq("school_id", inv.school_id).eq("mayar_transaction_id", inv.mayar_invoice_id).eq("status", "pending");
      await supabase.from("spp_logs").insert({
        school_id: inv.school_id,
        invoice_id: inv.id,
        event_type: "doku_sync",
        status: "paid",
        payload: stat.json,
        message: "SPP paid (parent portal Doku sync)",
      });
      await supabase.from("notifications").insert({
        school_id: inv.school_id,
        title: "Pembayaran SPP Diterima",
        message: `Pembayaran SPP ${inv.student_name} (${inv.class_name}) untuk ${inv.period_label} sebesar Rp ${(inv.total_amount || 0).toLocaleString("id-ID")} telah diterima.`,
        type: "success",
      });
      const waResult = await sendSppPaidWhatsApp(inv, paidAt).catch((waErr) => ({ sent: false, error: String(waErr) }));
      console.log("SPP WA notif (Doku sync):", JSON.stringify(waResult));
      byId.set(inv.id, { ...inv, status: "paid", paid_at: paidAt, payment_method: "doku" });
    } catch (e) {
      console.error("Doku SPP sync failed", inv.id, e);
    }
  }
  return invoices.map((i) => byId.get(i.id) || i);
}

function phoneVariants(phone: string): string[] {
  const digits = (phone || "").replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.startsWith("62")) {
    variants.add("0" + digits.slice(2));
    variants.add(digits.slice(2));
    variants.add("+" + digits);
  }
  if (digits.startsWith("0")) {
    variants.add("62" + digits.slice(1));
    variants.add(digits.slice(1));
  }
  if (digits.startsWith("8")) {
    variants.add("62" + digits);
    variants.add("0" + digits);
  }
  return Array.from(variants).filter(Boolean);
}

async function findStudentsByPhone(phone: string) {
  const variants = phoneVariants(phone);
  const { data } = await supabase
    .from("students")
    .select("id, name, student_id, qr_code, class, photo_url, gender, school_id, parent_name, parent_phone, card_number, schools(id, name, logo)")
    .in("parent_phone", variants);
  return data || [];
}

async function findPhoneByCardNumber(card: string): Promise<string | null> {
  const digits = (card || "").replace(/\D/g, "");
  if (digits.length !== 16) return null;
  const { data } = await supabase
    .from("students")
    .select("parent_phone")
    .eq("card_number", digits)
    .maybeSingle();
  return data?.parent_phone || null;
}

async function getSession(req: Request) {
  const token = req.headers.get("x-parent-token");
  if (!token) return null;
  const { data } = await supabase
    .from("parent_sessions")
    .select("phone, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { phone: data.phone, token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (await req.clone().json().catch(() => ({}))).action;
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ---- Public actions ----
    if (action === "payment_config") {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("key,value")
          .in("key", ["fee_va", "fee_qris", "fee_retail", "fee_qris_percent"]);
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.key] = r.value; });
        const num = (v: any, d: number) => {
          const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
          return isNaN(n) ? d : n;
        };
        const pct = parseFloat(String(map.fee_qris_percent ?? "").replace(",", "."));
        const qrisPercent = Number.isFinite(pct) && pct >= 0 ? pct / 100 : 0.01;
        return json({
          ok: true,
          fees: {
            va: num(map.fee_va, 5000),
            qris: num(map.fee_qris, 5000),
            retail: num(map.fee_retail, 8000),
          },
          qris_percent: qrisPercent,
        });
      } catch {
        return json({ ok: true, fees: { va: 5000, qris: 5000, retail: 8000 }, qris_percent: 0.01 });
      }
    }

    // Direct login via Nomor Kartu Identitas — no OTP required.
    if (action === "login_card") {
      const digits = String(body.card_number || "").replace(/\D/g, "");
      if (digits.length !== 16) return json({ error: "Nomor Kartu Identitas harus 16 digit" });
      const phone = await findPhoneByCardNumber(digits);
      if (!phone) return json({ error: "Nomor Kartu Identitas tidak ditemukan. Hubungi admin sekolah." });
      const normPhone = normalizePhone(phone);
      const students = await findStudentsByPhone(normPhone);
      if (students.length === 0) {
        return json({ error: "Data siswa tidak ditemukan untuk kartu ini." });
      }
      const token = genToken();
      await supabase.from("parent_sessions").insert({ token, phone: normPhone });
      return json({ ok: true, token, phone: normPhone });
    }

    if (action === "request_otp") {
      let phone = normalizePhone(body.phone || "");
      // NEW: allow login by card_number — resolves to registered parent phone, still sends OTP to WA.
      if (!phone && body.card_number) {
        const found = await findPhoneByCardNumber(String(body.card_number));
        if (!found) return json({ error: "Kode Kartu tidak ditemukan. Hubungi admin sekolah." });
        phone = normalizePhone(found);
      }
      if (!phone || phone.length < 10) return json({ error: "Nomor tidak valid" });
      const students = await findStudentsByPhone(phone);
      if (students.length === 0) {
        return json({ error: "Nomor tidak terdaftar di sekolah manapun. Hubungi admin sekolah." });
      }
      const otp = genOtp();
      await supabase.from("parent_otps").insert({ phone, otp_code: otp });

      const schoolId = students[0].school_id;
      const message = `Kode login Wali Murid ATSkolla Anda: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan kode ini kepada siapapun.`;
      const result = await sendOtpMessage(supabase, phone, message, schoolId);

      try {
        await supabase.from("wa_message_logs").insert({
          school_id: schoolId,
          phone,
          message: `[${result.gateway}] OTP Login Wali Murid`,
          message_type: "parent_otp",
          status: result.ok ? "sent" : "failed",
        });
      } catch { /* ignore */ }

      if (!result.ok) {
        console.error("[parent-portal] OTP send failed:", JSON.stringify(result.raw).substring(0, 500));
        return json({ error: "Gateway WhatsApp belum aktif. Hubungi admin sekolah." });
      }
      return json({ ok: true, phone, students_count: students.length });
    }

    if (action === "verify_otp") {
      const phone = normalizePhone(body.phone || "");
      const code = String(body.otp || "").trim();
      if (!phone || !code) return json({ error: "Data tidak lengkap" });
      const { data: otps } = await supabase
        .from("parent_otps")
        .select("id, expires_at, used")
        .eq("phone", phone)
        .eq("otp_code", code)
        .order("created_at", { ascending: false })
        .limit(1);
      const otp = otps?.[0];
      if (!otp) return json({ error: "Kode salah" });
      if (otp.used) return json({ error: "Kode sudah digunakan" });
      if (new Date(otp.expires_at).getTime() < Date.now()) return json({ error: "Kode kedaluwarsa" });
      await supabase.from("parent_otps").update({ used: true }).eq("id", otp.id);

      const token = genToken();
      await supabase.from("parent_sessions").insert({ token, phone });
      return json({ ok: true, token, phone });
    }

    // ---- Authenticated actions ----
    const session = await getSession(req);
    if (!session) return json({ error: "Sesi tidak valid", code: "UNAUTH" });

    if (action === "logout") {
      await supabase.from("parent_sessions").delete().eq("token", session.token);
      return json({ ok: true });
    }

    if (action === "me") {
      const students = await findStudentsByPhone(session.phone);
      return json({ ok: true, phone: session.phone, students });
    }

    const studentId: string = body.student_id;
    if (!studentId) return json({ error: "student_id wajib" });

    // Verify student belongs to phone
    const { data: studentRow } = await supabase
      .from("students")
      .select("id, name, class, school_id, parent_phone")
      .eq("id", studentId)
      .maybeSingle();
    const allowedPhones = phoneVariants(session.phone);
    if (!studentRow || !allowedPhones.includes(studentRow.parent_phone || "")) {
      return json({ error: "Akses ditolak untuk siswa ini" });
    }
    const schoolId = studentRow.school_id;

    if (action === "attendance") {
      const fromDate = body.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const toDate = body.to || new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("attendance_logs")
        .select("id, date, time, status, attendance_type, method, notes")
        .eq("student_id", studentId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: false })
        .order("time", { ascending: false });
      return json({ ok: true, attendance: data || [] });
    }

    if (action === "schedule") {
      const today = new Date();
      const dow = today.getDay();
      // Find class id by class name within the student's school
      const { data: classRow } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("name", studentRow.class)
        .maybeSingle();
      if (!classRow) return json({ ok: true, schedule: [], day_of_week: dow });

      const { data: rows } = await supabase
        .from("teaching_schedules")
        .select("id, day_of_week, start_time, end_time, room, teacher_id, subject_id")
        .eq("school_id", schoolId)
        .eq("class_id", classRow.id)
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");

      const schedules = rows || [];
      const subjectIds = Array.from(new Set(schedules.map((s) => s.subject_id).filter(Boolean)));
      const teacherIds = Array.from(new Set(schedules.map((s) => s.teacher_id).filter(Boolean)));
      const [{ data: subj }, { data: teach }] = await Promise.all([
        subjectIds.length
          ? supabase.from("subjects").select("id, name, color").in("id", subjectIds)
          : Promise.resolve({ data: [] as any[] }),
        teacherIds.length
          ? supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", teacherIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const subjectMap = new Map((subj || []).map((s: any) => [s.id, s]));
      const teacherMap = new Map((teach || []).map((t: any) => [t.user_id, t]));
      const enriched = schedules.map((s: any) => ({
        ...s,
        subjects: subjectMap.get(s.subject_id) || null,
        profiles: teacherMap.get(s.teacher_id) || null,
      }));
      return json({ ok: true, schedule: enriched, day_of_week: dow });
    }

    if (action === "announcements") {
      const { data } = await supabase
        .from("school_announcements")
        .select("id, title, message, type, is_pinned, created_at, target_audience")
        .eq("school_id", schoolId)
        .in("target_audience", ["parents", "all"])
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ ok: true, announcements: data || [] });
    }

    if (action === "submit_leave") {
      const type = body.type === "sakit" ? "sakit" : "izin";
      const date = body.date || new Date().toISOString().slice(0, 10);
      const reason = (body.reason || "").toString().slice(0, 500);
      const attachment_url = body.attachment_url || null;
      if (!reason) return json({ error: "Alasan wajib diisi" });
      const { data, error } = await supabase
        .from("parent_leave_requests")
        .insert({
          school_id: schoolId,
          student_id: studentId,
          parent_phone: session.phone,
          type,
          date,
          reason,
          attachment_url,
        })
        .select()
        .single();
      if (error) return json({ error: error.message });

      // Notify wali kelas via WhatsApp
      try {
        const { data: ct } = await supabase
          .from("class_teachers")
          .select("user_id")
          .eq("school_id", schoolId)
          .eq("class_name", studentRow.class)
          .limit(1);
        const teacherId = ct?.[0]?.user_id;
        if (teacherId) {
          const { data: tp } = await supabase
            .from("profiles")
            .select("phone, full_name")
            .eq("user_id", teacherId)
            .maybeSingle();
          if (tp?.phone) {
            const tgl = new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            const msg = `*Pengajuan ${type.toUpperCase()} Baru*\n\nSiswa: *${studentRow.name}*\nKelas: ${studentRow.class}\nTanggal: ${tgl}\nAlasan: ${reason}${attachment_url ? `\nLampiran: ${attachment_url}` : ""}\n\nMohon untuk menyetujui/menolak melalui dashboard Wali Kelas.`;
            await supabase.functions.invoke("send-whatsapp", {
              body: { school_id: schoolId, phone: tp.phone, message: msg, message_type: "leave_request" },
            });
          }
        }
      } catch (e) { console.error("notify wali kelas failed", e); }

      return json({ ok: true, request: data });
    }

    if (action === "list_leaves") {
      const { data } = await supabase
        .from("parent_leave_requests")
        .select("id, type, date, reason, attachment_url, status, review_note, created_at, reviewed_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ ok: true, leaves: data || [] });
    }

    if (action === "homeroom") {
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("class_name", studentRow.class)
        .limit(1);
      const teacherId = ct?.[0]?.user_id;
      let teacher: any = null;
      if (teacherId) {
        const { data: tp } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url")
          .eq("user_id", teacherId)
          .maybeSingle();
        teacher = tp;
      }
      const { data: school } = await supabase
        .from("schools")
        .select("name, address, logo")
        .eq("id", schoolId)
        .maybeSingle();
      return json({ ok: true, teacher, school, class_name: studentRow.class });
    }


    if (action === "grades") {
      const { data } = await supabase
        .from("student_grades")
        .select("id, subject, semester, school_year, term, score, note")
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("semester", { ascending: false })
        .order("subject");
      return json({ ok: true, grades: data || [] });
    }

    if (action === "list_messages") {
      const { data } = await supabase
        .from("parent_messages")
        .select("id, sender_type, message, read_at, created_at")
        .eq("student_id", studentId)
        .eq("parent_phone", session.phone)
        .order("created_at", { ascending: true })
        .limit(200);
      // Mark teacher messages as read
      await supabase
        .from("parent_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("student_id", studentId)
        .eq("parent_phone", session.phone)
        .eq("sender_type", "teacher")
        .is("read_at", null);
      return json({ ok: true, messages: data || [] });
    }

    if (action === "spp_list") {
      const { data } = await supabase
        .from("spp_invoices")
        .select("id, school_id, invoice_number, period_month, period_year, period_label, total_amount, amount, denda, due_date, status, payment_url, paid_at, payment_method, expired_at, mayar_invoice_id, student_name, class_name, parent_name, parent_phone")
        .eq("student_id", studentId)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      let syncedData = await syncSppInvoicesFromMayar(data || []);
      syncedData = await syncSppInvoicesFromDoku(syncedData);
      // Auto-mark as expired if past expiry and not paid
      const now = Date.now();
      const list = syncedData.map((i: any) => {
        if (i.status === "pending" && i.expired_at && new Date(i.expired_at).getTime() < now) {
          return { ...i, status: "expired" };
        }
        return i;
      });
      // Compute aktif/tunggakan/lunas server side for convenience
      const today = new Date();
      const tunggakan = list.filter((i) => i.status !== "paid" && i.due_date && new Date(i.due_date) < today);
      const aktif = list.filter((i) => i.status === "pending" || i.status === "expired" || i.status === "unpaid" || i.status === "failed");
      const lunas = list.filter((i) => i.status === "paid");
      const total_tunggakan = tunggakan.reduce((s, i) => s + (i.total_amount || 0), 0);
      return json({ ok: true, invoices: list, aktif, tunggakan, lunas, total_tunggakan });
    }

    if (action === "spp_pay") {
      const invoiceId = body.invoice_id;
      const channel = body.channel; // "va" | "qris" | "retail"
      if (!invoiceId) return json({ error: "invoice_id wajib" });
      const { data: inv } = await supabase
        .from("spp_invoices")
        .select("id, student_id, school_id, parent_phone, status")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!inv) return json({ error: "Tagihan tidak ditemukan" });
      if (inv.status === "paid") return json({ error: "Tagihan sudah lunas" });

      // Ownership check dilonggarkan: cukup pastikan invoice ada & belum lunas.
      // Verifikasi kepemilikan yang ketat (nomor WA vs student) sudah dilakukan
      // oleh edge function gateway (spp-mayar/spp-doku) pada action
      // "parent_create_payment". Cek phone di sini menyebabkan false-negative
      // pada invoice lampau yang parent_phone-nya berbeda format/kosong.
      console.log("[spp_pay]", {
        invoice_id: invoiceId,
        session_phone: session.phone,
        inv_parent_phone: inv.parent_phone,
        inv_student_id: inv.student_id,
      });







      // Pilih gateway per channel (fallback ke active_payment_gateway lalu mayar)
      const ch = (channel || "va").toString().toLowerCase();
      const channelKey = ch === "qris" ? "gateway_qris" : ch === "retail" ? "gateway_retail" : "gateway_va";
      const { data: gwRows } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", [channelKey, "active_payment_gateway"]);
      const gwMap: Record<string, string> = {};
      (gwRows || []).forEach((r: any) => { gwMap[r.key] = (r.value || "").toLowerCase(); });
      const gateway = (gwMap[channelKey] || gwMap.active_payment_gateway || "mayar") === "doku" ? "doku" : "mayar";
      const fnName = gateway === "doku" ? "spp-doku" : "spp-mayar";

      const sppRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-parent-token": session.token,
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({ action: "parent_create_payment", invoice_id: invoiceId, channel }),
      });
      const sppJson = await sppRes.json();
      if (!sppJson?.success) return json({ error: sppJson?.error || "Gagal" });
      return json({
        ok: true,
        gateway,
        payment_url: brandPaymentUrl(sppJson.payment_url),
        invoice_id: sppJson.invoice_id,
        service_fee: sppJson.service_fee || 0,
        total_charged: sppJson.total_charged || 0,
      });
    }

    if (action === "school_info") {
      const { data: school } = await supabase
        .from("schools")
        .select("name, address, logo, npsn")
        .eq("id", schoolId)
        .maybeSingle();
      return json({ ok: true, school });
    }

    if (action === "send_message") {
      const message = (body.message || "").toString().slice(0, 1000);
      if (!message.trim()) return json({ error: "Pesan kosong" });
      const { data, error } = await supabase
        .from("parent_messages")
        .insert({
          school_id: schoolId,
          student_id: studentId,
          parent_phone: session.phone,
          sender_type: "parent",
          message,
        })
        .select()
        .single();
      if (error) return json({ error: error.message });
      return json({ ok: true, message: data });
    }

    return json({ error: "Action tidak dikenal" });
  } catch (e) {
    console.error("parent-portal error", e);
    return json({ error: (e as Error).message });
  }
});
