import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, KeyRound, Loader2, Save, ShieldCheck, Webhook, Copy, Check, Eye, EyeOff, Zap, RefreshCw, QrCode, Store, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GatewayId = "mayar" | "doku";

const SuperAdminPaymentGateway = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<GatewayId | null>(null);

  // Per-channel gateway
  const [gatewayVa, setGatewayVa] = useState<GatewayId>("doku");
  const [gatewayQris, setGatewayQris] = useState<GatewayId>("mayar");
  const [gatewayRetail, setGatewayRetail] = useState<GatewayId>("doku");

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

  // Doku method overrides (per-channel)
  const [dokuVaMethods, setDokuVaMethods] = useState("");
  const [dokuQrisMethods, setDokuQrisMethods] = useState("");
  const [dokuRetailMethods, setDokuRetailMethods] = useState("");
  const [dokuWebhookVerify, setDokuWebhookVerify] = useState("true");

  const [copied, setCopied] = useState<string | null>(null);

  const mayarWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mayar-webhook`;
  const dokuNotifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doku-webhook`;

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
      const norm = (v: any): GatewayId => (v === "doku" ? "doku" : "mayar");
      setGatewayVa(norm(d.gateway_va));
      setGatewayQris(norm(d.gateway_qris));
      setGatewayRetail(norm(d.gateway_retail));
      setDokuEnv((d.doku_env === "sandbox" ? "sandbox" : "production"));
      setDokuClientMasked(d.doku_client_id_masked || "");
      setDokuSecretMasked(d.doku_secret_key_masked || "");
      setHasDokuClient(!!d.has_doku_client_id);
      setHasDokuSecret(!!d.has_doku_secret_key);
      setDokuVaMethods(d.doku_va_methods || "");
      setDokuQrisMethods(d.doku_qris_methods || "");
      setDokuRetailMethods(d.doku_retail_methods || "");
      setDokuWebhookVerify(d.doku_webhook_verify || "true");
    } catch (e: any) {
      toast.error("Gagal memuat: " + (e.message || "unknown"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveChannel = async (channel: "va" | "qris" | "retail", next: GatewayId) => {
    if (channel === "va") setGatewayVa(next);
    if (channel === "qris") setGatewayQris(next);
    if (channel === "retail") setGatewayRetail(next);
    setSaving(true);
    try {
      const key = channel === "va" ? "gateway_va" : channel === "qris" ? "gateway_qris" : "gateway_retail";
      const { data, error } = await supabase.functions.invoke("manage-payment-gateway", {
        body: { action: "set", updates: { [key]: next } },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const label = channel === "va" ? "Virtual Account" : channel === "qris" ? "QRIS" : "Retail";
      toast.success(`${label} → ${next.toUpperCase()}`);
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
      const updates: any = {
        doku_env: dokuEnv,
        doku_va_methods: dokuVaMethods.trim(),
        doku_qris_methods: dokuQrisMethods.trim(),
        doku_retail_methods: dokuRetailMethods.trim(),
        doku_webhook_verify: dokuWebhookVerify,
      };
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
          Kelola gateway pembayaran SPP wali murid per metode (VA, QRIS, Retail).
        </p>
      </div>

      {/* Per-Channel Gateway */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Gateway per Channel</h3>
              <p className="text-xs text-muted-foreground">Pilih gateway berbeda untuk setiap metode pembayaran</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              { key: "va" as const, label: "Virtual Account", desc: "BCA, Mandiri, BRI, BNI, BSI, Permata", icon: Banknote, value: gatewayVa },
              { key: "qris" as const, label: "QRIS", desc: "Semua e-wallet & mobile banking", icon: QrCode, value: gatewayQris },
              { key: "retail" as const, label: "Retail", desc: "Alfamart, Indomaret", icon: Store, value: gatewayRetail },
            ]).map(({ key, label, desc, icon: Icon, value }) => (
              <div key={key} className="rounded-xl border-2 border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                  </div>
                  <Badge className={`text-[10px] ${value === "doku" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                    {value.toUpperCase()}
                  </Badge>
                </div>
                <Select value={value} onValueChange={(v) => handleSaveChannel(key, v as GatewayId)} disabled={saving}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mayar">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Mayar</span>
                        {!mayarHasKey && <span className="text-[9px] text-amber-600">(no key)</span>}
                      </div>
                    </SelectItem>
                    <SelectItem value="doku">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Doku</span>
                        {!(hasDokuClient && hasDokuSecret) && <span className="text-[9px] text-amber-600">(belum lengkap)</span>}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Wali murid akan otomatis diarahkan ke gateway yang dipilih sesuai metode pembayaran mereka. Pastikan kredensial gateway terkait sudah terpasang di bawah.
          </p>
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


          {/* Method overrides */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-amber-900">Filter Metode Pembayaran per Channel</p>
              <p className="text-[10px] text-amber-800/80 mt-0.5">
                Ketik <code className="px-1 bg-white rounded">*</code> agar SEMUA metode aktif di Doku Dashboard tampil (rekomendasi kalau Mandiri / bank baru tidak muncul). Atau isi daftar dipisah koma, contoh: <code className="px-1 bg-white rounded">VIRTUAL_ACCOUNT_BCA,VIRTUAL_ACCOUNT_MANDIRI</code>. Kosong = pakai daftar default sistem.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label className="text-[11px]">VA Methods</Label>
                <Input value={dokuVaMethods} onChange={(e) => setDokuVaMethods(e.target.value)} placeholder="* atau kosong" className="font-mono text-[11px] h-8" />
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px]">QRIS Methods</Label>
                <Input value={dokuQrisMethods} onChange={(e) => setDokuQrisMethods(e.target.value)} placeholder="* atau kosong" className="font-mono text-[11px] h-8" />
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px]">Retail Methods</Label>
                <Input value={dokuRetailMethods} onChange={(e) => setDokuRetailMethods(e.target.value)} placeholder="* atau kosong" className="font-mono text-[11px] h-8" />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5"><Webhook className="h-3 w-3" /> Webhook URL Doku (WAJIB didaftarkan)</p>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-[11px] bg-background px-2 py-1 rounded border truncate flex-1">{dokuNotifyUrl}</code>
              <Button size="sm" variant="outline" className="h-7" onClick={() => copyUrl(dokuNotifyUrl, "doku")}>
                {copied === "doku" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Pasang di Doku Dashboard → Configurations → Notification URL. Untuk debug awal, set toggle di bawah ke "Nonaktif" agar signature tidak divalidasi.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-[10px]">Verifikasi signature webhook:</Label>
              <Select value={dokuWebhookVerify} onValueChange={setDokuWebhookVerify}>
                <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Nonaktif (debug)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
