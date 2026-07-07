import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { sendOtpMessage } from "../_shared/sendOtp.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const { email, phone, school_id } = await req.json();
    if (!email) return json({ error: 'Email wajib diisi' });

    const supabaseAdmin = getAdminClient();

    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return json({ error: 'Email tidak ditemukan' });

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('phone').eq('user_id', user.id).maybeSingle();

    const storedPhone = profile?.phone;
    let targetPhone = storedPhone;

    if (phone) {
      const normalizePhone = (p: string) => {
        let n = p.replace(/\D/g, '');
        if (n.startsWith('62')) n = '0' + n.substring(2);
        return n;
      };
      const normalizedInput = normalizePhone(phone);
      const normalizedStored = storedPhone ? normalizePhone(storedPhone) : '';

      if (normalizedStored && normalizedInput !== normalizedStored) {
        return json({ error: 'Nomor WhatsApp tidak sesuai dengan data yang terdaftar' });
      }
      targetPhone = phone;
    }

    if (!targetPhone) {
      return json({ error: 'Nomor WhatsApp belum terdaftar di profil. Silakan hubungi admin.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await supabaseAdmin
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', email.toLowerCase()).eq('used', false);

    await supabaseAdmin.from('password_reset_otps').insert({
      email: email.toLowerCase(), otp_code: otpCode, phone: targetPhone,
    });

    const message = `*Kode OTP Reset Password ATSkolla*\n\nKode OTP Anda: ${otpCode}\n\nKode ini berlaku selama 5 menit.\nJangan bagikan kode ini kepada siapapun.\n\n─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;

    const result = await sendOtpMessage(supabaseAdmin, targetPhone, message, school_id || null);

    if (school_id) {
      try {
        await supabaseAdmin.from('wa_message_logs').insert({
          school_id, phone: targetPhone,
          message: `[${result.gateway}] Kode OTP Reset Password`,
          message_type: 'otp',
          status: result.ok ? 'sent' : 'failed',
        });
      } catch { /* ignore */ }
    }

    if (!result.ok) {
      console.error('[send-otp] all gateways failed:', JSON.stringify(result.raw).substring(0, 500));
      return json({ error: 'Tidak ada gateway WhatsApp yang aktif untuk mengirim OTP' });
    }

    return json({ success: true, message: 'OTP berhasil dikirim via WhatsApp' });

  } catch (error: any) {
    console.error('Send OTP error:', error);
    return json({ error: error.message || 'Terjadi kesalahan' });
  }
});

function json(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
