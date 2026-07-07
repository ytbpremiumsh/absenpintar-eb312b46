import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const isPaidStatus = (status: unknown) => {
  const s = String(status || '').toLowerCase();
  return ['paid', 'settled', 'success', 'completed'].includes(s) || status === true;
};

async function getGatewayFeeConfig(supabaseAdmin: any): Promise<{ percent: number; flat: number }> {
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('key,value')
      .in('key', ['gateway_fee_percent', 'gateway_fee_flat']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    const percent = parseFloat(map['gateway_fee_percent'] ?? '0.7');
    const flat = parseInt(map['gateway_fee_flat'] ?? '500', 10);
    return {
      percent: isNaN(percent) ? 0.7 : percent,
      flat: isNaN(flat) ? 500 : flat,
    };
  } catch {
    return { percent: 0.7, flat: 500 };
  }
}

function calcGatewayFee(amount: number, cfg: { percent: number; flat: number }): number {
  return Math.round((amount || 0) * (cfg.percent / 100)) + (cfg.flat || 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log('Mayar webhook received:', JSON.stringify(body));

    const event = body.event || body['event.received'] || body.eventName || body.type;
    const data = body.data;

    // CRITICAL: Mayar mengirim event 'payment.reminder' dengan data.status="SUCCESS"
    // yang artinya reminder BERHASIL DIKIRIM (bukan payment paid). Sebelumnya webhook
    // salah memproses ini sebagai pembayaran sukses → invoice ditandai LUNAS padahal
    // wali murid belum bayar. Perketat: HANYA proses bila event di whitelist paid,
    // ATAU transactionStatus/paymentStatus benar-benar paid (bukan data.status).
    const acceptedEvents = ['payment.received', 'payment.completed', 'payment.success', 'payment.paid'];
    const txStatus = String(data?.transactionStatus || data?.paymentStatus || '').toLowerCase();
    const txIsPaid = ['paid', 'settled', 'success', 'completed'].includes(txStatus);
    const isAcceptedEvent = event && acceptedEvents.includes(event);

    if (!isAcceptedEvent && !txIsPaid) {
      console.log('Webhook ignored — bukan event paid', { event, dataStatus: data?.status, txStatus });
      return new Response(JSON.stringify({ message: 'Event ignored', event, txStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const transactionId = data?.id || data?.transaction_id || data?.transactionId;
    const productId = data?.productId || data?.product_id || data?.paymentLinkId || data?.payment_link_id;
    const paymentUrl = data?.paymentUrl || data?.payment_url || data?.link;
    const identifiers = Array.from(new Set([
      transactionId,
      productId,
      data?.paymentLinkId,
      data?.payment_link_id,
      data?.paymentLinkTransactionId,
      data?.payment_link_transaction_id,
    ].filter(Boolean).map(String)));
    
    if (!transactionId && !productId) {
      return new Response(JSON.stringify({ error: 'No transaction ID' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the payment transaction — try multiple matching strategies
    let payment = null;
    
    // 1. Match by all Mayar identifiers (invoice id, paymentLinkId, transaction ids)
    if (identifiers.length) {
      const { data: found } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, school_id, plan_id, status, amount, payment_method, mayar_transaction_id, mayar_payment_url')
        .in('mayar_transaction_id', identifiers)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = found;
    }
    
    // 2. Match by productId
    if (!payment && productId) {
      const { data: found } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, school_id, plan_id, status, amount, payment_method, mayar_transaction_id, mayar_payment_url')
        .eq('mayar_transaction_id', productId)
        .maybeSingle();
      payment = found;
    }

    // 3. Match by payment URL
    if (!payment && paymentUrl) {
      const { data: found } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, school_id, plan_id, status, amount, payment_method, mayar_transaction_id, mayar_payment_url')
        .eq('mayar_payment_url', paymentUrl)
        .eq('status', 'pending')
        .maybeSingle();
      payment = found;
    }
    
    // 4. (Removed) amount-only fallback for payment_transactions — too ambiguous
    //     when many SPP invoices share identical nominal. Mayar identifiers above are sufficient.

    // 5. SPP fallback — match directly against spp_invoices (in case payment_transactions bridge missing)
    if (!payment) {
      let sppInv: any = null;
      if (identifiers.length) {
        const { data } = await supabaseAdmin.from('spp_invoices').select('*').in('mayar_invoice_id', identifiers).maybeSingle();
        sppInv = data;
      }
      if (!sppInv && productId) {
        const { data } = await supabaseAdmin.from('spp_invoices').select('*').eq('mayar_invoice_id', productId).maybeSingle();
        sppInv = data;
      }
      if (!sppInv && paymentUrl) {
        const { data } = await supabaseAdmin.from('spp_invoices').select('*').eq('payment_url', paymentUrl).neq('status','paid').maybeSingle();
        sppInv = data;
      }
      if (sppInv && sppInv.status !== 'paid') {
        const feeCfg = await getGatewayFeeConfig(supabaseAdmin);
        const gatewayFee = calcGatewayFee(sppInv.total_amount, feeCfg);
        const netAmount = sppInv.total_amount - gatewayFee;
        await supabaseAdmin.from('spp_invoices').update({
          status: 'paid', paid_at: new Date().toISOString(),
          payment_method: data?.paymentMethod || 'mayar',
          gateway_fee: gatewayFee, net_amount: netAmount,
          mayar_invoice_id: sppInv.mayar_invoice_id || transactionId || productId,
        }).eq('id', sppInv.id);

        await supabaseAdmin.from('spp_logs').insert({
          school_id: sppInv.school_id, invoice_id: sppInv.id, event_type: 'webhook',
          status: 'paid', payload: body, message: 'SPP paid (direct fallback)',
        });
        await supabaseAdmin.from('notifications').insert({
          school_id: sppInv.school_id,
          title: 'Pembayaran SPP Diterima',
          message: `Pembayaran SPP ${sppInv.student_name} (${sppInv.class_name}) untuk ${sppInv.period_label} sebesar Rp ${(sppInv.total_amount).toLocaleString('id-ID')} telah diterima.`,
          type: 'success',
        });

        // WA notif ke ortu — pakai send-whatsapp agar mendukung MPWA + OneSender + fallback platform
        if (sppInv.parent_phone) {
          try {
            const { data: schoolFb } = await supabaseAdmin.from('schools').select('name').eq('id', sppInv.school_id).single();
            const schoolNameFb = schoolFb?.name || 'Sekolah';
            let phone = String(sppInv.parent_phone).replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            else if (phone.startsWith('8')) phone = '62' + phone;
            const paidDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const msg = `*${schoolNameFb} — Pembayaran SPP Berhasil*\n\nYth. Bapak/Ibu *${sppInv.parent_name || 'Wali'}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${sppInv.student_name}\n• Kelas   : ${sppInv.class_name}\n• Periode : ${sppInv.period_label}\n• Nominal : Rp${(sppInv.total_amount).toLocaleString('id-ID')}\n• Metode  : QRIS / Transfer Bank\n• Tanggal : ${paidDate}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
            const waRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
              },
              body: JSON.stringify({ school_id: sppInv.school_id, phone, message: msg, message_type: 'spp_paid' }),
            });
            console.log('SPP WA notif (direct fallback):', waRes.status, await waRes.text());
          } catch (waErr) { console.error('SPP WA notif error', waErr); }
        }

        return new Response(JSON.stringify({ success: true, type: 'spp_direct' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

        console.log('Transaction not found for IDs:', identifiers.join(',') || transactionId || productId || paymentUrl);
      return new Response(JSON.stringify({ message: 'Transaction not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payment.status === 'paid') {
      console.log('Payment already processed:', payment.id, '— checking SPP invoice fallback');
      // Don't early-return: a stale payment_transactions row may have matched while
      // the actual SPP invoice for this webhook is a different one still pending.
      // Try matching SPP invoice directly by Mayar identifiers / paymentUrl.
      let sppInv: any = null;
      if (identifiers.length) {
        const { data: f } = await supabaseAdmin.from('spp_invoices').select('*').in('mayar_invoice_id', identifiers).maybeSingle();
        sppInv = f;
      }
      if (!sppInv && productId) {
        const { data: f } = await supabaseAdmin.from('spp_invoices').select('*').eq('mayar_invoice_id', productId).maybeSingle();
        sppInv = f;
      }
      if (!sppInv && paymentUrl) {
        const { data: f } = await supabaseAdmin.from('spp_invoices').select('*').eq('payment_url', paymentUrl).maybeSingle();
        sppInv = f;
      }
      if (sppInv && sppInv.status !== 'paid') {
        const feeCfg = await getGatewayFeeConfig(supabaseAdmin);
        const gatewayFee = calcGatewayFee(sppInv.total_amount, feeCfg);
        const netAmount = sppInv.total_amount - gatewayFee;
        await supabaseAdmin.from('spp_invoices').update({
          status: 'paid', paid_at: new Date().toISOString(),
          payment_method: data?.paymentMethod || 'mayar',
          gateway_fee: gatewayFee, net_amount: netAmount,
          mayar_invoice_id: sppInv.mayar_invoice_id || transactionId || productId,
        }).eq('id', sppInv.id);
        await supabaseAdmin.from('spp_logs').insert({
          school_id: sppInv.school_id, invoice_id: sppInv.id, event_type: 'webhook',
          status: 'paid', payload: body, message: 'SPP paid (after stale payment_transactions match)',
        });
        await supabaseAdmin.from('notifications').insert({
          school_id: sppInv.school_id,
          title: 'Pembayaran SPP Diterima',
          message: `Pembayaran SPP ${sppInv.student_name} (${sppInv.class_name}) untuk ${sppInv.period_label} sebesar Rp ${(sppInv.total_amount).toLocaleString('id-ID')} telah diterima.`,
          type: 'success',
        });
        if (sppInv.parent_phone) {
          try {
            const { data: schoolFb } = await supabaseAdmin.from('schools').select('name').eq('id', sppInv.school_id).single();
            const schoolNameFb = schoolFb?.name || 'Sekolah';
            let phone = String(sppInv.parent_phone).replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            else if (phone.startsWith('8')) phone = '62' + phone;
            const paidDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const msg = `*${schoolNameFb} — Pembayaran SPP Berhasil*\n\nYth. Bapak/Ibu *${sppInv.parent_name || 'Wali'}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${sppInv.student_name}\n• Kelas   : ${sppInv.class_name}\n• Periode : ${sppInv.period_label}\n• Nominal : Rp${(sppInv.total_amount).toLocaleString('id-ID')}\n• Metode  : QRIS / Transfer Bank\n• Tanggal : ${paidDate}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
            const waRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
              },
              body: JSON.stringify({ school_id: sppInv.school_id, phone, message: msg, message_type: 'spp_paid' }),
            });
            console.log('SPP WA notif (stale-tx recovery):', waRes.status, await waRes.text());
          } catch (waErr) { console.error('SPP WA notif error', waErr); }
        }
        return new Response(JSON.stringify({ success: true, type: 'spp_recovered' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payment.status && payment.status !== 'pending') {
      console.log('Payment ignored because it is no longer pending:', payment.id, payment.status);
      return new Response(JSON.stringify({ message: 'Payment ignored', status: payment.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment status to paid
    await supabaseAdmin
      .from('payment_transactions')
      .update({ 
        status: 'paid', 
        paid_at: new Date().toISOString(), 
        payment_method: payment.payment_method || data?.paymentMethod || 'mayar',
        mayar_transaction_id: transactionId || payment.mayar_transaction_id,
      })
      .eq('id', payment.id);

    const { data: schoolRes } = await supabaseAdmin.from('schools').select('name').eq('id', payment.school_id).single();
    const schoolName = schoolRes?.name || 'Sekolah';
    const amountFormatted = `Rp ${(payment.amount || 0).toLocaleString('id-ID')}`;
    const paymentMethod = payment.payment_method || '';

    // ═══════════════════════════════════════════
    // SPP Invoice — auto confirm + WA notif
    // ═══════════════════════════════════════════
    if (paymentMethod === 'spp') {
      const matchIds = Array.from(new Set([payment.mayar_transaction_id, ...identifiers].filter(Boolean).map(String)));
      let inv: any = null;
      if (matchIds.length) {
        const { data: foundInv } = await supabaseAdmin.from('spp_invoices')
          .select('*').in('mayar_invoice_id', matchIds).maybeSingle();
        inv = foundInv;
      }
      if (!inv && paymentUrl) {
        const { data: foundInv } = await supabaseAdmin.from('spp_invoices')
          .select('*').eq('payment_url', paymentUrl).maybeSingle();
        inv = foundInv;
      }
      if (inv) {
        // GUARD: Jangan timpa invoice yang sudah dilunasi secara offline (tunai/transfer manual)
        // Mencegah webhook Mayar menimpa data offline & mendorongnya masuk ke saldo pencairan online.
        const isOfflinePaid = inv.status === 'paid' && (inv.payment_method === 'offline_cash' || inv.payment_method === 'offline_transfer');
        if (isOfflinePaid) {
          console.log(`Skip webhook update: invoice ${inv.id} sudah lunas offline (${inv.payment_method})`);
          await supabaseAdmin.from('spp_logs').insert({
            school_id: inv.school_id, invoice_id: inv.id, event_type: 'webhook',
            status: 'skipped_offline', payload: body, message: 'Webhook diabaikan karena invoice sudah lunas offline',
          });
          return new Response(JSON.stringify({ message: 'Skipped: already paid offline' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const feeCfg2 = await getGatewayFeeConfig(supabaseAdmin);
        const gatewayFee = calcGatewayFee(inv.total_amount, feeCfg2);
        const netAmount = inv.total_amount - gatewayFee;
        await supabaseAdmin.from('spp_invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: data?.paymentMethod || 'mayar',
          gateway_fee: gatewayFee,
          net_amount: netAmount,
        }).eq('id', inv.id);

        await supabaseAdmin.from('spp_logs').insert({
          school_id: inv.school_id, invoice_id: inv.id, event_type: 'webhook',
          status: 'paid', payload: body, message: 'SPP paid',
        });

        // Notif dashboard
        await supabaseAdmin.from('notifications').insert({
          school_id: inv.school_id,
          title: 'Pembayaran SPP Diterima',
          message: `Pembayaran SPP ${inv.student_name} (${inv.class_name}) untuk ${inv.period_label} sebesar ${amountFormatted} telah diterima.`,
          type: 'success',
        });

        // WA notif ke ortu — pakai send-whatsapp agar mendukung MPWA + OneSender + fallback platform
        if (inv.parent_phone) {
          try {
            let phone = String(inv.parent_phone).replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            else if (phone.startsWith('8')) phone = '62' + phone;
            const paidDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const msg = `*${schoolName} — Pembayaran SPP Berhasil*\n\nYth. Bapak/Ibu *${inv.parent_name || 'Wali'}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : Rp${(inv.total_amount).toLocaleString('id-ID')}\n• Metode  : QRIS / Transfer Bank\n• Tanggal : ${paidDate}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
            const waRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
              },
              body: JSON.stringify({ school_id: inv.school_id, phone, message: msg, message_type: 'spp_paid' }),
            });
            console.log('SPP WA notif:', waRes.status, await waRes.text());
          } catch (waErr) { console.error('SPP WA notif error', waErr); }
        }

        // Email notif ke wali (SMTP custom)
        if (inv.parent_email) {
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
              },
              body: JSON.stringify({
                event_type: 'spp_paid',
                to: inv.parent_email,
                school_id: inv.school_id,
                vars: {
                  name: inv.parent_name || inv.student_name || '',
                  invoice: inv.invoice_number || '',
                  amount: `Rp${(inv.total_amount || 0).toLocaleString('id-ID')}`,
                  period: inv.period_label || '',
                  school: inv.class_name || '',
                },
              }),
            });
          } catch (mailErr) { console.error('SPP email notif error', mailErr); }
        }
      }
      return new Response(JSON.stringify({ success: true, type: 'spp' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════
    // ADDON: ID Card Order — auto confirm
    // ═══════════════════════════════════════════
    if (paymentMethod === 'addon_idcard') {
      // Find the order linked to this payment
      const { data: order } = await supabaseAdmin
        .from('id_card_orders')
        .select('id, total_cards')
        .eq('payment_transaction_id', payment.id)
        .maybeSingle();

      if (order) {
        await supabaseAdmin.from('id_card_orders')
          .update({ progress: 'paid', status: 'paid' })
          .eq('id', order.id);
        console.log(`ID Card order ${order.id} auto-confirmed (${order.total_cards} cards)`);
      }

      await supabaseAdmin.from('notifications').insert({
        school_id: payment.school_id,
        title: 'Pembayaran ID Card Berhasil',
        message: `Pesanan cetak ${order?.total_cards || ''} ID Card sebesar ${amountFormatted} telah dibayar. Pesanan sedang diproses.`,
        type: 'success',
      });
      await supabaseAdmin.from('notifications').insert({
        school_id: null,
        title: 'Pembayaran ID Card Masuk',
        message: `${schoolName} membayar pesanan ID Card sebesar ${amountFormatted}. Pesanan otomatis dikonfirmasi.`,
        type: 'info',
      });

      return new Response(JSON.stringify({ success: true, type: 'idcard' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════
    // ADDON: WA Credit Top-up — auto confirm
    // ═══════════════════════════════════════════
    if (paymentMethod === 'addon_wa_credit') {
      // Calculate credits from amount
      const { data: priceSetting } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'wa_credit_price').maybeSingle();
      const { data: creditSetting } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'wa_credit_per_pack').maybeSingle();
      const pricePerPack = parseInt(priceSetting?.value || '50000');
      const creditsPerPack = parseInt(creditSetting?.value || '1000');
      const packs = Math.max(1, Math.round(payment.amount / pricePerPack));
      const totalCredits = packs * creditsPerPack;

      // Upsert wa_credits
      const { data: existing } = await supabaseAdmin.from('wa_credits')
        .select('id, balance, total_purchased')
        .eq('school_id', payment.school_id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from('wa_credits').update({
          balance: existing.balance + totalCredits,
          total_purchased: existing.total_purchased + totalCredits,
        }).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('wa_credits').insert({
          school_id: payment.school_id,
          balance: totalCredits,
          total_purchased: totalCredits,
          total_used: 0,
        });
      }

      console.log(`WA Credit ${totalCredits} added for school ${payment.school_id}`);

      await supabaseAdmin.from('notifications').insert({
        school_id: payment.school_id,
        title: 'Top-up Kredit WA Berhasil',
        message: `${totalCredits.toLocaleString('id-ID')} kredit pesan WhatsApp telah ditambahkan. Pembayaran sebesar ${amountFormatted}.`,
        type: 'success',
      });
      await supabaseAdmin.from('notifications').insert({
        school_id: null,
        title: 'Top-up Kredit WA Masuk',
        message: `${schoolName} top-up ${totalCredits.toLocaleString('id-ID')} kredit WA sebesar ${amountFormatted}.`,
        type: 'info',
      });

      return new Response(JSON.stringify({ success: true, type: 'wa_credit', credits_added: totalCredits }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════
    // SUBSCRIPTION Payment — existing logic
    // ═══════════════════════════════════════════
    const { data: planRes } = await supabaseAdmin.from('subscription_plans').select('name').eq('id', payment.plan_id).single();
    const planName = planRes?.name || 'Unknown';

    // Create or extend school subscription
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
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (existingSub) {
      await supabaseAdmin
        .from('school_subscriptions')
        .update({ plan_id: payment.plan_id, expires_at: expiresAt.toISOString() })
        .eq('id', existingSub.id);
    } else {
      await supabaseAdmin
        .from('school_subscriptions')
        .insert({
          school_id: payment.school_id,
          plan_id: payment.plan_id,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        });
    }

    const expiresFormatted = expiresAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Auto-provision WhatsApp integration for Basic/School/Premium plans
    if (['Basic', 'School', 'Premium'].includes(planName)) {
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
        await supabaseAdmin.from('school_integrations')
          .update({ is_active: true })
          .eq('id', existingInt.id);
      }

      // Auto-provision 5000 WA credits for Basic/School/Premium
      const { data: existingCredits } = await supabaseAdmin.from('wa_credits')
        .select('id, balance, total_purchased')
        .eq('school_id', payment.school_id)
        .maybeSingle();

      if (!existingCredits) {
        await supabaseAdmin.from('wa_credits').insert({
          school_id: payment.school_id,
          balance: 5000,
          total_purchased: 5000,
          total_used: 0,
        });
        console.log(`WA Credits 5000 auto-provisioned for school ${payment.school_id} (${planName})`);
      }
    }


    await supabaseAdmin.from('notifications').insert({
      school_id: payment.school_id,
      title: 'Pembayaran Berhasil — Upgrade Sukses',
      message: `Paket ${planName} telah aktif untuk ${schoolName}. Langganan berlaku hingga ${expiresFormatted}. Terima kasih atas pembayaran sebesar ${amountFormatted}.`,
      type: 'success',
    });

    await supabaseAdmin.from('notifications').insert({
      school_id: null,
      title: 'Pembayaran Masuk — Auto Approved',
      message: `${schoolName} telah membayar Paket ${planName} sebesar ${amountFormatted}. Langganan otomatis diaktifkan hingga ${expiresFormatted}.`,
      type: 'info',
    });

    console.log(`Payment ${payment.id} auto-approved. Plan: ${planName}, School: ${schoolName}, Expires: ${expiresFormatted}`);

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
