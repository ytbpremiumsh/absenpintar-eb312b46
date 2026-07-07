import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, GraduationCap, UserCheck, School as SchoolIcon, Percent, Bell,
  Clock, ArrowRight, ClipboardList, Wallet, Activity, CalendarDays, BookOpen, FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { StatCard, fmtIDR } from "./_shared";

export default function PrincipalOverview() {
  const {
    loading, schoolName, now, stats, liveClasses, notifs,
    leaves, pendingSettlements, withdrawals, announcements,
    finance, timeline,
  } = usePrincipalData();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const totalApprovals = leaves.length + pendingSettlements.length + withdrawals.length + announcements.length;
  const liveNow = liveClasses.filter(c => c.status === "live");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Kepala Sekolah"
        subtitle={`${schoolName || "Sekolah"} • ${format(now, "EEEE, d MMMM yyyy • HH:mm", { locale: idLocale })} WIB`}
        icon={SchoolIcon}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total Siswa" value={stats.totalStudents} tone="primary" />
        <StatCard icon={GraduationCap} label="Total Guru" value={stats.totalTeachers} tone="violet" />
        <StatCard icon={UserCheck} label="Guru Hadir" value={stats.teachersPresent} tone="emerald" />
        <StatCard icon={UserCheck} label="Siswa Hadir" value={stats.studentsPresent} tone="sky" />
        <StatCard icon={SchoolIcon} label="Kelas Aktif" value={stats.activeClasses} tone="amber" />
        <StatCard icon={Percent} label="% Kehadiran" value={`${stats.attendanceRate}%`} tone="rose" />
      </div>

      {(notifs.length > 0 || totalApprovals > 0) && (
        <Card className="border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifikasi Penting</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {notifs.map((n) => (
              <div key={n.key} className="flex items-center gap-2.5 text-sm p-2.5 rounded-xl bg-background/60 border border-border/50">
                <span className={`h-2 w-2 rounded-full ${n.tone === "success" ? "bg-emerald-500" : n.tone === "warning" ? "bg-amber-500" : "bg-sky-500"}`} />
                <span className="text-foreground">{n.title}</span>
              </div>
            ))}
            {notifs.length === 0 && <div className="text-sm text-muted-foreground">Tidak ada notifikasi mendesak</div>}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Kelas Berlangsung</CardTitle>
              <CardDescription>{liveNow.length} kelas sedang berjalan</CardDescription>
            </div>
            <button onClick={() => navigate("/kepsek/pembelajaran")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            {liveNow.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Tidak ada kelas berlangsung saat ini</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {liveNow.slice(0, 4).map(c => (
                  <div key={c.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{c.subject}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.startTime}-{c.endTime}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.className} • {c.teacher}</div>
                    <Progress value={c.progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Hadir</span>
                      <span className="font-semibold">{c.hadir}/{c.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Ringkasan Keuangan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Tagihan SPP" value={fmtIDR(finance.totalTagihan)} />
            <Row label="Pembayaran Masuk" value={fmtIDR(finance.totalPembayaran)} tone="emerald" />
            <Row label="Tunggakan" value={fmtIDR(finance.tunggakan)} tone="rose" />
            <Row label="Saldo Buku Kas" value={fmtIDR(finance.saldoKas)} tone="sky" />
            <Row label="Menunggu Pencairan" value={fmtIDR(finance.danaPending)} tone="amber" />
            <button onClick={() => navigate("/kepsek/keuangan")} className="mt-2 w-full text-xs text-primary hover:underline flex items-center justify-end gap-1">
              Detail keuangan <ArrowRight className="h-3 w-3" />
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <QuickTile icon={ClipboardList} label="Persetujuan" value={totalApprovals} onClick={() => navigate("/kepsek/persetujuan")} tone="indigo" />
        <QuickTile icon={BookOpen} label="Pembelajaran" value={`${liveClasses.length} jadwal`} onClick={() => navigate("/kepsek/pembelajaran")} tone="violet" />
        <QuickTile icon={CalendarDays} label="Agenda & Aktivitas" value={`${timeline.length} aktivitas`} onClick={() => navigate("/kepsek/agenda")} tone="emerald" />
        <QuickTile icon={FileSpreadsheet} label="Laporan Cepat" value="Unduh" onClick={() => navigate("/kepsek/laporan")} tone="amber" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Aktivitas Terbaru</CardTitle>
          <button onClick={() => navigate("/kepsek/agenda")} className="text-xs text-primary hover:underline flex items-center gap-1">
            Lihat semua <ArrowRight className="h-3 w-3" />
          </button>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas</div>}
          <div className="space-y-1.5">
            {timeline.slice(0, 6).map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-xl hover:bg-muted/40">
                <span className={`h-2 w-2 rounded-full shrink-0 ${t.tone === "success" ? "bg-emerald-500" : t.tone === "warning" ? "bg-amber-500" : t.tone === "info" ? "bg-sky-500" : "bg-primary"}`} />
                <span className="flex-1 truncate">{t.label}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{t.at ? format(new Date(t.at), "d MMM HH:mm", { locale: idLocale }) : "-"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : tone === "sky" ? "text-sky-600" : tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${t}`}>{value}</span>
    </div>
  );
}

function QuickTile({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: any; tone: string; onClick: () => void }) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-600",
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
  };
  return (
    <button onClick={onClick} className="text-left p-4 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-shadow group">
      <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{label} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
    </button>
  );
}
