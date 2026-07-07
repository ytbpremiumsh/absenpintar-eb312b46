import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const supabaseAdmin = getAdminClient();

    const now = new Date();

    // Get trial_warning_days from platform_settings
    let warningDays = 3;
    const { data: warnSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'trial_warning_days')
      .maybeSingle();
    if (warnSetting?.value) {
      const parsed = parseInt(warnSetting.value, 10);
      if (!isNaN(parsed) && parsed > 0) warningDays = parsed;
    }

    // 1. Auto-downgrade expired trials to Free
    const { data: expiredTrials } = await supabaseAdmin
      .from('school_subscriptions')
      .select('id, school_id, expires_at')
      .eq('status', 'trial')
      .lt('expires_at', now.toISOString());

    const { data: freePlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('price', 0)
      .eq('is_active', true)
      .maybeSingle();

    let downgraded = 0;
    if (expiredTrials && freePlan) {
      for (const trial of expiredTrials) {
        // Update to Free plan
        await supabaseAdmin
          .from('school_subscriptions')
          .update({
            plan_id: freePlan.id,
            status: 'active',
            expires_at: null,
          })
          .eq('id', trial.id);

        // Deactivate WhatsApp Gateway for this school
        await supabaseAdmin
          .from('school_integrations')
          .update({ is_active: false, wa_enabled: false })
          .eq('school_id', trial.school_id)
          .eq('integration_type', 'onesender');

        // Create notification
        await supabaseAdmin.from('notifications').insert({
          school_id: trial.school_id,
          title: 'Masa Trial Berakhir',
          message: 'Masa trial Premium Anda telah berakhir. Akun Anda telah dipindahkan ke paket Free. Upgrade sekarang untuk menikmati fitur premium kembali!',
          type: 'warning',
        });

        downgraded++;
      }
    }

    // 2. Send warning notifications for trials expiring within warningDays
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    const { data: expiringTrials } = await supabaseAdmin
      .from('school_subscriptions')
      .select('id, school_id, expires_at')
      .eq('status', 'trial')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', warningDate.toISOString());

    let warned = 0;
    if (expiringTrials) {
      for (const trial of expiringTrials) {
        const daysLeft = Math.ceil(
          (new Date(trial.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a notification today for this school
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const { data: existingNotif } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('school_id', trial.school_id)
          .eq('type', 'trial_warning')
          .gte('created_at', todayStart.toISOString())
          .maybeSingle();

        if (!existingNotif) {
          // Get custom warning message template
          const { data: msgSetting } = await supabaseAdmin
            .from('platform_settings')
            .select('value')
            .eq('key', 'trial_warning_message')
            .maybeSingle();

          const defaultMsg = `Masa trial Premium Anda akan berakhir dalam {days} hari. Segera lakukan upgrade agar fitur tidak terbatas dan data tetap aman!`;
          const messageTemplate = msgSetting?.value || defaultMsg;
          const message = messageTemplate.replace(/{days}/g, String(daysLeft));

          await supabaseAdmin.from('notifications').insert({
            school_id: trial.school_id,
            title: `Masa Trial Berakhir ${daysLeft} Hari Lagi`,
            message,
            type: 'trial_warning',
          });
          warned++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      downgraded,
      warned,
      checked_at: now.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
