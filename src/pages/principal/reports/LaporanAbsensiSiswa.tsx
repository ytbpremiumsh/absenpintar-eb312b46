import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function LaporanAbsensiSiswa() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [cls, setCls] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [studentsQ, logsQ] = await Promise.all([
        supabase.from("students").select("id, student_id, name, class, gender, parent_name, parent_phone").eq("school_id", schoolId).order("class").order("name"),
        supabase.from("attendance_logs").select("student_id, status, attendance_type, date, time").eq("school_id", schoolId).gte("date", from).lte("date", to),
      ]);
      const students = studentsQ.data || [];
      const clsList = Array.from(new Set(students.map((s: any) => s.class))).sort();
      setClasses(clsList);
      const per: Record<string, any> = {};
      students.forEach((s: any) => {
        per[s.id] = {
          NIS: s.student_id, Nama: s.name, Kelas: s.class, JK: s.gender === "L" ? "L" : "P",
          "Wali/Ortu": s.parent_name, "No HP": s.parent_phone,
          Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Terlambat: 0,
          "Total Hari": 0, "% Hadir": 0,
        };
      });
      (logsQ.data || []).forEach((l: any) => {
        if ((l.attendance_type ?? "datang") !== "datang") return;
        const r = per[l.student_id]; if (!r) return;
        r["Total Hari"]++;
        if (l.status === "hadir") r.Hadir++;
        else if (l.status === "izin") r.Izin++;
        else if (l.status === "sakit") r.Sakit++;
        else if (l.status === "alfa") r.Alfa++;
        if (l.time && l.time > "07:30:00" && l.status === "hadir") r.Terlambat++;
      });
      Object.values(per).forEach((r: any) => {
        r["% Hadir"] = r["Total Hari"] > 0 ? Math.round((r.Hadir / r["Total Hari"]) * 100) : 0;
      });
      setRows(Object.values(per));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const filtered = useMemo(() => cls === "all" ? rows : rows.filter((r) => r.Kelas === cls), [rows, cls]);
  const summary = useMemo(() => {
    const total = filtered.length;
    const hadir = filtered.reduce((s, r) => s + r.Hadir, 0);
    const izin = filtered.reduce((s, r) => s + r.Izin, 0);
    const sakit = filtered.reduce((s, r) => s + r.Sakit, 0);
    const alfa = filtered.reduce((s, r) => s + r.Alfa, 0);
    const rata = total > 0 ? Math.round(filtered.reduce((s, r) => s + r["% Hadir"], 0) / total) : 0;
    return { total, hadir, izin, sakit, alfa, rata };
  }, [filtered]);

  const headers: Header[] = [
    { key: "NIS", label: "NIS" }, { key: "Nama", label: "Nama" }, { key: "Kelas", label: "Kelas" }, { key: "JK", label: "JK" },
    { key: "Hadir", label: "Hadir" }, { key: "Izin", label: "Izin" }, { key: "Sakit", label: "Sakit" }, { key: "Alfa", label: "Alfa" },
    { key: "Terlambat", label: "Terlambat" }, { key: "Total Hari", label: "Total Hari" }, { key: "% Hadir", label: "% Hadir" },
    { key: "Wali/Ortu", label: "Wali/Ortu" }, { key: "No HP", label: "No HP" },
  ];

  return (
    <ReportShell
      title="Rekap Absensi Siswa"
      subtitle="Rekapitulasi kehadiran siswa lengkap per periode"
      icon={Users}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Absensi_Siswa_${from}_${to}`, filtered, headers)}
      extraFilters={
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      }
      summary={
        <StatsRow items={[
          { label: "Siswa", value: summary.total, tone: "primary" },
          { label: "Total Hadir", value: summary.hadir, tone: "emerald" },
          { label: "Total Izin", value: summary.izin, tone: "sky" },
          { label: "Total Sakit", value: summary.sakit, tone: "amber" },
          { label: "Total Alfa", value: summary.alfa, tone: "rose" },
          { label: "Rata-rata %", value: `${summary.rata}%`, tone: "indigo" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
