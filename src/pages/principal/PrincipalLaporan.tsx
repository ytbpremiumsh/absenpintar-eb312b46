import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet, Download, Users, GraduationCap, Receipt,
  BookOpen, Landmark, ClipboardList, Wallet,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtIDR } from "./_shared";
import { toast } from "sonner";

type Row = Record<string, any>;

function toCSV(rows: Row[], headers: { key: string; label: string }[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(",")).join("\n");
  return head + "\n" + body;
}

function downloadCSV(name: string, rows: Row[], headers: { key: string; label: string }[]) {
  if (!rows.length) { toast.error("Tidak ada data untuk diunduh"); return; }
  const blob = new Blob(["\ufeff" + toCSV(rows, headers)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const REPORTS = [
  { id: "absen_siswa", label: "Absensi Siswa", icon: Users },
  { id: "absen_guru", label: "Absensi Guru", icon: GraduationCap },
  { id: "spp", label: "SPP", icon: Receipt },
  { id: "tunggakan", label: "Tunggakan", icon: Wallet },
  { id: "kas", label: "Buku Kas", icon: BookOpen },
  { id: "settlement", label: "Settlement", icon: Landmark },
  { id: "jurnal", label: "Jurnal Mengajar", icon: ClipboardList },
];

export default function PrincipalLaporan() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const [tab, setTab] = useState("absen_siswa");
  const [loading, setLoading] = useState(false);

  const [absSiswa, setAbsSiswa] = useState<Row[]>([]);
  const [absGuru, setAbsGuru] = useState<Row[]>([]);
  const [spp, setSpp] = useState<Row[]>([]);
  const [tunggakan, setTunggakan] = useState<Row[]>([]);
  const [kas, setKas] = useState<Row[]>([]);
  const [settlement, setSettlement] = useState<Row[]>([]);
  const [jurnal, setJurnal] = useState<Row[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [studentsQ, teachersQ, studentLogsQ, teacherLogsQ, invQ, cashQ, setlQ, subjAttQ, subjectsQ, classesQ] = await Promise.all([
          supabase.from("students").select("id, name, class, nis").eq("school_id", schoolId),
          supabase.from("profiles").select("user_id, full_name").eq("school_id", schoolId),
          supabase.from("attendance_logs").select("date, status, student_id, attendance_type, created_at").eq("school_id", schoolId).gte("date", from).lte("date", to),
          supabase.from("teacher_attendance_logs").select("date, status, user_id, attendance_type, created_at").eq("school_id", schoolId).gte("date", from).lte("date", to),
          supabase.from("spp_invoices").select("invoice_number, student_id, total_amount, status, paid_at, created_at, month, year").eq("school_id", schoolId).gte("created_at", from).lte("created_at", to + "T23:59:59"),
          supabase.from("cash_book_entries").select("entry_date, direction, category, description, amount").eq("school_id", schoolId).gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }),
          supabase.from("spp_settlements").select("settlement_code, requested_at, status, total_transactions, total_gross, total_gateway_fee, total_net, withdraw_fee, final_payout, bank_name, account_number, account_holder").eq("school_id", schoolId).gte("requested_at", from).lte("requested_at", to + "T23:59:59").order("requested_at", { ascending: false }),
          supabase.from("subject_attendance").select("date, status, teaching_schedule_id, student_id").eq("school_id", schoolId).gte("date", from).lte("date", to),
          supabase.from("subjects").select("id, name").eq("school_id", schoolId),
          supabase.from("teaching_schedules").select("id, teacher_id, subject_id, class_id, day_of_week, start_time, end_time").eq("school_id", schoolId),
        ]);

        const students = studentsQ.data || [];
        const stMap = new Map(students.map((s: any) => [s.id, s]));
        const teachers = teachersQ.data || [];
        const tMap = new Map(teachers.map((t: any) => [t.user_id, t.full_name]));

        // Rekap Absensi Siswa (per siswa: hadir/izin/sakit/alfa)
        const perStudent: Record<string, any> = {};
        students.forEach((s: any) => {
          perStudent[s.id] = { NIS: s.nis || "-", Nama: s.name, Kelas: s.class || "-", Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
        });
        (studentLogsQ.data || []).forEach((l: any) => {
          if ((l.attendance_type ?? "datang") !== "datang") return;
          const r = perStudent[l.student_id]; if (!r) return;
          if (l.status === "hadir") r.Hadir++;
          else if (l.status === "izin") r.Izin++;
          else if (l.status === "sakit") r.Sakit++;
          else if (l.status === "alfa") r.Alfa++;
        });
        setAbsSiswa(Object.values(perStudent));

        // Rekap Absensi Guru
        const perTeacher: Record<string, any> = {};
        teachers.forEach((t: any) => {
          perTeacher[t.user_id] = { Nama: t.full_name || "-", Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
        });
        (teacherLogsQ.data || []).forEach((l: any) => {
          if ((l.attendance_type ?? "datang") !== "datang") return;
          const r = perTeacher[l.user_id]; if (!r) return;
          if (l.status === "hadir") r.Hadir++;
          else if (l.status === "izin") r.Izin++;
          else if (l.status === "sakit") r.Sakit++;
          else if (l.status === "alfa") r.Alfa++;
        });
        setAbsGuru(Object.values(perTeacher));

        // SPP
        setSpp((invQ.data || []).map((i: any) => {
          const st = stMap.get(i.student_id) as any;
          return {
            "No Invoice": i.invoice_number,
            Siswa: st?.name || "-",
            Kelas: st?.class || "-",
            Periode: `${i.month || "-"}/${i.year || "-"}`,
            Nominal: i.total_amount,
            Status: i.status,
            "Dibayar Pada": i.paid_at ? format(new Date(i.paid_at), "yyyy-MM-dd HH:mm") : "-",
          };
        }));

        // Tunggakan
        setTunggakan((invQ.data || []).filter((i: any) => i.status !== "paid").map((i: any) => {
          const st = stMap.get(i.student_id) as any;
          return {
            "No Invoice": i.invoice_number,
            Siswa: st?.name || "-",
            Kelas: st?.class || "-",
            Periode: `${i.month || "-"}/${i.year || "-"}`,
            Nominal: i.total_amount,
            Status: i.status,
          };
        }));

        // Buku Kas
        setKas((cashQ.data || []).map((e: any) => ({
          Tanggal: e.entry_date,
          Arah: e.direction === "in" ? "Masuk" : "Keluar",
          Kategori: e.category || "-",
          Keterangan: e.description || "-",
          Nominal: e.amount,
        })));

        // Settlement
        setSettlement((setlQ.data || []).map((s: any) => ({
          Kode: s.settlement_code,
          Tanggal: format(new Date(s.requested_at), "yyyy-MM-dd"),
          Status: s.status,
          Transaksi: s.total_transactions,
          Gross: s.total_gross,
          "Biaya Gateway": s.total_gateway_fee,
          Net: s.total_net,
          "Biaya Withdraw": s.withdraw_fee,
          "Cair Bersih": s.final_payout,
          Bank: `${s.bank_name || "-"} ${s.account_number || ""}`,
          Penerima: s.account_holder || "-",
        })));

        // Jurnal Mengajar (rekap per jadwal)
        const subjMap = new Map((subjectsQ.data || []).map((s: any) => [s.id, s.name]));
        const clsMap = new Map((classesQ.data || []).map((c: any) => [c.id, c.name]));
        const perSchedule: Record<string, any> = {};
        (subjAttQ.data || []).forEach((a: any) => {
          const key = `${a.teaching_schedule_id}|${a.date}`;
          if (!perSchedule[key]) {
            const sch = (classesQ.data || []).find(() => false); // placeholder
            perSchedule[key] = { schedule: a.teaching_schedule_id, date: a.date, hadir: 0, total: 0 };
          }
          perSchedule[key].total++;
          if (a.status === "hadir") perSchedule[key].hadir++;
        });
        const schedById = new Map((classesQ.data || []).map(() => [] as any));
        const allSchedules = (await supabase.from("teaching_schedules").select("id, teacher_id, subject_id, class_id, start_time, end_time").eq("school_id", schoolId)).data || [];
        const sMap2 = new Map(allSchedules.map((s: any) => [s.id, s]));
        setJurnal(Object.values(perSchedule).map((p: any) => {
          const sch = sMap2.get(p.schedule) as any;
          return {
            Tanggal: p.date,
            Guru: tMap.get(sch?.teacher_id) || "-",
            "Mata Pelajaran": subjMap.get(sch?.subject_id) || "-",
            Kelas: clsMap.get(sch?.class_id) || "-",
            Jam: sch ? `${String(sch.start_time).slice(0, 5)}-${String(sch.end_time).slice(0, 5)}` : "-",
            Hadir: p.hadir,
            Total: p.total,
          };
        }));

      } catch (e) {
        console.error(e);
        toast.error("Gagal memuat laporan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId, from, to]);

  const current = useMemo(() => {
    switch (tab) {
      case "absen_siswa": return { rows: absSiswa, headers: [
        { key: "NIS", label: "NIS" }, { key: "Nama", label: "Nama" }, { key: "Kelas", label: "Kelas" },
        { key: "Hadir", label: "Hadir" }, { key: "Izin", label: "Izin" }, { key: "Sakit", label: "Sakit" }, { key: "Alfa", label: "Alfa" },
      ]};
      case "absen_guru": return { rows: absGuru, headers: [
        { key: "Nama", label: "Nama" }, { key: "Hadir", label: "Hadir" }, { key: "Izin", label: "Izin" }, { key: "Sakit", label: "Sakit" }, { key: "Alfa", label: "Alfa" },
      ]};
      case "spp": return { rows: spp, headers: [
        { key: "No Invoice", label: "No Invoice" }, { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" },
        { key: "Periode", label: "Periode" }, { key: "Nominal", label: "Nominal" }, { key: "Status", label: "Status" }, { key: "Dibayar Pada", label: "Dibayar Pada" },
      ]};
      case "tunggakan": return { rows: tunggakan, headers: [
        { key: "No Invoice", label: "No Invoice" }, { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" },
        { key: "Periode", label: "Periode" }, { key: "Nominal", label: "Nominal" }, { key: "Status", label: "Status" },
      ]};
      case "kas": return { rows: kas, headers: [
        { key: "Tanggal", label: "Tanggal" }, { key: "Arah", label: "Arah" }, { key: "Kategori", label: "Kategori" },
        { key: "Keterangan", label: "Keterangan" }, { key: "Nominal", label: "Nominal" },
      ]};
      case "settlement": return { rows: settlement, headers: [
        { key: "Kode", label: "Kode" }, { key: "Tanggal", label: "Tanggal" }, { key: "Status", label: "Status" },
        { key: "Transaksi", label: "Transaksi" }, { key: "Gross", label: "Gross" }, { key: "Biaya Gateway", label: "Biaya Gateway" },
        { key: "Net", label: "Net" }, { key: "Biaya Withdraw", label: "Biaya Withdraw" }, { key: "Cair Bersih", label: "Cair Bersih" },
        { key: "Bank", label: "Bank" }, { key: "Penerima", label: "Penerima" },
      ]};
      case "jurnal": return { rows: jurnal, headers: [
        { key: "Tanggal", label: "Tanggal" }, { key: "Guru", label: "Guru" }, { key: "Mata Pelajaran", label: "Mata Pelajaran" },
        { key: "Kelas", label: "Kelas" }, { key: "Jam", label: "Jam" }, { key: "Hadir", label: "Hadir" }, { key: "Total", label: "Total" },
      ]};
      default: return { rows: [], headers: [] };
    }
  }, [tab, absSiswa, absGuru, spp, tunggakan, kas, settlement, jurnal]);

  const currentLabel = REPORTS.find((r) => r.id === tab)?.label || "Laporan";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Sekolah"
        subtitle="Semua laporan tersaji langsung di dashboard kepala sekolah"
        icon={FileSpreadsheet}
      />

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Filter Periode</CardTitle>
              <CardDescription>Rentang tanggal untuk semua laporan</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Dari</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Sampai</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <Button
                size="sm"
                onClick={() => downloadCSV(`${currentLabel}_${from}_${to}`, current.rows, current.headers)}
                disabled={!current.rows.length}
              >
                <Download className="h-4 w-4 mr-1.5" /> Unduh CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3 flex-wrap h-auto">
              {REPORTS.map((r) => (
                <TabsTrigger key={r.id} value={r.id} className="gap-1.5">
                  <r.icon className="h-3.5 w-3.5" /> {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {REPORTS.map((r) => (
              <TabsContent key={r.id} value={r.id}>
                <ReportTable
                  loading={loading}
                  rows={tab === r.id ? current.rows : []}
                  headers={tab === r.id ? current.headers : []}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTable({ loading, rows, headers }: { loading: boolean; rows: Row[]; headers: { key: string; label: string }[] }) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!rows.length) return <div className="text-sm text-muted-foreground text-center py-10">Belum ada data pada periode ini</div>;

  const isMoney = (k: string) => /nominal|gross|net|payout|withdraw|gateway|cair/i.test(k);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0 z-10">
            <tr>
              {headers.map((h) => (
                <th key={h.key} className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground whitespace-nowrap">{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                {headers.map((h) => {
                  const v = row[h.key];
                  return (
                    <td key={h.key} className="px-3 py-2 whitespace-nowrap">
                      {h.key === "Status" ? (
                        <Badge variant="secondary" className="text-[10px]">{String(v)}</Badge>
                      ) : isMoney(h.key) && typeof v === "number" ? (
                        fmtIDR(v)
                      ) : (
                        String(v ?? "-")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && (
        <div className="text-[11px] text-muted-foreground px-3 py-2 bg-muted/20 border-t">
          Menampilkan 500 dari {rows.length} baris. Unduh CSV untuk data lengkap.
        </div>
      )}
    </div>
  );
}
