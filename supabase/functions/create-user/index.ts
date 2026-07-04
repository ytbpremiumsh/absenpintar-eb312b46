import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, password, full_name, role, school_id, npsn, school_name, school_address, school_principal_name, school_email, school_whatsapp, phone, referral_code, nip, position, desired_slug } = await req.json();

    // Validate desired_slug early (only if creating a new school context)
    let cleanSlug: string | null = null;
    if (desired_slug && typeof desired_slug === 'string') {
      const s = desired_slug.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(s)) {
        throw new Error('Subdomain tidak valid. Gunakan 3-64 karakter huruf kecil, angka, atau tanda hubung.');
      }
      // Check reserved
      const { data: reserved } = await supabaseAdmin.rpc('is_reserved_slug', { _slug: s });
      if (reserved === true) {
        throw new Error(`Subdomain "${s}" sudah dipesan sistem. Silakan pilih yang lain.`);
      }
      // Check uniqueness
      const { data: existingSlug } = await supabaseAdmin
        .from('schools')
        .select('id')
        .eq('slug', s)
        .maybeSingle();
      if (existingSlug) {
        throw new Error(`Subdomain "${s}" sudah dipakai sekolah lain. Silakan pilih yang lain.`);
      }
      cleanSlug = s;
    }

    // Basic validation with clear, actionable messages (Indonesian)
    if (!email || !password) {
      throw new Error('Email & password wajib diisi sebelum mendaftar.');
    }
    if (!full_name || !full_name.trim()) {
      throw new Error('Nama lengkap admin wajib diisi.');
    }
    // For school_admin self-registration, school_name must be provided (or school_id for invited users)
    if (role === 'school_admin' && !school_id && (!school_name || !school_name.trim())) {
      throw new Error('Nama sekolah wajib diisi. Silakan lengkapi data sekolah terlebih dahulu (cari NPSN atau isi manual).');
    }

    // Determine school_id: use provided or create/find school
    let resolvedSchoolId = school_id;

    if (!resolvedSchoolId && school_name) {
      // Prefer exact match by NPSN if provided (most reliable)
      let existingSchool: any = null;
      if (npsn) {
        const { data } = await supabaseAdmin
          .from('schools')
          .select('id, address, principal_name, email, whatsapp')
          .eq('npsn', npsn)
          .maybeSingle();
        existingSchool = data;
      }

      // Only fall back to name match when NPSN was NOT provided (manual mode)
      // and even then require an exact (case-insensitive) name match to avoid
      // attaching new admins to unrelated schools with similar names.
      if (!existingSchool && !npsn) {
        const { data } = await supabaseAdmin
          .from('schools')
          .select('id, address, principal_name, email, whatsapp')
          .ilike('name', school_name.trim())
          .limit(1)
          .maybeSingle();
        existingSchool = data;
      }

      if (existingSchool) {
        resolvedSchoolId = existingSchool.id;
        // Fill only fields that are still empty (skip if already set)
        const patch: any = {};
        if (!existingSchool.address && school_address) patch.address = school_address.trim();
        if (!existingSchool.principal_name && school_principal_name) patch.principal_name = school_principal_name.trim();
        if (!existingSchool.email && school_email) patch.email = school_email.trim();
        if (!existingSchool.whatsapp && school_whatsapp) patch.whatsapp = school_whatsapp.trim();
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from('schools').update(patch).eq('id', existingSchool.id);
        }
      } else {
        // Create new school
        const insertData: any = {
          name: school_name.trim(),
          address: school_address?.trim() || null,
          principal_name: school_principal_name?.trim() || null,
          email: school_email?.trim() || null,
          whatsapp: school_whatsapp?.trim() || null,
        };
        if (npsn) insertData.npsn = npsn;
        if (cleanSlug) insertData.slug = cleanSlug;

        const { data: newSchool, error: schoolError } = await supabaseAdmin
          .from('schools')
          .insert(insertData)
          .select('id')
          .single();

        if (schoolError) {
          throw new Error('Gagal mendaftarkan data sekolah: ' + schoolError.message + '. Silakan periksa nama sekolah & NPSN, lalu coba lagi.');
        }
        resolvedSchoolId = newSchool.id;
      }
    }

    if (role === 'school_admin' && !resolvedSchoolId) {
      throw new Error('Sekolah belum berhasil terdaftar. Mohon lengkapi data sekolah (gunakan pencarian NPSN atau isi nama sekolah secara manual), lalu klik "Daftar" kembali.');
    }

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (userError) throw userError;

    const userId = userData.user.id;

    // Generate unique referral code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let refCodeGenerated = 'ATS-';
    for (let i = 0; i < 6; i++) refCodeGenerated += chars.charAt(Math.floor(Math.random() * chars.length));

    // Update profile with school_id, phone, and referral code
    const profileUpdate: any = { full_name, referral_code: refCodeGenerated };
    if (resolvedSchoolId) profileUpdate.school_id = resolvedSchoolId;
    if (phone) profileUpdate.phone = phone;
    if (nip) profileUpdate.nip = nip;
    if (position) profileUpdate.position = position;

    await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('user_id', userId);

    // Handle referral attribution
    if (referral_code) {
      const { data: referrerProfile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('referral_code', referral_code)
        .maybeSingle();

      if (referrerProfile && referrerProfile.user_id !== userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ referred_by: referrerProfile.user_id })
          .eq('user_id', userId);

        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerProfile.user_id,
            referred_user_id: userId,
            status: 'registered',
            points_awarded: 0,
          });

        try {
          const refUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/referral`;
          await fetch(refUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
            },
            body: JSON.stringify({
              action: 'handle_event',
              event_type: 'REGISTER',
              referred_user_id: userId,
              api_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            }),
          });
        } catch (e) {
          console.error('Referral event error:', e);
        }
      }
    }

    // Assign role
    if (role) {
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role });
    }

    // Create dismissal_settings, auto-assign Trial subscription, and WA gateway for new school
    if (resolvedSchoolId) {
      const { data: existingSettings } = await supabaseAdmin
        .from('dismissal_settings')
        .select('id')
        .eq('school_id', resolvedSchoolId)
        .maybeSingle();

      if (!existingSettings) {
        await supabaseAdmin
          .from('dismissal_settings')
          .insert({ school_id: resolvedSchoolId, is_active: false });
      }

      // Get trial_days from platform_settings (default 14)
      let trialDays = 14;
      const { data: trialSetting } = await supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'trial_days')
        .maybeSingle();
      if (trialSetting?.value) {
        const parsed = parseInt(trialSetting.value, 10);
        if (!isNaN(parsed) && parsed > 0) trialDays = parsed;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + trialDays);

      // Auto-assign Trial subscription with Premium plan
      const { data: premiumPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('name', 'Premium')
        .eq('is_active', true)
        .maybeSingle();

      const { data: existingSub } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id')
        .eq('school_id', resolvedSchoolId)
        .maybeSingle();

      if (!existingSub && premiumPlan) {
        await supabaseAdmin.from('school_subscriptions').insert({
          school_id: resolvedSchoolId,
          plan_id: premiumPlan.id,
          status: 'trial',
          expires_at: expiresAt.toISOString(),
        });
      } else if (!existingSub) {
        // Fallback to Free plan if Premium not found
        const { data: freePlan } = await supabaseAdmin
          .from('subscription_plans')
          .select('id')
          .eq('price', 0)
          .eq('is_active', true)
          .maybeSingle();

        if (freePlan) {
          await supabaseAdmin.from('school_subscriptions').insert({
            school_id: resolvedSchoolId,
            plan_id: freePlan.id,
            status: 'active',
            expires_at: null,
          });
        }
      }

      // Auto-create WhatsApp Gateway (OneSender) integration for trial schools
      const { data: existingIntegration } = await supabaseAdmin
        .from('school_integrations')
        .select('id')
        .eq('school_id', resolvedSchoolId)
        .eq('integration_type', 'onesender')
        .maybeSingle();

      if (!existingIntegration) {
        await supabaseAdmin.from('school_integrations').insert({
          school_id: resolvedSchoolId,
          integration_type: 'onesender',
          is_active: false,
          wa_enabled: true,
          api_url: null,
          api_key: null,
        });
      }
    }

    // Send WhatsApp registration notification (with MPWA fallback)
    if (phone) {
      try {
        const { data: settings } = await supabaseAdmin
          .from('platform_settings')
          .select('key, value')
          .in('key', [
            'wa_registration_enabled', 'wa_api_url', 'wa_api_key', 'wa_registration_message',
            'mpwa_platform_api_key', 'mpwa_platform_sender', 'mpwa_platform_connected'
          ]);

        const ps: Record<string, string> = {};
        (settings || []).forEach((s: any) => { ps[s.key] = s.value; });

        if (ps.wa_registration_enabled === 'true') {
          let formattedPhone = phone.replace(/\D/g, '');
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.substring(1);
          }

          const message = (ps.wa_registration_message || 'Selamat datang, {name}!')
            .replace(/{name}/g, full_name || '')
            .replace(/{school}/g, school_name || '')
            .replace(/{email}/g, email || '');

          let sent = false;

          // 1. Primary: Platform MPWA
          if (ps.mpwa_platform_connected === 'true' && ps.mpwa_platform_api_key && ps.mpwa_platform_sender) {
            try {
              console.log('[create-user] Sending via MPWA, sender:', ps.mpwa_platform_sender);
              const res = await fetch('https://app.ayopintar.com/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: ps.mpwa_platform_api_key,
                  sender: ps.mpwa_platform_sender,
                  number: formattedPhone,
                  message,
                }),
              });
              const text = await res.text();
              let data: any;
              try { data = JSON.parse(text); } catch { data = { status: false }; }
              console.log('[create-user] MPWA response:', JSON.stringify(data).substring(0, 200));
              if (data?.status !== false) {
                sent = true;
                console.log('[create-user] WA register sent via MPWA to', formattedPhone);
              }
            } catch (e) {
              console.error('[create-user] MPWA error:', e);
            }
          }

          // 2. Fallback: OneSender (only if MPWA fails)
          if (!sent && ps.wa_api_url && ps.wa_api_key) {
            try {
              console.log('[create-user] Fallback to OneSender');
              const waResponse = await fetch(ps.wa_api_url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${ps.wa_api_key}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  recipient_type: 'individual',
                  to: formattedPhone,
                  type: 'text',
                  text: { body: message },
                }),
              });
              if (waResponse.ok) {
                sent = true;
                console.log('[create-user] WA register sent via OneSender to', formattedPhone);
              } else {
                const waError = await waResponse.text();
                console.error('[create-user] OneSender failed:', waError.substring(0, 200));
              }
            } catch (e) {
              console.error('[create-user] OneSender error:', e);
            }
          }

          if (!sent) {
            console.error('[create-user] All WA gateways failed for', formattedPhone);
          }
        }
      } catch (waErr) {
        console.error('WA notification error:', waErr);
      }
    }

    // Send email registration notification (custom SMTP)
    if (email) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          },
          body: JSON.stringify({
            event_type: 'register',
            to: email,
            school_id: resolvedSchoolId,
            vars: { name: full_name || '', school: school_name || '', email },
          }),
        });
      } catch (mailErr) { console.error('register email error', mailErr); }
    }

    // Lookup slug (auto-generated by DB trigger) so client can show subdomain URL
    let schoolSlug: string | null = null;
    if (resolvedSchoolId) {
      const { data: sd } = await supabaseAdmin.from('schools').select('slug').eq('id', resolvedSchoolId).maybeSingle();
      schoolSlug = sd?.slug || null;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, school_id: resolvedSchoolId, school_slug: schoolSlug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
