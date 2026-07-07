import { useEffect, useMemo, useState } from "react";
import { Receipt, Wallet, TrendingUp, ArrowDownToLine, Loader2, AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, downloadCSV, type Header, type Row } from "./_common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtIDR } from "../_shared";

/**
 * Rekap Pembayaran SPP — tampilan disamakan 1:1 dengan Bendahara → Saldo & Riwayat:
 *  - Big card "Saldo Aktif (Siap Dicairkan)" gradient primary + banner info offline
 *  - 3 StatCards gradient: Total Bruto SPP · Sudah Dicairkan · Pending Pencairan
 *  - Tabel "Riwayat Transaksi Lunas" (Tanggal · Deskripsi · Nominal · Status Cair)
 *  - Filter tanggal opsional (pilihan kedua)
 *
 * Hanya READ — kepsek tidak menjalankan sinkronisasi Mayar & tidak realtime edit.
 */
function StatCard({ label, value, icon: Icon, gradient, sub }: {
  label: string; value: string; sub?: string; icon: any; gradient: string;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xl font-extrabold mt-1 truncate">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LaporanSPP() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      let qInv = supabase.from("spp_invoices")
        .select("id, invoice_number, student_name, class_name, period_label, total_amount, gateway_fee, net_amount, status, paid_at, payment_method, description, settlement_id")
        .eq("school_id", schoolId)
        .eq("status", "paid")
        .not("payment_method", "in", "(offline_cash,offline_transfer)")
        .not("paid_at", "is", null);
      if (from) qInv = qInv.gte("paid_at", from);
      if (to)   qInv = qInv.lte("paid_at", to + "T23:59:59");

      const [invRes, stlRes] = await Promise.all([
        qInv.order("paid_at", { ascending: false }),
        supabase.from("spp_settlements").select("status, total_amount, total_net, withdraw_fee").eq("school_id", schoolId),
      ]);
      setItems(invRes.data || []);
      setSettlements(stlRes.data || []);
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const totals = useMemo(() => items.reduce((acc, i) => ({
    gross: acc.gross + (i.total_amount || 0),
    net: acc.net + (i.net_amount || 0),
  }), { gross: 0, net: 0 }), [items]);

  const activeItems = useMemo(() => items.filter((i) => !i.settlement_id), [items]);
  const settledItems = useMemo(() => items.filter((i) => !!i.settlement_id), [items]);
  const activeBalance = activeItems.reduce((s, x) => s + (x.total_amount || 0), 0);
  const settledGross = settledItems.reduce((s, x) => s + (x.total_amount || 0), 0);
  const lockedGross = Math.max(0, totals.gross - activeBalance);
  const pendingPayout = settlements
    .filter((s) => ["pending", "approved"].includes(s.status))
    .reduce((s, x) => s + (x.total_amount || x.total_net || 0), 0);

  const [showInfo, setShowInfo] = useState(() => {
    try {
      const ts = Number(localStorage.getItem("kepsek_saldo_info_dismissed_at") || 0);
      if (!ts) return true;
      return Date.now() - ts > 7 * 24 * 60 * 60 * 1000;
    } catch { return true; }
  });
  const dismissInfo = () => {
    try { localStorage.setItem("kepsek_saldo_info_dismissed_at", String(Date.now())); } catch {}
    setShowInfo(false);
  };

  const csvHeaders: Header[] = [
    { key: "Tanggal", label: "Tanggal" },
    { key: "Deskripsi", label: "Deskripsi" },
    { key: "Invoice", label: "Invoice" },
    { key: "Nominal", label: "Nominal", type: "money" },
    { key: "Status Cair", label: "Status Cair" },
  ];
  const csvRows: Row[] = items.map((i) => ({
    Tanggal: i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-",
    Deskripsi: i.description || `${i.student_name || "-"} • ${i.class_name || "-"} • ${i.period_label || "-"}`,
    Invoice: i.invoice_number,
    Nominal: i.total_amount || 0,
    "Status Cair": i.settlement_id ? "DICAIRKAN" : "SALDO AKTIF",
  }));

  return (
    <ReportShell
      title="Rekap Pembayaran SPP"
      subtitle="Sinkron dengan Bendahara — Saldo Aktif, Sudah Dicairkan & Pending Pencairan"
      icon={Receipt}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      datesOptional
      onDownload={() => downloadCSV(`Rekap_SPP_${(from || to) ? `${from || "awal"}_${to || "sekarang"}` : "semua"}`, csvRows, csvHeaders)}
      summary={
        <div className="space-y-4">
          {/* Saldo Aktif - Highlight Card */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-[#5B6CF9] via-[#4c5ded] to-[#3D4FE0] text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4" />
                <p className="text-xs font-medium opacity-90">Saldo Aktif (Siap Dicairkan)</p>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" /> LIVE
                </span>
              </div>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">{fmtIDR(activeBalance)}</p>
              <p className="text-[11px] opacity-80 mt-1">
                Total Bruto {fmtIDR(totals.gross)} − Sudah/akan dicairkan {fmtIDR(lockedGross)}
              </p>
            </CardContent>
          </Card>

          {showInfo && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed flex-1">
                <b>Saldo Aktif</b> hanya berisi pembayaran <b>online (QRIS / Transfer Bank)</b> yang belum diajukan pencairan.
                Pembayaran <b>offline</b> (tunai / transfer manual ke rekening sekolah) <b>tidak masuk</b> ke saldo pencairan
                karena uangnya sudah diterima sekolah secara langsung.
              </div>
              <button onClick={dismissInfo} className="shrink-0 text-blue-600 hover:text-blue-800 p-0.5 rounded" aria-label="Tutup info">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Total Bruto SPP" value={fmtIDR(totals.gross)} sub={`${items.length} transaksi`} icon={TrendingUp} gradient="from-blue-500 to-indigo-600" />
            <StatCard label="Sudah Dicairkan" value={fmtIDR(settledGross)} sub={`${settledItems.length} transaksi`} icon={ArrowDownToLine} gradient="from-violet-500 to-purple-600" />
            <StatCard label="Pending Pencairan" value={fmtIDR(pendingPayout)} sub="menunggu admin" icon={Loader2} gradient="from-amber-500 to-orange-600" />
          </div>
        </div>
      }
    >
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riwayat Transaksi Lunas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                    <TableHead className="whitespace-nowrap">Deskripsi</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Nominal</TableHead>
                    <TableHead className="whitespace-nowrap">Status Cair</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada transaksi paid</TableCell></TableRow>
                  )}
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs whitespace-nowrap">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {i.description || `${i.student_name || "-"} • ${i.class_name || "-"} • ${i.period_label || "-"}`}
                      </TableCell>
                      <TableCell className="text-sm text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtIDR(i.total_amount)}</TableCell>
                      <TableCell>
                        {i.settlement_id
                          ? <Badge className="bg-emerald-500 text-[10px] whitespace-nowrap">DICAIRKAN</Badge>
                          : <Badge className="bg-amber-500 text-[10px] whitespace-nowrap">SALDO AKTIF</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </ReportShell>
  );
}
