import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck, UserX, Clock, School, Users, RefreshCw,
  GraduationCap, Activity, TrendingUp, Volume2,
  Eye, EyeOff, CheckCircle2, Maximize, Minimize,
  ChevronLeft, ChevronRight, Pause, Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { announceDismissal } from "@/lib/announceDismissal";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface StudentStatus {
  id: string;
  name: string;
  class: string;
  parent_name: string;
  student_id: string;
  photo_url: string | null;
  status: "waiting" | "picked_up";
  dismissal_time: string | null;
  dismissed_by: string | null;
}

interface MonitoringData {
  school: { name: string; logo: string | null } | null;
  classes: Record<string, StudentStatus[]>;
  total: number;
  picked_up: number;
  settings?: { is_active: boolean };
}

const LiveDot = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
  </span>
);

const StudentCard = ({ student, index }: { student: StudentStatus; index: number }) => {
  const isPickedUp = student.status === "picked_up";
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }} transition={{ delay: index * 0.02, type: "spring", stiffness: 400, damping: 30 }}>
      <div className={`group relative flex items-center gap-3 rounded-xl p-3 transition-all duration-300 hover:shadow-elevated ${
        isPickedUp ? "bg-success/5 border border-success/20" : "bg-destructive/5 border border-destructive/20"
      }`}>
        <div className={`relative h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
          isPickedUp ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}>
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
          ) : (
            student.name.charAt(0)
          )}
          {!isPickedUp && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive animate-pulse border-2 border-card" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{student.name}</p>
          <p className="text-xs text-muted-foreground">NIS: {student.student_id}</p>
        </div>
        <div className="text-right shrink-0">
          {isPickedUp ? (
            <>
              <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-semibold">
                <UserCheck className="h-3 w-3 mr-1" /> Pulang
              </Badge>
              {student.dismissal_time && (
                <div className="flex items-center gap-1 text-muted-foreground mt-1 justify-end">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px]">{new Date(student.dismissal_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              )}
            </>
          ) : (
            <Badge variant="destructive" className="text-[10px] font-semibold animate-pulse">
              <UserX className="h-3 w-3 mr-1" /> Menunggu
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Airport-style rotating class panel
const RotatingClassPanel = ({
  className: cls,
  students,
  isActive,
}: {
  className: string;
  students: StudentStatus[];
  isActive: boolean;
}) => {
  const picked = students.filter((s) => s.status === "picked_up").length;
  const total = students.length;
  const percentage = total ? Math.round((picked / total) * 100) : 0;
  const waiting = total - picked;
  const allDone = waiting === 0;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={cls}
          initial={{ opacity: 0, rotateX: -90, y: -30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          exit={{ opacity: 0, rotateX: 90, y: 30 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
          style={{ perspective: "1000px" }}
        >
          <Card className={`overflow-hidden border-2 transition-all duration-300 ${
            allDone
              ? "border-success/40 shadow-[0_0_25px_-3px_hsl(var(--success)/0.25)]"
              : "border-primary/30 shadow-[0_0_25px_-3px_hsl(var(--primary)/0.15)]"
          }`}>
            {/* Class Header */}
            <div className="p-5 flex items-center gap-4 bg-gradient-to-r from-card to-muted/30">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
                allDone ? "bg-success/15 text-success" : "gradient-primary text-primary-foreground"
              }`}>
                <GraduationCap className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-extrabold text-xl text-foreground">{cls}</h3>
                  {allDone && (
                    <Badge className="bg-success text-white text-xs px-2 py-0.5">
                      ✓ Selesai
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {total} siswa</span>
                  <span className="flex items-center gap-1 text-success font-semibold"><UserCheck className="h-4 w-4" /> {picked} pulang</span>
                  <span className="flex items-center gap-1 text-destructive font-semibold"><UserX className="h-4 w-4" /> {waiting} menunggu</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-4xl font-black ${allDone ? "text-success" : "text-primary"}`}>{percentage}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-2 pt-1">
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${allDone ? "bg-success" : "bg-gradient-to-r from-primary to-primary/70"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Students list */}
            <div className="px-5 pb-5 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
              {students.sort((a, b) => (a.status === "waiting" ? -1 : 1)).map((s, i) => (
                <StudentCard key={s.id} student={s} index={i} />
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const PublicMonitoring = () => {
  const params = useParams<{ schoolId: string }>();
  const { school: tenantSchool } = useTenant();
  const schoolId = params.schoolId || tenantSchool?.id;
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const prevPickedIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);
  const [successPopup, setSuccessPopup] = useState<StudentStatus | null>(null);

  // Auto-rotate state
  const [currentClassIndex, setCurrentClassIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [rotateInterval, setRotateIntervalTime] = useState(8); // seconds
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!schoolId) return;
    if (showRefresh) setIsRefreshing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-monitoring?school_id=${schoolId}`;
      const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      const json = await res.json();
      if (json.error) return;

      if (!initialLoad.current) {
        const allStudents: StudentStatus[] = [];
        Object.values(json.classes as Record<string, StudentStatus[]>).forEach((arr) => allStudents.push(...arr));
        const newPicked = allStudents.filter(
          (s) => s.status === "picked_up" && !prevPickedIds.current.has(s.id)
        );
        if (newPicked.length > 0) {
          const lastPicked = newPicked[newPicked.length - 1];
          setSuccessPopup(lastPicked);
          setTimeout(() => setSuccessPopup(null), 5000);
          newPicked.forEach((s, i) => {
            setTimeout(() => {
              announceDismissal(s.name, s.class);
            }, 600 + i * 3000);
          });

          // Auto-navigate to the class of the newly picked up student
          const classNames = Object.keys(json.classes).sort();
          const pickedClassIdx = classNames.indexOf(lastPicked.class);
          if (pickedClassIdx !== -1) {
            setCurrentClassIndex(pickedClassIdx);
          }
        }
        prevPickedIds.current = new Set(allStudents.filter(s => s.status === "picked_up").map(s => s.id));
      } else {
        const allStudents: StudentStatus[] = [];
        Object.values(json.classes as Record<string, StudentStatus[]>).forEach((arr) => allStudents.push(...arr));
        prevPickedIds.current = new Set(allStudents.filter(s => s.status === "picked_up").map(s => s.id));
        initialLoad.current = false;
      }

      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [schoolId]);

  // Initial fetch + realtime subscription (no polling delay)
  useEffect(() => {
    fetchData();
    // Fast polling at 3s for near-realtime
    const interval = setInterval(() => fetchData(), 3000);
    // Also listen to realtime changes for instant updates
    const channel = supabase.channel("public-monitoring-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dismissal_logs" }, () => fetchData(true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dismissal_logs" }, () => fetchData(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, () => fetchData(true))
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchData]);

  // Auto-rotate classes
  useEffect(() => {
    if (!isAutoRotating || !data) return;
    const classNames = Object.keys(data.classes).sort();
    if (classNames.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentClassIndex((prev) => (prev + 1) % classNames.length);
    }, rotateInterval * 1000);

    return () => clearInterval(timer);
  }, [isAutoRotating, data, rotateInterval]);

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const navigateClass = (dir: "prev" | "next") => {
    if (!data) return;
    const classNames = Object.keys(data.classes).sort();
    setCurrentClassIndex((prev) =>
      dir === "next" ? (prev + 1) % classNames.length : (prev - 1 + classNames.length) % classNames.length
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto">
            <School className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <p className="text-muted-foreground font-medium">Memuat data realtime...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Data tidak ditemukan</p>
      </div>
    );
  }

  const classNames = Object.keys(data.classes).sort();
  const waiting = data.total - data.picked_up;
  const percentage = data.total ? Math.round((data.picked_up / data.total) * 100) : 0;
  const isActive = data.settings?.is_active !== false;
  const safeClassIndex = currentClassIndex % Math.max(classNames.length, 1);

  return (
    <div ref={containerRef} className={`min-h-screen bg-background ${isFullscreen ? "h-screen overflow-y-auto" : ""}`}>
      {/* Header */}
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-elevated">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.school?.logo ? (
                <img src={data.school.logo} alt={data.school.name} className="h-11 w-11 rounded-xl object-cover shadow-md" />
              ) : (
                <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <School className="h-6 w-6" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold">{data.school?.name || "ATSkolla"}</h1>
                <div className="flex items-center gap-2 text-xs opacity-80">
                  {isActive ? <LiveDot /> : <span className="h-2.5 w-2.5 rounded-full bg-destructive" />}
                  <span>{isActive ? "Live Monitoring Kepulangan" : "Sistem Nonaktif"}</span>
                  <Volume2 className="h-3 w-3 ml-1" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-rotate controls */}
              <button
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                  isAutoRotating ? "bg-white/20 hover:bg-white/30" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {isAutoRotating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isAutoRotating ? "Pause" : "Play"}</span>
              </button>
              <button onClick={() => fetchData(true)}
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button onClick={toggleFullscreen}
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
              <div className="text-right text-xs opacity-70 hidden sm:block ml-1">
                <p>Update terakhir</p>
                <p className="font-mono font-bold">
                  {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {!isActive && (
        <div className="bg-destructive/10 border-b border-destructive/20 py-3 px-4 text-center">
          <p className="text-sm font-medium text-destructive">⏸ Sistem kepulangan sedang nonaktif.</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, value: data.total, label: "Total Siswa", color: "text-primary", bg: "bg-primary/10" },
            { icon: UserCheck, value: data.picked_up, label: "Sudah Pulang", color: "text-success", bg: "bg-success/10" },
            { icon: UserX, value: waiting, label: "Menunggu", color: "text-destructive", bg: "bg-destructive/10" },
            { icon: TrendingUp, value: `${percentage}%`, label: "Progress", color: "text-primary", bg: "gradient-primary" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-0 shadow-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.bg.includes("gradient") ? "text-primary-foreground" : stat.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Overall Progress */}
        {showProgress && (
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Progress Keseluruhan</span>
                </div>
                <div className="flex items-center gap-2">
                  <LiveDot />
                  <span className="text-xs text-muted-foreground">Realtime</span>
                </div>
              </div>
              <div className="h-4 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-success"
                  initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{data.picked_up} dari {data.total} siswa sudah pulang</span>
                <span className="font-bold text-primary">{percentage}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rotating Class Display - Airport Style */}
        <div className="space-y-3">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Kelas</h2>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowProgress(!showProgress)} className="text-xs gap-1.5">
                {showProgress ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showProgress ? "Sembunyikan" : "Tampilkan"}
              </Button>
              <Select value={String(rotateInterval)} onValueChange={(v) => setRotateIntervalTime(Number(v))}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 detik</SelectItem>
                  <SelectItem value="8">8 detik</SelectItem>
                  <SelectItem value="12">12 detik</SelectItem>
                  <SelectItem value="15">15 detik</SelectItem>
                  <SelectItem value="20">20 detik</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Class Indicator Dots + Nav */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigateClass("prev")}
              className="h-9 w-9 rounded-full bg-muted hover:bg-accent flex items-center justify-center transition-all"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {classNames.map((cls, i) => {
                const clsStudents = data.classes[cls];
                const clsPicked = clsStudents.filter(s => s.status === "picked_up").length;
                const clsAllDone = clsPicked === clsStudents.length;
                const isCurrentClass = i === safeClassIndex;

                return (
                  <button
                    key={cls}
                    onClick={() => { setCurrentClassIndex(i); setIsAutoRotating(false); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                      isCurrentClass
                        ? clsAllDone
                          ? "bg-success text-white scale-110 shadow-md"
                          : "bg-primary text-primary-foreground scale-110 shadow-md"
                        : clsAllDone
                          ? "bg-success/15 text-success hover:bg-success/25"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {cls}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => navigateClass("next")}
              className="h-9 w-9 rounded-full bg-muted hover:bg-accent flex items-center justify-center transition-all"
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {/* Auto-rotate progress bar */}
          {isAutoRotating && classNames.length > 1 && (
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary/50"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: rotateInterval, ease: "linear", repeat: Infinity }}
                key={`${safeClassIndex}-${rotateInterval}`}
              />
            </div>
          )}

          {/* Rotating Class Card */}
          <div className="relative min-h-[200px]">
            {classNames.map((cls, i) => (
              <RotatingClassPanel
                key={cls}
                className={cls}
                students={data.classes[cls]}
                isActive={i === safeClassIndex}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LiveDot />
            <span>ATSkolla Attendance System • Data diperbarui realtime</span>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      <Dialog open={!!successPopup} onOpenChange={(open) => !open && setSuccessPopup(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Siswa Berhasil Pulang</DialogTitle>
          </DialogHeader>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Berhasil Pulang!</h2>
              <p className="text-lg font-semibold text-primary">{successPopup?.name}</p>
              <p className="text-sm text-muted-foreground">Kelas {successPopup?.class} • NIS: {successPopup?.student_id}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <Button onClick={() => setSuccessPopup(null)} variant="outline" className="mt-2">
              Tutup
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicMonitoring;
