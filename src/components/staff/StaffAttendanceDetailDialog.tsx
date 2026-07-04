import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, Calendar, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, XCircle, Phone, Hash, TrendingUp, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const ROLE_LABEL: Record<string, string> = { teacher: "Guru", staff: "Operator", bendahara: "Bendahara", school_admin: "Admin", wali_kelas: "Wali Kelas" };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  fullName: string;
  schoolId: string | undefined;
  photoUrl?: string | null;
  roles?: string[];
  nip?: string | null;
  phone?: string | null;
}

export default function StaffAttendanceDetailDialog({ open, onOpenChange, userId, fullName, schoolId, photoUrl, roles = [], nip, phone }: Props) {
  const [month, setMonth] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"datang" | "pulang">("datang");

  useEffect(() => {
    if (!open || !userId || !schoolId) return;
    const load = async () => {
      setLoading(true);
      const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().slice(0,10);
      const end = new Date(month.getFullYear(), month.getMonth()+1, 0).toISOString().slice(0,10);
      const { data } = await supabase.from("teacher_attendance_logs" as any)
        .select("date, time, status, attendance_type")
        .eq("school_id", schoolId).eq("user_id", userId)
        .gte("date", start).lte("date", end)
        .order("date", { ascending: true });
      setLogs(data || []);
      setLoading(false);
    };
    load();
  }, [open, userId, schoolId, month]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const dayArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i+1), [daysInMonth]);

  // Working days: exclude weekends
  const workingDays = useMemo(() => {
    return dayArray.filter((d) => {
      const dt = new Date(month.getFullYear(), month.getMonth(), d);
      const day = dt.getDay();
      return day !== 0 && day !== 6;
    });
  }, [dayArray, month]);

  const summary = useMemo(() => {
    let H = 0;
    for (const d of dayArray) {
      const dateStr = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const found = logs.find((l: any) => l.date === dateStr && (l.attendance_type || "datang") === tab);
      if (found) H++;
    }
    return { H, A: daysInMonth - H };
  }, [logs, dayArray, month, tab, daysInMonth]);

  // Analytics across BOTH datang & pulang for the month
  const analytics = useMemo(() => {
    const datangDays = new Set(logs.filter((l:any) => (l.attendance_type||"datang") === "datang").map((l:any) => l.date));
    const pulangDays = new Set(logs.filter((l:any) => l.attendance_type === "pulang").map((l:any) => l.date));
    const totalWD = workingDays.length || 1;
    const rateDatang = Math.round((datangDays.size / totalWD) * 100);
    const ratePulang = Math.round((pulangDays.size / totalWD) * 100);
    // status breakdown from datang
    const datangLogs = logs.filter((l:any) => (l.attendance_type||"datang") === "datang");
    const counts = { hadir: 0, izin: 0, sakit: 0, alfa: 0 } as Record<string, number>;
    datangLogs.forEach((l:any) => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return { rateDatang, ratePulang, datangCount: datangDays.size, pulangCount: pulangDays.size, workingTotal: workingDays.length, counts };
  }, [logs, workingDays]);

  // Weekly bar chart (attendance rate per week - datang)
  const weekly = useMemo(() => {
    const weeks: { label: string; present: number; total: number }[] = [];
    let current: { label: string; present: number; total: number } | null = null;
    for (const d of dayArray) {
      const dt = new Date(month.getFullYear(), month.getMonth(), d);
      const dow = dt.getDay();
      if (!current || dow === 1) {
        current = { label: `M${weeks.length + 1}`, present: 0, total: 0 };
        weeks.push(current);
      }
      if (dow !== 0 && dow !== 6) {
        current.total++;
        const dateStr = dt.toISOString().slice(0,10);
        if (logs.some((l:any) => l.date === dateStr && (l.attendance_type||"datang") === "datang")) current.present++;
      }
    }
    return weeks.filter(w => w.total > 0);
  }, [dayArray, month, logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Kehadiran & Analitik</DialogTitle>
          <DialogDescription>Riwayat absensi, ringkasan, dan analitik bulanan.</DialogDescription>
        </DialogHeader>

        {/* Profile block */}
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="h-14 w-14 rounded-full object-cover ring-2 ring-[#5B6CF9]/40" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center text-white font-bold text-lg ring-2 ring-[#5B6CF9]/40">
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-base truncate">{fullName}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px] py-0 px-1.5">{ROLE_LABEL[r] || r}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
              {nip && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />NIP {nip}</span>}
              {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
              {!nip && !phone && <span className="flex items-center gap-1"><User className="h-3 w-3" />Data pribadi belum lengkap</span>}
            </div>
          </div>
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth()-1); setMonth(d); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-1.5 bg-muted/50 rounded-lg flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth()+1); setMonth(d); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">Hari kerja: {analytics.workingTotal}</div>
        </div>

        {/* Analytics cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-2">
          <div className="rounded-xl border p-3 bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200/60">
            <p className="text-[10px] text-emerald-700/80 font-medium">Hadir Datang</p>
            <p className="text-xl font-bold text-emerald-700">{analytics.counts.hadir}</p>
            <p className="text-[10px] text-emerald-700/70 mt-0.5">{analytics.rateDatang}% dari hari kerja</p>
          </div>
          <div className="rounded-xl border p-3 bg-sky-50/60 dark:bg-sky-500/10 border-sky-200/60">
            <p className="text-[10px] text-sky-700/80 font-medium">Pulang</p>
            <p className="text-xl font-bold text-sky-700">{analytics.pulangCount}</p>
            <p className="text-[10px] text-sky-700/70 mt-0.5">{analytics.ratePulang}% dari hari kerja</p>
          </div>
          <div className="rounded-xl border p-3 bg-amber-50/60 dark:bg-amber-500/10 border-amber-200/60">
            <p className="text-[10px] text-amber-700/80 font-medium">Izin / Sakit</p>
            <p className="text-xl font-bold text-amber-700">{analytics.counts.izin + analytics.counts.sakit}</p>
            <p className="text-[10px] text-amber-700/70 mt-0.5">I: {analytics.counts.izin} · S: {analytics.counts.sakit}</p>
          </div>
          <div className="rounded-xl border p-3 bg-red-50/60 dark:bg-red-500/10 border-red-200/60">
            <p className="text-[10px] text-red-700/80 font-medium">Alfa</p>
            <p className="text-xl font-bold text-red-700">{analytics.counts.alfa}</p>
            <p className="text-[10px] text-red-700/70 mt-0.5">Tanpa keterangan</p>
          </div>
        </div>

        {/* Weekly bar chart */}
        {weekly.length > 0 && (
          <div className="mt-2 p-3 rounded-xl border">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-[#5B6CF9]" />
              <p className="text-xs font-semibold">Tingkat Kehadiran Mingguan (Datang)</p>
            </div>
            <div className="flex items-end gap-2 h-24">
              {weekly.map((w, i) => {
                const pct = w.total ? Math.round((w.present / w.total) * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] font-semibold text-muted-foreground">{pct}%</div>
                    <div className="w-full bg-muted rounded-md relative overflow-hidden" style={{ height: "60px" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#5B6CF9] to-[#7C8BFA] rounded-md transition-all"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground">{w.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-1">
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="datang" className="gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" />Datang</TabsTrigger>
            <TabsTrigger value="pulang" className="gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5" />Pulang</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{summary.H}</p>
              <p className="text-[11px] text-emerald-700/70">Hadir ({tab})</p>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 p-3 flex items-center gap-3">
            <XCircle className="h-7 w-7 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{summary.A}</p>
              <p className="text-[11px] text-red-700/70">Tidak Hadir</p>
            </div>
          </div>
        </div>

        <div className="mt-3 border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border text-xs">
              {dayArray.map((d) => {
                const dateStr = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const found = logs.find((l: any) => l.date === dateStr && (l.attendance_type || "datang") === tab);
                return (
                  <div key={d} className={`bg-card p-2 min-h-[52px] flex flex-col items-center justify-center ${found ? "" : "text-muted-foreground/50"}`}>
                    <p className="text-[10px] font-semibold">{d}</p>
                    {found ? (
                      <span className="mt-0.5 text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">{(found.time || "").slice(0,5)}</span>
                    ) : (
                      <span className="text-[10px]">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
