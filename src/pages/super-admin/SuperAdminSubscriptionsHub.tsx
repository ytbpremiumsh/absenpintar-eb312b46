import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateSubscriptionEnabledCache } from "@/hooks/useSubscriptionFeatures";
import { Loader2, Sparkles } from "lucide-react";
import SuperAdminPlans from "./SuperAdminPlans";
import SuperAdminSubscriptions from "./SuperAdminSubscriptions";
import SuperAdminAddons from "./SuperAdminAddons";

export default function SuperAdminSubscriptionsHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "plans";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "subscription_enabled").maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.value !== "false");
        setLoading(false);
      });
  }, []);

  const toggle = async (val: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "subscription_enabled", value: val ? "true" : "false", updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
    setEnabled(val);
    invalidateSubscriptionEnabledCache();
    toast.success(val
      ? "Sistem langganan diaktifkan"
      : "Sistem langganan dinonaktifkan — semua sekolah kini otomatis Premium unlimited");
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Sistem Langganan Global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Label className="text-sm font-semibold">
                {enabled ? "Sistem Langganan Aktif" : "Sistem Langganan Nonaktif — Semua Sekolah Premium"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Bila dinonaktifkan, seluruh sekolah otomatis mendapatkan akses fitur tertinggi (Premium) tanpa perlu bayar.
                Data pembayaran & langganan yang sudah ada tidak dihapus.
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch checked={enabled} disabled={saving} onCheckedChange={toggle} />
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="plans" className="rounded-lg">Paket Langganan</TabsTrigger>
          <TabsTrigger value="schools" className="rounded-lg">Langganan Sekolah</TabsTrigger>
          <TabsTrigger value="addons" className="rounded-lg">Add-on</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4"><SuperAdminPlans /></TabsContent>
        <TabsContent value="schools" className="mt-4"><SuperAdminSubscriptions /></TabsContent>
        <TabsContent value="addons" className="mt-4"><SuperAdminAddons /></TabsContent>
      </Tabs>
    </div>
  );
}
