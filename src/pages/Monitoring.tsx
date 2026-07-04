import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCheck, UserX, Clock, Users, GraduationCap,
  Activity, CheckCircle2, AlertTriangle, Thermometer, FileText, Scan, ExternalLink, RotateCcw, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getLocalDateString, getLocalTimeString } from "@/lib/dateLocal";
import { fetchSchoolHolidayStatus } from "@/lib/schoolHoliday";

const STATUS_COLORS: Record<string, string> = {
  hadir: "text-success",
  izin: "text-warning",
  sakit: "text-blue-500",
  alfa: "text-destructive",
};

const STATUS_BG: Record<string, string> = {
  hadir: "bg-success/10 border-success/20",
  izin: "bg-warning/10 border-warning/20",
  sakit: "bg-blue-50 border-blue-200",
  alfa: "bg-destructive/10 border-destructive/20",
  pulang: "bg-primary/10 border-primary/20",
};

const STATUS_LABELS: Record<string, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alfa: "Alfa",
  pulang: "Pulang",
};

const METHOD_LABELS: Record<string, string> = {
  barcode: "Barcode",
  face_recognition: "Face Recognition",
  manual: "Manual",
};

interface StudentWithStatus {
  id: string;
  name: string;
  class: string;
  parent_name: string;
  student_id: string;
  photo_url: string | null;
  status: "belum" | "hadir" | "izin" | "sakit" | "alfa";
  attendance_time?: string;
  log_id?: string;
}

interface LiveEntry {
  id: string;
  student_name: string;
  student_class: string;
  student_id_nis: string;
  photo_url: string | null;
  status: string;
  method: string;
  time: string;
  created_at: string;
  attendance_type: string;
}

const LiveDot = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
  </span>
);

const Monitoring = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [editStudent, setEditStudent] = useState<StudentWithStatus | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [newEntryId, setNewEntryId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;
    const schoolId = profile.school_id;
    const today = getLocalDateString("Asia/Jakarta");

    const [studentsRes, logsRes, settingsRes] = await Promise.all([
      supabase.from("students").select("id, name, class, parent_name, student_id, photo_url").eq("school_id", schoolId),
      supabase.from("attendance_logs").select("id, student_id, time, status, method, created_at, attendance_type").eq("school_id", schoolId).eq("date", today).neq("method", "auto").order("created_at", { ascending: false }),
      supabase.from("dismissal_settings").select("attendance_end_time, departure_end_time").eq("school_id", schoolId).maybeSingle(),
    ]);

    const allStudents = studentsRes.data || [];
    const logs = logsRes.data || [];
    const settings = settingsRes.data as any;
    const datangLogs = logs.filter((l: any) => (l.attendance_type || "datang") === "datang");
    const mapped: StudentWithStatus[] = allStudents.map((s: any) => {
      const log = datangLogs.find((l: any) => l.student_id === s.id);
      return {
        id: s.id, name: s.name, class: s.class,
        parent_name: s.parent_name, student_id: s.student_id, photo_url: s.photo_url,
        status: log ? (log.status as any) : "belum",
        attendance_time: log?.time,
        log_id: log?.id,
      };
    });

    // Build live entries
    const entries: LiveEntry[] = logs.map((log: any) => {
      const student = allStudents.find((s: any) => s.id === log.student_id);
      return {
        id: log.id,
        student_name: student?.name || "Unknown",
        student_class: student?.class || "",
        student_id_nis: student?.student_id || "",
        photo_url: student?.photo_url || null,
        status: log.status,
        method: log.method || "manual",
        time: log.time,
        created_at: log.created_at,
        attendance_type: log.attendance_type || "datang",
      };
    });

    setStudents(mapped);
    setLiveEntries(entries);
    setLastUpdated(new Date());
  }, [profile?.school_id]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("monitoring-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          setNewEntryId(payload.new.id as string);
          setTimeout(() => setNewEntryId(null), 3000);
        }
        fetchData();
      })
      .subscribe();

    // Auto-refresh ketika tanggal lokal berganti (mis. lewat 00:00 WIB),
    // sehingga "Absensi Terbaru" otomatis kosong dan tidak menampilkan data kemarin.
    let lastDate = getLocalDateString("Asia/Jakarta");
    const dateWatcher = setInterval(() => {
      const currentDate = getLocalDateString("Asia/Jakarta");
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        fetchData();
      }
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dateWatcher);
    };
  }, [fetchData]);

  const handleUpdateStatus = async () => {
    if (!editStudent || !editStatus || !profile?.school_id) return;

    // Block manual attendance during holiday
    const holidayStatus = await fetchSchoolHolidayStatus(profile.school_id);
    if (holidayStatus.isHoliday) {
      toast.error(`Absensi ditangguhkan: ${holidayStatus.reason}`);
      setEditStudent(null);
      setEditStatus("");
      return;
    }

    
    if (editStatus === "belum") {
      // Cancel attendance — delete the log
      if (editStudent.log_id) {
        await supabase.from("attendance_logs").delete().eq("id", editStudent.log_id);
        toast.success(`Absensi ${editStudent.name} dibatalkan`);
      } else {
        toast.info(`${editStudent.name} memang belum absen`);
      }
    } else if (editStudent.log_id) {
      await supabase.from("attendance_logs").update({ status: editStatus }).eq("id", editStudent.log_id);
      toast.success(`Status ${editStudent.name} diubah ke ${STATUS_LABELS[editStatus]}`);
    } else {
      const now = new Date();
      await supabase.from("attendance_logs").insert({
        school_id: profile.school_id,
        student_id: editStudent.id,
        date: getLocalDateString("Asia/Jakarta", now),
        time: getLocalTimeString("Asia/Jakarta", now),
        method: "manual",
        status: editStatus,
        recorded_by: profile.full_name || "Admin",
      });
      toast.success(`Status ${editStudent.name} diubah ke ${STATUS_LABELS[editStatus]}`);
    }
    setEditStudent(null);
    setEditStatus("");
    fetchData();
  };

  const grouped = useMemo(() => {
    const g: Record<string, StudentWithStatus[]> = {};
    for (const s of students) {
      if (!g[s.class]) g[s.class] = [];
      g[s.class].push(s);
    }
    return g;
  }, [students]);

  const classNames = Object.keys(grouped).sort();
  const totalHadir = students.filter((s) => s.status === "hadir").length;
  const totalIzin = students.filter((s) => s.status === "izin").length;
  const totalSakit = students.filter((s) => s.status === "sakit").length;
  const totalAlfa = students.filter((s) => s.status === "alfa").length;
  const totalBelum = students.filter((s) => s.status === "belum").length;
  const percentage = students.length ? Math.round(((students.length - totalBelum) / students.length) * 100) : 0;

  const toggleClass = (cls: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls); else next.add(cls);
      return next;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={Activity}
        title="Monitoring Absensi"
        subtitle={`Realtime • ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
        actions={
          profile?.school_id ? (
            <Button onClick={() => window.open(`/attendance/${profile.school_id}`, "_blank")} className="bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl text-xs">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Live Monitor Publik
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Users, value: students.length, label: "Total", color: "text-primary", bg: "bg-primary/10" },
          { icon: UserCheck, value: totalHadir, label: "Hadir", color: "text-success", bg: "bg-success/10" },
          { icon: FileText, value: totalIzin, label: "Izin", color: "text-warning", bg: "bg-warning/10" },
          { icon: Thermometer, value: totalSakit, label: "Sakit", color: "text-blue-500", bg: "bg-blue-50" },
          { icon: AlertTriangle, value: totalAlfa, label: "Alfa", color: "text-destructive", bg: "bg-destructive/10" },
          { icon: Clock, value: totalBelum, label: "Belum", color: "text-muted-foreground", bg: "bg-muted" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border-0 shadow-card">
              <CardContent className="p-2 sm:p-3 text-center">
                <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg ${stat.bg} flex items-center justify-center mx-auto mb-1`}>
                  <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
                </div>
                <p className={`text-lg sm:text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Progress bar */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-foreground">Progress Absensi</span>
            <span className="text-base sm:text-lg font-extrabold text-primary">{percentage}%</span>
          </div>
          <div className="h-2.5 sm:h-3 rounded-full bg-secondary overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-success"
              initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">{students.length - totalBelum} dari {students.length} siswa sudah diabsen</p>
        </CardContent>
      </Card>

      {/* LIVE FEED */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Live Feed — Datang & Pulang</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Menampilkan aktivitas absensi terbaru secara realtime</p>
          </div>
          <div className="flex items-center gap-1.5">
            <LiveDot />
            <span className="text-[10px] text-muted-foreground font-medium">LIVE</span>
          </div>
        </div>
        <CardContent className="p-0">
          {liveEntries.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada siswa yang diabsen hari ini</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Data akan muncul otomatis saat siswa melakukan scan</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
              <AnimatePresence initial={false}>
                {liveEntries.slice(0, 30).map((entry, i) => {
                  const isNew = entry.id === newEntryId;
                  const liveStatus = entry.attendance_type === "pulang" ? "pulang" : entry.status;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -30, backgroundColor: "hsl(var(--success) / 0.15)" }}
                      animate={{ opacity: 1, x: 0, backgroundColor: "hsl(0 0% 100% / 0)" }}
                      transition={{ duration: 0.4, backgroundColor: { duration: 2 } }}
                      className={`flex items-center gap-3 p-3 sm:p-4 ${isNew ? "ring-2 ring-success/30 bg-success/5" : "hover:bg-muted/30"} transition-colors`}
                    >
                      {/* Avatar / Initial */}
                      <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        liveStatus === "hadir" ? "bg-success/15 text-success" :
                        liveStatus === "izin" ? "bg-warning/15 text-warning" :
                        liveStatus === "sakit" ? "bg-blue-50 text-blue-500" :
                        liveStatus === "pulang" ? "bg-primary/15 text-primary" :
                        "bg-destructive/15 text-destructive"
                      }`}>
                        {entry.photo_url ? (
                          <img src={entry.photo_url} alt={entry.student_name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          entry.student_name.charAt(0)
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-foreground truncate">{entry.student_name}</p>
                          {isNew && (
                            <Badge className="bg-success text-success-foreground text-[8px] px-1 py-0 animate-pulse">BARU</Badge>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {entry.student_class} • NIS: {entry.student_id_nis}
                        </p>
                      </div>

                      {/* Status & Method */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary" className={`text-[9px] sm:text-[10px] ${STATUS_BG[liveStatus]?.replace("border-", "").split(" ")[0] || ""}`}>
                          {STATUS_LABELS[liveStatus] || liveStatus}
                        </Badge>
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                          <Scan className="h-2.5 w-2.5" />
                          <span>{METHOD_LABELS[entry.method] || entry.method}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{entry.time?.slice(0, 5)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Cards */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">Per Kelas</h2>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">{classNames.length} kelas</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          {classNames.map((cls) => {
            const classStudents = grouped[cls];
            const classHadir = classStudents.filter((s) => s.status === "hadir").length;
            const classBelum = classStudents.filter((s) => s.status === "belum").length;
            const classRecorded = classStudents.length - classBelum;
            const classPct = classStudents.length ? Math.round((classRecorded / classStudents.length) * 100) : 0;
            const allDone = classBelum === 0;
            const isExpanded = expandedClasses.has(cls);

            return (
              <motion.div key={cls} layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                <Card className={`overflow-hidden border transition-all duration-300 ${
                  allDone ? "border-success/30 shadow-[0_0_15px_-3px_hsl(var(--success)/0.15)]" : "border-border shadow-card"
                }`}>
                  <div className="p-3 sm:p-4 cursor-pointer" onClick={() => toggleClass(cls)}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 ${
                        allDone ? "bg-success/15 text-success" : "gradient-primary text-primary-foreground"
                      }`}>
                        <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-foreground">{cls}</h3>
                          {allDone && <Badge className="bg-success/10 text-success border-success/20 text-[9px] sm:text-[10px]">✓ Lengkap</Badge>}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {classStudents.length}</span>
                          <span className="flex items-center gap-0.5 text-success"><UserCheck className="h-3 w-3" /> {classHadir}</span>
                          <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="h-3 w-3" /> {classBelum}</span>
                        </div>
                      </div>
                      <p className={`text-lg sm:text-xl font-extrabold ${allDone ? "text-success" : "text-primary"}`}>{classPct}%</p>
                    </div>
                    <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div className={`h-full rounded-full ${allDone ? "bg-success" : "bg-gradient-to-r from-primary to-primary/70"}`}
                        initial={{ width: 0 }} animate={{ width: `${classPct}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5 sm:space-y-2 border-t border-border pt-2 sm:pt-3">
                          {classStudents
                            .sort((a, b) => (a.status === "belum" ? 1 : -1))
                            .map((s, i) => (
                              <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02 }}>
                                <div className={`flex items-center gap-2 sm:gap-3 rounded-xl p-2 sm:p-3 transition-all border ${
                                  s.status === "belum" ? "bg-muted/50 border-border" : STATUS_BG[s.status] || "bg-muted/50 border-border"
                                }`}>
                                  <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                                    s.status === "hadir" ? "bg-success/15 text-success" :
                                    s.status === "belum" ? "bg-muted text-muted-foreground" :
                                    "bg-destructive/15 text-destructive"
                                  }`}>
                                    {s.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{s.name}</p>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">NIS: {s.student_id}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge
                                      variant="secondary"
                                      className={`text-[9px] sm:text-[10px] cursor-pointer hover:opacity-80 ${
                                        s.status === "belum" ? "" : STATUS_BG[s.status]?.replace("border-", "").split(" ")[0] || ""
                                      }`}
                                      onClick={(e) => { e.stopPropagation(); setEditStudent(s); setEditStatus(s.status === "belum" ? "" : s.status); }}
                                    >
                                      {s.status === "belum" ? "Belum Absen" : STATUS_LABELS[s.status]}
                                    </Badge>
                                    {s.attendance_time && (
                                      <span className="text-[9px] text-muted-foreground">{s.attendance_time.slice(0, 5)}</span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Edit Status Dialog */}
      <Dialog open={!!editStudent} onOpenChange={(open) => { if (!open) { setEditStudent(null); setEditStatus(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ubah Status Absensi</DialogTitle>
          </DialogHeader>
          {editStudent && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <p className="font-bold text-foreground">{editStudent.name}</p>
                <p className="text-sm text-muted-foreground">Kelas {editStudent.class} • NIS: {editStudent.student_id}</p>
              </div>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                <SelectContent>
                  {editStudent?.log_id && (
                    <SelectItem value="belum">
                      <span className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-muted-foreground" /> Batalkan (Belum Absen)</span>
                    </SelectItem>
                  )}
                  <SelectItem value="hadir">
                    <span className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-success" /> Hadir</span>
                  </SelectItem>
                  <SelectItem value="izin">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-warning" /> Izin</span>
                  </SelectItem>
                  <SelectItem value="sakit">
                    <span className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-blue-500" /> Sakit</span>
                  </SelectItem>
                  <SelectItem value="alfa">
                    <span className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Alfa</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEditStudent(null); setEditStatus(""); }} className="flex-1">Batal</Button>
                <Button onClick={handleUpdateStatus} disabled={!editStatus} className="flex-1 gradient-primary hover:opacity-90">Simpan</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Monitoring;