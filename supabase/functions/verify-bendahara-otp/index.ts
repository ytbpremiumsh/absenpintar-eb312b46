import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, otp_code, responsible_user_id } = await req.json();
    if (!user_id || !otp_code) {
      return json({ error: 'user_id & otp_code wajib' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const targetUserId = responsible_user_id || user_id;
    const { data: u } = await admin.auth.admin.getUserById(targetUserId);
    const email = u?.user?.email;
    if (!email) return json({ error: 'Email penanggung jawab tidak ditemukan' });

    const tag = `bendahara:${email.toLowerCase()}`;

    const { data: rec } = await admin.from('password_reset_otps')
      .select('*').eq('email', tag).eq('otp_code', otp_code).eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!rec) return json({ error: 'Kode OTP salah atau sudah kadaluarsa' });

    await admin.from('password_reset_otps').update({ used: true }).eq('id', rec.id);

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Terjadi kesalahan' });
  }
});

function json(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
