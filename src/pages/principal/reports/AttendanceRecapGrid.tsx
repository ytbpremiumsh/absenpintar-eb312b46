import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClipboardList, Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUS_TO_CODE: Record<string, string> = { hadir: "H", sakit: "S", izin: "I", alfa: "A" };
const ROLE_LABEL: Record<string, string> = { teacher: "Guru", staff: "Staff", bendahara: "Bendahara", principal: "Kepala Sekolah" };

function cellBadge(code: string) {
  switch (code) {
    case "H": return "bg-emerald-500 text-white";
    case "S": return "bg-violet-500 text-white";
    case "I": return "bg-amber-400 text-white";
    case "A": return "bg-red-500 text-white";
    default: return "";
  }
}

interface PersonRow {
  id: string;
  name: string;
  sub: string;
  photo_url: string | null;
  cls?: string;
  role?: string;
  days: Record<number, string>;
  totals: { H: number; S: number; I: number; A: number };
}

interface Props {
  schoolId?: string;
  kind: "student" | "teacher";
}

export function AttendanceRecapGrid({ schoolId, kind }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState("all");
  const [rekapTab, setRekapTab] = useState<"datang" | "pulang">("datang");
  const [people, setPeople] = useState<{ id: string; name: string; sub: string; photo_url: string | null; cls?: string; role?: string }[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ value: string; label: string }[]>([]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const today = new Date();
  const isCurrentOrPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month <= today.getMonth());

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        const holQ = await supabase.from("school_holidays").select("date").eq("school_id", schoolId).gte("date", start).lte("date", end);
        setHolidays(new Set((holQ.data || []).map((h: any) => h.date)));

        if (kind === "student") {
          const [studentsQ, logsQ] = await Promise.all([
            supabase.from("students").select("id, student_id, name, class, photo_url").eq("school_id", schoolId).order("class").order("name"),
            supabase.from("attendance_logs").select("student_id, status, attendance_type, date").eq("school_id", schoolId).gte("date", start).lte("date", end),
          ]);
          const students = studentsQ.data || [];
          const classes = Array.from(new Set(students.map((s: any) => s.class))).sort();
          setFilterOptions(classes.map((c) => ({ value: c, label: c })));
          setPeople(students.map((s: any) => ({ id: s.id, name: s.name, sub: s.student_id, photo_url: s.photo_url, cls: s.class })));
          setLogs(logsQ.data || []);
        } else {
          const [profQ, rolesQ, logsQ] = await Promise.all([
            supabase.from("profiles").select("user_id, full_name, photo_url").eq("school_id", schoolId),
            supabase.from("user_roles").select("user_id, role"),
            supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type, date").eq("school_id", schoolId).gte("date", start).lte("date", end),
          ]);
          const roleMap = new Map<string, string[]>();
          (rolesQ.data || []).forEach((r: any) => {
            if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
            roleMap.get(r.user_id)!.push(r.role);
          });
          const allowed = new Set(["teacher", "staff", "bendahara", "principal"]);
          const staff = (profQ.data || []).filter((p: any) => (roleMap.get(p.user_id) || []).some((r) => allowed.has(r)));
          const rolesSet = new Set<string>();
          const ppl = staff.map((p: any) => {
            const roles = (roleMap.get(p.user_id) || []).filter((r) => allowed.has(r));
            const primary = roles.includes("teacher") ? "teacher" : roles.find((r) => r !== "principal") || roles[0] || "staff";
            rolesSet.add(primary);
            return { id: p.user_id, name: p.full_name || "-", sub: ROLE_LABEL[primary] || primary, photo_url: p.photo_url, role: primary };
          });
          setFilterOptions(Array.from(rolesSet).map((r) => ({ value: r, label: ROLE_LABEL[r] || r })));
          setPeople(ppl);
          setLogs(logsQ.data || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId, kind, month, year, start, end]);

  // Compute rows with auto-Alfa for past weekdays without record (only for 'datang' recap)
  const rows: PersonRow[] = useMemo(() => {
    const isPulang = rekapTab === "pulang";
    const idKey = kind === "student" ? "student_id" : "user_id";
    return people.map((p) => {
      const days: Record<number, string> = {};
      const totals = { H: 0, S: 0, I: 0, A: 0 };
      const myLogs = logs.filter((l: any) => l[idKey] === p.id && (l.attendance_type ?? "datang") === rekapTab);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const log = myLogs.find((l: any) => l.date === dateStr);
        const dt = new Date(year, month, d);
        const isPast = dt <= today;
        const dow = dt.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidays.has(dateStr);
        if (log) {
          const code = isPulang ? "H" : (STATUS_TO_CODE[log.status] || "H");
          days[d] = code;
          totals[code as "H" | "S" | "I" | "A"]++;
        } else if (!isPulang && isPast && !isWeekend && !isHoliday && isCurrentOrPastMonth) {
          days[d] = "A";
          totals.A++;
        } else {
          days[d] = "";
        }
      }
      return { ...p, days, totals };
    });
  }, [people, logs, holidays, rekapTab, kind, daysInMonth, year, month, isCurrentOrPastMonth]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => (kind === "student" ? r.cls === filter : r.role === filter));
  }, [rows, filter, kind]);

  // Analytics
  const analytics = useMemo(() => {
    const totalH = filtered.reduce((s, r) => s + r.totals.H, 0);
    const totalS = filtered.reduce((s, r) => s + r.totals.S, 0);
    const totalI = filtered.reduce((s, r) => s + r.totals.I, 0);
    const totalA = filtered.reduce((s, r) => s + r.totals.A, 0);
    const totalAll = totalH + totalS + totalI + totalA;
    const avgRate = totalAll ? Math.round((totalH / totalAll) * 100) : 0;
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      if (dt > today) continue;
      const dow = dt.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) workingDays++;
    }
    const topPresent = [...filtered].sort((a, b) => b.totals.H - a.totals.H).slice(0, 3).filter((r) => r.totals.H > 0);
    const topAbsent = [...filtered].sort((a, b) => (b.totals.A + b.totals.S + b.totals.I) - (a.totals.A + a.totals.S + a.totals.I)).slice(0, 3).filter((r) => r.totals.A + r.totals.S + r.totals.I > 0);
    return { totalH, totalS, totalI, totalA, avgRate, workingDays, topPresent, topAbsent };
  }, [filtered, daysInMonth, year, month, holidays]);

  const isPulangMode = rekapTab === "pulang";
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const label = kind === "student" ? "siswa" : "guru & staff";
  const filterLabel = kind === "student" ? "Kelas" : "Peran";
  const analyticsTitle = kind === "student" ? "Analitik Kehadiran Siswa" : "Analitik Kehadiran Guru & Staff";

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Bulan</label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Tahun</label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {kind !== "student" && (
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">{filterLabel}</label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua {filterLabel}</SelectItem>
                {filterOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Analytics (based on grid data, same as admin dashboard) */}
      {!loading && filtered.length > 0 && !isPulangMode && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#5B6CF9]" />
            <h3 className="text-sm font-bold">{analyticsTitle} — {monthLabel}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <Card className="border-0 rounded-xl bg-gradient-to-br from-[#5B6CF9]/10 to-transparent">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground font-medium">TOTAL {kind === "student" ? "SISWA" : "PERSONIL"}</p>
                <p className="text-xl font-bold text-[#5B6CF9]">{filtered.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{analytics.workingDays} hari kerja</p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /><p className="text-[10px] text-emerald-700 font-medium">HADIR</p></div>
                <p className="text-xl font-bold text-emerald-700">{analytics.totalH}</p>
                <p className="text-[10px] text-emerald-700/70 mt-0.5">Rate {analytics.avgRate}%</p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-xl bg-violet-50 dark:bg-violet-500/10">
              <CardContent className="p-3">
                <p className="text-[10px] text-violet-700 font-medium">SAKIT</p>
                <p className="text-xl font-bold text-violet-700">{analytics.totalS}</p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-xl bg-amber-50 dark:bg-amber-500/10">
              <CardContent className="p-3">
                <p className="text-[10px] text-amber-700 font-medium">IZIN</p>
                <p className="text-xl font-bold text-amber-700">{analytics.totalI}</p>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-xl bg-red-50 dark:bg-red-500/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-600" /><p className="text-[10px] text-red-700 font-medium">ALFA</p></div>
                <p className="text-xl font-bold text-red-700">{analytics.totalA}</p>
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
                {analytics.topPresent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada data</p>
                ) : (
                  <div className="space-y-1.5">
                    {analytics.topPresent.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-300 text-orange-900"}`}>{i + 1}</span>
                        <Avatar className="h-6 w-6">
                          {r.photo_url && <AvatarImage src={r.photo_url} />}
                          <AvatarFallback className="text-[9px] bg-[#5B6CF9]/10 text-[#5B6CF9]">{r.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-medium truncate flex-1">{r.name}</p>
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
                {analytics.topAbsent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Semua hadir penuh</p>
                ) : (
                  <div className="space-y-1.5">
                    {analytics.topAbsent.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-100 text-red-700">{i + 1}</span>
                        <Avatar className="h-6 w-6">
                          {r.photo_url && <AvatarImage src={r.photo_url} />}
                          <AvatarFallback className="text-[9px] bg-red-100 text-red-700">{r.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-medium truncate flex-1">{r.name}</p>
                        <span className="text-xs font-bold text-red-600">A:{r.totals.A} S:{r.totals.S} I:{r.totals.I}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
        <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">H</span> Hadir</div>
        <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-violet-500 text-white text-[10px] font-bold">S</span> Sakit</div>
        <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-amber-400 text-white text-[10px] font-bold">I</span> Izin</div>
        <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-red-500 text-white text-[10px] font-bold">A</span> Alfa</div>
      </div>

      {/* Tabs Datang / Pulang */}
      <Tabs value={rekapTab} onValueChange={(v) => setRekapTab(v as "datang" | "pulang")}>
        <TabsList>
          <TabsTrigger value="datang" className="text-xs gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Rekap Kehadiran</TabsTrigger>
          <TabsTrigger value="pulang" className="text-xs gap-1.5"><Clock className="h-3.5 w-3.5" /> Rekap Kepulangan</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grid */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">
              Rekapitulasi — {monthLabel}{" "}
              <span className="text-muted-foreground font-normal text-xs">({filtered.length} {label})</span>
            </h2>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Tidak ada data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-10 sticky left-0 bg-card z-10">No</th>
                    <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[180px] sticky left-10 bg-card z-10">Nama</th>
                    <th colSpan={daysInMonth} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Tanggal</th>
                    {isPulangMode ? (
                      <th className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Ket</th>
                    ) : (
                      <th colSpan={5} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Keterangan</th>
                    )}
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <th key={i} className="px-0.5 py-1.5 text-center font-medium text-muted-foreground w-7 text-[10px]">{i + 1}</th>
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
                  {filtered.map((s, i) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3 text-center font-medium text-muted-foreground sticky left-0 bg-card z-10">{i + 1}</td>
                      <td className="px-3 py-3 sticky left-10 bg-card z-10">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            {s.photo_url && <AvatarImage src={s.photo_url} alt={s.name} />}
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{s.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, d) => {
                        const code = s.days[d + 1] || "";
                        return (
                          <td key={d} className="px-0 py-2 text-center">
                            {code ? (
                              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${cellBadge(code)}`}>{code}</span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/40 border border-border/30" />
                            )}
                          </td>
                        );
                      })}
                      {isPulangMode ? (
                        <td className="px-1 py-2 text-center font-bold text-emerald-600">{s.totals.H || 0}</td>
                      ) : (() => {
                        const totalDays = s.totals.H + s.totals.S + s.totals.I + s.totals.A;
                        const pct = totalDays > 0 ? Math.round((s.totals.H / totalDays) * 100) : 0;
                        return (
                          <>
                            <td className="px-1 py-2 text-center font-bold text-emerald-600">{s.totals.H || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-violet-600">{s.totals.S || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-amber-600">{s.totals.I || 0}</td>
                            <td className="px-1 py-2 text-center font-bold text-red-600">{s.totals.A || 0}</td>
                            <td className={`px-1 py-2 text-center font-bold text-[10px] ${pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {totalDays > 0 ? `${pct}%` : "-"}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
