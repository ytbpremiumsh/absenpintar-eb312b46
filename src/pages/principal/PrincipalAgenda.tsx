import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Activity, Search, PartyPopper, Megaphone, Wallet, Receipt, Landmark, UserCheck, BookOpen, Clock, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { format, isSameDay, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<string, { icon: any; badge: string; ring: string }> = {
  libur: { icon: PartyPopper, badge: "bg-rose-500/10 text-rose-600 border-rose-500/20", ring: "bg-rose-500" },
  pengumuman: { icon: Megaphone, badge: "bg-sky-500/10 text-sky-600 border-sky-500/20", ring: "bg-sky-500" },
  ujian: { icon: BookOpen, badge: "bg-amber-500/10 text-amber-600 border-amber-500/20", ring: "bg-amber-500" },
  kegiatan: { icon: CalendarDays, badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", ring: "bg-indigo-500" },
};

const TIMELINE_TONE: Record<string, { dot: string; icon: any; bg: string; text: string }> = {
  success: { dot: "bg-emerald-500", icon: UserCheck, bg: "bg-emerald-500/10", text: "text-emerald-600" },
  warning: { dot: "bg-amber-500", icon: Wallet, bg: "bg-amber-500/10", text: "text-amber-600" },
  info: { dot: "bg-sky-500", icon: Receipt, bg: "bg-sky-500/10", text: "text-sky-600" },
  primary: { dot: "bg-primary", icon: Landmark, bg: "bg-primary/10", text: "text-primary" },
};

function relativeDay(d: Date) {
  if (isToday(d)) return "Hari ini";
  if (isTomorrow(d)) return "Besok";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff < 7) return `${diff} hari lagi`;
  if (diff < 0) return "Lewat";
  return format(d, "EEEE", { locale: idLocale });
}

export default function PrincipalAgenda() {
  const { user } = useAuth();
  const { loading, calendar, timeline, leaves, setLeaves } = usePrincipalData();
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");

  const approveLeave = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("parent_leave_requests")
      .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Gagal memperbarui");
    toast.success(status === "approved" ? "Izin disetujui" : "Izin ditolak");
    setLeaves(leaves.filter((x: any) => x.id !== id));
  };

  const now = new Date();

  const filteredCalendar = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return calendar
      .filter((c: any) => (typeF === "all" || (c.type || "").toLowerCase() === typeF))
      .filter((c: any) => !kw || (c.label || "").toLowerCase().includes(kw))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendar, q, typeF]);

  const upcomingCount = filteredCalendar.filter((c: any) => new Date(c.date) >= new Date(now.toDateString())).length;
  const todayCount = filteredCalendar.filter((c: any) => isSameDay(new Date(c.date), now)).length;

  const timelineToday = timeline.filter((t: any) => t.at && isSameDay(new Date(t.at), now)).length;
  const timelineWeek = timeline.filter((t: any) => t.at && differenceInCalendarDays(now, new Date(t.at)) <= 7).length;

  // Group timeline by day
  const timelineGrouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    timeline.forEach((t: any) => {
      const key = t.at ? format(new Date(t.at), "yyyy-MM-dd") : "no-date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, v]) => ({ key: k, items: v }));
  }, [timeline]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Kalender & Aktivitas"
        subtitle="Agenda sekolah dan aktivitas sistem"
        icon={CalendarDays}
        variant="primary"
      />

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={CalendarDays} label="Agenda Aktif" value={upcomingCount} tone="primary" />
        <MiniStat icon={Clock} label="Hari Ini" value={todayCount} tone="emerald" />
        <MiniStat icon={Activity} label="Aktivitas 7 Hari" value={timelineWeek} tone="indigo" />
        <MiniStat icon={UserCheck} label="Aktivitas Hari Ini" value={timelineToday} tone="amber" />
      </div>

      {/* Approval Izin Siswa */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Approval Izin Siswa
              </CardTitle>
              <CardDescription>Setujui atau tolak pengajuan izin dari orang tua</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">{leaves.length} menunggu</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {leaves.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Tidak ada pengajuan izin siswa
            </div>
          ) : (
            leaves.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{l.students?.name || "Siswa"} • {l.students?.class || "-"}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.type} • {l.date} • {l.reason}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => approveLeave(l.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Tolak</Button>
                  <Button size="sm" onClick={() => approveLeave(l.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Setujui</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>


      {/* Filter bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari agenda..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              <SelectItem value="libur">Libur</SelectItem>
              <SelectItem value="pengumuman">Pengumuman</SelectItem>
              <SelectItem value="ujian">Ujian</SelectItem>
              <SelectItem value="kegiatan">Kegiatan</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-[11px] text-muted-foreground text-right hidden md:block">
            Menampilkan {filteredCalendar.length} agenda • {timeline.length} aktivitas
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Kalender */}
        <Card className="rounded-2xl border-0 shadow-sm lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Kalender Kegiatan
                </CardTitle>
                <CardDescription>Libur, pengumuman & agenda terjadwal</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">{filteredCalendar.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredCalendar.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Belum ada agenda pada filter ini
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredCalendar.map((c: any, i: number) => {
                  const d = new Date(c.date);
                  const type = (c.type || "kegiatan").toLowerCase();
                  const style = TYPE_STYLES[type] || TYPE_STYLES.kegiatan;
                  const Icon = style.icon;
                  const rel = relativeDay(d);
                  const isPast = d < new Date(now.toDateString());
                  return (
                    <div
                      key={i}
                      className={cn(
                        "group flex items-center gap-3 p-3 rounded-xl border transition-all",
                        isPast ? "border-border/40 bg-muted/20 opacity-70" : "border-border/60 bg-card hover:shadow-sm hover:border-primary/30",
                      )}
                    >
                      <div className={cn("text-center shrink-0 w-14 py-1.5 rounded-lg", isPast ? "bg-muted" : "bg-primary/5 border border-primary/10")}>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">{format(d, "MMM", { locale: idLocale })}</div>
                        <div className={cn("text-xl font-black leading-none", isPast ? "" : "text-primary")}>{format(d, "d")}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{format(d, "EEE", { locale: idLocale })}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{c.label}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className={cn("text-[10px] font-medium capitalize", style.badge)}>
                            <Icon className="h-2.5 w-2.5 mr-1" /> {c.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">• {rel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="rounded-2xl border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Timeline Aktivitas
                </CardTitle>
                <CardDescription>Absensi, pembayaran, kas & pencairan</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">{timeline.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {timeline.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Belum ada aktivitas
              </div>
            ) : (
              <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                {timelineGrouped.map(({ key, items }) => {
                  const d = key === "no-date" ? null : new Date(key);
                  const label = d ? (isToday(d) ? "Hari ini" : isTomorrow(d) ? "Besok" : format(d, "EEEE, d MMM", { locale: idLocale })) : "Tanpa tanggal";
                  return (
                    <div key={key}>
                      <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-card/95 backdrop-blur text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border/40 mb-2">
                        {label}
                      </div>
                      <div className="relative pl-4">
                        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/60" />
                        {items.map((t: any, i: number) => {
                          const tone = TIMELINE_TONE[t.tone] || TIMELINE_TONE.primary;
                          const Icon = tone.icon;
                          return (
                            <div key={i} className="relative flex items-start gap-3 pb-3 last:pb-0">
                              <div className={cn("absolute -left-[13px] top-1 h-3 w-3 rounded-full border-2 border-background", tone.dot)} />
                              <div className={cn("h-7 w-7 shrink-0 rounded-lg flex items-center justify-center", tone.bg)}>
                                <Icon className={cn("h-3.5 w-3.5", tone.text)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm leading-snug">{t.label}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {t.at ? format(new Date(t.at), "HH:mm", { locale: idLocale }) : "-"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const tones: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600" },
  };
  const t = tones[tone] || tones.primary;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.bg)}>
          <Icon className={cn("h-5 w-5", t.text)} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="text-lg font-extrabold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
