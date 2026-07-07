import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, CheckCircle2, XCircle, Clock } from "lucide-react";
import { usePrincipalData } from "@/hooks/usePrincipalData";

export default function PrincipalPembelajaran() {
  const { loading, liveClasses } = usePrincipalData();

  if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const live = liveClasses.filter(c => c.status === "live");
  const upcoming = liveClasses.filter(c => c.status === "upcoming");
  const done = liveClasses.filter(c => c.status === "done");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Pembelajaran"
        subtitle="Jadwal mengajar hari ini + status jurnal"
        icon={BookOpen}
      />

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Sedang Berlangsung" value={live.length} tone="emerald" />
        <SummaryTile label="Akan Datang" value={upcoming.length} tone="sky" />
        <SummaryTile label="Selesai" value={done.length} tone="slate" />
      </div>

      <Section title="Sedang Berlangsung" icon={Clock} items={live} emptyText="Tidak ada kelas berlangsung" />
      <Section title="Akan Datang" icon={Clock} items={upcoming} emptyText="Tidak ada jadwal berikutnya" />
      <Section title="Sudah Selesai Hari Ini" icon={CheckCircle2} items={done} emptyText="Belum ada kelas yang selesai" />
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600",
  };
  return (
    <Card className={`rounded-2xl bg-gradient-to-br ${tones[tone]}`}>
      <CardContent className="p-4">
        <div className="text-3xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, icon: Icon, items, emptyText }: { title: string; icon: any; items: any[]; emptyText: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</CardTitle>
        <CardDescription>{items.length} jadwal</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">{emptyText}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm truncate">{c.subject}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.startTime}-{c.endTime}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.className} • {c.teacher}</div>
                <Progress value={c.status === "done" ? 100 : c.progress} className="h-1.5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Hadir</span>
                  <span className="font-semibold">{c.hadir}/{c.total}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {c.journalFilled ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Jurnal terisi</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600"><XCircle className="h-3 w-3" /> Jurnal belum diisi</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
