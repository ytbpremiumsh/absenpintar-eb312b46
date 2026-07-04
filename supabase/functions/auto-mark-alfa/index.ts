import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hari libur nasional Indonesia 2025-2026
const HOLIDAYS = new Set<string>([
  "2025-01-01","2025-01-27","2025-01-29","2025-03-29","2025-03-31","2025-04-01",
  "2025-04-18","2025-04-20","2025-05-01","2025-05-12","2025-05-29","2025-06-01",
  "2025-06-06","2025-06-27","2025-08-17","2025-09-05","2025-12-25",
  "2026-01-01","2026-01-16","2026-02-17","2026-03-19","2026-03-20","2026-03-21",
  "2026-04-03","2026-04-05","2026-05-01","2026-05-14","2026-05-31","2026-05-27",
  "2026-06-01","2026-06-16","2026-08-17","2026-08-25","2026-12-25",
]);

function getLocalDate(timezone: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  }
}

function getDayOfWeek(timezone: string, date: Date = new Date()): number {
  try {
    const str = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[str] ?? new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

function getLocalHour(timezone: string, date: Date = new Date()): number {
  try {
    const str = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", hour12: false,
    }).format(date);
    return parseInt(str, 10);
  } catch {
    return date.getUTCHours();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Allow manual override for testing (?force=1) but default to safe time guard
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';

    // Ambil semua sekolah aktif beserta timezone
    const { data: schools, error: schErr } = await supabase
      .from('schools')
      .select('id, name, timezone, holiday_days, holiday_mode');

    if (schErr) throw schErr;
    if (!schools || schools.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No schools', processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary: any[] = [];
    let totalInserted = 0;

    for (const school of schools) {
      try {
        const tz = school.timezone || 'Asia/Jakarta';
        const today = getLocalDate(tz);
        const dow = getDayOfWeek(tz);
        const localHour = getLocalHour(tz);
        const holidayDays: number[] = Array.isArray((school as any).holiday_days) && (school as any).holiday_days.length > 0
          ? (school as any).holiday_days
          : [0, 6];

        // Time guard: jangan tandai Alfa sebelum jam 22:00 lokal (kecuali force)
        if (!force && localHour < 22) {
          summary.push({ school: school.name, skipped: 'too_early', date: today, local_hour: localHour });
          continue;
        }

        // Skip hari libur mingguan sekolah
        if (holidayDays.includes(dow)) {
          summary.push({ school: school.name, skipped: 'school_holiday', date: today, dow });
          continue;
        }
        // Skip libur nasional
        if (HOLIDAYS.has(today)) {
          summary.push({ school: school.name, skipped: 'holiday', date: today });
          continue;
        }
        // Skip Mode Libur darurat sekolah
        if ((school as any).holiday_mode) {
          summary.push({ school: school.name, skipped: 'holiday_mode', date: today });
          continue;
        }
        // Skip tanggal merah spesifik sekolah
        const { data: schoolHol } = await supabase
          .from('school_holidays')
          .select('id')
          .eq('school_id', school.id)
          .eq('date', today)
          .maybeSingle();
        if (schoolHol) {
          summary.push({ school: school.name, skipped: 'school_holiday_date', date: today });
          continue;
        }

        // Ambil siswa
        const { data: students } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', school.id);

        if (!students || students.length === 0) {
          summary.push({ school: school.name, skipped: 'no_students', date: today });
          continue;
        }
        const allIds = new Set(students.map((s) => s.id));

        // Siswa yang sudah ada record hari ini (status apapun)
        const { data: logs } = await supabase
          .from('attendance_logs')
          .select('student_id')
          .eq('school_id', school.id)
          .eq('date', today);
        const presentIds = new Set((logs || []).map((l: any) => l.student_id));

        // Siswa dengan izin/sakit disetujui yang mencakup hari ini
        const { data: leaves } = await supabase
          .from('parent_leave_requests')
          .select('student_id')
          .eq('school_id', school.id)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today);
        const excusedIds = new Set((leaves || []).map((l: any) => l.student_id));

        const toMark = [...allIds].filter((id) => !presentIds.has(id) && !excusedIds.has(id));

        if (toMark.length === 0) {
          summary.push({ school: school.name, inserted: 0, date: today });
          continue;
        }

        const rows = toMark.map((sid) => ({
          school_id: school.id,
          student_id: sid,
          date: today,
          time: '23:59:59',
          status: 'alfa',
          method: 'auto',
          recorded_by: 'auto-system',
          attendance_type: 'datang',
        }));

        const { error: insErr } = await supabase.from('attendance_logs').insert(rows);
        if (insErr) {
          summary.push({ school: school.name, error: insErr.message, date: today });
        } else {
          totalInserted += rows.length;
          summary.push({ school: school.name, inserted: rows.length, date: today });
        }
      } catch (e) {
        summary.push({ school: school.name, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_inserted: totalInserted,
      schools_processed: schools.length,
      summary,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
