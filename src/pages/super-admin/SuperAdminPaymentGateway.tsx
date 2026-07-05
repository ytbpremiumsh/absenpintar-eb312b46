import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, KeyRound, Loader2, Save, ShieldCheck, Webhook, Copy, Check, Eye, EyeOff, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GatewayId = "mayar" | "doku";

const SuperAdminPaymentGateway = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<GatewayId | null>(null);

  // Active gateway
  const [gateway, setGateway] = useState<GatewayId>("mayar");

  // Mayar
  const [mayarMasked, setMayarMasked] = useState("");
  const [mayarHasKey, setMayarHasKey] = useState(false);
  const [showMayarDialog, setShowMayarDialog] = useState(false);
  const [mayarInput, setMayarInput] = useState("");
  const [showMayarKey, setShowMayarKey] = useState(false);

  // Doku
  const [dokuEnv, setDokuEnv] = useState<"production" | "sandbox">("production");
  const [dokuClientId, setDokuClientId] = useState("");
  const [dokuSecretKey, setDokuSecretKey] = useState("");
  const [dokuClientMasked, setDokuClientMasked] = useState("");
  const [dokuSecretMasked, setDokuSecretMasked] = useState("");
  const [hasDokuClient, setHasDokuClient] = useState(false);
  const [hasDokuSecret, setHasDokuSecret] = useState(false);
  const [showDokuSecret, setShowDokuSecret] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  const mayarWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mayar-webhook`;
  const dokuNotifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spp-doku`;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mayarRes, dokuRes] = await Promise.all([
        supabase.functions.invoke("manage-mayar-key", { body: { action: "get" } }),
        supabase.functions.invoke("manage-payment-gateway", { body: { action: "get" } }),
      ]);
      const m: any = mayarRes.data || {};
      setMayarMasked(m.masked_key || "");
      setMayarHasKey(!!m.has_key);

      const d: any = dokuRes.data || {};
      setGateway((d.active_payment_gateway === "doku" ? "doku" : "mayar") as GatewayId);
      setDokuEnv((d.doku_env === "sandbox" ? "sandbox" : "production"));
      setDokuClientMasked(d.doku_client_id_masked || "");
      setDokuSecretMasked(d.doku_secret_key_masked || "");
      setHasDokuClient(!!d.has_doku_client_id);
      setHasDokuSecret(!!d.has_doku_secret_key);
    } catch (e: any) {
      toast.error("Gagal memuat: " + (e.message || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveGateway = async (next: GatewayId) => {
    setGateway(next);
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-gateway", {
        body: { action: "set", updates: { active_payment_gateway: next } },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`Gateway aktif: ${next.toUpperCase()}`);
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMayar = async () => {
    if (!mayarInput.trim()) return toast.error("API Key wajib diisi");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-mayar-key", {
        body: { action: "set", api_key: mayarInput.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("API Key Mayar tersimpan");
      setShowMayarDialog(false);
      setMayarInput("");
      fetchAll();
    } catch (e: any) {
      toast.error("Gagal: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDoku = async () => {
    setSaving(true);
    try {
      const updates: any = { doku_env: dokuEnv };
      if (dokuClientId.trim()) updates.doku_client_id = dokuClientId.trim();
      if (dokuSecretKey.trim()) updates.doku_secret_key = dokuSecretKey.trim();
      const { data, error } = await supabase.functions.invoke("manage-payment-gateway", {
        body: { action: "set", updates },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("Kredensial Doku tersimpan");
      setDokuClientId("");
      setDokuSecretKey("");
      fetchAll();
    } catch (e: any) {
      toast.error("Gagal: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (gw: GatewayId) => {
    setTesting(gw);
    try {
      const fn = gw === "doku" ? "spp-doku" : "spp-mayar";
      const { data, error } = await supabase.functions.invoke(fn, { body: { action: "test_connection" } });
      if (error) throw error;
      const d: any = data;
      if (d?.connected) toast.success(`${gw.toUpperCase()} terhubung: ${d.message || "OK"}`);
      else toast.error(`${gw.toUpperCase()} gagal: ${d?.message || "tidak terkoneksi"}`);
    } catch (e: any) {
      toast.error("Test gagal: " + e.message);
    } finally {
      setTesting(null);
    }
  };

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopied(key);
    toast.success("URL disalin");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment Gateway</h1>
        <p className="text-muted-foreground text-sm">
          Kelola gateway pembayaran SPP wali murid. Hanya satu gateway aktif dalam satu waktu.
        </p>
      </div>

      {/* Toggle Aktif */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Gateway Aktif</h3>
              <p className="text-xs text-muted-foreground">Berlaku untuk semua sekolah</p>
            </div>
            <Badge className="ml-auto bg-primary text-primary-foreground">{gateway.toUpperCase()}</Badge>
          </div>

          <RadioGroup
            value={gateway}
            onValueChange={(v) => handleSaveGateway(v as GatewayId)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <label
              className={`cursor-pointer rounded-xl border-2 p-4 transition ${gateway === "mayar" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="mayar" id="gw-mayar" className="mt-1" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Mayar</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Payment link Mayar.id — QRIS, VA, e-wallet</p>
                  {mayarHasKey ? (
                    <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-[10px]">Key terpasang</Badge>
                  ) : (
                    <Badge className="mt-2 bg-amber-100 text-amber-800 text-[10px]">Belum ada key</Badge>
                  )}
                </div>
              </div>
            </label>

            <label
              className={`cursor-pointer rounded-xl border-2 p-4 transition ${gateway === "doku" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="doku" id="gw-doku" className="mt-1" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Doku</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Doku Jokul Checkout — VA (BCA, Mandiri, BRI, BNI, BSI, Permata), QRIS, Retail</p>
                  {hasDokuClient && hasDokuSecret ? (
                    <Badge className="mt-2 bg-emerald-100 text-emerald-700 text-[10px]">Kredensial lengkap</Badge>
                  ) : (
                    <Badge className="mt-2 bg-amber-100 text-amber-800 text-[10px]">Belum lengkap</Badge>
                  )}
                </div>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* MAYAR CONFIG */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Konfigurasi Mayar</h3>
              <p className="text-xs text-muted-foreground">Payment link Mayar.id</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleTest("mayar")} disabled={testing === "mayar"}>
              {testing === "mayar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              <span className="ml-1">Test</span>
            </Button>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">API Key</Label>
            <div className="flex gap-2">
              <Input readOnly value={mayarMasked || "(belum di-set)"} className="font-mono text-xs bg-secondary/50" />
              <Button variant="outline" onClick={() => setShowMayarDialog(true)}>
                <KeyRound className="h-4 w-4 mr-1" />
                {mayarHasKey ? "Ubah" : "Set"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5"><Webhook className="h-3 w-3" /> Webhook URL Mayar</p>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-[11px] bg-background px-2 py-1 rounded border truncate flex-1">{mayarWebhookUrl}</code>
              <Button size="sm" variant="outline" className="h-7" onClick={() => copyUrl(mayarWebhookUrl, "mayar")}>
                {copied === "mayar" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DOKU CONFIG */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Konfigurasi Doku Jokul</h3>
              <p className="text-xs text-muted-foreground">Kredensial dari dashboard Doku → Integrasi → API</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleTest("doku")} disabled={testing === "doku"}>
              {testing === "doku" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              <span className="ml-1">Test</span>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Environment</Label>
              <RadioGroup value={dokuEnv} onValueChange={(v) => setDokuEnv(v as any)} className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="production" id="env-prod" /> Production
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="sandbox" id="env-sb" /> Sandbox
                </label>
              </RadioGroup>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <div className="flex gap-2 flex-wrap">
                <Badge className={hasDokuClient ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                  Client ID {hasDokuClient ? "✓" : "kosong"}
                </Badge>
                <Badge className={hasDokuSecret ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                  Secret Key {hasDokuSecret ? "✓" : "kosong"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Client ID {hasDokuClient && <span className="text-muted-foreground">(saat ini: {dokuClientMasked})</span>}</Label>
            <Input
              value={dokuClientId}
              onChange={(e) => setDokuClientId(e.target.value)}
              placeholder={hasDokuClient ? "Kosongkan bila tidak diubah" : "MCH-0001-XXXXXXX"}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Secret Key {hasDokuSecret && <span className="text-muted-foreground">(saat ini: {dokuSecretMasked})</span>}</Label>
            <div className="flex gap-2">
              <Input
                type={showDokuSecret ? "text" : "password"}
                value={dokuSecretKey}
                onChange={(e) => setDokuSecretKey(e.target.value)}
                placeholder={hasDokuSecret ? "Kosongkan bila tidak diubah" : "SK-XXXXXXXXXXXXXXXX"}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={() => setShowDokuSecret((v) => !v)}>
                {showDokuSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5"><Webhook className="h-3 w-3" /> Notify URL Doku (opsional untuk auto-sync)</p>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-[11px] bg-background px-2 py-1 rounded border truncate flex-1">{dokuNotifyUrl}</code>
              <Button size="sm" variant="outline" className="h-7" onClick={() => copyUrl(dokuNotifyUrl, "doku")}>
                {copied === "doku" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Pasang di Doku Dashboard → Configurations → Notification URL. Verifikasi pembayaran juga otomatis via tombol sinkronisasi.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={fetchAll} disabled={saving}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reload
            </Button>
            <Button onClick={handleSaveDoku} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Simpan Doku
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mayar Key dialog */}
      <Dialog open={showMayarDialog} onOpenChange={setShowMayarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah API Key Mayar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">API Key Baru</Label>
              <div className="flex gap-2">
                <Input
                  type={showMayarKey ? "text" : "password"}
                  value={mayarInput}
                  onChange={(e) => setMayarInput(e.target.value)}
                  placeholder="mayar_pk_live_..."
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => setShowMayarKey((v) => !v)}>
                  {showMayarKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ambil dari dashboard Mayar → Settings → API Keys. Key akan langsung dipakai untuk pembayaran berikutnya.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMayarDialog(false)}>Batal</Button>
            <Button onClick={handleSaveMayar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPaymentGateway;
