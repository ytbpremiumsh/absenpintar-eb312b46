import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const school_id = url.searchParams.get("school_id");
    if (!school_id) {
      return new Response(JSON.stringify({ error: "school_id is required" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const today = jakartaTime.getFullYear() + '-' + String(jakartaTime.getMonth() + 1).padStart(2, '0') + '-' + String(jakartaTime.getDate()).padStart(2, '0');

    const [schoolRes, studentsRes, logsRes, settingsRes] = await Promise.all([
      supabase.from('schools').select('name, logo').eq('id', school_id).single(),
      supabase.from('students').select('id, name, class, student_id, photo_url, parent_name').eq('school_id', school_id).order('class').order('name'),
      supabase.from('attendance_logs').select('id, student_id, time, status, method, created_at, attendance_type').eq('school_id', school_id).eq('date', today).order('created_at', { ascending: false }),
      supabase.from('dismissal_settings').select('attendance_start_time, attendance_end_time, departure_start_time, departure_end_time').eq('school_id', school_id).maybeSingle(),
    ]);


    if (schoolRes.error || !schoolRes.data) {
      return new Response(JSON.stringify({ error: "Sekolah tidak ditemukan" }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const students = studentsRes.data || [];
    const logs = logsRes.data || [];
    const settings = settingsRes.data;

    // Determine current attendance mode
    const currentTime = jakartaTime.toTimeString().slice(0, 8);
    const attStart = settings?.attendance_start_time || '06:00:00';
    const attEnd = settings?.attendance_end_time || '12:00:00';
    const depStart = settings?.departure_start_time || '12:00:00';
    const depEnd = settings?.departure_end_time || '17:00:00';

    let currentMode: string;
    if (currentTime >= attStart && currentTime < attEnd) {
      currentMode = 'datang';
    } else if (currentTime >= depStart && currentTime <= depEnd) {
      currentMode = 'pulang';
    } else if (currentTime < attStart) {
      currentMode = 'datang';
    } else {
      currentMode = 'pulang';
    }

    // Build per-class data
    const classes: Record<string, any[]> = {};
    for (const s of students) {
      if (!classes[s.class]) classes[s.class] = [];
      const logDatang = logs.find((l: any) => l.student_id === s.id && l.attendance_type === 'datang');
      const logPulang = logs.find((l: any) => l.student_id === s.id && l.attendance_type === 'pulang');
      // Auto-alfa when current time is past departure end time
      const autoAlfa = currentTime > depEnd;
      classes[s.class].push({
        id: s.id,
        name: s.name,
        student_id: s.student_id,
        photo_url: s.photo_url,
        status: logDatang?.status || (autoAlfa ? "alfa" : "belum"),
        time: logDatang?.time || null,
        method: logDatang?.method || null,
        datang: logDatang ? { status: logDatang.status, time: logDatang.time, method: logDatang.method } : null,
        pulang: logPulang ? { status: logPulang.status, time: logPulang.time, method: logPulang.method } : null,
      });
    }

    // Build live feed (recent 50)
    const liveFeed = logs.slice(0, 50).map((log: any) => {
      const student = students.find((s: any) => s.id === log.student_id);
      return {
        id: log.id,
        student_name: student?.name || "Unknown",
        student_class: student?.class || "",
        student_id: student?.student_id || "",
        photo_url: student?.photo_url || null,
        status: log.status,
        method: log.method,
        time: log.time,
        created_at: log.created_at,
        attendance_type: log.attendance_type || 'datang',
      };
    });

    const datangLogs = logs.filter((l: any) => (l.attendance_type || 'datang') === 'datang');
    const pulangLogs = logs.filter((l: any) => l.attendance_type === 'pulang');

    const totalStudents = students.length;
    const totalHadir = datangLogs.filter((l: any) => l.status === "hadir").length;
    const totalIzin = datangLogs.filter((l: any) => l.status === "izin").length;
    const totalSakit = datangLogs.filter((l: any) => l.status === "sakit").length;
    const dbAlfa = datangLogs.filter((l: any) => l.status === "alfa").length;
    const remaining = totalStudents - (totalHadir + totalIzin + totalSakit + dbAlfa);
    const autoAlfa2 = currentTime > depEnd;
    const totalAlfa = autoAlfa2 ? dbAlfa + remaining : dbAlfa;
    const totalBelum = autoAlfa2 ? 0 : remaining;

    // Sistem langganan berpaket dihapus; semua fitur aktif.
    const planName = 'Payment';
    const canFaceRecognition = true;


    return new Response(JSON.stringify({
      school: schoolRes.data,
      classes,
      liveFeed,
      stats: { total: totalStudents, hadir: totalHadir, izin: totalIzin, sakit: totalSakit, alfa: totalAlfa, belum: totalBelum },
      date: today,
      currentMode,
      pulangStats: { total: totalStudents, recorded: pulangLogs.length },
      timeSettings: { attStart, attEnd, depStart, depEnd },
      canFaceRecognition,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
