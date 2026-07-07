import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Save, Loader2, Send, History, Users, Power, Clock, Link2,
  AlertCircle, FileText, Megaphone, QrCode, Wifi, WifiOff,
  Smartphone, Radio, UserCheck, Zap, Shield, Signal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PremiumGate } from "@/components/PremiumGate";

const PLACEHOLDERS = [
  { key: "{student_name}", label: "Nama Siswa" },
  { key: "{class}", label: "Kelas" },
  { key: "{time}", label: "Waktu" },
  { key: "{day}", label: "Nama Hari" },
  { key: "{student_id}", label: "NIS" },
  { key: "{method}", label: "Metode" },
  { key: "{parent_name}", label: "Nama Wali" },
  { key: "{school_name}", label: "Nama Sekolah" },
];

const GROUP_PLACEHOLDERS = [
  ...PLACEHOLDERS.filter((p) => p.key !== "{parent_name}"),
  { key: "{type}", label: "Tipe (Datang/Pulang)" },
];

const FOOTER = `─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;

const DEFAULT_ARRIVE = `*Notifikasi Kehadiran Siswa*\n\nYth. Bapak/Ibu Wali Murid,\n\nDengan hormat kami sampaikan bahwa ananda *{student_name}* (Kelas {class}) telah tercatat *HADIR* di sekolah pada hari {day}, pukul {time}.\n\nDetail Kehadiran:\n• NIS       : {student_id}\n• Metode : {method}\n• Sekolah : {school_name}\n\nTerima kasih atas perhatian Bapak/Ibu.\n\n${FOOTER}`;
const DEFAULT_DEPART = `*Notifikasi Kepulangan Siswa*\n\nYth. Bapak/Ibu Wali Murid,\n\nDengan hormat kami sampaikan bahwa ananda *{student_name}* (Kelas {class}) telah tercatat *PULANG* dari sekolah pada hari {day}, pukul {time}.\n\nDetail Kepulangan:\n• NIS       : {student_id}\n• Metode : {method}\n• Sekolah : {school_name}\n\nTerima kasih atas perhatian Bapak/Ibu.\n\n${FOOTER}`;
const DEFAULT_GROUP = `*Notifikasi Absensi {type}*\n\n{school_name}\n\nSiswa *{student_name}* (Kelas {class}) telah tercatat {type} pada hari {day}, pukul {time}.\n\nMetode: {method}\n\n${FOOTER}`;

const DELIVERY_OPTIONS = [
  { value: "parent_only", label: "Hanya Wali Murid" },
  { value: "group_only", label: "Hanya Group Kelas" },
  { value: "both", label: "Group Kelas dan Wali Murid" },
];

const PlaceholderButtons = ({
  placeholders,
  onInsert,
}: {
  placeholders: typeof PLACEHOLDERS;
  onInsert: (key: string) => void;
}) => (
  <div className="mt-3 flex flex-wrap gap-1.5">
    {placeholders.map((p) => (
      <button
        key={p.key}
        type="button"
        className="rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-[10px] text-foreground transition hover:bg-primary/10 hover:border-primary/20 font-medium"
        onClick={() => onInsert(p.key)}
      >
        {p.key} <span className="text-muted-foreground">({p.label})</span>
      </button>
    ))}
  </div>
);

/* ═══ Connected Device Card — Premium with animated barcode ═══ */
const ConnectedDeviceCard = ({
  mpwaSenderNumber,
  disconnecting,
  handleDisconnect,
}: {
  mpwaSenderNumber: string;
  disconnecting: boolean;
  handleDisconnect: () => void;
}) => (
  <div className="rounded-2xl border border-success/20 bg-gradient-to-br from-background via-success/[0.02] to-primary/[0.04] p-5 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2" />
    <div className="absolute bottom-0 left-0 w-20 h-20 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />

    <div className="relative flex flex-col items-center text-center gap-4">
      {/* Animated barcode icon */}
      <div className="relative">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-success/10 to-primary/10 border border-success/20 flex items-center justify-center">
          <div className="flex items-end gap-[3px] h-10">
            {[10, 16, 8, 20, 6, 14, 10, 18, 8, 12].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-success"
                style={{
                  height: `${h}px`,
                  animation: `barcodePulse 2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1">
          <span className="relative flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-50"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-success border-2 border-background"></span>
          </span>
        </div>
      </div>

      <div>
        <p className="text-lg font-bold text-foreground">Perangkat Aktif</p>
        <Badge className="bg-success/10 text-success border-success/20 text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest mt-1">
          Connected
        </Badge>
        <p className="font-mono text-base font-semibold text-foreground tracking-wide mt-2">{mpwaSenderNumber}</p>
        <p className="text-xs text-muted-foreground mt-1.5">
          WhatsApp terhubung dan siap mengirim pesan otomatis
        </p>
      </div>

      <div className="w-full pt-3 border-t border-border/40">
        <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="gap-1.5 h-8 text-xs">
          {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
          Putuskan Koneksi
        </Button>
      </div>
    </div>
  </div>
);

/* ═══ QR Scanning Animation — Premium waiting UI ═══ */
const ScanningAnimation = () => {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* Animated scan ring */}
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" style={{ animationDuration: '1.5s' }} />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-primary/60 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Signal className="h-5 w-5 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">Menunggu koneksi{'.'.repeat(dots)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Scan QR code di atas, koneksi akan terdeteksi otomatis</p>
      </div>
    </div>
  );
};

const WhatsAppSettings = () => {
  const { profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("gateway");

  const [arriveTemplate, setArriveTemplate] = useState(DEFAULT_ARRIVE);
  const [departTemplate, setDepartTemplate] = useState(DEFAULT_DEPART);
  const [groupTemplate, setGroupTemplate] = useState(DEFAULT_GROUP);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [waEnabled, setWaEnabled] = useState(true);
  const [deliveryTarget, setDeliveryTarget] = useState("parent_only");
  const [gatewayType, setGatewayType] = useState("mpwa");
  const [mpwaConnected, setMpwaConnected] = useState(false);
  const [mpwaSenderNumber, setMpwaSenderNumber] = useState("");
  const [onesenderEnabled, setOnesenderEnabled] = useState(true);
  const [teachingReminderEnabled, setTeachingReminderEnabled] = useState(false);
  const [teachingReminderTemplate, setTeachingReminderTemplate] = useState(`*Pengingat Jadwal Mengajar*\n\nYth. Bapak/Ibu *{teacher_name}*,\n\nDengan hormat kami ingatkan bahwa jadwal mengajar Anda akan dimulai dalam 15 menit.\n\nDetail Jadwal:\n• Mata Pelajaran : {subject_name}\n• Kelas                : {class_name}\n• Waktu               : {start_time} - {end_time}\n• Ruangan          : {room}\n\nMohon persiapkan diri dan hadir tepat waktu.\n\n${FOOTER}`);
  const [testReminderPhone, setTestReminderPhone] = useState("089501123808");
  const [testingReminder, setTestingReminder] = useState(false);
  const [testTemplatePhone, setTestTemplatePhone] = useState("089501123808");
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);

  const handleTestTemplate = async (title: string, template: string) => {
    if (!testTemplatePhone.trim()) { toast.error("Masukkan nomor WhatsApp"); return; }
    if (!schoolId) { toast.error("School ID tidak ditemukan"); return; }
    setTestingTemplate(title);
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const isArrive = /Datang/i.test(title);
      const message = template
        .replace(/\{student_name\}/g, "Ahmad Fauzan")
        .replace(/\{class\}/g, "VII-A")
        .replace(/\{time\}/g, `${hh}:${mm}`)
        .replace(/\{day\}/g, days[now.getDay()])
        .replace(/\{student_id\}/g, "2024001")
        .replace(/\{method\}/g, "Manual (Test)")
        .replace(/\{parent_name\}/g, "Wali Murid")
        .replace(/\{school_name\}/g, "Sekolah Uji Coba")
        .replace(/\{type\}/g, isArrive ? "Datang" : "Pulang");
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { school_id: schoolId, phone: testTemplatePhone, message, message_type: "test_template" },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any).error || "Gagal kirim");
      toast.success(`Test "${title}" terkirim ke ${testTemplatePhone}`);
    } catch (e: any) {
      toast.error("Gagal: " + (e.message || e));
    } finally {
      setTestingTemplate(null);
    }
  };

  const handleTestReminder = async () => {
    if (!testReminderPhone.trim()) { toast.error("Masukkan nomor WhatsApp"); return; }
    if (!schoolId) { toast.error("School ID tidak ditemukan"); return; }
    setTestingReminder(true);
    try {
      const now = new Date();
      const start = new Date(now.getTime() + 15 * 60000);
      const end = new Date(start.getTime() + 45 * 60000);
      const fmt = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const message = teachingReminderTemplate
        .replace(/\{teacher_name\}/g, "Guru Uji Coba")
        .replace(/\{subject_name\}/g, "Matematika")
        .replace(/\{class_name\}/g, "VII-A")
        .replace(/\{start_time\}/g, fmt(start))
        .replace(/\{end_time\}/g, fmt(end))
        .replace(/\{room\}/g, "Ruang 101");
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { school_id: schoolId, phone: testReminderPhone, message, message_type: "teaching_reminder" },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any).error || "Gagal kirim");
      toast.success("Test reminder terkirim ke " + testReminderPhone);
    } catch (e: any) {
      toast.error("Gagal: " + (e.message || e));
    } finally {
      setTestingReminder(false);
    }
  };

  const [classes, setClasses] = useState<{ id: string; name: string; wa_group_id: string | null }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [sendingGroup, setSendingGroup] = useState(false);
  const [editingGroupIds, setEditingGroupIds] = useState<Record<string, string>>({});
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);

  const [parentBroadcastClass, setParentBroadcastClass] = useState("");
  const [parentMessage, setParentMessage] = useState("");
  const [sendingParent, setSendingParent] = useState(false);
  const [parentSendProgress, setParentSendProgress] = useState("");

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (authLoading) return;
    if (!schoolId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [intRes, classRes, platformRes] = await Promise.all([
          supabase.from("school_integrations").select("*").eq("school_id", schoolId).eq("integration_type", "onesender").maybeSingle(),
          supabase.from("classes").select("id, name, wa_group_id").eq("school_id", schoolId).order("name"),
          supabase.from("platform_settings").select("key, value").eq("key", "onesender_enabled").maybeSingle(),
        ]);

        if (cancelled) return;

        const osEnabled = platformRes.data?.value !== "false";
        setOnesenderEnabled(osEnabled);

        if (intRes.data) {
          const d = intRes.data as any;
          setIntegrationId(d.id);
          setWaEnabled(d.wa_enabled !== false);
          setDeliveryTarget(d.wa_delivery_target || "parent_only");
          setArriveTemplate(d.attendance_arrive_template || DEFAULT_ARRIVE);
          setDepartTemplate(d.attendance_depart_template || DEFAULT_DEPART);
          setGroupTemplate(d.attendance_group_template || DEFAULT_GROUP);
          const gt = d.gateway_type || "onesender";
          setGatewayType(!osEnabled && gt === "onesender" ? "mpwa" : gt);
          setMpwaConnected(d.mpwa_connected || false);
          setMpwaSenderNumber(d.mpwa_sender || "");
          setTeachingReminderEnabled(d.teaching_reminder_enabled || false);
          if (d.teaching_reminder_template) setTeachingReminderTemplate(d.teaching_reminder_template);
        } else {
          setGatewayType("mpwa");
        }

        setClasses(classRes.data || []);
      } catch (error) {
        console.error("Failed to load WhatsApp settings:", error);
        if (!cancelled) toast.error("Gagal memuat pengaturan WhatsApp");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, schoolId]);

  const fetchLogs = useCallback(async () => {
    if (!schoolId) return;
    setLogsLoading(true);
    const { data } = await supabase.from("wa_message_logs" as any).select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
    setLogsLoading(false);
  }, [schoolId]);

  useEffect(() => { if (activeTab === "history") void fetchLogs(); }, [activeTab, fetchLogs]);

  const handleSaveSettings = async () => {
    if (!schoolId) { toast.error("School ID tidak ditemukan."); return; }
    setSaving(true);
    const payload = {
      wa_enabled: waEnabled, wa_delivery_target: deliveryTarget,
      attendance_arrive_template: arriveTemplate, attendance_depart_template: departTemplate,
      attendance_group_template: groupTemplate, gateway_type: gatewayType,
      teaching_reminder_enabled: teachingReminderEnabled, teaching_reminder_template: teachingReminderTemplate,
    };
    if (!integrationId) {
      const { data: newInt, error: createErr } = await supabase.from("school_integrations").insert({ school_id: schoolId, integration_type: "onesender", is_active: false, ...payload }).select("id").single();
      if (createErr) { setSaving(false); toast.error("Gagal menyimpan: " + createErr.message); return; }
      setIntegrationId(newInt.id);
      setSaving(false); toast.success("Pengaturan WhatsApp berhasil disimpan"); return;
    }
    const { error } = await supabase.from("school_integrations" as any).update(payload).eq("id", integrationId);
    setSaving(false);
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else toast.success("Pengaturan WhatsApp berhasil disimpan");
  };

  const handleSwitchGateway = async (value: string) => {
    setGatewayType(value);
    if (integrationId) {
      await supabase.from("school_integrations" as any).update({ gateway_type: value }).eq("id", integrationId);
      toast.success(`Gateway diubah ke ${value === "mpwa" ? "WASkolla - Nomor Admin Sekolah" : "WASkolla (Sistem)"}`);
    }
  };

  const handleToggleWa = async (val: boolean) => {
    setWaEnabled(val);
    if (integrationId) {
      await supabase.from("school_integrations" as any).update({ wa_enabled: val }).eq("id", integrationId);
      toast.success(val ? "WhatsApp diaktifkan" : "WhatsApp dinonaktifkan");
    }
  };

  const handleCheckConnectionStatus = async () => {
    if (!schoolId) return;
    const cleanNumber = mpwaSenderNumber.replace(/\D/g, "");
    if (!cleanNumber) { toast.error("Masukkan nomor WhatsApp terlebih dahulu"); return; }

    setCheckingConnection(true);
    try {
      const res = await supabase.functions.invoke("mpwa-proxy", {
        body: { action: "check-status", school_id: schoolId, number: cleanNumber },
      });
      const data = res.data as any;

      if (data?.connected) {
        setMpwaConnected(true);
        setQrData(null);
        toast.success("Device berhasil terhubung!");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast("QR belum terhubung. Scan dulu lalu klik Cek Status lagi.");
      }
    } catch (err: any) {
      toast.error("Gagal cek status: " + err.message);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleGenerateQr = async () => {
    if (!schoolId) return;
    const cleanNumber = mpwaSenderNumber.replace(/\D/g, "");
    if (!cleanNumber) { toast.error("Masukkan nomor WhatsApp terlebih dahulu"); return; }
    setQrLoading(true); setQrData(null); setMpwaConnected(false);
    try {
      const res = await supabase.functions.invoke("mpwa-proxy", {
        body: { action: "generate-qr", school_id: schoolId, number: cleanNumber },
      });
      const data = res.data as any;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.connected) {
        setMpwaConnected(true);
        setQrData(null);
        toast.success("Device sudah terhubung!");
      } else if (data?.qrcode) {
        setQrData(data.qrcode);
        toast.success("QR Code berhasil dibuat! Scan di WhatsApp lalu klik Cek Status.");
      } else {
        toast.error(data?.error || data?.msg || data?.message || "Gagal generate QR code. Coba lagi.");
      }
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    setQrLoading(false);
  };

  const handleDisconnect = async () => {
    if (!schoolId) return;
    setDisconnecting(true);
    try {
      const res = await supabase.functions.invoke("mpwa-proxy", {
        body: { action: "disconnect", school_id: schoolId, number: mpwaSenderNumber.replace(/\D/g, "") },
      });
      const data = res.data as any;
      if (data?.success) { setMpwaConnected(false); setQrData(null); toast.success("Device berhasil di-disconnect"); }
      else toast.error(data?.error || data?.message || "Gagal disconnect");
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    setDisconnecting(false);
  };

  const handleSaveClassGroupId = async (classId: string, className: string) => {
    setSavingGroupId(classId);
    const newValue = editingGroupIds[classId]?.trim() || null;
    const { error } = await supabase.from("classes").update({ wa_group_id: newValue }).eq("id", classId);
    setSavingGroupId(null);
    if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
    toast.success(`ID Group WA kelas "${className}" berhasil disimpan`);
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, wa_group_id: newValue } : c));
  };

  const handleSendToGroup = async () => {
    if (!selectedClass || !groupMessage.trim() || !schoolId) { toast.error("Pilih kelas dan isi pesan"); return; }
    const cls = classes.find((c) => c.name === selectedClass);
    if (!cls?.wa_group_id) { toast.error("Kelas ini belum memiliki ID Group WhatsApp"); return; }
    setSendingGroup(true);
    try {
      const res = await supabase.functions.invoke("send-whatsapp", {
        body: { school_id: schoolId, group_id: cls.wa_group_id, message: groupMessage, message_type: "group_broadcast" },
      });
      const data = res.data as any;
      if (data?.success) { toast.success(`Pesan berhasil dikirim ke group ${selectedClass}`); setGroupMessage(""); }
      else toast.error("Gagal: " + (data?.error || "Unknown error"));
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    setSendingGroup(false);
  };

  const handleSendToParents = async () => {
    if (!parentBroadcastClass || !parentMessage.trim() || !schoolId) { toast.error("Pilih kelas dan isi pesan"); return; }
    setSendingParent(true); setParentSendProgress("Memuat data siswa...");
    try {
      const { data: studentData, error: studentErr } = await supabase.from("students").select("name, parent_phone, parent_name").eq("school_id", schoolId).eq("class", parentBroadcastClass);
      if (studentErr) { toast.error("Gagal memuat data siswa: " + studentErr.message); setSendingParent(false); return; }
      if (!studentData || studentData.length === 0) { toast.error("Tidak ada siswa di kelas ini"); setSendingParent(false); return; }

      const uniqueParents = new Map<string, { phone: string; name: string; studentNames: string[] }>();
      for (const s of studentData) {
        if (!s.parent_phone) continue;
        const phone = s.parent_phone.replace(/\D/g, "");
        if (!phone) continue;
        if (uniqueParents.has(phone)) uniqueParents.get(phone)!.studentNames.push(s.name);
        else uniqueParents.set(phone, { phone: s.parent_phone, name: s.parent_name, studentNames: [s.name] });
      }

      if (uniqueParents.size === 0) { toast.error("Tidak ada wali murid dengan nomor telepon di kelas ini"); setSendingParent(false); return; }

      let sent = 0, failed = 0;
      const total = uniqueParents.size;

      for (const [, parent] of uniqueParents) {
        setParentSendProgress(`Mengirim ${sent + failed + 1}/${total}...`);
        try {
          const personalMsg = parentMessage
            .replace(/\{parent_name\}/g, parent.name || "Bapak/Ibu")
            .replace(/\{student_name\}/g, parent.studentNames.join(", "))
            .replace(/\{class\}/g, parentBroadcastClass);
          const res = await supabase.functions.invoke("send-whatsapp", {
            body: { school_id: schoolId, phone: parent.phone, message: personalMsg, message_type: "parent_broadcast", student_name: parent.studentNames.join(", ") },
          });
          const data = res.data as any;
          if (data?.success) sent++; else failed++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 500));
      }

      setParentSendProgress("");
      if (sent > 0) toast.success(`Berhasil kirim ke ${sent} wali murid${failed > 0 ? `, ${failed} gagal` : ""}`);
      else toast.error(`Gagal mengirim ke semua wali murid (${failed} gagal)`);
      if (sent > 0) setParentMessage("");
    } catch (err: any) { toast.error("Gagal: " + err.message); }
    setSendingParent(false); setParentSendProgress("");
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader icon={MessageSquare} title="WhatsApp" subtitle="Gateway, template pesan, broadcast group, dan riwayat pengiriman" />
        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Data sekolah belum ditemukan</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Halaman WhatsApp sekarang tetap bisa dibuka, tetapi akun ini belum terhubung ke data sekolah sehingga pengaturan WhatsApp belum bisa dimuat.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const connectedCount = classes.filter(c => c.wa_group_id).length;
  const isMpwaOnly = !onesenderEnabled;

  return (
    <PremiumGate featureLabel="WhatsApp Gateway" featureKey="canWhatsApp" requiredPlan="School">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader icon={MessageSquare} title="WhatsApp" subtitle="Gateway, template pesan, broadcast group, dan riwayat pengiriman" />

        {/* Status Card */}
        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${waEnabled ? "bg-success/10" : "bg-muted"}`}>
                  <Power className={`h-4 w-4 ${waEnabled ? "text-success" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Status WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">
                    Gateway: <span className="font-semibold">{gatewayType === "mpwa" ? "WASkolla - Nomor Admin Sekolah" : "WASkolla (Sistem)"}</span>
                    {gatewayType === "mpwa" && (
                      <span className={`ml-2 ${mpwaConnected ? "text-success" : "text-destructive"}`}>
                        • {mpwaConnected ? "Terhubung" : "Belum Terhubung"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={waEnabled ? "default" : "secondary"} className={`text-[10px] ${waEnabled ? "bg-success/10 text-success border-success/20" : ""}`}>
                  {waEnabled ? "Aktif" : "Nonaktif"}
                </Badge>
                <Switch checked={waEnabled} onCheckedChange={handleToggleWa} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-11 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="gateway" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gateway</span>
            </TabsTrigger>
            <TabsTrigger value="template" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Template</span>
            </TabsTrigger>
            <TabsTrigger value="group-id" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Group</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
              <Megaphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Broadcast</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Riwayat</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══════ GATEWAY TAB ═══════ */}
          <TabsContent value="gateway" className="mt-4 space-y-4">
            {/* Single unified layout: 2-col when MPWA only, otherwise normal */}
            <div className={`grid grid-cols-1 ${isMpwaOnly ? "md:grid-cols-2" : ""} gap-4`}>
              {/* Gateway Card */}
              <Card className="border-0 shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    {isMpwaOnly ? "WhatsApp Gateway" : "Pilih Gateway WhatsApp"}
                  </h3>
                  {!isMpwaOnly && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pilih layanan pengiriman pesan WhatsApp</p>
                  )}
                </div>
                <CardContent className="p-4 space-y-4">
                  {isMpwaOnly ? (
                    /* MPWA only — fill card with info + scan steps */
                    <div className="space-y-4">
                      <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Smartphone className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">WASkolla - Nomor Admin Sekolah</p>
                            <p className="text-[10px] text-muted-foreground">Gunakan WhatsApp Anda sendiri</p>
                          </div>
                          <div className="ml-auto h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        </div>
                      </div>

                      {/* Scan steps info */}
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                        <p className="text-xs font-bold text-foreground flex items-center gap-2">
                          <QrCode className="h-3.5 w-3.5 text-primary" />
                          Cara Menghubungkan WhatsApp
                        </p>
                        <div className="space-y-2.5">
                          {[
                            { step: "1", text: "Masukkan nomor WhatsApp sekolah (format 628xxx)" },
                            { step: "2", text: 'Klik "Hubungkan" untuk membuat QR code WhatsApp' },
                            { step: "3", text: "Buka WhatsApp di HP → Menu (⋮) → Perangkat Tertaut" },
                            { step: "4", text: "Ketuk Tautkan Perangkat → Scan QR code yang tampil" },
                            { step: "5", text: 'Setelah selesai scan, klik "Cek Status Koneksi"' },
                          ].map((s) => (
                            <div key={s.step} className="flex items-start gap-2.5">
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {s.step}
                              </span>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                          <Shield className="h-3 w-3 text-success" />
                          <p className="text-[10px] text-muted-foreground">Koneksi end-to-end encrypted oleh WhatsApp</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Normal: gateway selection */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleSwitchGateway("mpwa")}
                        className={`text-left rounded-xl border-2 p-4 transition-all ${
                          gatewayType === "mpwa" ? "border-primary bg-primary/5 shadow-md" : "border-border bg-background hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${gatewayType === "mpwa" ? "bg-primary/10" : "bg-muted"}`}>
                            <Smartphone className={`h-5 w-5 ${gatewayType === "mpwa" ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">WASkolla - Nomor Admin Sekolah</p>
                            <p className="text-[10px] text-muted-foreground">Gunakan WA Anda</p>
                          </div>
                          {gatewayType === "mpwa" && (
                            <div className="ml-auto h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Menggunakan nomor WhatsApp sendiri. Perlu scan QR code untuk menghubungkan device Anda.
                        </p>
                      </button>

                      {onesenderEnabled && (
                        <button
                          type="button"
                          onClick={() => handleSwitchGateway("onesender")}
                          className={`text-left rounded-xl border-2 p-4 transition-all ${
                            gatewayType === "onesender" ? "border-primary bg-primary/5 shadow-md" : "border-border bg-background hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${gatewayType === "onesender" ? "bg-primary/10" : "bg-muted"}`}>
                              <MessageSquare className={`h-5 w-5 ${gatewayType === "onesender" ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">WASkolla</p>
                              <p className="text-[10px] text-muted-foreground">Sistem ATSkolla</p>
                            </div>
                            {gatewayType === "onesender" && (
                              <div className="ml-auto h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Menggunakan layanan WhatsApp dari sistem ATSkolla. Tidak perlu scan QR.
                          </p>
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Connection Card — only for MPWA, unified (no duplicate) */}
              {gatewayType === "mpwa" && (
                <Card className="border-0 shadow-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary" />
                      Koneksi WhatsApp Anda
                    </h3>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Nomor WhatsApp Sekolah</Label>
                      <div className="flex gap-2">
                        <Input
                          value={mpwaSenderNumber}
                          onChange={(e) => setMpwaSenderNumber(e.target.value)}
                          placeholder="628812345678"
                          className="h-10 bg-muted/30 focus:bg-background transition-colors flex-1"
                          disabled={mpwaConnected}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && mpwaSenderNumber.trim() && !mpwaConnected) {
                              handleGenerateQr();
                            }
                          }}
                        />
                        {!mpwaConnected && (
                          <Button
                            onClick={handleGenerateQr}
                            disabled={qrLoading || !mpwaSenderNumber.trim()}
                            size="sm"
                            className="gradient-primary h-10 px-4 gap-1.5 text-xs shrink-0"
                          >
                            {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                            Hubungkan
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Masukkan nomor lalu klik Hubungkan untuk otomatis mendaftarkan device & generate QR</p>
                    </div>

                    {mpwaConnected ? (
                      <ConnectedDeviceCard
                        mpwaSenderNumber={mpwaSenderNumber}
                        disconnecting={disconnecting}
                        handleDisconnect={handleDisconnect}
                      />
                    ) : (
                      <>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3">
                          <div className="flex items-center gap-3">
                            <WifiOff className="h-4 w-4 text-amber-500" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-foreground">Device Belum Terhubung</p>
                            </div>
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Offline</Badge>
                          </div>
                        </div>

                        {qrData && (
                          <div className="flex flex-col items-center gap-3 py-3">
                            <div className="rounded-xl border-2 border-primary/20 p-3 bg-white relative overflow-hidden">
                              {/* Scan line animation overlay */}
                              <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-[scanLine_2.5s_ease-in-out_infinite]" />
                              </div>
                              <img src={qrData} alt="QR Code" className="w-44 h-44 sm:w-56 sm:h-56 relative z-0" />
                            </div>
                            <ScanningAnimation />
                          </div>
                        )}

                        {qrData && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Button
                              onClick={handleCheckConnectionStatus}
                              disabled={checkingConnection}
                              variant="secondary"
                              className="h-8 px-4 gap-1.5 w-full text-xs"
                            >
                              {checkingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                              Cek Status Koneksi
                            </Button>
                            <Button
                              onClick={handleGenerateQr}
                              disabled={qrLoading}
                              variant="outline"
                              className="h-8 px-4 gap-1.5 w-full text-xs"
                            >
                              {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                              Refresh QR
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {gatewayType === "onesender" && (
              <Card className="border-0 shadow-card overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">WASkolla Aktif</p>
                      <p className="text-[10px] text-muted-foreground">
                        Konfigurasi WhatsApp dikelola oleh administrator sistem. Anda tidak perlu melakukan pengaturan tambahan.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════ TEMPLATE TAB ═══════ */}
          <TabsContent value="template" className="mt-4 space-y-4">
            {waEnabled && (
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 space-y-5">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Target Pengiriman Otomatis</Label>
                    <p className="text-[10px] text-muted-foreground mb-2">Pilih tujuan pengiriman notifikasi saat scan absensi</p>
                    <Select value={deliveryTarget} onValueChange={setDeliveryTarget}>
                      <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DELIVERY_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Teaching Reminder — merged here */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          Pengingat Jadwal Mengajar
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Notifikasi otomatis 15 menit sebelum jadwal mengajar dimulai</p>
                      </div>
                      <Switch checked={teachingReminderEnabled} onCheckedChange={setTeachingReminderEnabled} />
                    </div>
                    {teachingReminderEnabled && (
                      <div className="mt-3 space-y-3">
                        <Textarea rows={8} className="font-mono text-xs bg-muted/30 border-border/50 focus:bg-background transition-colors" value={teachingReminderTemplate} onChange={(e) => setTeachingReminderTemplate(e.target.value)} />
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: "{teacher_name}", label: "Nama Guru" },
                            { key: "{subject_name}", label: "Mata Pelajaran" },
                            { key: "{class_name}", label: "Nama Kelas" },
                            { key: "{start_time}", label: "Jam Mulai" },
                            { key: "{end_time}", label: "Jam Selesai" },
                            { key: "{room}", label: "Ruangan" },
                          ].map((p) => (
                            <button key={p.key} type="button"
                              className="rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-[10px] text-foreground transition hover:bg-primary/10 hover:border-primary/20 font-medium"
                              onClick={() => setTeachingReminderTemplate((prev) => prev + p.key)}>
                              {p.key} <span className="text-muted-foreground">({p.label})</span>
                            </button>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-border/50 space-y-2">
                          <Label className="text-xs font-semibold">Test Kirim Reminder</Label>
                          <div className="flex gap-2">
                            <Input value={testReminderPhone} onChange={(e) => setTestReminderPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="h-9 text-xs" />
                            <Button onClick={handleTestReminder} disabled={testingReminder} size="sm" className="h-9">
                              {testingReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                              Test
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Kirim contoh pesan reminder ke nomor di atas menggunakan template aktif.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {[
              { title: "Template Datang", subtitle: "Dikirim ke wali murid saat absensi datang", value: arriveTemplate, setter: setArriveTemplate, placeholders: PLACEHOLDERS },
              { title: "Template Pulang", subtitle: "Dikirim ke wali murid saat absensi pulang", value: departTemplate, setter: setDepartTemplate, placeholders: PLACEHOLDERS },
              { title: "Template Group Kelas", subtitle: "Dikirim ke group WhatsApp kelas", value: groupTemplate, setter: setGroupTemplate, placeholders: GROUP_PLACEHOLDERS },
            ].map((tmpl) => (
              <Card key={tmpl.title} className="border-0 shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <h3 className="text-sm font-bold text-foreground">{tmpl.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{tmpl.subtitle}</p>
                </div>
                <CardContent className="p-4">
                  <Textarea rows={8} className="font-mono text-xs bg-muted/30 border-border/50 focus:bg-background transition-colors" value={tmpl.value} onChange={(e) => tmpl.setter(e.target.value)} />
                  <PlaceholderButtons placeholders={tmpl.placeholders} onInsert={(key) => tmpl.setter((prev: string) => prev + key)} />
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                    <Label className="text-xs font-semibold">Test Kirim Template</Label>
                    <div className="flex gap-2">
                      <Input value={testTemplatePhone} onChange={(e) => setTestTemplatePhone(e.target.value)} placeholder="08xxxxxxxxxx" className="h-9 text-xs" />
                      <Button onClick={() => handleTestTemplate(tmpl.title, tmpl.value)} disabled={testingTemplate === tmpl.title} size="sm" className="h-9">
                        {testingTemplate === tmpl.title ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                        Test
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Kirim contoh pesan menggunakan template di atas dengan data dummy.</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button onClick={handleSaveSettings} disabled={saving} className="gradient-primary hover:opacity-90 shadow-md h-10 px-6">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Pengaturan
            </Button>
          </TabsContent>

          {/* ═══════ GROUP ID TAB ═══════ */}
          <TabsContent value="group-id" className="mt-4">
            <Card className="border-0 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    ID Group WhatsApp per Kelas
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Masukkan ID Group WhatsApp untuk setiap kelas</p>
                </div>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Wifi className="h-3 w-3 text-success" />
                  {connectedCount}/{classes.length} terhubung
                </Badge>
              </div>
              <CardContent className="p-4">
                {classes.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Belum ada data kelas</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {classes.map((cls) => (
                      <div key={cls.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${cls.wa_group_id ? "border-success/20 bg-success/[0.02]" : "border-border bg-background hover:border-primary/20"}`}>
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${cls.wa_group_id ? "bg-success/10" : "bg-muted"}`}>
                          {cls.wa_group_id ? <Wifi className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{cls.name}</span>
                            <Badge className={`text-[9px] px-1.5 py-0 border-0 ${cls.wa_group_id ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                              {cls.wa_group_id ? "Terhubung" : "Belum diisi"}
                            </Badge>
                          </div>
                          <Input placeholder="120363XXXXXXXXX@g.us" defaultValue={cls.wa_group_id || ""} onChange={(e) => setEditingGroupIds(prev => ({ ...prev, [cls.id]: e.target.value }))} className="text-xs h-8 bg-muted/30 focus:bg-background transition-colors" />
                        </div>
                        <Button size="sm" variant={cls.wa_group_id ? "outline" : "default"} className={`shrink-0 h-8 w-8 p-0 ${!cls.wa_group_id ? "gradient-primary hover:opacity-90" : ""}`} disabled={savingGroupId === cls.id} onClick={() => handleSaveClassGroupId(cls.id, cls.name)}>
                          {savingGroupId === cls.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ BROADCAST TAB ═══════ */}
          <TabsContent value="broadcast" className="mt-4 space-y-4">
            <Card className="border-0 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  Kirim Pesan ke Group Kelas
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Broadcast pesan manual ke group WhatsApp kelas</p>
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Pilih Kelas</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          <span className="flex items-center gap-2">
                            {c.name}
                            {c.wa_group_id ? <Badge className="bg-success/10 text-success border-0 text-[9px] px-1 py-0">Siap</Badge> : <Badge className="bg-muted text-muted-foreground border-0 text-[9px] px-1 py-0">Belum</Badge>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Isi Pesan</Label>
                  <Textarea value={groupMessage} onChange={(e) => setGroupMessage(e.target.value)} rows={4} placeholder="Ketik pesan yang akan dikirim ke group kelas..." className="bg-muted/30 focus:bg-background transition-colors" />
                </div>
                <Button onClick={handleSendToGroup} disabled={sendingGroup || !selectedClass || !groupMessage.trim()} className="gradient-primary hover:opacity-90 shadow-md h-10 px-6">
                  {sendingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Kirim ke Group
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Kirim Pesan ke Wali Murid
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Broadcast pesan ke semua wali murid per kelas</p>
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Pilih Kelas</Label>
                  <Select value={parentBroadcastClass} onValueChange={setParentBroadcastClass}>
                    <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Isi Pesan</Label>
                  <Textarea value={parentMessage} onChange={(e) => setParentMessage(e.target.value)} rows={4} placeholder="Ketik pesan untuk wali murid... Gunakan {parent_name} untuk nama wali, {student_name} untuk nama siswa" className="bg-muted/30 focus:bg-background transition-colors" />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[{ key: "{parent_name}", label: "Nama Wali" }, { key: "{student_name}", label: "Nama Siswa" }, { key: "{class}", label: "Kelas" }].map(p => (
                      <button key={p.key} type="button" className="rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-[10px] text-foreground transition hover:bg-primary/10 hover:border-primary/20 font-medium" onClick={() => setParentMessage(prev => prev + p.key)}>
                        {p.key} <span className="text-muted-foreground">({p.label})</span>
                      </button>
                    ))}
                  </div>
                </div>
                {parentSendProgress && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-lg p-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {parentSendProgress}
                  </div>
                )}
                <Button onClick={handleSendToParents} disabled={sendingParent || !parentBroadcastClass || !parentMessage.trim()} className="gradient-primary hover:opacity-90 shadow-md h-10 px-6">
                  {sendingParent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                  Kirim ke Wali Murid
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ HISTORY TAB ═══════ */}
          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Riwayat Pengiriman
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">100 pesan terakhir yang dikirim</p>
              </div>
              <CardContent className="p-4">
                {logsLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">Memuat riwayat...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-8 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Belum ada riwayat pengiriman</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto">
                    {logs.map((log: any) => (
                      <div key={log.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${log.status === "sent" ? "border-success/15 bg-success/[0.02]" : "border-destructive/15 bg-destructive/[0.02]"}`}>
                        <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${log.status === "sent" ? "bg-success/10" : "bg-destructive/10"}`}>
                          {log.status === "sent" ? <Send className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {log.student_name && <span className="text-xs font-semibold text-foreground">{log.student_name}</span>}
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{log.message_type}</Badge>
                            <Badge className={`text-[9px] px-1.5 py-0 border-0 ${log.status === "sent" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {log.status === "sent" ? "Terkirim" : "Gagal"}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{log.phone || log.group_id}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PremiumGate>
  );
};

export default WhatsAppSettings;
