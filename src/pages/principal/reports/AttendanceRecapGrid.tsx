import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClipboardList, Clock } from "lucide-react";
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
  sub: string; // NIS or role label
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
  const [filter, setFilter] = useState("all"); // class or role
  const [rekapTab, setRekapTab] = useState<"datang" | "pulang">("datang");
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ value: string; label: string }[]>([]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        if (kind === "student") {
          const [studentsQ, logsQ] = await Promise.all([
            supabase.from("students").select("id, student_id, name, class, photo_url").eq("school_id", schoolId).order("class").order("name"),
            supabase.from("attendance_logs").select("student_id, status, attendance_type, date").eq("school_id", schoolId).gte("date", start).lte("date", end),
          ]);
          const students = studentsQ.data || [];
          const classes = Array.from(new Set(students.map((s: any) => s.class))).sort();
          setFilterOptions(classes.map((c) => ({ value: c, label: c })));
          const map: Record<string, PersonRow> = {};
          students.forEach((s: any) => {
            map[s.id] = { id: s.id, name: s.name, sub: s.student_id, photo_url: s.photo_url, cls: s.class, days: {}, totals: { H: 0, S: 0, I: 0, A: 0 } };
          });
          (logsQ.data || []).forEach((l: any) => {
            const type = l.attendance_type ?? "datang";
            if (type !== rekapTab) return;
            const r = map[l.student_id]; if (!r) return;
            const d = new Date(l.date).getDate();
            const code = rekapTab === "pulang" ? "H" : STATUS_TO_CODE[l.status];
            if (!code) return;
            r.days[d] = code;
            r.totals[code as keyof typeof r.totals]++;
          });
          setRows(Object.values(map));
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
          const map: Record<string, PersonRow> = {};
          staff.forEach((p: any) => {
            const roles = (roleMap.get(p.user_id) || []).filter((r) => allowed.has(r));
            const primary = roles.includes("teacher") ? "teacher" : roles.find((r) => r !== "principal") || roles[0] || "staff";
            rolesSet.add(primary);
            map[p.user_id] = { id: p.user_id, name: p.full_name || "-", sub: ROLE_LABEL[primary] || primary, photo_url: p.photo_url, role: primary, days: {}, totals: { H: 0, S: 0, I: 0, A: 0 } };
          });
          setFilterOptions(Array.from(rolesSet).map((r) => ({ value: r, label: ROLE_LABEL[r] || r })));
          (logsQ.data || []).forEach((l: any) => {
            const type = l.attendance_type ?? "datang";
            if (type !== rekapTab) return;
            const r = map[l.user_id]; if (!r) return;
            const d = new Date(l.date).getDate();
            const code = rekapTab === "pulang" ? "H" : STATUS_TO_CODE[l.status];
            if (!code) return;
            r.days[d] = code;
            r.totals[code as keyof typeof r.totals]++;
          });
          setRows(Object.values(map));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId, kind, month, year, rekapTab, start, end]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => (kind === "student" ? r.cls === filter : r.role === filter));
  }, [rows, filter, kind]);

  const isPulangMode = rekapTab === "pulang";
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const label = kind === "student" ? "siswa" : "guru & staff";
  const filterLabel = kind === "student" ? "Kelas" : "Peran";

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
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
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
