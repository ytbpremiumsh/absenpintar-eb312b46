import { PageHeader } from "@/components/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  CalendarOff, CalendarDays, Trash2, Info, Plus, Pencil, Eye,
  BookOpen, PartyPopper, Users, Megaphone, Sparkles, GraduationCap,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type EventType = "holiday" | "exam" | "event" | "meeting" | "announcement" | "other";

interface CalendarEvent {
  id: string;
  date: string;
  label: string | null;
  description: string | null;
  event_type: EventType;
  is_holiday: boolean;
}

const EVENT_META: Record<EventType, { label: string; icon: any; badge: string; solid: string; ring: string; dot: string; tile: string }> = {
  holiday:      { label: "Libur / Tanggal Merah", icon: CalendarOff,   badge: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50",             solid: "bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50",           ring: "ring-red-300/60",     dot: "bg-red-400",     tile: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/40" },
  exam:         { label: "Ujian",                  icon: GraduationCap, badge: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",   solid: "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50", ring: "ring-amber-300/60",   dot: "bg-amber-400",   tile: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40" },
  event:        { label: "Kegiatan / Acara",       icon: PartyPopper,   badge: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50", solid: "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50", ring: "ring-emerald-300/60", dot: "bg-emerald-400", tile: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/40" },
  meeting:      { label: "Rapat",                  icon: Users,         badge: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50",             solid: "bg-sky-50 text-sky-700 border border-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50",         ring: "ring-sky-300/60",     dot: "bg-sky-400",     tile: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/40" },
  announcement: { label: "Pengumuman",             icon: Megaphone,     badge: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/50", solid: "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/50", ring: "ring-violet-300/60",  dot: "bg-violet-400",  tile: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:border-violet-900/40" },
  other:        { label: "Lainnya",                icon: Sparkles,      badge: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800",         solid: "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800",   ring: "ring-slate-300/60",   dot: "bg-slate-400",   tile: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800" },
};

const EVENT_TYPES: EventType[] = ["holiday", "exam", "event", "meeting", "announcement", "other"];

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const KalenderAkademik = () => {
  const { profile, roles } = useAuth();
  const canEdit = roles.includes("school_admin") || roles.includes("super_admin");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [dialogEndDate, setDialogEndDate] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<{ label: string; description: string; event_type: EventType; is_holiday: boolean }>({
    label: "",
    description: "",
    event_type: "holiday",
    is_holiday: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [dateMode, setDateMode] = useState<"single" | "range">("single");

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    supabase.from("school_holidays")
      .select("id, date, label, description, event_type, is_holiday")
      .eq("school_id", profile.school_id).order("date")
      .then(({ data }) => {
        setEvents(((data || []) as any[]).map((r) => ({
          id: r.id,
          date: r.date,
          label: r.label,
          description: r.description ?? null,
          event_type: (r.event_type as EventType) ?? "holiday",
          is_holiday: r.is_holiday ?? true,
        })));
        setLoading(false);
      });
  }, [profile?.school_id]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const modifiers = useMemo(() => {
    const holiday: Date[] = [];
    const exam: Date[] = [];
    const event: Date[] = [];
    const meeting: Date[] = [];
    const announcement: Date[] = [];
    const other: Date[] = [];
    for (const [date, list] of Object.entries(eventsByDate)) {
      const d = new Date(date + "T00:00:00");
      if (list.some((e) => e.is_holiday)) { holiday.push(d); continue; }
      const primary = list[0]?.event_type ?? "other";
      ({ exam, event, meeting, announcement, other } as any)[primary]?.push(d);
    }
    return { holiday, exam, event, meeting, announcement, other };
  }, [eventsByDate]);

  // Group consecutive dates with identical (event_type, is_holiday, label, description) into one range
  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const groups: { key: string; items: CalendarEvent[]; startDate: string; endDate: string }[] = [];
    for (const e of sorted) {
      const last = groups[groups.length - 1];
      const sameMeta = last
        && last.items[0].event_type === e.event_type
        && last.items[0].is_holiday === e.is_holiday
        && (last.items[0].label || "") === (e.label || "")
        && (last.items[0].description || "") === (e.description || "");
      const prevDate = last ? new Date(last.endDate + "T00:00:00") : null;
      const curDate = new Date(e.date + "T00:00:00");
      const consecutive = prevDate && (curDate.getTime() - prevDate.getTime()) === 86400000;
      if (sameMeta && consecutive) {
        last!.items.push(e);
        last!.endDate = e.date;
      } else {
        groups.push({ key: e.id, items: [e], startDate: e.date, endDate: e.date });
      }
    }
    return groups;
  }, [events]);




  const openCreateDialog = (range: DateRange | Date) => {
    if (!canEdit) return;
    let from: Date; let to: Date;
    if (range instanceof Date) { from = range; to = range; }
    else {
      if (!range?.from) return;
      from = range.from;
      to = range.to ?? range.from;
    }
    const isRange = toDateKey(from) !== toDateKey(to);
    setEditingEvent(null);
    setDialogDate(toDateKey(from));
    setDialogEndDate(toDateKey(to));
    setSelectedRange({ from, to });
    setDateMode(isRange ? "range" : "single");
    setForm({ label: "", description: "", event_type: "holiday", is_holiday: true });
    setDialogOpen(true);
  };

  const openEditDialog = (evt: CalendarEvent) => {
    if (!canEdit) return;
    setEditingEvent(evt);
    setDialogDate(evt.date);
    setDialogEndDate(evt.date);
    setSelectedRange(undefined);
    setForm({
      label: evt.label || "",
      description: evt.description || "",
      event_type: evt.event_type,
      is_holiday: evt.is_holiday,
    });
    setDialogOpen(true);
  };

  const handleTypeChange = (t: EventType) => {
    setForm((f) => ({
      ...f,
      event_type: t,
      is_holiday: editingEvent ? f.is_holiday : t === "holiday",
    }));
  };

  const handleSave = async () => {
    if (!profile?.school_id || !dialogDate || !canEdit) return;
    setSubmitting(true);
    if (editingEvent) {
      const payload = {
        school_id: profile.school_id,
        date: dialogDate,
        label: form.label.trim() || null,
        description: form.description.trim() || null,
        event_type: form.event_type,
        is_holiday: form.is_holiday,
      };
      const { data, error } = await supabase.from("school_holidays")
        .update(payload as any).eq("id", editingEvent.id).select().single();
      setSubmitting(false);
      if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
      setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? {
        ...e,
        label: (data as any).label,
        description: (data as any).description,
        event_type: (data as any).event_type,
        is_holiday: (data as any).is_holiday,
      } : e));
      toast.success("Acara diperbarui");
    } else {
      const start = new Date(dialogDate + "T00:00:00");
      const end = new Date((dialogEndDate || dialogDate) + "T00:00:00");
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(toDateKey(d));
      }
      const rows = dates.map((date) => ({
        school_id: profile.school_id,
        date,
        label: form.label.trim() || null,
        description: form.description.trim() || null,
        event_type: form.event_type,
        is_holiday: form.is_holiday,
      }));
      const { data, error } = await supabase.from("school_holidays")
        .insert(rows as any).select();
      setSubmitting(false);
      if (error) { toast.error("Gagal menambahkan: " + error.message); return; }
      const inserted = ((data || []) as any[]).map((r) => ({
        id: r.id, date: r.date, label: r.label,
        description: r.description, event_type: r.event_type, is_holiday: r.is_holiday,
      }));
      setEvents((prev) => [...prev, ...inserted].sort((a, b) => a.date.localeCompare(b.date)));
      toast.success(dates.length > 1 ? `${dates.length} acara ditambahkan ke kalender` : "Acara ditambahkan ke kalender");
    }
    setDialogOpen(false);
  };

  const handleRemove = async (id: string) => {
    if (!canEdit) return;
    const { error } = await supabase.from("school_holidays").delete().eq("id", id);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    toast.success("Acara dihapus");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Kalender Akademik Sekolah"
        subtitle={canEdit
          ? "Kelola tanggal libur, ujian, kegiatan, rapat, dan pengumuman sekolah dalam satu kalender"
          : "Lihat jadwal libur & kegiatan akademik sekolah"}
      />

      <div className="relative overflow-hidden rounded-2xl border border-[#5B6CF9]/15 bg-gradient-to-r from-[#5B6CF9]/[0.06] via-white to-white dark:from-[#5B6CF9]/10 dark:via-slate-900/40 dark:to-slate-900/40 p-4 flex items-start gap-3">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#5B6CF9] to-[#8B98FB]" />
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#7683FA] shadow-md shadow-[#5B6CF9]/20 flex items-center justify-center shrink-0">
          {canEdit ? <BookOpen className="h-4 w-4 text-white" /> : <Eye className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5B6CF9]/10 text-[#5B6CF9] px-2 py-0.5 text-[10px] font-semibold tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5B6CF9]" />
              PANDUAN
            </span>
            <span className="text-[11px] font-semibold text-foreground/80">Kalender Akademik</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {canEdit ? (
              <>
                Klik tanggal (atau tarik rentang) di kalender untuk menambah acara. Pilih jenis acara (libur, ujian, kegiatan, rapat, pengumuman)
                dan aktifkan <span className="font-semibold text-foreground">"Tandai sebagai Hari Libur"</span> bila acara tersebut menangguhkan absensi.
              </>
            ) : (
              <>
                Penambahan atau perubahan kalender akademik hanya bisa dilakukan oleh <span className="font-semibold text-foreground">Operator Sekolah</span>.
              </>
            )}
          </p>
        </div>
      </div>


      <Card className="border-0 shadow-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#8B98FB] via-[#7683FA] to-[#5B6CF9] px-5 py-4 text-white">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "18px 18px" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-lg">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Kalender Akademik {year}</h2>
                <p className="text-[11px] text-white/70 mt-0.5">
                  {canEdit ? "Kelola agenda sekolah dari tombol Tambah Kalender." : "Agenda akademik sekolah — hanya untuk dilihat."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setYear((y) => y - 1)}
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition"
                aria-label="Tahun sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[72px] text-center font-bold text-lg tracking-wide">{year}</div>
              <button
                onClick={() => setYear((y) => y + 1)}
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition"
                aria-label="Tahun berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {canEdit && (
                <Button
                  size="sm"
                  className="h-9 ml-2 text-[11px] gap-1 bg-white text-[#5B6CF9] hover:bg-white/90 border-0 shadow-md font-semibold"
                  onClick={() => openCreateDialog(new Date())}
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah
                </Button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 pt-5">
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((t) => {
              const meta = EVENT_META[t];
              const Icon = meta.icon;
              return (
                <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              );
            })}
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Memuat kalender...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, m) => {
                const monthName = new Date(year, m, 1).toLocaleDateString("id-ID", { month: "long" });
                const firstDay = new Date(year, m, 1);
                const daysInMonth = new Date(year, m + 1, 0).getDate();
                const startOffset = firstDay.getDay(); // 0=Sun
                const cells: (number | null)[] = [];
                for (let i = 0; i < startOffset; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);

                const monthEvents = events.filter((e) => {
                  const d = new Date(e.date + "T00:00:00");
                  return d.getFullYear() === year && d.getMonth() === m;
                });

                const eventMap: Record<number, CalendarEvent[]> = {};
                for (const e of monthEvents) {
                  const day = new Date(e.date + "T00:00:00").getDate();
                  (eventMap[day] ??= []).push(e);
                }

                return (
                  <div key={m} className="rounded-2xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-baseline justify-between mb-2 px-1">
                      <h3 className="text-sm font-bold tracking-tight">{monthName}</h3>
                      <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                        {String(m + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase tracking-wider mb-1">
                      {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d, i) => (
                        <div key={d} className={i === 0 ? "text-red-500 py-1" : "text-muted-foreground py-1"}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {cells.map((day, idx) => {
                        if (day === null) return <div key={idx} className="aspect-square" />;
                        const dayEvents = eventMap[day] || [];
                        const dow = (startOffset + day - 1) % 7;
                        const isSunday = dow === 0;
                        const primary = dayEvents[0];
                        const isHoliday = dayEvents.some((e) => e.is_holiday) || isSunday;
                        const meta = primary ? EVENT_META[primary.event_type] : null;

                        let cellClass = "text-foreground";
                        if (primary?.is_holiday) cellClass = "bg-red-500 text-white font-bold shadow-sm shadow-red-500/40";
                        else if (primary && meta) cellClass = `${meta.badge} font-semibold`;
                        else if (isSunday) cellClass = "text-red-500 font-semibold";

                        const dateLabel = new Date(year, m, day).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

                        const button = (
                          <button
                            key={idx}
                            onClick={() => primary && canEdit && openEditDialog(primary)}
                            className={`aspect-square w-full rounded-lg text-[11px] flex items-center justify-center transition ${cellClass} ${primary && canEdit ? "cursor-pointer hover:ring-2 hover:ring-[#5B6CF9]/40" : primary ? "cursor-help" : ""}`}
                          >
                            {day}
                          </button>
                        );

                        if (dayEvents.length === 0) return <div key={idx}>{button}</div>;

                        return (
                          <HoverCard key={idx} openDelay={80} closeDelay={60}>
                            <HoverCardTrigger asChild>{button}</HoverCardTrigger>
                            <HoverCardContent side="top" align="center" className="w-64 p-3">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                {dateLabel}
                              </div>
                              <div className="space-y-2">
                                {dayEvents.map((e) => {
                                  const em = EVENT_META[e.event_type];
                                  const EIcon = em.icon;
                                  return (
                                    <div key={e.id} className="flex items-start gap-2">
                                      <span className={`shrink-0 h-6 w-6 rounded-md flex items-center justify-center ${em.badge}`}>
                                        <EIcon className="h-3 w-3" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold leading-snug">
                                          {e.label || em.label}
                                          {e.is_holiday && (
                                            <span className="ml-1.5 inline-block text-[9px] font-bold text-red-500 align-middle">• LIBUR</span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{em.label}</div>
                                        {e.description && (
                                          <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{e.description}</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>

                    {monthEvents.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                        {(() => {
                          // Group consecutive same-meta events into ranges within this month
                          const sorted = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date));
                          const groups: { items: CalendarEvent[] }[] = [];
                          for (const e of sorted) {
                            const last = groups[groups.length - 1];
                            const sameMeta = last
                              && last.items[0].event_type === e.event_type
                              && last.items[0].is_holiday === e.is_holiday
                              && (last.items[0].label || "") === (e.label || "");
                            const prevDay = last ? new Date(last.items[last.items.length - 1].date + "T00:00:00").getDate() : 0;
                            const curDay = new Date(e.date + "T00:00:00").getDate();
                            if (sameMeta && curDay - prevDay === 1) last.items.push(e);
                            else groups.push({ items: [e] });
                          }
                          return groups.map((g, gi) => {
                            const first = g.items[0];
                            const last = g.items[g.items.length - 1];
                            const meta = EVENT_META[first.event_type];
                            const startDay = new Date(first.date + "T00:00:00").getDate();
                            const endDay = new Date(last.date + "T00:00:00").getDate();
                            const dayLabel = g.items.length > 1 ? `${startDay}–${endDay}` : String(startDay);
                            return (
                              <div key={gi} className="flex items-start gap-2 text-[11px] leading-snug">
                                <span className={`shrink-0 min-w-[34px] text-center rounded px-1 py-0.5 font-bold ${meta.badge}`}>
                                  {dayLabel}
                                </span>
                                <span className="min-w-0 flex-1 pt-0.5">
                                  <span className="font-semibold text-foreground">{first.label || meta.label}</span>
                                  {first.is_holiday && (
                                    <span className="ml-1 text-[9px] font-semibold text-red-500">• Libur</span>
                                  )}
                                </span>
                                {canEdit && (
                                  <button
                                    onClick={async () => {
                                      if (g.items.length > 1) {
                                        if (!confirm(`Hapus ${g.items.length} acara?`)) return;
                                        for (const it of g.items) await handleRemove(it.id);
                                      } else {
                                        await handleRemove(first.id);
                                      }
                                    }}
                                    className="opacity-40 hover:opacity-100 shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Ubah Acara" : "Tambah Acara Kalender"}</DialogTitle>
            <DialogDescription>
              {dialogDate && (() => {
                const start = new Date(dialogDate + "T00:00:00");
                const end = new Date((dialogEndDate || dialogDate) + "T00:00:00");
                const sameDay = dialogDate === (dialogEndDate || dialogDate);
                const fmt = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                if (sameDay) return fmt(start);
                const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                return `${fmt(start)} — ${fmt(end)} (${days} hari)`;
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingEvent && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold">Pilih Tanggal</Label>
                  <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setDateMode("single");
                        const base = selectedRange?.from ?? (dialogDate ? new Date(dialogDate + "T00:00:00") : new Date());
                        setSelectedRange({ from: base, to: base });
                        setDialogDate(toDateKey(base));
                        setDialogEndDate(toDateKey(base));
                      }}
                      className={`px-2.5 py-1 rounded-[5px] transition ${dateMode === "single" ? "bg-[#5B6CF9] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      1 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("range")}
                      className={`px-2.5 py-1 rounded-[5px] transition ${dateMode === "range" ? "bg-[#5B6CF9] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Rentang
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {dateMode === "single"
                    ? "Klik satu tanggal untuk membuat acara pada hari tersebut."
                    : "Klik tanggal mulai, lalu klik tanggal akhir untuk memilih rentang."}
                </p>
                <div className="flex justify-center">
                  {dateMode === "single" ? (
                    <Calendar
                      mode="single"
                      selected={selectedRange?.from}
                      onSelect={(d) => {
                        if (!d) return;
                        setSelectedRange({ from: d, to: d });
                        setDialogDate(toDateKey(d));
                        setDialogEndDate(toDateKey(d));
                      }}
                      numberOfMonths={1}
                      className="p-0 pointer-events-auto"
                    />
                  ) : (
                    <Calendar
                      mode="range"
                      selected={selectedRange}
                      onSelect={(r) => {
                        setSelectedRange(r);
                        if (r?.from) {
                          setDialogDate(toDateKey(r.from));
                          setDialogEndDate(toDateKey(r.to ?? r.from));
                        }
                      }}
                      numberOfMonths={1}
                      className="p-0 pointer-events-auto"
                    />
                  )}
                </div>
                {dateMode === "range" && dialogDate && dialogEndDate && dialogEndDate !== dialogDate && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Rentang: <strong className="text-foreground">{Math.round((new Date(dialogEndDate + "T00:00:00").getTime() - new Date(dialogDate + "T00:00:00").getTime()) / 86400000) + 1} hari</strong> — akan dibuat 1 entri per tanggal.
                  </p>
                )}
              </div>
            )}


            <div>
              <Label className="text-xs">Jenis Acara</Label>
              <Select value={form.event_type} onValueChange={(v) => handleTypeChange(v as EventType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => {
                    const meta = EVENT_META[t];
                    const Icon = meta.icon;
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" /> {meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Judul Acara</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Contoh: Ujian Tengah Semester, HUT RI, Rapat Guru"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Deskripsi (Opsional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detail tambahan tentang acara ini..."
                rows={3}
                className="mt-1 text-sm resize-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <div className="min-w-0">
                <Label className="text-xs font-semibold">Tandai sebagai Hari Libur</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Bila aktif, sistem tidak akan mencatat absensi pada tanggal ini (siswa tidak jadi Alfa).
                </p>
              </div>
              <Switch
                checked={form.is_holiday}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_holiday: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={submitting} className="gradient-primary text-primary-foreground">
              {submitting ? "Menyimpan..." : (editingEvent ? "Simpan Perubahan" : "Tambah Acara")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KalenderAkademik;
