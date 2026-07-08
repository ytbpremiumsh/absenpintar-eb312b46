import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wallet, Banknote, Receipt, Settings2, School as SchoolIcon, Search,
  CheckCircle2, Clock, XCircle, Loader2, Eye, RefreshCcw, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

type SchoolRow = { id: string; name: string; npsn: string | null; bendahara_wa_enabled?: boolean; bendahara_offline_enabled?: boolean };
type Invoice = {
  id: string; school_id: string; invoice_number: string; student_name: string;
  class_name: string; period_label: string; total_amount: number; net_amount: number;
  gateway_fee: number; status: string; payment_method: string | null;
  paid_at: string | null; settlement_id: string | null; created_at: string;
};
type Settlement = {
  id: string; school_id: string; settlement_code: string; total_transactions: number;
  total_gross: number; total_net: number; total_gateway_fee: number; withdraw_fee: number;
  final_payout: number; bank_name: string | null; account_number: string | null;
  account_holder: string | null; status: string; admin_notes: string | null;
  requested_at: string; approved_at: string | null; paid_at: string | null;
};
type BendaharaSetting = {
  id: string; school_id: string; environment: string; use_platform_key: boolean;
  api_key: string | null; webhook_url: string | null; last_test_status: string | null;
  last_tested_at: string | null; updated_at: string;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    paid: { cls: "bg-emerald-500 text-white", icon: CheckCircle2, label: "Lunas" },
    pending: { cls: "bg-amber-500 text-white", icon: Clock, label: "Pending" },
    unpaid: { cls: "bg-amber-500 text-white", icon: Clock, label: "Belum Bayar" },
    expired: { cls: "bg-rose-500 text-white", icon: XCircle, label: "Kadaluarsa" },
    requested: { cls: "bg-sky-500 text-white", icon: Clock, label: "Diajukan" },
    approved: { cls: "bg-indigo-500 text-white", icon: CheckCircle2, label: "Disetujui" },
    processing: { cls: "bg-sky-500 text-white", icon: Loader2, label: "Diproses" },
    rejected: { cls: "bg-rose-500 text-white", icon: XCircle, label: "Ditolak" },
    failed: { cls: "bg-rose-500 text-white", icon: XCircle, label: "Gagal" },
    success: { cls: "bg-emerald-500 text-white", icon: CheckCircle2, label: "Sukses" },
  };
  const m = map[status?.toLowerCase()] || { cls: "bg-slate-400 text-white", icon: AlertCircle, label: status || "—" };
  const Icon = m.icon;
  return (
    <Badge className={`${m.cls} border-0 gap-1 font-semibold text-[11px]`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
};

export default function SuperAdminBendahara() {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settings, setSettings] = useState<BendaharaSetting[]>([]);
  const [search, setSearch] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Settlement | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sR, iR, stR, bR] = await Promise.all([
        supabase.from("schools").select("id,name,npsn,bendahara_wa_enabled,bendahara_offline_enabled").order("name"),
        supabase.from("spp_invoices")
          .select("id,school_id,invoice_number,student_name,class_name,period_label,total_amount,net_amount,gateway_fee,status,payment_method,paid_at,settlement_id,created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("spp_settlements")
          .select("*").order("requested_at", { ascending: false }),
        supabase.from("bendahara_settings").select("*"),
      ]);
      setSchools(sR.data || []);
      setInvoices((iR.data || []) as Invoice[]);
      setSettlements((stR.data || []) as Settlement[]);
      setSettings((bR.data || []) as BendaharaSetting[]);
    } catch (e: any) {
      toast.error("Gagal memuat data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const schoolMap = useMemo(() => {
    const m: Record<string, SchoolRow> = {};
    schools.forEach((s) => (m[s.id] = s));
    return m;
  }, [schools]);

  // Compute saldo per school: sum(net_amount) of paid invoices not yet linked to a paid settlement
  const balances = useMemo(() => {
    const map: Record<string, {
      school_id: string; total_paid_invoices: number; total_gross: number;
      total_net: number; total_gateway_fee: number; saldo_pending: number;
      total_disbursed: number; pending_settlement: number;
    }> = {};
    for (const s of schools) {
      map[s.id] = {
        school_id: s.id, total_paid_invoices: 0, total_gross: 0, total_net: 0,
        total_gateway_fee: 0, saldo_pending: 0, total_disbursed: 0, pending_settlement: 0,
      };
    }
    for (const inv of invoices) {
      if (inv.status !== "paid") continue;
      const m = map[inv.school_id]; if (!m) continue;
      m.total_paid_invoices += 1;
      m.total_gross += inv.total_amount || 0;
      m.total_net += inv.net_amount || 0;
      m.total_gateway_fee += inv.gateway_fee || 0;
      if (!inv.settlement_id) m.saldo_pending += inv.net_amount || 0;
    }
    for (const st of settlements) {
      const m = map[st.school_id]; if (!m) continue;
      if (st.status === "paid") m.total_disbursed += st.final_payout || 0;
      else if (["requested", "approved", "processing"].includes(st.status))
        m.pending_settlement += st.final_payout || 0;
    }
    return Object.values(map);
  }, [schools, invoices, settlements]);

  const filteredBalances = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return balances;
    return balances.filter((b) => {
      const s = schoolMap[b.school_id];
      return s?.name?.toLowerCase().includes(q) || s?.npsn?.toLowerCase().includes(q);
    });
  }, [balances, schoolMap, search]);

  const filteredSettlements = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return settlements;
    return settlements.filter((s) =>
      schoolMap[s.school_id]?.name?.toLowerCase().includes(q) ||
      s.settlement_code?.toLowerCase().includes(q)
    );
  }, [settlements, schoolMap, search]);

  const filteredPaidInvoices = useMemo(() => {
    const q = search.toLowerCase().trim();
    const paid = invoices.filter((i) => i.status === "paid");
    if (!q) return paid;
    return paid.filter((i) =>
      i.student_name?.toLowerCase().includes(q) ||
      i.invoice_number?.toLowerCase().includes(q) ||
      i.class_name?.toLowerCase().includes(q) ||
      schoolMap[i.school_id]?.name?.toLowerCase().includes(q)
    );
  }, [invoices, schoolMap, search]);

  const filteredSettings = useMemo(() => {
    const bySchool: Record<string, BendaharaSetting | undefined> = {};
    settings.forEach((s) => (bySchool[s.school_id] = s));
    const q = search.toLowerCase().trim();
    return schools
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.npsn?.toLowerCase().includes(q))
      .map((s) => ({ school: s, setting: bySchool[s.id] }));
  }, [schools, settings, search]);

  // Aggregate KPIs
  const kpi = useMemo(() => {
    const totalSaldo = balances.reduce((a, b) => a + b.saldo_pending, 0);
    const totalGross = balances.reduce((a, b) => a + b.total_gross, 0);
    const totalDisbursed = balances.reduce((a, b) => a + b.total_disbursed, 0);
    const pendingPayouts = settlements.filter((s) => ["requested", "approved", "processing"].includes(s.status));
    return {
      totalSaldo, totalGross, totalDisbursed,
      pendingPayoutCount: pendingPayouts.length,
      pendingPayoutAmount: pendingPayouts.reduce((a, s) => a + s.final_payout, 0),
      totalPaidInvoices: invoices.filter((i) => i.status === "paid").length,
    };
  }, [balances, settlements, invoices]);

  const openReview = (s: Settlement) => {
    setReviewing(s);
    setAdminNote(s.admin_notes || "");
    setReviewOpen(true);
  };


  const toggleSchoolFlag = async (schoolId: string, field: "bendahara_wa_enabled" | "bendahara_offline_enabled", next: boolean) => {
    // Optimistic UI
    setSchools((prev) => prev.map((s) => (s.id === schoolId ? { ...s, [field]: next } : s)));
    const patch: any = { [field]: next };
    const { error } = await supabase.from("schools").update(patch).eq("id", schoolId);
    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
      // Rollback
      setSchools((prev) => prev.map((s) => (s.id === schoolId ? { ...s, [field]: !next } : s)));
      return;
    }
    toast.success(next ? "Fitur diaktifkan" : "Fitur dinonaktifkan");
  };



  const updateSettlement = async (newStatus: "approved" | "paid" | "rejected") => {
    if (!reviewing) return;
    setActionLoading(true);
    try {
      const patch: any = { status: newStatus, admin_notes: adminNote || null };
      if (newStatus === "approved") patch.approved_at = new Date().toISOString();
      if (newStatus === "paid") {
        patch.paid_at = new Date().toISOString();
        if (!reviewing.approved_at) patch.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from("spp_settlements").update(patch).eq("id", reviewing.id);
      if (error) throw error;

      // When paid, mark invoices as settled
      if (newStatus === "paid") {
        await supabase.from("spp_invoices")
          .update({ settlement_id: reviewing.id })
          .eq("school_id", reviewing.school_id)
          .eq("status", "paid")
          .is("settlement_id", null);
      }

      // When rejected, release any invoices linked to this settlement so saldo kembali
      if (newStatus === "rejected") {
        await supabase.from("spp_invoices")
          .update({ settlement_id: null })
          .eq("school_id", reviewing.school_id)
          .eq("settlement_id", reviewing.id);
      }
      toast.success(`Status pencairan diperbarui: ${newStatus}`);
      setReviewOpen(false);
      setReviewing(null);
      fetchAll();
    } catch (e: any) {
      toast.error("Gagal memperbarui: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Manajemen Bendahara"
        subtitle="Pantau saldo, pencairan dana, riwayat pembayaran SPP, dan konfigurasi tiap sekolah"
        actions={
          <Button
            onClick={fetchAll}
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl text-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Saldo Belum Cair", value: fmtIDR(kpi.totalSaldo), icon: Wallet, color: "from-emerald-500 to-teal-600" },
          { label: "Total SPP Diterima", value: fmtIDR(kpi.totalGross), icon: Receipt, color: "from-indigo-500 to-violet-600" },
          { label: "Total Dicairkan", value: fmtIDR(kpi.totalDisbursed), icon: Banknote, color: "from-blue-500 to-cyan-600" },
          { label: `Pencairan Pending (${kpi.pendingPayoutCount})`, value: fmtIDR(kpi.pendingPayoutAmount), icon: Clock, color: "from-amber-500 to-orange-600" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-0 shadow-card overflow-hidden">
              <CardContent className="p-4">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center mb-3 shadow`}>
                  <k.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
                <p className="text-base sm:text-lg font-bold text-foreground mt-1 truncate">{k.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari sekolah, NPSN, nomor invoice, siswa, atau kode pencairan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto rounded-xl">
          <TabsTrigger value="balances" className="gap-2 text-xs"><Wallet className="h-3.5 w-3.5" /> Saldo Sekolah</TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2 text-xs"><Banknote className="h-3.5 w-3.5" /> Pencairan</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2 text-xs"><Receipt className="h-3.5 w-3.5" /> Riwayat SPP</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 text-xs"><Settings2 className="h-3.5 w-3.5" /> Konfigurasi</TabsTrigger>
        </TabsList>

        {/* SALDO PER SEKOLAH */}
        <TabsContent value="balances" className="mt-5">
          <Card className="border-0 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold">Sekolah</TableHead>
                    <TableHead className="text-center font-bold">Invoice Lunas</TableHead>
                    <TableHead className="text-right font-bold">Total Diterima</TableHead>
                    <TableHead className="text-right font-bold">Sudah Dicairkan</TableHead>
                    <TableHead className="text-right font-bold text-emerald-600">Saldo Aktif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : filteredBalances.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Tidak ada data</TableCell></TableRow>
                  ) : filteredBalances.map((b) => {
                    const s = schoolMap[b.school_id];
                    return (
                      <TableRow key={b.school_id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                              <SchoolIcon className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{s?.name || "—"}</p>
                              <p className="text-[11px] text-muted-foreground">NPSN: {s?.npsn || "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{b.total_paid_invoices}</TableCell>
                        <TableCell className="text-right text-sm">{fmtIDR(b.total_gross)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtIDR(b.total_disbursed)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-emerald-600">{fmtIDR(b.saldo_pending)}</span>
                          {b.pending_settlement > 0 && (
                            <p className="text-[10px] text-amber-600 mt-0.5">+{fmtIDR(b.pending_settlement)} menunggu</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* PENCAIRAN */}
        <TabsContent value="settlements" className="mt-5">
          <Card className="border-0 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold">Kode</TableHead>
                    <TableHead className="font-bold">Sekolah</TableHead>
                    <TableHead className="text-center font-bold">Tx</TableHead>
                    <TableHead className="text-right font-bold">Net</TableHead>
                    <TableHead className="text-right font-bold">Payout</TableHead>
                    <TableHead className="font-bold">Rekening</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                    <TableHead className="font-bold">Diajukan</TableHead>
                    <TableHead className="text-center font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : filteredSettlements.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Belum ada pengajuan pencairan</TableCell></TableRow>
                  ) : filteredSettlements.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px]">{s.settlement_code}</TableCell>
                      <TableCell className="text-sm font-medium">{schoolMap[s.school_id]?.name || "—"}</TableCell>
                      <TableCell className="text-center text-sm">{s.total_transactions}</TableCell>
                      <TableCell className="text-right text-sm">{fmtIDR(s.total_net)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-600">{fmtIDR(s.final_payout)}</TableCell>
                      <TableCell className="text-xs">
                        <p className="font-semibold">{s.bank_name || "—"}</p>
                        <p className="text-muted-foreground">{s.account_number}</p>
                        <p className="text-muted-foreground">{s.account_holder}</p>
                      </TableCell>
                      <TableCell className="text-center"><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(s.requested_at)}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg" onClick={() => openReview(s)}>
                          <Eye className="h-3 w-3 mr-1" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* RIWAYAT SPP */}
        <TabsContent value="invoices" className="mt-5">
          <Card className="border-0 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold">No. Invoice</TableHead>
                    <TableHead className="font-bold">Sekolah</TableHead>
                    <TableHead className="font-bold">Siswa</TableHead>
                    <TableHead className="font-bold">Kelas</TableHead>
                    <TableHead className="font-bold">Periode</TableHead>
                    <TableHead className="text-right font-bold">Jumlah</TableHead>
                    <TableHead className="font-bold">Metode</TableHead>
                    <TableHead className="font-bold">Dibayar</TableHead>
                    <TableHead className="text-center font-bold">Pencairan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : filteredPaidInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Belum ada pembayaran SPP</TableCell></TableRow>
                  ) : filteredPaidInvoices.map((i) => (
                    <TableRow key={i.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px]">{i.invoice_number}</TableCell>
                      <TableCell className="text-sm">{schoolMap[i.school_id]?.name || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{i.student_name}</TableCell>
                      <TableCell className="text-xs">{i.class_name}</TableCell>
                      <TableCell className="text-xs">{i.period_label}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{fmtIDR(i.total_amount)}</TableCell>
                      <TableCell className="text-xs">{formatPaymentMethodLabel(i.payment_method)}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(i.paid_at)}</TableCell>
                      <TableCell className="text-center">
                        {i.settlement_id
                          ? <Badge className="bg-emerald-500 text-white border-0 text-[10px]">Sudah Cair</Badge>
                          : <Badge className="bg-amber-500 text-white border-0 text-[10px]">Belum Cair</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* KONFIGURASI */}
        <TabsContent value="settings" className="mt-5 space-y-5">

          {/* Toggle Fitur Bendahara per Sekolah */}
          <Card className="border-0 shadow-card overflow-hidden">
            <CardContent className="p-5 space-y-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    Fitur Bendahara per Sekolah
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktifkan/nonaktifkan pengiriman WA & pencatatan pembayaran offline (tunai / transfer manual) untuk tiap sekolah.
                  </p>
                </div>
                <Badge className="bg-indigo-500 text-white border-0 text-[10px]">Kontrol Super Admin</Badge>
              </div>
            </CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold">Sekolah</TableHead>
                    <TableHead className="text-center font-bold">Kirim WA (Tagihan &amp; Konfirmasi)</TableHead>
                    <TableHead className="text-center font-bold">Pembayaran Offline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : filteredSettings.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">Tidak ada data</TableCell></TableRow>
                  ) : filteredSettings.map(({ school }) => {
                    const waOn = school.bendahara_wa_enabled !== false;
                    const offOn = school.bendahara_offline_enabled !== false;
                    return (
                      <TableRow key={school.id} className="hover:bg-muted/30">
                        <TableCell>
                          <p className="font-semibold text-sm">{school.name}</p>
                          <p className="text-[11px] text-muted-foreground">NPSN: {school.npsn || "—"}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-2">
                            <Switch checked={waOn} onCheckedChange={(v) => toggleSchoolFlag(school.id, "bendahara_wa_enabled", v)} />
                            <Badge className={`${waOn ? "bg-emerald-500" : "bg-slate-400"} text-white border-0 text-[10px]`}>{waOn ? "AKTIF" : "NONAKTIF"}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-2">
                            <Switch checked={offOn} onCheckedChange={(v) => toggleSchoolFlag(school.id, "bendahara_offline_enabled", v)} />
                            <Badge className={`${offOn ? "bg-emerald-500" : "bg-slate-400"} text-white border-0 text-[10px]`}>{offOn ? "AKTIF" : "NONAKTIF"}</Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>


          <Card className="border-0 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold">Sekolah</TableHead>
                    <TableHead className="text-center font-bold">Gateway</TableHead>
                    <TableHead className="text-center font-bold">Environment</TableHead>
                    <TableHead className="text-center font-bold">API Key</TableHead>
                    <TableHead className="text-center font-bold">Test Status</TableHead>
                    <TableHead className="font-bold">Update Terakhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : filteredSettings.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Tidak ada data</TableCell></TableRow>
                  ) : filteredSettings.map(({ school, setting }) => (
                    <TableRow key={school.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="font-semibold text-sm">{school.name}</p>
                        <p className="text-[11px] text-muted-foreground">NPSN: {school.npsn || "—"}</p>
                      </TableCell>
                      <TableCell className="text-center text-xs">Mayar</TableCell>
                      <TableCell className="text-center">
                        <Badge className={setting?.environment === "production" ? "bg-emerald-500 text-white border-0 text-[10px]" : "bg-amber-500 text-white border-0 text-[10px]"}>
                          {setting?.environment?.toUpperCase() || "BELUM SET"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {setting?.use_platform_key ? <Badge className="bg-indigo-500 text-white border-0 text-[10px]">Platform Key</Badge>
                          : setting?.api_key ? <Badge className="bg-sky-500 text-white border-0 text-[10px]">Custom Key</Badge>
                          : <Badge variant="outline" className="text-[10px]">Belum Diatur</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {setting?.last_test_status ? <StatusBadge status={setting.last_test_status} /> : <span className="text-[11px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(setting?.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Settlement Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Pencairan Dana</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Kode</p><p className="font-mono text-xs">{reviewing.settlement_code}</p></div>
                <div><p className="text-xs text-muted-foreground">Sekolah</p><p className="font-semibold text-xs">{schoolMap[reviewing.school_id]?.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Transaksi</p><p className="font-semibold">{reviewing.total_transactions}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><div><StatusBadge status={reviewing.status} /></div></div>
                <div><p className="text-xs text-muted-foreground">Net</p><p className="font-semibold">{fmtIDR(reviewing.total_net)}</p></div>
                <div><p className="text-xs text-muted-foreground">Biaya Tarik</p><p className="font-semibold text-rose-600">-{fmtIDR(reviewing.withdraw_fee)}</p></div>
                <div className="col-span-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-2.5">
                  <p className="text-[11px] text-muted-foreground">Final Payout</p>
                  <p className="text-lg font-bold text-emerald-600">{fmtIDR(reviewing.final_payout)}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">Rekening Tujuan</p>
                <p className="text-sm font-semibold">{reviewing.bank_name || "—"}</p>
                <p className="text-xs">{reviewing.account_number}</p>
                <p className="text-xs">a.n. {reviewing.account_holder}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catatan Admin</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Opsional, mis: bukti transfer, alasan ditolak..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={actionLoading}>Tutup</Button>
            <Button variant="destructive" onClick={() => updateSettlement("rejected")} disabled={actionLoading}>
              <XCircle className="h-4 w-4 mr-1" /> Tolak
            </Button>
            <Button onClick={() => updateSettlement("approved")} disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Setujui
            </Button>
            <Button onClick={() => updateSettlement("paid")} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Banknote className="h-4 w-4 mr-1" />} Tandai Cair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
