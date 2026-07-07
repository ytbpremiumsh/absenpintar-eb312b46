import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users, GraduationCap, UserCheck, UserX, School as SchoolIcon, Percent,
  Clock, BookOpen, DollarSign, Wallet, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, AlertTriangle, Bell, Trophy, Calendar as CalendarIcon,
  Activity, Download, FileSpreadsheet, Megaphone, ClipboardList, ArrowRight
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  teachersPresent: number;
  studentsPresent: number;
  activeClasses: number;
  attendanceRate: number;
}

export default function PrincipalDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const schoolId = profile?.school_id;
  const [schoolName, setSchoolName] = useState<string>("");
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<Stats>({
    totalStudents: 0, totalTeachers: 0, teachersPresent: 0,
    studentsPresent: 0, activeClasses: 0, attendanceRate: 0,
  });

  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [teacherAtt, setTeacherAtt] = useState({ hadir: 0, izin: 0, sakit: 0, alfa: 0, belum: 0 });
  const [classAtt, setClassAtt] = useState<Array<{ name: string; total: number; hadir: number }>>([]);
  const [finance, setFinance] = useState({ totalTagihan: 0, totalPembayaran: 0, tunggakan: 0, saldoKas: 0, danaPending: 0 });
  const [settlements, setSettlements] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);

  // Approvals
  const [leaves, setLeaves] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/admin"); return; }
    if (!schoolId) { setLoading(false); return; }
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle().then(({ data }) => {
      if (data?.name) setSchoolName(data.name);
    });
    loadAll();
  }, [authLoading, user, schoolId]);

  const loadAll = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const today = todayStr();
      const dow = new Date().getDay();
      const hhmm = new Date().toTimeString().slice(0, 8);
      const monthAgo = format(subMonths(new Date(), 5), "yyyy-MM-dd");

      const [
        studentsQ, classesQ, teachersQ, teacherLogsQ, studentLogsQ,
        schedulesQ, subjectAttQ, invoicesQ, cashQ, setlAllQ,
        leavesQ, annQ, setlPendingQ, wdQ, holidaysQ, allInvoicesQ,
        allTeacherLogsQ, allStudentLogsQ, allCashQ
      ] = await Promise.all([
        supabase.from("students").select("id, class").eq("school_id", schoolId),
        supabase.from("classes").select("id, name").eq("school_id", schoolId),
        supabase.from("user_roles").select("user_id").eq("role", "teacher" as any),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type").eq("school_id", schoolId).eq("date", today),
        supabase.from("attendance_logs").select("student_id, status, attendance_type").eq("school_id", schoolId).eq("date", today),
        supabase.from("teaching_schedules").select("id, teacher_id, class_id, subject_id, start_time, end_time, day_of_week, is_active").eq("school_id", schoolId).eq("day_of_week", dow).eq("is_active", true),
        supabase.from("subject_attendance").select("teaching_schedule_id, status").eq("school_id", schoolId).eq("date", today),
        supabase.from("spp_invoices").select("total_amount, status, paid_at, created_at").eq("school_id", schoolId),
        supabase.from("cash_book_entries").select("direction, amount, entry_date, category, description, created_at").eq("school_id", schoolId).order("entry_date", { ascending: false }).limit(500),
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).order("requested_at", { ascending: false }).limit(10),
        supabase.from("parent_leave_requests").select("*, students(name, class)").eq("school_id", schoolId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
        supabase.from("school_announcements").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(20),
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).eq("status", "pending").order("requested_at", { ascending: false }),
        supabase.from("affiliate_withdrawals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("school_holidays").select("*").eq("school_id", schoolId).gte("date", format(startOfMonth(new Date()), "yyyy-MM-dd")).lte("date", format(endOfMonth(subMonths(new Date(), -1)), "yyyy-MM-dd")),
        supabase.from("spp_invoices").select("total_amount, paid_at, status, created_at").eq("school_id", schoolId).gte("created_at", monthAgo),
        supabase.from("teacher_attendance_logs").select("date, status").eq("school_id", schoolId).gte("date", monthAgo),
        supabase.from("attendance_logs").select("date, status").eq("school_id", schoolId).gte("date", monthAgo),
        supabase.from("cash_book_entries").select("entry_date, direction, amount").eq("school_id", schoolId).gte("entry_date", monthAgo),
      ]);

      const students = studentsQ.data || [];
      const classes = classesQ.data || [];
      const teacherIds = new Set((teachersQ.data || []).map((r: any) => r.user_id));

      // Filter teacher-role logs
      const teacherLogsAll = (teacherLogsQ.data || []).filter((l: any) => teacherIds.has(l.user_id));
      const teacherArrival = teacherLogsAll.filter((l: any) => (l.attendance_type ?? "datang") === "datang");
      const teacherHadir = teacherArrival.filter((l: any) => l.status === "hadir").length;
      const teacherIzin = teacherArrival.filter((l: any) => l.status === "izin").length;
      const teacherSakit = teacherArrival.filter((l: any) => l.status === "sakit").length;
      const teacherAlfa = teacherArrival.filter((l: any) => l.status === "alfa").length;
      const teacherBelum = Math.max(0, teacherIds.size - (teacherHadir + teacherIzin + teacherSakit + teacherAlfa));
      setTeacherAtt({ hadir: teacherHadir, izin: teacherIzin, sakit: teacherSakit, alfa: teacherAlfa, belum: teacherBelum });

      // Student attendance today
      const studentLogs = (studentLogsQ.data || []).filter((l: any) => (l.attendance_type ?? "datang") === "datang");
      const uniqStudentPresent = new Set(studentLogs.filter((l: any) => l.status === "hadir").map((l: any) => l.student_id)).size;
      const rate = students.length > 0 ? Math.round((uniqStudentPresent / students.length) * 100) : 0;

      // Class attendance summary
      const byClass: Record<string, { hadir: number; total: number }> = {};
      const classSize: Record<string, number> = {};
      students.forEach((s: any) => { classSize[s.class || "-"] = (classSize[s.class || "-"] || 0) + 1; });
      Object.keys(classSize).forEach(c => { byClass[c] = { hadir: 0, total: classSize[c] }; });
      studentLogs.forEach((l: any) => {
        // find student's class
        const st = students.find((s: any) => s.id === l.student_id);
        const cls = st?.class || "-";
        if (!byClass[cls]) byClass[cls] = { hadir: 0, total: classSize[cls] || 0 };
        if (l.status === "hadir") byClass[cls].hadir += 1;
      });
      setClassAtt(Object.entries(byClass).map(([name, v]) => ({ name, hadir: v.hadir, total: v.total })).sort((a, b) => a.name.localeCompare(b.name)));

      // Live classes now
      const schedules = schedulesQ.data || [];
      const subjectAtt = subjectAttQ.data || [];
      const liveNow = schedules.filter((s: any) => s.start_time <= hhmm && s.end_time > hhmm);
      const subjectIds = Array.from(new Set(schedules.map((s: any) => s.subject_id).filter(Boolean)));
      const classIds = Array.from(new Set(schedules.map((s: any) => s.class_id).filter(Boolean)));
      const teacherProfileIds = Array.from(new Set(schedules.map((s: any) => s.teacher_id).filter(Boolean)));

      const [subjMap, clsMap, tchMap] = await Promise.all([
        subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] as any[] }),
        classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] as any[] }),
        teacherProfileIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", teacherProfileIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const sMap = new Map((subjMap.data || []).map((x: any) => [x.id, x.name]));
      const cMap = new Map((clsMap.data || []).map((x: any) => [x.id, x.name]));
      const tMap = new Map((tchMap.data || []).map((x: any) => [x.user_id, x.full_name]));

      setLiveClasses(liveNow.map((s: any) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        const startMin = sh * 60 + sm, endMin = eh * 60 + em, curMin = now.getHours() * 60 + now.getMinutes();
        const progress = Math.min(100, Math.max(0, ((curMin - startMin) / (endMin - startMin)) * 100));
        const hadir = subjectAtt.filter((a: any) => a.teaching_schedule_id === s.id && a.status === "hadir").length;
        const className = cMap.get(s.class_id) || "-";
        const total = classSize[className] || 0;
        return {
          id: s.id,
          subject: sMap.get(s.subject_id) || "Pelajaran",
          teacher: tMap.get(s.teacher_id) || "-",
          className,
          hadir, total,
          startTime: s.start_time.slice(0, 5),
          endTime: s.end_time.slice(0, 5),
          progress,
        };
      }));

      // Active classes (today has active schedule)
      const activeClassIds = new Set(schedules.map((s: any) => s.class_id));

      setStats({
        totalStudents: students.length,
        totalTeachers: teacherIds.size,
        teachersPresent: teacherHadir,
        studentsPresent: uniqStudentPresent,
        activeClasses: activeClassIds.size,
        attendanceRate: rate,
      });

      // Finance
      const invoices = invoicesQ.data || [];
      const totalTagihan = invoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const totalPembayaran = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const tunggakan = invoices.filter((i: any) => i.status !== "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const cashEntries = cashQ.data || [];
      const saldoKas = cashEntries.reduce((s: number, e: any) => s + (e.direction === "in" ? (e.amount || 0) : -(e.amount || 0)), 0);
      const danaPending = (setlPendingQ.data || []).reduce((s: number, e: any) => s + (e.final_payout || 0), 0);
      setFinance({ totalTagihan, totalPembayaran, tunggakan, saldoKas, danaPending });
      setSettlements(setlAllQ.data || []);

      // Monthly chart (6 months)
      const months: Array<{ key: string; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: idLocale }) });
      }
      const invByMonth = new Map<string, number>();
      const teacherByMonth = new Map<string, number>();
      const studentByMonth = new Map<string, number>();
      const inByMonth = new Map<string, number>();
      const outByMonth = new Map<string, number>();
      (allInvoicesQ.data || []).forEach((i: any) => {
        if (i.status === "paid" && i.paid_at) {
          const k = i.paid_at.slice(0, 7);
          invByMonth.set(k, (invByMonth.get(k) || 0) + (i.total_amount || 0));
        }
      });
      (allTeacherLogsQ.data || []).forEach((l: any) => {
        if (l.status === "hadir") { const k = l.date.slice(0, 7); teacherByMonth.set(k, (teacherByMonth.get(k) || 0) + 1); }
      });
      (allStudentLogsQ.data || []).forEach((l: any) => {
        if (l.status === "hadir") { const k = l.date.slice(0, 7); studentByMonth.set(k, (studentByMonth.get(k) || 0) + 1); }
      });
      (allCashQ.data || []).forEach((e: any) => {
        const k = e.entry_date.slice(0, 7);
        if (e.direction === "in") inByMonth.set(k, (inByMonth.get(k) || 0) + (e.amount || 0));
        else outByMonth.set(k, (outByMonth.get(k) || 0) + (e.amount || 0));
      });
      setMonthly(months.map(m => ({
        month: m.label,
        Guru: teacherByMonth.get(m.key) || 0,
        Siswa: studentByMonth.get(m.key) || 0,
        SPP: invByMonth.get(m.key) || 0,
        Pendapatan: inByMonth.get(m.key) || 0,
        Pengeluaran: outByMonth.get(m.key) || 0,
      })));

      // Ranking
      const attByClass: Record<string, { hadir: number; total: number }> = {};
      (allStudentLogsQ.data || []).forEach((l: any) => {
        const st = students.find((s: any) => s.id === (l as any).student_id);
        if (!st) return;
        const cls = st.class || "-";
        if (!attByClass[cls]) attByClass[cls] = { hadir: 0, total: 0 };
        attByClass[cls].total += 1;
        if (l.status === "hadir") attByClass[cls].hadir += 1;
      });
      const rankArr = Object.entries(byClass).map(([name, v]) => ({
        name,
        attendance: v.total ? Math.round((v.hadir / v.total) * 100) : 0,
      })).sort((a, b) => b.attendance - a.attendance).slice(0, 10);
      setRanking(rankArr);

      // Calendar
      const cal = [
        ...(holidaysQ.data || []).map((h: any) => ({ date: h.date, label: h.label, type: "libur" })),
        ...(annQ.data || []).slice(0, 10).map((a: any) => ({ date: a.created_at.slice(0, 10), label: a.title, type: "agenda" })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      setCalendar(cal.slice(0, 15));

      // Approvals
      setLeaves(leavesQ.data || []);
      setAnnouncements((annQ.data || []).filter((a: any) => a.type === "draft" || a.type === "pending"));
      setPendingSettlements(setlPendingQ.data || []);
      setWithdrawals(wdQ.data || []);

      // Notifications
      const notifList: any[] = [];
      const totalApprovals = (leavesQ.data?.length || 0) + (setlPendingQ.data?.length || 0);
      if (totalApprovals > 0) notifList.push({ icon: ClipboardList, title: `${totalApprovals} Pengajuan Menunggu Persetujuan`, tone: "warning" });
      const classesWithoutAtt = classes.length - Object.keys(byClass).filter(c => byClass[c].hadir > 0).length;
      if (classesWithoutAtt > 0) notifList.push({ icon: AlertTriangle, title: `${classesWithoutAtt} kelas belum melakukan absensi hari ini`, tone: "warning" });
      const teachersWithoutJournal = teacherIds.size - new Set((subjectAttQ.data || []).map((a: any) => a.teaching_schedule_id)).size;
      if (teachersWithoutJournal > 0) notifList.push({ icon: BookOpen, title: `Beberapa guru belum mengisi jurnal hari ini`, tone: "info" });
      const paymentsToday = (invoicesQ.data || []).filter((i: any) => i.paid_at?.slice(0, 10) === today).length;
      if (paymentsToday > 0) notifList.push({ icon: DollarSign, title: `${paymentsToday} pembayaran SPP masuk hari ini`, tone: "success" });
      setNotifs(notifList);

      // Timeline
      const tl: any[] = [];
      (studentLogsQ.data || []).slice(0, 5).forEach((l: any) => tl.push({ icon: UserCheck, label: `Absensi siswa: ${l.status}`, at: l.created_at || today, tone: "primary" }));
      (invoicesQ.data || []).filter((i: any) => i.paid_at).slice(0, 5).forEach((i: any) => tl.push({ icon: DollarSign, label: `Pembayaran SPP ${fmtIDR(i.total_amount)}`, at: i.paid_at, tone: "success" }));
      (annQ.data || []).slice(0, 5).forEach((a: any) => tl.push({ icon: Megaphone, label: `Pengumuman: ${a.title}`, at: a.created_at, tone: "info" }));
      (cashEntries || []).slice(0, 5).forEach((c: any) => tl.push({ icon: Wallet, label: `Kas ${c.direction === "in" ? "Masuk" : "Keluar"}: ${fmtIDR(c.amount)}`, at: c.created_at, tone: c.direction === "in" ? "success" : "warning" }));
      (setlAllQ.data || []).slice(0, 3).forEach((s: any) => tl.push({ icon: TrendingUp, label: `Pencairan ${s.settlement_code} (${s.status})`, at: s.requested_at, tone: "info" }));
      tl.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      setTimeline(tl.slice(0, 20));

    } catch (e) {
      console.error("PrincipalDashboard load error", e);
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  const approveLeave = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("parent_leave_requests").update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Gagal memperbarui");
    toast.success(status === "approved" ? "Disetujui" : "Ditolak");
    setLeaves(l => l.filter(x => x.id !== id));
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const totalApprovals = leaves.length + pendingSettlements.length + withdrawals.length + announcements.length;

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title={`Dashboard Kepala Sekolah`}
        subtitle={`${schoolName || "Sekolah"} • ${format(now, "EEEE, d MMMM yyyy • HH:mm", { locale: idLocale })} WIB`}
        icon={SchoolIcon}
      />

      {/* B. Statistik Utama */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total Siswa" value={stats.totalStudents} tone="primary" />
        <StatCard icon={GraduationCap} label="Total Guru" value={stats.totalTeachers} tone="violet" />
        <StatCard icon={UserCheck} label="Guru Hadir" value={stats.teachersPresent} tone="emerald" />
        <StatCard icon={UserCheck} label="Siswa Hadir" value={stats.studentsPresent} tone="sky" />
        <StatCard icon={SchoolIcon} label="Kelas Aktif" value={stats.activeClasses} tone="amber" />
        <StatCard icon={Percent} label="% Kehadiran" value={`${stats.attendanceRate}%`} tone="rose" />
      </div>

      {/* Notifikasi + Approvals summary */}
      {(notifs.length > 0 || totalApprovals > 0) && (
        <Card className="border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifikasi Penting</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {notifs.map((n, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm p-2.5 rounded-xl bg-background/60 border border-border/50">
                <n.icon className={`h-4 w-4 shrink-0 ${n.tone === "success" ? "text-emerald-600" : n.tone === "warning" ? "text-amber-600" : "text-sky-600"}`} />
                <span className="text-foreground">{n.title}</span>
              </div>
            ))}
            {notifs.length === 0 && <div className="text-sm text-muted-foreground">Tidak ada notifikasi mendesak</div>}
          </CardContent>
        </Card>
      )}

      {/* C. Monitoring Realtime Pembelajaran */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Kelas Sedang Berlangsung</CardTitle>
          <CardDescription>Realtime jam pelajaran & progres</CardDescription>
        </CardHeader>
        <CardContent>
          {liveClasses.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Tidak ada kelas berlangsung saat ini</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveClasses.map(c => (
                <div key={c.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{c.subject}</span>
                    <Badge variant="secondary" className="text-[10px]">{c.startTime}-{c.endTime}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.className} • {c.teacher}</div>
                  <Progress value={c.progress} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Hadir</span>
                    <span className="font-semibold">{c.hadir}/{c.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. Monitoring Kehadiran */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Kehadiran Guru Hari Ini</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-5 gap-2">
            {[
              { k: "Hadir", v: teacherAtt.hadir, tone: "emerald" },
              { k: "Izin", v: teacherAtt.izin, tone: "sky" },
              { k: "Sakit", v: teacherAtt.sakit, tone: "amber" },
              { k: "Alfa", v: teacherAtt.alfa, tone: "rose" },
              { k: "Belum", v: teacherAtt.belum, tone: "slate" },
            ].map(x => (
              <div key={x.k} className="text-center p-3 rounded-xl bg-muted/40">
                <div className="text-2xl font-bold">{x.v}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{x.k}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Kehadiran Siswa per Kelas</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {classAtt.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Belum ada data</div>}
              {classAtt.map(c => {
                const pct = c.total ? Math.round((c.hadir / c.total) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3 text-xs">
                    <span className="w-16 font-medium">{c.name}</span>
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="w-16 text-right text-muted-foreground">{c.hadir}/{c.total} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* E. Keuangan */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Keuangan Sekolah</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FinanceCard label="Total Tagihan" value={fmtIDR(finance.totalTagihan)} icon={DollarSign} />
            <FinanceCard label="Total Pembayaran" value={fmtIDR(finance.totalPembayaran)} icon={TrendingUp} tone="emerald" />
            <FinanceCard label="Tunggakan" value={fmtIDR(finance.tunggakan)} icon={TrendingDown} tone="rose" />
            <FinanceCard label="Saldo Buku Kas" value={fmtIDR(finance.saldoKas)} icon={Wallet} tone="sky" />
            <FinanceCard label="Menunggu Pencairan" value={fmtIDR(finance.danaPending)} icon={Clock} tone="amber" />
          </div>
          <div className="mt-5">
            <div className="text-sm font-semibold mb-2">Riwayat Settlement Terbaru</div>
            {settlements.length === 0 ? (
              <div className="text-xs text-muted-foreground">Belum ada settlement</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {settlements.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-border/50 bg-background/60">
                    <div className="flex flex-col">
                      <span className="font-mono font-semibold">{s.settlement_code}</span>
                      <span className="text-muted-foreground">{s.bank_name} • {format(new Date(s.requested_at), "d MMM yyyy", { locale: idLocale })}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{fmtIDR(s.final_payout)}</div>
                      <Badge variant={s.status === "paid" ? "default" : s.status === "pending" ? "secondary" : "outline"} className="text-[10px]">{s.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* F. Approval Center */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Approval Center</CardTitle>
          <CardDescription>{totalApprovals} pengajuan menunggu tinjauan</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="leaves">
            <TabsList className="mb-3">
              <TabsTrigger value="leaves">Izin Siswa ({leaves.length})</TabsTrigger>
              <TabsTrigger value="settlements">Pencairan SPP ({pendingSettlements.length})</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdraw Afiliasi ({withdrawals.length})</TabsTrigger>
              <TabsTrigger value="announcements">Pengumuman ({announcements.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="leaves" className="space-y-2">
              {leaves.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Tidak ada pengajuan izin</div>}
              {leaves.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{l.students?.name || "Siswa"} • {l.students?.class || "-"}</div>
                    <div className="text-xs text-muted-foreground">{l.type} • {l.date} • {l.reason}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => approveLeave(l.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Tolak</Button>
                    <Button size="sm" onClick={() => approveLeave(l.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Setujui</Button>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="settlements" className="space-y-2">
              {pendingSettlements.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Tidak ada pencairan menunggu</div>}
              {pendingSettlements.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 gap-3">
                  <div>
                    <div className="text-sm font-semibold">{s.settlement_code} • {fmtIDR(s.final_payout)}</div>
                    <div className="text-xs text-muted-foreground">{s.bank_name} • {s.account_number}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate("/bendahara/settlement")}>Kelola <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="withdrawals" className="space-y-2">
              {withdrawals.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Tidak ada withdrawal</div>}
              {withdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60">
                  <div>
                    <div className="text-sm font-semibold">{fmtIDR(w.amount)}</div>
                    <div className="text-xs text-muted-foreground">{w.bank_name} • {w.account_holder}</div>
                  </div>
                  <Badge variant="secondary">{w.status}</Badge>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="announcements" className="space-y-2">
              {announcements.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Tidak ada pengumuman menunggu</div>}
              {announcements.map(a => (
                <div key={a.id} className="p-3 rounded-xl border border-border/60">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.target_audience || "semua"}</div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* G. Grafik Bulanan */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Absensi Bulanan (Guru & Siswa)</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Guru" fill="#5B6CF9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Siswa" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Keuangan Bulanan</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <RTooltip formatter={(v: any) => fmtIDR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="SPP" stroke="#5B6CF9" strokeWidth={2} />
                <Line type="monotone" dataKey="Pendapatan" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* I. Ranking + J. Kalender */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Ranking Kelas (Kehadiran)</CardTitle></CardHeader>
          <CardContent>
            {ranking.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Belum ada data</div>}
            <div className="space-y-1.5">
              {ranking.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3 text-xs">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <span className="flex-1 font-medium">{r.name}</span>
                  <Progress value={r.attendance} className="h-1.5 w-24" />
                  <span className="w-10 text-right font-semibold">{r.attendance}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Kalender Kegiatan</CardTitle></CardHeader>
          <CardContent>
            {calendar.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Belum ada agenda</div>}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {calendar.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl border border-border/50">
                  <div className="text-center shrink-0 w-14">
                    <div className="text-[10px] uppercase text-muted-foreground">{format(new Date(c.date), "MMM", { locale: idLocale })}</div>
                    <div className="text-lg font-bold leading-none">{format(new Date(c.date), "d")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.label}</div>
                    <Badge variant="outline" className="text-[10px] mt-0.5">{c.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* K. Timeline + L. Quick Reports */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Aktivitas Terbaru</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas</div>}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-sm p-2 rounded-xl hover:bg-muted/40">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${t.tone === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : t.tone === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20" : t.tone === "info" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20" : "bg-primary/10 text-primary"}`}>
                    <t.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground">{t.at ? format(new Date(t.at), "d MMM yyyy • HH:mm", { locale: idLocale }) : "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Laporan Cepat</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <QuickReportBtn label="Rekap Absensi Siswa" onClick={() => navigate("/laporan-absensi/siswa")} />
            <QuickReportBtn label="Rekap Absensi Guru" onClick={() => navigate("/laporan-absensi/guru")} />
            <QuickReportBtn label="Rekap SPP" onClick={() => navigate("/bendahara/transaksi")} />
            <QuickReportBtn label="Buku Kas" onClick={() => navigate("/bendahara/buku-kas")} />
            <QuickReportBtn label="Settlement" onClick={() => navigate("/bendahara/settlement")} />
            <QuickReportBtn label="Jurnal Mengajar" onClick={() => navigate("/mapel/laporan")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
  };
  return (
    <Card className={`rounded-2xl bg-gradient-to-br ${tones[tone]} border-border/50`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function FinanceCard({ icon: Icon, label, value, tone = "primary" }: { icon: any; label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    emerald: "text-emerald-600 bg-emerald-500/10",
    rose: "text-rose-600 bg-rose-500/10",
    sky: "text-sky-600 bg-sky-500/10",
    amber: "text-amber-600 bg-amber-500/10",
  };
  return (
    <div className="p-3 rounded-xl border border-border/50 bg-card">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tones[tone]} mb-2`}><Icon className="h-4 w-4" /></div>
      <div className="text-sm font-bold text-foreground truncate">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function QuickReportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-sm">
      <span className="flex items-center gap-2"><Download className="h-3.5 w-3.5 text-muted-foreground" /> {label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
