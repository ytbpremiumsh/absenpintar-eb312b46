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
import {
  CalendarOff, CalendarDays, Trash2, Info, Plus, Pencil, Eye,
  BookOpen, PartyPopper, Users, Megaphone, Sparkles, GraduationCap,
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
  holiday:      { label: "Libur / Tanggal Merah", icon: CalendarOff,   badge: "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200 dark:from-red-950/40 dark:to-rose-950/40 dark:text-red-300 dark:border-red-900",                   solid: "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30",       ring: "ring-red-400/70",     dot: "bg-red-500",     tile: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60" },
  exam:         { label: "Ujian",                  icon: GraduationCap, badge: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200 dark:from-amber-950/40 dark:to-yellow-950/40 dark:text-amber-300 dark:border-amber-900",   solid: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30", ring: "ring-amber-400/70",   dot: "bg-amber-500",   tile: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60" },
  event:        { label: "Kegiatan / Acara",       icon: PartyPopper,   badge: "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-200 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300 dark:border-emerald-900", solid: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30", ring: "ring-emerald-400/70", dot: "bg-emerald-500", tile: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60" },
  meeting:      { label: "Rapat",                  icon: Users,         badge: "bg-gradient-to-r from-sky-50 to-blue-50 text-sky-800 border-sky-200 dark:from-sky-950/40 dark:to-blue-950/40 dark:text-sky-300 dark:border-sky-900",                     solid: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30",       ring: "ring-sky-400/70",     dot: "bg-sky-500",     tile: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/60" },
  announcement: { label: "Pengumuman",             icon: Megaphone,     badge: "bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-800 border-violet-200 dark:from-violet-950/40 dark:to-fuchsia-950/40 dark:text-violet-300 dark:border-violet-900", solid: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/30", ring: "ring-violet-400/70",  dot: "bg-violet-500",  tile: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/60" },
  other:        { label: "Lainnya",                icon: Sparkles,      badge: "bg-gradient-to-r from-slate-50 to-zinc-50 text-slate-700 border-slate-200 dark:from-slate-900/60 dark:to-zinc-900/60 dark:text-slate-300 dark:border-slate-800",         solid: "bg-gradient-to-br from-slate-500 to-zinc-600 text-white shadow-md shadow-slate-500/30",  ring: "ring-slate-400/70",   dot: "bg-slate-500",   tile: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800" },
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


  const openCreateDialog = (range: DateRange | Date) => {
    if (!canEdit) return;
    let from: Date; let to: Date;
    if (range instanceof Date) { from = range; to = range; }
    else {
      if (!range?.from) return;
      from = range.from;
      to = range.to ?? range.from;
    }
    setEditingEvent(null);
    setDialogDate(toDateKey(from));
    setDialogEndDate(toDateKey(to));
    setSelectedRange({ from, to });
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

      <Card className="border-0 shadow-card bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
            {canEdit ? <Info className="h-4 w-4 text-[#5B6CF9]" /> : <Eye className="h-4 w-4 text-[#5B6CF9]" />}
          </div>
          <div className="text-sm text-muted-foreground">
            {canEdit ? (
              <>
                Klik tanggal (atau tarik rentang) di kalender untuk menambah acara. Pilih jenis acara (libur, ujian, kegiatan, rapat, pengumuman)
                dan aktifkan <span className="font-semibold text-foreground">"Tandai sebagai Hari Libur"</span> bila acara tersebut menangguhkan absensi.
              </>
            ) : (
              <>
                Halaman ini hanya untuk dilihat. Penambahan atau perubahan kalender akademik hanya bisa dilakukan oleh <span className="font-semibold text-foreground">Admin Sekolah</span>.
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] px-5 py-4 text-white">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "18px 18px" }} />
          <div className="relative flex flex-row items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-lg">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Kalender Akademik</h2>
                <p className="text-[11px] text-white/70 mt-0.5">
                  {canEdit ? "Kelola agenda sekolah dari tombol Tambah Kalender." : "Agenda akademik sekolah — hanya untuk dilihat."}
                </p>
              </div>
            </div>
            {canEdit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 text-white px-2 py-0.5 text-[10px] font-medium backdrop-blur">
                <Pencil className="h-3 w-3" /> Mode Admin
              </span>
            )}
          </div>
        </div>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((t) => {
              const meta = EVENT_META[t];
              const Icon = meta.icon;
              return (
                <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${meta.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-background via-background to-[#5B6CF9]/[0.04] p-3 shadow-inner flex justify-center">
              <Calendar
                mode="default"
                onDayClick={() => { /* view only — tambah lewat tombol Tambah Kalender */ }}
                modifiers={modifiers}
                modifiersClassNames={{
                  holiday:      "!bg-gradient-to-br !from-red-500 !to-rose-600 !text-white font-bold shadow-md shadow-red-500/30 hover:!from-red-600 hover:!to-rose-700",
                  exam:         "!bg-gradient-to-br !from-amber-400 !to-orange-500 !text-white font-bold shadow-md shadow-amber-500/30",
                  event:        "!bg-gradient-to-br !from-emerald-400 !to-teal-500 !text-white font-bold shadow-md shadow-emerald-500/30",
                  meeting:      "!bg-gradient-to-br !from-sky-400 !to-blue-500 !text-white font-bold shadow-md shadow-sky-500/30",
                  announcement: "!bg-gradient-to-br !from-violet-400 !to-fuchsia-500 !text-white font-bold shadow-md shadow-violet-500/30",
                  other:        "!bg-gradient-to-br !from-slate-400 !to-zinc-500 !text-white font-bold shadow-md shadow-slate-500/30",
                }}
                className="p-0"
              />
            </div>


            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{events.length}</span> acara
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => openCreateDialog(new Date())}
                  >
                    <Plus className="h-3 w-3" /> Tambah Kalender
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Memuat...</div>
              ) : events.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada acara di kalender.<br />
                  {canEdit ? "Klik tanggal di kalender untuk menambahkan." : "Menunggu admin sekolah menambahkan acara."}
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                  {events.map((e) => {
                    const meta = EVENT_META[e.event_type];
                    const Icon = meta.icon;
                    return (
                      <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 border border-border/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${meta.badge}`}>
                              <Icon className="h-2.5 w-2.5" /> {meta.label}
                            </span>
                            {e.is_holiday && (
                              <Badge className="bg-red-500 text-white border-0 text-[9px] h-4 px-1.5">Libur</Badge>
                            )}
                          </div>
                          <p className="text-xs font-semibold mt-1">
                            {new Date(e.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          {e.label && <p className="text-[11px] text-foreground mt-0.5">{e.label}</p>}
                          {e.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(e)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemove(e.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
                <Label className="text-xs font-semibold">Pilih Rentang Tanggal</Label>
                <p className="text-[11px] text-muted-foreground">
                  Klik tanggal mulai, lalu tarik/klik tanggal akhir untuk memilih rentang.
                </p>
                <div className="flex justify-center">
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
                </div>
                {dialogDate && dialogEndDate && dialogEndDate !== dialogDate && (
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
