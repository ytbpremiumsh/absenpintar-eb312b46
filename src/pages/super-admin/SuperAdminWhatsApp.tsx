import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Save, Loader2, Send, School, Pencil, Plus, Smartphone, Wifi, WifiOff, ArrowDownToLine, ArrowUpFromLine, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface IntegrationData {
  id: string;
  school_id: string;
  school_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
  message_template: string;
  attendance_arrive_template: string;
  attendance_depart_template: string;
  attendance_group_template: string;
  wa_delivery_target: string;
  wa_enabled: boolean;
  gateway_type: string;
  mpwa_api_key: string;
  mpwa_sender: string;
  mpwa_connected: boolean;
}

const FOOTER = `─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;
const DEFAULT_ARRIVE_TEMPLATE = `*Notifikasi Kehadiran Siswa*\n\nYth. Bapak/Ibu Wali Murid,\n\nDengan hormat kami sampaikan bahwa ananda *{student_name}* (Kelas {class}) telah tercatat *HADIR* di sekolah pada hari {day}, pukul {time}.\n\nDetail Kehadiran:\n• NIS       : {student_id}\n• Metode : {method}\n• Sekolah : {school_name}\n\nTerima kasih atas perhatian Bapak/Ibu.\n\n${FOOTER}`;
const DEFAULT_DEPART_TEMPLATE = `*Notifikasi Kepulangan Siswa*\n\nYth. Bapak/Ibu Wali Murid,\n\nDengan hormat kami sampaikan bahwa ananda *{student_name}* (Kelas {class}) telah tercatat *PULANG* dari sekolah pada hari {day}, pukul {time}.\n\nDetail Kepulangan:\n• NIS       : {student_id}\n• Metode : {method}\n• Sekolah : {school_name}\n\nTerima kasih atas perhatian Bapak/Ibu.\n\n${FOOTER}`;
const DEFAULT_GROUP_TEMPLATE = `*Notifikasi Absensi {type}*\n\n{school_name}\n\nSiswa *{student_name}* (Kelas {class}) telah tercatat {type} pada hari {day}, pukul {time}.\n\nMetode: {method}\n\n${FOOTER}`;

const ATTENDANCE_PLACEHOLDERS = [
  { key: "{student_name}", label: "Nama Siswa" },
  { key: "{class}", label: "Kelas" },
  { key: "{time}", label: "Waktu" },
  { key: "{day}", label: "Nama Hari" },
  { key: "{student_id}", label: "NIS" },
  { key: "{method}", label: "Metode Absen" },
  { key: "{parent_name}", label: "Nama Wali" },
  { key: "{school_name}", label: "Nama Sekolah" },
];

const GROUP_PLACEHOLDERS = [
  ...ATTENDANCE_PLACEHOLDERS,
  { key: "{type}", label: "Tipe (Datang/Pulang)" },
];

const PlaceholderButtons = ({ placeholders, onInsert }: { placeholders: typeof ATTENDANCE_PLACEHOLDERS; onInsert: (key: string) => void }) => (
  <div className="flex flex-wrap gap-1 mt-2">
    {placeholders.map((p) => (
      <button
        key={p.key}
        type="button"
        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        onClick={() => onInsert(p.key)}
      >
        {p.key} <span className="text-muted-foreground">({p.label})</span>
      </button>
    ))}
  </div>
);

const SuperAdminWhatsApp = () => {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationData | null>(null);
  const [dialogTab, setDialogTab] = useState("onesender");
  const [form, setForm] = useState({
    school_id: "",
    api_url: "http://proxy.onesender.net/api/v1/messages",
    api_key: "",
    is_active: false,
    message_template: "",
    attendance_arrive_template: DEFAULT_ARRIVE_TEMPLATE,
    attendance_depart_template: DEFAULT_DEPART_TEMPLATE,
    attendance_group_template: DEFAULT_GROUP_TEMPLATE,
    wa_delivery_target: "parent_only",
    wa_enabled: true,
    gateway_type: "onesender",
    mpwa_api_key: "",
    mpwa_sender: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testDialogId, setTestDialogId] = useState<string | null>(null);

  const fetchData = async () => {
    const [intRes, schoolsRes] = await Promise.all([
      supabase.from("school_integrations" as any).select("*").eq("integration_type", "onesender"),
      supabase.from("schools").select("id, name"),
    ]);

    const schoolsList = schoolsRes.data || [];
    setSchools(schoolsList);

    const mapped = (intRes.data || []).map((i: any) => ({
      ...i,
      school_name: schoolsList.find((s: any) => s.id === i.school_id)?.name || "—",
    }));
    setIntegrations(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setDialogTab("onesender");
    setForm({
      school_id: "", api_url: "http://proxy.onesender.net/api/v1/messages", api_key: "", is_active: false,
      message_template: "",
      attendance_arrive_template: DEFAULT_ARRIVE_TEMPLATE,
      attendance_depart_template: DEFAULT_DEPART_TEMPLATE,
      attendance_group_template: DEFAULT_GROUP_TEMPLATE,
      wa_delivery_target: "parent_only",
      wa_enabled: true,
      gateway_type: "onesender",
      mpwa_api_key: "",
      mpwa_sender: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (int: IntegrationData) => {
    setEditing(int);
    setDialogTab(int.gateway_type === "mpwa" ? "mpwa" : "onesender");
    setForm({
      school_id: int.school_id, api_url: int.api_url, api_key: int.api_key, is_active: int.is_active,
      message_template: int.message_template || "",
      attendance_arrive_template: int.attendance_arrive_template || DEFAULT_ARRIVE_TEMPLATE,
      attendance_depart_template: int.attendance_depart_template || DEFAULT_DEPART_TEMPLATE,
      attendance_group_template: int.attendance_group_template || DEFAULT_GROUP_TEMPLATE,
      wa_delivery_target: int.wa_delivery_target || "parent_only",
      wa_enabled: int.wa_enabled !== false,
      gateway_type: int.gateway_type || "onesender",
      mpwa_api_key: int.mpwa_api_key || "",
      mpwa_sender: int.mpwa_sender || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.school_id) { toast.error("Pilih sekolah"); return; }
    if (form.gateway_type === "onesender" && (!form.api_url || !form.api_key)) {
      toast.error("API URL dan API Key OneSender wajib diisi");
      return;
    }
    if (form.gateway_type === "mpwa" && (!form.mpwa_api_key || !form.mpwa_sender)) {
      toast.error("API Key dan Sender MPWA wajib diisi");
      return;
    }
    setSaving(true);

    const payload = {
      school_id: form.school_id,
      integration_type: "onesender",
      api_url: form.api_url,
      api_key: form.api_key,
      is_active: form.is_active,
      message_template: form.message_template,
      attendance_arrive_template: form.attendance_arrive_template,
      attendance_depart_template: form.attendance_depart_template,
      attendance_group_template: form.attendance_group_template,
      wa_delivery_target: form.wa_delivery_target,
      wa_enabled: form.wa_enabled,
      gateway_type: form.gateway_type,
      mpwa_api_key: form.mpwa_api_key,
      mpwa_sender: form.mpwa_sender,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("school_integrations" as any).update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("school_integrations" as any).insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success(editing ? "Berhasil diupdate" : "Integrasi berhasil ditambahkan");
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleToggle = async (int: IntegrationData) => {
    const { error } = await supabase
      .from("school_integrations" as any)
      .update({ is_active: !int.is_active })
      .eq("id", int.id);
    if (error) { toast.error("Gagal: " + error.message); return; }
    toast.success(int.is_active ? "Dinonaktifkan" : "Diaktifkan");
    fetchData();
  };

  const handleTest = async (int: IntegrationData) => {
    if (!testPhone.trim()) { toast.error("Masukkan nomor WhatsApp"); return; }
    setTesting(int.id);
    try {
      const body: any = {
        phone: testPhone.replace(/\D/g, ""),
        message: `Tes koneksi WhatsApp Gateway (${int.gateway_type === "mpwa" ? "MPWA" : "OneSender"}) untuk ${int.school_name} berhasil!\n\nPesan ini dikirim dari ATSkolla Attendance System.`,
      };

      if (int.gateway_type === "mpwa") {
        body.gateway_type = "mpwa";
        body.school_id = int.school_id;
      } else {
        body.api_url = int.api_url;
        body.api_key = int.api_key;
      }

      const res = await supabase.functions.invoke("send-whatsapp", { body });
      const data = res.data as any;
      if (data?.success) {
        toast.success("Pesan tes berhasil dikirim!");
      } else {
        toast.error("Gagal: " + (data?.error || "Unknown error"));
      }
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Unknown error"));
    }
    setTesting(null);
    setTestDialogId(null);
    setTestPhone("");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            WhatsApp Gateway
          </h1>
          <p className="text-muted-foreground text-sm">Kelola integrasi OneSender & MPWA, template notifikasi per sekolah</p>
        </div>
        <Button onClick={openCreate} className="gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Tambah Integrasi
        </Button>
      </div>

      {integrations.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada integrasi WhatsApp</p>
            <Button variant="outline" className="mt-3" onClick={openCreate}>Tambah Sekarang</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((int, i) => (
            <motion.div key={int.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="border-0 shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                      {int.gateway_type === "mpwa" ? (
                        <Smartphone className="h-5 w-5 text-primary-foreground" />
                      ) : (
                        <School className="h-5 w-5 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{int.school_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {int.gateway_type === "mpwa" ? "MPWA" : "OneSender"}
                        </Badge>
                        {int.gateway_type === "mpwa" && (
                          <Badge className={`text-[10px] gap-1 ${int.mpwa_connected ? "bg-success/10 text-success border-success/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                            {int.mpwa_connected ? <><Wifi className="h-2.5 w-2.5" /> Online</> : <><WifiOff className="h-2.5 w-2.5" /> Offline</>}
                          </Badge>
                        )}
                        <Badge className={`text-[10px] ${int.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                          {int.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {int.gateway_type === "mpwa" ? `Sender: ${int.mpwa_sender || "—"}` : int.api_url}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setTestDialogId(int.id); setTestPhone(""); }}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Tes
                      </Button>
                      <Switch checked={int.is_active} onCheckedChange={() => handleToggle(int)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(int)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Integrasi" : "Tambah Integrasi WhatsApp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sekolah</Label>
              <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gateway Type Selector */}
            <div>
              <Label>Tipe Gateway</Label>
              <Select value={form.gateway_type} onValueChange={(v) => setForm({ ...form, gateway_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onesender">OneSender (API Sistem)</SelectItem>
                  <SelectItem value="mpwa">MPWA (WA Sendiri)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gateway-specific Settings */}
            <Tabs value={form.gateway_type} onValueChange={(v) => setForm({ ...form, gateway_type: v })} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="onesender" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> OneSender
                </TabsTrigger>
                <TabsTrigger value="mpwa" className="text-xs gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> MPWA
                </TabsTrigger>
              </TabsList>

              <TabsContent value="onesender" className="space-y-3 mt-3">
                <div>
                  <Label>API URL</Label>
                  <Input value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} placeholder="http://proxy.onesender.net/api/v1/messages" />
                </div>
                <div>
                  <Label>API Key / Token</Label>
                  <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="Token OneSender" />
                </div>
              </TabsContent>

              <TabsContent value="mpwa" className="space-y-3 mt-3">
                <div>
                  <Label>MPWA API Key</Label>
                  <Input type="password" value={form.mpwa_api_key} onChange={(e) => setForm({ ...form, mpwa_api_key: e.target.value })} placeholder="API Key dari MPWA" />
                </div>
                <div>
                  <Label>Sender (Nomor Device)</Label>
                  <Input value={form.mpwa_sender} onChange={(e) => setForm({ ...form, mpwa_sender: e.target.value })} placeholder="6281234567890" />
                  <p className="text-[10px] text-muted-foreground mt-1">Nomor WhatsApp yang terdaftar di MPWA (format: 62xxx)</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Template Tabs */}
            <Tabs defaultValue="arrive" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="arrive" className="text-xs gap-1"><ArrowDownToLine className="h-3 w-3" /> Datang</TabsTrigger>
                <TabsTrigger value="depart" className="text-xs gap-1"><ArrowUpFromLine className="h-3 w-3" /> Pulang</TabsTrigger>
                <TabsTrigger value="group" className="text-xs gap-1"><Users className="h-3 w-3" /> Group</TabsTrigger>
              </TabsList>

              <TabsContent value="arrive" className="space-y-2 mt-3">
                <Label className="text-xs text-muted-foreground">Template Notifikasi Absensi Datang (Wali Murid)</Label>
                <Textarea
                  value={form.attendance_arrive_template}
                  onChange={(e) => setForm({ ...form, attendance_arrive_template: e.target.value })}
                  rows={6}
                  className="font-mono text-xs"
                />
                <PlaceholderButtons placeholders={ATTENDANCE_PLACEHOLDERS} onInsert={(key) => setForm({ ...form, attendance_arrive_template: form.attendance_arrive_template + key })} />
              </TabsContent>

              <TabsContent value="depart" className="space-y-2 mt-3">
                <Label className="text-xs text-muted-foreground">Template Notifikasi Absensi Pulang (Wali Murid)</Label>
                <Textarea
                  value={form.attendance_depart_template}
                  onChange={(e) => setForm({ ...form, attendance_depart_template: e.target.value })}
                  rows={6}
                  className="font-mono text-xs"
                />
                <PlaceholderButtons placeholders={ATTENDANCE_PLACEHOLDERS} onInsert={(key) => setForm({ ...form, attendance_depart_template: form.attendance_depart_template + key })} />
              </TabsContent>

              <TabsContent value="group" className="space-y-2 mt-3">
                <Label className="text-xs text-muted-foreground">Template Notifikasi Group Kelas</Label>
                <Textarea
                  value={form.attendance_group_template}
                  onChange={(e) => setForm({ ...form, attendance_group_template: e.target.value })}
                  rows={6}
                  className="font-mono text-xs"
                />
                <PlaceholderButtons placeholders={GROUP_PLACEHOLDERS} onInsert={(key) => setForm({ ...form, attendance_group_template: form.attendance_group_template + key })} />
              </TabsContent>
            </Tabs>

            {/* Delivery Target */}
            <div className="space-y-2">
              <Label className="text-xs">Target Pengiriman Notifikasi Scan</Label>
              <Select value={form.wa_delivery_target} onValueChange={(v) => setForm({ ...form, wa_delivery_target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent_only">Hanya Wali Murid</SelectItem>
                  <SelectItem value="group_only">Hanya Group Kelas</SelectItem>
                  <SelectItem value="both">Group Kelas & Wali Murid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Aktifkan Integrasi</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.wa_enabled} onCheckedChange={(v) => setForm({ ...form, wa_enabled: v })} />
                <Label>WA Notifikasi</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={!!testDialogId} onOpenChange={() => setTestDialogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tes Kirim Pesan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomor WhatsApp Tujuan</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="6281234567890" />
              <p className="text-[11px] text-muted-foreground mt-1">Format internasional (62...)</p>
            </div>
            {testDialogId && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2">
                Gateway: <span className="font-semibold">
                  {integrations.find(i => i.id === testDialogId)?.gateway_type === "mpwa" ? "MPWA" : "OneSender"}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const int = integrations.find((i) => i.id === testDialogId);
                if (int) handleTest(int);
              }}
              disabled={testing === testDialogId}
              variant="outline"
            >
              {testing === testDialogId ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Kirim Tes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminWhatsApp;
