import { useEffect, useMemo, useState } from "react";
import {
  Receipt, Wallet, TrendingUp, TrendingDown, Loader2, Users, CheckCircle2,
  AlertTriangle, PercentSquare, FileText, FileSpreadsheet, Table as TableIcon,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, StatsRow, downloadCSV, type Header, type Row } from "./_common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { fmtIDR } from "../_shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import XLSXStyle from "xlsx-js-style";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { toast } from "sonner";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

/** Tahun Ajaran (TA) — Juli s.d. Juni tahun berikutnya. */
function toTA(year: number, month: number) {
  if (month >= 7) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}
function taOptions(years: number[]) {
  const set = new Set<string>();
  years.forEach((y) => { set.add(`${y}/${y + 1}`); set.add(`${y - 1}/${y}`); });
  return Array.from(set).sort().reverse();
}

type Invoice = {
  id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  class_name: string;
  period_month: number;
  period_year: number;
  period_label: string;
  total_amount: number;
  amount: number;
  net_amount: number;
  status: string;
  paid_at: string | null;
  due_date: string | null;
  payment_method: string | null;
  description: string;
};

export default function LaporanSPP() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string>("");

  // Filters
  const [ta, setTa] = useState<string>("all");     // Tahun Ajaran (e.g. "2025/2026")
  const [month, setMonth] = useState<string>("all"); // period_month "1".."12"
  const [kelas, setKelas] = useState<string>("all");
  const [status, setStatus] = useState<string>("all"); // all | paid | unpaid | pending
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [{ data }, { data: s }] = await Promise.all([
        supabase.from("spp_invoices")
          .select("id, invoice_number, student_id, student_name, class_name, period_month, period_year, period_label, total_amount, amount, net_amount, status, paid_at, due_date, payment_method, description")
          .eq("school_id", schoolId)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false }),
        supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      ]);
      setInvoices((data as any) || []);
      setSchoolName((s as any)?.name || "");
      setLoading(false);
    })();
  }, [schoolId]);

  // Derived filter options
  const kelasOptions = useMemo(
    () => Array.from(new Set(invoices.map((i) => i.class_name).filter(Boolean))).sort(),
    [invoices]
  );
  const taOpts = useMemo(
    () => taOptions(Array.from(new Set(invoices.map((i) => i.period_year)))),
    [invoices]
  );

  // Filtered invoices
  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (ta !== "all" && toTA(i.period_year, i.period_month) !== ta) return false;
      if (month !== "all" && String(i.period_month) !== month) return false;
      if (kelas !== "all" && i.class_name !== kelas) return false;
      if (status !== "all") {
        if (status === "paid" && i.status !== "paid") return false;
        if (status === "unpaid" && !["unpaid", "pending"].includes(i.status)) return false;
        if (status === "pending" && i.status !== "pending") return false;
      }
      if (from) {
        const d = i.paid_at || i.due_date || "";
        if (!d || d.slice(0, 10) < from) return false;
      }
      if (to) {
        const d = i.paid_at || i.due_date || "";
        if (!d || d.slice(0, 10) > to) return false;
      }
      return true;
    });
  }, [invoices, ta, month, kelas, status, from, to]);

  // Ringkasan
  const summary = useMemo(() => {
    let tagihan = 0, bayar = 0, tunggakan = 0, paidCount = 0, unpaidCount = 0;
    for (const i of filtered) {
      tagihan += i.total_amount || 0;
      if (i.status === "paid") { bayar += i.total_amount || 0; paidCount++; }
      else { tunggakan += i.total_amount || 0; unpaidCount++; }
    }
    const rate = tagihan > 0 ? (bayar / tagihan) * 100 : 0;
    return { tagihan, bayar, tunggakan, paidCount, unpaidCount, rate, total: filtered.length };
  }, [filtered]);

  // Rekap per Kelas
  const perKelas = useMemo(() => {
    const map = new Map<string, { kelas: string; tagihan: number; bayar: number; tunggakan: number; paid: number; unpaid: number; total: number }>();
    for (const i of filtered) {
      const k = i.class_name || "-";
      const row = map.get(k) || { kelas: k, tagihan: 0, bayar: 0, tunggakan: 0, paid: 0, unpaid: 0, total: 0 };
      row.tagihan += i.total_amount || 0;
      row.total += 1;
      if (i.status === "paid") { row.bayar += i.total_amount || 0; row.paid += 1; }
      else { row.tunggakan += i.total_amount || 0; row.unpaid += 1; }
      map.set(k, row);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, rate: r.tagihan > 0 ? (r.bayar / r.tagihan) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [filtered]);

  // Statistik per periode (bulan)
  const perPeriode = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tagihan: number; bayar: number; tunggakan: number; sortKey: number }>();
    for (const i of filtered) {
      const key = `${i.period_year}-${String(i.period_month).padStart(2, "0")}`;
      const row = map.get(key) || {
        key,
        label: `${MONTHS[i.period_month - 1]} ${String(i.period_year).slice(-2)}`,
        tagihan: 0, bayar: 0, tunggakan: 0,
        sortKey: i.period_year * 100 + i.period_month,
      };
      row.tagihan += i.total_amount || 0;
      if (i.status === "paid") row.bayar += i.total_amount || 0;
      else row.tunggakan += i.total_amount || 0;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [filtered]);

  // Daftar siswa: gabungkan per (student_id) status pelunasan berdasarkan invoice filtered
  const perSiswa = useMemo(() => {
    const map = new Map<string, {
      student_id: string; student_name: string; class_name: string;
      totalInv: number; paidInv: number; tagihan: number; bayar: number; tunggakan: number;
    }>();
    for (const i of filtered) {
      const row = map.get(i.student_id) || {
        student_id: i.student_id, student_name: i.student_name, class_name: i.class_name,
        totalInv: 0, paidInv: 0, tagihan: 0, bayar: 0, tunggakan: 0,
      };
      row.totalInv += 1;
      row.tagihan += i.total_amount || 0;
      if (i.status === "paid") { row.paidInv += 1; row.bayar += i.total_amount || 0; }
      else row.tunggakan += i.total_amount || 0;
      map.set(i.student_id, row);
    }
    const arr = Array.from(map.values());
    const sudah = arr.filter((r) => r.tunggakan === 0 && r.totalInv > 0)
      .sort((a, b) => a.class_name.localeCompare(b.class_name) || a.student_name.localeCompare(b.student_name));
    const belum = arr.filter((r) => r.tunggakan > 0)
      .sort((a, b) => b.tunggakan - a.tunggakan);
    return { sudah, belum, all: arr };
  }, [filtered]);

  // ========= Export helpers =========
  const filterLabel = () => {
    const parts: string[] = [];
    parts.push(ta !== "all" ? `TA ${ta}` : "Semua TA");
    if (month !== "all") parts.push(`Bulan ${MONTHS_FULL[Number(month) - 1]}`);
    if (kelas !== "all") parts.push(`Kelas ${kelas}`);
    if (status !== "all") parts.push(`Status ${status}`);
    if (from || to) parts.push(`${from || "awal"} s.d. ${to || "sekarang"}`);
    return parts.join(" • ");
  };
  const fileTag = () => {
    const p: string[] = [];
    if (ta !== "all") p.push(ta.replace("/", "-"));
    if (month !== "all") p.push(`bln${month}`);
    if (kelas !== "all") p.push(kelas.replace(/\s+/g, ""));
    if (status !== "all") p.push(status);
    return p.length ? p.join("_") : "semua";
  };

  // CSV — daftar rinci tagihan
  const exportCSV = () => {
    const headers: Header[] = [
      { key: "Invoice", label: "Invoice" },
      { key: "Siswa", label: "Siswa" },
      { key: "Kelas", label: "Kelas" },
      { key: "Periode", label: "Periode" },
      { key: "Tagihan", label: "Tagihan", type: "money" },
      { key: "Status", label: "Status" },
      { key: "Tgl Bayar", label: "Tgl Bayar" },
      { key: "Metode", label: "Metode" },
    ];
    const rows: Row[] = filtered.map((i) => ({
      Invoice: i.invoice_number,
      Siswa: i.student_name,
      Kelas: i.class_name,
      Periode: i.period_label,
      Tagihan: i.total_amount || 0,
      Status: i.status,
      "Tgl Bayar": i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-",
      Metode: i.payment_method || "-",
    }));
    downloadCSV(`Laporan_SPP_${fileTag()}`, rows, headers);
  };

  // Excel — 3 sheet: Ringkasan+Per Kelas, Statistik Periode, Detail Tagihan
  const exportExcel = () => {
    if (filtered.length === 0) { toast.error("Tidak ada data untuk diunduh"); return; }
    const wb = XLSXStyle.utils.book_new();

    // Sheet 1: Ringkasan + Per Kelas
    const s1: any[][] = [];
    s1.push(["LAPORAN PEMBAYARAN SPP"]);
    s1.push([schoolName || "-"]);
    s1.push([filterLabel()]);
    s1.push([`Dicetak: ${new Date().toLocaleString("id-ID")}`]);
    s1.push([]);
    s1.push(["RINGKASAN"]);
    s1.push(["Total Tagihan", summary.tagihan]);
    s1.push(["Total Pembayaran", summary.bayar]);
    s1.push(["Total Tunggakan", summary.tunggakan]);
    s1.push(["Persentase Pelunasan", `${summary.rate.toFixed(2)}%`]);
    s1.push(["Jumlah Invoice", summary.total]);
    s1.push(["Lunas", summary.paidCount]);
    s1.push(["Belum Lunas", summary.unpaidCount]);
    s1.push([]);
    s1.push(["REKAP PER KELAS"]);
    s1.push(["Kelas", "Invoice", "Lunas", "Belum", "Tagihan", "Terbayar", "Tunggakan", "% Pelunasan"]);
    perKelas.forEach((k) =>
      s1.push([k.kelas, k.total, k.paid, k.unpaid, k.tagihan, k.bayar, k.tunggakan, `${k.rate.toFixed(1)}%`])
    );
    const ws1 = XLSXStyle.utils.aoa_to_sheet(s1);
    ws1["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
    ws1["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 7 } },
      { s: { r: 14, c: 0 }, e: { r: 14, c: 7 } },
    ];
    if (ws1["A1"]) ws1["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "1F2A5B" } }, alignment: { horizontal: "center" } };
    if (ws1["A2"]) ws1["A2"].s = { font: { sz: 11, bold: true }, alignment: { horizontal: "center" } };
    if (ws1["A3"]) ws1["A3"].s = { font: { sz: 10, color: { rgb: "555555" } }, alignment: { horizontal: "center" } };
    if (ws1["A4"]) ws1["A4"].s = { font: { italic: true, sz: 9, color: { rgb: "888888" } }, alignment: { horizontal: "center" } };
    ["A6", "A15"].forEach((c) => { if (ws1[c]) ws1[c].s = { font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "5B6CF9" } }, alignment: { horizontal: "center" } }; });
    // Style header per kelas row
    for (let c = 0; c < 8; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 15, c });
      if (!ws1[addr]) ws1[addr] = { t: "s", v: "" };
      ws1[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1F2A5B" } }, alignment: { horizontal: "center" } };
    }
    XLSXStyle.utils.book_append_sheet(wb, ws1, "Ringkasan");

    // Sheet 2: Statistik Periode
    const s2: any[][] = [["Periode", "Tagihan", "Terbayar", "Tunggakan"]];
    perPeriode.forEach((p) => s2.push([p.label, p.tagihan, p.bayar, p.tunggakan]));
    const ws2 = XLSXStyle.utils.aoa_to_sheet(s2);
    ws2["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    for (let c = 0; c < 4; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws2[addr]) ws2[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "5B6CF9" } }, alignment: { horizontal: "center" } };
    }
    XLSXStyle.utils.book_append_sheet(wb, ws2, "Statistik Periode");

    // Sheet 3: Detail Tagihan
    const s3: any[][] = [["Invoice", "Siswa", "Kelas", "Periode", "Tagihan", "Status", "Tgl Bayar", "Metode"]];
    filtered.forEach((i) => s3.push([
      i.invoice_number, i.student_name, i.class_name, i.period_label,
      i.total_amount || 0, i.status,
      i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-",
      i.payment_method || "-",
    ]));
    const ws3 = XLSXStyle.utils.aoa_to_sheet(s3);
    ws3["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    for (let c = 0; c < 8; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws3[addr]) ws3[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "5B6CF9" } }, alignment: { horizontal: "center" } };
    }
    XLSXStyle.utils.book_append_sheet(wb, ws3, "Detail Tagihan");

    XLSXStyle.writeFile(wb, `Laporan_SPP_${fileTag()}.xlsx`);
    toast.success("Excel berhasil diunduh");
  };

  // PDF — ringkasan + rekap kelas
  const exportPDF = () => {
    if (filtered.length === 0) { toast.error("Tidak ada data untuk diunduh"); return; }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.text("LAPORAN PEMBAYARAN SPP", w / 2, 14, { align: "center" });
    doc.setFontSize(11); doc.text(schoolName || "-", w / 2, 21, { align: "center" });
    doc.setFontSize(9); doc.text(filterLabel() || "Semua Data", w / 2, 27, { align: "center" });
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, w / 2, 32, { align: "center" });

    (doc as any).autoTable({
      startY: 38,
      head: [["Ringkasan", "Nilai"]],
      body: [
        ["Total Tagihan", fmtIDR(summary.tagihan)],
        ["Total Pembayaran", fmtIDR(summary.bayar)],
        ["Total Tunggakan", fmtIDR(summary.tunggakan)],
        ["Persentase Pelunasan", `${summary.rate.toFixed(2)}%`],
        ["Jumlah Invoice", `${summary.total} (Lunas ${summary.paidCount} • Belum ${summary.unpaidCount})`],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [91, 108, 249] },
    });

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["Kelas", "Inv", "Lunas", "Belum", "Tagihan", "Terbayar", "Tunggakan", "%"]],
      body: perKelas.map((k) => [
        k.kelas, k.total, k.paid, k.unpaid,
        fmtIDR(k.tagihan), fmtIDR(k.bayar), fmtIDR(k.tunggakan), `${k.rate.toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [31, 42, 91] },
      columnStyles: {
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
      },
    });

    if (perPeriode.length > 0) {
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Periode", "Tagihan", "Terbayar", "Tunggakan"]],
        body: perPeriode.map((p) => [p.label, fmtIDR(p.tagihan), fmtIDR(p.bayar), fmtIDR(p.tunggakan)]),
        styles: { fontSize: 8, cellPadding: 1.6 },
        headStyles: { fillColor: [31, 42, 91] },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });
    }

    doc.save(`Laporan_SPP_${fileTag()}.pdf`);
    toast.success("PDF berhasil diunduh");
  };

  return (
    <ReportShell
      title="Laporan Pembayaran SPP"
      subtitle="Ringkasan tagihan, pembayaran & tunggakan SPP — data langsung dari modul Pembayaran SPP"
      icon={Receipt}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      datesOptional
      onDownload={exportCSV}
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border border-white/20">
              Export <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={exportPDF}><FileText className="h-4 w-4 mr-2" /> PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV}><TableIcon className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      extraFilters={
        <>
          <div>
            <Label className="text-[10px] text-muted-foreground">Tahun Ajaran</Label>
            <Select value={ta} onValueChange={setTa}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Semua TA</SelectItem>
                {taOpts.map((t) => <SelectItem key={t} value={t}>TA {t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Periode Bulan</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Semua Bulan</SelectItem>
                {MONTHS_FULL.map((m, idx) => <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Kelas</Label>
            <Select value={kelas} onValueChange={setKelas}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Status Pembayaran</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="unpaid">Belum Lunas</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      }
      summary={
        <div className="space-y-3">
          <StatsRow items={[
            { label: "Total Tagihan", value: fmtIDR(summary.tagihan), sub: `${summary.total} invoice`, tone: "primary", icon: Receipt },
            { label: "Total Pembayaran", value: fmtIDR(summary.bayar), sub: `${summary.paidCount} lunas`, tone: "emerald", icon: Wallet },
            { label: "Total Tunggakan", value: fmtIDR(summary.tunggakan), sub: `${summary.unpaidCount} belum`, tone: "rose", icon: TrendingDown },
            { label: "% Pelunasan", value: `${summary.rate.toFixed(1)}%`, sub: summary.rate >= 80 ? "sangat baik" : summary.rate >= 60 ? "cukup baik" : "perlu perhatian", tone: summary.rate >= 80 ? "emerald" : summary.rate >= 60 ? "amber" : "rose", icon: PercentSquare },
          ]} />
        </div>
      }
    >
      {loading ? (
        <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="kelas" className="space-y-3">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="kelas" className="text-xs">Rekap Per Kelas</TabsTrigger>
            <TabsTrigger value="periode" className="text-xs">Statistik Periode</TabsTrigger>
            <TabsTrigger value="sudah" className="text-xs">Sudah Bayar</TabsTrigger>
            <TabsTrigger value="belum" className="text-xs">Belum Bayar</TabsTrigger>
          </TabsList>

          {/* REKAP PER KELAS */}
          <TabsContent value="kelas" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#5B6CF9]" /> Rekap Pembayaran per Kelas</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">Kelas</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-center">Inv</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-center">Lunas</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-center">Belum</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tagihan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Terbayar</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tunggakan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">% Lunas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perKelas.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Belum ada data</TableCell></TableRow>
                    ) : perKelas.map((k) => (
                      <TableRow key={k.kelas} className="hover:bg-muted/40 cursor-pointer" onClick={() => setKelas(k.kelas)}>
                        <TableCell className="text-sm font-medium">{k.kelas}</TableCell>
                        <TableCell className="text-center text-sm">{k.total}</TableCell>
                        <TableCell className="text-center text-sm text-emerald-600 font-semibold">{k.paid}</TableCell>
                        <TableCell className="text-center text-sm text-rose-600 font-semibold">{k.unpaid}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtIDR(k.tagihan)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-600">{fmtIDR(k.bayar)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-rose-600">{fmtIDR(k.tunggakan)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-[10px] ${k.rate >= 80 ? "bg-emerald-500" : k.rate >= 60 ? "bg-amber-500" : "bg-rose-500"} text-white`}>
                            {k.rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATISTIK PERIODE */}
          <TabsContent value="periode" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#5B6CF9]" /> Statistik Pembayaran per Periode</CardTitle></CardHeader>
              <CardContent>
                {perPeriode.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">Belum ada data</div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perPeriode} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} />
                        <Tooltip formatter={(v: any) => fmtIDR(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="tagihan" name="Tagihan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="bayar" name="Terbayar" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="tunggakan" name="Tunggakan" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">Periode</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tagihan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Terbayar</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tunggakan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">% Lunas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perPeriode.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Belum ada data</TableCell></TableRow>
                    ) : perPeriode.map((p) => {
                      const r = p.tagihan > 0 ? (p.bayar / p.tagihan) * 100 : 0;
                      return (
                        <TableRow key={p.key}>
                          <TableCell className="text-sm font-medium">{p.label}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmtIDR(p.tagihan)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-emerald-600">{fmtIDR(p.bayar)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-rose-600">{fmtIDR(p.tunggakan)}</TableCell>
                          <TableCell className="text-right text-sm">{r.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUDAH BAYAR */}
          <TabsContent value="sudah" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Siswa Sudah Lunas — {perSiswa.sudah.length} siswa</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">Siswa</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Kelas</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-center">Invoice</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Total Bayar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perSiswa.sudah.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Belum ada siswa yang lunas pada filter ini</TableCell></TableRow>
                    ) : perSiswa.sudah.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="text-sm font-medium">{s.student_name}</TableCell>
                        <TableCell className="text-sm">{s.class_name}</TableCell>
                        <TableCell className="text-center text-sm">{s.paidInv} / {s.totalInv}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-600">{fmtIDR(s.bayar)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BELUM BAYAR */}
          <TabsContent value="belum" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Siswa Belum Lunas — {perSiswa.belum.length} siswa</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">Siswa</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Kelas</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-center">Inv</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tagihan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Sudah Bayar</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-right">Tunggakan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perSiswa.belum.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Tidak ada tunggakan pada filter ini</TableCell></TableRow>
                    ) : perSiswa.belum.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="text-sm font-medium">{s.student_name}</TableCell>
                        <TableCell className="text-sm">{s.class_name}</TableCell>
                        <TableCell className="text-center text-sm">{s.paidInv} / {s.totalInv}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtIDR(s.tagihan)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-600">{fmtIDR(s.bayar)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-rose-600 font-semibold">{fmtIDR(s.tunggakan)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </ReportShell>
  );
}
