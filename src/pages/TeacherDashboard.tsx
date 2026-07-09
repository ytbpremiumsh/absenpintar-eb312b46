import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap, Calendar, Clock, Users, BookOpen,
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronRight,
  PlayCircle, Timer, Activity, ClipboardCheck, Bell, MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WeekScheduleCard } from "@/components/dashboard/WeekScheduleCard";
import { SchoolAnnouncementsWidget } from "@/components/dashboard/SchoolAnnouncementsWidget";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type ScheduleStatus = "upcoming" | "active" | "done";

function getStatus(startTime: string, endTime: string, now: Date): ScheduleStatus {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (currentMinutes >= start && currentMinutes < end) return "active";
  if (currentMinutes >= end) return "done";
  return "upcoming";
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  class_id: string;
  subject_id: string;
  class_name?: string;
  subject_name?: string;
  subject_color?: string;
}

interface Student {
  id: string;
  name: string;
  student_id: string;
  class: string;
  photo_url: string | null;
}

const TeacherDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [homeroomAssignments, setHomeroomAssignments] = useState<{ class_name: string }[]>([]);
  const [subjectAttendanceToday, setSubjectAttendanceToday] = useState<Record<string, number>>({});
  const [classStudentCount, setClassStudentCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Attendance modal state
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [existingAttendance, setExistingAttendance] = useState<Record<string, string>>({});
  const [sessionNote, setSessionNote] = useState<string>("");
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const schoolId = profile?.school_id;
  const today = new Date();
  const todayDay = today.getDay();
  const todayStr = today.toISOString().split("T")[0];

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!schoolId || !user) return;
    const fetchData = async () => {
      try {
        const [schedulesRes, classesRes, subjectsRes, homeroomRes] = await Promise.all([
          supabase.from("teaching_schedules").select("*").eq("school_id", schoolId).eq("teacher_id", user.id).eq("is_active", true),
          supabase.from("classes").select("id, name").eq("school_id", schoolId),
          supabase.from("subjects").select("id, name, color").eq("school_id", schoolId),
          supabase.from("class_teachers").select("class_name").eq("user_id", user.id).eq("school_id", schoolId),
        ]);

        const classMap = Object.fromEntries((classesRes.data || []).map(c => [c.id, c]));
        const subjectMap = Object.fromEntries((subjectsRes.data || []).map(s => [s.id, s]));

        setClasses(classesRes.data || []);
        setSubjects(subjectsRes.data || []);
        const homerooms = homeroomRes.data || [];
        setHomeroomAssignments(homerooms);

        const enriched = (schedulesRes.data || []).map(s => ({
          ...s,
          class_name: classMap[s.class_id]?.name || "-",
          subject_name: subjectMap[s.subject_id]?.name || "-",
          subject_color: subjectMap[s.subject_id]?.color || "#3B82F6",
        }));

        setSchedules(enriched);

        // Fetch today's MAPEL attendance progress per teaching schedule (for hero reminder)
        const todaySchedIds = (enriched || []).filter(s => s.day_of_week === todayDay).map(s => s.id);
        if (todaySchedIds.length > 0) {
          const { data: subjAtt } = await supabase
            .from("subject_attendance")
            .select("teaching_schedule_id, student_id")
            .in("teaching_schedule_id", todaySchedIds)
            .eq("date", todayStr);
          const counts: Record<string, number> = {};
          (subjAtt || []).forEach((r: any) => {
            counts[r.teaching_schedule_id] = (counts[r.teaching_schedule_id] || 0) + 1;
          });
          setSubjectAttendanceToday(counts);
        }

        // Fetch student counts per class (for both homeroom & teaching schedules)
        const allClassNames = Array.from(new Set([
          ...homerooms.map(h => h.class_name),
          ...(enriched || []).map(s => s.class_name).filter(Boolean),
        ]));
        if (allClassNames.length > 0) {
          const { data: studs } = await supabase
            .from("students")
            .select("class")
            .eq("school_id", schoolId)
            .in("class", allClassNames);
          const cc: Record<string, number> = {};
          (studs || []).forEach((s: any) => { cc[s.class] = (cc[s.class] || 0) + 1; });
          setClassStudentCount(cc);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId, user]);

  const todaySchedules = useMemo(() => {
    return schedules
      .filter(s => s.day_of_week === todayDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, todayDay]);

  const weekSchedules = useMemo(() => {
    const grouped: Record<number, Schedule[]> = {};
    for (let d = 1; d <= 6; d++) grouped[d] = [];
    schedules.forEach(s => {
      if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
    });
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return grouped;
  }, [schedules]);

  // Stats
  const activeCount = todaySchedules.filter(s => getStatus(s.start_time, s.end_time, now) === "active").length;
  const upcomingCount = todaySchedules.filter(s => getStatus(s.start_time, s.end_time, now) === "upcoming").length;
  const doneCount = todaySchedules.filter(s => getStatus(s.start_time, s.end_time, now) === "done").length;
  const totalSubjects = new Set(schedules.map(s => s.subject_id)).size;
  const totalClasses = new Set(schedules.map(s => s.class_id)).size;

  const openAttendance = async (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setAttendanceDialog(true);
    setLoadingStudents(true);

    const className = schedule.class_name;
    const { data: studentData } = await supabase
      .from("students")
      .select("id, name, student_id, class, photo_url")
      .eq("school_id", schoolId!)
      .eq("class", className)
      .order("name");

    const studentsList = studentData || [];
    setStudents(studentsList);

    const todayStr = today.toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("subject_attendance")
      .select("student_id, status, notes")
      .eq("teaching_schedule_id", schedule.id)
      .eq("date", todayStr);

    const existMap: Record<string, string> = {};
    const attMap: Record<string, string> = {};
    let existingNote = "";
    (existing || []).forEach((e: any) => {
      existMap[e.student_id] = e.status;
      attMap[e.student_id] = e.status;
      if (e.notes && !existingNote) existingNote = e.notes;
    });

    studentsList.forEach(s => {
      if (!attMap[s.id]) attMap[s.id] = "hadir";
    });

    setExistingAttendance(existMap);
    setAttendanceMap(attMap);
    setSessionNote(existingNote);
    setLoadingStudents(false);
  };

  const handleSaveAttendance = async () => {
    if (!selectedSchedule || !user || !schoolId) return;
    setSavingAttendance(true);

    const todayStr = today.toISOString().split("T")[0];
    const trimmedNote = sessionNote.trim();
    const records = students.map(s => ({
      student_id: s.id,
      teaching_schedule_id: selectedSchedule.id,
      school_id: schoolId,
      teacher_id: user.id,
      date: todayStr,
      status: attendanceMap[s.id] || "hadir",
      notes: trimmedNote || null,
    }));

    const { error } = await supabase
      .from("subject_attendance")
      .upsert(records, { onConflict: "student_id,teaching_schedule_id,date" });

    if (error) {
      toast.error("Gagal menyimpan absensi: " + error.message);
    } else {
      toast.success(`Absensi ${selectedSchedule.subject_name} berhasil disimpan`);
      setAttendanceDialog(false);
    }
    setSavingAttendance(false);
  };

  const statusOptions = [
    { value: "hadir", label: "Hadir", icon: CheckCircle, color: "text-emerald-600" },
    { value: "izin", label: "Izin", icon: AlertCircle, color: "text-amber-600" },
    { value: "sakit", label: "Sakit", icon: AlertCircle, color: "text-blue-600" },
    { value: "alfa", label: "Alfa", icon: XCircle, color: "text-red-600" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (profile?.full_name || "G").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const homeroomLabel = homeroomAssignments.length > 0
    ? `Wali Kelas ${homeroomAssignments.map(h => h.class_name).join(", ")}`
    : "Guru Mapel";

  return (
    <div className="space-y-5">
      {/* Profile Hero Card — mobile-first */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#4c5ded] p-5 sm:p-6 text-white shadow-elevated">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <svg className="absolute top-0 right-0 opacity-10" width="160" height="160" viewBox="0 0 160 160" fill="none">
            <pattern id="th-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="white" />
            </pattern>
            <rect width="160" height="160" fill="url(#th-dots)" />
          </svg>

          <div className="relative z-10 flex items-center gap-4">
            <div className="h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/70 font-medium">Selamat datang</p>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">{profile?.full_name || "Guru"}</h1>
              <p className="text-[11px] sm:text-xs text-white/80 mt-0.5 truncate">{homeroomLabel}</p>
            </div>
          </div>

          {/* Stats trio inside hero */}
          <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
            {[
              { label: "Jadwal", value: todaySchedules.length, sub: "Hari ini" },
              { label: "Aktif", value: activeCount, sub: "Berlangsung" },
              { label: "Mapel", value: totalSubjects, sub: "Diampu" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{s.label}</p>
                <p className="text-xl sm:text-2xl font-bold leading-none mt-1">{s.value}</p>
                <p className="text-[9px] text-white/70 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* HERO REMINDER: Absensi MAPEL — only 15 min before start or during active teaching schedule */}
      {(() => {
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const relevant = todaySchedules.find(s => {
          const start = timeToMinutes(s.start_time);
          const end = timeToMinutes(s.end_time);
          return (currentMin >= start && currentMin < end) || (start - currentMin > 0 && start - currentMin <= 15);
        });
        if (!relevant) return null;
        const relevantStatus = getStatus(relevant.start_time, relevant.end_time, now);
        const minutesToStart = timeToMinutes(relevant.start_time) - currentMin;
        const done = subjectAttendanceToday[relevant.id] || 0;
        const total = classStudentCount[relevant.class_name || ""] || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const isComplete = total > 0 && done >= total;
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-0 shadow-elevated overflow-hidden">
              <CardContent className="p-0">
                <div className="relative bg-gradient-to-br from-primary via-primary to-[#4c5ded] p-5 sm:p-6 text-white overflow-hidden">
                  <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                  <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
                        <ClipboardCheck className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Bell className="h-3.5 w-3.5 text-amber-300" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                            Pengingat Absensi Mapel
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold leading-tight">
                          {isComplete ? `Absensi ${relevant.subject_name} Selesai` : relevantStatus === "active" ? `Waktunya Absensi: ${relevant.subject_name}` : `Sebentar Lagi: ${relevant.subject_name}`}
                        </h3>
                        <p className="text-xs sm:text-sm text-white/80 mt-0.5">
                          Kelas {relevant.class_name} • {relevant.start_time.slice(0,5)}–{relevant.end_time.slice(0,5)}
                          {relevantStatus === "upcoming" && minutesToStart > 0 ? ` • mulai dalam ${minutesToStart} mnt` : ""}
                          {total > 0 ? ` • ${done}/${total} siswa tercatat` : ""}
                        </p>
                        {total > 0 && (
                          <div className="mt-2.5 h-2 rounded-full bg-white/15 overflow-hidden max-w-xs">
                            <motion.div
                              className={cn("h-full rounded-full", isComplete ? "bg-emerald-300" : "bg-amber-300")}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8 }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => openAttendance(relevant)}
                      className="bg-white text-primary hover:bg-white/90 font-bold rounded-xl shadow-lg shrink-0 h-12 px-6"
                    >
                      <ClipboardCheck className="h-5 w-5 mr-2" />
                      {isComplete ? "Lihat / Ubah" : "Absensi Mapel"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {/* School Announcements */}
      {profile?.school_id && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SchoolAnnouncementsWidget schoolId={profile.school_id} />
        </motion.div>
      )}

      {/* Today's Schedule */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold leading-tight">Jadwal Hari Ini</h2>
            <p className="text-xs text-muted-foreground">{DAYS[todayDay]}, {today.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</p>
          </div>
          <button
            onClick={() => navigate("/teaching-schedule")}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            Lihat Semua <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {todaySchedules.length === 0 ? (
          <Card className="border-0 shadow-card">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Tidak ada jadwal mengajar hari ini</p>
            </CardContent>
          </Card>
        ) : (() => {
          const activeSched = todaySchedules.find(s => getStatus(s.start_time, s.end_time, now) === "active");
          const upcomingSched = todaySchedules.find(s => getStatus(s.start_time, s.end_time, now) === "upcoming");
          const doneList = todaySchedules.filter(s => getStatus(s.start_time, s.end_time, now) === "done");
          const latestDone = doneList.length ? doneList[doneList.length - 1] : null;
          const featured = activeSched || upcomingSched || latestDone;
          const others = todaySchedules.filter(s => s.id !== featured?.id);
          const featuredStatus = featured ? getStatus(featured.start_time, featured.end_time, now) : null;
          const currentMin = now.getHours() * 60 + now.getMinutes();

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* FEATURED: Now / Next Up */}
              {featured && (
                <Card
                  onClick={() => openAttendance(featured)}
                  className="lg:col-span-1 border-0 shadow-elevated cursor-pointer overflow-hidden group hover:scale-[1.01] transition-transform"
                >
                  <div
                    className="relative p-5 text-white overflow-hidden h-full"
                    style={{
                      background: featuredStatus === "active"
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : `linear-gradient(135deg, ${featured.subject_color}, ${featured.subject_color}dd)`,
                    }}
                  >
                    <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        {featuredStatus === "active" ? (
                          <Badge className="bg-white/25 backdrop-blur-sm text-white border-white/30 text-[10px] gap-1 animate-pulse">
                            <PlayCircle className="h-3 w-3" /> SEDANG BERLANGSUNG
                          </Badge>
                        ) : featuredStatus === "done" ? (
                          <Badge className="bg-white/25 backdrop-blur-sm text-white border-white/30 text-[10px] gap-1">
                            <CheckCircle className="h-3 w-3" /> SELESAI · MASIH BISA ABSEN
                          </Badge>
                        ) : (
                          <Badge className="bg-white/25 backdrop-blur-sm text-white border-white/30 text-[10px] gap-1">
                            <Timer className="h-3 w-3" /> JADWAL BERIKUTNYA
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold leading-tight mb-1">{featured.subject_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-white/90 mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Kelas {featured.class_name}</span>
                        {featured.room && (
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {featured.room}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/80 font-mono mb-4 flex-wrap">
                        <Clock className="h-3.5 w-3.5" />
                        {featured.start_time.slice(0, 5)} — {featured.end_time.slice(0, 5)}
                        {featuredStatus === "upcoming" && (() => {
                          const mins = timeToMinutes(featured.start_time) - currentMin;
                          if (mins > 0 && mins <= 180) {
                            return <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20">{mins} menit lagi</span>;
                          }
                          return null;
                        })()}
                      </div>
                      {featuredStatus === "active" && (() => {
                        const start = timeToMinutes(featured.start_time);
                        const end = timeToMinutes(featured.end_time);
                        const progress = Math.min(100, Math.max(0, ((currentMin - start) / (end - start)) * 100));
                        return (
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-[10px] mb-1 text-white/80">
                              <span>Progress</span><span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                              <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                      <Button className="w-full bg-white text-foreground hover:bg-white/90 font-bold rounded-xl">
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Absensi Mapel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* COMPACT LIST: other sessions */}
              <div className={cn(featured ? "lg:col-span-2" : "lg:col-span-3")}>
                <Card className="border-0 shadow-card h-full">
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                      Sesi Lainnya Hari Ini
                    </p>
                    {others.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Tidak ada sesi lain
                      </div>
                    ) : others.map((s) => {
                      const status = getStatus(s.start_time, s.end_time, now);
                      return (
                        <button
                          key={s.id}
                          onClick={() => openAttendance(s)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all hover:bg-muted/50 group",
                            status === "done" && "opacity-60",
                          )}
                        >
                          <div className="flex flex-col items-center justify-center w-14 shrink-0 py-1 rounded-lg bg-muted/50 font-mono">
                            <span className="text-sm font-bold leading-tight">{s.start_time.slice(0, 5)}</span>
                            <span className="text-[9px] text-muted-foreground leading-tight">{s.end_time.slice(0, 5)}</span>
                          </div>
                          <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: s.subject_color }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{s.subject_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Kelas {s.class_name}{s.room ? ` • ${s.room}` : ""}
                            </p>
                          </div>
                          {status === "done" ? (
                            <Badge variant="secondary" className="text-[9px] shrink-0">Selesai</Badge>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-[11px] gap-1 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground">
                              Absen <ChevronRight className="h-3 w-3" />
                            </Button>
                          )}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}
      </motion.div>

      {/* Full Week Schedule — Mobile App Style */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <WeekScheduleCard
          weekSchedules={weekSchedules}
          todayDay={todayDay}
          now={now}
          totalSessions={schedules.length}
          onSelectSchedule={openAttendance}
        />
      </motion.div>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialog} onOpenChange={setAttendanceDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Absensi {selectedSchedule?.subject_name} — Kelas {selectedSchedule?.class_name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {DAYS[todayDay]}, {today.toLocaleDateString("id-ID")} • {selectedSchedule?.start_time?.slice(0, 5)} - {selectedSchedule?.end_time?.slice(0, 5)}
            </p>
          </DialogHeader>

          {loadingStudents ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Memuat data siswa...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada siswa di kelas ini</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/30">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">NIS: {s.student_id}</p>
                    </div>
                    <Select
                      value={attendanceMap[s.id] || "hadir"}
                      onValueChange={(val) => setAttendanceMap(prev => ({ ...prev, [s.id]: val }))}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-1.5">
                              <opt.icon className={`h-3 w-3 ${opt.color}`} />
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {statusOptions.map(opt => {
                  const count = Object.values(attendanceMap).filter(v => v === opt.value).length;
                  return (
                    <Badge key={opt.value} variant="secondary" className="text-[10px]">
                      {opt.label}: {count}
                    </Badge>
                  );
                })}
              </div>

              <Button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="w-full mt-2 bg-primary hover:bg-primary/90 rounded-xl"
              >
                {savingAttendance ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Simpan Absensi</>
                )}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
