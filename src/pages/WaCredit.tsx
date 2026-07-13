import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Loader2, ArrowLeft, Minus, Plus, ShieldCheck, Zap, TrendingUp, Wallet, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PaymentIframeDialog } from "@/components/PaymentIframeDialog";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { useWaCreditEnabled } from "@/hooks/useWaCreditEnabled";

const WaCredit = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { enabled: waCreditEnabled, loading: waCreditLoading } = useWaCreditEnabled();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!waCreditLoading && !waCreditEnabled) {
      navigate("/addons", { replace: true });
    }
  }, [waCreditLoading, waCreditEnabled, navigate]);
  const [waCredits, setWaCredits] = useState<any>(null);
  const [waCreditPrice, setWaCreditPrice] = useState(50000);
  const [waCreditPerPack, setWaCreditPerPack] = useState(1000);
  const [waPacks, setWaPacks] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [paymentIframe, setPaymentIframe] = useState<string | null>(null);
  const [paymentTxnId, setPaymentTxnId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("status") === "success") {
      toast.success("Pembayaran kredit WhatsApp berhasil!");
    }
  }, [searchParams]);

  useEffect(() => {
    const fetch = async () => {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["wa_credit_price", "wa_credit_per_pack"]);
      (settings || []).forEach((d: any) => {
        if (d.key === "wa_credit_price") setWaCreditPrice(parseInt(d.value) || 50000);
        if (d.key === "wa_credit_per_pack") setWaCreditPerPack(parseInt(d.value) || 1000);
      });

      if (profile?.school_id) {
        const [creditRes, historyRes] = await Promise.all([
          supabase.from("wa_credits").select("*").eq("school_id", profile.school_id).maybeSingle(),
          supabase.from("payment_transactions").select("*")
            .eq("school_id", profile.school_id)
            .like("payment_method", "%wa_credit%")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        setWaCredits(creditRes.data);
        setPurchaseHistory(historyRes.data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [profile?.school_id]);

  const handleBuy = async () => {
    if (!profile?.school_id) return;
    setPurchasing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sesi login berakhir");

      const { data, error } = await supabase.functions.invoke("create-mayar-payment", {
        body: { addon_type: "wa_credit", school_id: profile.school_id, wa_credit_amount: waPacks },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data?.payment_url) {
        toast.success("Membuka halaman pembayaran (QRIS / Transfer Bank)...");
        setPaymentTxnId(data.transaction_id || null);
        setPaymentIframe(data.payment_url);
      } else {
        throw new Error(data?.error || "Tidak mendapatkan link pembayaran");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pembayaran");
    }
    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const creditPercent = waCredits ? Math.min(100, (waCredits.balance / Math.max(waCredits.total_purchased, 1)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        icon={MessageSquare}
        title="Kredit Pesan WhatsApp"
        subtitle="Top-up kredit pesan untuk notifikasi absensi & broadcast"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/addons")}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Kembali
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: Credit Status (3 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* Balance Card */}
          <Card className="overflow-hidden border-0 shadow-card">
            <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 p-6 text-white">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-white/75 font-medium uppercase tracking-wide">Sisa Kredit Pesan</p>
                  <p className="text-4xl sm:text-5xl font-extrabold mt-2 tabular-nums leading-none">
                    {waCredits ? waCredits.balance.toLocaleString("id-ID") : "0"}
                  </p>
                  <p className="text-xs sm:text-sm text-white/75 mt-2">pesan tersedia</p>
                </div>
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
              </div>
            </div>
            <CardContent className="p-5 space-y-4">
              {waCredits ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-muted-foreground font-medium">Pemakaian</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {waCredits.total_used.toLocaleString("id-ID")}
                        <span className="text-muted-foreground"> / {waCredits.total_purchased.toLocaleString("id-ID")}</span>
                      </span>
                    </div>
                    <Progress value={creditPercent} className="h-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Total Beli", val: waCredits.total_purchased.toLocaleString("id-ID"), icon: TrendingUp, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
                      { label: "Terpakai", val: waCredits.total_used.toLocaleString("id-ID"), icon: Zap, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
                      { label: "Sisa", val: waCredits.balance.toLocaleString("id-ID"), icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-xl bg-muted/40 border border-border/60 text-center">
                        <div className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center mb-1.5 ${s.color}`}>
                          <s.icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{s.label}</p>
                        <p className="font-bold text-sm tabular-nums mt-0.5">{s.val}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Wallet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">Belum ada kredit. Beli kredit pertama Anda!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Purchase (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="border-0 shadow-card h-full">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base">Beli Kredit Pesan</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Pilih jumlah paket yang ingin dibeli</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/60 dark:border-violet-900/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Harga per paket</span>
                  <Badge variant="secondary" className="text-[10px] bg-white/80 dark:bg-background/40 font-semibold">
                    {waCreditPerPack.toLocaleString("id-ID")} pesan
                  </Badge>
                </div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums">
                  Rp {waCreditPrice.toLocaleString("id-ID")}
                </p>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jumlah Paket</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={() => setWaPacks(Math.max(1, waPacks - 1))}
                    disabled={waPacks <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={waPacks}
                    onChange={(e) => setWaPacks(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 text-center font-bold text-base flex-1 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={() => setWaPacks(Math.min(100, waPacks + 1))}
                    disabled={waPacks >= 100}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  = <strong className="text-foreground tabular-nums">{(waPacks * waCreditPerPack).toLocaleString("id-ID")}</strong> pesan
                </p>
              </div>

              {/* Total */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <span className="text-sm font-semibold">Total Pembayaran</span>
                <span className="text-xl font-extrabold text-primary tabular-nums">
                  Rp {(waPacks * waCreditPrice).toLocaleString("id-ID")}
                </span>
              </div>

              <Button
                className="w-full h-11 text-sm font-semibold gradient-primary text-primary-foreground"
                onClick={handleBuy}
                disabled={purchasing}
              >
                {purchasing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</>
                ) : (
                  <><MessageSquare className="h-4 w-4 mr-2" /> Beli Kredit Sekarang</>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Pembayaran diproses melalui payment gateway aman
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <PaymentIframeDialog
        open={!!paymentIframe}
        paymentUrl={paymentIframe}
        title="Pembelian Kredit WhatsApp — QRIS / Transfer Bank"
        checkPaid={async () => {
          if (!paymentTxnId) return false;
          const { data } = await supabase.from("payment_transactions").select("status").eq("id", paymentTxnId).maybeSingle();
          return data?.status === "paid";
        }}
        onPaid={() => { window.location.href = "/wa-credit?status=success"; }}
        onClose={() => { setPaymentIframe(null); setPaymentTxnId(null); }}
      />
    </div>
  );
};

export default WaCredit;
