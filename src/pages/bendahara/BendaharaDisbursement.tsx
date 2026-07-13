import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDownToLine, Search, Wallet, Clock, CheckCircle2, XCircle, ListChecks, Eye,
  FileDown, FileSpreadsheet, FileText, ShieldCheck, ShieldAlert, Send, Building2, Landmark,
  Star, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { buildDisbursementPayload, resolveBankCode } from "@/lib/disbursement";

const fmt = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

type Settlement = {
  id: string;
  settlement_code: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  total_gross: number;
  total_gateway_fee: number;
  total_net: number;
  withdraw_fee: number;
  final_payout: number;
  total_transactions: number;
  status: string;
  disbursement_status?: string | null;
  disbursement_response?: any;
  disbursement_error?: string | null;
  doku_reference_id?: string | null;
  doku_partner_reference_no?: string | null;
  notes?: string | null;
  requested_at: string;
  approved_at?: string | null;
  paid_at?: string | null;
  disbursement_callback_at?: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: "Menunggu",  cls: "bg-slate-500 hover:bg-slate-500 text-white",   icon: Clock },
  approved:  { label: "Diproses",  cls: "bg-amber-500 hover:bg-amber-500 text-white",   icon: Clock },
  paid:      { label: "Berhasil",  cls: "bg-emerald-600 hover:bg-emerald-600 text-white", icon: CheckCircle2 },
  rejected:  { label: "Gagal",     cls: "bg-red-600 hover:bg-red-600 text-white",       icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <Badge className={`gap-1 ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

function StatCard({ icon: Icon, label, value, tint }: any) {
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
          <div className="text-lg font-bold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BendaharaDisbursement() {
  const { profile, user, roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  const [school, setSchool] = useState<{ name?: string; npsn?: string } | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [available, setAvailable] = useState({ count: 0, gross: 0, fee: 0, net: 0 });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);

  // manage accounts dialog
  const [manageOpen, setManageOpen] = useState(false);

  // add account dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addBank, setAddBank] = useState("");
  const [addNumber, setAddNumber] = useState("");
  const [addHolder, setAddHolder] = useState("");
  const [addDefault, setAddDefault] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());

  const withdrawFee = 3000;
  const finalPayout = Math.max(0, available.net - withdrawFee);

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [sRes, invRes, stlRes, accRes] = await Promise.all([
        supabase.from("schools").select("name, npsn").eq("id", profile.school_id).maybeSingle(),
        supabase.from("spp_invoices")
          .select("id, payment_method, settlement_id, total_amount, gateway_fee, net_amount")
          .eq("school_id", profile.school_id).eq("status", "paid"),
        supabase.from("spp_settlements").select("*")
          .eq("school_id", profile.school_id)
          .order("created_at", { ascending: false }),
        supabase.from("bendahara_bank_accounts" as any)
          .select("*").eq("school_id", profile.school_id)
          .order("is_default", { ascending: false }),
      ]);
      if (cancelled) return;
      setSchool((sRes.data as any) || null);

      const paid = (invRes.data || []) as any[];
      const isOffline = (m: string | null) => ["offline_cash", "offline_transfer"].includes((m || "").toLowerCase());
      const online = paid.filter((x) => !isOffline(x.payment_method));
      const availList = online.filter((x) => !x.settlement_id);
      setAvailableItems(availList);
      setAvailable({
        count: availList.length,
        gross: availList.reduce((s, i) => s + (i.total_amount || 0), 0),
        fee: availList.reduce((s, i) => s + (i.gateway_fee || 0), 0),
        net: availList.reduce((s, i) => s + (i.net_amount || 0), 0),
      });

      setSettlements(((stlRes.data as any[]) || []) as Settlement[]);
      const accs = (accRes.data as any[]) || [];
      setAccounts(accs);
      const def = accs.find((a) => a.is_default && a.verification_status === "verified") || accs.find((a) => a.verification_status === "verified");
      if (def && !selectedAccountId) setSelectedAccountId(def.id);
      setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id, refreshKey]);

  // realtime
  useEffect(() => {
    if (!profile?.school_id) return;
    const ch = supabase.channel("disbursement-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements", filter: `school_id=eq.${profile.school_id}` }, () => setRefreshKey((k) => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => setRefreshKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.school_id]);

  const summary = useMemo(() => {
    const inProc = settlements.filter((s) => s.status === "pending" || s.status === "approved");
    const success = settlements.filter((s) => s.status === "paid");
    const failed = settlements.filter((s) => s.status === "rejected");
    return {
      inProcAmt: inProc.reduce((a, s) => a + (s.final_payout || 0), 0),
      successAmt: success.reduce((a, s) => a + (s.final_payout || 0), 0),
      failedAmt: failed.reduce((a, s) => a + (s.final_payout || 0), 0),
      total: settlements.length,
    };
  }, [settlements]);

  const filtered = useMemo(() => {
    return settlements.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${s.settlement_code} ${s.bank_name} ${s.account_holder} ${s.account_number}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (dateFrom) {
        if (new Date(s.requested_at) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(s.requested_at) > end) return false;
      }
      return true;
    });
  }, [settlements, q, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [q, statusFilter, dateFrom, dateTo]);

  const verifiedAccounts = accounts.filter((a) => a.verification_status === "verified");
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const openConfirm = () => {
    if (available.count === 0) { toast.error("Tidak ada saldo yang bisa dicairkan"); return; }
    if (verifiedAccounts.length === 0) {
      toast.error("Belum ada rekening terverifikasi. Tambahkan & verifikasi rekening terlebih dahulu.");
      return;
    }
    const def = verifiedAccounts.find((a) => a.is_default) || verifiedAccounts[0];
    setSelectedAccountId(def.id);
    setConfirmOpen(true);
  };

  const submit = async () => {
    if (!user?.id || !profile?.school_id || !selectedAccount) return;
    setSubmitting(true);
    try {
      const code = `DSB-${Date.now().toString().slice(-8)}`;
      const invoiceIds = availableItems.map((i) => i.id);
      if (invoiceIds.length === 0) { toast.error("Tidak ada saldo"); return; }

      const payload = buildDisbursementPayload({
        beneficiaryName: selectedAccount.account_holder,
        bankName: selectedAccount.bank_name,
        accountNumber: selectedAccount.account_number,
        amount: finalPayout,
        referenceId: code,
        notes: `Disbursement ${school?.name || ""}`.trim(),
        callbackUrl: `${window.location.origin}/api/disbursement/callback`,
      });

      const { data: stl, error } = await supabase.from("spp_settlements").insert({
        school_id: profile.school_id,
        settlement_code: code,
        total_transactions: available.count,
        total_gross: available.gross,
        total_gateway_fee: available.fee,
        total_net: available.net,
        withdraw_fee: withdrawFee,
        final_payout: finalPayout,
        bank_name: selectedAccount.bank_name,
        account_number: selectedAccount.account_number,
        account_holder: selectedAccount.account_holder,
        account_type: selectedAccount.account_type || "bank",
        responsible_user_id: selectedAccount.responsible_user_id || null,
        status: "pending",
        disbursement_status: "pending",
        disbursement_method: "doku",
        disbursement_response: { request: payload, note: "API belum diintegrasikan — payload disimpan sebagai placeholder" },
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        notes: `Disbursement otomatis ke ${selectedAccount.bank_name} (${resolveBankCode(selectedAccount.bank_name)})`,
      }).select().single();

      if (error || !stl) { toast.error(error?.message || "Gagal mengajukan pencairan"); return; }

      await supabase.from("spp_invoices").update({ settlement_id: stl.id })
        .eq("school_id", profile.school_id).in("id", invoiceIds).is("settlement_id", null);

      await supabase.from("spp_logs").insert({
        school_id: profile.school_id,
        action: "disbursement_requested",
        actor_id: user.id,
        details: { settlement_id: stl.id, code, amount: finalPayout, bank: selectedAccount.bank_name },
      } as any).then(() => null, () => null);

      toast.success("Pengajuan disbursement dibuat, menunggu proses");
      setConfirmOpen(false);
      setRefreshKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Exports ----------
  const exportCSV = () => {
    const headers = ["Kode", "Bank", "No Rekening", "Pemilik", "Total Kotor", "Fee Gateway", "Biaya", "Dikirim", "Status", "Diajukan", "Berhasil"];
    const rows = filtered.map((s) => [
      s.settlement_code, s.bank_name, s.account_number, s.account_holder,
      s.total_gross, s.total_gateway_fee, s.withdraw_fee, s.final_payout,
      STATUS_META[s.status]?.label || s.status,
      new Date(s.requested_at).toISOString(),
      s.paid_at ? new Date(s.paid_at).toISOString() : "",
    ]);
    const csv = [headers, ...rows].map((r) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `disbursement_${Date.now()}.csv`);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = filtered.map((s) => ({
      Kode: s.settlement_code,
      Bank: s.bank_name,
      "No Rekening": s.account_number,
      Pemilik: s.account_holder,
      "Total Kotor": s.total_gross,
      "Fee Gateway": s.total_gateway_fee,
      "Biaya Disbursement": s.withdraw_fee,
      "Dana Dikirim": s.final_payout,
      Status: STATUS_META[s.status]?.label || s.status,
      Diajukan: fmtDate(s.requested_at),
      Berhasil: s.paid_at ? fmtDate(s.paid_at) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursement");
    XLSX.writeFile(wb, `disbursement_${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const jsPDFMod = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDFMod.jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Riwayat Disbursement — ${school?.name || ""}`, 14, 15);
    (doc as any).autoTable({
      startY: 22,
      head: [["Kode", "Bank", "No Rek", "Pemilik", "Dikirim", "Status", "Diajukan"]],
      body: filtered.map((s) => [
        s.settlement_code, s.bank_name, s.account_number, s.account_holder,
        fmt(s.final_payout), STATUS_META[s.status]?.label || s.status,
        fmtDate(s.requested_at),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [91, 108, 249] },
    });
    doc.save(`disbursement_${Date.now()}.pdf`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ArrowDownToLine}
        title="Disbursement Otomatis"
        subtitle="Kirim hasil SPP & tagihan sekolah langsung ke rekening bank sekolah"
        variant="primary"
        actions={
          <Button size="sm" onClick={openConfirm} disabled={available.count === 0 || verifiedAccounts.length === 0}
            className="gap-2 bg-white text-[#5B6CF9] hover:bg-white/90 border border-white/40 shadow-sm font-semibold">
            <Send className="h-4 w-4" /> Ajukan Pencairan
          </Button>
        }
      />

      {/* Dashboard Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Wallet}       label="Siap Dicairkan" value={fmt(finalPayout)}       tint="bg-emerald-100 text-emerald-700" />
        <StatCard icon={Clock}        label="Sedang Diproses" value={fmt(summary.inProcAmt)} tint="bg-amber-100 text-amber-700" />
        <StatCard icon={CheckCircle2} label="Berhasil Dicairkan" value={fmt(summary.successAmt)} tint="bg-sky-100 text-sky-700" />
        <StatCard icon={XCircle}      label="Gagal Dicairkan" value={fmt(summary.failedAmt)} tint="bg-red-100 text-red-700" />
        <StatCard icon={ListChecks}   label="Total Transaksi" value={summary.total.toString()} tint="bg-[#5B6CF9]/10 text-[#5B6CF9]" />
      </div>

      {/* Rekening Pencairan (ringkas) */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Landmark className="h-4 w-4 text-[#5B6CF9] shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Rekening Pencairan</div>
                {(() => {
                  const def = accounts.find((a) => a.is_default) || accounts[0];
                  if (!def) return <div className="text-xs text-muted-foreground">Belum ada rekening tersimpan.</div>;
                  const v = def.verification_status || "pending";
                  return (
                    <div className="text-xs text-muted-foreground truncate">
                      {def.bank_name} — {def.account_number} · a.n. {def.account_holder}
                      {" · "}
                      {v === "verified" ? <span className="text-emerald-600 font-medium">Terverifikasi</span>
                        : v === "rejected" ? <span className="text-red-600 font-medium">Ditolak</span>
                        : <span className="text-slate-500 font-medium">Menunggu Verifikasi</span>}
                      {accounts.length > 1 && <span> · +{accounts.length - 1} lainnya</span>}
                    </div>
                  );
                })()}
              </div>
            </div>
            <Button size="sm" onClick={() => setManageOpen(true)} className="gap-1.5 bg-[#5B6CF9] hover:bg-[#4a5ce8]">
              <Landmark className="h-4 w-4" /> Kelola Rekening
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kelola Rekening Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[#5B6CF9]" /> Kelola Rekening Pencairan
            </DialogTitle>
            <DialogDescription>
              Hanya rekening <b>terverifikasi</b> di DOKU yang dapat menerima pencairan dana.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 bg-[#5B6CF9] hover:bg-[#4a5ce8]">
              <Building2 className="h-4 w-4" /> Tambah Rekening
            </Button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center border rounded-xl">
              Belum ada rekening. Klik <b>Tambah Rekening</b> untuk mulai.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Terdaftar (verified) */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Terdaftar & Terverifikasi</div>
                <div className="grid gap-2">
                  {accounts.filter((a) => (a.verification_status || "pending") === "verified").length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">Belum ada rekening terverifikasi.</div>
                  ) : accounts.filter((a) => (a.verification_status || "pending") === "verified").map((a) => (
                    <div key={a.id} className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{a.bank_name} — {a.account_number}</div>
                          <div className="text-xs text-muted-foreground">a.n. {a.account_holder}{a.is_default ? " · Utama" : ""}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Diperbarui: {fmtDate(a.updated_at || a.created_at)}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><ShieldCheck className="h-3 w-3" /> Terverifikasi</Badge>
                          {!a.is_default && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                              await supabase.from("bendahara_bank_accounts" as any).update({ is_default: false }).eq("school_id", a.school_id);
                              const { error } = await supabase.from("bendahara_bank_accounts" as any).update({ is_default: true }).eq("id", a.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success("Rekening utama diperbarui");
                              setRefreshKey((k) => k + 1);
                            }}><Star className="h-3.5 w-3.5" /> Jadikan Utama</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Belum terdaftar */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Belum Terverifikasi</div>
                <div className="grid gap-2">
                  {accounts.filter((a) => (a.verification_status || "pending") !== "verified").length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">Semua rekening sudah terverifikasi.</div>
                  ) : accounts.filter((a) => (a.verification_status || "pending") !== "verified").map((a) => {
                    const v = a.verification_status || "pending";
                    return (
                      <div key={a.id} className="rounded-xl border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{a.bank_name} — {a.account_number}</div>
                            <div className="text-xs text-muted-foreground">a.n. {a.account_holder}{a.is_default ? " · Utama" : ""}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Diperbarui: {fmtDate(a.updated_at || a.created_at)}</div>
                          </div>
                          {v === "rejected" ? (
                            <Badge className="bg-red-600 hover:bg-red-600 gap-1"><ShieldAlert className="h-3 w-3" /> Ditolak</Badge>
                          ) : (
                            <Badge className="bg-slate-500 hover:bg-slate-500 gap-1"><Clock className="h-3 w-3" /> Menunggu Verifikasi</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                          {!a.doku_bank_account_settlement_id && !verifyingIds.has(a.id) && (
                            <Button size="sm" className="bg-[#5B6CF9] hover:bg-[#4a5ce8] gap-1" onClick={async () => {
                              setVerifyingIds((s) => new Set(s).add(a.id));
                              try {
                                const { data, error } = await supabase.functions.invoke("doku-bank-account", { body: { action: "create", account_id: a.id } });
                                if (error || data?.error) { toast.error(data?.error || error?.message || "Gagal daftar ke DOKU"); return; }
                                toast.success("Rekening didaftarkan ke DOKU");
                                setRefreshKey((k) => k + 1);
                              } finally {
                                setVerifyingIds((s) => { const n = new Set(s); n.delete(a.id); return n; });
                              }
                            }}><Send className="h-3.5 w-3.5" /> Verifikasi</Button>
                          )}
                          {verifyingIds.has(a.id) && (
                            <Badge className="bg-slate-500 hover:bg-slate-500 gap-1"><Clock className="h-3 w-3 animate-spin" /> Memproses verifikasi…</Badge>
                          )}
                          {a.doku_bank_account_settlement_id && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                              const { data, error } = await supabase.functions.invoke("doku-bank-account", { body: { action: "get", account_id: a.id } });
                              if (error || data?.error) { toast.error(data?.error || error?.message || "Gagal sync"); return; }
                              toast.success("Status disinkronkan");
                              setRefreshKey((k) => k + 1);
                            }}><ShieldCheck className="h-3.5 w-3.5" /> Sync Status</Button>
                          )}
                          {isSuperAdmin && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                              await supabase.from("bendahara_bank_accounts" as any)
                                .update({ verification_status: "verified", verified_at: new Date().toISOString(), verified_by: user?.id })
                                .eq("id", a.id);
                              toast.success("Rekening diverifikasi manual");
                              setRefreshKey((k) => k + 1);
                            }}><ShieldCheck className="h-3.5 w-3.5" /> Verifikasi Manual</Button>
                          )}
                          {!a.is_default && (
                            <Button size="sm" variant="ghost" className="gap-1" onClick={async () => {
                              await supabase.from("bendahara_bank_accounts" as any).update({ is_default: false }).eq("school_id", a.school_id);
                              const { error } = await supabase.from("bendahara_bank_accounts" as any).update({ is_default: true }).eq("id", a.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success("Rekening utama diperbarui");
                              setRefreshKey((k) => k + 1);
                            }}><Star className="h-3.5 w-3.5" /> Utama</Button>
                          )}
                          <Button size="sm" variant="ghost" className="gap-1 text-red-600 hover:text-red-700 ml-auto" onClick={async () => {
                            if (!confirm(`Hapus rekening ${a.bank_name} — ${a.account_number}?`)) return;
                            const { error } = await supabase.from("bendahara_bank_accounts" as any).delete().eq("id", a.id);
                            if (error) { toast.error(error.message); return; }
                            toast.success("Rekening dihapus");
                            setRefreshKey((k) => k + 1);
                          }}><Trash2 className="h-3.5 w-3.5" /> Hapus</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters + Export */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/bank/pemilik…" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="approved">Diproses</SelectItem>
                <SelectItem value="paid">Berhasil</SelectItem>
                <SelectItem value="rejected">Gagal</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1.5"><FileText className="h-4 w-4" /> PDF</Button>
            <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5"><FileDown className="h-4 w-4" /> CSV</Button>
            <div className="ml-auto text-xs text-muted-foreground self-center">
              {filtered.length} data
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>No Rek</TableHead>
                <TableHead>Pemilik</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Biaya</TableHead>
                <TableHead className="text-right">Dikirim</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Diajukan</TableHead>
                <TableHead>Berhasil</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Memuat…</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Tidak ada data.</TableCell></TableRow>
              ) : pageRows.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">{s.settlement_code}</TableCell>
                  <TableCell>{s.bank_name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.account_number}</TableCell>
                  <TableCell className="truncate max-w-[160px]">{s.account_holder}</TableCell>
                  <TableCell className="text-right">{fmt(s.total_gross)}</TableCell>
                  <TableCell className="text-right">{fmt(s.withdraw_fee)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(s.final_payout)}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-xs">{fmtDate(s.requested_at)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(s.paid_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setDetail(s); setDetailOpen(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <span className="text-xs text-muted-foreground">Halaman {page} dari {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelum</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikut</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pengajuan Disbursement</DialogTitle>
            <DialogDescription>
              Sistem akan mengirim dana ke rekening sekolah yang terverifikasi. Aksi ini akan mengunci transaksi terkait.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Rekening Tujuan</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger><SelectValue placeholder="Pilih rekening terverifikasi" /></SelectTrigger>
                <SelectContent>
                  {verifiedAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bank_name} — {a.account_number} · {a.account_holder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Transaksi</span><b>{available.count}</b></div>
              <div className="flex justify-between"><span>Total Pembayaran Masuk</span><b>{fmt(available.gross)}</b></div>
              <div className="flex justify-between"><span>Fee Gateway</span><b>-{fmt(available.fee)}</b></div>
              <div className="flex justify-between"><span>Biaya Disbursement</span><b>-{fmt(withdrawFee)}</b></div>
              <div className="flex justify-between border-t pt-1 mt-1 text-emerald-700"><span>Dana Dikirim</span><b>{fmt(finalPayout)}</b></div>
            </div>
            {selectedAccount && (
              <div className="text-xs text-muted-foreground">
                Bank Code (auto): <b>{resolveBankCode(selectedAccount.bank_name)}</b>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={submitting || !selectedAccountId} className="bg-[#5B6CF9] hover:bg-[#4c5ded] gap-2">
              <Send className="h-4 w-4" /> {submitting ? "Memproses…" : "Ajukan Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-[#5B6CF9]" />
              Detail Disbursement
            </DialogTitle>
            <DialogDescription>{detail?.settlement_code}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <section>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Informasi Sekolah</div>
                <div className="rounded-xl border border-border/60 p-3 grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Nama Sekolah</span><span className="font-medium">{school?.name || "—"}</span>
                  <span className="text-muted-foreground">NPSN</span><span className="font-medium">{school?.npsn || "—"}</span>
                  <span className="text-muted-foreground">Bendahara</span><span className="font-medium">{profile?.full_name || "—"}</span>
                  <span className="text-muted-foreground">Bank</span><span className="font-medium">{detail.bank_name}</span>
                  <span className="text-muted-foreground">No Rekening</span><span className="font-medium font-mono">{detail.account_number}</span>
                  <span className="text-muted-foreground">Pemilik</span><span className="font-medium">{detail.account_holder}</span>
                </div>
              </section>

              <section>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Informasi Dana</div>
                <div className="rounded-xl border border-border/60 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Total Pembayaran Masuk</span><b>{fmt(detail.total_gross)}</b></div>
                  <div className="flex justify-between"><span>Total Fee Gateway</span><b>-{fmt(detail.total_gateway_fee)}</b></div>
                  <div className="flex justify-between"><span>Biaya Disbursement</span><b>-{fmt(detail.withdraw_fee)}</b></div>
                  <div className="flex justify-between"><span>Total Dana Bersih</span><b>{fmt(detail.total_net)}</b></div>
                  <div className="flex justify-between border-t pt-1 mt-1 text-emerald-700"><span>Nominal yang Dikirim</span><b>{fmt(detail.final_payout)}</b></div>
                </div>
              </section>

              <section>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Riwayat</div>
                <div className="rounded-xl border border-border/60 p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Status</span><StatusBadge status={detail.status} /></div>
                  <div className="flex justify-between"><span>Dibuat</span><span>{fmtDate(detail.created_at)}</span></div>
                  <div className="flex justify-between"><span>Diajukan</span><span>{fmtDate(detail.requested_at)}</span></div>
                  <div className="flex justify-between"><span>Diproses</span><span>{fmtDate(detail.approved_at)}</span></div>
                  <div className="flex justify-between"><span>Berhasil</span><span>{fmtDate(detail.paid_at)}</span></div>
                  <div className="flex justify-between"><span>Callback API</span><span>{fmtDate(detail.disbursement_callback_at)}</span></div>
                  {detail.doku_reference_id && <div className="flex justify-between"><span>Reference</span><span className="font-mono text-xs">{detail.doku_reference_id}</span></div>}
                  {detail.doku_partner_reference_no && <div className="flex justify-between"><span>Partner Ref</span><span className="font-mono text-xs">{detail.doku_partner_reference_no}</span></div>}
                  {detail.disbursement_error && <div className="text-red-600 text-xs">{detail.disbursement_error}</div>}
                </div>
              </section>

              <section>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Response API (placeholder)</div>
                <pre className="rounded-xl border border-border/60 p-3 text-[11px] bg-muted/40 overflow-x-auto max-h-48">
{JSON.stringify(detail.disbursement_response || { info: "Belum ada response API" }, null, 2)}
                </pre>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add account dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Rekening Pencairan</DialogTitle>
            <DialogDescription>Pastikan nama pemilik rekening sama persis dengan buku tabungan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Bank</Label>
              <Input value={addBank} onChange={(e) => setAddBank(e.target.value)} placeholder="Mandiri, BCA, BNI, BRI, BSI…" />
            </div>
            <div>
              <Label>Nomor Rekening</Label>
              <Input value={addNumber} onChange={(e) => setAddNumber(e.target.value.replace(/\D/g, ""))} placeholder="1800011522457" inputMode="numeric" />
            </div>
            <div>
              <Label>Nama Pemilik Rekening</Label>
              <Input value={addHolder} onChange={(e) => setAddHolder(e.target.value)} placeholder="Sesuai buku tabungan" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addDefault} onChange={(e) => setAddDefault(e.target.checked)} />
              Jadikan rekening utama
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button
              disabled={addSaving || !addBank || !addNumber || !addHolder}
              className="bg-[#5B6CF9] hover:bg-[#4a5ce8]"
              onClick={async () => {
                if (!profile?.school_id) return;
                setAddSaving(true);
                try {
                  if (addDefault) {
                    await supabase.from("bendahara_bank_accounts" as any)
                      .update({ is_default: false }).eq("school_id", profile.school_id);
                  }
                  const { error } = await supabase.from("bendahara_bank_accounts" as any).insert({
                    school_id: profile.school_id,
                    bank_name: addBank.trim(),
                    account_number: addNumber.trim(),
                    account_holder: addHolder.trim(),
                    is_default: addDefault,
                    doku_bank_code: resolveBankCode(addBank),
                    verification_status: "pending",
                  } as any);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Rekening ditambahkan. Klik 'Daftar ke DOKU' untuk verifikasi.");
                  setAddOpen(false);
                  setAddBank(""); setAddNumber(""); setAddHolder(""); setAddDefault(false);
                  setRefreshKey((k) => k + 1);
                } finally {
                  setAddSaving(false);
                }
              }}
            >
              {addSaving ? "Menyimpan…" : "Simpan Rekening"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
