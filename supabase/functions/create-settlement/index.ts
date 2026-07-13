// Server-authoritative pencairan (payout) creator.
// - Verifies caller (bendahara at the school)
// - Verifies OTP against the responsible user (single-use, still bound to responsible_user_id)
// - Loads the bank account server-side by ID (client cannot mutate amount/rekening after OTP)
// - Recomputes settlement totals from spp_invoices (ignores any client-supplied numbers)
// - Enforces min_payout & withdraw_fee from bendahara_settings
// - Atomically links invoices → settlement, rolls back if none remained available.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { requireCaller } from "../_shared/auth.ts";

const DEFAULT_WITHDRAW_FEE = 3000;
const DEFAULT_MIN_PAYOUT = 10000;
const OFFLINE = new Set(["offline_cash", "offline_transfer"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req).catch(() => null);
    if (!caller) return json({ error: "Unauthorized" }, 200);

    const body = await req.json().catch(() => ({}));
    const { school_id, bank_account_id, otp_code, notes, confirm_word } = body || {};

    if (!school_id || !bank_account_id || !otp_code) {
      return json({ error: "school_id, bank_account_id, otp_code wajib diisi" });
    }
    if (typeof confirm_word !== "string" || confirm_word.trim().toUpperCase() !== "CAIRKAN") {
      return json({ error: 'Konfirmasi tidak valid — ketik kata "CAIRKAN"' });
    }

    const admin = getAdminClient();

    // 1) Caller must be bendahara at this school
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      admin.from("profiles").select("school_id").eq("user_id", caller.userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", caller.userId).eq("role", "bendahara").maybeSingle(),
    ]);
    if (!profile || profile.school_id !== school_id) {
      return json({ error: "Anda bukan bendahara sekolah ini" });
    }
    if (!roleRow) return json({ error: "Akses ditolak (bukan bendahara)" });

    // 2) Load bank account server-side (source of truth for rekening/PJ)
    const { data: acc } = await admin.from("bendahara_bank_accounts")
      .select("id, school_id, is_active, bank_name, account_number, account_holder, account_type, responsible_user_id, verification_status")
      .eq("id", bank_account_id).maybeSingle();
    if (!acc || acc.school_id !== school_id) return json({ error: "Rekening tidak ditemukan" });
    if (acc.is_active === false) return json({ error: "Rekening sudah dinonaktifkan" });
    if (!acc.responsible_user_id) return json({ error: "Penanggung jawab rekening belum diatur" });

    // 3) Verify OTP against the responsible user (bound to rekening's PJ, not client input)
    const { data: pjUser } = await admin.auth.admin.getUserById(acc.responsible_user_id);
    const pjEmail = pjUser?.user?.email;
    if (!pjEmail) return json({ error: "Email penanggung jawab tidak ditemukan" });
    const otpTag = `bendahara:${pjEmail.toLowerCase()}`;

    const { data: otpRec } = await admin.from("password_reset_otps")
      .select("id").eq("email", otpTag).eq("otp_code", String(otp_code)).eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!otpRec) return json({ error: "Kode OTP salah atau sudah kadaluarsa" });

    // Mark OTP used up-front so it cannot be reused
    await admin.from("password_reset_otps").update({ used: true }).eq("id", otpRec.id);

    // 4) Load settings (fee + min payout)
    const { data: settings } = await admin.from("bendahara_settings")
      .select("withdraw_fee_default, min_payout").eq("school_id", school_id).maybeSingle();
    const withdrawFee = Number(settings?.withdraw_fee_default ?? DEFAULT_WITHDRAW_FEE);
    const minPayout = Number(settings?.min_payout ?? DEFAULT_MIN_PAYOUT);

    // 5) Recompute available totals from invoices (server-authoritative)
    const { data: invs } = await admin.from("spp_invoices")
      .select("id, status, payment_method, settlement_id, total_amount, gateway_fee, net_amount")
      .eq("school_id", school_id).eq("status", "paid").is("settlement_id", null);

    const eligible = (invs || []).filter((x: any) => !OFFLINE.has((x.payment_method || "").toLowerCase()));
    if (eligible.length === 0) return json({ error: "Tidak ada saldo yang bisa dicairkan" });

    const totals = eligible.reduce((a: any, x: any) => {
      const net = x.net_amount ?? (x.total_amount || 0);
      a.count += 1;
      a.gross += x.total_amount || 0;
      a.fee += x.gateway_fee || 0;
      a.net += net;
      return a;
    }, { count: 0, gross: 0, fee: 0, net: 0 });

    const finalPayout = Math.max(0, totals.net - withdrawFee);
    if (finalPayout < minPayout) {
      return json({ error: `Saldo cair (${finalPayout.toLocaleString("id-ID")}) di bawah minimum pencairan (Rp ${minPayout.toLocaleString("id-ID")}).` });
    }

    // 6) Insert settlement with server-computed values + rekening snapshot
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    const code = `STL-${Date.now().toString().slice(-8)}-${rand}`;

    const { data: settlement, error: insErr } = await admin.from("spp_settlements").insert({
      school_id,
      settlement_code: code,
      total_transactions: totals.count,
      total_gross: totals.gross,
      total_gateway_fee: totals.fee,
      total_net: totals.net,
      withdraw_fee: withdrawFee,
      final_payout: finalPayout,
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      account_holder: acc.account_holder,
      account_type: acc.account_type || "bank",
      responsible_user_id: acc.responsible_user_id,
      requested_by: caller.userId,
      notes: typeof notes === "string" ? notes.slice(0, 500) : null,
      status: "pending",
    }).select().single();
    if (insErr || !settlement) return json({ error: insErr?.message || "Gagal membuat pengajuan" });

    // 7) Atomically link invoices (only ones still available)
    const ids = eligible.map((x: any) => x.id);
    await admin.from("spp_invoices").update({ settlement_id: settlement.id })
      .eq("school_id", school_id).in("id", ids).is("settlement_id", null);

    // 8) Reconcile with what actually got linked (race-safe)
    const { data: linked } = await admin.from("spp_invoices")
      .select("total_amount, gateway_fee, net_amount")
      .eq("settlement_id", settlement.id);

    if (!linked || linked.length === 0) {
      await admin.from("spp_settlements").delete().eq("id", settlement.id);
      return json({ error: "Saldo keburu dicairkan pada pengajuan lain. Coba lagi." });
    }

    const real = linked.reduce((a: any, x: any) => {
      const net = x.net_amount ?? (x.total_amount || 0);
      a.count += 1;
      a.gross += x.total_amount || 0;
      a.fee += x.gateway_fee || 0;
      a.net += net;
      return a;
    }, { count: 0, gross: 0, fee: 0, net: 0 });
    const realFinal = Math.max(0, real.net - withdrawFee);

    if (realFinal < minPayout) {
      // Unlink & delete settlement
      await admin.from("spp_invoices").update({ settlement_id: null }).eq("settlement_id", settlement.id);
      await admin.from("spp_settlements").delete().eq("id", settlement.id);
      return json({ error: `Setelah rekonsiliasi, saldo cair (Rp ${realFinal.toLocaleString("id-ID")}) di bawah minimum. Coba lagi nanti.` });
    }

    await admin.from("spp_settlements").update({
      total_transactions: real.count,
      total_gross: real.gross,
      total_gateway_fee: real.fee,
      total_net: real.net,
      final_payout: realFinal,
    }).eq("id", settlement.id);

    return json({
      success: true,
      settlement_id: settlement.id,
      settlement_code: code,
      total_transactions: real.count,
      total_gross: real.gross,
      total_gateway_fee: real.fee,
      total_net: real.net,
      withdraw_fee: withdrawFee,
      final_payout: realFinal,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Terjadi kesalahan" });
  }
});
