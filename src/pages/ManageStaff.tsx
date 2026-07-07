import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Users2, Mail, Lock, Loader2, Phone, Shield, Pencil, GraduationCap, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Wallet, Camera, QrCode, Nfc,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PremiumGate } from "@/components/PremiumGate";
import * as XLSX from "xlsx";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import StaffAttendanceDetailDialog from "@/components/staff/StaffAttendanceDetailDialog";
import { TeacherIdCard } from "@/components/TeacherIdCard";
import { NfcScanButton } from "@/components/NfcScanButton";

const POSITION_PRESETS = [
  "Guru",
  "Wali Kelas",
  "Kepala Sekolah",
  "Wakil Kepala Sekolah",
  "Tata Usaha",
  "Operator",
  "Bendahara",
  "Sekuriti",
  "Kebersihan",
  "Pustakawan",
];

interface StaffMember {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  qr_code: string | null;
  phone: string | null;
  nip: string | null;
  position: string | null;
  rfid_uid: string | null;
  roles: string[];
  presentToday?: boolean;
  arrivalTime?: string | null;
}

const ROLE_META: Record<string, { label: string; icon: any; cls: string }> = {
  teacher: { label: "Guru", icon: GraduationCap, cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400" },
  staff: { label: "Operator", icon: Shield, cls: "bg-[#5B6CF9]/10 text-[#5B6CF9]" },
  bendahara: { label: "Bendahara", icon: Wallet, cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  principal: { label: "Kepala Sekolah", icon: Shield, cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" },
};

const ManageStaff = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [school, setSchool] = useState<{ name?: string; logo?: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNip, setFormNip] = useState("");
  const [formPosition, setFormPosition] = useState("Guru");
  const [formRoles, setFormRoles] = useState<{ staff: boolean; teacher: boolean; bendahara: boolean; principal: boolean }>({ staff: true, teacher: false, bendahara: false, principal: false });

  // Detail/Edit
  const [detailDialog, setDetailDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNip, setEditNip] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoles, setEditRoles] = useState<{ staff: boolean; teacher: boolean; bendahara: boolean; principal: boolean }>({ staff: false, teacher: false, bendahara: false, principal: false });
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR dialog
  const [qrDialog, setQrDialog] = useState(false);
  const [qrTarget, setQrTarget] = useState<StaffMember | null>(null);

  // RFID dialogs
  const [rfidDialogOpen, setRfidDialogOpen] = useState(false);
  const [rfidTarget, setRfidTarget] = useState<StaffMember | null>(null);
  const [rfidValue, setRfidValue] = useState("");
  const [rfidSaving, setRfidSaving] = useState(false);
  const [testRfidOpen, setTestRfidOpen] = useState(false);
  const [testRfidValue, setTestRfidValue] = useState("");
  const [testRfidResult, setTestRfidResult] = useState<{ ok: boolean; msg: string; member?: StaffMember } | null>(null);

  // Attendance detail dialog
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [attendanceTarget, setAttendanceTarget] = useState<StaffMember | null>(null);

  // Bulk import
  const [importDialog, setImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<{ name: string; email: string; ok: boolean; error?: string }[]>([]);

  const schoolId = profile?.school_id;

  const fetchStaff = async () => {
    if (!schoolId) { setLoading(false); return; }
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, photo_url, qr_code, phone, nip, position, rfid_uid" as any).eq("school_id", schoolId);
    if (!profiles || profiles.length === 0) { setStaff([]); setLoading(false); return; }

    const userIds = profiles.map((p: any) => p.user_id);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds).in("role", ["staff", "teacher", "bendahara", "principal"]);

    const roleMap = new Map<string, string[]>();
    (roles || []).forEach((r) => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role);
      roleMap.set(r.user_id, existing);
    });

    const staffList: StaffMember[] = (profiles as any[])
      .filter((p) => roleMap.has(p.user_id))
      .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name, photo_url: p.photo_url, qr_code: p.qr_code || p.user_id, phone: p.phone || null, nip: p.nip || null, position: p.position || null, rfid_uid: p.rfid_uid || null, roles: roleMap.get(p.user_id) || [], presentToday: false, arrivalTime: null }));

    // Fetch today's attendance (datang) to color cards green/red
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const { data: todayLogs } = await supabase
      .from("teacher_attendance_logs" as any)
      .select("user_id, time, attendance_type")
      .eq("school_id", schoolId)
      .eq("date", dateStr);
    const presentMap = new Map<string, string>();
    (todayLogs || []).forEach((l: any) => {
      if ((l.attendance_type || "datang") === "datang" && !presentMap.has(l.user_id)) {
        presentMap.set(l.user_id, l.time);
      }
    });
    staffList.forEach((s) => {
      if (presentMap.has(s.user_id)) {
        s.presentToday = true;
        s.arrivalTime = (presentMap.get(s.user_id) || "").slice(0,5);
      }
    });

    setStaff(staffList);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("schools").select("name, logo").eq("id", schoolId).maybeSingle()
      .then(({ data }) => { if (data) setSchool(data); });
  }, [schoolId]);

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword) { toast.error("Nama, email, dan password harus diisi"); return; }
    if (!schoolId) { toast.error("Data sekolah belum dimuat, silakan tunggu sebentar"); return; }
    if (formPassword.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    const selectedRoles: string[] = [];
    if (formRoles.staff) selectedRoles.push("staff");
    if (formRoles.teacher) selectedRoles.push("teacher");
    if (formRoles.bendahara) selectedRoles.push("bendahara");
    if (formRoles.principal) selectedRoles.push("principal");
    if (selectedRoles.length === 0) { toast.error("Pilih minimal satu role"); return; }

    setCreating(true);
    try {
      // Use first role as primary, then add the rest
      const res = await supabase.functions.invoke("create-user", {
        body: { email: formEmail, password: formPassword, full_name: formName, role: selectedRoles[0], school_id: schoolId, phone: formPhone, nip: formNip, position: formPosition },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      const newUserId = res.data?.user_id;
      if (newUserId && selectedRoles.length > 1) {
        for (const role of selectedRoles.slice(1)) {
          await supabase.from("user_roles").insert({ user_id: newUserId, role: role as any });
        }
      }
      // Set qr_code = user_id
      if (newUserId) {
        await supabase.from("profiles").update({ qr_code: newUserId }).eq("user_id", newUserId);
      }

      toast.success(`Akun ${formName} berhasil ditambahkan`);
      setShowDialog(false);
      setFormName(""); setFormEmail(""); setFormPassword(""); setFormPhone(""); setFormNip(""); setFormPosition("Guru");
      setFormRoles({ staff: true, teacher: false, bendahara: false, principal: false });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat akun");
    } finally { setCreating(false); }
  };

  const downloadTemplate = () => {
    const data = [
      { full_name: "Budi Santoso", email: "budi@sekolah.sch.id", password: "rahasia123", role: "teacher", phone: "081234567890" },
      { full_name: "Siti Aminah", email: "siti@sekolah.sch.id", password: "rahasia123", role: "staff", phone: "081298765432" },
      { full_name: "Rahmat Hidayat", email: "rahmat@sekolah.sch.id", password: "rahasia123", role: "bendahara", phone: "081200000000" },
    ];
    const ws = XLSX.utils.json_to_sheet(data, { header: ["full_name", "email", "password", "role", "phone"] });
    ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guru-Staff");
    const info = [
      ["Petunjuk Import Akun Guru, Staff & Bendahara"],
      [""],
      ["Kolom wajib: full_name, email, password, role"],
      ["Kolom opsional: phone"],
      [""],
      ["role harus salah satu dari:"],
      ["  - teacher    (untuk Guru / Wali Kelas)"],
      ["  - staff      (untuk Staff / Operator)"],
      ["  - bendahara  (untuk Bendahara SPP)"],
      [""],
      ["Password minimal 6 karakter."],
      ["Hapus baris contoh sebelum upload."],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(info);
    wsInfo["!cols"] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, "Petunjuk");
    XLSX.writeFile(wb, "Template-Import-Guru-Staff.xlsx");
    toast.success("Template berhasil diunduh");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const cleaned = rows
        .map((r) => ({
          full_name: String(r.full_name || r.nama || "").trim(),
          email: String(r.email || "").trim(),
          password: String(r.password || "").trim(),
          role: String(r.role || "staff").trim().toLowerCase(),
          phone: String(r.phone || r.no_wa || "").trim(),
        }))
        .filter((r) => r.full_name && r.email);
      if (cleaned.length === 0) { toast.error("Tidak ada baris valid di file"); return; }
      setImportRows(cleaned);
      setImportResults([]);
      toast.success(`${cleaned.length} baris siap diimport`);
    } catch (err: any) {
      toast.error("Gagal baca file: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const handleBulkImport = async () => {
    if (!schoolId) { toast.error("Data sekolah belum dimuat"); return; }
    if (importRows.length === 0) return;
    setImporting(true);
    const results: { name: string; email: string; ok: boolean; error?: string }[] = [];
    for (const r of importRows) {
      try {
        if (!r.password || r.password.length < 6) throw new Error("Password minimal 6 karakter");
        if (!["teacher", "staff", "bendahara"].includes(r.role)) throw new Error("Role harus 'teacher', 'staff', atau 'bendahara'");
        const res = await supabase.functions.invoke("create-user", {
          body: { email: r.email, password: r.password, full_name: r.full_name, role: r.role, school_id: schoolId, phone: r.phone },
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
        if (res.data?.user_id) {
          await supabase.from("profiles").update({ qr_code: res.data.user_id }).eq("user_id", res.data.user_id);
        }
        results.push({ name: r.full_name, email: r.email, ok: true });
      } catch (err: any) {
        results.push({ name: r.full_name, email: r.email, ok: false, error: err.message });
      }
      setImportResults([...results]);
    }
    setImporting(false);
    const success = results.filter((r) => r.ok).length;
    toast.success(`Import selesai: ${success}/${results.length} berhasil`);
    setImportRows([]);
    fetchStaff();
  };

  const handleDelete = async (member: StaffMember) => {
    if (!confirm(`Cabut semua role ${member.full_name}? Akun tidak akan dihapus, hanya role yang dicabut.`)) return;
    for (const role of member.roles) {
      await supabase.from("user_roles").delete().eq("user_id", member.user_id).eq("role", role as any);
    }
    toast.success(`Role ${member.full_name} berhasil dicabut`);
    fetchStaff();
  };

  const openDetail = async (member: StaffMember) => {
    setSelectedStaff(member);
    setEditName(member.full_name);
    setEditEmail("");
    setEditPhone(member.phone || "");
    setEditNip(member.nip || "");
    setEditPosition(member.position || (member.roles.includes("teacher") ? "Guru" : member.roles.includes("bendahara") ? "Bendahara" : "Operator"));
    setEditPassword("");
    setEditRoles({
      staff: member.roles.includes("staff"),
      teacher: member.roles.includes("teacher"),
      bendahara: member.roles.includes("bendahara"),
      principal: member.roles.includes("principal"),
    });
    setEditMode(false);
    setDetailDialog(true);
    // Fetch authoritative email + phone + nip from edge function (auth.users)
    try {
      const res = await supabase.functions.invoke("get-user-detail", { body: { user_id: member.user_id } });
      const d = res.data;
      if (d && !d.error) {
        if (d.email) setEditEmail(d.email);
        if (d.phone) setEditPhone(d.phone);
        if (d.nip) setEditNip(d.nip);
      }
    } catch {}
  };

  const openAttendance = (member: StaffMember) => {
    setAttendanceTarget(member);
    setAttendanceDialog(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStaff) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${selectedStaff.user_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("teacher-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("teacher-photos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("profiles").update({ photo_url: publicUrl }).eq("user_id", selectedStaff.user_id);
      if (updErr) throw updErr;
      setSelectedStaff({ ...selectedStaff, photo_url: publicUrl });
      toast.success("Foto berhasil diunggah");
      fetchStaff();
    } catch (err: any) {
      toast.error("Gagal upload foto: " + err.message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedStaff || !editName.trim()) return;
    if (!editRoles.staff && !editRoles.teacher && !editRoles.bendahara && !editRoles.principal) {
      toast.error("Minimal pilih satu role");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await supabase.functions.invoke("update-user", {
        body: {
          user_id: selectedStaff.user_id,
          full_name: editName.trim(),
          ...(editEmail.trim() ? { email: editEmail.trim() } : {}),
          phone: editPhone.trim(),
          nip: editNip.trim(),
          position: editPosition.trim(),
          ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
        },
      });
      if (res.data?.error) throw new Error(res.data.error);

      const currentRoles = selectedStaff.roles;
      const wantedRoles: string[] = [];
      if (editRoles.staff) wantedRoles.push("staff");
      if (editRoles.teacher) wantedRoles.push("teacher");
      if (editRoles.bendahara) wantedRoles.push("bendahara");
      if (editRoles.principal) wantedRoles.push("principal");

      for (const role of wantedRoles) {
        if (!currentRoles.includes(role)) {
          await supabase.from("user_roles").insert({ user_id: selectedStaff.user_id, role: role as any });
        }
      }
      for (const role of currentRoles) {
        if (!wantedRoles.includes(role)) {
          await supabase.from("user_roles").delete().eq("user_id", selectedStaff.user_id).eq("role", role as any);
        }
      }

      toast.success("Data berhasil diperbarui");
    } catch (err: any) {
      toast.error("Gagal update: " + err.message);
    }
    setSavingEdit(false);
    setDetailDialog(false);
    fetchStaff();
  };

  const openRfidDialog = (member: StaffMember) => {
    setRfidTarget(member);
    setRfidValue(member.rfid_uid || "");
    setRfidDialogOpen(true);
  };

  const handleSaveRfid = async (scannedUid?: string) => {
    if (!rfidTarget) return;
    const uid = (scannedUid ?? rfidValue).trim();
    if (uid.length < 4) { toast.error("UID RFID minimal 4 karakter"); return; }
    setRfidSaving(true);
    // Check dup on profiles + students
    const { data: dupProfile } = await (supabase.from("profiles") as any)
      .select("user_id, full_name")
      .eq("school_id", schoolId).eq("rfid_uid", uid).neq("user_id", rfidTarget.user_id).maybeSingle();
    if (dupProfile) {
      setRfidSaving(false);
      toast.error(`UID sudah dipakai oleh ${dupProfile.full_name}`);
      return;
    }
    const { data: dupStudent } = await supabase.from("students")
      .select("id, name").eq("school_id", schoolId).eq("rfid_uid", uid).maybeSingle();
    if (dupStudent) {
      setRfidSaving(false);
      toast.error(`UID sudah dipakai oleh siswa ${dupStudent.name}`);
      return;
    }
    const { error } = await (supabase.from("profiles") as any).update({ rfid_uid: uid }).eq("user_id", rfidTarget.user_id);
    setRfidSaving(false);
    if (error) { toast.error("Gagal simpan RFID: " + error.message); return; }
    toast.success(`RFID untuk ${rfidTarget.full_name} berhasil didaftarkan`);
    setRfidDialogOpen(false);
    setRfidTarget(null);
    setRfidValue("");
    fetchStaff();
  };

  const handleRemoveRfid = async () => {
    if (!rfidTarget) return;
    setRfidSaving(true);
    const { error } = await (supabase.from("profiles") as any).update({ rfid_uid: null }).eq("user_id", rfidTarget.user_id);
    setRfidSaving(false);
    if (error) { toast.error("Gagal hapus RFID: " + error.message); return; }
    toast.success("RFID dihapus");
    setRfidDialogOpen(false);
    setRfidTarget(null);
    setRfidValue("");
    fetchStaff();
  };

  const handleTestRfid = (scannedUid?: string) => {
    const uid = (scannedUid ?? testRfidValue).trim();
    if (uid) setTestRfidValue(uid);
    if (!uid) { setTestRfidResult({ ok: false, msg: "Silakan scan atau ketik UID kartu terlebih dahulu" }); return; }
    const match = staff.find((s) => (s.rfid_uid || "").toString() === uid);
    if (match) {
      setTestRfidResult({ ok: true, msg: "Kartu dikenali", member: match });
    } else {
      setTestRfidResult({ ok: false, msg: `UID "${uid}" belum terdaftar untuk guru/staff mana pun.` });
    }
  };

  const getRoleBadges = (roles: string[]) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {roles.map((r) => {
        const meta = ROLE_META[r];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span
            key={r}
            title={meta.label}
            className={`inline-flex items-center justify-center h-5 w-5 rounded-md ${meta.cls}`}
          >
            <Icon className="h-3 w-3" />
          </span>
        );
      })}
    </div>
  );

  // Stats
  const totalGuru = staff.filter((s) => s.roles.includes("teacher")).length;
  const totalOperator = staff.filter((s) => s.roles.includes("staff")).length;
  const totalBendahara = staff.filter((s) => s.roles.includes("bendahara")).length;

  return (
    <PremiumGate featureLabel="Kelola Guru & Staff" featureKey="canMultiStaff" requiredPlan="School">
    <div className="space-y-6">
      <PageHeader icon={Shield} title="Guru & Staff" subtitle="Kelola akun guru, staff/operator, dan bendahara" actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setTestRfidValue(""); setTestRfidResult(null); setTestRfidOpen(true); }} variant="outline" className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-0 rounded-xl text-xs">
            <Nfc className="h-4 w-4 mr-2" /> Test RFID
          </Button>
          <Button onClick={() => setImportDialog(true)} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl text-xs">
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={() => setShowDialog(true)} className="bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl text-xs">
            <Plus className="h-4 w-4 mr-2" /> Tambah Akun
          </Button>
        </div>
      } />

      {/* Stats header */}
      {!loading && staff.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Total Akun", value: staff.length, Icon: Users2, color: "text-[#5B6CF9]", bg: "bg-[#5B6CF9]/10" },
              { label: "Guru", value: totalGuru, Icon: GraduationCap, color: "text-violet-600", bg: "bg-violet-500/10" },
              { label: "Operator", value: totalOperator, Icon: Shield, color: "text-[#5B6CF9]", bg: "bg-[#5B6CF9]/10" },
              { label: "Bendahara", value: totalBendahara, Icon: Wallet, color: "text-amber-600", bg: "bg-amber-500/10" },
            ].map(({ label, value, Icon, color, bg }) => (
              <Card key={label} className="border border-border/50 shadow-none">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight">{value}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info: dashboard access explanation */}
          <Card className="border border-border/50 shadow-none bg-gradient-to-br from-[#5B6CF9]/5 to-violet-500/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-[#5B6CF9]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">Keterangan Hak Akses</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Ikon pada kartu menunjukkan dashboard apa saja yang bisa dibuka oleh akun tersebut. Satu akun bisa memiliki lebih dari satu akses — saat login, pengguna akan diminta memilih dashboard yang ingin dibuka.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="flex items-start gap-2 rounded-lg bg-white/60 dark:bg-card/60 border border-border/50 p-2.5">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 shrink-0">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-tight">Guru</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Akses Dashboard Wali Kelas: kelola siswa & absensi kelasnya.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/60 dark:bg-card/60 border border-border/50 p-2.5">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[#5B6CF9]/10 text-[#5B6CF9] shrink-0">
                    <Shield className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-tight">Operator</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Akses Dashboard Sekolah: kelola seluruh data sekolah & absensi.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/60 dark:bg-card/60 border border-border/50 p-2.5">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 shrink-0">
                    <Wallet className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-tight">Bendahara</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Akses Dashboard SPP: kelola tagihan & pembayaran siswa.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
      ) : staff.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="p-10 text-center">
            <Users2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada guru/staff/bendahara ditambahkan</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Tambah Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {staff.map((member, i) => {
              const isHadir = !!member.presentToday;
              const accent = isHadir
                ? "hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5"
                : "hover:border-red-300 hover:bg-red-50/40 dark:hover:bg-red-500/5";
              const cornerColor = isHadir
                ? "bg-emerald-500/5 group-hover:bg-emerald-500/15"
                : "bg-red-500/5 group-hover:bg-red-500/15";
              const ringColor = isHadir ? "ring-emerald-400/60" : "ring-red-400/60";
              const isTeacher = member.roles.includes("teacher");
              const isBendahara = member.roles.includes("bendahara");
              const avatarBg = isTeacher ? "bg-gradient-to-br from-violet-500 to-purple-600" : isBendahara ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded]";
              return (
                <motion.div key={member.user_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card
                    onClick={() => openAttendance(member)}
                    className={`group relative border border-border/50 shadow-none transition-colors duration-300 cursor-pointer overflow-hidden h-full ${accent}`}
                  >
                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-[2.5rem] transition-all duration-500 group-hover:w-24 group-hover:h-24 ${cornerColor}`} />
                    <CardContent className="relative p-3 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="relative shrink-0">
                          {member.photo_url ? (
                            <img src={member.photo_url} alt={member.full_name} className={`h-11 w-11 rounded-full object-cover ring-2 ${ringColor}`} />
                          ) : (
                            <div className={`h-11 w-11 rounded-full ${avatarBg} flex items-center justify-center text-white text-sm font-bold ring-2 ${ringColor}`}>
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-card ${isHadir ? "bg-emerald-500" : "bg-red-500"} ${isHadir ? "animate-pulse" : ""}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm text-foreground truncate hover:underline">{member.full_name}</h3>
                          {member.nip && <p className="text-[10px] text-muted-foreground font-mono truncate">NIP {member.nip}</p>}
                          {getRoleBadges(member.roles)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">Hari ini</p>
                          <p className={`text-xs font-bold flex items-center gap-1 ${isHadir ? "text-emerald-600" : "text-red-600"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isHadir ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                            {isHadir ? `Hadir · ${member.arrivalTime}` : "Belum Hadir"}
                          </p>
                        </div>
                        <div className="flex gap-0 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${member.rfid_uid ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}
                            title={member.rfid_uid ? `RFID: ${member.rfid_uid}` : "Daftarkan RFID"}
                            onClick={() => openRfidDialog(member)}
                          >
                            <Nfc className={`h-3.5 w-3.5 ${member.rfid_uid ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="QR Absensi" onClick={() => { setQrTarget(member); setQrDialog(true); }}>
                            <QrCode className="h-3.5 w-3.5 text-[#5B6CF9]" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openDetail(member)}>
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" title="Hapus" onClick={() => handleDelete(member)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Akun Baru</DialogTitle>
            <DialogDescription>Buat akun login untuk guru, staff/operator, atau bendahara. Bisa pilih lebih dari satu role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Role / Hak Akses (bisa lebih dari 1)</Label>
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={formRoles.staff} onCheckedChange={(v) => setFormRoles({ ...formRoles, staff: !!v })} />
                  <Shield className="h-4 w-4 text-[#5B6CF9]" />
                  <span className="text-sm">Staff / Operator</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={formRoles.teacher} onCheckedChange={(v) => setFormRoles({ ...formRoles, teacher: !!v })} />
                  <GraduationCap className="h-4 w-4 text-violet-500" />
                  <span className="text-sm">Guru / Wali Kelas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={formRoles.bendahara} onCheckedChange={(v) => setFormRoles({ ...formRoles, bendahara: !!v })} />
                  <Wallet className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Bendahara (SPP)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={(formRoles as any).principal || false} onCheckedChange={(v) => setFormRoles({ ...formRoles, principal: !!v } as any)} />
                  <Shield className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm">Kepala Sekolah</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input placeholder="Nama lengkap" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email (untuk login)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="email@sekolah.com" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Minimal 6 karakter" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>No. WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="08xxxxxxxxxx" type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>NIP / NIK (opsional)</Label>
              <Input placeholder="Nomor Induk Pegawai" value={formNip} onChange={(e) => setFormNip(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jabatan</Label>
              <div className="flex gap-2">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  value={POSITION_PRESETS.includes(formPosition) ? formPosition : "__custom__"}
                  onChange={(e) => setFormPosition(e.target.value === "__custom__" ? "" : e.target.value)}
                >
                  {POSITION_PRESETS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="__custom__">Lainnya (custom)...</option>
                </select>
              </div>
              {!POSITION_PRESETS.includes(formPosition) && (
                <Input placeholder="Ketik jabatan custom" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} />
              )}
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full gradient-primary hover:opacity-90">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Membuat...</> : <><Plus className="h-4 w-4 mr-2" /> Buat Akun</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" />
              {editMode ? "Edit Data" : "Detail"}
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {selectedStaff.photo_url ? (
                    <img src={selectedStaff.photo_url} alt={selectedStaff.full_name} className="h-16 w-16 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className={`h-16 w-16 rounded-xl flex items-center justify-center text-white text-xl font-bold ${selectedStaff.roles.includes("teacher") ? "bg-violet-500" : selectedStaff.roles.includes("bendahara") ? "bg-amber-500" : "bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded]"}`}>
                      {selectedStaff.full_name.charAt(0)}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#5B6CF9] text-white flex items-center justify-center shadow-lg border-2 border-background hover:bg-[#4c5ded] transition disabled:opacity-50"
                    title="Upload foto untuk Face Recognition"
                  >
                    {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                  </button>
                </div>
                <div className="flex-1">
                  {editMode ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Nama</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="font-semibold" />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-lg">{selectedStaff.full_name}</h3>
                      {getRoleBadges(selectedStaff.roles)}
                      <p className="text-[10px] text-muted-foreground mt-1">Klik ikon kamera untuk upload foto Face Recognition</p>
                    </>
                  )}
                </div>
              </div>

              {editMode && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Role / Hak Akses (bisa pilih lebih dari 1)</Label>
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={editRoles.staff} onCheckedChange={(v) => setEditRoles({ ...editRoles, staff: !!v })} />
                        <Shield className="h-4 w-4 text-[#5B6CF9]" />
                        <span className="text-sm">Staff / Operator</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={editRoles.teacher} onCheckedChange={(v) => setEditRoles({ ...editRoles, teacher: !!v })} />
                        <GraduationCap className="h-4 w-4 text-violet-500" />
                        <span className="text-sm">Guru / Wali Kelas</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={editRoles.bendahara} onCheckedChange={(v) => setEditRoles({ ...editRoles, bendahara: !!v })} />
                        <Wallet className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">Bendahara (SPP)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={editRoles.principal} onCheckedChange={(v) => setEditRoles({ ...editRoles, principal: !!v })} />
                        <Shield className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm">Kepala Sekolah</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Email Login</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@sekolah.com" type="email" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">No. WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIP / NIK</Label>
                    <Input value={editNip} onChange={(e) => setEditNip(e.target.value)} placeholder="Nomor Induk Pegawai" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jabatan</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={POSITION_PRESETS.includes(editPosition) ? editPosition : "__custom__"}
                      onChange={(e) => setEditPosition(e.target.value === "__custom__" ? "" : e.target.value)}
                    >
                      {POSITION_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="__custom__">Lainnya (custom)...</option>
                    </select>
                    {!POSITION_PRESETS.includes(editPosition) && (
                      <Input className="mt-1" placeholder="Ketik jabatan custom" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Password Baru</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Kosongkan jika tidak diubah" type="password" className="pl-9" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {editMode ? (
                  <>
                    <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">Batal</Button>
                    <Button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 gradient-primary hover:opacity-90">
                      {savingEdit ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <><Pencil className="h-4 w-4 mr-1" /> Simpan</>}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditMode(true)} className="w-full" variant="outline">
                    <Pencil className="h-4 w-4 mr-1" /> Edit Data
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kartu Guru Dialog */}
      <Dialog open={qrDialog} onOpenChange={setQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#5B6CF9]" /> Kartu Digital
            </DialogTitle>
            <DialogDescription>
              Kartu identitas digital lengkap dengan QR untuk absensi. Klik tombol untuk mengunduh.
            </DialogDescription>
          </DialogHeader>
          {qrTarget && (
            <div className="py-2">
              <TeacherIdCard
                teacher={{
                  user_id: qrTarget.user_id,
                  full_name: qrTarget.full_name,
                  photo_url: qrTarget.photo_url,
                  qr_code: qrTarget.qr_code,
                  nip: qrTarget.nip,
                  phone: qrTarget.phone,
                  role_label: qrTarget.position || (qrTarget.roles.includes("teacher")
                    ? "Guru"
                    : qrTarget.roles.includes("bendahara")
                    ? "Bendahara"
                    : "Operator"),
                }}
                school={school}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importDialog} onOpenChange={(o) => { setImportDialog(o); if (!o) { setImportRows([]); setImportResults([]); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Import Massal</DialogTitle>
            <DialogDescription>Unduh template, isi data, lalu upload untuk membuat banyak akun sekaligus.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold">Langkah:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Unduh template Excel di bawah ini</li>
                <li>Isi kolom: <span className="font-mono">full_name, email, password, role, phone</span></li>
                <li>Kolom <span className="font-mono">role</span>: <span className="font-mono">teacher</span>, <span className="font-mono">staff</span>, atau <span className="font-mono">bendahara</span></li>
                <li>Hapus baris contoh, lalu upload file</li>
              </ol>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Unduh Template Excel
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Upload File (.xlsx / .csv)</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} disabled={importing} />
            </div>

            {importRows.length > 0 && importResults.length === 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-semibold text-primary">{importRows.length} baris siap diimport</p>
                <p className="text-xs text-muted-foreground mt-1">Klik tombol "Mulai Import" untuk memproses.</p>
              </div>
            )}

            {importResults.length > 0 && (
              <div className="rounded-lg border border-border max-h-56 overflow-y-auto">
                {importResults.map((r, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border/50 last:border-0 ${r.ok ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                    {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{r.name} <span className="text-muted-foreground font-normal">({r.email})</span></p>
                      {!r.ok && <p className="text-red-600 dark:text-red-400">{r.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setImportDialog(false)} disabled={importing}>Tutup</Button>
              <Button className="flex-1 gradient-primary hover:opacity-90" onClick={handleBulkImport} disabled={importing || importRows.length === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : <><Upload className="h-4 w-4 mr-2" /> Mulai Import</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StaffAttendanceDetailDialog
        open={attendanceDialog}
        onOpenChange={setAttendanceDialog}
        userId={attendanceTarget?.user_id || null}
        fullName={attendanceTarget?.full_name || ""}
        schoolId={schoolId}
        photoUrl={attendanceTarget?.photo_url || null}
        roles={attendanceTarget?.roles || []}
        nip={attendanceTarget?.nip || null}
        phone={attendanceTarget?.phone || null}
      />

      {/* RFID Register Dialog */}
      <Dialog open={rfidDialogOpen} onOpenChange={(o) => { setRfidDialogOpen(o); if (!o) { setRfidTarget(null); setRfidValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Nfc className="h-5 w-5 text-emerald-600" /> Daftarkan Kartu RFID
            </DialogTitle>
            <DialogDescription>
              {rfidTarget ? (<>Tempelkan kartu RFID pada reader untuk <b>{rfidTarget.full_name}</b>.</>) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>UID Kartu RFID</Label>
              <Input
                autoFocus
                placeholder="Tempel kartu atau ketik UID..."
                value={rfidValue}
                onChange={(e) => setRfidValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && rfidValue.trim().length >= 4) handleSaveRfid(); }}
                className="font-mono text-lg tracking-wider"
              />
              <p className="text-xs text-muted-foreground">
                Sebagian besar RFID reader USB akan otomatis mengetik UID lalu menekan Enter.
              </p>
            </div>
            <NfcScanButton onUid={(uid) => { setRfidValue(uid); handleSaveRfid(uid); }} />
            <div className="flex gap-2">
              {rfidTarget?.rfid_uid && (
                <Button variant="outline" onClick={handleRemoveRfid} disabled={rfidSaving} className="text-destructive hover:text-destructive">
                  Hapus RFID
                </Button>
              )}
              <Button onClick={() => handleSaveRfid()} disabled={rfidSaving || rfidValue.trim().length < 4} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {rfidSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Nfc className="h-4 w-4 mr-1" />}
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test RFID Dialog */}
      <Dialog open={testRfidOpen} onOpenChange={(o) => { setTestRfidOpen(o); if (!o) { setTestRfidValue(""); setTestRfidResult(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Nfc className="h-5 w-5 text-emerald-600" /> Test RFID Reader
            </DialogTitle>
            <DialogDescription>
              Tempelkan kartu pada reader untuk memastikan RFID berfungsi & UID terdaftar untuk guru/staff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>UID Kartu</Label>
              <Input
                autoFocus
                placeholder="Menunggu scan kartu..."
                value={testRfidValue}
                onChange={(e) => { setTestRfidValue(e.target.value); setTestRfidResult(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleTestRfid(); }}
                className="font-mono text-lg tracking-wider"
              />
            </div>
            <NfcScanButton onUid={(uid) => { setTestRfidValue(uid); handleTestRfid(uid); }} />
            <Button onClick={() => handleTestRfid()} disabled={!testRfidValue.trim()} className="w-full bg-[#5B6CF9] hover:bg-[#5065E8] text-white">
              Cek UID
            </Button>
            {testRfidResult && (
              <div className={`rounded-lg border p-3 ${testRfidResult.ok ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"}`}>
                <div className="flex items-start gap-2">
                  {testRfidResult.ok
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
                  <div className="text-sm">
                    <p className={`font-semibold ${testRfidResult.ok ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                      {testRfidResult.msg}
                    </p>
                    {testRfidResult.member && (
                      <div className="mt-2 space-y-0.5 text-muted-foreground">
                        <p><b className="text-foreground">{testRfidResult.member.full_name}</b></p>
                        <p>Jabatan: {testRfidResult.member.position || "-"}</p>
                        {testRfidResult.member.nip && <p>NIP: <span className="font-mono">{testRfidResult.member.nip}</span></p>}
                        <p>UID: <span className="font-mono">{testRfidResult.member.rfid_uid}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PremiumGate>
  );
};

export default ManageStaff;
