import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOtpMessage } from "../_shared/sendOtp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, school_id, responsible_user_id } = await req.json();
    if (!user_id || !school_id) {
      return json({ error: 'user_id & school_id wajib' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verifikasi bendahara pemohon
    const { data: roleRow } = await admin.from('user_roles')
      .select('role').eq('user_id', user_id).eq('role', 'bendahara').maybeSingle();
    if (!roleRow) return json({ error: 'Akun ini tidak memiliki akses Bendahara' });

    // Target OTP: responsible_user_id (jika ada), fallback ke bendahara
    const targetUserId = responsible_user_id || user_id;

    // Jika penanggung jawab dipilih, wajib guru/operator di sekolah yang sama
    if (responsible_user_id && responsible_user_id !== user_id) {
      const { data: pj } = await admin.from('profiles')
        .select('school_id').eq('user_id', responsible_user_id).maybeSingle();
      if (!pj || pj.school_id !== school_id) {
        return json({ error: 'Penanggung jawab tidak terdaftar di sekolah ini' });
      }
      const { data: pjRoles } = await admin.from('user_roles')
        .select('role').eq('user_id', responsible_user_id);
      const roles = (pjRoles || []).map((r: any) => r.role);
      const allowed = roles.some((r: string) => ['guru', 'operator', 'admin', 'bendahara'].includes(r));
      if (!allowed) return json({ error: 'Penanggung jawab harus Guru atau Operator' });
    }

    const { data: u } = await admin.auth.admin.getUserById(targetUserId);
    const email = u?.user?.email;
    if (!email) return json({ error: 'Email penanggung jawab tidak ditemukan' });

    const { data: profile } = await admin.from('profiles')
      .select('phone, school_id, full_name').eq('user_id', targetUserId).maybeSingle();
    if (!profile?.phone) return json({ error: 'Nomor WhatsApp penanggung jawab belum diatur di profil' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tag = `bendahara:${email.toLowerCase()}`;

    await admin.from('password_reset_otps').update({ used: true })
      .eq('email', tag).eq('used', false);

    await admin.from('password_reset_otps').insert({
      email: tag, otp_code: otpCode, phone: profile.phone,
    });

    const message = `*Kode OTP Pencairan Dana ATSkolla*\n\nHalo ${profile.full_name || 'Penanggung Jawab'},\nKode OTP untuk konfirmasi pencairan dana SPP:\n\n*${otpCode}*\n\nBerlaku 5 menit. Jangan bagikan kode ini ke siapa pun.\nJika Anda tidak meminta pencairan, abaikan pesan ini.\n\n_Pesan otomatis dari ATSkolla_`;

    const result = await sendOtpMessage(admin, profile.phone, message, school_id);

    try {
      await admin.from('wa_message_logs').insert({
        school_id, phone: profile.phone,
        message: `[${result.gateway}] Kode OTP Pencairan`,
        message_type: 'bendahara_otp',
        status: result.ok ? 'sent' : 'failed',
        student_name: null,
      });
    } catch { /* ignore */ }

    if (!result.ok) return json({ error: 'Gateway WhatsApp belum aktif. Hubungi Super Admin.' });

    const masked = profile.phone.replace(/\d(?=\d{4})/g, '*');
    return json({ success: true, phone_masked: masked, target_user_id: targetUserId, target_name: profile.full_name || '' });
  } catch (e: any) {
    return json({ error: e.message || 'Terjadi kesalahan' });
  }
});

function json(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
