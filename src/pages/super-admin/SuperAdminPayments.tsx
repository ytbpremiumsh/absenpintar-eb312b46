import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Webhook, Copy, Check, CheckCircle2, Loader2, Search, User, School as SchoolIcon, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WebhookCard = () => {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mayar-webhook`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL Webhook disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-0 shadow-card bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">Mayar Webhook URL</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pasang URL ini di pengaturan webhook Mayar untuk auto-verifikasi pembayaran</p>
            <div className="flex items-center gap-2 mt-2">
              <code className="text-[11px] bg-background/80 px-3 py-1.5 rounded-lg border text-foreground truncate flex-1">
                {webhookUrl}
              </code>
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SuperAdminPayments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [sppInvoices, setSppInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [sppSearch, setSppSearch] = useState("");
  const [sppStatus, setSppStatus] = useState<"all" | "paid" | "pending">("all");

  const fetchPayments = async () => {
    const [{ data: pays }, { data: spps }] = await Promise.all([
      supabase
        .from("payment_transactions")
        .select("*, schools(name), subscription_plans(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("spp_invoices")
        .select("id, school_id, invoice_number, student_name, class_name, parent_name, parent_phone, period_label, amount, total_amount, status, payment_method, payment_channel, paid_at, created_at, schools(name)")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setPayments(pays || []);
    setSppInvoices(spps || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
    const channel = supabase
      .channel("admin-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_transactions" }, () => fetchPayments())
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices" }, () => fetchPayments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-approve-payment', {
        body: { payment_id: approveTarget.id, extend_months: 1 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Pembayaran disetujui! Langganan aktif hingga ${new Date(data.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`);
      setApproveTarget(null);
      fetchPayments();
    } catch (err: any) {
      toast.error("Gagal approve: " + (err.message || "Unknown error"));
    } finally {
      setApproving(false);
    }
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  const statusMap: Record<string, { label: string; cls: string }> = {
    paid: { label: "Lunas", cls: "bg-success/10 text-success border-success/20" },
    pending: { label: "Pending", cls: "bg-warning/10 text-warning border-warning/20" },
    failed: { label: "Gagal", cls: "bg-destructive/10 text-destructive border-destructive/20" },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const paidCount = payments.filter(p => p.status === "paid").length;
  const pendingCount = payments.filter(p => p.status === "pending").length;
  const totalRevenue = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  const sppPaidCount = sppInvoices.filter(s => s.status === "paid").length;
  const sppPendingCount = sppInvoices.filter(s => s.status === "pending").length;
  const sppRevenue = sppInvoices.filter(s => s.status === "paid").reduce((sum, s) => sum + (s.total_amount || s.amount || 0), 0);

  const filteredSpp = sppInvoices.filter(s => {
    if (sppStatus !== "all" && s.status !== sppStatus) return false;
    if (!sppSearch) return true;
    const q = sppSearch.toLowerCase();
    return (
      (s.student_name || "").toLowerCase().includes(q) ||
      (s.parent_name || "").toLowerCase().includes(q) ||
      (s.class_name || "").toLowerCase().includes(q) ||
      (s.invoice_number || "").toLowerCase().includes(q) ||
      (s.schools?.name || "").toLowerCase().includes(q)
    );
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Riwayat Pembayaran</h1>
        <p className="text-muted-foreground text-sm">Seluruh transaksi pembayaran dari semua sekolah (realtime)</p>
      </div>

      <WebhookCard />

      <Tabs defaultValue="subs" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="subs" className="flex-1 gap-1.5">
            <SchoolIcon className="h-3.5 w-3.5" /> Langganan Sekolah
          </TabsTrigger>
          <TabsTrigger value="spp" className="flex-1 gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Pembayaran SPP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subs" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Lunas</p><p className="text-lg font-extrabold text-success">{paidCount}</p></CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-extrabold text-warning">{pendingCount}</p></CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Pendapatan</p><p className="text-lg font-extrabold text-foreground">{formatRupiah(totalRevenue)}</p></CardContent></Card>
          </div>

          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Belum ada transaksi</p>
              ) : (
                <div className="divide-y divide-border">
                  {payments.map((p) => {
                    const st = statusMap[p.status] || statusMap.pending;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.schools?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.subscription_plans?.name} • {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {p.mayar_transaction_id && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{p.mayar_transaction_id}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{formatRupiah(p.amount)}</p>
                            <Badge className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
                            {p.paid_at && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(p.paid_at).toLocaleDateString("id-ID")}</p>}
                          </div>
                          {p.status === "pending" && (
                            <Button variant="outline" size="sm" className="h-8 text-xs border-success/30 text-success hover:bg-success/10" onClick={() => setApproveTarget(p)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spp" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">SPP Lunas</p><p className="text-lg font-extrabold text-success">{sppPaidCount}</p></CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">SPP Pending</p><p className="text-lg font-extrabold text-warning">{sppPendingCount}</p></CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Terkumpul</p><p className="text-lg font-extrabold text-foreground">{formatRupiah(sppRevenue)}</p></CardContent></Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama siswa, orang tua, kelas, invoice, sekolah..." value={sppSearch} onChange={(e) => setSppSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(["all", "paid", "pending"] as const).map((k) => (
                <Button key={k} size="sm" variant={sppStatus === k ? "default" : "outline"} onClick={() => setSppStatus(k)} className="text-xs">
                  {k === "all" ? "Semua" : k === "paid" ? "Lunas" : "Pending"}
                </Button>
              ))}
            </div>
          </div>

          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              {filteredSpp.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Belum ada tagihan SPP</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredSpp.slice(0, 200).map((s) => {
                    const st = statusMap[s.status] || statusMap.pending;
                    return (
                      <div key={s.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            <p className="text-sm font-semibold text-foreground truncate">{s.student_name || "—"}</p>
                            {s.class_name && <Badge variant="secondary" className="text-[10px]">{s.class_name}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {s.schools?.name || "—"} • {s.period_label || "—"}
                          </p>
                          {(s.parent_name || s.parent_phone) && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              Ortu: {s.parent_name || "—"}{s.parent_phone ? ` • ${s.parent_phone}` : ""}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{s.invoice_number}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">{formatRupiah(s.total_amount || s.amount || 0)}</p>
                          <Badge className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
                          {s.paid_at && <p className="text-[10px] text-muted-foreground mt-0.5">Dibayar {new Date(s.paid_at).toLocaleDateString("id-ID")}</p>}
                          {s.payment_channel && <p className="text-[10px] text-muted-foreground">{s.payment_channel}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {filteredSpp.length > 200 && (
                    <p className="text-[11px] text-center text-muted-foreground py-3">Menampilkan 200 dari {filteredSpp.length} tagihan</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={() => setApproveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Sekolah:</span> <strong>{approveTarget?.schools?.name}</strong></p>
            <p><span className="text-muted-foreground">Paket:</span> <strong>{approveTarget?.subscription_plans?.name}</strong></p>
            <p><span className="text-muted-foreground">Jumlah:</span> <strong>{approveTarget ? formatRupiah(approveTarget.amount) : ''}</strong></p>
            <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-xs text-success">
              <CheckCircle2 className="h-4 w-4 inline mr-1" />
              Pembayaran akan ditandai <strong>Lunas</strong> dan langganan sekolah akan otomatis diperpanjang <strong>1 bulan</strong> dari tanggal berakhir saat ini.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Batal</Button>
            <Button onClick={handleApprove} disabled={approving} className="bg-success text-success-foreground hover:bg-success/90">
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {approving ? "Memproses..." : "Approve Lunas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPayments;
