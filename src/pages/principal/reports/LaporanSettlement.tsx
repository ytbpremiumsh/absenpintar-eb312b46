import { useEffect, useMemo, useState } from "react";
import { Landmark, ArrowDownToLine, FileText, Loader2, Receipt, TrendingUp, Banknote, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV, type Header, type Row } from "./_common";
import { format } from "date-fns";
import { fmtIDR } from "../_shared";

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

/**
 * Rekap Settlement — read-only untuk Kepsek.
 * 2 Tab:
 *  - Riwayat    : Riwayat Transaksi Lunas (invoice SPP paid)
 *  - Settlement : Daftar pengajuan pencairan
 * Tanpa filter tanggal & tanpa fee gateway (ATSkolla tidak memotong biaya gateway).
 */
export default function LaporanSettlement() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [settlements, setSettlements] = useState<any[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"settlement" | "riwayat">("riwayat");

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [sRes, iRes] = await Promise.all([
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).order("requested_at", { ascending: false }),
        supabase.from("spp_invoices")
          .select("id, invoice_number, student_name, class_name, period_label, total_amount, payment_method, paid_at, settlement_id, status")
          .eq("school_id", schoolId).eq("status", "paid").order("paid_at", { ascending: false }),
      ]);
      setSettlements(sRes.data || []);
      setPaidInvoices(iRes.data || []);
      setLoading(false);
    })();
  }, [schoolId]);

  const isOffline = (m?: string | null) => {
    const v = (m || "").toLowerCase();
    return v === "offline_cash" || v === "offline_transfer";
  };

  const paidSummary = useMemo(() => {
    const arr = paidInvoices;
    const online = arr.filter((i) => !isOffline(i.payment_method));
    const settled = online.filter((i) => !!i.settlement_id);
    const unsettled = online.filter((i) => !i.settlement_id);
    return {
      total: arr.length,
      totalGross: arr.reduce((a, x) => a + (x.total_amount || 0), 0),
      settledCount: settled.length,
      settledGross: settled.reduce((a, x) => a + (x.total_amount || 0), 0),
      unsettledCount: unsettled.length,
      unsettledGross: unsettled.reduce((a, x) => a + (x.total_amount || 0), 0),
    };
  }, [paidInvoices]);

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
    Nominal: s.total_gross,
    "Biaya Pencairan": s.withdraw_fee ?? 3000,
    Final: s.final_payout,
    Bank: s.bank_name || "-",
    "No Rekening": s.account_number || "-",
    Penerima: s.account_holder || "-",
  }));
  const settlementCsv: Header[] = [
    { key: "Kode", label: "Kode" }, { key: "Diminta", label: "Diminta" }, { key: "Disetujui", label: "Disetujui" }, { key: "Dicairkan", label: "Dicairkan" },
    { key: "Status", label: "Status" }, { key: "Transaksi", label: "Transaksi" },
    { key: "Nominal", label: "Nominal", type: "money" }, { key: "Biaya Pencairan", label: "Biaya Pencairan", type: "money" }, { key: "Final", label: "Final", type: "money" },
    { key: "Bank", label: "Bank" }, { key: "No Rekening", label: "No Rekening" }, { key: "Penerima", label: "Penerima" },
  ];

  const paidRows = (list: any[]): Row[] => list.map((i) => ({
    Invoice: i.invoice_number,
    Tanggal: i.paid_at ? format(new Date(i.paid_at), "dd/MM/yy HH:mm") : "-",
    Siswa: i.student_name,
    Kelas: i.class_name,
    Periode: i.period_label,
    Metode: isOffline(i.payment_method) ? "Offline" : "Online",
    Nominal: i.total_amount || 0,
    "Status Cair": i.settlement_id ? "Sudah Cair" : (isOffline(i.payment_method) ? "-" : "Belum Cair"),
  }));
  const paidCsv: Header[] = [
    { key: "Invoice", label: "Invoice" }, { key: "Tanggal", label: "Tanggal" },
    { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" }, { key: "Periode", label: "Periode" },
    { key: "Metode", label: "Metode" },
    { key: "Nominal", label: "Nominal", type: "money" },
    { key: "Status Cair", label: "Status Cair" },
  ];

  const handleExport = () => {
    if (tab === "settlement") {
      downloadCSV(`Settlement_semua`, settlementRows(settlements), settlementCsv);
    } else {
      downloadCSV(`Transaksi_Lunas_semua`, paidRows(paidInvoices), paidCsv);
    }
  };

  const renderSettlementTable = () => (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="[&_th]:whitespace-nowrap">
              <TableHead>Code</TableHead>
              <TableHead>Tgl</TableHead>
              <TableHead>Trx</TableHead>
              <TableHead>Nominal</TableHead>
              <TableHead>Biaya Pencairan</TableHead>
              <TableHead>Final</TableHead>
              <TableHead>Bank / Penerima</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : settlements.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">Belum ada pengajuan settlement</TableCell></TableRow>
            ) : settlements.map((s) => {
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
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status Cair</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : paidInvoices.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">Belum ada transaksi lunas</TableCell></TableRow>
            ) : paidInvoices.map((i) => {
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
            value="riwayat"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <FileText className="h-4 w-4" /> Riwayat
          </TabsTrigger>
          <TabsTrigger
            value="settlement"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <ArrowDownToLine className="h-4 w-4" /> Settlement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settlement" className="space-y-4 mt-4">
          {(() => {
            const active = settlements.filter((s) => ["pending", "approved"].includes(s.status));
            const nominal = active.reduce((a, x) => a + (x.total_gross || 0), 0);
            const finalPayout = active.reduce((a, x) => a + (x.final_payout ?? Math.max(0, (x.total_gross || 0) - (x.withdraw_fee ?? 3000))), 0);
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard label="Transaksi Siap Cair" value={String(active.length)} icon={Receipt} gradient="from-violet-500 to-purple-600" />
                <StatCard label="Total Nominal" value={fmtIDR(nominal)} icon={TrendingUp} gradient="from-blue-500 to-indigo-600" />
                <StatCard label="Final Payout" value={fmtIDR(finalPayout)} icon={Banknote} sub="setelah biaya pencairan Rp 3.000" gradient="from-amber-500 to-orange-600" />
              </div>
            );
          })()}

          {renderSettlementTable()}
        </TabsContent>

        <TabsContent value="riwayat" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Total Nominal SPP" value={fmtIDR(paidSummary.totalGross)} sub={`${paidSummary.total} transaksi`} icon={TrendingUp} gradient="from-blue-500 to-indigo-600" />
            <StatCard label="Sudah Dicairkan" value={fmtIDR(paidSummary.settledGross)} sub={`${paidSummary.settledCount} transaksi`} icon={ArrowDownToLine} gradient="from-violet-500 to-purple-600" />
            <StatCard label="Pending Pencairan" value={fmtIDR(paidSummary.unsettledGross)} sub={`${paidSummary.unsettledCount} transaksi`} icon={Loader2} gradient="from-amber-500 to-orange-600" />
          </div>

          {renderPaidTable()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
