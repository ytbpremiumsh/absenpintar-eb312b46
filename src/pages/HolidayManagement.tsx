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
  CalendarOff, CalendarDays, PowerOff, Trash2, Info, Plus, Pencil, Eye,
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

const EVENT_META: Record<EventType, { label: string; icon: any; badge: string; dot: string }> = {
  holiday:      { label: "Libur / Tanggal Merah", icon: CalendarOff,   badge: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",             dot: "bg-red-500" },
  exam:         { label: "Ujian",                  icon: GraduationCap, badge: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",   dot: "bg-amber-500" },
  event:        { label: "Kegiatan / Acara",       icon: PartyPopper,   badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500" },
  meeting:      { label: "Rapat",                  icon: Users,         badge: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400",           dot: "bg-sky-500" },
  announcement: { label: "Pengumuman",             icon: Megaphone,     badge: "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400", dot: "bg-violet-500" },
  other:        { label: "Lainnya",                icon: Sparkles,      badge: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",   dot: "bg-slate-500" },
};

const EVENT_TYPES: EventType[] = ["holiday", "exam", "event", "meeting", "announcement", "other"];

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const HolidayManagement = () => {
  const { profile, roles } = useAuth();
  const canEdit = roles.includes("school_admin") || roles.includes("super_admin");

  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayModeLabel, setHolidayModeLabel] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidayDays, setHolidayDays] = useState<number[]>([0, 6]);
  const [saving, setSaving] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog state
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
    Promise.all([
      supabase.from("schools").select("holiday_mode, holiday_mode_label, holiday_days").eq("id", profile.school_id).single(),
      supabase.from("school_holidays").select("id, date, label, description, event_type, is_holiday").eq("school_id", profile.school_id).order("date"),
    ]).then(([sRes, hRes]) => {
      if (sRes.data) {
        setHolidayMode(!!(sRes.data as any).holiday_mode);
        setHolidayModeLabel((sRes.data as any).holiday_mode_label || "");
        const hd = (sRes.data as any).holiday_days;
        setHolidayDays(Array.isArray(hd) ? hd : [0, 6]);
      }
      setEvents(((hRes.data || []) as any[]).map((r) => ({
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
    for (const e of events) {
      (map[e.date] ??= []).push(e);
    }
    return map;
  }, [events]);

  const modifiers = useMemo(() => {
    const holiday: Date[] = [];
    const withEvent: Date[] = [];
    for (const [date, list] of Object.entries(eventsByDate)) {
      const d = new Date(date + "T00:00:00");
      if (list.some((e) => e.is_holiday)) holiday.push(d);
      else withEvent.push(d);
    }
    return { holiday, withEvent };
  }, [eventsByDate]);

  const toggleHolidayDay = async (day: number) => {
    if (!profile?.school_id || !canEdit) return;
    const next = holidayDays.includes(day) ? holidayDays.filter((x) => x !== day) : [...holidayDays, day];
    setHolidayDays(next);
    setSavingDays(true);
    const { error } = await supabase.from("schools").update({ holiday_days: next } as any).eq("id", profile.school_id);
    setSavingDays(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    toast.success("Hari libur mingguan diperbarui");
  };

  const handleToggle = async (val: boolean) => {
    if (!profile?.school_id || !canEdit) return;
    setSaving(true);
    const { error } = await supabase.from("schools").update({
      holiday_mode: val,
      holiday_mode_label: val ? (holidayModeLabel || "Hari Libur") : null,
    } as any).eq("id", profile.school_id);
    setSaving(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayMode(val);
    toast.success(val ? "Mode libur diaktifkan — absensi ditangguhkan" : "Mode libur dinonaktifkan");
  };

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
      // Default: holiday type marks as libur; other types default to non-libur.
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
      // Build all dates in the range
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
        icon={CalendarDays}
        title="Kalender Akademik & Libur Sekolah"
        subtitle={canEdit
          ? "Kelola tanggal libur, ujian, kegiatan, rapat, dan pengumuman sekolah dalam satu kalender"
          : "Lihat jadwal libur & kegiatan akademik sekolah"}
      />

      {/* Info banner */}
      <Card className="border-0 shadow-card bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
            {canEdit ? <Info className="h-4 w-4 text-[#5B6CF9]" /> : <Eye className="h-4 w-4 text-[#5B6CF9]" />}
          </div>
          <div className="text-sm text-muted-foreground">
            {canEdit ? (
              <>
                Klik tanggal di kalender untuk menambah acara. Pilih jenis acara (libur, ujian, kegiatan, rapat, pengumuman)
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

      {/* Toggle Mode Libur */}
      {canEdit && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PowerOff className="h-4 w-4 text-primary" />
              Toggle Mode Libur Cepat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`rounded-xl border p-4 transition-colors ${holidayMode ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" : "bg-secondary/40 border-border"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    {holidayMode ? "Mode Libur AKTIF" : "Mode Libur Nonaktif"}
                    {holidayMode && <Badge className="bg-amber-500 text-white border-0">Absensi Ditangguhkan</Badge>}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktifkan bila hari ini libur mendadak (cuaca ekstrem, event khusus, dll).
                  </p>
                </div>
                <Switch checked={holidayMode} disabled={saving || loading} onCheckedChange={handleToggle} />
              </div>
              {holidayMode && (
                <div className="mt-3">
                  <Label className="text-xs">Alasan / Label</Label>
                  <Input
                    value={holidayModeLabel}
                    onChange={(e) => setHolidayModeLabel(e.target.value)}
                    onBlur={() => holidayMode && supabase.from("schools").update({ holiday_mode_label: holidayModeLabel } as any).eq("id", profile?.school_id || "").then(() => {})}
                    placeholder="Contoh: Cuaca ekstrem, Ujian nasional, dll"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hari Libur Mingguan */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            Hari Libur Sekolah (Mingguan)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Pilih hari libur tetap sekolah. Pada hari yang dipilih, sistem tidak menghitung absensi (tidak Auto-Alfa) dan dianggap libur."
              : "Daftar hari libur tetap sekolah yang berlaku setiap minggu."}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {[
              { v: 1, label: "Senin" }, { v: 2, label: "Selasa" }, { v: 3, label: "Rabu" },
              { v: 4, label: "Kamis" }, { v: 5, label: "Jumat" }, { v: 6, label: "Sabtu" },
              { v: 0, label: "Minggu" },
            ].map((d) => {
              const active = holidayDays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  disabled={savingDays || loading || !canEdit}
                  onClick={() => toggleHolidayDay(d.v)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
            Hari aktif: <strong className="text-foreground">{
              [1,2,3,4,5,6,0].filter(d => !holidayDays.includes(d))
                .map(d => ({1:"Senin",2:"Selasa",3:"Rabu",4:"Kamis",5:"Jumat",6:"Sabtu",0:"Minggu"} as any)[d])
                .join(", ") || "(tidak ada)"
            }</strong>
          </div>
        </CardContent>
      </Card>

      {/* Kalender Akademik */}
      <Card className="border-0 shadow-card">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Kalender Akademik Sekolah
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {canEdit
                ? "Klik tanggal untuk menambahkan acara — libur, ujian, kegiatan, rapat, atau pengumuman."
                : "Kalender lengkap semua acara akademik sekolah."}
            </p>
          </div>
          {canEdit && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Pencil className="h-3 w-3" /> Mode Admin
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => {
              const meta = EVENT_META[t];
              const Icon = meta.icon;
              return (
                <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-2 flex justify-center">
              <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={(r) => {
                  setSelectedRange(r);
                  if (r?.from) openCreateDialog(r);
                }}
                modifiers={{ holiday: modifiers.holiday, withEvent: modifiers.withEvent }}
                modifiersClassNames={{
                  holiday: "bg-red-500 text-white hover:bg-red-600",
                  withEvent: "ring-2 ring-inset ring-primary/60",
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
                    <Plus className="h-3 w-3" /> Tambah Hari Ini
                  </Button>
                )}
              </div>

              {events.length === 0 ? (
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

      {/* Add/Edit Dialog */}
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
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <div>
                  <Label className="text-xs">Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={dialogDate || ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setDialogDate(v);
                      if (v && (!dialogEndDate || dialogEndDate < v)) setDialogEndDate(v);
                    }}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tanggal Selesai</Label>
                  <Input
                    type="date"
                    value={dialogEndDate || dialogDate || ""}
                    min={dialogDate || undefined}
                    onChange={(e) => setDialogEndDate(e.target.value || dialogDate)}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                {dialogDate && dialogEndDate && dialogEndDate !== dialogDate && (
                  <p className="col-span-2 text-[11px] text-muted-foreground">
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

export default HolidayManagement;
