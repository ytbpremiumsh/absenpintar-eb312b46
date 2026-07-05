import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const invokeSendWhatsApp = async (payload: Record<string, unknown>) => {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text.substring(0, 200) };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { school_id, student_code, student_id, method } = await req.json();

    if (!school_id || (!student_code && !student_id)) {
      return new Response(JSON.stringify({ error: "school_id dan student_code/student_id diperlukan" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up student
    let student;
    if (student_id) {
      const { data } = await supabase
        .from('students').select('*').eq('id', student_id).eq('school_id', school_id).single();
      student = data;
    } else {
      const trimmed = student_code.trim();
      const { data } = await supabase
        .from('students').select('*').eq('school_id', school_id)
        .or(`student_id.eq.${trimmed},qr_code.eq.${trimmed},rfid_uid.eq.${trimmed},card_number.eq.${trimmed}`).maybeSingle();
      student = data;
    }

    if (!student) {
      return new Response(JSON.stringify({ error: "Siswa tidak ditemukan" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get attendance time settings + school timezone + holiday mode
    const [{ data: settings }, { data: schoolTz }] = await Promise.all([
      supabase
        .from('dismissal_settings')
        .select('attendance_start_time, attendance_end_time, departure_start_time, departure_end_time')
        .eq('school_id', school_id)
        .maybeSingle(),
      supabase.from('schools').select('timezone, holiday_mode, holiday_mode_label').eq('id', school_id).maybeSingle(),
    ]);

    const tzMap: Record<string, string> = { WIB: 'Asia/Jakarta', WITA: 'Asia/Makassar', WIT: 'Asia/Jayapura' };
    const tz = tzMap[(schoolTz?.timezone || 'WIB').toUpperCase()] || 'Asia/Jakarta';

    // Cek Mode Libur & tanggal merah sekolah
    if ((schoolTz as any)?.holiday_mode) {
      return new Response(JSON.stringify({
        error: `Hari ini libur — ${(schoolTz as any).holiday_mode_label || 'Sekolah sedang libur'}. Absensi ditangguhkan.`,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const todayLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz })).toISOString().slice(0, 10);
    const { data: holToday } = await supabase
      .from('school_holidays')
      .select('label')
      .eq('school_id', school_id)
      .eq('date', todayLocal)
      .maybeSingle();
    if (holToday) {
      return new Response(JSON.stringify({
        error: `Hari ini tanggal merah — ${(holToday as any).label || 'Libur sekolah'}. Absensi ditangguhkan.`,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const currentTime = jakartaTime.toTimeString().slice(0, 8);
    const today = jakartaTime.getFullYear() + '-' + String(jakartaTime.getMonth() + 1).padStart(2, '0') + '-' + String(jakartaTime.getDate()).padStart(2, '0');

    const attStart = settings?.attendance_start_time || '06:00:00';
    const attEnd = settings?.attendance_end_time || '12:00:00';
    const depStart = settings?.departure_start_time || '12:00:00';
    const depEnd = settings?.departure_end_time || '17:00:00';

    // Check today's existing records first to enable smart switching
    const { data: todayLogs } = await supabase.from('attendance_logs')
      .select('id, attendance_type').eq('student_id', student.id).eq('date', today);
    const hasDatang = (todayLogs || []).some((l: any) => l.attendance_type === 'datang');
    const hasPulang = (todayLogs || []).some((l: any) => l.attendance_type === 'pulang');

    const inAtt = currentTime >= attStart && currentTime < attEnd;
    const inDep = currentTime >= depStart && currentTime <= depEnd;

    let attendance_type: string;
    if (hasDatang && !hasPulang && currentTime >= depStart) {
      // Already arrived — switch to pulang once departure window opens (handles overlapping windows)
      attendance_type = 'pulang';
    } else if (inAtt && !hasDatang) {
      attendance_type = 'datang';
    } else if (inDep) {
      attendance_type = 'pulang';
    } else if (inAtt) {
      attendance_type = 'datang';
    } else if (currentTime < attStart) {
      attendance_type = 'datang';
    } else {
      attendance_type = 'pulang';
    }

    // Check if already recorded for this type today
    const { data: existing } = await supabase.from('attendance_logs')
      .select('id').eq('student_id', student.id).eq('date', today).eq('attendance_type', attendance_type).maybeSingle();

    if (existing) {
      const typeLabel = attendance_type === 'datang' ? 'Datang' : 'Pulang';
      return new Response(JSON.stringify({ 
        error: "already_recorded", 
        message: `${student.name} sudah tercatat absensi ${typeLabel} hari ini`,
        student: { id: student.id, name: student.name, class: student.class, student_id: student.student_id, photo_url: student.photo_url },
        attendance_type,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert attendance
    const methodLabel = method === 'face_recognition' ? 'Face Recognition' : method === 'rfid' ? 'Kartu RFID' : 'Barcode Scan';
    const { error: insertError } = await supabase.from('attendance_logs').insert({
      school_id,
      student_id: student.id,
      date: today,
      time: currentTime,
      method: method || 'barcode',
      status: 'hadir',
      recorded_by: 'Scan Publik',
      attendance_type,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send WhatsApp notification based on delivery target settings
    try {
      const [integrationRes, schoolRes, classRes] = await Promise.all([
        supabase
          .from('school_integrations')
          .select('attendance_arrive_template, attendance_depart_template, attendance_group_template, wa_delivery_target, wa_enabled, is_active, api_url, api_key')
          .eq('school_id', school_id)
          .eq('integration_type', 'onesender')
          .maybeSingle(),
        supabase
          .from('schools')
          .select('name')
          .eq('id', school_id)
          .single(),
        supabase
          .from('classes')
          .select('wa_group_id')
          .eq('school_id', school_id)
          .eq('name', student.class)
          .maybeSingle(),
      ]);

      const integration = integrationRes.data;
      const schoolName = schoolRes.data?.name || '';
      const groupId = classRes.data?.wa_group_id || null;

      if (integration && integration.wa_enabled !== false) {
        const deliveryTarget = integration.wa_delivery_target || 'parent_only';
        const timeStr = jakartaTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = dayNames[jakartaTime.getDay()];
        const typeLabel = attendance_type === 'datang' ? 'Datang (Hadir)' : 'Pulang';

        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dateStr = `${jakartaTime.getDate()} ${monthNames[jakartaTime.getMonth()]} ${jakartaTime.getFullYear()}`;

        const applyReplacements = (tpl: string) =>
          tpl
            .replace(/\{student_name\}/g, student.name)
            .replace(/\{class\}/g, student.class)
            .replace(/\{time\}/g, timeStr)
            .replace(/\{day\}/g, dayName)
            .replace(/\{date\}/g, dateStr)
            .replace(/\{student_id\}/g, student.student_id)
            .replace(/\{method\}/g, methodLabel)
            .replace(/\{parent_name\}/g, student.parent_name || '')
            .replace(/\{school_name\}/g, schoolName)
            .replace(/\{type\}/g, typeLabel);

        const sendTasks: Promise<unknown>[] = [];

        // Send to parent (Wali Murid)
        if ((deliveryTarget === 'parent_only' || deliveryTarget === 'both') && student.parent_phone) {
          const template = attendance_type === 'datang'
            ? (integration.attendance_arrive_template || '')
            : (integration.attendance_depart_template || '');

          const message = template ? applyReplacements(template)
            : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nAnanda *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${timeStr}.\n\nMetode: ${methodLabel}\n\n_Pesan otomatis dari Smart School Attendance System_`;

          sendTasks.push((async () => {
            try {
              const result = await invokeSendWhatsApp({
                school_id,
                phone: student.parent_phone,
                message,
                message_type: 'attendance',
                student_name: student.name,
              });
              console.log('WA parent result:', JSON.stringify(result).substring(0, 200));
            } catch (e) {
              console.error('WA parent error:', e);
            }
          })());
        }

        // Send to Group Kelas
        if ((deliveryTarget === 'group_only' || deliveryTarget === 'both') && groupId) {
          const groupTpl = integration.attendance_group_template || '';
          const groupMessage = groupTpl ? applyReplacements(groupTpl)
            : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nSiswa *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${timeStr}.\n\nMetode: ${methodLabel}\n\n_Pesan otomatis dari Smart School Attendance System_`;

          sendTasks.push((async () => {
            try {
              const result = await invokeSendWhatsApp({
                school_id,
                group_id: groupId,
                message: groupMessage,
                message_type: 'attendance_group',
                student_name: student.name,
              });
              console.log('WA group result:', JSON.stringify(result).substring(0, 200));
            } catch (e) {
              console.error('WA group error:', e);
            }
          })());
        }

        if (sendTasks.length > 0) {
          await Promise.allSettled(sendTasks);
        }
      }
    } catch (waErr) { console.error('WA notification error:', waErr); }

    return new Response(JSON.stringify({
      success: true,
      student: { id: student.id, name: student.name, class: student.class, student_id: student.student_id, photo_url: student.photo_url },
      attendance_type,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
