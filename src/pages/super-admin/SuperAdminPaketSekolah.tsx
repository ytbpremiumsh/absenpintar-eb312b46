import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Package, RefreshCw, Settings2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SchoolRow {
  id: string; name: string; package_type: string; package_status: string;
  last_payment_activity_at: string | null; package_status_changed_at: string | null;
}

const FEATURE_OPTIONS = [
  { key: "attendance_create", label: "Buat Absensi Baru" },
  { key: "scan_qr", label: "Scan QR/Barcode" },
  { key: "face_recognition", label: "Face Recognition" },
  { key: "rfid", label: "RFID Attendance" },
];

export default function SuperAdminPaketSekolah() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState({ grace_period_days: 90, disabled_features: FEATURE_OPTIONS.map(f => f.key), mandiri_monthly_rate: 1000 });
  const [audit, setAudit] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: sc }, { data: st }, { data: ad }] = await Promise.all([
      supabase.from("schools").select("id, name, package_type, package_status, last_payment_activity_at, package_status_changed_at").order("name"),
      supabase.from("package_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("package_audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSchools((sc as any) || []);
    if (st) setSettings({
      grace_period_days: st.grace_period_days,
      disabled_features: (st.disabled_features as string[]) || [],
      mandiri_monthly_rate: Number(st.mandiri_monthly_rate),
    });
    setAudit(ad || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from("package_settings").update({
      grace_period_days: settings.grace_period_days,
      disabled_features: settings.disabled_features,
      mandiri_monthly_rate: settings.mandiri_monthly_rate,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Pengaturan tersimpan");
    setSavingSettings(false);
  };

  const reactivate = async (row: SchoolRow) => {
    const { error } = await supabase.from("schools").update({
      package_status: "active",
      package_status_changed_at: new Date().toISOString(),
      last_payment_activity_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("package_audit_log").insert({
      school_id: row.id, action: "reactivated",
      old_value: { package_status: row.package_status },
      new_value: { package_status: "active" },
      reason: "Diaktifkan manual oleh Super Admin", actor_user_id: user?.id,
    });
    toast.success("Sekolah diaktifkan kembali");
    fetchAll();
  };

  const changePackage = async (row: SchoolRow, newType: string) => {
    const { error } = await supabase.from("schools").update({ package_type: newType }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("package_audit_log").insert({
      school_id: row.id, action: "package_changed",
      old_value: { package_type: row.package_type },
      new_value: { package_type: newType },
      reason: "Diubah oleh Super Admin", actor_user_id: user?.id,
    });
    toast.success("Paket diubah");
    fetchAll();
  };

  const runCheck = async () => {
    const { error } = await supabase.functions.invoke("check-package-status");
    if (error) toast.error(error.message); else { toast.success("Cek status dijalankan"); fetchAll(); }
  };

  const filtered = schools.filter(s => {
    if (filter === "pending" && s.package_status !== "pending_activation") return false;
    if (filter === "active" && s.package_status !== "active") return false;
    if (filter === "mandiri" && s.package_type !== "mandiri") return false;
    if (filter === "payment" && s.package_type !== "payment") return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Manajemen Paket Sekolah" subtitle="Kelola paket ATSkolla Payment / Mandiri dan status aktivasi." icon={Package}
        actions={<Button onClick={runCheck} className="gap-2 bg-white text-slate-900 hover:bg-white/90"><RefreshCw className="h-4 w-4" /> Jalankan Cek Status</Button>} />

      <Card className="p-5 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4" /> <div className="font-semibold">Pengaturan Global</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Masa Tenggang (hari)</Label>
            <Input type="number" min={1} value={settings.grace_period_days}
              onChange={e => setSettings({ ...settings, grace_period_days: parseInt(e.target.value) || 90 })} />
          </div>
          <div>
            <Label>Biaya Mandiri / siswa / bulan (Rp)</Label>
            <Input type="number" min={0} value={settings.mandiri_monthly_rate}
              onChange={e => setSettings({ ...settings, mandiri_monthly_rate: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="md:col-span-1">
            <Label className="mb-2 block">Fitur yang Dinonaktifkan saat Menunggu Aktivasi</Label>
            <div className="space-y-1.5">
              {FEATURE_OPTIONS.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={settings.disabled_features.includes(f.key)} onCheckedChange={(c) => {
                    setSettings(s => ({
                      ...s,
                      disabled_features: c
                        ? [...s.disabled_features, f.key]
                        : s.disabled_features.filter(x => x !== f.key),
                    }));
                  }} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </div>
      </Card>

      <Card className="p-5 rounded-2xl">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="font-semibold">Daftar Sekolah ({filtered.length})</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input placeholder="Cari sekolah..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="active">Status: Aktif</SelectItem>
                <SelectItem value="pending">Status: Menunggu Aktivasi</SelectItem>
                <SelectItem value="payment">Paket: Payment</SelectItem>
                <SelectItem value="mandiri">Paket: Mandiri</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {loading ? <div className="text-sm text-muted-foreground">Memuat...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Sekolah</th>
                  <th className="text-left py-2 px-2">Paket</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Tanpa Payment</th>
                  <th className="text-right py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const ds = daysSince(s.last_payment_activity_at);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2.5 px-2 font-medium">{s.name}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline">{s.package_type === "payment" ? "Payment" : "Mandiri"}</Badge>
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge className={s.package_status === "active"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-amber-100 text-amber-700 border-amber-200"}>
                          {s.package_status === "active" ? "Aktif" : "Menunggu Aktivasi"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{ds !== null ? `${ds} hari` : "—"}</td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {s.package_status === "pending_activation" && (
                            <Button size="sm" variant="outline" onClick={() => reactivate(s)}>Aktifkan</Button>
                          )}
                          <Select value={s.package_type} onValueChange={(v) => changePackage(s, v)}>
                            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="payment">Payment</SelectItem>
                              <SelectItem value="mandiri">Mandiri</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-2xl">
        <div className="font-semibold mb-3">Audit Log (50 terakhir)</div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {audit.map(a => (
            <div key={a.id} className="text-xs border-b py-1.5 flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">{a.action}</Badge>
              <div className="flex-1">
                <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</div>
                <div>{a.reason || "-"}</div>
              </div>
            </div>
          ))}
          {audit.length === 0 && <div className="text-sm text-muted-foreground">Belum ada log</div>}
        </div>
      </Card>
    </div>
  );
}
