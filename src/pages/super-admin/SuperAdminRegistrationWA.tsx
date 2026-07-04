import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Send, MessageSquare, Info, Smartphone, Settings2, Power, QrCode, Wifi, WifiOff, RefreshCw, Unplug, BellRing, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const SuperAdminRegistrationWA = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [activeTab, setActiveTab] = useState("onesender");
  const [settings, setSettings] = useState({
    wa_registration_enabled: "false",
    wa_api_url: "",
    wa_api_key: "",
    wa_registration_message: "",
    mpwa_platform_api_key: "",
    mpwa_platform_sender: "",
    mpwa_platform_connected: "false",
    onesender_enabled: "true",
    admin_notify_phone: "",
    admin_notify_enabled: "false",
    admin_notify_ticket_template: "",
    admin_notify_withdrawal_template: "",
    admin_notify_bendahara_template: "",
  });
  const [adminTesting, setAdminTesting] = useState<"ticket" | "withdrawal" | "bendahara" | null>(null);

  // QR state
  const [mpwaNumber, setMpwaNumber] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = settings.mpwa_platform_connected === "true";

  useEffect(() => {
    fetchSettings();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("platform_settings" as any)
      .select("key, value")
      .in("key", [
        "wa_registration_enabled", "wa_api_url", "wa_api_key", "wa_registration_message",
        "mpwa_platform_api_key", "mpwa_platform_sender", "mpwa_platform_connected", "onesender_enabled",
        "admin_notify_phone", "admin_notify_enabled",
        "admin_notify_ticket_template", "admin_notify_withdrawal_template",
        "admin_notify_bendahara_template",
      ]);

    const map: Record<string, string> = {};
    ((data as any[]) || []).forEach((item) => { map[item.key] = item.value; });
    setSettings((prev) => ({ ...prev, ...map }));
    if (map.mpwa_platform_sender) setMpwaNumber(map.mpwa_platform_sender);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const keys = Object.keys(settings) as (keyof typeof settings)[];
    const rows = keys.map((key) => ({
      key,
      value: settings[key],
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("platform_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success("Pengaturan berhasil disimpan!");
    }
    setSaving(false);
  };

  // ═══ MPWA QR Functions ═══
  const handleGenerateQR = async () => {
    const cleanNumber = mpwaNumber.replace(/\D/g, "");
    if (!cleanNumber) { toast.error("Masukkan nomor WhatsApp"); return; }
    if (!settings.mpwa_platform_api_key) { toast.error("MPWA API Key harus diisi terlebih dahulu"); return; }

    setQrLoading(true);
    setQrCode(null);

    try {
      // Save API key and sender to platform_settings first
      await supabase.from("platform_settings").upsert([
        { key: "mpwa_platform_sender", value: cleanNumber, updated_at: new Date().toISOString() },
        { key: "mpwa_platform_api_key", value: settings.mpwa_platform_api_key, updated_at: new Date().toISOString() },
      ], { onConflict: "key" });
      setSettings(prev => ({ ...prev, mpwa_platform_sender: cleanNumber }));

      // Use mpwa-proxy edge function to avoid CORS
      const { data, error } = await supabase.functions.invoke("mpwa-proxy", {
        body: {
          action: "generate-qr",
          school_id: "__platform__",
          number: cleanNumber,
        },
      });

      if (error) throw error;
      console.log("[SuperAdmin MPWA] generate-qr response:", JSON.stringify(data).substring(0, 300));

      if (data?.connected) {
        await markPlatformConnected(true);
        toast.success("Device sudah terhubung!");
        setQrLoading(false);
        return;
      }

      const qr = data?.qrcode || data?.img || data?.qr || null;
      if (qr) {
        setQrCode(qr);
        startPolling(cleanNumber);
        toast.info("Scan QR Code dengan WhatsApp Anda");
      } else {
        toast.error(data?.error || data?.msg || data?.message || "Gagal generate QR code");
      }
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Gagal terhubung ke MPWA"));
    }
    setQrLoading(false);
  };

  const startPolling = (deviceNumber: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        setQrCode(null);
        toast.error("QR Code expired. Silakan generate ulang.");
        return;
      }

      try {
        const { data } = await supabase.functions.invoke("mpwa-proxy", {
          body: {
            action: "check-status",
            school_id: "__platform__",
            number: deviceNumber,
          },
        });

        if (data?.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setQrCode(null);
          await markPlatformConnected(true);
          toast.success("WhatsApp Platform berhasil terhubung!");
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
  };

  const handleCheckStatus = async () => {
    const device = settings.mpwa_platform_sender || mpwaNumber.replace(/\D/g, "");
    if (!device) { toast.error("Nomor sender belum dikonfigurasi"); return; }

    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpwa-proxy", {
        body: {
          action: "check-status",
          school_id: "__platform__",
          number: device,
        },
      });

      if (error) throw error;

      if (data?.connected) {
        await markPlatformConnected(true);
        toast.success("Device terhubung!");
      } else {
        await markPlatformConnected(false);
        toast.warning("Device belum terhubung");
      }
    } catch (err: any) {
      toast.error("Gagal cek status: " + err.message);
    }
    setCheckingStatus(false);
  };

  const handleDisconnect = async () => {
    const device = settings.mpwa_platform_sender;
    if (!device) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("mpwa-proxy", {
        body: {
          action: "disconnect",
          school_id: "__platform__",
          number: device,
        },
      });
      if (error) throw error;
      await markPlatformConnected(false);
      toast.success("Device berhasil di-disconnect");
    } catch (err: any) {
      toast.error("Gagal disconnect: " + err.message);
    }
    setDisconnecting(false);
  };

  const markPlatformConnected = async (connected: boolean) => {
    await supabase.from("platform_settings").upsert([
      { key: "mpwa_platform_connected", value: connected ? "true" : "false", updated_at: new Date().toISOString() },
    ], { onConflict: "key" });
    setSettings(prev => ({ ...prev, mpwa_platform_connected: connected ? "true" : "false" }));
  };

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error("Masukkan nomor WhatsApp tujuan"); return; }

    if (activeTab === "onesender") {
      if (!settings.wa_api_url || !settings.wa_api_key) { toast.error("API URL dan API Key OneSender harus diisi"); return; }
    } else {
      if (!settings.mpwa_platform_api_key || !settings.mpwa_platform_sender) {
        toast.error("API Key dan Sender MPWA harus dikonfigurasi");
        return;
      }
      if (!isConnected) {
        toast.error("Device MPWA belum terhubung. Scan QR terlebih dahulu.");
        return;
      }
    }

    setTesting(true);
    try {
      const message = settings.wa_registration_message
        .replace(/{name}/g, "Admin Test")
        .replace(/{school}/g, "Sekolah Test")
        .replace(/{email}/g, "test@sekolah.com") || "✅ Tes koneksi WhatsApp Gateway berhasil!";

      let formattedPhone = testPhone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) formattedPhone = "62" + formattedPhone.substring(1);

      if (activeTab === "mpwa") {
        // Send via edge function to avoid CORS
        const res = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: formattedPhone,
            message,
            gateway: "mpwa",
            mpwa_api_key: settings.mpwa_platform_api_key,
            mpwa_sender: settings.mpwa_platform_sender,
          },
        });
        const data = res.data as any;
        if (data?.success) {
          toast.success("Pesan tes MPWA berhasil dikirim!");
        } else {
          toast.error("Gagal: " + (data?.error || "Unknown error"));
        }
      } else {
        const body = {
          phone: formattedPhone,
          message,
          api_url: settings.wa_api_url,
          api_key: settings.wa_api_key,
        };
        const res = await supabase.functions.invoke("send-whatsapp", { body });
        const data = res.data as any;
        if (data?.success) {
          toast.success("Pesan tes berhasil dikirim!");
        } else {
          toast.error("Gagal: " + (data?.error || "Unknown error"));
        }
      }
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Unknown error"));
    }
    setTesting(false);
  };

  const handleToggleOnesender = (val: boolean) => {
    setSettings(prev => ({ ...prev, onesender_enabled: val ? "true" : "false" }));
  };

  const handleTestAdminNotify = async (kind: "ticket" | "withdrawal" | "bendahara") => {
    if (!settings.admin_notify_phone.trim()) {
      toast.error("Nomor admin tujuan wajib diisi terlebih dahulu");
      return;
    }
    // Save current settings first so edge function reads latest values
    setAdminTesting(kind);
    try {
      const rows = [
        { key: "admin_notify_phone", value: settings.admin_notify_phone, updated_at: new Date().toISOString() },
        { key: "admin_notify_enabled", value: settings.admin_notify_enabled, updated_at: new Date().toISOString() },
        { key: "admin_notify_ticket_template", value: settings.admin_notify_ticket_template, updated_at: new Date().toISOString() },
        { key: "admin_notify_withdrawal_template", value: settings.admin_notify_withdrawal_template, updated_at: new Date().toISOString() },
        { key: "admin_notify_bendahara_template", value: settings.admin_notify_bendahara_template, updated_at: new Date().toISOString() },
      ];
      await supabase.from("platform_settings").upsert(rows, { onConflict: "key" });

      let samplePayload: Record<string, any>;
      let eventType: string;
      let label: string;
      if (kind === "ticket") {
        eventType = "support_ticket";
        label = "Tiket Bantuan";
        samplePayload = { school: "SDN 1 Jakarta", user: "Budi Santoso", priority: "high", subject: "Tidak bisa scan QR", message: "Ini hanya tes notifikasi tiket bantuan." };
      } else if (kind === "withdrawal") {
        eventType = "withdrawal_request";
        label = "Pencairan Affiliate";
        samplePayload = { affiliate: "Pak Guru", email: "guru@contoh.com", amount: 750000, bank: "BCA", account_number: "1234567890", account_holder: "Pak Guru" };
      } else {
        eventType = "bendahara_settlement";
        label = "Pencairan Bendahara";
        samplePayload = {
          school: "SDN 1 Jakarta", requester: "Bendahara Sekolah", settlement_code: "STL-20260506-001",
          total_transactions: 24, total_gross: 12000000, total_gateway_fee: 360000, total_net: 11640000,
          withdraw_fee: 3000, final_payout: 11637000,
          bank: "BCA", account_number: "1234567890", account_holder: "SDN 1 Jakarta",
          notes: "Pencairan SPP minggu ke-2",
        };
      }

      const { data, error } = await supabase.functions.invoke("notify-admin-wa", {
        body: { event_type: eventType, payload: samplePayload },
      });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success(`Notifikasi tes (${label}) terkirim ke ${settings.admin_notify_phone}`);
      } else {
        toast.error("Gagal: " + ((data as any)?.error || "tidak diketahui"));
      }
    } catch (err: any) {
      toast.error("Gagal kirim tes: " + (err.message || err));
    }
    setAdminTesting(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const osEnabled = settings.onesender_enabled !== "false";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Konfigurasi API WA
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Pengaturan API OneSender & MPWA untuk platform</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan
        </Button>
      </div>

      {/* Enable/Disable WA Registrasi */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Aktifkan Notifikasi Registrasi</h3>
              <p className="text-xs text-muted-foreground">Kirim pesan WhatsApp otomatis ke nomor admin yang mendaftar</p>
            </div>
            <Switch
              checked={settings.wa_registration_enabled === "true"}
              onCheckedChange={(v) => setSettings({ ...settings, wa_registration_enabled: v ? "true" : "false" })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Enable/Disable OneSender for schools */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${osEnabled ? "bg-primary/10" : "bg-muted"}`}>
                <Power className={`h-4 w-4 ${osEnabled ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Gateway OneSender (WASkolla Sistem)</h3>
                <p className="text-xs text-muted-foreground">
                  {osEnabled
                    ? "Aktif — sekolah dapat memilih OneSender atau MPWA di dashboard mereka"
                    : "Nonaktif — sekolah hanya dapat menggunakan MPWA (WASkolla Scan Sendiri)"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`text-[10px] ${osEnabled ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                {osEnabled ? "Aktif" : "Nonaktif"}
              </Badge>
              <Switch checked={osEnabled} onCheckedChange={handleToggleOnesender} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Settings - Tabbed */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="font-bold text-foreground text-sm">Pengaturan API WhatsApp</h3>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="onesender" className="text-xs sm:text-sm gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                OneSender
              </TabsTrigger>
              <TabsTrigger value="mpwa" className="text-xs sm:text-sm gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                MPWA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="onesender" className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[11px] text-muted-foreground">
                  OneSender digunakan sebagai gateway utama sistem ATSkolla. Konfigurasi ini berlaku untuk notifikasi registrasi platform.
                  {!osEnabled && (
                    <span className="block mt-1 text-amber-600 font-semibold">
                      Gateway OneSender saat ini dinonaktifkan. Sekolah tidak dapat menggunakan OneSender.
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">API URL</Label>
                <Input
                  value={settings.wa_api_url}
                  onChange={(e) => setSettings({ ...settings, wa_api_url: e.target.value })}
                  placeholder="http://proxy.onesender.net/api/v1/messages"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">API Key / Token</Label>
                <Input
                  type="password"
                  value={settings.wa_api_key}
                  onChange={(e) => setSettings({ ...settings, wa_api_key: e.target.value })}
                  placeholder="Masukkan API Key OneSender"
                />
              </div>
            </TabsContent>

            <TabsContent value="mpwa" className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[11px] text-muted-foreground">
                  MPWA digunakan untuk mengirim pesan platform (registrasi, OTP) dan juga sebagai fallback global untuk sekolah. Hubungkan nomor WhatsApp di bawah ini agar bisa mengirim pesan.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MPWA API Key (Global)</Label>
                <Input
                  type="password"
                  value={settings.mpwa_platform_api_key}
                  onChange={(e) => setSettings({ ...settings, mpwa_platform_api_key: e.target.value })}
                  placeholder="API Key dari MPWA (app.ayopintar.com)"
                />
              </div>

              {/* ═══ MPWA QR Scan Section ═══ */}
              <Card className="border border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary" />
                      <h4 className="font-bold text-sm text-foreground">Hubungkan WhatsApp Platform</h4>
                    </div>
                    <Badge className={`text-[10px] gap-1 ${isConnected ? "bg-success/10 text-success border-success/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                      {isConnected ? <><Wifi className="h-2.5 w-2.5" /> Connected</> : <><WifiOff className="h-2.5 w-2.5" /> Disconnected</>}
                    </Badge>
                  </div>

                  {!isConnected && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Nomor WhatsApp Platform</Label>
                        <div className="flex gap-2">
                          <Input
                            value={mpwaNumber}
                            onChange={(e) => setMpwaNumber(e.target.value)}
                            placeholder="628123456789"
                            className="flex-1"
                          />
                          <Button onClick={handleGenerateQR} disabled={qrLoading} size="sm" className="gradient-primary text-primary-foreground">
                            {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                            <span className="ml-1.5 hidden sm:inline">Generate QR</span>
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Nomor ini digunakan untuk mengirim OTP, notifikasi registrasi, dan pesan platform lainnya</p>
                      </div>

                      {qrCode && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-3 py-4"
                        >
                          <div className="bg-white p-4 rounded-xl shadow-lg">
                            <img
                              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                              alt="QR Code"
                              className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                            />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-xs font-semibold text-foreground">Scan QR Code dengan WhatsApp</p>
                            <p className="text-[10px] text-muted-foreground">Buka WhatsApp → Menu (⋮) → Linked Devices → Link a Device</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] text-muted-foreground">Menunggu scan...</span>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}

                  {isConnected && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                        <Wifi className="h-5 w-5 text-success" />
                        <div>
                          <p className="text-sm font-semibold text-success">WhatsApp Platform Terhubung</p>
                          <p className="text-[11px] text-muted-foreground">Sender: {settings.mpwa_platform_sender}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checkingStatus} className="text-xs">
                      {checkingStatus ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                      Cek Status
                    </Button>
                    {isConnected && (
                      <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-xs text-destructive hover:text-destructive">
                        {disconnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Unplug className="h-3.5 w-3.5 mr-1" />}
                        Disconnect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ═══ Notifikasi WA Admin (Tiket Bantuan & Pencairan) ═══ */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BellRing className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Notifikasi WA Admin</h3>
                <p className="text-xs text-muted-foreground">
                  Kirim WhatsApp otomatis ke admin saat ada Tiket Bantuan, Pencairan Dana Affiliate, atau Pencairan Dana Bendahara
                </p>
              </div>
            </div>
            <Switch
              checked={settings.admin_notify_enabled === "true"}
              onCheckedChange={(v) => setSettings({ ...settings, admin_notify_enabled: v ? "true" : "false" })}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nomor WhatsApp Admin Tujuan</Label>
            <Input
              value={settings.admin_notify_phone}
              onChange={(e) => setSettings({ ...settings, admin_notify_phone: e.target.value })}
              placeholder="089501123808"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: 08xx atau 628xx — semua tiket bantuan & pencairan akan dikirim ke nomor ini
            </p>
          </div>

          {/* Template Tiket Bantuan */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <Label className="text-xs font-semibold">Template Tiket Bantuan</Label>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={adminTesting !== null}
                onClick={() => handleTestAdminNotify("ticket")}
              >
                {adminTesting === "ticket" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                Tes Kirim
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {["{school}", "{user}", "{priority}", "{subject}", "{message}", "{time}"].map((v) => (
                <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
              ))}
            </div>
            <Textarea
              value={settings.admin_notify_ticket_template}
              onChange={(e) => setSettings({ ...settings, admin_notify_ticket_template: e.target.value })}
              rows={6}
              className="resize-none font-mono text-xs"
              placeholder="Tiket Bantuan Baru..."
            />
          </div>


          {/* Template Pencairan Bendahara Sekolah */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                <Label className="text-xs font-semibold">Template Pencairan Dana — Bendahara Sekolah (SPP)</Label>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={adminTesting !== null}
                onClick={() => handleTestAdminNotify("bendahara")}
              >
                {adminTesting === "bendahara" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                Tes Kirim
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {["{school}", "{requester}", "{settlement_code}", "{total_transactions}", "{total_gross}", "{total_gateway_fee}", "{total_net}", "{withdraw_fee}", "{final_payout}", "{bank}", "{account_number}", "{account_holder}", "{notes}", "{time}"].map((v) => (
                <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
              ))}
            </div>
            <Textarea
              value={settings.admin_notify_bendahara_template}
              onChange={(e) => setSettings({ ...settings, admin_notify_bendahara_template: e.target.value })}
              rows={8}
              className="resize-none font-mono text-xs"
              placeholder="Pencairan Dana Bendahara..."
            />
            <p className="text-[10px] text-muted-foreground">
              <Info className="h-3 w-3 inline mr-1" />
              Semua field nominal otomatis diformat ke Rupiah. Trigger aktif saat Bendahara mengajukan pencairan SPP.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-muted-foreground">
              Notifikasi dikirim melalui MPWA (utama) atau OneSender (fallback). Pastikan minimal salah satu gateway sudah terhubung.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Message Template */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="font-bold text-foreground text-sm">Template Pesan Registrasi</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="secondary" className="text-[10px]">{"{name}"} = Nama Admin</Badge>
            <Badge variant="secondary" className="text-[10px]">{"{school}"} = Nama Sekolah</Badge>
            <Badge variant="secondary" className="text-[10px]">{"{email}"} = Email</Badge>
          </div>
          <Textarea
            value={settings.wa_registration_message}
            onChange={(e) => setSettings({ ...settings, wa_registration_message: e.target.value })}
            rows={8}
            className="resize-none font-mono text-sm"
            placeholder="Masukkan template pesan..."
          />
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Preview:</p>
            <p className="text-xs text-foreground whitespace-pre-wrap">
              {(settings.wa_registration_message || "Belum ada template")
                .replace(/{name}/g, "Budi Santoso")
                .replace(/{school}/g, "SDN 1 Jakarta")
                .replace(/{email}/g, "budi@sdn1jakarta.sch.id")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h3 className="font-bold text-foreground text-sm">Tes Kirim Pesan</h3>
          <p className="text-[11px] text-muted-foreground">
            Tes menggunakan gateway: <span className="font-semibold">{activeTab === "mpwa" ? "MPWA" : "OneSender"}</span>
            {activeTab === "mpwa" && !isConnected && (
              <span className="text-amber-600 ml-1">(Device belum terhubung)</span>
            )}
          </p>
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="6281234567890"
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Kirim Tes
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Masukkan nomor WhatsApp dengan format internasional (62...)</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminRegistrationWA;
