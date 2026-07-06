import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const schoolId = url.searchParams.get("school_id");
    const filterClass = url.searchParams.get("class");

    if (!schoolId) {
      return new Response(JSON.stringify({ error: "school_id required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let studentsQuery = supabase
      .from("students")
      .select("id, name, class, parent_name, student_id, photo_url")
      .eq("school_id", schoolId)
      .order("class")
      .order("name");

    if (filterClass) {
      studentsQuery = studentsQuery.eq("class", filterClass);
    }

    const [studentsRes, logsRes, attendanceRes, schoolRes, settingsRes] = await Promise.all([
      studentsQuery,
      supabase.from("dismissal_logs").select("student_id, dismissal_time, dismissed_by").eq("school_id", schoolId).gte("dismissal_time", today.toISOString()),
      supabase.from("attendance_logs").select("student_id, status, check_in_time").eq("school_id", schoolId).gte("check_in_time", today.toISOString()),
      supabase.from("schools").select("name, logo").eq("id", schoolId).single(),
      supabase.from("dismissal_settings").select("is_active, auto_activate_time, auto_deactivate_time").eq("school_id", schoolId).maybeSingle(),
    ]);

    const students = studentsRes.data || [];
    const logs = logsRes.data || [];
    const attendance = attendanceRes.data || [];
    const school = schoolRes.data;
    const settings = settingsRes.data;

    // Only students actually present today (hadir / terlambat) belong on the dismissal monitor.
    // Absent / izin / sakit / alfa or no attendance record → excluded so they don't show as "menunggu".
    const presentIds = new Set(
      attendance
        .filter((a) => ["hadir", "terlambat", "present", "late"].includes(String(a.status).toLowerCase()))
        .map((a) => a.student_id)
    );

    const presentStudents = students.filter((s) => presentIds.has(s.id));

    const result = presentStudents.map((s) => {
      const log = logs.find((l) => l.student_id === s.id);
      const att = attendance.find((a) => a.student_id === s.id);
      return {
        ...s,
        status: log ? "picked_up" : "waiting",
        attendance_status: att?.status || null,
        check_in_time: att?.check_in_time || null,
        dismissal_time: log?.dismissal_time || null,
        dismissed_by: log?.dismissed_by || null,
      };
    });

    const grouped: Record<string, typeof result> = {};
    for (const s of result) {
      if (!grouped[s.class]) grouped[s.class] = [];
      grouped[s.class].push(s);
    }

    const pickedCount = result.filter((s) => s.status === "picked_up").length;

    return new Response(
      JSON.stringify({
        school,
        classes: grouped,
        total: presentStudents.length,
        picked_up: pickedCount,
        settings: settings || { is_active: true, auto_activate_time: "14:00:00", auto_deactivate_time: "17:00:00" },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
