import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as XLSX from "xlsx";
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
    const [m, inv] = await Promise.all([
      supabase.from("cash_book_entries").select("*").eq("school_id", profile.school_id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("spp_invoices").select("id, invoice_number, student_name, class_name, period_label, total_amount, net_amount, paid_at, payment_method, status").eq("school_id", profile.school_id).eq("status", "paid").not("paid_at", "is", null).order("paid_at", { ascending: false }),
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
    const autoRows: Entry[] = ((inv.data as any[]) || []).map((i) => ({
      id: `auto-${i.id}`,
      entry_date: (i.paid_at || "").slice(0, 10),
      direction: "in",
      category: "SPP Online",
      // GROSS: nilai pembayaran asli sesuai tagihan siswa (bukan net_amount setelah MDR).
      // Selisih MDR/biaya gateway dikelola di modul Monitoring Pencairan (Settlement).
      amount: i.total_amount ?? i.net_amount ?? 0,
      description: `SPP ${i.student_name} • ${i.class_name} • ${i.period_label}`,
      reference: i.invoice_number || null,
      method: formatPaymentMethodLabel(i.payment_method),
      status: "Lunas",
      source: "auto",
    }));
    setManual(manualRows);
    setAutoEntries(autoRows);
    setLoading(false);
  }, [profile?.school_id]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime updates when new paid invoices come in
  useEffect(() => {
    if (!profile?.school_id) return;
    const ch = supabase
      .channel("bendahara-buku-kas")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_book_entries", filter: `school_id=eq.${profile.school_id}` }, () => fetchData())
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

  const exportXlsx = () => {
    if (filtered.length === 0) { toast.error("Tidak ada data untuk diexport"); return; }
    const rows = withBalance.map((e, i) => ({
      "No": withBalance.length - i,
      "Tanggal": new Date(e.entry_date).toLocaleDateString("id-ID"),
      "Kategori": e.category,
      "No. Referensi/Invoice": e.reference || "",
      "Metode Pembayaran": e.method || (e.source === "manual" ? "Tunai/Manual" : "-"),
      "Status": e.status || (e.source === "manual" ? "Tercatat" : "-"),
      "Keterangan": e.description || "",
      "Sumber": e.source === "auto" ? "Otomatis" : "Manual",
      "Kas Masuk (Bruto)": e.direction === "in" ? e.amount : 0,
      "Kas Keluar": e.direction === "out" ? e.amount : 0,
      "Saldo Berjalan": e.balance,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Buku Kas");
    XLSX.writeFile(wb, `Buku_Kas_${dateFrom}_sd_${dateTo}.xlsx`);
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
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Kas Masuk</p>
              <p className="text-lg font-extrabold text-emerald-600 truncate">{fmtIDR(totals.kasMasuk)}</p>
              <p className="text-[10px] text-muted-foreground">{totals.inCount} transaksi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Kas Keluar</p>
              <p className="text-lg font-extrabold text-rose-600 truncate">{fmtIDR(totals.kasKeluar)}</p>
              <p className="text-[10px] text-muted-foreground">{totals.outCount} transaksi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-[#5B6CF9]/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#5B6CF9]/15 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-[#5B6CF9]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo Buku Kas</p>
              <p className="text-lg font-extrabold text-[#5B6CF9] truncate">{fmtIDR(totals.saldo)}</p>
              <p className="text-[10px] text-muted-foreground">pada rentang filter</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Jumlah Transaksi</p>
              <p className="text-lg font-extrabold text-amber-600 truncate">{totals.count}</p>
              <p className="text-[10px] text-muted-foreground">total entri buku kas</p>
            </div>
          </CardContent>
        </Card>
      </div>




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
                      <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                      {e.source === "auto" && <Badge className="text-[9px] bg-blue-500/15 text-blue-700 hover:bg-blue-500/15 border-0"><Zap className="h-2.5 w-2.5 mr-0.5" />Auto</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono max-w-[180px] truncate">
                    {e.reference || <span className="text-muted-foreground italic font-sans">—</span>}
                  </TableCell>
                  <TableCell>
                    {e.method
                      ? <Badge variant="outline" className="text-[10px] font-normal">{e.method}</Badge>
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
