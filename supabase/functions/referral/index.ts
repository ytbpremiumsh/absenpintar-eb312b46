import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const supabaseAdmin = getAdminClient();

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    }

    const { action, ...params } = await req.json();

    // === HANDLE REFERRAL EVENT (called by create-user or payment webhook) ===
    if (action === 'handle_event') {
      const { event_type, referred_user_id, api_key } = params;
      
      // Validate internal call via service key or admin
      if (!api_key && !userId) {
        throw new Error('Unauthorized');
      }

      // Get referral settings
      const { data: settings } = await supabaseAdmin
        .from('platform_settings')
        .select('key, value')
        .in('key', ['referral_points_register', 'referral_points_trial', 'referral_points_paid', 'referral_double_points']);
      
      const config: Record<string, string> = {};
      (settings || []).forEach((s: any) => { config[s.key] = s.value; });

      const pointsMap: Record<string, number> = {
        'REGISTER': parseInt(config.referral_points_register || '10'),
        'TRIAL_STARTED': parseInt(config.referral_points_trial || '20'),
        'PAID': parseInt(config.referral_points_paid || '100'),
      };

      const points = pointsMap[event_type];
      if (!points) throw new Error('Invalid event type');

      // Double points campaign
      const multiplier = config.referral_double_points === 'true' ? 2 : 1;
      const finalPoints = points * multiplier;

      // Find referral record
      const { data: referral } = await supabaseAdmin
        .from('referrals')
        .select('*')
        .eq('referred_user_id', referred_user_id)
        .maybeSingle();

      if (!referral) {
        return new Response(JSON.stringify({ success: true, message: 'No referral found, skipping' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if already awarded for this event
      const { data: existingTx } = await supabaseAdmin
        .from('point_transactions')
        .select('id')
        .eq('user_id', referral.referrer_id)
        .eq('source', event_type)
        .ilike('description', `%${referred_user_id}%`)
        .maybeSingle();

      if (existingTx) {
        return new Response(JSON.stringify({ success: true, message: 'Already awarded' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Status mapping
      const statusMap: Record<string, string> = {
        'REGISTER': 'registered',
        'TRIAL_STARTED': 'trial_started',
        'PAID': 'paid',
      };

      // Update referral status
      await supabaseAdmin
        .from('referrals')
        .update({ status: statusMap[event_type], points_awarded: referral.points_awarded + finalPoints })
        .eq('id', referral.id);

      // Add point transaction for referrer
      await supabaseAdmin
        .from('point_transactions')
        .insert({
          user_id: referral.referrer_id,
          points: finalPoints,
          type: 'earn',
          source: event_type,
          description: `Referral ${event_type} dari user ${referred_user_id}`,
        });

      // Update referrer points
      const { data: referrerProfile } = await supabaseAdmin
        .from('profiles')
        .select('current_points, lifetime_points')
        .eq('user_id', referral.referrer_id)
        .single();

      if (referrerProfile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            current_points: (referrerProfile.current_points || 0) + finalPoints,
            lifetime_points: (referrerProfile.lifetime_points || 0) + finalPoints,
          })
          .eq('user_id', referral.referrer_id);
      }

      // Create notification for referrer
      const { data: referrerProfileFull } = await supabaseAdmin
        .from('profiles')
        .select('school_id')
        .eq('user_id', referral.referrer_id)
        .single();

      await supabaseAdmin
        .from('notifications')
        .insert({
          school_id: referrerProfileFull?.school_id || null,
          title: '🎉 Poin Referral Diterima!',
          message: `Anda mendapatkan +${finalPoints} poin dari referral (${event_type})!`,
          type: 'referral',
          created_by: referral.referrer_id,
        });

      return new Response(JSON.stringify({ success: true, points_awarded: finalPoints }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === CLAIM REWARD ===
    if (action === 'claim_reward') {
      if (!userId) throw new Error('Unauthorized');
      const { reward_id } = params;

      // Get reward
      const { data: reward } = await supabaseAdmin
        .from('rewards')
        .select('*')
        .eq('id', reward_id)
        .eq('is_active', true)
        .single();

      if (!reward) throw new Error('Reward tidak ditemukan');

      // Get user points
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('current_points, school_id')
        .eq('user_id', userId)
        .single();

      if (!profile) throw new Error('Profile tidak ditemukan');
      if ((profile.current_points || 0) < reward.points_required) {
        throw new Error('Poin tidak cukup');
      }

      // Deduct points
      await supabaseAdmin
        .from('profiles')
        .update({ current_points: (profile.current_points || 0) - reward.points_required })
        .eq('user_id', userId);

      // Create point transaction (redeem)
      await supabaseAdmin
        .from('point_transactions')
        .insert({
          user_id: userId,
          points: -reward.points_required,
          type: 'redeem',
          source: 'REWARD',
          description: `Tukar reward: ${reward.name}`,
        });

      // Insert reward claim
      await supabaseAdmin
        .from('reward_claims')
        .insert({
          user_id: userId,
          reward_id: reward.id,
          points_used: reward.points_required,
        });

      // Sistem paket langganan sudah dihapus — reward perpanjangan langganan tidak lagi diterapkan.


      // Notification
      await supabaseAdmin
        .from('notifications')
        .insert({
          school_id: profile.school_id,
          title: '🎁 Reward Berhasil Ditukar!',
          message: `Reward "${reward.name}" berhasil! Masa aktif bertambah ${reward.duration_days} hari.`,
          type: 'referral',
          created_by: userId,
        });

      return new Response(JSON.stringify({ success: true, duration_days: reward.duration_days }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === GET STATS ===
    if (action === 'get_stats') {
      if (!userId) throw new Error('Unauthorized');

      // Check if user has a referral code, if not generate one
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('referral_code')
        .eq('user_id', userId)
        .single();

      if (existingProfile && !existingProfile.referral_code) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let newCode = 'ATS-';
        for (let i = 0; i < 6; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        await supabaseAdmin
          .from('profiles')
          .update({ referral_code: newCode })
          .eq('user_id', userId);
      }

      const [profileRes, referralsRes, claimsRes, transactionsRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('referral_code, current_points, lifetime_points').eq('user_id', userId).single(),
        supabaseAdmin.from('referrals').select('*, referred_profile:profiles!referrals_referred_user_id_fkey(full_name, school_id)').eq('referrer_id', userId).order('created_at', { ascending: false }),
        supabaseAdmin.from('reward_claims').select('*, reward:rewards(name, points_required, duration_days)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabaseAdmin.from('point_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      ]);

      // Get referred school names
      const referrals = referralsRes.data || [];
      const enrichedReferrals = [];
      for (const ref of referrals) {
        let schoolName = 'Unknown';
        if (ref.referred_profile?.school_id) {
          const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', ref.referred_profile.school_id)
            .single();
          schoolName = school?.name || 'Unknown';
        }
        enrichedReferrals.push({
          ...ref,
          referred_name: ref.referred_profile?.full_name || 'Unknown',
          school_name: schoolName,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        referral_code: profileRes.data?.referral_code,
        current_points: profileRes.data?.current_points || 0,
        lifetime_points: profileRes.data?.lifetime_points || 0,
        referrals: enrichedReferrals,
        claims: claimsRes.data || [],
        transactions: transactionsRes.data || [],
        total_referrals: referrals.length,
        total_claims: (claimsRes.data || []).length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === LEADERBOARD ===
    if (action === 'leaderboard') {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('full_name, lifetime_points, referral_code')
        .gt('lifetime_points', 0)
        .order('lifetime_points', { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({ success: true, leaderboard: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
