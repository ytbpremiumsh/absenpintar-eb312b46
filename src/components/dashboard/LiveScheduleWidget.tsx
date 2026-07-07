import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, PlayCircle, Timer, CheckCircle2, Users, BookOpen, MapPin, ChevronRight, ChevronLeft, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface Schedule {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}

interface Subject { id: string; name: string; color: string | null; }
interface ClassData { id: string; name: string; }
interface TeacherProfile { user_id: string; full_name: string; }

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

// Premium gradient palette (cycled per index when subject color is fallback)
const GRADIENTS = [
  { from: "from-violet-500", to: "to-fuchsia-500", solid: "bg-violet-500", text: "text-violet-600", soft: "bg-violet-500/10" },
  { from: "from-amber-400", to: "to-orange-500", solid: "bg-amber-500", text: "text-amber-600", soft: "bg-amber-500/10" },
  { from: "from-sky-500", to: "to-blue-600", solid: "bg-sky-500", text: "text-sky-600", soft: "bg-sky-500/10" },
  { from: "from-emerald-500", to: "to-teal-600", solid: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-500/10" },
  { from: "from-pink-500", to: "to-rose-500", solid: "bg-pink-500", text: "text-pink-600", soft: "bg-pink-500/10" },
  { from: "from-indigo-500", to: "to-purple-600", solid: "bg-indigo-500", text: "text-indigo-600", soft: "bg-indigo-500/10" },
];

export function LiveScheduleWidget({ schoolId }: { schoolId: string }) {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [now, setNow] = useState(new Date());

  const jsDay = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("teaching_schedules").select("id, teacher_id, subject_id, class_id, day_of_week, start_time, end_time, room").eq("school_id", schoolId).eq("is_active", true),
      supabase.from("subjects").select("id, name, color").eq("school_id", schoolId),
      supabase.from("classes").select("id, name").eq("school_id", schoolId),
      supabase.from("profiles").select("user_id, full_name").eq("school_id", schoolId),
    ]).then(([sr, subr, cr, tr]) => {
      if (sr.data) setSchedules(sr.data);
      if (subr.data) setSubjects(subr.data);
      if (cr.data) setClasses(cr.data);
      if (tr.data) setTeachers(tr.data);
    });
  }, [schoolId]);

  const getTeacherName = (id: string) => teachers.find((t) => t.user_id === id)?.full_name || "—";
  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name || "—";
  const getClassName = (id: string) => classes.find((c) => c.id === id)?.name || "—";

  const todaySchedules = useMemo(() => {
    return schedules
      .filter((s) => s.day_of_week === todayIdx)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }, [schedules, todayIdx]);

  const activeCount = todaySchedules.filter((s) => getStatus(s.start_time, s.end_time, now) === "active").length;
  const upcomingCount = todaySchedules.filter((s) => getStatus(s.start_time, s.end_time, now) === "upcoming").length;
  const doneCount = todaySchedules.filter((s) => getStatus(s.start_time, s.end_time, now) === "done").length;

  // Find currently active or next upcoming
  const featuredIdx = useMemo(() => {
    const active = todaySchedules.findIndex(s => getStatus(s.start_time, s.end_time, now) === "active");
    if (active !== -1) return active;
    const upcoming = todaySchedules.findIndex(s => getStatus(s.start_time, s.end_time, now) === "upcoming");
    return upcoming !== -1 ? upcoming : 0;
  }, [todaySchedules, now]);

  if (todaySchedules.length === 0) {
    return (
      <Card className="rounded-3xl border-0 shadow-elevated overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary via-primary to-[#4c5ded] p-6 text-white">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-80">Jadwal Hari Ini</p>
              <h3 className="font-bold text-lg">Tidak ada jadwal mengajar</h3>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const todayDateLabel = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Card className="rounded-3xl border-0 shadow-elevated overflow-hidden">
      {/* Premium Hero Header */}
      <div className="relative bg-gradient-to-br from-primary via-primary to-[#4c5ded] px-5 pt-5 pb-14 sm:px-6 sm:pt-6 sm:pb-16 text-white overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-4 right-24 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
        <svg className="absolute top-0 right-0 opacity-10 pointer-events-none" width="160" height="160" viewBox="0 0 160 160" fill="none">
          <pattern id="dots-live" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="white" />
          </pattern>
          <rect width="160" height="160" fill="url(#dots-live)" />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{todayDateLabel}</p>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight mt-0.5 flex items-center gap-2">
              <Radio className="h-5 w-5 animate-pulse" />
              Jadwal Live
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/live-schedule")}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur rounded-full text-[11px] h-8 px-3 gap-1"
          >
            Lihat Semua
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Stat pills */}
        <div className="relative z-10 flex gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-300" />
            </span>
            <span className="text-[11px] font-bold">{activeCount} Live</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1">
            <Timer className="h-3 w-3" />
            <span className="text-[11px] font-bold">{upcomingCount} Akan</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[11px] font-bold">{doneCount} Selesai</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1">
            <Sparkles className="h-3 w-3" />
            <span className="text-[11px] font-bold">{todaySchedules.length} Total</span>
          </div>
        </div>
      </div>

      {/* Single featured card carousel — overlapping the hero */}
      <CardContent className="px-3 sm:px-5 -mt-8 pb-5 relative z-10">
        <div className="bg-card rounded-2xl border border-border/30 shadow-card p-3 sm:p-4">
          <CarouselCard
            schedules={todaySchedules}
            initialIdx={featuredIdx}
            now={now}
            getSubjectName={getSubjectName}
            getClassName={getClassName}
            getTeacherName={getTeacherName}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CarouselCard({
  schedules,
  initialIdx,
  now,
  getSubjectName,
  getClassName,
  getTeacherName,
}: {
  schedules: Schedule[];
  initialIdx: number;
  now: Date;
  getSubjectName: (id: string) => string;
  getClassName: (id: string) => string;
  getTeacherName: (id: string) => string;
}) {
  const [idx, setIdx] = useState(initialIdx);
  useEffect(() => { setIdx(initialIdx); }, [initialIdx]);

  if (schedules.length === 0) return null;
  const safeIdx = ((idx % schedules.length) + schedules.length) % schedules.length;
  const s = schedules[safeIdx];
  const status = getStatus(s.start_time, s.end_time, now);
  const palette = GRADIENTS[safeIdx % GRADIENTS.length];

  const prev = () => setIdx((i) => i - 1);
  const next = () => setIdx((i) => i + 1);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "rounded-2xl p-4 sm:p-5 relative overflow-hidden",
            status === "active" || status === "upcoming"
              ? `bg-gradient-to-br ${palette.from} ${palette.to} text-white shadow-lg`
              : "bg-muted/40 text-muted-foreground"
          )}
        >
          {/* Decorative blobs */}
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center backdrop-blur",
                status === "done" ? "bg-muted-foreground/20" : "bg-white/20"
              )}>
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className={cn(
                  "text-[10px] uppercase tracking-wider font-medium",
                  status === "done" ? "opacity-70" : "text-white/80"
                )}>
                  Sesi {safeIdx + 1} dari {schedules.length}
                </p>
                <p className="text-[11px] font-mono font-bold">
                  {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                </p>
              </div>
            </div>
            {status === "active" && (
              <span className="flex items-center gap-1 bg-white/25 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                <PlayCircle className="h-3 w-3" /> LIVE
              </span>
            )}
            {status === "upcoming" && safeIdx === initialIdx && (
              <span className="flex items-center gap-1 bg-white/25 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                <Timer className="h-3 w-3" /> Berikutnya
              </span>
            )}
            {status === "done" && (
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> Selesai
              </span>
            )}
          </div>

          <h3 className={cn(
            "relative z-10 text-lg sm:text-xl font-bold leading-tight mb-2",
            status === "done" && "line-through"
          )}>
            {getSubjectName(s.subject_id)}
          </h3>

          <div className={cn(
            "relative z-10 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px]",
            status === "done" ? "" : "text-white/90"
          )}>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {getTeacherName(s.teacher_id)}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Kelas {getClassName(s.class_id)}
            </span>
            {s.room && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {s.room}
              </span>
            )}
          </div>

          {/* Live progress */}
          {status === "active" && (() => {
            const currentMin = now.getHours() * 60 + now.getMinutes();
            const start = timeToMinutes(s.start_time);
            const end = timeToMinutes(s.end_time);
            const progress = Math.min(100, Math.max(0, ((currentMin - start) / (end - start)) * 100));
            return (
              <div className="relative z-10 mt-3">
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-white/85 mt-1 font-mono">{Math.round(progress)}% berjalan</p>
              </div>
            );
          })()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {schedules.length > 1 && (
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="outline"
            size="icon"
            onClick={prev}
            className="h-8 w-8 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            {schedules.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === safeIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
                aria-label={`Sesi ${i + 1}`}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={next}
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
