import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


const MPWA_SEND_URL = 'https://app.ayopintar.com/send-message';

const formatPhone = (v: string) => {
  let p = (v || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.substring(1);
  return p;
};

const fmtRupiah = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { event_type, payload, test_phone, test_message } = body as {
      event_type?: 'support_ticket' | 'withdrawal_request' | 'test';
      payload?: Record<string, any>;
      test_phone?: string;
      test_message?: string;
    };

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load platform settings
    const { data: settingsRows } = await admin
      .from('platform_settings')
      .select('key, value')
      .in('key', [
        'admin_notify_phone',
        'admin_notify_enabled',
        'admin_notify_ticket_template',
        'admin_notify_withdrawal_template',
        'admin_notify_bendahara_template',
        'mpwa_platform_api_key',
        'mpwa_platform_sender',
        'mpwa_platform_connected',
        'wa_api_url',
        'wa_api_key',
        'admin_notify_email',
        'admin_notify_email_enabled',
        'admin_notify_email_ticket_subject',
        'admin_notify_email_ticket_html',
      ]);


    const ps: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { ps[r.key] = r.value; });

    if (event_type !== 'test' && ps.admin_notify_enabled !== 'true') {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: 'Admin notification disabled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminPhone = test_phone || ps.admin_notify_phone;
    if (!adminPhone) {
      return new Response(JSON.stringify({ success: false, error: 'admin_notify_phone belum dikonfigurasi' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build message based on event
    let message = '';
    if (event_type === 'test') {
      message = test_message || '✅ Test notifikasi WA Admin berhasil dari ATSkolla.';
    } else if (event_type === 'support_ticket') {
      const tpl = ps.admin_notify_ticket_template ||
        '🎫 *Tiket Bantuan Baru*\n\nSekolah: {school}\nDari: {user}\nPrioritas: {priority}\nSubjek: {subject}\n\nPesan:\n{message}\n\nWaktu: {time}';
      message = tpl
        .replace(/{school}/g, payload?.school || '-')
        .replace(/{user}/g, payload?.user || '-')
        .replace(/{priority}/g, payload?.priority || 'normal')
        .replace(/{subject}/g, payload?.subject || '-')
        .replace(/{message}/g, payload?.message || '-')
        .replace(/{time}/g, new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
    } else if (event_type === 'withdrawal_request') {
      const tpl = ps.admin_notify_withdrawal_template ||
        '💰 *Pengajuan Pencairan Dana*\n\nAffiliate: {affiliate}\nEmail: {email}\nJumlah: {amount}\n\nBank: {bank}\nNo. Rekening: {account_number}\nA/N: {account_holder}\n\nWaktu: {time}';
      message = tpl
        .replace(/{affiliate}/g, payload?.affiliate || '-')
        .replace(/{email}/g, payload?.email || '-')
        .replace(/{amount}/g, fmtRupiah(payload?.amount || 0))
        .replace(/{bank}/g, payload?.bank || '-')
        .replace(/{account_number}/g, payload?.account_number || '-')
        .replace(/{account_holder}/g, payload?.account_holder || '-')
        .replace(/{time}/g, new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
    } else if (event_type === 'bendahara_settlement') {
      const tpl = ps.admin_notify_bendahara_template ||
        '🏦 *Pencairan Dana Bendahara*\n\nSekolah: {school}\nDiajukan oleh: {requester}\nKode: {settlement_code}\n\nJumlah Transaksi: {total_transactions}\nGross: {total_gross}\nFee Gateway: {total_gateway_fee}\nNet: {total_net}\nFee Pencairan: {withdraw_fee}\n\n💰 *Pencairan Final: {final_payout}*\n\nBank: {bank}\nNo. Rek: {account_number}\nA/N: {account_holder}\n\nCatatan: {notes}\nWaktu: {time}';
      message = tpl
        .replace(/{school}/g, payload?.school || '-')
        .replace(/{requester}/g, payload?.requester || '-')
        .replace(/{settlement_code}/g, payload?.settlement_code || '-')
        .replace(/{total_transactions}/g, String(payload?.total_transactions ?? 0))
        .replace(/{total_gross}/g, fmtRupiah(payload?.total_gross || 0))
        .replace(/{total_gateway_fee}/g, fmtRupiah(payload?.total_gateway_fee || 0))
        .replace(/{total_net}/g, fmtRupiah(payload?.total_net || 0))
        .replace(/{withdraw_fee}/g, fmtRupiah(payload?.withdraw_fee || 0))
        .replace(/{final_payout}/g, fmtRupiah(payload?.final_payout || 0))
        .replace(/{bank}/g, payload?.bank || '-')
        .replace(/{account_number}/g, payload?.account_number || '-')
        .replace(/{account_holder}/g, payload?.account_holder || '-')
        .replace(/{notes}/g, payload?.notes || '-')
        .replace(/{time}/g, new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
    } else {
      return new Response(JSON.stringify({ success: false, error: 'event_type tidak dikenal' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formattedPhone = formatPhone(adminPhone);

    // Try MPWA first
    let sent = false;
    let lastResp: any = null;
    if (ps.mpwa_platform_api_key && ps.mpwa_platform_sender) {
      try {
        const r = await fetch(MPWA_SEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: ps.mpwa_platform_api_key,
            sender: ps.mpwa_platform_sender,
            number: formattedPhone,
            message,
          }),
        });
        const txt = await r.text();
        let parsed: any = {};
        try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
        lastResp = { gateway: 'mpwa', status: r.status, data: parsed };
        if (r.ok && parsed?.status !== false) sent = true;
      } catch (e) {
        lastResp = { gateway: 'mpwa', error: String(e) };
      }
    }

    // Fallback OneSender
    if (!sent && ps.wa_api_url && ps.wa_api_key) {
      try {
        const r = await fetch(ps.wa_api_url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ps.wa_api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_type: 'individual', to: formattedPhone, type: 'text', text: { body: message } }),
        });
        const txt = await r.text();
        let parsed: any = {};
        try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
        lastResp = { gateway: 'onesender', status: r.status, data: parsed };
        if (r.ok) sent = true;
      } catch (e) {
        lastResp = { gateway: 'onesender', error: String(e) };
      }
    }

    // Fire-and-forget Lovable transactional email to super admin for support tickets
    let emailResp: any = null;
    if (
      event_type === 'support_ticket' &&
      ps.admin_notify_email_enabled !== 'false' &&
      ps.admin_notify_email &&
      /.+@.+\..+/.test(ps.admin_notify_email)
    ) {
      try {
        const recipients = ps.admin_notify_email
          .split(/[,;]/).map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e));
        const templateData = {
          school: payload?.school || '-',
          user: payload?.user || '-',
          priority: payload?.priority || 'normal',
          subject: payload?.subject || '-',
          message: payload?.message || '-',
          time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        };
        const results: any[] = [];
        for (const to of recipients) {
          const r = await admin.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'admin-support-ticket',
              recipientEmail: to,
              templateData,
            },
          });
          results.push({ to, data: r?.data, error: r?.error?.message || null });
        }
        emailResp = results;
      } catch (e) {
        emailResp = { error: String(e) };
      }
    }


    return new Response(JSON.stringify({
      success: sent,
      to: formattedPhone,
      event_type,
      response: lastResp,
      email: emailResp,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('notify-admin-wa error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
