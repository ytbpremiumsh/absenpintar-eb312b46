import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email wajib diisi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = getAdminClient();

    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return new Response(JSON.stringify({ error: 'Email tidak ditemukan di sistem' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, full_name, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    let schoolId = profile?.school_id || null;
    let integration = null;

    if (schoolId) {
      const { data: intData } = await supabaseAdmin
        .from('school_integrations')
        .select('api_url, api_key, is_active')
        .eq('school_id', schoolId)
        .eq('integration_type', 'onesender')
        .maybeSingle();
      integration = intData;
    }

    // Fallback: find any active WA integration
    if (!integration?.is_active || !integration?.api_url || !integration?.api_key) {
      const { data: fallback } = await supabaseAdmin
        .from('school_integrations')
        .select('api_url, api_key, is_active, school_id')
        .eq('integration_type', 'onesender')
        .eq('is_active', true)
        .not('api_url', 'is', null)
        .not('api_key', 'is', null)
        .limit(1)
        .maybeSingle();

      if (fallback) {
        integration = fallback;
        if (!schoolId) schoolId = fallback.school_id;
      }
    }

    const hasWa = !!(integration?.is_active && integration?.api_url && integration?.api_key);
    const userPhone = profile?.phone || null;

    // Mask phone for display: 0812****5678
    let maskedPhone = '';
    if (userPhone) {
      const clean = userPhone.replace(/\D/g, '');
      if (clean.length >= 8) {
        maskedPhone = clean.substring(0, 4) + '****' + clean.substring(clean.length - 4);
      } else {
        maskedPhone = clean.substring(0, 2) + '****';
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_name: profile?.full_name || email,
      has_wa_integration: hasWa,
      has_phone: !!userPhone,
      masked_phone: maskedPhone,
      school_id: schoolId || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
