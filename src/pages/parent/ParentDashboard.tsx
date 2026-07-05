import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, LogOut, GraduationCap, CalendarDays, Megaphone, FileText,
  Phone, ClipboardList, BookOpen, CheckCircle2, XCircle, Clock,
  Sparkles, TrendingUp, Pin, Paperclip, MessageCircle, User, MapPin, Bell,
  Wallet, AlertCircle, Download, ExternalLink, RefreshCw, Receipt, MoreHorizontal,
  Send, ScanLine, History as HistoryIcon, Home, Briefcase, LayoutGrid, UserCircle2,
  ArrowUpRight, Grid3x3, CreditCard, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { downloadSppInvoicePDF } from "@/lib/sppInvoicePDF";
import { PaymentIframeDialog } from "@/components/PaymentIframeDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import atskollaLogo from "@/assets/Logo_atskolla.png";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";
import { isWorkingDay } from "@/lib/holidays";
import { StudentIdCard } from "@/components/StudentIdCard";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import type { PaymentChannelId } from "@/lib/paymentChannels";

const STATUS_COLORS: Record<string, string> = {
  hadir: "#10b981",
  izin: "#f59e0b",
  sakit: "#0ea5e9",
  alfa: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa" };

function buildChartData(attendance: any[], period: "day" | "week" | "month") {
  const buckets: { key: string; name: string; date: Date }[] = [];
  const now = new Date();
  if (period === "day") {
    // jam 06-18 tiap 2 jam
    for (let h = 6; h <= 18; h += 2) {
      const d = new Date(now); d.setHours(h, 0, 0, 0);
      buckets.push({ key: `${d.toISOString().slice(0,10)}-${h}`, name: `${String(h).padStart(2,"0")}:00`, date: d });
    }
  } else {
    const days = period === "week" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        name: period === "week"
          ? d.toLocaleDateString("id-ID", { weekday: "short" })
          : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        date: d,
      });
    }
  }
  return buckets.map((b) => {
    const counts: any = { name: b.name, hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    if (period === "day") {
      const dayKey = now.toISOString().slice(0, 10);
      attendance.forEach((a) => {
        if (a.date !== dayKey) return;
        const hh = parseInt((a.time || "00:00").slice(0, 2), 10);
        if (hh >= b.date.getHours() && hh < b.date.getHours() + 2) counts[a.status] = (counts[a.status] || 0) + 1;
      });
    } else {
      const dayKey = b.date.toISOString().slice(0, 10);
      attendance.forEach((a) => { if (a.date === dayKey) counts[a.status] = (counts[a.status] || 0) + 1; });
    }
    return counts;
  });
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  hadir: { label: "Hadir", cls: "bg-emerald-500 text-white" },
  izin: { label: "Izin", cls: "bg-amber-500 text-white" },
  sakit: { label: "Sakit", cls: "bg-sky-500 text-white" },
  alfa: { label: "Alfa", cls: "bg-red-500 text-white" },
};

const PRIMARY_TABS = [
  { id: "home", label: "Beranda", icon: Sparkles },
  { id: "attendance", label: "Absensi", icon: ClipboardList },
  { id: "spp", label: "SPP", icon: Wallet },
  { id: "schedule", label: "Jadwal", icon: CalendarDays },
];

const MORE_TABS = [
  { id: "info", label: "Pengumuman", icon: Megaphone, desc: "Info & berita sekolah" },
  { id: "leave", label: "Pengajuan Izin", icon: FileText, desc: "Ajukan izin/sakit" },
  { id: "contact", label: "Kontak Wali Kelas", icon: Phone, desc: "Hubungi guru" },
];

export default function ParentDashboard() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem("parent_token") || "");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>(() => localStorage.getItem("parent_selected_student") || "");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");

  const [attendance, setAttendance] = useState<any[]>([]);
  const [attTypeTab, setAttTypeTab] = useState<"datang" | "pulang">("datang");
  const [schedule, setSchedule] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [homeroom, setHomeroom] = useState<any>(null);
  const [statPeriod, setStatPeriod] = useState<"day" | "week" | "month">("week");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sppData, setSppData] = useState<{ aktif: any[]; tunggakan: any[]; lunas: any[]; total_tunggakan: number }>({ aktif: [], tunggakan: [], lunas: [], total_tunggakan: 0 });
  const [sppBusy, setSppBusy] = useState<string | null>(null);
  const [paymentIframe, setPaymentIframe] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInvoice, setPickerInvoice] = useState<any>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").eq("key", "login_logo_url").maybeSingle().then(({ data }) => {
      if (data?.value) setHeaderLogo(data.value as string);
    });
  }, []);

  const [leaveForm, setLeaveForm] = useState<{ type: string; date: string; reason: string; attachment_url: string | null }>({ type: "izin", date: new Date().toISOString().slice(0, 10), reason: "", attachment_url: null });

  const invoke = useCallback(async (action: string, body: any = {}) => {
    const res = await fetch(`https://bohuglednqirnaearrkj.supabase.co/functions/v1/parent-portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-parent-token": token },
      body: JSON.stringify({ action, ...body }),
    });
    return res.json();
  }, [token]);

  useEffect(() => {
    if (!token) { navigate("/parent/login"); return; }
    invoke("me").then((d) => {
      if (d?.code === "UNAUTH") { localStorage.removeItem("parent_token"); navigate("/parent/login"); return; }
      setStudents(d.students || []);
      if (d.students?.length) {
        const saved = localStorage.getItem("parent_selected_student");
        const exists = saved && d.students.some((s: any) => s.id === saved);
        setSelectedStudent(exists ? saved! : d.students[0].id);
      }
      setLoading(false);
    });
  }, [token, invoke, navigate]);

  // Persist selected student across refreshes
  useEffect(() => {
    if (selectedStudent) localStorage.setItem("parent_selected_student", selectedStudent);
  }, [selectedStudent]);

  const loadTab = useCallback(async () => {
    if (!selectedStudent) return;
    const body = { student_id: selectedStudent };
    if (tab === "home") {
      const [a, s, n, sp] = await Promise.all([
        invoke("attendance", body),
        invoke("schedule", body),
        invoke("announcements", body),
        invoke("spp_list", body),
      ]);
      setAttendance(a.attendance || []);
      setSchedule(s.schedule || []);
      setAnnouncements(n.announcements || []);
      setSppData({ aktif: sp.aktif || [], tunggakan: sp.tunggakan || [], lunas: sp.lunas || [], total_tunggakan: sp.total_tunggakan || 0 });
    } else if (tab === "attendance") {
      const d = await invoke("attendance", body); setAttendance(d.attendance || []);
    } else if (tab === "schedule") {
      const d = await invoke("schedule", body); setSchedule(d.schedule || []);
    } else if (tab === "info") {
      const d = await invoke("announcements", body); setAnnouncements(d.announcements || []);
    } else if (tab === "leave") {
      const d = await invoke("list_leaves", body); setLeaves(d.leaves || []);
    } else if (tab === "contact") {
      const d = await invoke("homeroom", body); setHomeroom(d);
    } else if (tab === "spp") {
      const d = await invoke("spp_list", body);
      setSppData({ aktif: d.aktif || [], tunggakan: d.tunggakan || [], lunas: d.lunas || [], total_tunggakan: d.total_tunggakan || 0 });
    }
  }, [tab, selectedStudent, invoke]);

  // Membuka picker channel pembayaran (sebelum benar-benar membuat link Mayar).
  const paySpp = (invoiceOrId: any) => {
    // Cari objek invoice lengkap supaya bisa tampilkan info di picker.
    const list = [...(sppData.tunggakan || []), ...(sppData.aktif || [])];
    const inv = typeof invoiceOrId === "string"
      ? list.find((x: any) => x.id === invoiceOrId)
      : invoiceOrId;
    if (!inv) { toast.error("Tagihan tidak ditemukan"); return; }
    setPickerInvoice(inv);
    setPickerOpen(true);
  };

  const confirmPaySpp = async (channel: PaymentChannelId, _fee: number, _total: number) => {
    if (!pickerInvoice) return;
    setPickerLoading(true);
    setSppBusy(pickerInvoice.id);
    const d = await invoke("spp_pay", { student_id: selectedStudent, invoice_id: pickerInvoice.id, channel });
    setSppBusy(null);
    setPickerLoading(false);
    if (d?.error) { toast.error(d.error); return; }
    if (d?.payment_url) {
      setPickerOpen(false);
      setPayingInvoiceId(pickerInvoice.id);
      setPaymentIframe(d.payment_url);
      toast.success("Membuka halaman pembayaran...");
    }
  };

  const downloadSppPdf = async (inv: any) => {
    setSppBusy(`pdf-${inv.id}`);
    try {
      const sch = await invoke("school_info", { student_id: selectedStudent });
      await downloadSppInvoicePDF({
        invoice: inv,
        student: { student_id: current?.student_id, parent_name: current?.parent_name },
        school: sch?.school || { name: "Sekolah" },
      });
      toast.success("Invoice diunduh");
    } catch (e: any) { toast.error(e.message || "Gagal"); }
    finally { setSppBusy(null); }
  };

  useEffect(() => { loadTab(); }, [loadTab]);

  const logout = async () => {
    await invoke("logout");
    localStorage.removeItem("parent_token");
    localStorage.removeItem("parent_phone");
    navigate("/parent/login");
  };

  const submitLeave = async () => {
    if (!leaveForm.reason.trim()) return toast.error("Alasan wajib diisi");
    const d = await invoke("submit_leave", { student_id: selectedStudent, ...leaveForm });
    if (d?.error) return toast.error(d.error);
    toast.success("Pengajuan terkirim, menunggu persetujuan wali kelas");
    setLeaveForm({ type: "izin", date: new Date().toISOString().slice(0, 10), reason: "", attachment_url: null });
    loadTab();
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Maks 5MB");
    setUploadingFile(true);
    try {
      const ext = file.name.split(".").pop();
      // Use an unguessable random path so filenames do not encode any
      // identifiable info (student id, timestamp). The bucket is public-read,
      // so unpredictability is what protects the file.
      const rand = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `leave/${rand}.${ext}`;
      const { error } = await supabase.storage.from("parent-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("parent-attachments").getPublicUrl(path);
      setLeaveForm((f) => ({ ...f, attachment_url: data.publicUrl }));
      toast.success("Lampiran terupload");
    } catch (e: any) {
      toast.error(e.message || "Gagal upload");
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#5B6CF9]" /></div>;

  if (students.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-sm text-muted-foreground mb-4">Tidak ada data siswa terhubung dengan nomor Anda.</p>
          <Button onClick={logout} variant="outline">Keluar</Button>
        </Card>
      </div>
    );
  }

  const current = students.find((s) => s.id === selectedStudent);


  // Compute today summary for hero card (gunakan tanggal lokal WIB & abaikan auto-alfa)
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayRealLog = attendance.find((a) => a.date === todayKey && a.method !== "auto");
  const todayApprovedLeave = leaves.find((l) => l.date === todayKey && l.status === "approved");
  const todayLog = todayRealLog
    || (todayApprovedLeave ? { status: todayApprovedLeave.type, date: todayKey } : null);
  const monthAttendance = attendance.filter((a) => {
    const d = new Date(a.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });
  const monthHadir = monthAttendance.filter((a) => a.status === "hadir").length;
  // Denominator: jumlah hari kerja (skip weekend & libur nasional) yang sudah berjalan bulan ini.
  // Sama untuk semua siswa, jadi persentasenya adil.
  const _now = new Date();
  let workingDaysElapsed = 0;
  for (let day = 1; day <= _now.getDate(); day++) {
    const d = new Date(_now.getFullYear(), _now.getMonth(), day);
    if (isWorkingDay(d)) workingDaysElapsed++;
  }
  const monthRate = workingDaysElapsed ? Math.round((monthHadir / workingDaysElapsed) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F5FB] via-background to-background pb-32 md:pb-10">

      {/* TOP BAR — full width, sticky, spans across sidebar + content */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="max-w-md md:max-w-6xl mx-auto px-5 md:px-6 py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shrink-0 shadow-[0_8px_20px_-6px_rgba(91,108,249,0.55)]">
                <img src={headerLogo || atskollaLogo} alt="Logo Sekolah" className="h-5 w-5 md:h-6 md:w-6 object-contain" />
              </div>
              <div className="min-w-0 leading-tight">
                <h1 className="text-xs sm:text-sm md:text-base font-bold truncate text-foreground">
                  {current?.schools?.name || "Sekolah"}
                </h1>
                <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold -mt-0.5">
                  Wali Murid<span className="hidden sm:inline"> · Portal Orang Tua</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setTab("info")} className="relative h-9 w-9 rounded-full bg-white border border-border/60 hover:border-[#5B6CF9]/40 flex items-center justify-center transition-colors shadow-sm" aria-label="Notifikasi">
                <Bell className="h-4 w-4 text-foreground" />
                {announcements.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                )}
              </button>
              <button onClick={logout} className="h-9 w-9 rounded-full bg-white border border-border/60 hover:border-red-300 flex items-center justify-center transition-colors shadow-sm" aria-label="Keluar">
                <LogOut className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:flex md:gap-6 md:max-w-6xl md:mx-auto md:px-6 pt-5 md:pt-5">

      {/* DESKTOP/TABLET LEFT SIDEBAR */}
      <aside className="hidden md:flex flex-col w-[230px] shrink-0 sticky top-[68px] self-start max-h-[calc(100vh-5rem)] bg-card rounded-3xl shadow-card border border-border/40 p-3.5">
        {/* Student selector */}
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1 mb-1.5">Siswa Aktif</p>
          {students.length > 1 ? (
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-full h-11 rounded-xl bg-muted/40 border-border/60 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.class ? ` · ${s.class}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-muted/40">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                {current?.photo_url ? <img src={current.photo_url} alt="" className="h-full w-full object-cover" /> : current?.name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{current?.name || "—"}</p>
                {current?.class && <p className="text-[9px] text-muted-foreground truncate">Kelas {current.class}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border/60 -mx-3.5 mb-2" />

        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1 mb-1.5">Menu</p>
        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {[
            { id: "home", label: "Beranda", icon: Home },
            { id: "attendance", label: "Absensi", icon: ClipboardList },
            { id: "schedule", label: "Jadwal", icon: CalendarDays },
            { id: "spp", label: "SPP", icon: Wallet },
            { id: "info", label: "Pengumuman", icon: Megaphone },
            { id: "leave", label: "Pengajuan Izin", icon: FileText },
            { id: "contact", label: "Wali Kelas", icon: Phone },
            { id: "card", label: "Kartu Pelajar", icon: CreditCard },
          ].map((t) => {
            const Active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
                  Active
                    ? "bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] text-white shadow-[0_8px_20px_-8px_rgba(91,108,249,0.6)]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <t.icon className="h-4 w-4 shrink-0" strokeWidth={Active ? 2.5 : 2} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex-1 min-w-0 md:pt-0">


      {/* Content */}
      <div className="max-w-md md:max-w-none mx-auto md:mx-0 px-4 md:px-0 space-y-3">
        {/* HERO CARD — Payou style */}
        {tab === "home" && (
          <div className="relative md:space-y-4">
            {/* Main blue hero card */}
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#5B6CF9] via-[#5B6CF9] to-[#4c5ded] text-white p-4 md:p-7 shadow-[0_8px_24px_-12px_rgba(91,108,249,0.35)]">
              {/* Decorative blobs */}
              <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 25% 0%, white 1.2px, transparent 1.2px), radial-gradient(circle at 75% 100%, white 1.2px, transparent 1.2px)", backgroundSize: "28px 28px" }} />

              {/* Student info row */}
              <div className="relative flex items-center gap-2.5 md:gap-3.5">
                <div className="h-11 w-11 md:h-14 md:w-14 rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/30 flex items-center justify-center font-bold text-white text-base md:text-xl overflow-hidden shrink-0">
                  {current?.photo_url ? <img src={current.photo_url} alt="" className="h-full w-full object-cover" /> : current?.name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-[11px] uppercase tracking-wider text-white/70 font-semibold">Ringkasan Bulan Ini</p>
                  <p className="text-sm md:text-lg font-semibold leading-snug break-words">{current?.name}</p>
                  {current?.class && (
                    <p className="text-[10px] md:text-xs text-white/75 leading-tight truncate mt-0.5">
                      <span className="opacity-80">Kelas</span> {current.class}
                    </p>
                  )}
                </div>
                {students.length > 1 && (
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-[72px] md:w-[110px] h-7 md:h-8 px-2 text-[10px] md:text-xs rounded-full bg-white/15 border-white/30 text-white backdrop-blur shrink-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Big metric */}
              <div className="relative mt-4 md:mt-6 flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none">{monthRate}<span className="text-2xl md:text-3xl">%</span></p>
                  <p className="text-[11px] md:text-sm text-white/80 mt-1.5">Tingkat Kehadiran • {monthHadir}/{workingDaysElapsed} hari sekolah</p>
                </div>
                <div className="flex flex-col items-end">
                  <Badge className="bg-white/20 text-white border-0 text-[10px] md:text-xs backdrop-blur">
                    {todayLog ? STATUS_LABEL[todayLog.status]?.label || todayLog.status : "Belum Absen"}
                  </Badge>
                  <p className="text-[10px] md:text-xs text-white/70 mt-1">Hari ini</p>
                </div>
              </div>

              {/* 3 round action buttons */}
              <div className="relative mt-5 md:mt-6 flex items-center justify-around md:justify-start md:gap-10">
                <button onClick={() => setTab("leave")} className="flex flex-col items-center gap-1.5 group">
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                    <Send className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                  </div>
                  <span className="text-[10px] md:text-xs font-medium text-white/90">Ajukan Izin</span>
                </button>
                <button onClick={() => setTab("attendance")} className="flex flex-col items-center gap-1.5 group">
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                    <ScanLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                  </div>
                  <span className="text-[10px] md:text-xs font-medium text-white/90">Riwayat</span>
                </button>
                <button onClick={() => setTab("info")} className="flex flex-col items-center gap-1.5 group">
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                    <HistoryIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                  </div>
                  <span className="text-[10px] md:text-xs font-medium text-white/90">Pengumuman</span>
                </button>
              </div>

              {/* Pay SPP banner — hanya tampil jika ada TUNGGAKAN (lewat jatuh tempo).
                  Tagihan bulan ini ditampilkan terpisah di card "Tagihan SPP Bulan Baru". */}
              {(() => {
                const tunggakanTotal = (sppData.tunggakan || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
                if (tunggakanTotal <= 0) return null;
                return (
                  <button
                    onClick={() => setTab("spp")}
                    className="relative mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-red-400 to-red-500 text-white font-semibold text-xs shadow-lg hover:opacity-95 transition-all active:scale-[0.98]"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Bayar Tunggakan — Rp {tunggakanTotal.toLocaleString("id-ID")}
                  </button>
                );
              })()}
            </div>

            {/* Shortcut: Kartu Pelajar Digital */}
            {current && (
              <button
                onClick={() => setTab("card")}
                className="mt-4 w-full flex items-center gap-3 rounded-2xl p-3.5 bg-gradient-to-r from-[#5B6CF9]/10 via-[#4c5ded]/10 to-transparent border border-[#5B6CF9]/20 hover:border-[#5B6CF9]/40 transition-all active:scale-[0.98]"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4338CA] flex items-center justify-center shrink-0 shadow-lg shadow-[#5B6CF9]/30">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-foreground">Kartu Pelajar Digital</p>
                  <p className="text-[11px] text-muted-foreground truncate">Lihat & unduh kartu identitas siswa</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#5B6CF9] shrink-0" />
              </button>
            )}




            {/* Tunggakan SPP — semua tagihan lewat jatuh tempo & belum lunas */}
            {(sppData.tunggakan || []).length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-red-500" />
                    Tunggakan SPP
                    <span className="ml-1 text-[10px] font-semibold text-red-600 bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full">
                      {sppData.tunggakan.length}
                    </span>
                  </h3>
                  <button onClick={() => setTab("spp")} className="text-[10px] font-semibold text-[#5B6CF9]">Lihat Semua</button>
                </div>
                <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                  {sppData.tunggakan.slice(0, 3).map((inv: any) => (
                    <Card key={inv.id} className="p-3 border-0 shadow-card rounded-2xl bg-gradient-to-r from-red-50 to-white dark:from-red-950/20 dark:to-card ring-1 ring-red-100 dark:ring-red-950/40">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 shrink-0">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">Tagihan SPP {inv.period_label}</p>
                          <p className="text-[10px] text-red-600 font-semibold truncate">
                            Rp {(inv.total_amount || 0).toLocaleString("id-ID")}
                            {inv.due_date && ` · Lewat tempo ${new Date(inv.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setTab("spp")}
                          className="h-8 px-3 text-[11px] rounded-full bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-95 text-white shadow shrink-0"
                        >
                          Bayar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Tagihan SPP Bulan Baru — hanya tampil jika ada tagihan bulan berjalan */}
            {(() => {
              const now = new Date();
              const curMonth = now.getMonth() + 1;
              const curYear = now.getFullYear();
              const currentMonthBills = sppData.aktif.filter(
                (i: any) =>
                  i.status === "pending" &&
                  Number(i.period_month) === curMonth &&
                  Number(i.period_year) === curYear,
              );
              if (currentMonthBills.length === 0) return null;
              return (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-amber-500" />
                      Tagihan SPP Bulan Baru
                    </h3>
                    <button onClick={() => setTab("spp")} className="text-[10px] font-semibold text-[#5B6CF9]">Lihat Semua</button>
                  </div>
                  <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
                    {currentMonthBills.slice(0, 2).map((inv: any) => (
                      <Card key={inv.id} className="p-3 border-0 shadow-card rounded-2xl bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/20 dark:to-card">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 shrink-0">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">Tagihan SPP {inv.period_label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              Rp {(inv.total_amount || 0).toLocaleString("id-ID")}
                              {inv.due_date && ` · Jatuh tempo ${new Date(inv.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setTab("spp")}
                            className="h-8 px-3 text-[11px] rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-white shadow shrink-0"
                          >
                            Bayar
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Promo / Offers card */}
            <Card className="mt-5 p-3.5 border-0 shadow-card rounded-2xl bg-gradient-to-r from-pink-100 via-pink-50 to-orange-50 dark:from-pink-950/30 dark:via-pink-950/20 dark:to-orange-950/20">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-pink-600 font-bold">Tips Hari Ini</p>
                  <p className="text-xs font-semibold text-foreground leading-snug mt-0.5">Pantau kehadiran anak setiap hari & dapatkan notifikasi otomatis</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* HOME — kolom kanan di desktop (statistik & jadwal) */}
        {tab === "home" && (
          <div className="space-y-3">
            {/* Period Filter */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl w-fit">
              {(["day", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setStatPeriod(p)}
                  className={cn(
                    "text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all",
                    statPeriod === p ? "bg-white shadow text-[#5B6CF9]" : "text-muted-foreground"
                  )}
                >
                  {p === "day" ? "Hari Ini" : p === "week" ? "7 Hari" : "30 Hari"}
                </button>
              ))}
            </div>

            {(() => {
              const now = new Date();
              const cutoff = new Date(now);
              if (statPeriod === "day") cutoff.setHours(0, 0, 0, 0);
              else if (statPeriod === "week") cutoff.setDate(now.getDate() - 7);
              else cutoff.setDate(now.getDate() - 30);
              const filtered = attendance.filter((a) => new Date(a.date) >= cutoff);
              const c = (s: string) => filtered.filter((a) => a.status === s).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatCard icon={CheckCircle2} label="Hadir" value={c("hadir")} color="emerald" />
                  <StatCard icon={FileText} label="Izin" value={c("izin")} color="amber" />
                  <StatCard icon={Clock} label="Sakit" value={c("sakit")} color="sky" />
                  <StatCard icon={XCircle} label="Alfa" value={c("alfa")} color="red" />
                </div>
              );
            })()}

            {/* Statistik Garis */}
            <Card className="p-4 border-0 shadow-card rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#5B6CF9]" />
                  Statistik Kehadiran — {statPeriod === "day" ? "Hari Ini" : statPeriod === "week" ? "7 Hari" : "30 Hari"}
                </h3>
              </div>
              <div className="h-48 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buildChartData(attendance, statPeriod)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [`${value}`, STATUS_LABELS[name] || name]}
                    />
                    <Line type="monotone" dataKey="hadir" stroke={STATUS_COLORS.hadir} strokeWidth={2.5} dot={{ r: 3 }} name="hadir" />
                    <Line type="monotone" dataKey="izin" stroke={STATUS_COLORS.izin} strokeWidth={2} dot={{ r: 2.5 }} name="izin" />
                    <Line type="monotone" dataKey="sakit" stroke={STATUS_COLORS.sakit} strokeWidth={2} dot={{ r: 2.5 }} name="sakit" />
                    <Line type="monotone" dataKey="alfa" stroke={STATUS_COLORS.alfa} strokeWidth={2} dot={{ r: 2.5 }} name="alfa" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5 text-[11px]">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                    <span className="text-muted-foreground font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Jadwal Hari Ini */}
            <SectionTitle icon={CalendarDays} title="Jadwal Hari Ini" onMore={() => setTab("schedule")} />
            {(() => {
              const todays = schedule.filter((s) => s.day_of_week === new Date().getDay()).sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||""));
              if (todays.length === 0) return <EmptyMini text="Tidak ada jadwal hari ini." />;
              const nowHHMM = new Date().toTimeString().slice(0,5);
              return (
                <div className="space-y-2">
                  {todays.slice(0, 3).map((s) => {
                    const isOn = (s.start_time||"").slice(0,5) <= nowHHMM && nowHHMM < (s.end_time||"").slice(0,5);
                    const subjColor = s.subjects?.color || "#5B6CF9";
                    return (
                      <Card key={s.id} className={cn("relative overflow-hidden p-0 border-0 shadow-card rounded-2xl", isOn && "ring-2 ring-emerald-500/50")}>
                        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: subjColor }} />
                        <div className="flex items-center gap-3 p-3 pl-4">
                          <div className="flex flex-col items-center justify-center min-w-[54px] py-1.5 rounded-xl" style={{ backgroundColor: `${subjColor}15`, color: subjColor }}>
                            <span className="text-xs font-bold leading-none">{s.start_time?.slice(0,5)}</span>
                            <span className="text-[9px] opacity-70 mt-0.5">{s.end_time?.slice(0,5)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{s.subjects?.name || "—"}</p>
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />{s.profiles?.full_name || "Guru"}{s.room ? ` • ${s.room}` : ""}
                            </p>
                          </div>
                          {isOn && <Badge className="bg-emerald-500 text-white border-0 text-[9px] font-bold shrink-0">LIVE</Badge>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}

            {/* Info Sekolah */}
            <SectionTitle icon={Megaphone} title="Informasi Terbaru" onMore={() => setTab("info")} />
            {announcements.length === 0 ? (
              <EmptyMini text="Belum ada informasi dari sekolah." />
            ) : (
              <div className="space-y-2">
                {announcements.slice(0, 2).map((a) => (
                  <Card key={a.id} className="p-3.5 border-0 shadow-card rounded-2xl">
                    <div className="flex items-start gap-2 mb-1">
                      {a.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                      <p className="text-sm font-bold flex-1">{a.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: a.message }} />
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === "attendance" && (
          <>
            <SectionTitle icon={ClipboardList} title="Riwayat Absensi 30 Hari" />
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setAttTypeTab("datang")}
                className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition", attTypeTab === "datang" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground")}
              >Datang</button>
              <button
                onClick={() => setAttTypeTab("pulang")}
                className={cn("flex-1 py-2 rounded-xl text-sm font-semibold transition", attTypeTab === "pulang" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground")}
              >Pulang</button>
            </div>
            {(() => {
              const filtered = attendance.filter(a => (a.attendance_type || "datang") === attTypeTab);
              if (filtered.length === 0) return <EmptyMini text={`Belum ada data ${attTypeTab === "pulang" ? "kepulangan" : "kedatangan"}.`} />;
              return (
                <div className="space-y-2">
                  {filtered.map((a) => (
                    <Card key={a.id} className="p-3 border-0 shadow-card rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{new Date(a.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}</p>
                        <p className="text-xs text-muted-foreground">{a.attendance_type === "pulang" ? "Pulang" : "Datang"} • {a.time?.slice(0, 5) || "-"} • {a.method}</p>
                      </div>
                      <Badge className={cn("border-0", STATUS_LABEL[a.status]?.cls)}>{STATUS_LABEL[a.status]?.label || a.status}</Badge>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <>
            {(() => {
              const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
              const today = new Date();
              const dow = today.getDay();
              const nowHHMM = today.toTimeString().slice(0, 5);
              const todays = schedule.filter((s) => s.day_of_week === dow);
              const ongoing = todays.find((s) => (s.start_time || "").slice(0,5) <= nowHHMM && nowHHMM < (s.end_time || "").slice(0,5));
              const next = todays.find((s) => (s.start_time || "").slice(0,5) > nowHHMM);
              const grouped: Record<number, any[]> = {};
              schedule.forEach((s) => { (grouped[s.day_of_week] ||= []).push(s); });
              const days = Object.keys(grouped).map(Number).sort();

              return (
                <>
                  {/* Sedang Berlangsung */}
                  <SectionTitle icon={Clock} title="Sedang Berlangsung" />
                  {ongoing ? (() => {
                    const [sh, sm] = (ongoing.start_time || "00:00").split(":").map(Number);
                    const [eh, em] = (ongoing.end_time || "00:00").split(":").map(Number);
                    const startMin = sh * 60 + sm;
                    const endMin = eh * 60 + em;
                    const nowMin = today.getHours() * 60 + today.getMinutes();
                    const progress = Math.min(100, Math.max(0, ((nowMin - startMin) / Math.max(1, endMin - startMin)) * 100));
                    const remain = Math.max(0, endMin - nowMin);
                    const color = ongoing.subjects?.color || "#10b981";
                    return (
                      <Card className="p-0 border-0 shadow-card rounded-2xl overflow-hidden text-white relative" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 0%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                        <div className="relative p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                                </span>
                                <Badge className="bg-white/25 text-white border-0 text-[10px] font-bold tracking-wider">SEDANG BERLANGSUNG</Badge>
                              </div>
                              <p className="font-bold text-lg leading-tight truncate">{ongoing.subjects?.name || "—"}</p>
                              <p className="text-xs text-white/85 truncate mt-0.5 flex items-center gap-1">
                                <User className="h-3 w-3" />{ongoing.profiles?.full_name || "Guru"}{ongoing.room ? ` • ${ongoing.room}` : ""}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Sisa</p>
                              <p className="text-xl font-bold leading-none mt-0.5">{remain}<span className="text-xs font-medium ml-0.5">m</span></p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/80 font-medium">
                            <span>{ongoing.start_time?.slice(0,5)}</span>
                            <span>{Math.round(progress)}%</span>
                            <span>{ongoing.end_time?.slice(0,5)}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })() : next ? (
                    <Card className="p-3.5 border-0 shadow-card rounded-2xl border-l-4 border-l-[#5B6CF9]">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Berikutnya</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{next.subjects?.name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{next.profiles?.full_name || "Guru"}{next.room ? ` • ${next.room}` : ""}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-[#5B6CF9]/30 text-[#5B6CF9] shrink-0">{next.start_time?.slice(0,5)}</Badge>
                      </div>
                    </Card>
                  ) : (
                    <EmptyMini text="Tidak ada mata pelajaran yang sedang berlangsung." />
                  )}

                  {/* Jadwal Mingguan */}
                  <SectionTitle icon={CalendarDays} title="Jadwal Pelajaran Mingguan" />
                  {schedule.length === 0 ? <EmptyMini text="Belum ada jadwal pelajaran." /> : (
                    <div className="space-y-3">
                      {days.map((d) => {
                        const isToday = d === dow;
                        // Seragamkan warna header semua hari menggunakan brand gradient
                        const dayGradient = "from-[#5B6CF9] to-[#4c5ded]";
                        return (
                          <Card key={d} className="border-0 shadow-card rounded-2xl overflow-hidden">
                            {/* Day Header */}
                            <div className={cn("relative px-4 py-2.5 bg-gradient-to-r text-white flex items-center justify-between", dayGradient)}>
                              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                              <div className="relative flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                <p className="text-sm font-bold tracking-wide">{DAY_NAMES[d]}</p>
                              </div>
                              {isToday && (
                                <Badge className="relative bg-white/25 text-white border-0 text-[10px] font-bold backdrop-blur">
                                  <span className="relative flex h-1.5 w-1.5 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                                  </span>
                                  Hari Ini
                                </Badge>
                              )}
                            </div>
                            {/* Lessons */}
                            <div className="p-2.5 space-y-1.5 bg-gradient-to-b from-background to-muted/20">
                              {grouped[d].sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||"")).map((s) => {
                                const isOn = isToday && (s.start_time||"").slice(0,5) <= nowHHMM && nowHHMM < (s.end_time||"").slice(0,5);
                                const subjColor = s.subjects?.color || "#5B6CF9";
                                return (
                                  <div key={s.id} className={cn("relative rounded-xl bg-card border border-border/50 p-2.5 pl-3 flex items-center gap-3 hover:shadow-md transition-all", isOn && "ring-2 ring-emerald-500/60 shadow-md")}>
                                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ backgroundColor: subjColor }} />
                                    <div className="flex flex-col items-center justify-center min-w-[52px] py-1 px-2 rounded-lg" style={{ backgroundColor: `${subjColor}15`, color: subjColor }}>
                                      <span className="text-[10px] font-bold leading-none">{s.start_time?.slice(0,5)}</span>
                                      <span className="text-[8px] opacity-70 mt-0.5">{s.end_time?.slice(0,5)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold truncate">{s.subjects?.name || "—"}</p>
                                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                        <User className="h-2.5 w-2.5" />{s.profiles?.full_name || "Guru"}{s.room ? ` • ${s.room}` : ""}
                                      </p>
                                    </div>
                                    {isOn && (
                                      <Badge className="bg-emerald-500 text-white border-0 text-[9px] font-bold">LIVE</Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* INFO */}
        {tab === "info" && (
          <>
            <SectionTitle icon={Megaphone} title="Informasi dari Sekolah" />
            <p className="text-[11px] text-muted-foreground -mt-2">Hanya menampilkan pengumuman yang ditujukan kepada wali murid.</p>
            {announcements.length === 0 ? <EmptyMini text="Belum ada informasi untuk wali murid." /> : (
              <div className="space-y-2.5">
                {announcements.map((a) => (
                  <Card key={a.id} className={cn("p-4 border-0 shadow-card rounded-2xl", a.is_pinned && "ring-1 ring-amber-400/40 bg-amber-50/40 dark:bg-amber-950/10")}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {a.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <p className="text-sm font-bold truncate">{a.title}</p>
                      </div>
                      {a.is_pinned && <Badge className="bg-amber-500 text-white border-0 text-[10px] shrink-0">Penting</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap [&_*]:!text-xs" dangerouslySetInnerHTML={{ __html: a.message }} />
                    <p className="text-[10px] text-muted-foreground mt-2.5">{new Date(a.created_at).toLocaleString("id-ID")}</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* LEAVE */}
        {tab === "leave" && (
          <>
            <Card className="p-4 border-0 shadow-card rounded-2xl space-y-3">
              <SectionTitle icon={FileText} title="Ajukan Izin / Sakit" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Jenis</Label>
                  <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm({ ...leaveForm, type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="izin">Izin</SelectItem>
                      <SelectItem value="sakit">Sakit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tanggal</Label>
                  <Input className="mt-1" type="date" value={leaveForm.date} onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Alasan</Label>
                <Textarea className="mt-1" rows={3} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Tuliskan alasan..." />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" />Lampiran Surat (opsional)</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Foto / gambar surat izin atau surat dokter. Maks 5MB.</p>
                {leaveForm.attachment_url ? (
                  <div className="flex items-center gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <a href={leaveForm.attachment_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={leaveForm.attachment_url} alt="lampiran" className="h-12 w-12 object-cover rounded-lg" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    </a>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Lampiran terupload</p>
                      <a href={leaveForm.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground truncate block hover:underline">Lihat file</a>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setLeaveForm({ ...leaveForm, attachment_url: null })} className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className={cn("flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#5B6CF9]/30 bg-[#5B6CF9]/5 cursor-pointer hover:bg-[#5B6CF9]/10 transition-colors", uploadingFile && "opacity-50 pointer-events-none")}>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} disabled={uploadingFile} />
                    {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin text-[#5B6CF9]" /> : <Paperclip className="h-4 w-4 text-[#5B6CF9]" />}
                    <span className="text-xs font-semibold text-[#5B6CF9]">{uploadingFile ? "Mengupload..." : "Pilih Foto / PDF"}</span>
                  </label>
                )}
              </div>
              <Button onClick={submitLeave} disabled={uploadingFile} className="w-full bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] hover:opacity-90 text-white rounded-xl">Kirim Pengajuan</Button>
            </Card>
            <SectionTitle icon={ClipboardList} title="Riwayat Pengajuan" />
            {leaves.length === 0 ? <EmptyMini text="Belum ada pengajuan." /> : (
              <div className="space-y-2">
                {leaves.map((l) => {
                  const Icon = l.status === "approved" ? CheckCircle2 : l.status === "rejected" ? XCircle : Clock;
                  const cls = l.status === "approved" ? "text-emerald-600" : l.status === "rejected" ? "text-red-600" : "text-amber-600";
                  return (
                    <Card key={l.id} className="p-3 border-0 shadow-card rounded-2xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold capitalize">{l.type} • {new Date(l.date).toLocaleDateString("id-ID")}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{l.reason}</p>
                          {l.review_note && <p className="text-[11px] text-muted-foreground mt-1">Catatan: {l.review_note}</p>}
                          {l.attachment_url && (
                            <a href={l.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#5B6CF9] font-semibold mt-1.5 hover:underline">
                              <Paperclip className="h-3 w-3" />Lihat lampiran
                            </a>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-semibold capitalize shrink-0 ${cls}`}><Icon className="h-3.5 w-3.5" />{l.status}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* SPP */}
        {tab === "spp" && (
          <>
            <SectionTitle icon={Wallet} title="Pembayaran SPP" />

            {/* Ringkasan Tunggakan */}
            {sppData.total_tunggakan > 0 && (
              <Card className="p-4 border-0 shadow-card rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white">
                <p className="text-[11px] uppercase tracking-wider text-white/80 font-semibold">Total Tunggakan</p>
                <p className="text-2xl font-extrabold mt-1">Rp {sppData.total_tunggakan.toLocaleString("id-ID")}</p>
                <p className="text-xs text-white/85 mt-1">{sppData.tunggakan.length} bulan belum dibayar</p>
              </Card>
            )}

            {/* Tagihan Aktif */}
            <SectionTitle icon={AlertCircle} title="Tagihan Aktif" />
            {sppData.aktif.length === 0 ? <EmptyMini text="Tidak ada tagihan aktif." /> : (
              <div className="space-y-2">
                {sppData.aktif.map((inv) => {
                  const isExpired = inv.status === "expired";
                  return (
                    <Card key={inv.id} className="p-3.5 border-0 shadow-card rounded-2xl">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{inv.period_label}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">{inv.invoice_number}</p>
                        </div>
                        <Badge className={cn("border-0 text-[10px]", isExpired ? "bg-orange-500 text-white" : "bg-amber-500 text-white")}>
                          {isExpired ? "Kadaluarsa" : "Menunggu"}
                        </Badge>
                      </div>
                      <p className="text-lg font-extrabold text-[#5B6CF9]">Rp {(inv.total_amount || 0).toLocaleString("id-ID")}</p>
                      <p className="text-[11px] text-muted-foreground mb-2.5">Jatuh tempo: {inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}</p>
                      <Button
                        size="sm"
                        className={cn("w-full text-white", isExpired ? "bg-orange-600 hover:bg-orange-700" : "bg-[#5B6CF9] hover:bg-[#4c5ded]")}
                        disabled={sppBusy === inv.id}
                        onClick={() => paySpp(inv.id)}
                      >
                        {sppBusy === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                          isExpired ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Buat Link Baru & Bayar</> : <><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Bayar Sekarang</>
                        )}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Riwayat Lunas */}
            <SectionTitle icon={CheckCircle2} title="Riwayat Pembayaran" />
            {sppData.lunas.length === 0 ? <EmptyMini text="Belum ada pembayaran." /> : (
              <div className="space-y-2">
                {sppData.lunas.map((inv) => (
                  <Card key={inv.id} className="p-3.5 border-0 shadow-card rounded-2xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-bold truncate">{inv.period_label}</p>
                          <Badge className="bg-emerald-500 text-white border-0 text-[9px]">LUNAS</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"} • {formatPaymentMethodLabel(inv.payment_method)}</p>
                        <p className="text-sm font-extrabold text-emerald-600 mt-0.5">Rp {(inv.total_amount || 0).toLocaleString("id-ID")}</p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0" disabled={sppBusy === `pdf-${inv.id}`} onClick={() => downloadSppPdf(inv)}>
                        {sppBusy === `pdf-${inv.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Download className="h-3.5 w-3.5 mr-1" /> Invoice</>}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}


        {tab === "contact" && (
          <>
            <SectionTitle icon={Phone} title="Kontak Wali Kelas" />
            {!homeroom ? <EmptyMini text="Memuat..." /> : (
              <>
                <Card className="p-4 border-0 shadow-card rounded-2xl">
                  {homeroom.teacher ? (
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0">
                        {homeroom.teacher.avatar_url ? <img src={homeroom.teacher.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground">{homeroom.teacher.full_name}</p>
                        <p className="text-xs text-muted-foreground">Wali Kelas {homeroom.class_name}</p>
                        {homeroom.teacher.phone && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{homeroom.teacher.phone}</p>
                        )}
                        {homeroom.teacher.phone && (
                          <div className="flex gap-2 mt-2.5">
                            <a href={`https://wa.me/${homeroom.teacher.phone.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                              <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"><MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp</Button>
                            </a>
                            <a href={`tel:${homeroom.teacher.phone}`} className="flex-1">
                              <Button size="sm" variant="outline" className="w-full rounded-xl"><Phone className="h-4 w-4 mr-1.5" />Telepon</Button>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Wali kelas belum ditetapkan oleh sekolah.</p>
                  )}
                </Card>

                {homeroom.school && (
                  <Card className="p-4 border-0 shadow-card rounded-2xl">
                    <SectionTitle icon={GraduationCap} title="Informasi Sekolah" />
                    <div className="mt-2 space-y-1.5">
                      <p className="text-sm font-bold">{homeroom.school.name}</p>
                      {homeroom.school.address && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{homeroom.school.address}</p>
                      )}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {tab === "card" && (
          <>
            
            {current ? (
              <div className="space-y-4">
                <StudentIdCard student={current as any} />
                {(current as any).card_number && (
                  <Card className="p-4 border-0 shadow-card rounded-2xl">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Nomor Kartu Identitas</p>
                    <p className="font-mono text-sm font-bold tracking-[0.15em] text-foreground break-all">
                      {String((current as any).card_number).replace(/(\d{4})(?=\d)/g, "$1 ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">Gunakan nomor ini untuk login ulang portal wali murid tanpa OTP.</p>
                  </Card>
                )}
              </div>
            ) : (
              <EmptyMini text="Memuat data siswa..." />
            )}
          </>
        )}


      </div>
      {/* end MAIN COLUMN */}
      </div>

      </div>
      {/* end md:flex wrapper */}


      <nav className="md:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto relative flex items-center gap-1 bg-white dark:bg-card rounded-full px-2 py-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] ring-1 ring-border/60 max-w-md w-full">
          {/* Left 2 tabs */}
          <FabNavBtn icon={Home} label="Beranda" active={tab === "home"} color="#10B981" onClick={() => setTab("home")} />
          <FabNavBtn icon={ClipboardList} label="Absensi" active={tab === "attendance"} color="#5B6CF9" onClick={() => setTab("attendance")} />

          {/* Center FAB */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="relative -mt-8 mx-1 h-14 w-14 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white flex items-center justify-center shadow-[0_12px_28px_-8px_rgba(91,108,249,0.7)] ring-4 ring-white dark:ring-card transition-transform active:scale-95 hover:scale-105 shrink-0"
                aria-label="Menu Lainnya"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-8">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-left">Menu Lainnya</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3">
                <SheetMenuItem icon={Megaphone} label="Pengumuman" color="#EC4899" bg="#FDE8F2" onClick={() => { setTab("info"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={FileText} label="Pengajuan Izin" color="#8B5CF6" bg="#F1ECFE" onClick={() => { setTab("leave"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={Phone} label="Wali Kelas" color="#0EA5E9" bg="#E1F4FE" onClick={() => { setTab("contact"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={CalendarDays} label="Jadwal" color="#10B981" bg="#E6FAF3" onClick={() => { setTab("schedule"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={Wallet} label="SPP" color="#F59E0B" bg="#FEF5E1" onClick={() => { setTab("spp"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={CreditCard} label="Kartu Pelajar" color="#5B6CF9" bg="#EEF0FE" onClick={() => { setTab("card"); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); }} />
                <SheetMenuItem icon={LogOut} label="Keluar" color="#EF4444" bg="#FEE7E7" onClick={logout} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Right 2 tabs */}
          <FabNavBtn icon={Wallet} label="SPP" active={tab === "spp"} color="#F59E0B" onClick={() => setTab("spp")} />
          <FabNavBtn icon={CalendarDays} label="Jadwal" active={tab === "schedule"} color="#5B6CF9" onClick={() => setTab("schedule")} />
        </div>
      </nav>


      <PaymentIframeDialog
        open={!!paymentIframe}
        paymentUrl={paymentIframe}
        title="Pembayaran SPP — QRIS / Transfer Bank"
        pollIntervalMs={4000}
        checkPaid={async () => {
          if (!payingInvoiceId || !selectedStudent) return false;
          try {
            const d = await invoke("spp_list", { student_id: selectedStudent });
            const lunas: any[] = d?.lunas || [];
            return lunas.some((x: any) => x.id === payingInvoiceId);
          } catch { return false; }
        }}
        onPaid={() => { /* refresh dilakukan saat onClose */ }}
        onClose={() => { setPaymentIframe(null); setPayingInvoiceId(null); loadTab(); }}
      />

      <PaymentMethodPicker
        open={pickerOpen}
        onOpenChange={(o) => { if (!pickerLoading) { setPickerOpen(o); if (!o) setPickerInvoice(null); } }}
        billAmount={pickerInvoice?.total_amount || 0}
        title="Pilih Metode Pembayaran"
        subtitle={pickerInvoice ? `Tagihan SPP ${pickerInvoice.period_label || ""}` : undefined}
        loading={pickerLoading}
        onConfirm={confirmPaySpp}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    sky: "bg-sky-500/10 text-sky-600",
    red: "bg-red-500/10 text-red-600",
  };
  return (
    <Card className="p-3 border-0 shadow-card rounded-2xl">
      <div className="flex items-center gap-2">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", colors[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <p className="text-lg font-bold leading-none mt-0.5">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, onMore }: any) {
  return (
    <div className="flex items-center justify-between mt-1 group">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Icon chip dengan gradient brand */}
        <div className="relative shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(91,108,249,0.55)] ring-1 ring-white/40">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="absolute -inset-0.5 rounded-xl bg-[#5B6CF9]/20 blur-md -z-10 opacity-70" />
        </div>
        {/* Title + accent bar */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="h-4 w-0.5 rounded-full bg-gradient-to-b from-[#5B6CF9] to-[#4c5ded]" />
          <h3 className="text-[13px] font-bold tracking-tight truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </h3>
        </div>
      </div>
      {onMore && (
        <button
          onClick={onMore}
          className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#5B6CF9] bg-[#5B6CF9]/10 hover:bg-[#5B6CF9]/15 active:bg-[#5B6CF9]/20 px-2.5 py-1 rounded-full ring-1 ring-[#5B6CF9]/20 transition-all hover:gap-1.5"
        >
          Lihat semua
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      )}
    </div>
  );
}

function ServiceIcon({ icon: Icon, label, color, bg, onClick }: any) {
  // Outline 1-line style with green accent dot — modern fintech iconography.
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
      <div className="relative h-14 w-14 rounded-2xl bg-white dark:bg-card flex items-center justify-center ring-1 ring-border/60 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.18)] group-hover:shadow-[0_10px_24px_-8px_rgba(15,23,42,0.25)] group-hover:-translate-y-0.5 transition-all">
        <Icon className="h-6 w-6 text-[#3D4FE0]" strokeWidth={1.75} />
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-card shadow-sm" />
      </div>
      <span className="text-[10px] font-medium text-foreground/80 text-center leading-tight">{label}</span>
    </button>
  );
}

function FabNavBtn({ icon: Icon, label, active, color, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-all", active && "scale-105")}>
      <Icon className="h-5 w-5 transition-colors" style={{ color: active ? color : "hsl(var(--muted-foreground))" }} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] font-semibold transition-colors" style={{ color: active ? color : "hsl(var(--muted-foreground))" }}>{label}</span>
    </button>
  );
}

function SheetMenuItem({ icon: Icon, label, color, bg, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card hover:bg-muted/40 border border-border/40 transition-all active:scale-95">
      <div className="relative h-12 w-12 rounded-2xl bg-white dark:bg-card flex items-center justify-center ring-1 ring-border/60 shadow-sm">
        <Icon className="h-5 w-5 text-[#3D4FE0]" strokeWidth={1.75} />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-card" />
      </div>
      <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <Card className="p-6 border-0 shadow-card rounded-2xl text-center">
      <p className="text-xs text-muted-foreground">{text}</p>
    </Card>
  );
}
