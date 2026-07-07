import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient, getUserClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabase = getUserClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const supabaseAdmin = getAdminClient();

    // Check super_admin role
    const { data: hasRole } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'super_admin' });
    if (!hasRole) throw new Error('Forbidden: Super admin only');

    const { payment_id, extend_months = 1 } = await req.json();
    if (!payment_id) throw new Error('payment_id is required');

    // Get payment
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, school_id, plan_id, status')
      .eq('id', payment_id)
      .single();
    if (payErr || !payment) throw new Error('Payment not found');
    if (payment.status === 'paid') throw new Error('Payment already approved');

    // Mark as paid
    await supabaseAdmin.from('payment_transactions').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'manual_approve',
    }).eq('id', payment.id);

    // Create or extend subscription
    const { data: existingSub } = await supabaseAdmin
      .from('school_subscriptions')
      .select('id, expires_at')
      .eq('school_id', payment.school_id)
      .eq('status', 'active')
      .maybeSingle();

    const now = new Date();
    let expiresAt: Date;

    if (existingSub?.expires_at) {
      const currentExpiry = new Date(existingSub.expires_at);
      expiresAt = currentExpiry > now ? currentExpiry : now;
    } else {
      expiresAt = now;
    }
    expiresAt.setMonth(expiresAt.getMonth() + extend_months);

    if (existingSub) {
      await supabaseAdmin.from('school_subscriptions')
        .update({ plan_id: payment.plan_id, expires_at: expiresAt.toISOString() })
        .eq('id', existingSub.id);
    } else {
      await supabaseAdmin.from('school_subscriptions').insert({
        school_id: payment.school_id,
        plan_id: payment.plan_id,
        status: 'active',
        expires_at: expiresAt.toISOString(),
      });
    }

    // Auto-provision WhatsApp integration for School/Premium plans
    const { data: planInfo } = await supabaseAdmin.from('subscription_plans').select('name').eq('id', payment.plan_id).single();
    const approvedPlanName = planInfo?.name || '';
    
    if (['School', 'Premium'].includes(approvedPlanName)) {
      const { data: existingInt } = await supabaseAdmin
        .from('school_integrations')
        .select('id')
        .eq('school_id', payment.school_id)
        .eq('integration_type', 'onesender')
        .maybeSingle();

      if (!existingInt) {
        const { data: refInt } = await supabaseAdmin
          .from('school_integrations')
          .select('api_key, api_url')
          .eq('integration_type', 'onesender')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (refInt?.api_key && refInt?.api_url) {
          await supabaseAdmin.from('school_integrations').insert({
            school_id: payment.school_id,
            integration_type: 'onesender',
            api_key: refInt.api_key,
            api_url: refInt.api_url,
            is_active: true,
            wa_enabled: true,
          });
        }
      } else {
        await supabaseAdmin.from('school_integrations').update({ is_active: true }).eq('id', existingInt.id);
      }
    }

    // ===== Generate Affiliate Commission (1x per school, only on first paid subscription) =====
    try {
      // Skip if Free plan
      const planPriceCents = (await supabaseAdmin.from('payment_transactions').select('amount').eq('id', payment.id).single()).data?.amount || 0;
      if (planPriceCents > 0 && approvedPlanName.toLowerCase() !== 'free') {
        // Find the school admin profile to check who referred them
        const { data: schoolAdminProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id, referred_by, referral_code')
          .eq('school_id', payment.school_id)
          .limit(1)
          .maybeSingle();

        // The referrer might be tracked via profiles.referred_by (user_id) OR via affiliate_code stored when registering
        // We look for an affiliate row whose user_id matches the profile that referred this school's admin
        let referrerUserId: string | null = schoolAdminProfile?.referred_by || null;
        let affiliateRow: any = null;

        if (referrerUserId) {
          const { data: aff } = await supabaseAdmin
            .from('affiliates')
            .select('id, current_balance, total_earned, commission_rate')
            .eq('user_id', referrerUserId)
            .maybeSingle();
          affiliateRow = aff;
        }

        // Check if commission already exists for this school (1x per school enforcement)
        const { data: existingCom } = await supabaseAdmin
          .from('affiliate_commissions')
          .select('id')
          .eq('school_id', payment.school_id)
          .maybeSingle();

        if (affiliateRow && !existingCom) {
          const rate = Number(affiliateRow.commission_rate || 50);
          const commissionAmount = Math.floor((planPriceCents * rate) / 100);

          await supabaseAdmin.from('affiliate_commissions').insert({
            affiliate_id: affiliateRow.id,
            school_id: payment.school_id,
            plan_name: approvedPlanName,
            plan_price: planPriceCents,
            commission_rate: rate,
            commission_amount: commissionAmount,
            status: 'approved',
            is_first_payment: true,
          });

          await supabaseAdmin
            .from('affiliates')
            .update({
              current_balance: (affiliateRow.current_balance || 0) + commissionAmount,
              total_earned: (affiliateRow.total_earned || 0) + commissionAmount,
            })
            .eq('id', affiliateRow.id);
        }
      }
    } catch (e) {
      console.error('Affiliate commission generation failed:', e);
      // Don't block payment approval if affiliate logic fails
    }

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
