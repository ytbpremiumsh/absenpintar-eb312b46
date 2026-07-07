import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck, GraduationCap, Users, Clock, LogIn, LogOut, Search,
  Calendar, Timer, UserX, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  name: string;
  extra: string; // class (siswa) atau phone (guru)
  status: string;
  datang: string | null;
  pulang: string | null;
  method: string | null;
  notes: string | null;
};

const STATUS_TONE: Record<string, string> = {
  hadir: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  izin: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  sakit: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  alfa: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  belum: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
};

function StatusBadge({ v }: { v: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${STATUS_TONE[v] || STATUS_TONE.belum}`}>{v}</span>;
}

function fmtTime(t: string | null) {
  if (!t) return "-";
  return String(t).slice(0, 5);
}

function durasi(datang: string | null, pulang: string | null) {
  if (!datang || !pulang) return "-";
  const [h1, m1] = datang.split(":").map(Number);
  const [h2, m2] = pulang.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins <= 0) return "-";
  return `${Math.floor(mins / 60)}j ${mins % 60}m`;
}

export default function PrincipalKehadiran() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const [teacherRows, setTeacherRows] = useState<Row[]>([]);
  const [studentRows, setStudentRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  // filters
  const [tSearch, setTSearch] = useState("");
  const [tStatus, setTStatus] = useState("all");
  const [sSearch, setSSearch] = useState("");
  const [sStatus, setSStatus] = useState("all");
  const [sClass, setSClass] = useState("all");

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [teachersQ, rolesQ, tLogsQ, studentsQ, sLogsQ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").eq("school_id", schoolId),
        supabase.from("user_roles").select("user_id, role").eq("role", "teacher" as any),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, time, method, notes").eq("school_id", schoolId).eq("date", date),
        supabase.from("students").select("id, student_id, name, class").eq("school_id", schoolId).order("class").order("name"),
        supabase.from("attendance_logs").select("student_id, status, attendance_type, time, method, notes").eq("school_id", schoolId).eq("date", date),
      ]);

      // GURU
      const teacherIds = new Set((rolesQ.data || []).map((r: any) => r.user_id));
      const teachers = (teachersQ.data || []).filter((t: any) => teacherIds.has(t.user_id));
      const tArrival = new Map<string, any>();
      const tDeparture = new Map<string, any>();
      (tLogsQ.data || []).forEach((l: any) => {
        const type = l.attendance_type ?? "datang";
        if (type === "datang") tArrival.set(l.user_id, l);
        else if (type === "pulang") tDeparture.set(l.user_id, l);
      });
      const tRows: Row[] = teachers.map((t: any) => {
        const a = tArrival.get(t.user_id);
        const p = tDeparture.get(t.user_id);
        return {
          id: t.user_id,
          name: t.full_name || "-",
          extra: t.phone || "-",
          status: a?.status || "belum",
          datang: a?.time || null,
          pulang: p?.time || null,
          method: a?.method || p?.method || null,
          notes: a?.notes || p?.notes || null,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      setTeacherRows(tRows);

      // SISWA
      const students = studentsQ.data || [];
      setClasses(Array.from(new Set(students.map((s: any) => s.class))).sort());
      const sArrival = new Map<string, any>();
      const sDeparture = new Map<string, any>();
      (sLogsQ.data || []).forEach((l: any) => {
        const type = l.attendance_type ?? "datang";
        if (type === "datang") sArrival.set(l.student_id, l);
        else if (type === "pulang") sDeparture.set(l.student_id, l);
      });
      const sRows: Row[] = students.map((s: any) => {
        const a = sArrival.get(s.id);
        const p = sDeparture.get(s.id);
        return {
          id: s.id,
          name: s.name,
          extra: s.class,
          status: a?.status || "belum",
          datang: a?.time || null,
          pulang: p?.time || null,
          method: a?.method || p?.method || null,
          notes: a?.notes || p?.notes || null,
        };
      });
      setStudentRows(sRows);
      setLoading(false);
    })();
  }, [schoolId, date]);

  const tStats = useMemo(() => summarize(teacherRows), [teacherRows]);
  const sStats = useMemo(() => summarize(studentRows), [studentRows]);
  const sByClass = useMemo(() => {
    const map: Record<string, { total: number; hadir: number }> = {};
    studentRows.forEach((r) => {
      if (!map[r.extra]) map[r.extra] = { total: 0, hadir: 0 };
      map[r.extra].total++;
      if (r.status === "hadir") map[r.extra].hadir++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v, pct: v.total ? Math.round((v.hadir / v.total) * 100) : 0 })).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentRows]);

  const filteredTeachers = teacherRows.filter(
    (r) => (tStatus === "all" || r.status === tStatus) &&
      (!tSearch || r.name.toLowerCase().includes(tSearch.toLowerCase()) || r.extra.toLowerCase().includes(tSearch.toLowerCase()))
  );
  const filteredStudents = studentRows.filter(
    (r) => (sStatus === "all" || r.status === sStatus) &&
      (sClass === "all" || r.extra === sClass) &&
      (!sSearch || r.name.toLowerCase().includes(sSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Kehadiran"
        subtitle="Detail lengkap kehadiran guru & siswa — pilih tanggal untuk melihat riwayat"
        icon={UserCheck}
      />

      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tanggal Pengamatan</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-[170px]" />
          {date !== new Date().toISOString().slice(0, 10) && (
            <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="text-xs text-primary hover:underline">Kembali ke hari ini</button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <Tabs defaultValue="guru" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="guru" className="gap-2"><GraduationCap className="h-4 w-4" /> Kehadiran Guru</TabsTrigger>
            <TabsTrigger value="siswa" className="gap-2"><Users className="h-4 w-4" /> Kehadiran Siswa</TabsTrigger>
          </TabsList>

          <TabsContent value="guru" className="space-y-4 mt-4">
            <StatsGrid stats={tStats} label="Guru" />
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Daftar Kehadiran Guru</CardTitle>
                    <CardDescription>Jam datang, jam pulang, durasi, metode & catatan</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Cari guru..." value={tSearch} onChange={(e) => setTSearch(e.target.value)} className="h-9 w-[200px] pl-8" />
                    </div>
                    <Select value={tStatus} onValueChange={setTStatus}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="hadir">Hadir</SelectItem>
                        <SelectItem value="izin">Izin</SelectItem>
                        <SelectItem value="sakit">Sakit</SelectItem>
                        <SelectItem value="alfa">Alfa</SelectItem>
                        <SelectItem value="belum">Belum Absen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AttendanceTable rows={filteredTeachers} extraLabel="No HP" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="siswa" className="space-y-4 mt-4">
            <StatsGrid stats={sStats} label="Siswa" />

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Kehadiran per Kelas</CardTitle>
                <CardDescription>Persentase kehadiran realtime</CardDescription>
              </CardHeader>
              <CardContent>
                {sByClass.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Belum ada data</div>}
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
                  {sByClass.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 text-xs py-1">
                      <span className="w-20 font-medium truncate">{c.name}</span>
                      <Progress value={c.pct} className="h-1.5 flex-1" />
                      <span className="w-24 text-right text-muted-foreground">{c.hadir}/{c.total} ({c.pct}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Daftar Kehadiran Siswa</CardTitle>
                    <CardDescription>Jam datang, jam pulang, durasi, metode & catatan</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Cari siswa..." value={sSearch} onChange={(e) => setSSearch(e.target.value)} className="h-9 w-[200px] pl-8" />
                    </div>
                    <Select value={sClass} onValueChange={setSClass}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={sStatus} onValueChange={setSStatus}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="hadir">Hadir</SelectItem>
                        <SelectItem value="izin">Izin</SelectItem>
                        <SelectItem value="sakit">Sakit</SelectItem>
                        <SelectItem value="alfa">Alfa</SelectItem>
                        <SelectItem value="belum">Belum Absen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AttendanceTable rows={filteredStudents} extraLabel="Kelas" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function summarize(rows: Row[]) {
  const s = { total: rows.length, hadir: 0, izin: 0, sakit: 0, alfa: 0, belum: 0, sudahPulang: 0, terlambat: 0 };
  rows.forEach((r) => {
    if (r.status === "hadir") s.hadir++;
    else if (r.status === "izin") s.izin++;
    else if (r.status === "sakit") s.sakit++;
    else if (r.status === "alfa") s.alfa++;
    else s.belum++;
    if (r.pulang) s.sudahPulang++;
    if (r.status === "hadir" && r.datang && r.datang > "07:30:00") s.terlambat++;
  });
  return s;
}

function StatsGrid({ stats, label }: { stats: ReturnType<typeof summarize>; label: string }) {
  const pct = stats.total ? Math.round((stats.hadir / stats.total) * 100) : 0;
  const items = [
    { label: `Total ${label}`, value: stats.total, tone: "primary", icon: Users },
    { label: "Hadir", value: stats.hadir, tone: "emerald", icon: UserCheck, extra: `${pct}%` },
    { label: "Izin", value: stats.izin, tone: "sky", icon: LogIn },
    { label: "Sakit", value: stats.sakit, tone: "amber", icon: Clock },
    { label: "Alfa", value: stats.alfa, tone: "rose", icon: UserX },
    { label: "Belum Absen", value: stats.belum, tone: "slate", icon: Timer },
    { label: "Sudah Pulang", value: stats.sudahPulang, tone: "violet", icon: LogOut },
    { label: "Terlambat", value: stats.terlambat, tone: "amber", icon: Clock },
  ];
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {items.map((it) => (
        <div key={it.label} className={`p-3 rounded-2xl border border-border/50 bg-gradient-to-br ${tones[it.tone]}`}>
          <it.icon className="h-4 w-4 mb-1" />
          <div className="text-lg font-bold text-foreground">
            {it.value}
            {it.extra && <span className="text-[10px] text-muted-foreground font-normal ml-1">({it.extra})</span>}
          </div>
          <div className="text-[10px] text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function AttendanceTable({ rows, extraLabel }: { rows: Row[]; extraLabel: string }) {
  if (rows.length === 0) return <div className="text-sm text-muted-foreground text-center py-10">Tidak ada data sesuai filter</div>;
  return (
    <div className="max-h-[600px] overflow-auto rounded-b-2xl">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr className="text-left">
            {["Nama", extraLabel, "Status", "Jam Datang", "Jam Pulang", "Durasi", "Metode", "Catatan"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const late = r.status === "hadir" && r.datang && r.datang > "07:30:00";
            return (
              <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.extra}</td>
                <td className="px-3 py-2"><StatusBadge v={r.status} /></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 ${late ? "text-amber-600 font-semibold" : ""}`}>
                    <LogIn className="h-3 w-3" /> {fmtTime(r.datang)}
                    {late && <Badge variant="outline" className="ml-1 border-amber-400 text-amber-600 text-[9px] px-1 py-0">Terlambat</Badge>}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><LogOut className="h-3 w-3" /> {fmtTime(r.pulang)}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{durasi(r.datang, r.pulang)}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.method ? <Badge variant="secondary" className="text-[10px]">{r.method}</Badge> : "-"}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs max-w-[220px] truncate">{r.notes || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
