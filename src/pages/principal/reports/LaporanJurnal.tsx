import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function LaporanJurnal() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [schedQ, subjQ, clsQ, teacherQ, attQ] = await Promise.all([
        supabase.from("teaching_schedules").select("id, teacher_id, subject_id, class_id, day_of_week, start_time, end_time, is_active, notes").eq("school_id", schoolId),
        supabase.from("subjects").select("id, name").eq("school_id", schoolId),
        supabase.from("classes").select("id, name").eq("school_id", schoolId),
        supabase.from("profiles").select("user_id, full_name").eq("school_id", schoolId),
        supabase.from("subject_attendance").select("teaching_schedule_id, date, status, student_id, notes").eq("school_id", schoolId).gte("date", from).lte("date", to),
      ]);
      const subjM = new Map((subjQ.data || []).map((s: any) => [s.id, s.name]));
      const clsM = new Map((clsQ.data || []).map((c: any) => [c.id, c.name]));
      const tM = new Map((teacherQ.data || []).map((t: any) => [t.user_id, t.full_name]));
      const schedM = new Map((schedQ.data || []).map((s: any) => [s.id, s]));

      const perKey: Record<string, any> = {};
      (attQ.data || []).forEach((a: any) => {
        const sch: any = schedM.get(a.teaching_schedule_id); if (!sch) return;
        const key = `${a.teaching_schedule_id}|${a.date}`;
        const scheduleNote = (sch.notes || "").trim();
        const sessionNote = (a.notes || "").trim();
        if (!perKey[key]) perKey[key] = {
          Tanggal: a.date, Hari: DAYS[sch.day_of_week] || "-",
          Guru: tM.get(sch.teacher_id) || "-",
          "Mata Pelajaran": subjM.get(sch.subject_id) || "-",
          Kelas: clsM.get(sch.class_id) || "-",
          Jam: `${String(sch.start_time).slice(0, 5)}-${String(sch.end_time).slice(0, 5)}`,
          Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Total: 0,
          Catatan: sessionNote || scheduleNote || "-",
          _sessionNote: sessionNote,
          _scheduleNote: scheduleNote,
        };
        perKey[key].Total++;
        if (a.status === "hadir") perKey[key].Hadir++;
        else if (a.status === "izin") perKey[key].Izin++;
        else if (a.status === "sakit") perKey[key].Sakit++;
        else if (a.status === "alfa") perKey[key].Alfa++;
        if (sessionNote && !perKey[key]._sessionNote) {
          perKey[key]._sessionNote = sessionNote;
          perKey[key].Catatan = sessionNote;
        }
      });
      Object.values(perKey).forEach((r: any) => {
        if (r._sessionNote && r._scheduleNote && r._sessionNote !== r._scheduleNote) {
          r.Catatan = `${r._sessionNote} — (Jadwal: ${r._scheduleNote})`;
        }
        delete r._sessionNote; delete r._scheduleNote;
      });
      setRows(Object.values(perKey).sort((a: any, b: any) => (b.Tanggal + b.Jam).localeCompare(a.Tanggal + a.Jam)));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const summary = useMemo(() => {
    const teachers = new Set(rows.map((r) => r.Guru));
    const subjects = new Set(rows.map((r) => r["Mata Pelajaran"]));
    return {
      sesi: rows.length,
      guru: teachers.size,
      mapel: subjects.size,
      hadir: rows.reduce((s, r) => s + r.Hadir, 0),
      alfa: rows.reduce((s, r) => s + r.Alfa, 0),
      total: rows.reduce((s, r) => s + r.Total, 0),
    };
  }, [rows]);

  const headers: Header[] = [
    { key: "Tanggal", label: "Tanggal" }, { key: "Hari", label: "Hari" },
    { key: "Guru", label: "Guru" }, { key: "Mata Pelajaran", label: "Mata Pelajaran" },
    { key: "Kelas", label: "Kelas" }, { key: "Jam", label: "Jam" },
    { key: "Hadir", label: "Hadir" }, { key: "Izin", label: "Izin" }, { key: "Sakit", label: "Sakit" }, { key: "Alfa", label: "Alfa" },
    { key: "Total", label: "Total" }, { key: "Catatan", label: "Catatan" },
  ];

  return (
    <ReportShell
      title="Jurnal Mengajar Guru"
      subtitle="Rekap sesi pembelajaran, kehadiran & catatan guru"
      icon={ClipboardList}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Jurnal_Mengajar_${from}_${to}`, rows, headers)}
      datesOptional
      summary={
        <StatsRow items={[
          { label: "Sesi Mengajar", value: summary.sesi, tone: "primary" },
          { label: "Guru Aktif", value: summary.guru, tone: "violet" },
          { label: "Mata Pelajaran", value: summary.mapel, tone: "indigo" },
          { label: "Total Kehadiran", value: summary.hadir, tone: "emerald" },
          { label: "Total Alfa", value: summary.alfa, tone: "rose" },
          { label: "Absensi Tercatat", value: summary.total, tone: "sky" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={rows} headers={headers} />
    </ReportShell>
  );
}
