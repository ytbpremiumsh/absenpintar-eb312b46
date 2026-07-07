import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, UserCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { usePrincipalData } from "@/hooks/usePrincipalData";

export default function PrincipalKehadiran() {
  const { loading, stats, teacherAtt, classAtt, monthly, ranking } = usePrincipalData();

  if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Kehadiran"
        subtitle="Rekap kehadiran guru & siswa realtime"
        icon={UserCheck}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Kehadiran Guru Hari Ini</CardTitle>
            <CardDescription>Total {stats.totalTeachers} guru</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2">
            {[
              { k: "Hadir", v: teacherAtt.hadir, cls: "text-emerald-600" },
              { k: "Izin", v: teacherAtt.izin, cls: "text-sky-600" },
              { k: "Sakit", v: teacherAtt.sakit, cls: "text-amber-600" },
              { k: "Alfa", v: teacherAtt.alfa, cls: "text-rose-600" },
              { k: "Belum", v: teacherAtt.belum, cls: "text-slate-500" },
            ].map(x => (
              <div key={x.k} className="text-center p-3 rounded-xl bg-muted/40">
                <div className={`text-2xl font-bold ${x.cls}`}>{x.v}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{x.k}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Siswa Hari Ini</CardTitle>
            <CardDescription>Total {stats.totalStudents} siswa • {stats.attendanceRate}% hadir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.studentsPresent}<span className="text-sm text-muted-foreground font-normal"> / {stats.totalStudents}</span></div>
            <Progress value={stats.attendanceRate} className="h-2 mt-3" />
            <div className="mt-3 text-xs text-muted-foreground">Kelas aktif: {stats.activeClasses}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Kehadiran Siswa per Kelas</CardTitle>
          <CardDescription>Persentase kehadiran realtime hari ini</CardDescription>
        </CardHeader>
        <CardContent>
          {classAtt.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Belum ada data</div>}
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
            {classAtt.map(c => {
              const pct = c.total ? Math.round((c.hadir / c.total) * 100) : 0;
              return (
                <div key={c.name} className="flex items-center gap-3 text-xs py-1">
                  <span className="w-20 font-medium truncate">{c.name}</span>
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="w-20 text-right text-muted-foreground">{c.hadir}/{c.total} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Grafik Kehadiran 6 Bulan Terakhir</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <RTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Guru" fill="#5B6CF9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Siswa" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Ranking Kelas Berdasarkan Kehadiran</CardTitle>
          <CardDescription>Bulan berjalan</CardDescription>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Belum ada data</div>}
          <div className="space-y-1.5">
            {ranking.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 text-xs">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                <span className="flex-1 font-medium">{r.name}</span>
                <Progress value={r.attendance} className="h-1.5 w-32" />
                <span className="w-12 text-right font-semibold">{r.attendance}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
