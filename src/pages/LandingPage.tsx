import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import headerDeviceAsset from "@/assets/header-device.png.asset.json";
import atskollaPlatformLogo from "@/assets/atskolla-platform-logo.png.asset.json";
const ATSKOLLA_LOGO_URL = "https://absenpintar.online/images/logo-atskolla.png";
import { useLandingTheme, LANDING_THEME_CSS } from "@/hooks/useLandingTheme";
import ThemeToggle from "@/components/landing/ThemeToggle";
import { isRootHost } from "@/lib/tenant";
import {
  ArrowRight, CheckCircle2, ShieldCheck, Zap, MapPin, Menu, X,
  QrCode, ScanFace, CreditCard, Wallet, Receipt, Banknote,
  Users, GraduationCap, Building2, HeartHandshake, BookOpen,
  CalendarDays, FileBarChart, Bell, Megaphone, IdCard, Landmark,
  ChevronDown, Sparkles, Cpu, Radio, ScanLine, Activity, LineChart,
  MessageSquare, Phone, Mail, ArrowUpRight, Server,
} from "lucide-react";

// ============================================================
// ATSkolla — Enterprise SaaS Landing (direction: Authority Hero)
// Locked design tokens:
//   palette #0b1020 / #1a2340 / #5B6CF9 / #f5f7fb
//   heading = Sora, body = Manrope
// ============================================================

const NAV = [
  { label: "Platform", href: "#ekosistem" },
  { label: "Fitur", href: "#modul" },
  
  { label: "FAQ", href: "#faq" },
  { label: "Tentang", href: "/tentang" },
  { label: "Kontak", href: "/kontak" },
];

const TRUST_BADGES = [
  { icon: CheckCircle2, label: "Tanpa Biaya Langganan" },
  { icon: Zap, label: "Implementasi Cepat" },
  { icon: ShieldCheck, label: "Support Seluruh Indonesia" },
];

const STATS = [
  { value: "500+", label: "Sekolah Terdaftar", icon: Building2 },
  { value: "120K+", label: "Siswa Aktif", icon: GraduationCap },
  { value: "Rp 45M+", label: "Total Transaksi", icon: Wallet },
  { value: "8.2 Jt+", label: "Rekaman Kehadiran", icon: Activity },
];

const PROBLEMS = [
  { title: "Absensi masih manual", desc: "Buku hadir kertas mudah hilang, rekap bulanan memakan hari kerja." },
  { title: "SPP dicatat manual", desc: "Kwitansi tulis tangan, rawan salah hitung dan sulit diaudit." },
  { title: "Rekap keuangan sulit", desc: "Data tersebar di Excel berbeda-beda antara bendahara dan pimpinan sekolah." },
  { title: "Orang tua sering lupa bayar", desc: "Tidak ada pengingat otomatis, tunggakan menumpuk tiap semester." },
  { title: "Data tersebar di banyak aplikasi", desc: "Absensi, keuangan, komunikasi, semuanya di tools terpisah." },
];

const SOLUTIONS = [
  { icon: ScanLine, title: "Kehadiran otomatis", desc: "RFID, Face Recognition, dan QR Code tersinkron langsung ke dasbor." },
  { icon: Receipt, title: "Tagihan SPP terotomasi", desc: "Invoice tergenerate per periode dengan reminder WhatsApp otomatis." },
  { icon: LineChart, title: "Satu dasbor keuangan", desc: "Cash flow, tunggakan, dan laporan keuangan real-time." },
  { icon: Bell, title: "Notifikasi ke wali murid", desc: "Reminder tagihan, absensi, dan pengumuman terkirim otomatis." },
  { icon: Landmark, title: "Satu platform terpadu", desc: "Akademik, keuangan, dan operasional dalam satu ekosistem." },
];

const ECOSYSTEM_NODES = [
  { icon: BookOpen, label: "Akademik" },
  { icon: Wallet, label: "Keuangan" },
  { icon: Cpu, label: "Operasional" },
  { icon: HeartHandshake, label: "Orang Tua" },
  { icon: GraduationCap, label: "Guru" },
  { icon: Building2, label: "Sekolah" },
];

const MODULES = [
  {
    group: "Akademik",
    icon: BookOpen,
    items: [
      { icon: ScanLine, title: "Absensi", desc: "RFID, Face Recognition, QR Code" },
      { icon: CalendarDays, title: "Jadwal", desc: "Live schedule per guru & kelas" },
      { icon: FileBarChart, title: "Nilai", desc: "Rekap per mata pelajaran & rapor" },
      { icon: Megaphone, title: "Pengumuman", desc: "Broadcast ke wali murid & guru" },
    ],
  },
  {
    group: "Keuangan",
    icon: Wallet,
    items: [
      { icon: Receipt, title: "Pembayaran SPP", desc: "Invoice per periode otomatis" },
      { icon: Landmark, title: "Virtual Account", desc: "VA seluruh bank utama" },
      { icon: QrCode, title: "QRIS", desc: "Pembayaran instan dari mana saja" },
      { icon: BookOpen, title: "Buku Kas", desc: "Pencatatan kas harian" },
      { icon: LineChart, title: "Cash Flow", desc: "Arus kas masuk & keluar" },
      { icon: FileBarChart, title: "Invoice & Kwitansi", desc: "Dokumen digital resmi" },
      { icon: Banknote, title: "Laporan Keuangan", desc: "Neraca, laba rugi, tunggakan" },
    ],
  },
  {
    group: "Operasional",
    icon: Cpu,
    items: [
      { icon: Radio, title: "RFID Reader", desc: "Perangkat scan kartu pelajar" },
      { icon: ScanFace, title: "Face Recognition", desc: "Verifikasi wajah realtime" },
      { icon: QrCode, title: "QR Code", desc: "Scan cepat dari HP" },
      { icon: IdCard, title: "Kartu Pelajar", desc: "Cetak resmi terintegrasi" },
      
    ],
  },
];

const PAYMENT_ITEMS = [
  { icon: QrCode, title: "QRIS & Virtual Account", desc: "Wali murid bayar SPP kapan saja lewat QRIS atau VA otomatis BCA, Mandiri, BNI, BRI, dan bank utama lainnya." },
  { icon: MessageSquare, title: "Reminder WhatsApp", desc: "Pengingat tagihan terjadwal otomatis, siap kirim sebelum jatuh tempo." },
  { icon: CheckCircle2, title: "Rekonsiliasi Otomatis", desc: "Pembayaran masuk langsung tercatat sebagai lunas — tanpa konfirmasi manual." },
  { icon: LineChart, title: "Dashboard Bendahara", desc: "Ringkasan pemasukan, tunggakan, dan proyeksi kas dalam satu layar." },
  { icon: FileBarChart, title: "Laporan Keuangan", desc: "Export Excel & PDF resmi untuk audit dan rapat komite." },
];

const HARDWARE = [
  { icon: Radio, name: "RFID Reader", desc: "USB & mesin standalone. Plug-and-play, langsung tersinkron ke sistem." },
  { icon: ScanFace, name: "Face Recognition", desc: "Kamera AI untuk verifikasi wajah siswa dan guru secara real-time." },
  { icon: QrCode, name: "QR Scanner", desc: "Scan cepat dari kamera perangkat mana pun — HP, tablet, atau kios." },
  { icon: IdCard, name: "Kartu Pelajar", desc: "Cetak kartu resmi dengan chip RFID dan branding sekolah Anda." },
];

const ROLES = [
  { key: "kepsek", label: "Kepala Sekolah", metric: { top: "Kehadiran hari ini", val: "94,8%", sub: "1.204 dari 1.270 siswa" }, blocks: ["Ringkasan operasional", "Trend absensi", "Aktivitas terbaru"] },
  { key: "bendahara", label: "Bendahara", metric: { top: "SPP Bulan Ini", val: "Rp 312 Jt", sub: "87% terkumpul • 42 tunggakan" }, blocks: ["Tagihan aktif", "Cash flow harian", "Laporan periode"] },
  { key: "guru", label: "Guru", metric: { top: "Kelas hari ini", val: "5 sesi", sub: "3 selesai • 2 mendatang" }, blocks: ["Jadwal mengajar", "Rekap kehadiran kelas", "Nilai siswa"] },
  { key: "ortu", label: "Orang Tua", metric: { top: "Status anak", val: "Hadir 07:12", sub: "Kelas 6B • SDN 1 Cendikia" }, blocks: ["Absensi anak", "Tagihan SPP", "Pengumuman sekolah"] },
  
];

const FAQ = [
  {
    q: "Benarkah ATSkolla gratis?",
    a: "Ya. Sekolah dapat menggunakan platform inti ATSkolla sepenuhnya gratis, tanpa biaya langganan bulanan dan tanpa komitmen.",
  },
  {
    q: "Bagaimana sistem pembayaran SPP bekerja?",
    a: "ATSkolla membuat invoice otomatis per periode. Wali murid membayar via QRIS atau Virtual Account, dana masuk ke rekening sekolah, dan status pembayaran langsung ter-update di dasbor bendahara. Reminder WhatsApp dikirim otomatis sebelum jatuh tempo.",
  },
  {
    q: "Apakah data sekolah aman?",
    a: "Seluruh data dienkripsi in-transit (TLS 1.2+) dan at-rest. Kami menggunakan role-based access control, audit log, serta backup harian. Data tetap milik sekolah — dapat diekspor kapan saja.",
  },
  {
    q: "Berapa lama proses implementasi?",
    a: "Umumnya 1–3 hari kerja. Sekolah tinggal mendaftar, upload data siswa & kelas, atur rekening penerimaan, dan platform siap dipakai. Tim kami mendampingi onboarding tanpa biaya tambahan.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ---------- helpers ----------
function Section({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`relative w-full ${className}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5B6CF9]/30 bg-[#5B6CF9]/10">
      <span className="flex h-1.5 w-1.5 rounded-full bg-[#5B6CF9]" />
      <span className="text-[11px] font-semibold tracking-[0.18em] text-[#5B6CF9] uppercase font-sans">
        {children}
      </span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub, dark = false }: { eyebrow: string; title: React.ReactNode; sub?: string; dark?: boolean }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mb-12 lg:mb-16"
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={`mt-4 font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] ${dark ? "text-[#0b1020]" : "text-[#0b1020]"}`}>
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 text-base md:text-lg leading-relaxed ${dark ? "text-[#0b1020]/60" : "text-[#0b1020]/65"}`}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}

// ---------- Nav ----------
function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const nav = useNavigate();
  const loginPath = isRootHost() ? "/admin" : "/login";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]" : "bg-white border-b border-slate-100"}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center group" aria-label="ATSkolla">
          <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" width={160} height={40} fetchPriority="high" decoding="async" className="h-9 sm:h-10 w-auto object-contain" />
        </a>


        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm font-semibold text-[#0b1020] hover:text-[#5B6CF9] transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => nav(loginPath)} className="text-sm font-semibold text-[#0b1020] hover:text-[#5B6CF9] px-3 py-2">
            Masuk
          </button>
          <button
            onClick={() => nav("/register")}
            className="inline-flex items-center gap-1.5 bg-[#5B6CF9] hover:bg-[#5B6CF9]/90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-[#5B6CF9]/25"
          >
            Mulai Gratis <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="lg:hidden flex items-center gap-2">
          <button onClick={() => setOpen((v) => !v)} className="text-[#0b1020] p-2" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-3">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block text-[#0b1020] hover:text-[#5B6CF9] py-2 text-sm font-semibold">
              {n.label}
            </a>
          ))}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <button onClick={() => nav(loginPath)} className="flex-1 text-sm font-semibold text-[#0b1020] border border-slate-200 rounded-lg py-2.5">
              Masuk
            </button>
            <button onClick={() => nav("/register")} className="flex-1 text-sm font-semibold bg-[#5B6CF9] text-white rounded-lg py-2.5">
              Mulai Gratis
            </button>
          </div>

        </div>
      )}
    </header>
  );
}

// ---------- Hero ----------
function Hero() {
  const nav = useNavigate();
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 bg-white overflow-hidden">
      {/* grid pattern */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,16,32,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,16,32,.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at top, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 80%)",
        }}
      />
      <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-[#5B6CF9] rounded-full blur-[140px] opacity-[0.12] pointer-events-none" />
      <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-[#5B6CF9] rounded-full blur-[160px] opacity-[0.08] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-8">
          <Eyebrow>Platform Digital Sekolah Terintegrasi</Eyebrow>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#0b1020] leading-[1.05] tracking-tight">
            Platform Digital Sekolah <span className="text-[#5B6CF9]">Terintegrasi</span>.
          </h1>

          <p className="text-base md:text-lg text-[#0b1020]/65 max-w-xl leading-relaxed">
            Kelola absensi, pembayaran SPP online, keuangan sekolah, kartu pelajar, komunikasi orang tua, dan administrasi sekolah dalam satu platform.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => nav("/register")}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#5B6CF9] hover:bg-[#5B6CF9]/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#5B6CF9]/25 font-display"
            >
              Mulai Gratis <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#kontak"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-50 hover:bg-slate-50/70  text-[#0b1020] border border-slate-200 font-semibold rounded-xl transition-all font-display"
            >
              Jadwalkan Demo
            </a>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-sm text-[#0b1020]/65">
                <b.icon className="h-4 w-4 text-[#5B6CF9]" />
                <span>{b.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-100">
            <div>
              <div className="font-display text-2xl font-bold text-[#0b1020]">500+</div>
              <div className="text-xs text-[#0b1020]/50 mt-0.5">Sekolah Aktif</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-[#0b1020]">99.9%</div>
              <div className="text-xs text-[#0b1020]/50 mt-0.5">Uptime SLA</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-[#0b1020]">24/7</div>
              <div className="text-xs text-[#0b1020]/50 mt-0.5">Support Indonesia</div>
            </div>
          </div>
        </motion.div>

        {/* Right — dashboard + hardware mockup */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative">
          <div className="relative bg-slate-50 rounded-3xl border border-[#5B6CF9]/20 p-4 shadow-2xl overflow-hidden group">
            {/* dashboard mockup */}
            <div className="bg-white rounded-2xl w-full border border-slate-200 p-5">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500/40" />
                  <div className="h-2 w-2 rounded-full bg-yellow-500/40" />
                  <div className="h-2 w-2 rounded-full bg-green-500/40" />
                  <div className="ml-3 text-[10px] font-mono text-[#0b1020]/40">app.atskolla.com/dashboard</div>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-50" />
                  <div className="w-7 h-7 rounded-lg bg-slate-50" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-[#5B6CF9]/10 border border-[#5B6CF9]/25 p-3">
                  <div className="text-[9px] uppercase tracking-wider text-[#5B6CF9] font-semibold">Kehadiran</div>
                  <div className="text-[#0b1020] font-display font-bold text-xl mt-1">94.8%</div>
                  <div className="text-[10px] text-[#0b1020]/40 mt-0.5">1.204 hadir</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-[9px] uppercase tracking-wider text-[#0b1020]/40 font-semibold">SPP</div>
                  <div className="text-[#0b1020] font-display font-bold text-xl mt-1">312<span className="text-xs text-[#0b1020]/40">Jt</span></div>
                  <div className="text-[10px] text-[#0b1020]/40 mt-0.5">87% terkumpul</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-[9px] uppercase tracking-wider text-[#0b1020]/40 font-semibold">Aktif</div>
                  <div className="text-[#0b1020] font-display font-bold text-xl mt-1">1.270</div>
                  <div className="text-[10px] text-[#0b1020]/40 mt-0.5">siswa</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 h-32 flex items-end gap-1.5">
                {[38, 55, 62, 48, 70, 82, 65, 74, 90, 68, 78, 88].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#5B6CF9]/70 to-[#5B6CF9]/20" style={{ height: `${h}%` }} />
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-[#5B6CF9]/20" />
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-full w-4/5 rounded-full bg-[#5B6CF9]/60" />
                  </div>
                  <div className="text-[10px] text-[#0b1020]/50 font-mono">07:12</div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-[#5B6CF9]/20" />
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-full w-3/5 rounded-full bg-[#5B6CF9]/50" />
                  </div>
                  <div className="text-[10px] text-[#0b1020]/50 font-mono">07:15</div>
                </div>
              </div>
            </div>

            {/* Floating smart card */}
            <div className="absolute -bottom-6 -left-6 w-44 h-60 bg-gradient-to-br from-[#5B6CF9] to-[#1a2340] rounded-2xl border border-slate-200 shadow-2xl p-5 flex flex-col justify-between transform -rotate-6 group-hover:rotate-0 transition-transform duration-500">
              <div className="flex justify-between items-start">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-[#0b1020]" />
                </div>
                <div className="text-[9px] text-[#0b1020]/65 font-mono tracking-widest">SMART CARD</div>
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-white/25 rounded-full" />
                <div className="h-1.5 w-2/3 bg-white/20 rounded-full" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-slate-100 border border-white/25 flex items-center justify-center">
                  <Radio className="h-4 w-4 text-[#0b1020]/75" />
                </div>
                <div className="text-[8px] text-[#0b1020]/75 leading-tight uppercase font-bold tracking-widest">
                  RFID<br />Secure
                </div>
              </div>
            </div>

            {/* RFID scanner mockup */}
            <div className="absolute top-14 -right-6 w-36 h-36 bg-slate-50 rounded-2xl border border-[#5B6CF9]/30 shadow-2xl flex items-center justify-center transform rotate-6 group-hover:rotate-0 transition-transform duration-500">
              <div className="text-center">
                <div className="w-14 h-16 mx-auto bg-white rounded-lg border border-[#5B6CF9]/25 flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-0.5 bg-[#5B6CF9] rounded-full animate-pulse" />
                  <div className="w-6 h-6 rounded-full border-2 border-[#5B6CF9]/40" />
                </div>
                <div className="mt-2 text-[9px] text-[#0b1020]/50 font-bold tracking-widest">RFID SCANNER</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------- Stats Bar ----------
function StatsBar() {
  return (
    <Section className="py-16 lg:py-20 bg-white border-b border-slate-100">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className="flex flex-col"
          >
            <div className="h-10 w-10 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center mb-4">
              <s.icon className="h-5 w-5 text-[#5B6CF9]" />
            </div>
            <div className="font-display text-3xl lg:text-4xl font-bold text-[#0b1020] tracking-tight">{s.value}</div>
            <div className="text-sm text-[#0b1020]/60 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ---------- Problem → Solution ----------
function ProblemSolution() {
  return (
    <Section id="masalah" className="py-20 lg:py-28 bg-[#f5f7fb]">
      <SectionHeader
        eyebrow="Masalah yang diselesaikan"
        title={<>Dari administrasi manual ke <span className="text-[#5B6CF9]">sekolah digital</span>.</>}
        sub="Kami mendengar keluhan yang sama dari ratusan sekolah — dan membangun ATSkolla untuk menyelesaikannya."
      />
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Problems */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <div className="text-xs font-semibold tracking-widest text-red-500 uppercase mb-6">Kondisi sekarang</div>
          <ul className="space-y-5">
            {PROBLEMS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <div className="mt-1 h-6 w-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                  <X className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div>
                  <div className="font-display font-semibold text-[#0b1020]">{p.title}</div>
                  <div className="text-sm text-[#0b1020]/60 mt-0.5">{p.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Solutions */}
        <div className="rounded-3xl bg-white p-8 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#5B6CF9] rounded-full blur-[100px] opacity-20" />
          <div className="relative">
            <div className="text-xs font-semibold tracking-widest text-[#5B6CF9] uppercase mb-6">Dengan ATSkolla</div>
            <ul className="space-y-5">
              {SOLUTIONS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <div className="mt-1 h-8 w-8 rounded-lg bg-[#5B6CF9]/15 border border-[#5B6CF9]/30 flex items-center justify-center shrink-0">
                    <s.icon className="h-4 w-4 text-[#5B6CF9]" />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-[#0b1020]">{s.title}</div>
                    <div className="text-sm text-[#0b1020]/55 mt-0.5">{s.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- Ecosystem Hub ----------
function Ecosystem() {
  return (
    <Section id="ekosistem" className="py-20 lg:py-28 bg-white">
      <SectionHeader
        eyebrow="Ekosistem ATSkolla"
        title={<>Satu platform. <span className="text-[#5B6CF9]">Semua peran sekolah</span> terhubung.</>}
        sub="ATSkolla menjadi pusat data yang menghubungkan akademik, keuangan, operasional, guru, dan orang tua."
      />

      <div className="relative rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-8 lg:p-14 overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#5B6CF9 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          }}
        />

        <div className="relative grid lg:grid-cols-[1fr_auto_1fr] gap-10 items-center min-h-[420px]">
          {/* left column nodes */}
          <div className="space-y-4">
            {ECOSYSTEM_NODES.slice(0, 3).map((n) => (
              <div key={n.label} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm hover:-translate-y-0.5 transition-transform">
                <div className="h-10 w-10 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center">
                  <n.icon className="h-5 w-5 text-[#5B6CF9]" />
                </div>
                <div className="font-display font-semibold text-[#0b1020]">{n.label}</div>
              </div>
            ))}
          </div>

          {/* center hub */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#5B6CF9]/25 blur-2xl" />
              <div className="relative h-28 w-28 lg:h-36 lg:w-36 rounded-3xl bg-white border border-[#5B6CF9]/40 flex flex-col items-center justify-center shadow-2xl">
                <img src={atskollaPlatformLogo.url} alt="ATSkolla" className="h-12 w-12 lg:h-14 lg:w-14 object-contain mb-1" />

                <div className="font-display font-bold text-[#0b1020] text-sm">ATSkolla</div>
                <div className="text-[9px] text-[#0b1020]/50 uppercase tracking-widest">Core Platform</div>
              </div>
            </div>
          </div>

          {/* right column nodes */}
          <div className="space-y-4">
            {ECOSYSTEM_NODES.slice(3, 6).map((n) => (
              <div key={n.label} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm hover:-translate-y-0.5 transition-transform">
                <div className="h-10 w-10 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center">
                  <n.icon className="h-5 w-5 text-[#5B6CF9]" />
                </div>
                <div className="font-display font-semibold text-[#0b1020]">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- Modules ----------
function Modules() {
  return (
    <Section id="modul" className="py-20 lg:py-28 bg-[#f5f7fb]">
      <SectionHeader
        eyebrow="Modul ATSkolla"
        title={<>Semua yang dibutuhkan sekolah, <span className="text-[#5B6CF9]">tanpa berpindah aplikasi</span>.</>}
        sub="Dikelompokkan berdasarkan area kerja — bukan daftar fitur panjang tanpa struktur."
      />

      <div className="space-y-10">
        {MODULES.map((group) => (
          <div key={group.group}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center">
                <group.icon className="h-4 w-4 text-[#5B6CF9]" />
              </div>
              <div className="font-display text-xl font-bold text-[#0b1020]">{group.group}</div>
              <div className="flex-1 h-px bg-slate-200" />
              <div className="text-xs text-[#0b1020]/50">{group.items.length} modul</div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.items.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-[#5B6CF9]/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#5B6CF9]/5 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-[#5B6CF9]" />
                  </div>
                  <div className="font-display font-semibold text-[#0b1020]">{item.title}</div>
                  <div className="text-sm text-[#0b1020]/55 mt-1">{item.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------- Payment System ----------
function PaymentSystem() {
  return (
    <Section id="pembayaran" className="py-20 lg:py-28 bg-white">
      <SectionHeader
        eyebrow="Sistem pembayaran sekolah"
        title={<>Pembayaran SPP <span className="text-[#5B6CF9]">otomatis</span>, laporan siap audit.</>}
        sub="Dari tagihan hingga rekonsiliasi, semua tercatat rapi tanpa kerja manual bendahara."
      />

      <div className="grid lg:grid-cols-5 gap-8 items-start">
        {/* Feature list */}
        <div className="lg:col-span-2 space-y-3">
          {PAYMENT_ITEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#5B6CF9]/40 transition-colors">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
                  <p.icon className="h-5 w-5 text-[#5B6CF9]" />
                </div>
                <div>
                  <div className="font-display font-semibold text-[#0b1020]">{p.title}</div>
                  <div className="text-sm text-[#0b1020]/60 mt-1">{p.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard mock */}
        <div className="lg:col-span-3 rounded-3xl bg-white p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#5B6CF9] rounded-full blur-[100px] opacity-15" />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[#0b1020]/50 text-xs">Dashboard Bendahara</div>
                <div className="font-display  text-[#0b1020] font-bold text-lg">SPP Bulan November</div>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-[10px] text-[#0b1020]/50 uppercase tracking-wider">Terkumpul</div>
                <div className="font-display  text-[#0b1020] text-xl font-bold mt-1">Rp 271Jt</div>
                <div className="text-[10px] text-emerald-400 mt-1">+12% MoM</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-[10px] text-[#0b1020]/50 uppercase tracking-wider">Tunggakan</div>
                <div className="font-display  text-[#0b1020] text-xl font-bold mt-1">Rp 41Jt</div>
                <div className="text-[10px] text-amber-400 mt-1">42 siswa</div>
              </div>
              <div className="rounded-xl bg-[#5B6CF9]/15 border border-[#5B6CF9]/30 p-4">
                <div className="text-[10px] text-[#5B6CF9] uppercase tracking-wider">Target</div>
                <div className="font-display  text-[#0b1020] text-xl font-bold mt-1">87%</div>
                <div className="text-[10px] text-[#0b1020]/50 mt-1">tercapai</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 mb-4">
              <div className="text-[#0b1020]/50 text-xs mb-3">Progress pembayaran</div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-[#5B6CF9] to-[#7c8bff]" />
              </div>
              <div className="flex justify-between text-[10px] text-[#0b1020]/40 mt-2">
                <span>Rp 0</span><span>Rp 312.000.000</span>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { name: "Ahmad Fadli — VI-A", status: "Lunas via QRIS", color: "emerald" },
                { name: "Sari Mulyani — V-B", status: "Reminder terkirim", color: "amber" },
                { name: "Rendi Pratama — IV-C", status: "Lunas via VA BRI", color: "emerald" },
                { name: "Dina Kartika — III-A", status: "Lunas via QRIS", color: "emerald" },
                { name: "Bagas Wicaksono — II-B", status: "Reminder terkirim", color: "amber" },
                { name: "Nadia Salsabila — VI-B", status: "Lunas via VA Mandiri", color: "emerald" },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                  <div className="text-[#0b1020] text-sm font-medium">{r.name}</div>
                  <div className={`text-[10px] font-semibold ${r.color === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- Hardware ----------
function Hardware() {
  return (
    <Section id="hardware" className="py-20 lg:py-28 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-[#5B6CF9] rounded-full blur-[160px] opacity-10" />
      <div className="relative">
        <SectionHeader
          eyebrow="Hardware ATSkolla"
          title={<>Perangkat resmi <span className="text-[#5B6CF9]">terintegrasi</span> dengan sistem.</>}
          sub="Plug-and-play — hubungkan perangkat, data absensi & identitas langsung tersinkron ke dasbor sekolah."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HARDWARE.map((h, i) => (
            <motion.div
              key={h.name}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-3xl bg-slate-50 border border-slate-200 p-6 hover:border-[#5B6CF9]/50 hover:-translate-y-1 transition-all"
            >
              <div className="aspect-square rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-5 relative overflow-hidden">
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(11,16,32,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,16,32,.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                <div className="relative h-16 w-16 rounded-2xl bg-[#5B6CF9]/15 border border-[#5B6CF9]/30 flex items-center justify-center">
                  <h.icon className="h-8 w-8 text-[#5B6CF9]" />
                </div>
              </div>
              <div className="font-display font-bold text-[#0b1020] text-lg">{h.name}</div>
              <div className="text-sm text-[#0b1020]/55 mt-1.5 leading-relaxed">{h.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------- Dashboard Preview per Role ----------
function DashboardPreview() {
  const [active, setActive] = useState(0);
  const role = ROLES[active];
  return (
    <Section id="dashboard" className="py-20 lg:py-28 bg-white">
      <SectionHeader
        eyebrow="Dashboard per peran"
        title={<>Setiap peran mendapat <span className="text-[#5B6CF9]">tampilan yang relevan</span>.</>}
        sub="Kepala sekolah melihat ringkasan strategis. Bendahara melihat arus kas. Wali murid melihat anaknya. Semua dari satu platform."
      />

      <div className="flex flex-wrap gap-2 mb-8">
        {ROLES.map((r, i) => (
          <button
            key={r.key}
            onClick={() => setActive(i)}
            className={`px-4 py-2 rounded-full text-sm font-semibold font-display transition-all ${
              i === active ? "bg-[#5B6CF9] text-white shadow-lg shadow-[#5B6CF9]/25" : "bg-slate-100 text-[#0b1020]/70 hover:bg-slate-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <motion.div
        key={role.key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl bg-white p-4 lg:p-6 shadow-2xl border border-slate-200"
      >
        <div className="rounded-2xl bg-slate-50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs text-[#0b1020]/50">{role.label}</div>
              <div className="font-display  text-[#0b1020] font-bold text-xl">{role.metric.top}</div>
            </div>
            <div className="text-right">
              <div className="font-display  text-[#0b1020] text-3xl font-bold">{role.metric.val}</div>
              <div className="text-xs text-[#0b1020]/50 mt-0.5">{role.metric.sub}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {role.blocks.map((b) => (
              <div key={b} className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#5B6CF9] font-semibold">Modul</div>
                <div className="font-display  text-[#0b1020] font-semibold mt-1">{b}</div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 rounded-full bg-slate-100" />
                  <div className="h-1.5 rounded-full bg-slate-100 w-4/5" />
                  <div className="h-1.5 rounded-full bg-slate-100 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

// ---------- Why Free ----------
function WhyFree() {
  return (
    <Section className="py-20 lg:py-28 bg-[#f5f7fb]">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Eyebrow>Model bisnis transparan</Eyebrow>
          <h2 className="mt-4 font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[#0b1020] tracking-tight leading-[1.1]">
            Mengapa ATSkolla <span className="text-[#5B6CF9]">gratis</span>?
          </h2>
          <p className="mt-5 text-base lg:text-lg text-[#0b1020]/70 leading-relaxed">
            ATSkolla dapat digunakan sekolah sepenuhnya gratis — tanpa biaya langganan, tanpa biaya setup, dan tanpa komitmen.
          </p>

          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {[
              { icon: CreditCard, t: "Payment gateway" },
              { icon: IdCard, t: "Cetak kartu pelajar" },
              { icon: Server, t: "Perangkat & hardware" },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-slate-200 bg-white p-4">
                <x.icon className="h-5 w-5 text-[#5B6CF9]" />
                <div className="font-display font-semibold text-[#0b1020] text-sm mt-3">{x.t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-3xl bg-white p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#5B6CF9] rounded-full blur-[100px] opacity-20" />
            <div className="relative space-y-5">
              {[
                { l: "Biaya langganan sekolah", v: "Rp 0", accent: true },
                { l: "Setup & onboarding", v: "Gratis" },
                { l: "Update platform", v: "Otomatis" },
                { l: "Support dasar", v: "24/7" },
                { l: "Backup data harian", v: "Termasuk" },
              ].map((row) => (
                <div key={row.l} className="flex items-center justify-between border-b border-slate-200 pb-4 last:border-0">
                  <div className={`text-sm ${row.accent ? "text-[#0b1020] font-semibold" : "text-[#0b1020]/65"}`}>{row.l}</div>
                  <div className={`font-display font-bold ${row.accent ? "text-[#5B6CF9] text-2xl" : "text-[#0b1020]"}`}>{row.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- FAQ ----------
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 py-5 text-left">
        <span className="font-display font-semibold text-[#0b1020] text-base lg:text-lg">{q}</span>
        <ChevronDown className={`h-5 w-5 text-[#5B6CF9] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pb-5">
          <div className="text-[#0b1020]/65 leading-relaxed text-sm lg:text-base">{a}</div>
        </motion.div>
      )}
    </div>
  );
}


function Faq() {
  return (
    <Section id="faq" className="py-20 lg:py-28 bg-white">
      <div className="grid lg:grid-cols-[1fr_2fr] gap-12">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold text-[#0b1020] tracking-tight leading-[1.1]">
            Pertanyaan yang <span className="text-[#5B6CF9]">sering ditanyakan</span>.
          </h2>
          <p className="mt-4 text-[#0b1020]/60">Tidak menemukan jawaban? Tim kami siap membantu.</p>
        </div>
        <div>
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------- Final CTA ----------
function FinalCTA() {
  const nav = useNavigate();
  return (
    <Section id="kontak" className="py-20 lg:py-28 bg-white relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(11,16,32,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,16,32,.05) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#5B6CF9] rounded-full blur-[160px] opacity-15" />

      <div className="relative text-center max-w-3xl mx-auto">
        <Eyebrow>Siap Memulai</Eyebrow>
        <h2 className="mt-5 font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#0b1020] tracking-tight leading-[1.05]">
          Siap Membangun Sekolah Digital <span className="text-[#5B6CF9]">Bersama ATSkolla</span>?
        </h2>
        <p className="mt-5 text-lg text-[#0b1020]/65 max-w-xl mx-auto">
          Aktifkan platform hari ini — tanpa biaya langganan, tanpa komitmen jangka panjang.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => nav("/register")}
            className="inline-flex items-center gap-2 px-7 py-4 bg-[#5B6CF9] hover:bg-[#5B6CF9]/90 text-white font-semibold rounded-xl shadow-lg shadow-[#5B6CF9]/25 font-display"
          >
            Mulai Gratis <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="https://wa.me/628886117537"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-7 py-4 bg-transparent hover:bg-slate-100  text-[#0b1020] border border-slate-200 font-semibold rounded-xl font-display"
          >
            Hubungi Kami <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Section>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer className="relative bg-gradient-to-br from-[#4a5cf0] via-[#5B6CF9] to-[#7c8dff] text-white/85">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-8 grid md:grid-cols-12 gap-10">
        {/* Brand + Company Info */}
        <div className="md:col-span-4">
          <div className="inline-flex items-center justify-center rounded-xl bg-white/95 backdrop-blur px-3 py-2 mb-5 shadow-sm">
            <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" width={140} height={36} loading="lazy" decoding="async" className="h-9 w-auto object-contain" />
          </div>
          <p className="text-[15px] font-semibold text-white mb-1">CV Prestaisi Kita Bersama</p>
          <p className="text-sm leading-relaxed text-white/75 mb-4">
            Platform Digital Sekolah Terintegrasi<br />
            untuk sekolah di seluruh Indonesia.
          </p>
          <ul className="space-y-2 text-sm text-white/85">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> +62 888 6117 537</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /> halo@atskolla.com</li>
            <li className="flex items-start gap-2"><MapPin className="h-4 w-4 shrink-0 mt-0.5" /> <span>Indonesia</span></li>
          </ul>
        </div>

        {/* Platform */}
        <div className="md:col-span-2">
          <div className="font-display font-bold text-white text-[15px] mb-4">Platform</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#modul" className="text-white/75 hover:text-white transition-colors">Modul</a></li>
            <li><a href="#pembayaran" className="text-white/75 hover:text-white transition-colors">Pembayaran</a></li>
            <li><a href="#hardware" className="text-white/75 hover:text-white transition-colors">Hardware</a></li>
            <li><a href="#dashboard" className="text-white/75 hover:text-white transition-colors">Dashboard</a></li>
          </ul>
        </div>

        {/* Panduan */}
        <div className="md:col-span-2">
          <div className="font-display font-bold text-white text-[15px] mb-4">Panduan</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/panduan" className="text-white/75 hover:text-white transition-colors">Panduan</a></li>
            <li><a href="/faq" className="text-white/75 hover:text-white transition-colors">FAQ</a></li>
            <li><a href="/kontak" className="text-white/75 hover:text-white transition-colors">Kontak</a></li>
            <li><a href="/kebijakan-refund" className="text-white/75 hover:text-white transition-colors">Kebijakan Refund</a></li>
          </ul>
        </div>

        {/* Perusahaan */}
        <div className="md:col-span-2">
          <div className="font-display font-bold text-white text-[15px] mb-4">Perusahaan</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/syarat-ketentuan" className="text-white/75 hover:text-white transition-colors">Syarat & Ketentuan</a></li>
            <li><a href="/kebijakan-refund" className="text-white/75 hover:text-white transition-colors">Kebijakan Privasi</a></li>
            <li><a href="/kontak" className="text-white/75 hover:text-white transition-colors">Hubungi Kami</a></li>
          </ul>
        </div>

        {/* Akun */}
        <div className="md:col-span-2">
          <div className="font-display font-bold text-white text-[15px] mb-4">Akun</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/login" className="text-white/75 hover:text-white transition-colors">Masuk</a></li>
            <li><a href="/register" className="text-white/75 hover:text-white transition-colors">Daftar Gratis</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <div>© {new Date().getFullYear()} CV Prestais Kita Bersama. All rights reserved.</div>
          <div>Made with care for Indonesian schools.</div>
        </div>
      </div>
    </footer>
  );
}

// ---------- Devices Showcase ----------
function DevicesShowcase() {
  return (
    <Section className="py-20 lg:py-28 bg-[#f5f7fb] relative overflow-hidden">
      {/* ambient glows */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-[#5B6CF9]/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] bg-[#a78bfa]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* LEFT — Text */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <Eyebrow>Satu platform, semua perangkat</Eyebrow>
          <h2 className="mt-4 font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[#0b1020] tracking-tight leading-[1.1]">
            Akses ATSkolla dari <span className="text-[#5B6CF9]">laptop hingga smartphone</span>.
          </h2>
          <p className="mt-5 text-base lg:text-lg text-[#0b1020]/70 leading-relaxed">
            Antarmuka responsif yang dirancang untuk admin sekolah di desktop dan wali kelas maupun orang tua di mobile — data selalu tersinkron real-time.
          </p>
        </motion.div>


        {/* RIGHT — Device mockup */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <motion.img
            src={headerDeviceAsset.url}
            alt="Dashboard ATSkolla di laptop dan aplikasi mobile"
            loading="lazy"
            decoding="async"
            draggable={false}
            className="relative w-full h-auto drop-shadow-[0_45px_70px_rgba(11,16,32,0.28)] select-none"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[70%] h-6 rounded-[50%] bg-[#0b1020]/25 blur-2xl pointer-events-none" />
        </motion.div>
      </div>
    </Section>
  );
}



// ---------- Page ----------
export default function LandingPage() {
  useEffect(() => {
    document.title = "ATSkolla — Platform Digital Sekolah Terintegrasi";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Kelola absensi, pembayaran SPP online, keuangan sekolah, kartu pelajar, komunikasi orang tua, dan administrasi sekolah dalam satu platform.",
      );
    }
    // Warm anon connection so first CTA is snappy — silent, non-blocking.
    supabase.auth.getSession().catch(() => {});
  }, []);

  const { theme, toggle } = useLandingTheme();

  return (
    <MotionConfig transition={{ duration: 0 }}>
    <div
      data-ls-theme={theme}
      className="no-motion min-h-screen bg-white font-sans text-[#0b1020] antialiased selection:bg-[#5B6CF9]/30 selection:text-white"
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_THEME_CSS }} />
      <Nav theme={theme} onToggleTheme={toggle} />
      <main>
        <Hero />
        <StatsBar />
        <ProblemSolution />
        <Ecosystem />
        <Modules />
        <PaymentSystem />
        <Hardware />
        <DashboardPreview />
        <DevicesShowcase />
        <WhyFree />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
    </div>
    </MotionConfig>
  );
}
