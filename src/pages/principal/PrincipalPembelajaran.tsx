import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, CheckCircle2, XCircle, Clock, PlayCircle, CalendarClock, Users } from "lucide-react";
import { usePrincipalData } from "@/hooks/usePrincipalData";

type ClassItem = {
  id: string;
  subject: string;
  className: string;
  teacher: string;
  startTime: string;
  endTime: string;
  status: "live" | "upcoming" | "done";
  progress: number;
  hadir: number;
  total: number;
  journalFilled: boolean;
};

export default function PrincipalPembelajaran() {
  const { loading, liveClasses } = usePrincipalData();

  if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const live = liveClasses.filter((c) => c.status === "live");
  const upcoming = liveClasses.filter((c) => c.status === "upcoming");
  const done = liveClasses.filter((c) => c.status === "done");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Pembelajaran"
        subtitle="Jadwal mengajar hari ini + status jurnal"
        icon={BookOpen}
      />

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Sedang Berlangsung" value={live.length} tone="emerald" icon={PlayCircle} />
        <SummaryTile label="Akan Datang" value={upcoming.length} tone="sky" icon={CalendarClock} />
        <SummaryTile label="Selesai" value={done.length} tone="slate" icon={CheckCircle2} />
      </div>

      <Section
        title="Sedang Berlangsung"
        icon={PlayCircle}
        items={live}
        emptyText="Tidak ada kelas berlangsung"
        tone="emerald"
      />
      <Section
        title="Akan Datang"
        icon={CalendarClock}
        items={upcoming}
        emptyText="Tidak ada jadwal berikutnya"
        tone="sky"
      />
      <Section
        title="Sudah Selesai Hari Ini"
        icon={CheckCircle2}
        items={done}
        emptyText="Belum ada kelas yang selesai"
        tone="slate"
      />
    </div>
  );
}

const TONE_MAP: Record<string, { chip: string; ring: string; bar: string; dot: string; soft: string }> = {
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-700",
    ring: "ring-emerald-500/20",
    bar: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    dot: "bg-emerald-500",
    soft: "from-emerald-500/10 to-emerald-500/0",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-700",
    ring: "ring-sky-500/20",
    bar: "bg-gradient-to-r from-sky-500 to-sky-600",
    dot: "bg-sky-500",
    soft: "from-sky-500/10 to-sky-500/0",
  },
  slate: {
    chip: "bg-slate-500/10 text-slate-700",
    ring: "ring-slate-500/20",
    bar: "bg-gradient-to-r from-slate-400 to-slate-500",
    dot: "bg-slate-400",
    soft: "from-slate-500/10 to-slate-500/0",
  },
};

function SummaryTile({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: any }) {
  const t = TONE_MAP[tone];
  return (
    <Card className={`rounded-2xl border-0 shadow-sm bg-gradient-to-br ${t.soft} ring-1 ${t.ring}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${t.chip}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold text-foreground leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: any;
  items: ClassItem[];
  emptyText: string;
  tone: string;
}) {
  const t = TONE_MAP[tone];
  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <div className={`px-5 py-3 flex items-center justify-between bg-gradient-to-r ${t.soft} border-b border-border/40`}>
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.chip}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground leading-tight">{title}</div>
            <div className="text-[11px] text-muted-foreground">{items.length} jadwal</div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${t.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
          {items.length}
        </span>
      </div>

      <CardContent className="p-4">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">{emptyText}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((c) => (
              <ClassCard key={c.id} c={c} tone={tone} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClassCard({ c, tone }: { c: ClassItem; tone: string }) {
  const t = TONE_MAP[tone];
  const pct = c.status === "done" ? 100 : Math.round(Math.max(0, Math.min(100, c.progress)));
  const attendancePct = c.total > 0 ? Math.round((c.hadir / c.total) * 100) : 0;

  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card hover:shadow-md hover:border-border transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-foreground truncate">{c.subject}</div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {c.className} · {c.teacher}
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md ${t.chip}`}>
          <Clock className="h-3 w-3" />
          {c.startTime}–{c.endTime}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Progress kelas</span>
          <span className="font-semibold text-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${t.bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Hadir</span>
          <span className="font-semibold text-foreground">
            {c.hadir}/{c.total}
          </span>
          <span className="text-muted-foreground">· {attendancePct}%</span>
        </div>
        {c.journalFilled ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Jurnal
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
            <XCircle className="h-3.5 w-3.5" /> Jurnal
          </span>
        )}
      </div>
    </div>
  );
}
