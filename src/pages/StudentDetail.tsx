import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, User, Phone, GraduationCap, Hash, Clock, UserCheck, Calendar,
  QrCode, Shield, Camera, Loader2, Pencil, Save, X, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { motion } from "framer-motion";
import { toast } from "sonner";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import jsPDF from "jspdf";
import "jspdf-autotable";

const STATUS_COLORS: Record<string, string> = {
  hadir: "bg-success/10 text-success",
  izin: "bg-warning/10 text-warning",
  sakit: "bg-blue-100 text-blue-600",
  alfa: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa" };
const STATUS_CODES: Record<string, string> = { hadir: "H", sakit: "S", izin: "I", alfa: "A" };
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const features = useSubscriptionFeatures();
  const [student, setStudent] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", class: "", student_id: "", parent_name: "", parent_phone: "", gender: "L" });
  const [saving, setSaving] = useState(false);
  const [qrInstructions, setQrInstructions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "monthly">("list");
  const [recapMonth, setRecapMonth] = useState(new Date());
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
  const [waliKelasName, setWaliKelasName] = useState("");
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  const fetchData = async () => {
    if (!id || !profile?.school_id) return;
    const [studentRes, logsRes, schoolRes, instrRes, classesRes, studentsRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).eq("school_id", profile.school_id).single(),
      supabase.from("attendance_logs").select("*").eq("student_id", id).eq("school_id", profile.school_id).order("date", { ascending: false }).order("time", { ascending: false }).limit(30),
      supabase.from("schools").select("name, logo, address").eq("id", profile.school_id).single(),
      supabase.from("qr_instructions").select("instruction_text").eq("school_id", profile.school_id).order("sort_order"),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("students").select("class").eq("school_id", profile.school_id),
    ]);
    // Build available classes from both tables
    const classSet = new Set<string>();
    (classesRes.data || []).forEach((c: any) => classSet.add(c.name));
    (studentsRes.data || []).forEach((s: any) => classSet.add(s.class));
    setAvailableClasses(Array.from(classSet).sort());
    setStudent(studentRes.data);
    setAttendanceHistory(logsRes.data || []);
    setSchool(schoolRes.data);
    if (instrRes.data?.length) setQrInstructions(instrRes.data.map((r: any) => r.instruction_text));
    if (studentRes.data) {
      setEditForm({
        name: studentRes.data.name, class: studentRes.data.class, student_id: studentRes.data.student_id,
        parent_name: studentRes.data.parent_name, parent_phone: studentRes.data.parent_phone,
        gender: studentRes.data.gender || "L",
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, profile?.school_id]);

  // Fetch monthly logs for recap view
  useEffect(() => {
    if (!id || !profile?.school_id || viewMode !== "monthly") return;
    const year = recapMonth.getFullYear();
    const month = recapMonth.getMonth();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

    supabase.from("attendance_logs").select("date, status, time, method")
      .eq("student_id", id).eq("school_id", profile.school_id)
      .gte("date", startDate).lte("date", endDate)
      .then(({ data }) => setMonthlyLogs(data || []));
  }, [id, profile?.school_id, recapMonth, viewMode]);

  // Fetch wali kelas
  useEffect(() => {
    if (!student || !profile?.school_id) return;
    supabase.from("class_teachers").select("user_id")
      .eq("school_id", profile.school_id).eq("class_name", student.class).maybeSingle()
      .then(({ data }) => {
        if (data?.user_id) {
          supabase.from("profiles").select("full_name").eq("user_id", data.user_id).maybeSingle()
            .then(({ data: prof }) => setWaliKelasName(prof?.full_name || ""));
        }
      });
  }, [student, profile?.school_id]);

  const handlePhotoUpload = async (file: File) => {
    if (!features.canUploadPhoto || !student) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile?.school_id}/${student.id}.${ext}`;
    const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: true });
    if (error) { toast.error("Gagal upload: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("students").update({ photo_url: newUrl }).eq("id", student.id);
    toast.success("Foto berhasil diupload!");
    setUploading(false);
    fetchData();
  };

  const handlePhotoDelete = async () => {
    if (!student?.photo_url) return;
    const confirmed = window.confirm("Hapus foto profil siswa ini?");
    if (!confirmed) return;
    setUploading(true);
    // Try to remove from storage
    const url = student.photo_url.split("?")[0];
    const pathMatch = url.split("/student-photos/")[1];
    if (pathMatch) {
      await supabase.storage.from("student-photos").remove([decodeURIComponent(pathMatch)]);
    }
    await supabase.from("students").update({ photo_url: null }).eq("id", student.id);
    toast.success("Foto berhasil dihapus!");
    setUploading(false);
    fetchData();
  };

  const handleSaveEdit = async () => {
    if (!student) return;
    setSaving(true);
    const { error } = await supabase.from("students").update({
      name: editForm.name, class: editForm.class, student_id: editForm.student_id,
      parent_name: editForm.parent_name, parent_phone: editForm.parent_phone, gender: editForm.gender,
    }).eq("id", student.id);
    setSaving(false);
    if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
    toast.success("Data siswa berhasil diperbarui!");
    setEditing(false);
    fetchData();
  };

  // Monthly recap data
  const daysInMonth = new Date(recapMonth.getFullYear(), recapMonth.getMonth() + 1, 0).getDate();
  const monthLabel = `${MONTH_NAMES[recapMonth.getMonth()]} ${recapMonth.getFullYear()}`;

  const monthlyData = useMemo(() => {
    const days: Record<number, string> = {};
    const totals = { H: 0, S: 0, I: 0, A: 0 };
    monthlyLogs.forEach(l => {
      const day = parseInt(l.date.split("-")[2]);
      const code = STATUS_CODES[l.status] || "";
      days[day] = code;
      if (code in totals) totals[code as keyof typeof totals]++;
    });
    return { days, totals };
  }, [monthlyLogs]);

  const getCellBadge = (code: string) => {
    switch (code) {
      case "H": return "bg-emerald-500 text-white";
      case "S": return "bg-violet-500 text-white";
      case "I": return "bg-amber-400 text-white";
      case "A": return "bg-red-500 text-white";
      default: return "";
    }
  };

  const exportStudentPDF = () => {
    if (!student) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("REKAP ABSENSI SISWA", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(`BULAN : ${monthLabel.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 22, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Nama : ${student.name}`, 14, 30);
    doc.text(`NIS : ${student.student_id}  |  Kelas : ${student.class}`, 14, 36);

    const head = [["NO", "TANGGAL", "STATUS", "WAKTU", "METODE"]];
    const body = monthlyLogs.map((l, i) => [
      i + 1,
      new Date(l.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      STATUS_LABELS[l.status] || l.status,
      l.time?.slice(0, 5) || "-",
      l.method === "face" ? "Face Recognition" : l.method === "manual" ? "Manual" : "Barcode",
    ]);

    const statusColors: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
      Hadir: { bg: [220, 252, 231], fg: [22, 163, 74] },
      Sakit: { bg: [219, 234, 254], fg: [37, 99, 235] },
      Izin: { bg: [254, 249, 195], fg: [202, 138, 4] },
      Alfa: { bg: [254, 202, 202], fg: [220, 38, 38] },
    };

    (doc as any).autoTable({
      startY: 42,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [79, 70, 229] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 2) {
          const text = String(data.cell.raw);
          if (statusColors[text]) {
            data.cell.styles.fillColor = statusColors[text].bg;
            data.cell.styles.textColor = statusColors[text].fg;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFontSize(9);
        doc.text(`Ringkasan: H=${monthlyData.totals.H}  S=${monthlyData.totals.S}  I=${monthlyData.totals.I}  A=${monthlyData.totals.A}`, 14, pageH - 30);
        doc.text(`${school?.address || school?.name || ""}, ........................ ${recapMonth.getFullYear()}`, pageW - 14, pageH - 25, { align: "right" });
        doc.text(`WALI KELAS ${student.class}`, pageW - 14, pageH - 20, { align: "right" });
        doc.text(waliKelasName ? `( ${waliKelasName} )` : "(..................................)", pageW - 14, pageH - 8, { align: "right" });
      },
    });

    doc.save(`Absensi-${student.name}-${monthLabel}.pdf`);
    toast.success("PDF berhasil diunduh!");
  };

  const exportStudentExcel = () => {
    if (!student) return;
    const totalCols = daysInMonth + 7;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
      td, th { border: 1px solid #999; padding: 3px; font-family: Arial; font-size: 9pt; text-align: center; }
      th { background: #4f46e5; color: white; font-weight: bold; }
      .H { background: #dcfce7; color: #16a34a; font-weight: bold; }
      .S { background: #dbeafe; color: #2563eb; font-weight: bold; }
      .I { background: #fef9c3; color: #ca8a04; font-weight: bold; }
      .A { background: #fecaca; color: #dc2626; font-weight: bold; }
      .title { font-size: 14pt; font-weight: bold; text-align: center; border: none; }
      .subtitle { font-size: 11pt; text-align: center; border: none; }
      .name { text-align: left; }
    </style></head><body><table>`;

    html += `<tr><td colspan="${daysInMonth + 4}" class="title">REKAP ABSENSI SISWA</td></tr>`;
    html += `<tr><td colspan="${daysInMonth + 4}" class="subtitle">BULAN : ${monthLabel.toUpperCase()}</td></tr>`;
    html += `<tr><td colspan="${daysInMonth + 4}" class="subtitle">Nama : ${student.name} | NIS : ${student.student_id} | Kelas : ${student.class}</td></tr>`;
    html += `<tr><td colspan="${daysInMonth + 4}"></td></tr>`;

    // Header row with day numbers
    html += `<tr>`;
    for (let d = 1; d <= daysInMonth; d++) html += `<th>${d}</th>`;
    html += `<th class="H">H</th><th class="S">S</th><th class="I">I</th><th class="A">A</th></tr>`;

    // Data row
    html += `<tr>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const code = monthlyData.days[d] || "";
      html += `<td${code ? ` class="${code}"` : ""}>${code}</td>`;
    }
    html += `<td class="H">${monthlyData.totals.H}</td><td class="S">${monthlyData.totals.S}</td>`;
    html += `<td class="I">${monthlyData.totals.I}</td><td class="A">${monthlyData.totals.A}</td></tr>`;

    html += `</table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Absensi-${student.name}-${monthLabel}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel berhasil diunduh!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mx-auto animate-pulse">
            <User className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Siswa tidak ditemukan</p>
        <Button variant="outline" onClick={() => navigate("/students")}><ArrowLeft className="h-4 w-4 mr-2" /> Kembali</Button>
      </div>
    );
  }

  const totalHadir = attendanceHistory.filter(l => l.status === "hadir").length;
  const totalIzin = attendanceHistory.filter(l => l.status === "izin").length;
  const totalSakit = attendanceHistory.filter(l => l.status === "sakit").length;
  const totalAlfa = attendanceHistory.filter(l => l.status === "alfa").length;
  const todayLog = attendanceHistory.find(l => l.date === new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
      </Button>

      {/* Student header card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-28 sm:h-32 bg-gradient-to-br from-[#5B6CF9] to-[#3D4FE0]" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-14">
              <div className="relative group">
                {student.photo_url ? (
                  <img src={student.photo_url} alt={student.name} className="h-24 w-24 rounded-2xl object-cover border-4 border-card bg-card shadow-elevated" />
                ) : (
                  <div className="h-24 w-24 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-3xl font-bold border-4 border-card bg-card shadow-elevated shrink-0">
                    {student.name.charAt(0)}
                  </div>
                )}
                {features.canUploadPhoto && (
                  <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer hover:bg-black/50">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]); }} />
                    {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white drop-shadow-md" />}
                    <span className="text-white text-[10px] font-medium mt-0.5">Ganti Foto</span>
                    {student.photo_url && (
                      <button
                        type="button"
                        className="relative z-20 mt-1 px-2 py-0.5 bg-destructive/80 hover:bg-destructive text-white text-[10px] rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); handlePhotoDelete(); }}
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left flex-1 pb-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-2xl font-bold bg-card/80 backdrop-blur-sm px-3 py-1 rounded-lg inline-block">{student.name}</h1>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm rounded-lg" onClick={() => setEditing(!editing)}>
                    {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs"><GraduationCap className="h-3 w-3 mr-1" />Kelas {student.class}</Badge>
                  <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-1" />NIS: {student.student_id}</Badge>
                  {todayLog ? (
                    <Badge className={`text-xs border-0 ${STATUS_COLORS[todayLog.status]}`}>{STATUS_LABELS[todayLog.status] || todayLog.status}</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Belum Absen Hari Ini</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Hadir", value: totalHadir, color: "text-success", bg: "bg-success/10" },
          { label: "Izin", value: totalIzin, color: "text-warning", bg: "bg-warning/10" },
          { label: "Sakit", value: totalSakit, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Alfa", value: totalAlfa, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((s) => (
          <Card key={s.label} className="shadow-card border-0">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Form */}
      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card className="shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Edit Data Siswa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nama Lengkap</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select value={editForm.class} onValueChange={(val) => setEditForm({ ...editForm, class: val })}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                    <SelectContent>
                      {availableClasses.map((cls) => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>NIS</Label><Input value={editForm.student_id} onChange={(e) => setEditForm({ ...editForm, student_id: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nama Wali</Label><Input value={editForm.parent_name} onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>No. HP Wali</Label><Input value={editForm.parent_phone} onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin</Label>
                  <Select value={editForm.gender} onValueChange={(val) => setEditForm({ ...editForm, gender: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={saving} className="gradient-primary hover:opacity-90">
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card border-0 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Identitas Lengkap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoItem icon={User} label="Nama Lengkap" value={student.name} />
                <InfoItem icon={GraduationCap} label="Kelas" value={student.class} />
                <InfoItem icon={Hash} label="NIS" value={student.student_id} />
                <InfoItem icon={Calendar} label="Terdaftar" value={new Date(student.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} />
              </div>
              {student.card_number && (
                <div className="border-t pt-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Kode Kartu (16 digit)</p>
                  <div className="rounded-lg bg-gradient-to-r from-[#5B6CF9]/10 to-[#4c5ded]/10 border border-[#5B6CF9]/20 px-3 py-2.5">
                    <p className="font-mono text-sm font-bold tracking-[0.15em] text-foreground break-all">
                      {String(student.card_number).replace(/(\d{4})(?=\d)/g, "$1 ")}
                    </p>
                  </div>
                </div>
              )}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Wali / Orang Tua</p>
                <InfoItem icon={User} label="Nama Wali" value={student.parent_name} />
                <InfoItem icon={Phone} label="No. HP Wali" value={student.parent_phone} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-card border-0 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" />Barcode Siswa</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <QRCodeDisplay data={student.qr_code || student.student_id} size={200}
                studentName={student.name} studentClass={student.class}
                schoolName={school?.name} schoolLogo={school?.logo}
                customInstructions={qrInstructions.length > 0 ? qrInstructions : undefined} />
              <p className="text-xs text-muted-foreground mt-3 text-center">Scan kode ini untuk mencatat kehadiran</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Attendance History Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />Riwayat Kehadiran
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">Daftar</SelectItem>
                    <SelectItem value="monthly">Rekap Bulanan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "list" ? (
              /* List view */
              attendanceHistory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Belum ada riwayat kehadiran</p>
              ) : (
                <div className="space-y-3">
                  {attendanceHistory.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${STATUS_COLORS[log.status]?.split(" ")[0] || "bg-muted"}`}>
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{new Date(log.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.time?.slice(0, 5)} • {log.method === "face" ? "Face Recognition" : log.method === "manual" ? "Manual" : "Barcode"}
                          {log.attendance_type === "pulang" && " • Pulang"}
                          {log.recorded_by && ` • oleh ${log.recorded_by}`}
                        </p>
                      </div>
                      <Badge className={`text-[10px] border-0 shrink-0 ${STATUS_COLORS[log.status] || ""}`}>
                        {STATUS_LABELS[log.status] || log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Monthly recap view */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRecapMonth(new Date(recapMonth.getFullYear(), recapMonth.getMonth() - 1, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold min-w-[130px] text-center">{monthLabel}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRecapMonth(new Date(recapMonth.getFullYear(), recapMonth.getMonth() + 1, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={exportStudentExcel}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={exportStudentPDF}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">H</span> Hadir</div>
                  <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-violet-500 text-white text-[10px] font-bold">S</span> Sakit</div>
                  <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-amber-400 text-white text-[10px] font-bold">I</span> Izin</div>
                  <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-red-500 text-white text-[10px] font-bold">A</span> Alfa</div>
                  <div className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-muted border border-border text-[10px]"></span> Tidak ada data</div>
                </div>

                {/* Monthly grid - matching ExportHistory style */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th colSpan={daysInMonth} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Tanggal</th>
                        <th colSpan={4} className="px-1 py-2 text-center font-bold text-primary uppercase text-[10px] tracking-wider">Keterangan</th>
                      </tr>
                      <tr className="border-b border-border bg-muted/30">
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i} className="px-0.5 py-1.5 text-center font-medium text-muted-foreground w-7 text-[10px]">{i + 1}</th>
                        ))}
                        <th className="px-1 py-1.5 text-center font-bold text-emerald-600 w-7 text-[10px]">H</th>
                        <th className="px-1 py-1.5 text-center font-bold text-violet-600 w-7 text-[10px]">S</th>
                        <th className="px-1 py-1.5 text-center font-bold text-amber-600 w-7 text-[10px]">I</th>
                        <th className="px-1 py-1.5 text-center font-bold text-red-600 w-7 text-[10px]">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        {Array.from({ length: daysInMonth }, (_, d) => {
                          const code = monthlyData.days[d + 1] || "";
                          const badgeClass = getCellBadge(code);
                          return (
                            <td key={d} className="px-0 py-2 text-center">
                              {code ? (
                                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold ${badgeClass}`}>
                                  {code}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted/40 border border-border/30" />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-1 py-2 text-center font-bold text-emerald-600">{monthlyData.totals.H}</td>
                        <td className="px-1 py-2 text-center font-bold text-violet-600">{monthlyData.totals.S}</td>
                        <td className="px-1 py-2 text-center font-bold text-amber-600">{monthlyData.totals.I}</td>
                        <td className="px-1 py-2 text-center font-bold text-red-600">{monthlyData.totals.A}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signature area */}
                <div className="flex justify-end pt-4">
                  <div className="text-center text-xs text-muted-foreground space-y-1">
                    <p>{school?.address || school?.name || ""}, ........................ {recapMonth.getFullYear()}</p>
                    <p className="font-semibold text-foreground">WALI KELAS {student.class}</p>
                    <div className="h-16" />
                    <p className="font-semibold text-foreground border-b border-foreground inline-block min-w-[180px]">
                      {waliKelasName ? `( ${waliKelasName} )` : "(.................................)"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium">{value}</span>
    </div>
  </div>
);

export default StudentDetail;
