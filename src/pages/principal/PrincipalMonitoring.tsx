import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity, UserCheck, BookOpen, GraduationCap, Users, Clock, UserX, CalendarDays,
} from "lucide-react";
import PrincipalKehadiran from "./PrincipalKehadiran";
import PrincipalPembelajaran from "./PrincipalPembelajaran";
import PrincipalJadwal from "@/components/principal/PrincipalJadwal";
import { usePrincipalData } from "@/hooks/usePrincipalData";

function OverviewStat({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: any; sub?: string;
  tone: "primary" | "emerald" | "sky" | "amber" | "violet" | "rose";
}) {
  const tones = {
    primary: { icon: "bg-[#5B6CF9]/15 text-[#5B6CF9]", value: "text-[#5B6CF9]", bg: "bg-gradient-to-br from-[#5B6CF9]/10 to-transparent" },
    emerald: { icon: "bg-emerald-500/15 text-emerald-600", value: "text-emerald-600", bg: "" },
    sky: { icon: "bg-sky-500/15 text-sky-600", value: "text-sky-600", bg: "" },
    amber: { icon: "bg-amber-500/15 text-amber-600", value: "text-amber-600", bg: "" },
    violet: { icon: "bg-violet-500/15 text-violet-600", value: "text-violet-600", bg: "" },
    rose: { icon: "bg-rose-500/15 text-rose-600", value: "text-rose-600", bg: "" },
  }[tone];
  return (
    <Card className={`border-0 shadow-sm overflow-hidden ${tones.bg}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${tones.icon}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{label}</p>
        </div>
        <div className="min-w-0">
          <p className={`text-base sm:text-lg font-extrabold ${tones.value} break-words leading-tight`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrincipalMonitoring() {
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "kehadiran";
  const { stats, teacherAtt, liveClasses } = usePrincipalData();
  const liveNow = liveClasses.filter((c) => c.status === "live").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monitoring Sekolah"
        subtitle="Pantau kehadiran guru, siswa & kelas berlangsung secara real-time"
        icon={Activity}
        variant="primary"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewStat icon={GraduationCap} label="Guru Hadir" value={`${stats.teachersPresent}/${stats.totalTeachers}`} sub="hari ini" tone="emerald" />
        <OverviewStat icon={Users} label="Siswa Hadir" value={`${stats.studentsPresent}/${stats.totalStudents}`} sub={`${stats.attendanceRate}% kehadiran`} tone="sky" />
        <OverviewStat icon={Clock} label="Kelas Berlangsung" value={liveNow} sub={`${liveClasses.length} jadwal hari ini`} tone="primary" />
        <OverviewStat icon={UserX} label="Guru Belum Absen" value={teacherAtt.belum} sub="wajib ditindaklanjuti" tone="amber" />
      </div>

      <Tabs value={active} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-auto">
          <TabsTrigger value="kehadiran" className="gap-1.5 rounded-xl px-4 py-2 text-foreground/70 hover:text-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-[#5B6CF9] data-[state=active]:text-white data-[state=active]:shadow-md">
            <UserCheck className="h-4 w-4" /> Kehadiran
          </TabsTrigger>
          <TabsTrigger value="pembelajaran" className="gap-1.5 rounded-xl px-4 py-2 text-foreground/70 hover:text-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-[#5B6CF9] data-[state=active]:text-white data-[state=active]:shadow-md">
            <BookOpen className="h-4 w-4" /> Pembelajaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kehadiran" className="mt-4">
          {active === "kehadiran" && <PrincipalKehadiran />}
        </TabsContent>
        <TabsContent value="pembelajaran" className="mt-4">
          {active === "pembelajaran" && <PrincipalPembelajaran />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
