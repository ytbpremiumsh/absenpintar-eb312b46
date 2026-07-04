import { useEffect, useState, useCallback } from "react";
// ProductTour disabled per user request
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, GraduationCap, TrendingUp, AlertTriangle, ChevronRight, QrCode, School, BarChart3, Zap, Users, Crown, X, Sparkles, CalendarOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LiveScheduleWidget } from "@/components/dashboard/LiveScheduleWidget";
// SchoolAnnouncementsWidget removed from main attendance dashboard
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { getLocalDateString } from "@/lib/dateLocal";

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

const TrialCountdownBanner = ({ trialDaysLeft, expiresAt, onUpgrade }: { trialDaysLeft: number; expiresAt: string | null; onUpgrade: () => void }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const totalHours = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / (1000 * 60 * 60))) : 0;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  // Progress: assume 14 day trial max
  const totalTrialMs = 14 * 24 * 60 * 60 * 1000;
  const remainingMs = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const progressPct = Math.round((remainingMs / totalTrialMs) * 100);
  const isUrgent = trialDaysLeft <= 3;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`border shadow-sm overflow-hidden ${isUrgent ? "border-orange-300/50 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 dark:border-orange-800/40" : "border-violet-200/50 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 dark:border-violet-800/40"}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? "bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-300/30" : "bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-violet-300/30"}`}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className={`text-xs sm:text-sm font-bold ${isUrgent ? "text-orange-700 dark:text-orange-300" : "text-violet-700 dark:text-violet-300"}`}>
                  Trial Premium — {days} hari {hours} jam tersisa
                </p>
                <Button size="sm" variant="outline" className={`shrink-0 text-[10px] sm:text-xs h-6 sm:h-7 rounded-lg ${isUrgent ? "border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300" : "border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300"}`} onClick={onUpgrade}>
                  Upgrade
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progressPct} className={`h-1.5 flex-1 ${isUrgent ? "[&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-amber-500 bg-orange-200/50 dark:bg-orange-900/30" : "[&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-500 bg-violet-200/50 dark:bg-violet-900/30"}`} />
                <span className={`text-[10px] font-medium tabular-nums ${isUrgent ? "text-orange-600 dark:text-orange-400" : "text-violet-600 dark:text-violet-400"}`}>{progressPct}%</span>
              </div>
              <p className={`text-[10px] ${isUrgent ? "text-orange-600/80 dark:text-orange-400/70" : "text-violet-600/70 dark:text-violet-400/60"}`}>
                {isUrgent ? "Segera upgrade agar fitur tetap aktif!" : "Nikmati semua fitur premium secara gratis."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const Dashboard = () => {
  const { profile } = useAuth();
  const subFeatures = useSubscriptionFeatures();
  const [showTrialPopup, setShowTrialPopup] = useState(false);
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
  const [holidayToggling, setHolidayToggling] = useState(false);
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

    // Fetch holiday_mode
    supabase.from("schools").select("holiday_mode").eq("id", schoolId).single().then(({ data }) => {
      if (data) setHolidayMode(!!(data as any).holiday_mode);
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

  // Show trial popup on first load if user is on trial
  useEffect(() => {
    if (!subFeatures.loading && subFeatures.isTrial && subFeatures.trialDaysLeft !== null) {
      const dismissed = sessionStorage.getItem('trial_popup_dismissed');
      if (!dismissed) setShowTrialPopup(true);
    }
  }, [subFeatures.loading, subFeatures.isTrial, subFeatures.trialDaysLeft]);

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
    <div className="space-y-6">
      <AnimatePresence>
        {showTrialPopup && subFeatures.isTrial && subFeatures.trialDaysLeft !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { setShowTrialPopup(false); sessionStorage.setItem('trial_popup_dismissed', '1'); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <button onClick={() => { setShowTrialPopup(false); sessionStorage.setItem('trial_popup_dismissed', '1'); }} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Masa Trial Aktif!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Anda sedang dalam masa <span className="font-semibold text-primary">Trial Premium</span> selama{" "}
                <span className="font-bold text-foreground">{subFeatures.trialDaysLeft} hari lagi</span>.
                Nikmati semua fitur premium secara gratis!
              </p>
              {subFeatures.trialDaysLeft <= 3 && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-xs text-warning font-medium">
                  Masa trial hampir berakhir! Upgrade sekarang agar fitur tetap aktif.
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowTrialPopup(false); sessionStorage.setItem('trial_popup_dismissed', '1'); }}>
                  Nanti
                </Button>
                <Button className="flex-1 gradient-primary text-primary-foreground" onClick={() => { setShowTrialPopup(false); sessionStorage.setItem('trial_popup_dismissed', '1'); navigate("/subscription"); }}>
                  <Crown className="h-4 w-4 mr-1" /> Lihat Paket
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trial Banner */}
      {subFeatures.isTrial && subFeatures.trialDaysLeft !== null && (
        <TrialCountdownBanner trialDaysLeft={subFeatures.trialDaysLeft} expiresAt={subFeatures.trialExpiresAt} onUpgrade={() => navigate("/subscription")} />
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
            {/* Holiday Mode Toggle */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 border shadow-sm cursor-pointer transition-colors ${holidayMode ? "bg-amber-500/90 border-amber-300/60" : "bg-white/15 hover:bg-white/25 border-white/20"}`}
              onClick={() => navigate("/holidays")}
              title="Kelola Mode Libur & Tanggal Merah"
            >
              <CalendarOff className="h-4 w-4 text-white" />
              <div className="hidden sm:block leading-tight">
                <p className="text-[10px] text-white/75 font-medium">Mode Libur</p>
                <p className="text-[11px] text-white font-bold">{holidayMode ? "AKTIF" : "Nonaktif"}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch checked={holidayMode} disabled={holidayToggling} onCheckedChange={toggleHolidayMode} />
              </div>
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
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
          </motion.div>
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
  );
};

export default Dashboard;
