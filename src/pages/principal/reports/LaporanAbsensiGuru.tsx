import { useEffect, useMemo, useState } from "react";
import { GraduationCap, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const ROLE_LABEL: Record<string, string> = {
  teacher: "Guru",
  school_admin: "Admin Sekolah",
  staff: "Staff",
  bendahara: "Bendahara",
  principal: "Kepala Sekolah",
};

export default function LaporanAbsensiGuru() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [roleF, setRoleF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const [profQ, rolesQ, logsQ, todayLogsQ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").eq("school_id", schoolId),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, date, time").eq("school_id", schoolId).gte("date", from).lte("date", to),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, time").eq("school_id", schoolId).eq("date", todayStr),
      ]);

      // Only include people that actually belong to this school (defensive; RLS should already filter)
      const roleMap = new Map<string, string[]>();
      (rolesQ.data || []).forEach((r: any) => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      });
      const allowedRoles = new Set(["teacher", "school_admin", "staff", "bendahara", "principal"]);
      const staff = (profQ.data || []).filter((p: any) => (roleMap.get(p.user_id) || []).some((r) => allowedRoles.has(r)));

      // Aggregate presence (attendance_type = 'datang')
      const per: Record<string, any> = {};
      staff.forEach((t: any) => {
        const roles = (roleMap.get(t.user_id) || []).filter((r) => allowedRoles.has(r));
        // Prefer teacher as primary label if present, else first meaningful role
        const primary = roles.includes("teacher") ? "teacher" : roles.find((r) => r !== "principal") || roles[0] || "staff";
        per[t.user_id] = {
          Nama: t.full_name || "-",
          Peran: ROLE_LABEL[primary] || primary,
          "No HP": t.phone || "-",
          Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Terlambat: 0,
          "Total Hari": 0, "% Hadir": 0,
          "Jam Datang": "-",
          "Jam Pulang": "-",
          "Status Hari Ini": "belum",
          _role: primary,
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

      // Today: datang & pulang time + status
      (todayLogsQ.data || []).forEach((l: any) => {
        const r = per[l.user_id]; if (!r) return;
        const type = l.attendance_type ?? "datang";
        if (type === "datang") {
          r["Jam Datang"] = l.time ? String(l.time).slice(0, 5) : "-";
          r["Status Hari Ini"] = l.status || "belum";
        } else if (type === "pulang") {
          r["Jam Pulang"] = l.time ? String(l.time).slice(0, 5) : "-";
        }
      });

      setRows(Object.values(per));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const roleOptions = useMemo(() => Array.from(new Set(rows.map((r) => r._role))).filter(Boolean), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (roleF !== "all" && r._role !== roleF) return false;
    if (statusF !== "all" && r["Status Hari Ini"] !== statusF) return false;
    return true;
  }), [rows, roleF, statusF]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const hadir = filtered.filter((r) => r["Status Hari Ini"] === "hadir").length;
    const izin = filtered.filter((r) => r["Status Hari Ini"] === "izin").length;
    const sakit = filtered.filter((r) => r["Status Hari Ini"] === "sakit").length;
    const alfa = filtered.filter((r) => r["Status Hari Ini"] === "alfa").length;
    const belum = filtered.filter((r) => r["Status Hari Ini"] === "belum").length;
    const terlambat = filtered.reduce((s, r) => s + r.Terlambat, 0);
    const rata = total > 0 ? Math.round(filtered.reduce((s, r) => s + r["% Hadir"], 0) / total) : 0;
    return { total, hadir, izin, sakit, alfa, belum, terlambat, rata };
  }, [filtered]);

  const headers: Header[] = [
    { key: "Nama", label: "Nama" },
    { key: "Peran", label: "Peran" },
    { key: "No HP", label: "No HP" },
    { key: "Status Hari Ini", label: "Status", type: "status" },
    { key: "Jam Datang", label: "Jam Datang" },
    { key: "Jam Pulang", label: "Jam Pulang" },
    { key: "Hadir", label: "Hadir" },
    { key: "Izin", label: "Izin" },
    { key: "Sakit", label: "Sakit" },
    { key: "Alfa", label: "Alfa" },
    { key: "Terlambat", label: "Terlambat" },
    { key: "Total Hari", label: "Total Hari" },
    { key: "% Hadir", label: "% Hadir" },
  ];

  return (
    <ReportShell
      title="Rekap Absensi Guru"
      subtitle="Rekapitulasi kehadiran guru & staff — jam datang, pulang, dan status hari ini"
      icon={GraduationCap}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Absensi_Guru_${from}_${to}`, filtered.map(({ _role, ...r }) => r), headers)}
      extraFilters={
        <>
          <Select value={roleF} onValueChange={setRoleF}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Peran" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Peran</SelectItem>
              {roleOptions.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r] || r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="hadir">Hadir</SelectItem>
              <SelectItem value="izin">Izin</SelectItem>
              <SelectItem value="sakit">Sakit</SelectItem>
              <SelectItem value="alfa">Alfa</SelectItem>
              <SelectItem value="belum">Belum Absen</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      summary={
        <StatsRow items={[
          { label: "Total Guru/Staff", value: summary.total, tone: "primary", icon: GraduationCap },
          { label: "Hadir Hari Ini", value: summary.hadir, tone: "emerald", icon: UserCheck },
          { label: "Izin", value: summary.izin, tone: "sky" },
          { label: "Sakit", value: summary.sakit, tone: "amber" },
          { label: "Alfa", value: summary.alfa, tone: "rose" },
          { label: "Belum Absen", value: summary.belum, tone: "slate", icon: UserX },
          { label: "Terlambat (periode)", value: summary.terlambat, tone: "amber" },
          { label: "Rata-rata %", value: `${summary.rata}%`, tone: "indigo" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
