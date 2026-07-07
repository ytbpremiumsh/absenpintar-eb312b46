import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, UsersRound, Calendar, Download, TrendingUp, CheckCircle2, XCircle, Clock as ClockIcon, TrendingDown, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";


const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const ROLE_LABEL: Record<string, string> = { teacher: "Guru", staff: "Operator", bendahara: "Bendahara" };
const roleLabel = (r: string) => ROLE_LABEL[r] || r;

const STATUS_EXCEL_COLORS: Record<string, { bg: string; fg: string }> = {
  H: { bg: "#dcfce7", fg: "#16a34a" },
  S: { bg: "#dbeafe", fg: "#2563eb" },
  I: { bg: "#fef9c3", fg: "#ca8a04" },
  A: { bg: "#fecaca", fg: "#dc2626" },
};

interface TeacherRow {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  roles: string[];
  days: Record<number, string>; // H/S/I/A or "" (no record yet)
  totals: { H: number; S: number; I: number; A: number };
}

const STATUS_TO_CODE: Record<string, string> = { hadir: "H", sakit: "S", izin: "I", alfa: "A" };

interface Props {
  /** Optional override; falls back to signed-in user's school_id. */
  schoolId?: string;
  /** Hide the top gradient hero (useful when embedded in another page shell). */
  hideHeader?: boolean;
}

const TeacherAttendanceRecap = ({ schoolId: schoolIdProp, hideHeader }: Props = {}) => {
  const { profile } = useAuth();
  const schoolId = schoolIdProp ?? profile?.school_id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [teachers, setTeachers] = useState<{ user_id: string; full_name: string; photo_url: string | null; roles: string[] }[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [rekapTab, setRekapTab] = useState<"datang" | "pulang">("datang");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [principalName, setPrincipalName] = useState("");


  useEffect(() => {
    const load = async () => {
      if (!schoolId) { setLoading(false); return; }
      setLoading(true);
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const start = new Date(year, month, 1).toISOString().slice(0, 10);
        const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        const { data: school } = await supabase.from("schools").select("name, city, principal_name").eq("id", schoolId).maybeSingle();
        if (school) {
          setSchoolName(school.name || "");
          setSchoolCity(school.city || "");
          if ((school as any).principal_name) setPrincipalName((school as any).principal_name);
        }

        const { data: profs } = await supabase.from("profiles")
          .select("user_id, full_name, photo_url").eq("school_id", schoolId);
        const ids = (profs || []).map((p) => p.user_id);
        if (ids.length === 0) { setTeachers([]); setLogs([]); return; }

        const { data: rolesData } = await supabase.from("user_roles")
          .select("user_id, role").in("user_id", ids).in("role", ["teacher", "staff", "bendahara", "school_admin"]);
        const roleMap = new Map<string, string[]>();
        (rolesData || []).forEach((r: any) => {
          const arr = roleMap.get(r.user_id) || [];
          arr.push(r.role);
          roleMap.set(r.user_id, arr);
        });

        // Fallback: use school_admin's full_name if principal_name is not set on schools
        if (!(school as any)?.principal_name) {
          const adminEntry = (profs || []).find((p) => (roleMap.get(p.user_id) || []).includes("school_admin"));
          if (adminEntry) setPrincipalName(adminEntry.full_name || "");
        }

        const filtered = (profs || []).filter((p) => {
          const r = roleMap.get(p.user_id) || [];
          return r.includes("teacher") || r.includes("staff") || r.includes("bendahara");
        }).map((p) => ({ ...p, roles: (roleMap.get(p.user_id) || []).filter(r => r !== "school_admin") }));
        setTeachers(filtered);

        const { data: lgs } = await supabase.from("teacher_attendance_logs" as any)
          .select("user_id, date, status, attendance_type")
          .eq("school_id", schoolId).gte("date", start).lte("date", end);
        setLogs(lgs || []);
      } finally { setLoading(false); }
    };
    load();

  }, [schoolId, currentMonth]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const dayArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // Determine which days are "past or today" for marking A
  const today = new Date();
  const isCurrentOrPastMonth = (currentMonth.getFullYear() < today.getFullYear()) ||
    (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() <= today.getMonth());

  const filteredTeachers = useMemo(() =>
    teachers.filter((t) => roleFilter === "all" ? true : t.roles.includes(roleFilter)),
  [teachers, roleFilter]);

  const isPulangMode = rekapTab === "pulang";

  const rows: TeacherRow[] = useMemo(() => {
    return filteredTeachers.map((t) => {
      const days: Record<number, string> = {};
      const totals = { H: 0, S: 0, I: 0, A: 0 };
      const myLogs = logs.filter((l) => l.user_id === t.user_id);
      for (const d of dayArray) {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
        const isPast = checkDate <= today;
        const dow = checkDate.getDay();
        const isWeekend = dow === 0 || dow === 6;

        if (isPulangMode) {
          const pulangLog = myLogs.find((l) => l.date === dateStr && l.attendance_type === "pulang");
          if (pulangLog) { days[d] = "H"; totals.H++; }
          else { days[d] = ""; }
        } else {
          const log = myLogs.find((l) => l.date === dateStr && (l.attendance_type || "datang") === "datang")
            || myLogs.find((l) => l.date === dateStr && (l.attendance_type || "datang") !== "pulang");
          if (log) {
            const code = STATUS_TO_CODE[log.status] || "H";
            days[d] = code;
            totals[code as "H"|"S"|"I"|"A"]++;
          } else if (isPast && !isWeekend && isCurrentOrPastMonth) {
            days[d] = "A";
            totals.A++;
          } else {
            days[d] = "";
          }
        }
      }
      return { user_id: t.user_id, full_name: t.full_name, photo_url: t.photo_url, roles: t.roles, days, totals };
    });

  }, [filteredTeachers, logs, dayArray, currentMonth, daysInMonth, isPulangMode, isCurrentOrPastMonth]);

  const exportExcel = () => {
    if (!rows.length) { toast.error("Tidak ada data"); return; }
    const titleLabel = "REKAP ABSENSI GURU & STAFF";
    const totalCols = 3 + daysInMonth + 4;

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
      td, th { border: 1px solid #999; padding: 3px 4px; font-family: Arial; font-size: 9pt; text-align: center; }
      th { background: #4f46e5; color: white; font-weight: bold; }
      .name { text-align: left; min-width: 160px; }
      .role { text-align: left; min-width: 100px; }
      .title { font-size: 14pt; font-weight: bold; text-align: center; border: none; }
      .subtitle { font-size: 11pt; text-align: center; border: none; }
      .H { background: ${STATUS_EXCEL_COLORS.H.bg}; color: ${STATUS_EXCEL_COLORS.H.fg}; font-weight: bold; }
      .S { background: ${STATUS_EXCEL_COLORS.S.bg}; color: ${STATUS_EXCEL_COLORS.S.fg}; font-weight: bold; }
      .I { background: ${STATUS_EXCEL_COLORS.I.bg}; color: ${STATUS_EXCEL_COLORS.I.fg}; font-weight: bold; }
      .A { background: ${STATUS_EXCEL_COLORS.A.bg}; color: ${STATUS_EXCEL_COLORS.A.fg}; font-weight: bold; }
    </style></head><body><table>`;

    html += `<tr><td colspan="${totalCols}" class="title">${titleLabel}</td></tr>`;
    html += `<tr><td colspan="${totalCols}" class="subtitle">${schoolName}</td></tr>`;
    html += `<tr><td colspan="${totalCols}" class="subtitle">Periode: ${monthLabel}</td></tr>`;
    html += `<tr><td colspan="${totalCols}"></td></tr>`;
    html += `<tr><th rowspan="2">NO</th><th rowspan="2" class="name">NAMA</th><th rowspan="2" class="role">JABATAN</th>`;
    html += `<th colspan="${daysInMonth}">TANGGAL</th><th colspan="4">KET</th></tr><tr>`;
    for (let d = 1; d <= daysInMonth; d++) html += `<th>${d}</th>`;
    html += `<th class="H">H</th><th class="S">S</th><th class="I">I</th><th class="A">A</th></tr>`;

    rows.forEach((r, i) => {
      html += `<tr><td>${i + 1}</td><td class="name">${r.full_name}</td><td class="role">${r.roles.map(roleLabel).join(", ")}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const code = r.days[d] || "";
        html += `<td${code ? ` class="${code}"` : ""}>${code || "-"}</td>`;
      }
      html += `<td class="H">${r.totals.H || ""}</td><td class="S">${r.totals.S || ""}</td><td class="I">${r.totals.I || ""}</td><td class="A">${r.totals.A || ""}</td></tr>`;
    });

    html += `<tr><td colspan="${totalCols}"></td></tr><tr><td colspan="${totalCols}"></td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:right;border:none">${schoolCity || schoolName}, ........................ ${currentMonth.getFullYear()}</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:right;border:none;font-weight:bold">Mengetahui,</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:right;border:none;font-weight:bold">Kepala Sekolah</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="border:none">&nbsp;</td></tr><tr><td colspan="${totalCols}" style="border:none">&nbsp;</td></tr><tr><td colspan="${totalCols}" style="border:none">&nbsp;</td></tr>`;
    html += `<tr><td colspan="${totalCols}" style="text-align:right;border:none;font-weight:bold;text-decoration:underline">${principalName || "(...........................................)"}</td></tr>`;
    html += `</table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap-Absensi-Guru-Staff-${MONTH_NAMES[currentMonth.getMonth()]}-${currentMonth.getFullYear()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel berhasil diunduh!");
  };

  const navigateMonth = (dir: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + dir);
    setCurrentMonth(d);
  };

  const getCellBadge = (code: string) => {
    switch (code) {
      case "H": return "bg-emerald-500 text-white";
      case "S": return "bg-violet-500 text-white";
      case "I": return "bg-amber-400 text-white";
      case "A": return "bg-red-500 text-white";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] p-5 text-white shadow-xl">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <UsersRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Rekap Absensi Guru & Staff</h1>
              <p className="text-white/70 text-xs">Format bulanan dengan kode H/S/I/A — siap cetak & TTD Kepala Sekolah</p>
            </div>
          </div>
        </div>
      )}

      <Card className="border border-border/50 shadow-none rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1.5 bg-muted/50 rounded-lg flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                {monthLabel}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[140px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jabatan</SelectItem>
                  <SelectItem value="teacher">Guru</SelectItem>
                  <SelectItem value="staff">Operator</SelectItem>
                  <SelectItem value="bendahara">Bendahara</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportExcel} size="sm" className="h-9 rounded-lg gap-1.5 bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] text-white">
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>
          </div>

          {/* Datang / Pulang Tabs */}
          <Tabs value={rekapTab} onValueChange={(v) => setRekapTab(v as "datang" | "pulang")}>
            <TabsList>
              <TabsTrigger value="datang" className="text-xs gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Rekap Kehadiran</TabsTrigger>
              <TabsTrigger value="pulang" className="text-xs gap-1.5"><ClockIcon className="h-3.5 w-3.5" /> Rekap Kepulangan</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Legend */}
          {!isPulangMode ? (
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">H</span> Hadir</div>
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-violet-500 text-white text-[10px] font-bold">S</span> Sakit</div>
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-amber-400 text-white text-[10px] font-bold">I</span> Izin</div>
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-red-500 text-white text-[10px] font-bold">A</span> Alfa</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">H</span> Sudah Pulang</div>
              <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-muted/40 border border-border/30" /> Belum Absen Pulang</div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Analitik Guru (only for Kehadiran, not Pulang) */}
      {!loading && rows.length > 0 && !isPulangMode && (() => {
        const totalH = rows.reduce((s, r) => s + r.totals.H, 0);
        const totalS = rows.reduce((s, r) => s + r.totals.S, 0);
        const totalI = rows.reduce((s, r) => s + r.totals.I, 0);
        const totalA = rows.reduce((s, r) => s + r.totals.A, 0);
        const totalAll = totalH + totalS + totalI + totalA;
        const avgRate = totalAll ? Math.round((totalH / totalAll) * 100) : 0;
        // Working days = past weekdays in month up to today
        const workingDays = dayArray.filter((d) => {
          const dt = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
          if (dt > today) return false;
          const dow = dt.getDay();
          return dow !== 0 && dow !== 6;
        }).length;
        const topAbsent = [...rows].sort((a, b) => (b.totals.A + b.totals.S + b.totals.I) - (a.totals.A + a.totals.S + a.totals.I)).slice(0, 3).filter(r => (r.totals.A + r.totals.S + r.totals.I) > 0);
        const topPresent = [...rows].sort((a, b) => b.totals.H - a.totals.H).slice(0, 3).filter(r => r.totals.H > 0);
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#5B6CF9]" />
              <h3 className="text-sm font-bold">Analitik Kehadiran Guru & Staff — {monthLabel}</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <Card className="border-0 rounded-xl bg-gradient-to-br from-[#5B6CF9]/10 to-transparent">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground font-medium">TOTAL PERSONIL</p>
                  <p className="text-xl font-bold text-[#5B6CF9]">{rows.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{workingDays} hari kerja</p>
                </CardContent>
              </Card>
              <Card className="border-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /><p className="text-[10px] text-emerald-700 font-medium">HADIR</p></div>
                  <p className="text-xl font-bold text-emerald-700">{totalH}</p>
                  <p className="text-[10px] text-emerald-700/70 mt-0.5">Rate {avgRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 rounded-xl bg-violet-50 dark:bg-violet-500/10">
                <CardContent className="p-3">
                  <p className="text-[10px] text-violet-700 font-medium">SAKIT</p>
                  <p className="text-xl font-bold text-violet-700">{totalS}</p>
                </CardContent>
              </Card>
              <Card className="border-0 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <CardContent className="p-3">
                  <p className="text-[10px] text-amber-700 font-medium">IZIN</p>
                  <p className="text-xl font-bold text-amber-700">{totalI}</p>
                </CardContent>
              </Card>
              <Card className="border-0 rounded-xl bg-red-50 dark:bg-red-500/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-600" /><p className="text-[10px] text-red-700 font-medium">ALFA</p></div>
                  <p className="text-xl font-bold text-red-700">{totalA}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Card className="border border-border/50 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <p className="text-xs font-semibold">Paling Rajin (Terbanyak Hadir)</p>
                  </div>
                  {topPresent.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Belum ada data</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topPresent.map((r, i) => (
                        <div key={r.user_id} className="flex items-center gap-2">
                          <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-300 text-orange-900"}`}>{i + 1}</span>
                          <Avatar className="h-6 w-6">
                            {r.photo_url && <AvatarImage src={r.photo_url} />}
                            <AvatarFallback className="text-[9px] bg-[#5B6CF9]/10 text-[#5B6CF9]">{r.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-medium truncate flex-1">{r.full_name}</p>
                          <span className="text-xs font-bold text-emerald-600">{r.totals.H}H</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/50 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    <p className="text-xs font-semibold">Perlu Perhatian (Terbanyak Absen)</p>
                  </div>
                  {topAbsent.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Semua personil hadir penuh</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topAbsent.map((r, i) => (
                        <div key={r.user_id} className="flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-100 text-red-700">{i + 1}</span>
                          <Avatar className="h-6 w-6">
                            {r.photo_url && <AvatarImage src={r.photo_url} />}
                            <AvatarFallback className="text-[9px] bg-red-100 text-red-700">{r.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-medium truncate flex-1">{r.full_name}</p>
                          <span className="text-xs font-bold text-red-600">A:{r.totals.A} S:{r.totals.S} I:{r.totals.I}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      <Card className="border border-border/50 shadow-none rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">
              Rekapitulasi — {monthLabel}{" "}
              <span className="text-muted-foreground font-normal text-sm">({rows.length} orang)</span>
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Memuat data...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Belum ada data guru/staff</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-10 sticky left-0 bg-card z-10">No</th>
                    <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[200px]">Nama & Jabatan</th>
                    <th colSpan={daysInMonth} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Tanggal</th>
                    {isPulangMode ? (
                      <th className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Ket</th>
                    ) : (
                      <th colSpan={5} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Keterangan</th>
                    )}
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    {dayArray.map((d) => (
                      <th key={d} className="px-0.5 py-1.5 text-center font-medium text-muted-foreground w-7 text-[10px]">{d}</th>
                    ))}
                    {isPulangMode ? (
                      <th className="px-1 py-1.5 text-center font-bold text-emerald-600 w-7 text-[10px]">✓</th>
                    ) : (
                      <>
                        <th className="px-1 py-1.5 text-center font-bold text-emerald-600 w-7 text-[10px]">H</th>
                        <th className="px-1 py-1.5 text-center font-bold text-violet-600 w-7 text-[10px]">S</th>
                        <th className="px-1 py-1.5 text-center font-bold text-amber-600 w-7 text-[10px]">I</th>
                        <th className="px-1 py-1.5 text-center font-bold text-red-600 w-7 text-[10px]">A</th>
                        <th className="px-1 py-1.5 text-center font-bold text-primary w-10 text-[10px]">%</th>
                      </>
                    )}
                  </tr>

                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const total = r.totals.H + r.totals.S + r.totals.I + r.totals.A;
                    const pct = total > 0 ? Math.round((r.totals.H / total) * 100) : 0;
                    return (
                      <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3 text-center font-medium text-muted-foreground sticky left-0 bg-card z-10">{i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={r.photo_url || undefined} />
                              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{r.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-foreground truncate">{r.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{r.roles.map(roleLabel).join(" • ")}</p>
                            </div>
                          </div>
                        </td>
                        {dayArray.map((d) => {
                          const code = r.days[d] || "";
                          const badgeClass = getCellBadge(code);
                          return (
                            <td key={d} className="px-0 py-2 text-center">
                              {code ? (
                                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold ${badgeClass}`}>{code}</span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted/40 border border-border/30" />
                              )}
                            </td>
                          );
                        })}
                        {isPulangMode ? (
                          <td className="px-1 py-2 text-center font-bold text-emerald-600">{r.totals.H || 0}</td>
                        ) : (
                          <>
                            <td className="px-1 py-2 text-center font-bold text-emerald-600">{r.totals.H || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-violet-600">{r.totals.S || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-amber-600">{r.totals.I || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-red-600">{r.totals.A || 0}</td>
                            <td className={`px-1 py-2 text-center font-bold text-[10px] ${pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {total > 0 ? `${pct}%` : "-"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}


          {rows.length > 0 && (
            <div className="p-6 border-t border-border">
              <div className="flex justify-end">
                <div className="text-center text-xs text-muted-foreground space-y-1">
                  <p>{schoolCity || schoolName}, ........................ {currentMonth.getFullYear()}</p>
                  <p className="font-semibold text-foreground">Mengetahui,</p>
                  <p className="font-semibold text-foreground">Kepala Sekolah</p>
                  <div className="h-16" />
                  <p className="font-semibold text-foreground border-b border-foreground inline-block min-w-[200px]">
                    {principalName ? `( ${principalName} )` : "(.................................)"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherAttendanceRecap;
