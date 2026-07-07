import { useEffect, useMemo, useState } from "react";
import { Landmark, ArrowDownToLine, FileText, Loader2, Receipt, TrendingUp, Banknote, CheckCircle2, XCircle, Clock, Download, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsRow, downloadCSV, type Header, type Row } from "./_common";
import { format } from "date-fns";
import { fmtIDR } from "../_shared";

/**
 * Sinkron dengan Bendahara → Pencairan (read-only untuk Kepsek).
 * 2 Tab:
 *  - Settlement : daftar pengajuan pencairan (semua status: pending/approved/paid/rejected)
 *  - Riwayat    : Riwayat Transaksi Lunas — daftar invoice SPP yang sudah dibayar
 * Card ringkasan & filter menyesuaikan tab yang aktif.
 * Filter tanggal bersifat opsional (pilihan kedua).
 */
export default function LaporanSettlement() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [settlements, setSettlements] = useState<any[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"settlement" | "riwayat">("settlement");

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [sRes, iRes] = await Promise.all([
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).order("requested_at", { ascending: false }),
        supabase.from("spp_invoices")
          .select("id, invoice_number, student_name, class_name, period_label, total_amount, gateway_fee, net_amount, payment_method, paid_at, settlement_id, status")
          .eq("school_id", schoolId).eq("status", "paid").order("paid_at", { ascending: false }),
      ]);
      setSettlements(sRes.data || []);
      setPaidInvoices(iRes.data || []);
      setLoading(false);
    })();
  }, [schoolId]);

  const inRange = (d?: string | null) => {
    if (!from && !to) return true;
    if (!d) return false;
    const ds = d.slice(0, 10);
    if (from && ds < from) return false;
    if (to && ds > to) return false;
    return true;
  };

  const filteredSettlements = useMemo(() => settlements.filter((s) => inRange(s.requested_at)), [settlements, from, to]);
  const filteredPaid = useMemo(() => paidInvoices.filter((i) => inRange(i.paid_at)), [paidInvoices, from, to]);

  // ---- Summary Settlement tab ----
  const settlementSummary = useMemo(() => {
    const s = filteredSettlements;
    return {
      total: s.length,
      pending: s.filter((x) => x.status === "pending").length,
      approved: s.filter((x) => x.status === "approved").length,
      paid: s.filter((x) => x.status === "paid").length,
      rejected: s.filter((x) => x.status === "rejected").length,
      pendingPayout: s.filter((x) => ["pending", "approved"].includes(x.status)).reduce((a, x) => a + (x.final_payout || x.total_net || 0), 0),
      totalPaid: s.filter((x) => x.status === "paid").reduce((a, x) => a + (x.final_payout || 0), 0),
    };
  }, [filteredSettlements]);

  // ---- Summary Riwayat (Transaksi Lunas) tab ----
  const isOffline = (m?: string | null) => {
    const v = (m || "").toLowerCase();
    return v === "offline_cash" || v === "offline_transfer";
  };
  const paidSummary = useMemo(() => {
    const arr = filteredPaid;
    const online = arr.filter((i) => !isOffline(i.payment_method));
    const offline = arr.filter((i) => isOffline(i.payment_method));
    const settled = online.filter((i) => !!i.settlement_id);
    const unsettled = online.filter((i) => !i.settlement_id);
    return {
      total: arr.length,
      totalGross: arr.reduce((a, x) => a + (x.total_amount || 0), 0),
      onlineGross: online.reduce((a, x) => a + (x.total_amount || 0), 0),
      offlineCount: offline.length,
      offlineGross: offline.reduce((a, x) => a + (x.total_amount || 0), 0),
      settledCount: settled.length,
      settledGross: settled.reduce((a, x) => a + (x.total_amount || 0), 0),
      unsettledCount: unsettled.length,
      unsettledGross: unsettled.reduce((a, x) => a + (x.total_amount || 0), 0),
    };
  }, [filteredPaid]);

  const badge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-500 hover:bg-amber-500",
      approved: "bg-blue-500 hover:bg-blue-500",
      paid: "bg-emerald-500 hover:bg-emerald-500",
      rejected: "bg-red-500 hover:bg-red-500",
    };
    return <Badge className={`${map[s] || "bg-slate-500"} text-white text-[10px]`}>{s.toUpperCase()}</Badge>;
  };

  // ---- CSV exports per tab ----
  const settlementRows = (list: any[]): Row[] => list.map((s) => ({
    Kode: s.settlement_code,
    Diminta: s.requested_at ? format(new Date(s.requested_at), "dd/MM/yy HH:mm") : "-",
    Disetujui: s.approved_at ? format(new Date(s.approved_at), "dd/MM/yy HH:mm") : "-",
    Dicairkan: s.paid_at ? format(new Date(s.paid_at), "dd/MM/yy HH:mm") : "-",
    Status: s.status,
    Transaksi: s.total_transactions,
    Bruto: s.total_gross,
    "Biaya Pencairan": s.withdraw_fee ?? 3000,
    Final: s.final_payout,
    Bank: s.bank_name || "-",
    "No Rekening": s.account_number || "-",
    Penerima: s.account_holder || "-",
  }));
  const settlementCsv: Header[] = [
    { key: "Kode", label: "Kode" }, { key: "Diminta", label: "Diminta" }, { key: "Disetujui", label: "Disetujui" }, { key: "Dicairkan", label: "Dicairkan" },
    { key: "Status", label: "Status" }, { key: "Transaksi", label: "Transaksi" },
    { key: "Bruto", label: "Bruto", type: "money" }, { key: "Biaya Pencairan", label: "Biaya Pencairan", type: "money" }, { key: "Final", label: "Final", type: "money" },
    { key: "Bank", label: "Bank" }, { key: "No Rekening", label: "No Rekening" }, { key: "Penerima", label: "Penerima" },
  ];

  const paidRows = (list: any[]): Row[] => list.map((i) => ({
    Invoice: i.invoice_number,
    Tanggal: i.paid_at ? format(new Date(i.paid_at), "dd/MM/yy HH:mm") : "-",
    Siswa: i.student_name,
    Kelas: i.class_name,
    Periode: i.period_label,
    Metode: isOffline(i.payment_method) ? "Offline" : "Online",
    Bruto: i.total_amount || 0,
    "Biaya Gateway": i.gateway_fee || 0,
    Net: i.net_amount || 0,
    "Status Cair": i.settlement_id ? "Sudah Cair" : (isOffline(i.payment_method) ? "-" : "Belum Cair"),
  }));
  const paidCsv: Header[] = [
    { key: "Invoice", label: "Invoice" }, { key: "Tanggal", label: "Tanggal" },
    { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" }, { key: "Periode", label: "Periode" },
    { key: "Metode", label: "Metode" },
    { key: "Bruto", label: "Bruto", type: "money" }, { key: "Biaya Gateway", label: "Biaya Gateway", type: "money" }, { key: "Net", label: "Net", type: "money" },
    { key: "Status Cair", label: "Status Cair" },
  ];

  const handleExport = () => {
    if (tab === "settlement") {
      downloadCSV(`Settlement_${from || "semua"}_${to || "semua"}`, settlementRows(filteredSettlements), settlementCsv);
    } else {
      downloadCSV(`Transaksi_Lunas_${from || "semua"}_${to || "semua"}`, paidRows(filteredPaid), paidCsv);
    }
  };

  const clearDates = () => { setFrom(""); setTo(""); };

  const renderSettlementTable = () => (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="[&_th]:whitespace-nowrap">
              <TableHead>Code</TableHead>
              <TableHead>Tgl</TableHead>
              <TableHead>Trx</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Biaya Pencairan</TableHead>
              <TableHead>Final</TableHead>
              <TableHead>Bank / Penerima</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredSettlements.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">Belum ada pengajuan settlement</TableCell></TableRow>
            ) : filteredSettlements.map((s) => {
              const withdrawFee = s.withdraw_fee ?? 3000;
              const finalPayout = s.final_payout ?? Math.max(0, (s.total_gross || 0) - withdrawFee);
              return (
                <TableRow key={s.id} className="[&_td]:whitespace-nowrap hover:bg-muted/40">
                  <TableCell className="text-xs font-mono">{s.settlement_code}</TableCell>
                  <TableCell className="text-xs">{s.requested_at ? new Date(s.requested_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                  <TableCell>{s.total_transactions ?? 0}</TableCell>
                  <TableCell className="text-xs">{fmtIDR(s.total_gross || 0)}</TableCell>
                  <TableCell className="text-xs text-rose-600">{fmtIDR(withdrawFee)}</TableCell>
                  <TableCell className="font-semibold text-emerald-600">{fmtIDR(finalPayout)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{s.bank_name || "-"}</div>
                    <div className="text-muted-foreground">{s.account_holder || "-"}</div>
                  </TableCell>
                  <TableCell>{badge(s.status)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  const renderPaidTable = () => (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="[&_th]:whitespace-nowrap">
              <TableHead>Tanggal</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Siswa</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status Cair</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredPaid.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">Belum ada transaksi lunas</TableCell></TableRow>
            ) : filteredPaid.map((i) => {
              const offline = isOffline(i.payment_method);
              return (
                <TableRow key={i.id} className="[&_td]:whitespace-nowrap hover:bg-muted/40">
                  <TableCell className="text-xs">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                  <TableCell className="text-xs font-mono">{i.invoice_number}</TableCell>
                  <TableCell className="text-sm font-medium">{i.student_name}</TableCell>
                  <TableCell className="text-xs">{i.class_name}</TableCell>
                  <TableCell className="text-xs">{i.period_label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{offline ? "Offline" : "Online"}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmtIDR(i.total_amount || 0)}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmtIDR(i.net_amount || 0)}</TableCell>
                  <TableCell>
                    {offline ? (
                      <Badge variant="outline" className="text-[10px]">Kas Manual</Badge>
                    ) : i.settlement_id ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px]">Sudah Cair</Badge>
                    ) : (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Belum Cair</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rekap Settlement"
        subtitle="Pantau pengajuan aktif dan riwayat pencairan"
        icon={Landmark}
        variant="primary"
        actions={
          <Button size="sm" onClick={handleExport} className="bg-white/20 hover:bg-white/30 text-white border border-white/20">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-fit gap-1 bg-indigo-50 dark:bg-indigo-950/40 p-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
          <TabsTrigger
            value="settlement"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <ArrowDownToLine className="h-4 w-4" /> Settlement
          </TabsTrigger>
          <TabsTrigger
            value="riwayat"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <FileText className="h-4 w-4" /> Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settlement" className="space-y-4 mt-4">
          <StatsRow items={[
            { label: "Total Pengajuan", value: settlementSummary.total, tone: "primary", icon: Receipt },
            { label: "Pending", value: settlementSummary.pending, tone: "amber", icon: Clock },
            { label: "Disetujui", value: settlementSummary.approved, tone: "indigo", icon: CheckCircle2 },
            { label: "Dicairkan", value: settlementSummary.paid, tone: "emerald", icon: Banknote },
            { label: "Ditolak", value: settlementSummary.rejected, tone: "rose", icon: XCircle },
            { label: "Menunggu Pencairan", value: fmtIDR(settlementSummary.pendingPayout), tone: "amber" },
            { label: "Sudah Cair", value: fmtIDR(settlementSummary.totalPaid), tone: "emerald" },
          ]} />

          {/* Filter tanggal — opsional (pilihan kedua) */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div>
                <Label className="text-[10px] text-muted-foreground">Dari Tanggal (opsional)</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Sampai Tanggal (opsional)</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              </div>
              {(from || to) && (
                <div className="col-span-2 md:col-span-4 flex items-center justify-between text-[11px] text-muted-foreground -mt-1">
                  <span>Filter tanggal aktif — hanya menampilkan sebagian data.</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearDates}>Tampilkan Semua Tanggal</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {renderSettlementTable()}
        </TabsContent>

        <TabsContent value="riwayat" className="space-y-4 mt-4">
          <StatsRow items={[
            { label: "Transaksi Lunas", value: paidSummary.total, tone: "primary", icon: Receipt },
            { label: "Total Bruto", value: fmtIDR(paidSummary.totalGross), tone: "indigo", icon: TrendingUp },
            { label: "Sudah Cair", value: `${paidSummary.settledCount} · ${fmtIDR(paidSummary.settledGross)}`, tone: "emerald", icon: CheckCircle2 },
            { label: "Belum Cair (Online)", value: `${paidSummary.unsettledCount} · ${fmtIDR(paidSummary.unsettledGross)}`, tone: "amber", icon: Clock },
            { label: "Kas Manual (Offline)", value: `${paidSummary.offlineCount} · ${fmtIDR(paidSummary.offlineGross)}`, tone: "sky", icon: Wallet },
          ]} />

          {/* Filter tanggal — opsional (pilihan kedua) */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div>
                <Label className="text-[10px] text-muted-foreground">Dari Tanggal (opsional)</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Sampai Tanggal (opsional)</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              </div>
              {(from || to) && (
                <div className="col-span-2 md:col-span-4 flex items-center justify-between text-[11px] text-muted-foreground -mt-1">
                  <span>Filter tanggal aktif — hanya menampilkan sebagian data.</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearDates}>Tampilkan Semua Tanggal</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {renderPaidTable()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
