import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BookOpen, Plus, TrendingUp, TrendingDown, Wallet, Loader2, Download, Trash2, Zap, Receipt, Landmark, ArrowRight } from "lucide-react";
import XLSXStyle from "xlsx-js-style";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";
import { Link } from "react-router-dom";

const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;
const OUT_CATEGORIES = ["Operasional", "Gaji", "Perlengkapan", "Perawatan", "Utilitas", "Kegiatan", "Lainnya"];
const IN_CATEGORIES = ["Donasi", "Hibah", "Kas Manual", "Bunga Bank", "Lainnya"];

type Entry = {
  id: string;
  entry_date: string;
  direction: "in" | "out";
  category: string;
  amount: number; // Gross amount — nilai pembayaran asli sesuai tagihan
  description: string | null;
  reference: string | null;   // No. Invoice / No. Bukti
  method: string | null;      // Metode pembayaran (QRIS, VA, Transfer, Tunai, dll)
  status: string | null;      // Status pembayaran (Lunas, Manual, dll)
  source: "manual" | "auto";
};


export default function BendaharaBukuKas() {
  const { profile, user } = useAuth();
  const [manual, setManual] = useState<Entry[]>([]);
  const [autoEntries, setAutoEntries] = useState<Entry[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Entry | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth);
  const [dateTo, setDateTo] = useState<string>(today);
  const [fDir, setFDir] = useState<string>("all");
  const [fCat, setFCat] = useState<string>("all");

  const [form, setForm] = useState<Partial<Entry>>({
    entry_date: today,
    direction: "in",
    category: "Kas Manual",
    amount: 0,
    description: "",
    reference: "",
  });

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    const [m, inv, stl] = await Promise.all([
      supabase.from("cash_book_entries").select("*").eq("school_id", profile.school_id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("spp_invoices").select("id, invoice_number, student_name, class_name, period_label, total_amount, net_amount, paid_at, payment_method, status").eq("school_id", profile.school_id).eq("status", "paid").not("paid_at", "is", null).order("paid_at", { ascending: false }),
      supabase.from("spp_settlements").select("id, settlement_code, withdraw_fee, final_payout, total_gross, status, requested_at, approved_at, paid_at, bank_name, account_number, account_holder").eq("school_id", profile.school_id).order("requested_at", { ascending: false }),
    ]);
    const manualRows: Entry[] = ((m.data as any[]) || []).map((r) => ({
      id: r.id,
      entry_date: r.entry_date,
      direction: r.direction,
      category: r.category,
      amount: r.amount,
      description: r.description,
      reference: r.reference,
      method: null,
      status: null,
      source: "manual",
    }));
    const autoInvoiceRows: Entry[] = ((inv.data as any[]) || []).map((i) => ({
      id: `auto-${i.id}`,
      entry_date: (i.paid_at || "").slice(0, 10),
      direction: "in",
      category: "SPP Online",
      // GROSS: nilai pembayaran asli sesuai tagihan siswa (bukan net_amount setelah MDR).
      // Biaya pencairan (Rp 3.000/settlement) dicatat terpisah sebagai Kas Keluar
      // kategori "Biaya Pencairan ATSkolla" dari data spp_settlements.
      amount: i.total_amount ?? i.net_amount ?? 0,
      description: `SPP ${i.student_name} • ${i.class_name} • ${i.period_label}`,
      reference: i.invoice_number || null,
      method: formatPaymentMethodLabel(i.payment_method),
      status: "Lunas",
      source: "auto",
    }));
    // Biaya Pencairan: hanya settlement yang sudah paid (dana benar-benar cair ke rekening sekolah)
    // dan withdraw_fee > 0 — inilah biaya riil yang dipotong ATSkolla.
    const autoFeeRows: Entry[] = ((stl.data as any[]) || [])
      .filter((s) => s.status === "paid" && (s.withdraw_fee || 0) > 0)
      .map((s) => ({
        id: `fee-${s.id}`,
        entry_date: (s.paid_at || s.approved_at || s.requested_at || "").slice(0, 10),
        direction: "out",
        category: "Biaya Pencairan ATSkolla",
        amount: s.withdraw_fee || 0,
        description: `Biaya pencairan ${s.settlement_code} → ${s.bank_name || "-"} ${s.account_number || ""}`.trim(),
        reference: s.settlement_code || null,
        method: "Auto",
        status: "Tercatat",
        source: "auto",
      }));
    setManual(manualRows);
    setAutoEntries([...autoInvoiceRows, ...autoFeeRows]);
    setSettlements((stl.data as any[]) || []);
    setLoading(false);
  }, [profile?.school_id]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Sekali di awal: kalau ada transaksi historis lebih lama dari default filter (awal bulan),
  // mundurkan otomatis "Dari Tanggal" ke transaksi paling lama supaya seluruh data lampau ikut terlihat.
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (autoExpandedRef.current) return;
    if (loading) return;
    const all = [...manual, ...autoEntries];
    if (all.length === 0) return;
    const earliest = all.reduce((min, e) => (e.entry_date < min ? e.entry_date : min), all[0].entry_date);
    if (earliest && earliest < dateFrom) {
      setDateFrom(earliest);
    }
    autoExpandedRef.current = true;
  }, [loading, manual, autoEntries, dateFrom]);

  // Realtime updates when new paid invoices come in
  useEffect(() => {
    if (!profile?.school_id) return;
    const ch = supabase
      .channel("bendahara-buku-kas")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_book_entries", filter: `school_id=eq.${profile.school_id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements", filter: `school_id=eq.${profile.school_id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.school_id, fetchData]);

  const combined = useMemo(() => [...manual, ...autoEntries], [manual, autoEntries]);
  const filtered = useMemo(() => {
    return combined.filter((e) => {
      if (dateFrom && e.entry_date < dateFrom) return false;
      if (dateTo && e.entry_date > dateTo) return false;
      if (fDir !== "all" && e.direction !== fDir) return false;
      if (fCat !== "all" && e.category !== fCat) return false;
      return true;
    }).sort((a, b) => (b.entry_date + b.id).localeCompare(a.entry_date + a.id));
  }, [combined, dateFrom, dateTo, fDir, fCat]);

  const totals = useMemo(() => {
    const inList = filtered.filter((e) => e.direction === "in");
    const outList = filtered.filter((e) => e.direction === "out");
    const kasMasuk = inList.reduce((s, e) => s + (e.amount || 0), 0);
    const kasKeluar = outList.reduce((s, e) => s + (e.amount || 0), 0);
    return { kasMasuk, kasKeluar, saldo: kasMasuk - kasKeluar, count: filtered.length, inCount: inList.length, outCount: outList.length };
  }, [filtered]);


  // Running balance oldest → newest for table display
  const withBalance = useMemo(() => {
    const arr = [...filtered].reverse();
    let bal = 0;
    const list = arr.map((e) => {
      bal += e.direction === "in" ? e.amount : -e.amount;
      return { ...e, balance: bal };
    });
    return list.reverse();
  }, [filtered]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    combined.forEach((e) => s.add(e.category));
    return Array.from(s);
  }, [combined]);

  const save = async () => {
    if (!profile?.school_id) return;
    if (!form.amount || form.amount <= 0) { toast.error("Nominal harus lebih dari 0"); return; }
    if (!form.category) { toast.error("Kategori wajib dipilih"); return; }
    setSaving(true);
    const { error } = await supabase.from("cash_book_entries").insert({
      school_id: profile.school_id,
      entry_date: form.entry_date || today,
      direction: form.direction || "in",
      category: form.category,
      amount: Number(form.amount) || 0,
      description: form.description?.toString().trim() || null,
      reference: form.reference?.toString().trim() || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Entri kas ditambahkan");
    setOpen(false);
    setForm({ entry_date: today, direction: "in", category: "Kas Manual", amount: 0, description: "", reference: "" });
    fetchData();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("cash_book_entries").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success("Entri dihapus"); setDeleting(null); fetchData(); }
  };

  const exportXlsx = async () => {
    if (filtered.length === 0) { toast.error("Tidak ada data untuk diexport"); return; }

    // Ambil identitas sekolah untuk header
    let school: { name?: string; address?: string; npsn?: string } = {};
    if (profile?.school_id) {
      const { data } = await supabase.from("schools").select("name, address, npsn").eq("id", profile.school_id).maybeSingle();
      if (data) school = data as any;
    }

    // Urutkan lama → baru (terbaru di bawah) + hitung running balance
    const ordered = [...filtered].sort((a, b) => (a.entry_date + a.id).localeCompare(b.entry_date + b.id));
    let bal = 0;
    const dataRows = ordered.map((e, i) => {
      bal += e.direction === "in" ? e.amount : -e.amount;
      return [
        i + 1,
        new Date(e.entry_date).toLocaleDateString("id-ID"),
        e.category,
        e.reference || "-",
        e.method || (e.source === "manual" ? "Tunai/Manual" : "-"),
        e.status || (e.source === "manual" ? "Tercatat" : "-"),
        e.description || "-",
        e.source === "auto" ? "Otomatis" : "Manual",
        e.direction === "in" ? e.amount : 0,
        e.direction === "out" ? e.amount : 0,
        bal,
      ];
    });

    const headers = ["No", "Tanggal", "Kategori", "No. Referensi/Invoice", "Metode Pembayaran", "Status", "Keterangan", "Sumber", "Kas Masuk (Bruto)", "Kas Keluar", "Saldo Berjalan"];
    const COLS = headers.length;
    const lastCol = String.fromCharCode(64 + COLS); // K

    const totalKasMasuk = dataRows.reduce((s, r) => s + (r[8] as number), 0);
    const totalKasKeluar = dataRows.reduce((s, r) => s + (r[9] as number), 0);
    const saldoAkhir = totalKasMasuk - totalKasKeluar;

    // Susun AoA: judul, sub-info, spacer, header, data, total
    const aoa: any[][] = [];
    aoa.push([`BUKU KAS — ${school.name || "Sekolah"}`]);
    aoa.push([`${school.address || ""}${school.npsn ? ` • NPSN ${school.npsn}` : ""}`.trim() || "—"]);
    aoa.push([`Periode: ${new Date(dateFrom).toLocaleDateString("id-ID")} s.d. ${new Date(dateTo).toLocaleDateString("id-ID")}`]);
    aoa.push([`Dicetak: ${new Date().toLocaleString("id-ID")}`]);
    aoa.push([]);
    const headerRowIdx = aoa.length; // 0-based
    aoa.push(headers);
    dataRows.forEach((r) => aoa.push(r));
    const totalRowIdx = aoa.length;
    aoa.push(["", "", "", "", "", "", "", "TOTAL", totalKasMasuk, totalKasKeluar, saldoAkhir]);

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
      { wch: 12 }, { wch: 42 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: COLS - 1 } },
    ];

    const border = { style: "thin", color: { rgb: "BFBFBF" } } as const;
    const allBorders = { top: border, bottom: border, left: border, right: border };

    // Title styling
    ws["A1"].s = { font: { bold: true, sz: 16, color: { rgb: "1F2A5B" } }, alignment: { horizontal: "center", vertical: "center" } };
    ws["A2"].s = { font: { sz: 10, color: { rgb: "555555" } }, alignment: { horizontal: "center" } };
    ws["A3"].s = { font: { sz: 10, color: { rgb: "555555" } }, alignment: { horizontal: "center" } };
    ws["A4"].s = { font: { italic: true, sz: 9, color: { rgb: "888888" } }, alignment: { horizontal: "center" } };

    // Header row
    for (let c = 0; c < COLS; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: headerRowIdx, c });
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { patternType: "solid", fgColor: { rgb: "5B6CF9" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: allBorders,
      };
    }

    // Data rows: zebra + borders + number formats
    for (let i = 0; i < dataRows.length; i++) {
      const rowIdx = headerRowIdx + 1 + i;
      const zebra = i % 2 === 0 ? "FFFFFF" : "F5F7FF";
      for (let c = 0; c < COLS; c++) {
        const addr = XLSXStyle.utils.encode_cell({ r: rowIdx, c });
        if (!ws[addr]) continue;
        const isCurrency = c >= 8; // kas masuk / keluar / saldo
        ws[addr].s = {
          font: { sz: 10, color: { rgb: c === 10 ? "1F2A5B" : "222222" }, bold: c === 10 },
          fill: { patternType: "solid", fgColor: { rgb: zebra } },
          alignment: { horizontal: c === 0 ? "center" : isCurrency ? "right" : "left", vertical: "center", wrapText: c === 6 },
          border: allBorders,
          ...(isCurrency ? { numFmt: '"Rp"#,##0;[Red]-"Rp"#,##0;"-"' } : {}),
        };
      }
    }

    // Total row styling
    for (let c = 0; c < COLS; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: totalRowIdx, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      const isCurrency = c >= 8;
      ws[addr].s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "1F2A5B" } },
        alignment: { horizontal: c === 7 ? "right" : isCurrency ? "right" : "center", vertical: "center" },
        border: allBorders,
        ...(isCurrency ? { numFmt: '"Rp"#,##0;[Red]-"Rp"#,##0;"-"' } : {}),
      };
    }

    // Freeze header + autofilter on table area
    ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 } as any;
    (ws as any)["!autofilter"] = { ref: `A${headerRowIdx + 1}:${lastCol}${totalRowIdx}` };
    ws["!rows"] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 16 }, { hpt: 14 }, { hpt: 8 }, { hpt: 26 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Buku Kas");
    XLSXStyle.writeFile(wb, `Buku_Kas_${dateFrom}_sd_${dateTo}.xlsx`);
    toast.success("Export selesai");
  };


  const currentCatOptions = form.direction === "out" ? OUT_CATEGORIES : IN_CATEGORIES;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <PageHeader
        icon={BookOpen}
        title="Buku Kas"
        subtitle="Kas masuk & keluar sekolah — otomatis terhubung dengan pembayaran online SPP."
        variant="primary"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportXlsx} className="bg-white/20 hover:bg-white/30 text-white border-white/20">
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border border-white/20">
              <Plus className="h-4 w-4 mr-1.5" /> Tambah Entri
            </Button>
          </div>
        }
      />

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">Kas Masuk</p>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold text-emerald-600 break-words leading-tight">{fmtIDR(totals.kasMasuk)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{totals.inCount} transaksi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">Kas Keluar</p>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold text-rose-600 break-words leading-tight">{fmtIDR(totals.kasKeluar)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{totals.outCount} transaksi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-[#5B6CF9]/10 to-transparent">
          <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-[#5B6CF9]/15 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-[#5B6CF9]" />
              </div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">Saldo Buku Kas</p>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold text-[#5B6CF9] break-words leading-tight">{fmtIDR(totals.saldo)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">pada rentang filter</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">Jumlah Transaksi</p>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold text-amber-600 break-words leading-tight">{totals.count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">total entri buku kas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Pencairan — audit trail dana keluar ATSkolla */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 flex items-center gap-2 border-b">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <Landmark className="h-4 w-4 text-rose-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Monitoring Pencairan</p>
              <p className="text-[11px] text-muted-foreground">Ringkasan pencairan dana ATSkolla ke rekening sekolah — biaya pencairan otomatis muncul sebagai Kas Keluar di tabel bawah.</p>
            </div>
            <Link to="/bendahara/withdraw?tab=pencairan" className="text-[11px] text-[#5B6CF9] hover:underline whitespace-nowrap inline-flex items-center gap-1">
              Kelola <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {settlements.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Belum ada pengajuan pencairan.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="[&_th]:whitespace-nowrap [&_th]:text-[11px]">
                    <TableHead>Kode</TableHead>
                    <TableHead>Tanggal Pencairan</TableHead>
                    <TableHead className="text-right">Nominal Dicairkan</TableHead>
                    <TableHead className="text-right">Biaya Pencairan</TableHead>
                    <TableHead className="text-right">Dana Bersih Diterima</TableHead>
                    <TableHead>Rekening</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.slice(0, 10).map((s) => {
                    const fee = s.withdraw_fee || 0;
                    const gross = s.total_gross || 0;
                    const net = s.final_payout || Math.max(0, gross - fee);
                    const tgl = s.paid_at || s.approved_at || s.requested_at;
                    const statusMap: Record<string, { label: string; cls: string }> = {
                      paid: { label: "Dicairkan", cls: "bg-emerald-500/15 text-emerald-700" },
                      approved: { label: "Disetujui", cls: "bg-sky-500/15 text-sky-700" },
                      pending: { label: "Menunggu", cls: "bg-amber-500/15 text-amber-700" },
                      rejected: { label: "Ditolak", cls: "bg-rose-500/15 text-rose-700" },
                    };
                    const st = statusMap[s.status] || { label: s.status || "-", cls: "bg-muted text-foreground" };
                    return (
                      <TableRow key={s.id} className="[&_td]:whitespace-nowrap [&_td]:text-xs">
                        <TableCell className="font-mono">{s.settlement_code}</TableCell>
                        <TableCell>{tgl ? new Date(tgl).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtIDR(gross)}</TableCell>
                        <TableCell className="text-right font-mono text-rose-600">{fmtIDR(fee)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-emerald-600">{fmtIDR(net)}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={`${s.bank_name || ""} ${s.account_number || ""} ${s.account_holder ? `a.n. ${s.account_holder}` : ""}`}>
                          {s.bank_name ? `${s.bank_name} • ${s.account_number || "-"}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 hover:${st.cls} ${st.cls}`}>{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>







      {/* Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Arah</Label>
            <Select value={fDir} onValueChange={setFDir}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="in">Kas Masuk</SelectItem>
                <SelectItem value="out">Kas Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Kategori</Label>
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Referensi / Invoice</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Masuk</TableHead>
                <TableHead className="text-right">Keluar</TableHead>
                <TableHead className="text-right">Saldo Berjalan</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : withBalance.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">Belum ada entri kas dalam rentang ini</TableCell></TableRow>
              ) : withBalance.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(e.entry_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="text-[10px] whitespace-nowrap"
                        title={e.category}
                      >
                        {e.category === "SPP Online" ? "SPP" : e.category}
                      </Badge>
                      {e.source === "auto" && (
                        <span
                          title="Otomatis dari pembayaran SPP"
                          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500/15 text-blue-700"
                        >
                          <Zap className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono max-w-[180px] truncate">
                    {e.reference || <span className="text-muted-foreground italic font-sans">—</span>}
                  </TableCell>
                  <TableCell>
                    {e.method
                      ? (() => {
                          const short =
                            e.method === "QRIS / Transfer Bank" ? "Online" :
                            e.method === "Transfer Manual ke Rekening" ? "Transfer Manual" :
                            e.method;
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal whitespace-nowrap"
                              title={e.method}
                            >
                              {short}
                            </Badge>
                          );
                        })()
                      : <span className="text-[11px] text-muted-foreground italic">{e.source === "manual" ? "Tunai/Manual" : "—"}</span>}
                  </TableCell>
                  <TableCell>
                    {e.status === "Lunas"
                      ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-0">Lunas</Badge>
                      : e.status
                        ? <Badge variant="secondary" className="text-[10px]">{e.status}</Badge>
                        : <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Tercatat</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="text-sm truncate">{e.description || <span className="text-muted-foreground italic">—</span>}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600">{e.direction === "in" ? fmtIDR(e.amount) : "-"}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-rose-600">{e.direction === "out" ? fmtIDR(e.amount) : "-"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{fmtIDR(e.balance)}</TableCell>
                  <TableCell className="text-right">
                    {e.source === "manual" && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(e)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Entry */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Entri Kas</DialogTitle>
            <DialogDescription>Catat kas masuk atau keluar manual. Pembayaran SPP online otomatis masuk tanpa perlu input.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" value={form.entry_date || today} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Arah</Label>
                <Select value={form.direction} onValueChange={(v: "in" | "out") => setForm({ ...form, direction: v, category: v === "out" ? OUT_CATEGORIES[0] : IN_CATEGORIES[0] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Kas Masuk</SelectItem>
                    <SelectItem value="out">Kas Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{currentCatOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nominal (Rp)</Label>
                <Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value || "0") })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Keterangan</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi transaksi..." />
            </div>
            <div>
              <Label className="text-xs">Referensi / No. Bukti (opsional)</Label>
              <Input value={form.reference || ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="No. kwitansi / nota..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus entri kas?</AlertDialogTitle>
            <AlertDialogDescription>Entri manual ini akan dihapus permanen dari buku kas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
