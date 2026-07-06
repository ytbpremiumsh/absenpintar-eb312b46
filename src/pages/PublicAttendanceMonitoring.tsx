import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck, Clock, Users, GraduationCap, Activity, AlertTriangle,
  Thermometer, FileText, School, LogIn, LogOut,
  Maximize, Minimize, Camera, CameraOff, Volume2, VolumeX,
  Sun, Moon, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import PublicAttendanceScanner from "@/components/PublicAttendanceScanner";
import { announceAttendance } from "@/lib/announceAttendance";

const STATUS_LABELS: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa", belum: "Belum" };

interface LiveEntry {
  id: string; student_name: string; student_class: string; student_id: string;
  photo_url: string | null; status: string; method: string; time: string; created_at: string;
}

interface AttendanceData {
  school: { name: string; logo: string | null };
  classes: Record<string, { id: string; name: string; student_id: string; photo_url: string | null; status: string; time: string | null; method: string | null }[]>;
  liveFeed: (LiveEntry & { attendance_type?: string })[];
  stats: { total: number; hadir: number; izin: number; sakit: number; alfa: number; belum: number };
  date: string;
  currentMode?: string;
  pulangStats?: { total: number; recorded: number };
  timeSettings?: { attStart: string; attEnd: string; depStart: string; depEnd: string };
  canFaceRecognition?: boolean;
}

const LiveDot = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
  </span>
);

const PublicAttendanceMonitoring = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [realtimeClock, setRealtimeClock] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);

  // Real-time clock - updates every second
  useEffect(() => {
    const timer = setInterval(() => setRealtimeClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-attendance?school_id=${schoolId}`;
      const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      const json = await res.json();
      if (json.error) return;

      if (!initialLoad.current && json.liveFeed?.length > 0) {
        const newEntry = json.liveFeed.find((e: LiveEntry) => !prevLogIds.current.has(e.id));
        if (newEntry) {
          setNewEntryId(newEntry.id);
          setTimeout(() => setNewEntryId(null), 4000);
          if (soundEnabled) {
            const type = (newEntry as any).attendance_type === "pulang" ? "pulang" : "datang";
            announceAttendance(newEntry.student_name, newEntry.student_class, type, newEntry.status);
          }
        }
      }
      initialLoad.current = false;
      prevLogIds.current = new Set(json.liveFeed?.map((e: LiveEntry) => e.id) || []);
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, soundEnabled]);
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    const channel = supabase
      .channel("public-attendance-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, () => fetchData())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [schoolId, fetchData]);

  // Theme classes
  const theme = darkMode ? {
    bg: "bg-slate-950",
    headerBg: "bg-slate-900/90 border-slate-800",
    cardBg: "bg-slate-900/60 ring-slate-800",
    text: "text-white",
    textSecondary: "text-slate-400",
    textMuted: "text-slate-500",
    feedBg: "bg-slate-900/60 ring-slate-800",
    feedItemHover: "hover:bg-slate-800/50",
    newEntryBg: "bg-emerald-500/10 ring-emerald-500/20",
    classBg: "bg-slate-900/60 ring-slate-800",
    classDoneBg: "bg-emerald-500/5 ring-emerald-500/20",
    progressBg: "bg-slate-800",
    footerBorder: "border-slate-800",
  } : {
    bg: "bg-white",
    headerBg: "bg-white/90 border-border/60 shadow-sm",
    cardBg: "bg-white ring-border/40 shadow-sm",
    text: "text-foreground",
    textSecondary: "text-muted-foreground",
    textMuted: "text-muted-foreground/60",
    feedBg: "bg-white ring-border/40 shadow-sm",
    feedItemHover: "hover:bg-muted/40",
    newEntryBg: "bg-emerald-50 ring-emerald-200",
    classBg: "bg-white ring-border/40 shadow-sm",
    classDoneBg: "bg-emerald-50 ring-emerald-200 shadow-md",
    progressBg: "bg-muted",
    footerBorder: "border-border/40",
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center mx-auto shadow-xl">
            <School className="h-8 w-8 text-white" />
          </motion.div>
          <p className={`text-sm ${theme.textSecondary} font-medium`}>Memuat monitoring absensi...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <p className={`${theme.textSecondary} text-lg`}>Sekolah tidak ditemukan</p>
      </div>
    );
  }

  const { stats } = data;
  const percentage = stats.total ? Math.round((stats.hadir / stats.total) * 100) : 0;
  const classNames = Object.keys(data.classes).sort();
  const currentTime = realtimeClock.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const currentDate = realtimeClock.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const statItems = [
    { icon: Users, value: stats.total, label: "Total", color: "text-[#5B6CF9]", bg: "bg-[#5B6CF9]/10", ring: "ring-[#5B6CF9]/20" },
    { icon: UserCheck, value: stats.hadir, label: "Hadir", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-200 dark:ring-emerald-500/20" },
    { icon: FileText, value: stats.izin, label: "Izin", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-200 dark:ring-amber-500/20" },
    { icon: Thermometer, value: stats.sakit, label: "Sakit", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-200 dark:ring-sky-500/20" },
    { icon: AlertTriangle, value: stats.alfa, label: "Alfa", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10", ring: "ring-red-200 dark:ring-red-500/20" },
    { icon: Clock, value: stats.belum, label: "Belum", color: darkMode ? "text-slate-400" : "text-slate-500", bg: darkMode ? "bg-slate-500/10" : "bg-slate-100", ring: darkMode ? "ring-slate-500/20" : "ring-slate-200" },
  ];

  const getStatusStyle = (status: string) => {
    if (darkMode) {
      const map: Record<string, string> = {
        hadir: "bg-emerald-500/15 text-emerald-400",
        izin: "bg-amber-500/15 text-amber-400",
        sakit: "bg-sky-500/15 text-sky-400",
        alfa: "bg-red-500/15 text-red-400",
      };
      return map[status] || "bg-slate-500/15 text-slate-400";
    }
    const map: Record<string, string> = {
      hadir: "bg-emerald-100 text-emerald-700",
      izin: "bg-amber-100 text-amber-700",
      sakit: "bg-sky-100 text-sky-700",
      alfa: "bg-red-100 text-red-700",
    };
    return map[status] || "bg-slate-100 text-slate-600";
  };

  const getAvatarStyle = (status: string) => {
    if (darkMode) {
      const map: Record<string, string> = {
        hadir: "ring-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        izin: "ring-amber-500/30 bg-amber-500/10 text-amber-400",
        sakit: "ring-sky-500/30 bg-sky-500/10 text-sky-400",
        alfa: "ring-red-500/30 bg-red-500/10 text-red-400",
      };
      return map[status] || "";
    }
    const map: Record<string, string> = {
      hadir: "ring-emerald-200 bg-emerald-50 text-emerald-700",
      izin: "ring-amber-200 bg-amber-50 text-amber-700",
      sakit: "ring-sky-200 bg-sky-50 text-sky-700",
      alfa: "ring-red-200 bg-red-50 text-red-700",
    };
    return map[status] || "";
  };

  return (
    <div ref={containerRef} className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl ${theme.headerBg} border-b`}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {data.school.logo ? (
                <img src={data.school.logo} alt="" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-cover ring-2 ring-border/30" />
              ) : (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-lg">
                  <School className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className={`text-sm sm:text-lg lg:text-xl font-bold ${theme.text} truncate max-w-[180px] sm:max-w-none`}>{data.school.name}</h1>
                <div className={`flex items-center gap-2 sm:gap-3 text-xs ${theme.textSecondary}`}>
                  <LiveDot />
                  <span className="hidden sm:inline font-medium">Live Monitoring</span>
                  <span className="sm:hidden font-medium">Live</span>
                  <span className="hidden md:inline">•</span>
                  <span className="hidden md:inline">{currentDate}</span>
                  <Badge className={`text-[9px] sm:text-[10px] border-0 font-semibold ${
                    data.currentMode === "pulang"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  }`}>
                    {data.currentMode === "pulang" ? <LogOut className="h-2.5 w-2.5 mr-0.5" /> : <LogIn className="h-2.5 w-2.5 mr-0.5" />}
                    {data.currentMode === "pulang" ? "Pulang" : "Datang"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${darkMode ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${darkMode ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCameraVisible(!cameraVisible)}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${
                  cameraVisible
                    ? "bg-[#5B6CF9]/15 text-[#5B6CF9]"
                    : darkMode ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {cameraVisible ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl ${darkMode ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <div className="text-right hidden sm:block ml-2">
                <p className={`text-xl lg:text-2xl font-mono font-bold tabular-nums ${theme.text}`}>{currentTime}</p>
                <div className="flex items-center justify-end gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className={`text-[9px] ${theme.textMuted}`}>Auto-refresh 5s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {/* Premium Title Banner */}
        <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 ${darkMode ? "bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950" : "bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded]"} text-white shadow-xl`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl ${darkMode ? "bg-white/10" : "bg-white/15"} backdrop-blur-sm flex items-center justify-center border border-white/20`}>
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Live Monitoring Absensi</h2>
                <p className="text-white/70 text-xs sm:text-sm">{currentDate}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-3xl font-extrabold tabular-nums">{percentage}%</p>
              <p className="text-[11px] text-white/60">Kehadiran Tercatat</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {statItems.map((stat, i) => {
            const colorMap: Record<string, { light: string; dark: string; iconLight: string; iconDark: string; bgLight: string; bgDark: string; ringLight: string; ringDark: string }> = {
              Total: { light: "text-[#5B6CF9]", dark: "text-indigo-400", iconLight: "text-[#5B6CF9]", iconDark: "text-indigo-400", bgLight: "bg-indigo-50", bgDark: "bg-indigo-500/10", ringLight: "ring-indigo-200", ringDark: "ring-indigo-500/20" },
              Hadir: { light: "text-emerald-600", dark: "text-emerald-400", iconLight: "text-emerald-600", iconDark: "text-emerald-400", bgLight: "bg-emerald-50", bgDark: "bg-emerald-500/10", ringLight: "ring-emerald-200", ringDark: "ring-emerald-500/20" },
              Izin: { light: "text-amber-600", dark: "text-amber-400", iconLight: "text-amber-600", iconDark: "text-amber-400", bgLight: "bg-amber-50", bgDark: "bg-amber-500/10", ringLight: "ring-amber-200", ringDark: "ring-amber-500/20" },
              Sakit: { light: "text-sky-600", dark: "text-sky-400", iconLight: "text-sky-600", iconDark: "text-sky-400", bgLight: "bg-sky-50", bgDark: "bg-sky-500/10", ringLight: "ring-sky-200", ringDark: "ring-sky-500/20" },
              Alfa: { light: "text-red-600", dark: "text-red-400", iconLight: "text-red-600", iconDark: "text-red-400", bgLight: "bg-red-50", bgDark: "bg-red-500/10", ringLight: "ring-red-200", ringDark: "ring-red-500/20" },
              Belum: { light: "text-slate-500", dark: "text-slate-400", iconLight: "text-slate-500", iconDark: "text-slate-400", bgLight: "bg-slate-100", bgDark: "bg-slate-500/10", ringLight: "ring-slate-200", ringDark: "ring-slate-500/20" },
            };
            const c = colorMap[stat.label] || colorMap.Belum;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className={`rounded-xl ${darkMode ? c.bgDark : c.bgLight} ring-1 ${darkMode ? c.ringDark : c.ringLight} p-3 sm:p-4 transition-all hover:scale-[1.02] hover:shadow-md`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${darkMode ? c.bgDark : c.bgLight} flex items-center justify-center border ${darkMode ? "border-white/5" : "border-black/5"}`}>
                      <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${darkMode ? c.iconDark : c.iconLight}`} />
                    </div>
                    <div>
                      <p className={`text-xl sm:text-2xl font-extrabold leading-tight ${darkMode ? c.dark : c.light}`}>{stat.value}</p>
                      <p className={`text-[9px] sm:text-[10px] ${theme.textMuted} font-semibold uppercase tracking-wider`}>{stat.label}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className={`rounded-xl ${theme.cardBg} ring-1 px-4 py-2.5`}>
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-[#5B6CF9] shrink-0" />
            <span className={`text-xs font-semibold ${theme.textSecondary} whitespace-nowrap`}>Progress</span>
            <div className={`flex-1 h-3 rounded-full ${theme.progressBg} overflow-hidden`}>
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#5B6CF9] via-[#7c8afc] to-emerald-500"
                initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1.2 }}
              />
            </div>
            <span className={`text-base font-extrabold ${theme.text} whitespace-nowrap tabular-nums`}>{percentage}%</span>
            <span className={`text-[10px] ${theme.textMuted} whitespace-nowrap tabular-nums`}>{stats.hadir}/{stats.total}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className={`grid ${cameraVisible ? "lg:grid-cols-5" : ""} gap-4`}>
          {schoolId && (
            <div className={`lg:col-span-2 ${cameraVisible ? "" : "hidden"}`}>
              <PublicAttendanceScanner schoolId={schoolId} onAttendanceRecorded={fetchData} currentMode={data?.currentMode || "datang"} canFaceRecognition={data?.canFaceRecognition ?? false} />
            </div>
          )}

          {/* Live Feed */}
          <div className={cameraVisible ? "lg:col-span-3" : ""}>
            <div className={`rounded-2xl ${theme.feedBg} ring-1 overflow-hidden h-full`}>
              <div className={`px-4 py-3.5 border-b ${darkMode ? "border-slate-800" : "border-border/40"} flex items-center gap-3`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${darkMode ? "bg-emerald-500/15" : "bg-gradient-to-br from-emerald-500 to-emerald-600"}`}>
                  <Activity className={`h-5 w-5 ${darkMode ? "text-emerald-400" : "text-white"}`} />
                </div>
                <div className="flex-1">
                  <h2 className={`text-sm font-bold ${theme.text}`}>Live Feed Absensi</h2>
                  <p className={`text-[9px] ${theme.textMuted}`}>20 absensi terbaru • realtime update</p>
                </div>
                <div className="flex items-center gap-2">
                  <LiveDot />
                  <Badge className={`text-[8px] border-0 font-semibold ${darkMode ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>LIVE</Badge>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[400px] lg:max-h-[500px]">
                {data.liveFeed.length === 0 ? (
                  <div className="p-10 text-center">
                    <Clock className={`h-10 w-10 ${theme.textMuted} mx-auto mb-2`} />
                    <p className={`text-sm ${theme.textSecondary}`}>Belum ada absensi hari ini</p>
                  </div>
                ) : (
                  <div className={`divide-y ${darkMode ? "divide-slate-800" : "divide-border/30"}`}>
                    <AnimatePresence initial={false}>
                      {data.liveFeed.slice(0, 20).map((entry) => {
                        const isNew = entry.id === newEntryId;
                        return (
                          <motion.div key={entry.id}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                              isNew ? `${theme.newEntryBg} ring-1 ring-inset` : theme.feedItemHover
                            }`}>
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ring-2 ${getAvatarStyle(entry.status)}`}>
                              {entry.photo_url ? (
                                <img src={entry.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
                              ) : entry.student_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold text-sm ${theme.text} truncate`}>{entry.student_name}</p>
                                {isNew && (
                                  <Badge className="bg-emerald-500 text-white text-[7px] px-1.5 py-0 animate-pulse shadow-lg shadow-emerald-500/30">BARU</Badge>
                                )}
                              </div>
                              <p className={`text-[10px] ${theme.textMuted}`}>{entry.student_class} • {entry.student_id}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex flex-col items-end gap-0.5">
                                <Badge variant="secondary" className={`text-[9px] px-2 py-0.5 border-0 font-semibold ${getStatusStyle(entry.status)}`}>
                                  {STATUS_LABELS[entry.status] || entry.status}
                                </Badge>
                                {entry.status === "hadir" && (
                                  <Badge variant="outline" className={`text-[7px] px-1.5 py-0 border-0 ${
                                    entry.attendance_type === "pulang"
                                      ? darkMode ? "bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-700"
                                      : darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {entry.attendance_type === "pulang" ? "↗ Pulang" : "↙ Datang"}
                                  </Badge>
                                )}
                              </div>
                              <span className={`text-xs font-mono ${theme.textMuted} font-semibold min-w-[36px] text-right tabular-nums`}>{entry.time?.slice(0, 5)}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Per Class Summary */}
        <div>
          <div className={`relative overflow-hidden rounded-2xl p-5 mb-5 ${darkMode ? "bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900" : "bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded]"} text-white shadow-xl`}>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold">Ringkasan Per Kelas</h2>
                <p className="text-white/60 text-xs">Status kehadiran seluruh kelas hari ini</p>
              </div>
              <Badge className="text-[10px] border-0 font-bold bg-white/15 text-white backdrop-blur-sm">{classNames.length} Kelas</Badge>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {classNames.map((cls, i) => {
              const classStudents = data.classes[cls];
              const hadir = classStudents.filter((s) => s.status === "hadir").length;
              const izin = classStudents.filter((s) => s.status === "izin").length;
              const sakit = classStudents.filter((s) => s.status === "sakit").length;
              const alfa = classStudents.filter((s) => s.status === "alfa").length;
              const belum = classStudents.filter((s) => s.status === "belum").length;
              const recorded = classStudents.length - belum;
              const pct = classStudents.length ? Math.round((recorded / classStudents.length) * 100) : 0;
              const allDone = belum === 0;

              return (
                <motion.div key={cls} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className={`relative overflow-hidden rounded-2xl ring-1 p-5 transition-all hover:shadow-xl hover:scale-[1.02] ${
                    allDone
                      ? darkMode ? "bg-gradient-to-br from-emerald-950/60 to-slate-900 ring-emerald-500/30" : "bg-gradient-to-br from-emerald-50 to-white ring-emerald-200 shadow-emerald-100"
                      : darkMode ? "bg-slate-900/80 ring-slate-700/50" : "bg-white ring-border/50 shadow-sm"
                  }`}>
                    {allDone && <div className={`absolute top-0 right-0 h-20 w-20 rounded-bl-[3rem] ${darkMode ? "bg-emerald-500/10" : "bg-emerald-100/60"}`} />}
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                          allDone
                            ? darkMode ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                            : darkMode ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30" : "bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white"
                        }`}>
                          <GraduationCap className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold text-base ${theme.text}`}>{cls}</h3>
                            {allDone && (
                              <Badge className={`border-0 text-[8px] shadow-sm ${darkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500 text-white"}`}>
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Lengkap
                              </Badge>
                            )}
                          </div>
                          <p className={`text-[10px] ${theme.textMuted} flex items-center gap-1`}><Users className="h-2.5 w-2.5" />{classStudents.length} siswa</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-extrabold tabular-nums ${
                            allDone ? (darkMode ? "text-emerald-400" : "text-emerald-600") : "text-[#5B6CF9]"
                          }`}>{pct}%</p>
                        </div>
                      </div>

                      {/* Status breakdown mini badges */}
                      <div className="flex items-center gap-1.5 mb-3">
                        {[
                          { label: "H", count: hadir, light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-500/15 text-emerald-400" },
                          { label: "I", count: izin, light: "bg-amber-100 text-amber-700", dark: "bg-amber-500/15 text-amber-400" },
                          { label: "S", count: sakit, light: "bg-sky-100 text-sky-700", dark: "bg-sky-500/15 text-sky-400" },
                          { label: "A", count: alfa, light: "bg-red-100 text-red-700", dark: "bg-red-500/15 text-red-400" },
                          { label: "B", count: belum, light: "bg-slate-100 text-slate-600", dark: "bg-slate-500/15 text-slate-400" },
                        ].map(item => (
                          <span key={item.label} className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-1 rounded-md ${darkMode ? item.dark : item.light}`}>
                            {item.label}: {item.count}
                          </span>
                        ))}
                      </div>

                      <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                        <motion.div className={`h-full rounded-full ${
                          allDone
                            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                            : "bg-gradient-to-r from-[#5B6CF9] via-[#7c8afc] to-[#5B6CF9]"
                        }`}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: i * 0.05 }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center py-4 border-t ${theme.footerBorder}`}>
          <div className={`flex items-center justify-center gap-2 text-xs ${theme.textMuted}`}>
            <LiveDot />
            <span>ATSkolla — Absensi Digital Sekolah • Auto-refresh setiap 5 detik</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicAttendanceMonitoring;
