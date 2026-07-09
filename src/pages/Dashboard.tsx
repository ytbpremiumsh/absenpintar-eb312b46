import { useEffect, useState, useCallback } from "react";
// ProductTour disabled per user request
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, GraduationCap, TrendingUp, AlertTriangle, ChevronRight, QrCode, School, BarChart3, Zap, Users, Crown, X, Sparkles, CalendarOff, Copy, Info, LogIn } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LiveScheduleWidget } from "@/components/dashboard/LiveScheduleWidget";
// SchoolAnnouncementsWidget removed from main attendance dashboard
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

import { getLocalDateString } from "@/lib/dateLocal";
import { fetchSchoolHolidayStatus, type HolidayStatus } from "@/lib/schoolHoliday";
import { buildTenantUrl, useTenant } from "@/lib/tenant";

const STATUS_COLORS: Record<string, string> = {
  hadir: "hsl(152, 69%, 40%)",
  izin: "hsl(38, 92%, 50%)",
  sakit: "hsl(210, 70%, 50%)",
  alfa: "hsl(0, 72%, 51%)",
};

const STATUS_LABELS: Record<string, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alfa: "Alfa",
};

interface StudentData {
  id: string;
  name: string;
  class: string;
  parent_name: string;
  photo_url: string | null;
}

// TrialCountdownBanner removed — trial system deprecated.

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const Dashboard = () => {
  const { profile } = useAuth();
  const subFeatures = useSubscriptionFeatures();
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [waliKelasList, setWaliKelasList] = useState<{ name: string; class_name: string }[]>([]);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [periodLogs, setPeriodLogs] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayStatus, setHolidayStatus] = useState<HolidayStatus>({ isHoliday: false, reason: null, mode: false, modeLabel: null });
  const [holidayToggling, setHolidayToggling] = useState(false);
  const [showLoginInfo, setShowLoginInfo] = useState(() => localStorage.getItem("dismissed_login_info") !== "1");
  const tenant = useTenant();
  const navigate = useNavigate();


  const fetchData = useCallback(async () => {
    if (!profile?.school_id) { setLoading(false); return; }
    const schoolId = profile.school_id;
    const today = getLocalDateString("Asia/Jakarta");

    const [studentsRes, logsRes, classesRes, waliRes] = await Promise.all([
      supabase.from("students").select("id, name, class, parent_name, photo_url").eq("school_id", schoolId),
      supabase.from("attendance_logs").select("*").eq("school_id", schoolId).eq("date", today).eq("attendance_type", "datang").neq("method", "auto").order("created_at", { ascending: false }),
      supabase.from("classes").select("id").eq("school_id", schoolId),
      supabase.from("class_teachers").select("class_name, user_id").eq("school_id", schoolId),
    ]);

    const allStudents = studentsRes.data || [];
    setStudents(allStudents);
    setTotalStudents(allStudents.length);
    setTotalClasses((classesRes.data || []).length);
    setTodayLogs(logsRes.data || []);

    // Fetch wali kelas profiles
    const waliData = waliRes.data || [];
    if (waliData.length > 0) {
      const userIds = waliData.map(w => w.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      setWaliKelasList(waliData.map(w => ({ name: profileMap.get(w.user_id) || "—", class_name: w.class_name })).sort((a, b) => a.class_name.localeCompare(b.class_name)));
    } else {
      setWaliKelasList([]);
    }

    // Fetch holiday status (mode + weekly + calendar)
    fetchSchoolHolidayStatus(schoolId).then((status) => {
      setHolidayStatus(status);
      setHolidayMode(status.mode);
    });

    setLoading(false);
  }, [profile?.school_id]);

  const toggleHolidayMode = async (val: boolean) => {
    if (!profile?.school_id) return;
    setHolidayToggling(true);
    const { error } = await supabase.from("schools").update({
      holiday_mode: val,
      holiday_mode_label: val ? "Hari Libur" : null,
    } as any).eq("id", profile.school_id);
    setHolidayToggling(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayMode(val);
    if (profile.school_id) fetchSchoolHolidayStatus(profile.school_id).then(setHolidayStatus);
    toast.success(val ? "Mode libur aktif — absensi ditangguhkan" : "Mode libur dinonaktifkan");
  };

  const fetchPeriodLogs = useCallback(async () => {
    if (!profile?.school_id) return;
    const todayStr = getLocalDateString("Asia/Jakarta");
    const [ty, tm, td] = todayStr.split("-").map(Number);
    let fromDate: string;

    if (chartPeriod === "daily") {
      fromDate = todayStr;
    } else if (chartPeriod === "weekly") {
      const localToday = new Date(ty, tm - 1, td);
      const dayOfWeek = localToday.getDay();
      const monday = new Date(localToday);
      monday.setDate(localToday.getDate() - ((dayOfWeek + 6) % 7));
      fromDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    } else {
      fromDate = `${ty}-${String(tm).padStart(2, "0")}-01`;
    }

    const { data } = await supabase
      .from("attendance_logs")
      .select("date, status, method")
      .eq("school_id", profile.school_id)
      .eq("attendance_type", "datang")
      .gte("date", fromDate)
      .order("date");

    // Sembunyikan record auto-system untuk HARI BERJALAN — datanya belum final.
    // Untuk tanggal sebelumnya, record auto-Alfa tetap dihitung sebagai data historis.
    const filtered = (data || []).filter((l: any) => !(l.date === todayStr && l.method === "auto"));
    setPeriodLogs(filtered);
  }, [profile?.school_id, chartPeriod]);

  // Trial popup removed — trial system deprecated.

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => { fetchData(); fetchPeriodLogs(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, fetchPeriodLogs]);

  useEffect(() => { fetchPeriodLogs(); }, [fetchPeriodLogs]);

  const statusCounts = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
  todayLogs.forEach((log) => {
    const s = log.status as keyof typeof statusCounts;
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });
  const totalAbsen = todayLogs.length;
  const belumAbsen = totalStudents - totalAbsen;
  const attendancePercent = totalStudents > 0 ? Math.round((statusCounts.hadir / totalStudents) * 100) : 0;

  const statCards = [
    { label: "TOTAL KELAS", value: totalClasses, desc: "kelas terdaftar", icon: School, iconBg: "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "SISWA TERDAFTAR", value: totalStudents, desc: "total siswa aktif", icon: GraduationCap, iconBg: "bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40", iconColor: "text-indigo-600 dark:text-indigo-400" },
    { label: "HADIR HARI INI", value: statusCounts.hadir, desc: `${totalStudents > 0 ? Math.round((statusCounts.hadir / totalStudents) * 100) : 0}% kehadiran`, icon: TrendingUp, iconBg: "bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/40", iconColor: "text-sky-600 dark:text-sky-400" },
    { label: "BELUM / ALFA", value: statusCounts.alfa + belumAbsen, desc: `${statusCounts.alfa} alfa, ${belumAbsen} belum`, icon: AlertTriangle, iconBg: "bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40", iconColor: "text-red-600 dark:text-red-400" },
  ];

  const quickActions = [
    { label: "Scan Absensi", desc: "Scan QR / Barcode", icon: QrCode, bg: "bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30", iconColor: "text-indigo-600 dark:text-indigo-400", path: "/scan" },
    { label: "Data Siswa", desc: "Kelola daftar siswa", icon: GraduationCap, bg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30", iconColor: "text-emerald-600 dark:text-emerald-400", path: "/students" },
    { label: "Rekap Absensi", desc: "Export rekap bulanan", icon: BarChart3, bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30", iconColor: "text-amber-600 dark:text-amber-400", path: "/export-history" },
    { label: "Pengaturan", desc: "Konfigurasi sekolah", icon: Zap, bg: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30", iconColor: "text-blue-600 dark:text-blue-400", path: "/school-settings" },
  ];

  // Chart data
  const chartData = (() => {
    if (chartPeriod === "daily") {
      const hourly: Record<string, { hadir: number; izin: number; sakit: number; alfa: number }> = {};
      todayLogs.forEach((log) => {
        const hour = log.time?.slice(0, 2) || "00";
        const label = `${hour}:00`;
        if (!hourly[label]) hourly[label] = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        const s = log.status as keyof typeof statusCounts;
        if (hourly[label][s] !== undefined) hourly[label][s]++;
      });
      return Object.entries(hourly).sort(([a], [b]) => a.localeCompare(b)).map(([name, counts]) => ({ name, ...counts }));
    }

    const grouped: Record<string, { hadir: number; izin: number; sakit: number; alfa: number }> = {};
    periodLogs.forEach((log) => {
      if (!grouped[log.date]) grouped[log.date] = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      const s = log.status as keyof typeof statusCounts;
      if (grouped[log.date][s] !== undefined) grouped[log.date][s]++;
    });

    if (chartPeriod === "weekly") {
      const todayStr = getLocalDateString("Asia/Jakarta");
      const [ty, tm, td] = todayStr.split("-").map(Number);
      const localToday = new Date(ty, tm - 1, td);
      const dayOfWeek = localToday.getDay();
      const monday = new Date(localToday);
      monday.setDate(localToday.getDate() - ((dayOfWeek + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const counts = grouped[dateStr] || { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        return { name: DAY_NAMES[d.getDay()], ...counts };
      });
    }

    const todayStr = getLocalDateString("Asia/Jakarta");
    const [ty, tm] = todayStr.split("-").map(Number);
    const daysInMonth = new Date(ty, tm, 0).getDate();
    const result: { name: string; hadir: number; izin: number; sakit: number; alfa: number }[] = [];
    for (let week = 0; week < Math.ceil(daysInMonth / 7); week++) {
      const weekData = { name: `Mg ${week + 1}`, hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      for (let d = week * 7 + 1; d <= Math.min((week + 1) * 7, daysInMonth); d++) {
        const dateStr = `${ty}-${String(tm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const counts = grouped[dateStr];
        if (counts) { weekData.hadir += counts.hadir; weekData.izin += counts.izin; weekData.sakit += counts.sakit; weekData.alfa += counts.alfa; }
      }
      result.push(weekData);
    }
    return result;
  })();

  const pieData = [
    { name: "Hadir", value: statusCounts.hadir, key: "hadir" },
    { name: "Izin", value: statusCounts.izin, key: "izin" },
    { name: "Sakit", value: statusCounts.sakit, key: "sakit" },
    { name: "Alfa", value: statusCounts.alfa, key: "alfa" },
    { name: "Belum", value: belumAbsen, key: "belum" },
  ].filter(d => d.value > 0);

  const PIE_COLORS = [STATUS_COLORS.hadir, STATUS_COLORS.izin, STATUS_COLORS.sakit, STATUS_COLORS.alfa, "hsl(220, 10%, 75%)"];

  const getStudentsForStatus = (status: string) => {
    if (status === "belum") {
      const loggedStudentIds = new Set(todayLogs.map(l => l.student_id));
      return students.filter(s => !loggedStudentIds.has(s.id));
    }
    const studentIds = todayLogs.filter(l => l.status === status).map(l => l.student_id);
    return students.filter(s => studentIds.includes(s.id));
  };

  const handlePieClick = (_: any, index: number) => {
    const item = pieData[index];
    if (item) setSelectedStatus(item.key);
  };

  const getStudentName = (log: any) => students.find(s => s.id === log.student_id)?.name || "Siswa";
  const getStudentClass = (log: any) => students.find(s => s.id === log.student_id)?.class || "";

  const now = new Date();
  const periodTitle = chartPeriod === "daily" ? "Hari Ini" : chartPeriod === "weekly" ? "Minggu Ini" : "Bulan Ini";
  const selectedStudents = selectedStatus ? getStudentsForStatus(selectedStatus) : [];
  const selectedLabel = selectedStatus ? (selectedStatus === "belum" ? "Belum Absen" : STATUS_LABELS[selectedStatus] || selectedStatus) : "";
  const selectedColor = selectedStatus ? (selectedStatus === "belum" ? "hsl(220, 10%, 75%)" : STATUS_COLORS[selectedStatus]) : "";


  return (
    <MotionConfig transition={{ duration: 0 }}>
    <div className="no-motion space-y-6">
      {/* Holiday Banner */}
      {holidayStatus.isHoliday && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-300/30 flex items-center justify-center shrink-0">
                <CalendarOff className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Sedang dalam Mode Libur — Absensi Ditangguhkan</p>
                <p className="text-[11px] sm:text-xs text-amber-700/90 dark:text-amber-300/80 mt-0.5">{holidayStatus.reason}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/holidays")} className="hidden sm:inline-flex h-7 text-xs rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
                Kelola
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Header */}
      <PageHeader
        icon={TrendingUp}
        title="Dashboard Absensi"
        subtitle={now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-2xl font-bold">{attendancePercent}%</p>
              <p className="text-[11px] text-white/70">Kehadiran</p>
            </div>
            {/* Tombol Scan disembunyikan di mobile karena sudah ada di footer */}
            <Button onClick={() => navigate("/scan")} className="hidden sm:inline-flex bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-sm border border-white/20">
              <QrCode className="h-4 w-4 mr-2" />
              Scan
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        }
      />

      



      {/* Login URL Info — helps admin share the right link to guru/wali kelas & wali murid */}
      {showLoginInfo && tenant.slug && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-violet-950/20 dark:border-indigo-800/40 shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5 relative">
              <button
                onClick={() => { setShowLoginInfo(false); localStorage.setItem("dismissed_login_info", "1"); }}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-300/30 flex items-center justify-center shrink-0">
                  <Info className="h-4 w-4 text-white" />
                </div>
                <div className="pr-6">
                  <p className="font-semibold text-sm text-foreground">Bagikan link login yang tepat</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Setiap sekolah punya URL login sendiri. Gunakan link di bawah agar guru, staf, dan orang tua tidak salah masuk.
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-white/70 dark:bg-slate-900/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    <LogIn className="h-3 w-3" /> Admin & Guru
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono break-all text-foreground flex-1">{buildTenantUrl(tenant.slug, "/admin")}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(buildTenantUrl(tenant.slug!, "/admin")); toast.success("Link Admin/Guru disalin"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-white/70 dark:bg-slate-900/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    <Users className="h-3 w-3" /> Wali Murid
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono break-all text-foreground flex-1">{buildTenantUrl(tenant.slug, "/login")}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(buildTenantUrl(tenant.slug!, "/login")); toast.success("Link Wali Murid disalin"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}


      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <div key={s.label}>
            <Card className="rounded-2xl border border-border/60 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground tracking-wider uppercase">{s.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{loading ? "..." : s.value}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                  <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${s.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Statistik Kehadiran — {periodTitle}
              </CardTitle>
              <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as any)}>
                <TabsList className="h-8 bg-muted/60 rounded-xl">
                  <TabsTrigger value="daily" className="text-xs px-2.5 h-6 rounded-lg">Harian</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs px-2.5 h-6 rounded-lg">Mingguan</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs px-2.5 h-6 rounded-lg">Bulanan</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [`${value} siswa`, STATUS_LABELS[name] || name]}
                  />
                  <Line type="monotone" dataKey="hadir" stroke={STATUS_COLORS.hadir} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} name="hadir" />
                  <Line type="monotone" dataKey="izin" stroke={STATUS_COLORS.izin} strokeWidth={2} dot={{ r: 3 }} name="izin" />
                  <Line type="monotone" dataKey="sakit" stroke={STATUS_COLORS.sakit} strokeWidth={2} dot={{ r: 3 }} name="sakit" />
                  <Line type="monotone" dataKey="alfa" stroke={STATUS_COLORS.alfa} strokeWidth={2} dot={{ r: 3 }} name="alfa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                  <span className="text-muted-foreground font-medium">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              Status Kehadiran
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Klik bagian pie untuk detail</p>
          </CardHeader>
          <CardContent>
            <div className="h-40 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" onClick={handlePieClick} cursor="pointer">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} siswa`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => setSelectedStatus(key)} className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity cursor-pointer">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                  <span className="font-medium">{label} ({statusCounts[key as keyof typeof statusCounts]})</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Schedule - placed below Status Kehadiran */}
      {profile?.school_id && (
        <LiveScheduleWidget schoolId={profile.school_id} />
      )}

      {/* Student List Dialog */}
      <Dialog open={!!selectedStatus} onOpenChange={(open) => { if (!open) setSelectedStatus(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="p-4 pb-3 border-b border-border" style={{ backgroundColor: `${selectedColor}15` }}>
            <div className="flex items-center gap-3 pr-8">
              <Badge className="text-lg font-bold shrink-0 h-9 w-9 rounded-full flex items-center justify-center p-0" style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}>{selectedStudents.length}</Badge>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold truncate" style={{ color: selectedColor }}>{selectedLabel}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">{selectedStudents.length} siswa • Hari ini</DialogDescription>
              </div>
            </div>
          </div>
          <ScrollArea className="max-h-[60vh]">
            {selectedStudents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada siswa</div>
            ) : (
              <div className="divide-y divide-border">
                {selectedStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden" style={{ backgroundColor: `${selectedColor}15`, color: selectedColor }}>
                      {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full rounded-full object-cover" /> : s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">Kelas {s.class}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Recent Attendance */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Absensi Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {todayLogs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada absensi hari ini</p>
          )}
          {todayLogs.slice(0, 10).map((log, idx) => {
            const studentName = getStudentName(log);
            const studentClass = getStudentClass(log);
            const status = log.status as string;
            const statusColor = STATUS_COLORS[status] || STATUS_COLORS.hadir;
            return (
              <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden shadow-sm"
                  style={{ backgroundColor: statusColor }}>
                  {students.find(s => s.id === log.student_id)?.photo_url ? (
                    <img src={students.find(s => s.id === log.student_id)!.photo_url!} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : studentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{studentName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {studentClass && `Kelas ${studentClass} • `}
                    {log.method === "face_recognition" ? "Face Recognition" : log.method === "rfid" ? "Kartu RFID" : "Barcode"} • {log.recorded_by || "System"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={`text-[10px] font-semibold border-0 rounded-full px-2.5 py-0.5 text-white ${
                    status === "hadir" ? "bg-emerald-500" :
                    status === "izin" ? "bg-amber-500" :
                    status === "sakit" ? "bg-sky-500" :
                    status === "alfa" ? "bg-red-500" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {STATUS_LABELS[status] || status}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{log.time?.slice(0, 5)}</p>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

    </div>
    </MotionConfig>
  );
};

export default Dashboard;
