import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Save, RefreshCw, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function SuperAdminMpwaApiKey() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [currentMasked, setCurrentMasked] = useState("");
  const [sender, setSender] = useState("");
  const [connected, setConnected] = useState(false);
  const [show, setShow] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["mpwa_platform_api_key", "mpwa_platform_sender", "mpwa_platform_connected"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
    const key = map.mpwa_platform_api_key || "";
    setApiKey("");
    setCurrentMasked(key ? key.slice(0, 4) + "••••••••" + key.slice(-4) : "");
    setSender(map.mpwa_platform_sender || "");
    setConnected(map.mpwa_platform_connected === "true");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { toast.error("API Key tidak boleh kosong"); return; }
    if (trimmed.length < 10) { toast.error("API Key terlalu pendek"); return; }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("platform_settings").select("id").eq("key", "mpwa_platform_api_key").maybeSingle();
      if (existing) {
        await supabase.from("platform_settings")
          .update({ value: trimmed, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("platform_settings").insert({ key: "mpwa_platform_api_key", value: trimmed });
      }
      toast.success("API Key MPWA berhasil diperbarui");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">MPWA API Key (Global)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola / reset API Key MPWA yang dipakai untuk OTP, registrasi & pesan platform.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/40 border">
              <div className="text-[11px] text-muted-foreground">API Key aktif</div>
              <div className="text-sm font-mono mt-1">
                {loading ? "Memuat..." : (currentMasked || <span className="text-amber-600">Belum diset</span>)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border">
              <div className="text-[11px] text-muted-foreground">Sender & Status</div>
              <div className="text-sm mt-1 flex items-center gap-2">
                <span className="font-mono">{sender || "—"}</span>
                <Badge className={connected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                  {connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">API Key Baru</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Tempel API Key MPWA dari app.ayopintar.com"
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={save} disabled={saving || !apiKey.trim()}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Nilai lama akan ditimpa sepenuhnya. Kosongkan field untuk membatalkan.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
              Setelah reset, sesi WhatsApp yang lama bisa terputus. Lakukan scan ulang di tab
              <span className="font-semibold"> Aktivasi Sekolah</span> jika status menjadi Disconnected.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
