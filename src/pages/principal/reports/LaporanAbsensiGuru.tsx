import { useEffect, useMemo, useState } from "react";
import { GraduationCap, UserCheck, UserX, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, StatusBadge, useMonthRange, type Header, type Row } from "./_common";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";

export default function LaporanAbsensiGuru() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [rows, setRows] = useState<Row[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const [teachersQ, rolesQ, logsQ, todayLogsQ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").eq("school_id", schoolId),
        supabase.from("user_roles").select("user_id, role").in("role", ["teacher", "school_admin", "staff"] as any),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, date, time").eq("school_id", schoolId).gte("date", from).lte("date", to),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, time").eq("school_id", schoolId).eq("date", todayStr),
      ]);
      const roleMap = new Map<string, string[]>();
      (rolesQ.data || []).forEach((r: any) => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      });
      const teachers = (teachersQ.data || []).filter((t: any) => (roleMap.get(t.user_id) || []).includes("teacher"));

      const per: Record<string, any> = {};
      teachers.forEach((t: any) => {
        per[t.user_id] = {
          Nama: t.full_name || "-", "No HP": t.phone || "-",
          Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Terlambat: 0,
          "Total Hari": 0, "% Hadir": 0,
        };
      });
      (logsQ.data || []).forEach((l: any) => {
        if ((l.attendance_type ?? "datang") !== "datang") return;
        const r = per[l.user_id]; if (!r) return;
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

      // Today status per teacher
      const arrivalMap = new Map<string, any>();
      (todayLogsQ.data || []).forEach((l: any) => {
        if ((l.attendance_type ?? "datang") === "datang") arrivalMap.set(l.user_id, l);
      });
      const todayList = teachers.map((t: any) => {
        const l = arrivalMap.get(t.user_id);
        return {
          user_id: t.user_id,
          name: t.full_name || "-",
          phone: t.phone || "-",
          status: l?.status || "belum",
          time: l?.time || null,
        };
      });
      setToday(todayList);
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const todayStats = useMemo(() => ({
    hadir: today.filter((t) => t.status === "hadir").length,
    izin: today.filter((t) => t.status === "izin").length,
    sakit: today.filter((t) => t.status === "sakit").length,
    alfa: today.filter((t) => t.status === "alfa").length,
    belum: today.filter((t) => t.status === "belum").length,
    total: today.length,
  }), [today]);

  const headers: Header[] = [
    { key: "Nama", label: "Nama" }, { key: "No HP", label: "No HP" },
    { key: "Hadir", label: "Hadir" }, { key: "Izin", label: "Izin" }, { key: "Sakit", label: "Sakit" }, { key: "Alfa", label: "Alfa" },
    { key: "Terlambat", label: "Terlambat" }, { key: "Total Hari", label: "Total Hari" }, { key: "% Hadir", label: "% Hadir" },
  ];

  const hadirToday = today.filter((t) => t.status === "hadir");
  const belumToday = today.filter((t) => t.status === "belum");
  const izinToday = today.filter((t) => ["izin", "sakit", "alfa"].includes(t.status));

  return (
    <ReportShell
      title="Rekap Absensi Guru"
      subtitle="Rekapitulasi dan status kehadiran guru hari ini"
      icon={GraduationCap}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Absensi_Guru_${from}_${to}`, rows, headers)}
      summary={
        <StatsRow items={[
          { label: "Total Guru", value: todayStats.total, tone: "primary", icon: GraduationCap },
          { label: "Hadir Hari Ini", value: todayStats.hadir, tone: "emerald", icon: UserCheck },
          { label: "Izin", value: todayStats.izin, tone: "sky" },
          { label: "Sakit", value: todayStats.sakit, tone: "amber" },
          { label: "Alfa", value: todayStats.alfa, tone: "rose" },
          { label: "Belum Absen", value: todayStats.belum, tone: "slate", icon: UserX },
        ]} />
      }
    >
      <div className="grid lg:grid-cols-3 gap-4">
        <TeacherList title="Sudah Hadir Hari Ini" desc={`${hadirToday.length} guru`} tone="emerald" items={hadirToday} />
        <TeacherList title="Izin / Sakit / Alfa" desc={`${izinToday.length} guru`} tone="amber" items={izinToday} />
        <TeacherList title="Belum Absen" desc={`${belumToday.length} guru`} tone="rose" items={belumToday} />
      </div>

      <Card className="rounded-2xl mt-4">
        <CardHeader>
          <CardTitle className="text-base">Rekap Periode {format(new Date(from), "dd MMM")} — {format(new Date(to), "dd MMM yyyy")}</CardTitle>
          <CardDescription>Detail per guru sepanjang rentang tanggal terpilih</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable loading={loading} rows={rows} headers={headers} />
        </CardContent>
      </Card>
    </ReportShell>
  );
}

function TeacherList({ title, desc, tone, items }: { title: string; desc: string; tone: string; items: any[] }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
  };
  return (
    <Card className={`rounded-2xl border ${tones[tone]}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[320px] overflow-auto space-y-1.5">
        {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Tidak ada</div>}
        {items.map((t) => (
          <div key={t.user_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/70 border border-border/30">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{t.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{t.phone}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.time && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{String(t.time).slice(0, 5)}</span>}
              <StatusBadge value={t.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
