import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import TypingEffect from "@/components/TypingEffect";
import {
  ArrowRight, CheckCircle2, Mail, Phone, MapPin,
  Zap, QrCode, GraduationCap,
  Star, ChevronRight, Sparkles, Play,
  Quote, ChevronLeft, Award,
  Monitor, FileBarChart, Bell, UserCheck, BarChart3,
  Lock, Smartphone, TrendingUp, AlertTriangle, XCircle, Clock, FileText, Globe, Users, ArrowDown,
  CalendarDays, Wallet, CreditCard, MessageSquare, BookOpen, Receipt,
  Facebook, Twitter, Instagram, Linkedin,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PlanCardsGrid } from "@/components/PlanCardsGrid";
import { useWaCreditEnabled } from "@/hooks/useWaCreditEnabled";
import { transformPlanFeatures } from "@/lib/planFeatures";
import heroMockup from "@/assets/hero-mockup-theme2.png";
import dashboardPreviewStack from "@/assets/dashboard-preview-stack.png";
import illustSchool from "@/assets/illust-dashboard-school.png";
import illustTeacher from "@/assets/illust-dashboard-teacher.png";
import illustBendahara from "@/assets/illust-dashboard-bendahara.png";
import illustParent from "@/assets/illust-dashboard-parent.png";
import illustrationScan from "@/assets/illustration-scan.png";
import illustrationRegister from "@/assets/illustration-register.png";
import illustrationMonitor from "@/assets/illustration-monitor.png";
// Dashboard previews — gunakan cover yang sama seperti halaman /panduan
const dashboardSchoolImg = "/panduan/school-dashboard.jpg";
const dashboardTeacherImg = "/panduan/teacher-dashboard-uswatun.jpg";
const dashboardParentImg = "/panduan/parent-login.jpg";
const dashboardBendaharaImg = "/panduan/bendahara-dashboard.jpg";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

interface PlanRow { id: string; name: string; price: number; description: string | null; features: any; max_students: number | null; sort_order: number; }
interface TrustedSchool { name: string; initials: string; logo_url: string | null; }
interface Testimonial { name: string; role: string; text: string; rating: number; }

const DEFAULT_FEATURES = [
  { icon: QrCode, title: "Scan QR & Face AI", desc: "Absensi instan via QR Code atau Face Recognition AI. Tanpa kartu, tanpa sentuhan, kurang dari 1 detik.", color: "bg-blue-50 dark:bg-blue-500/10", iconColor: "text-blue-600 dark:text-blue-400" },
  { icon: Monitor, title: "Dashboard Real-Time", desc: "Pantau kehadiran, jadwal mengajar, dan keuangan SPP secara live dengan grafik interaktif.", color: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { icon: CalendarDays, title: "Jadwal Mengajar Live", desc: "Atur jadwal mengajar per guru & kelas. Live schedule menampilkan kelas berlangsung & berikutnya.", color: "bg-violet-50 dark:bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400" },
  { icon: Receipt, title: "Tagihan SPP Otomatis", desc: "Generate tagihan SPP per kelas atau seluruh sekolah sekali klik, kirim WA otomatis ke wali murid.", color: "bg-amber-50 dark:bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400" },
  { icon: CreditCard, title: "Pembayaran Online", desc: "Wali murid bayar SPP via QRIS atau Transfer Bank. Status update otomatis tanpa konfirmasi manual.", color: "bg-rose-50 dark:bg-rose-500/10", iconColor: "text-rose-600 dark:text-rose-400" },
  { icon: Bell, title: "Notifikasi WhatsApp", desc: "Absensi, jadwal, pengumuman, dan tagihan SPP dikirim otomatis ke WhatsApp wali murid.", color: "bg-green-50 dark:bg-green-500/10", iconColor: "text-green-600 dark:text-green-400" },
  { icon: Users, title: "Portal Wali Murid", desc: "Dashboard khusus orang tua untuk pantau absensi, jadwal anak, pengumuman, dan riwayat SPP.", color: "bg-cyan-50 dark:bg-cyan-500/10", iconColor: "text-cyan-600 dark:text-cyan-400" },
  { icon: FileBarChart, title: "Laporan Terintegrasi", desc: "Rekap absensi, keuangan SPP, dan jadwal dalam satu sistem. Export Excel & PDF kapan saja.", color: "bg-indigo-50 dark:bg-indigo-500/10", iconColor: "text-indigo-600 dark:text-indigo-400" },
  { icon: GraduationCap, title: "Multi-Role & Multi Sekolah", desc: "4 peran (Admin, Bendahara, Wali Kelas, Wali Murid) dan arsitektur multi-tenant untuk banyak sekolah.", color: "bg-fuchsia-50 dark:bg-fuchsia-500/10", iconColor: "text-fuchsia-600 dark:text-fuchsia-400" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Setup Sekolah", desc: "Daftar akun, import siswa & guru, atur kelas, jadwal mengajar, dan tagihan SPP.", img: illustrationRegister },
  { step: "02", title: "Operasional Harian", desc: "Absensi via QR/Face Recognition, jadwal mengajar live, dan generate tagihan SPP otomatis.", img: illustrationScan },
  { step: "03", title: "Monitoring & Pembayaran", desc: "Wali murid pantau absensi real-time, terima notifikasi WA, dan bayar SPP online via QRIS/Transfer.", img: illustrationMonitor },
];

const DEFAULT_TESTIMONIALS = [
  { name: "Ibu Sari Dewi", role: "Kepala Sekolah, SD Negeri 1 Jakarta", text: "Sejak menggunakan ATSkolla, proses absensi jadi lebih cepat dan akurat. Guru-guru sangat terbantu karena tidak perlu lagi mencatat manual. Orang tua juga senang karena langsung dapat notifikasi WhatsApp.", rating: 5 },
  { name: "Pak Ahmad Fauzi", role: "Wakil Kepala Sekolah, SMP Islam Al-Azhar", text: "Dashboard real-time memudahkan kami memantau kehadiran siswa. Rekap otomatis menghemat waktu 80%.", rating: 5 },
  { name: "Ibu Rina Kartika", role: "Guru Kelas, TK Bunda Mulia", text: "Fitur scan barcode sangat memudahkan. Notifikasi ke orang tua membuat mereka lebih tenang.", rating: 5 },
];

const DEFAULT_TRUSTED_SCHOOLS = [
  { name: "SD Negeri 1 Jakarta", initials: "SDN1", logo_url: null },
  { name: "SMP Islam Al-Azhar", initials: "SIA", logo_url: null },
  { name: "TK Bunda Mulia", initials: "TBM", logo_url: null },
  { name: "SD IT Nurul Fikri", initials: "SINF", logo_url: null },
  { name: "SMP Negeri 5 Bandung", initials: "SMP5", logo_url: null },
  { name: "SD Muhammadiyah 9", initials: "SDM9", logo_url: null },
];

const PROBLEMS = [
  { icon: AlertTriangle, title: "Absensi Manual", desc: "Pencatatan kehadiran masih pakai buku tulis, rawan kesalahan dan manipulasi data." },
  { icon: Clock, title: "Proses Lambat", desc: "Guru memanggil siswa satu per satu untuk absensi, memakan waktu jam belajar." },
  { icon: CalendarDays, title: "Jadwal Mengajar Berantakan", desc: "Jadwal mengajar guru dikelola lewat kertas atau grup WA, sering bentrok dan terlewat." },
  { icon: Receipt, title: "Tagihan SPP Manual", desc: "Bendahara membuat tagihan SPP satu per satu di Excel, rawan salah hitung dan tunggakan menumpuk." },
  { icon: Wallet, title: "Pembayaran Ribet", desc: "Wali murid harus datang ke sekolah untuk bayar SPP, antri, dan menyimpan kuitansi fisik." },
  { icon: MessageSquare, title: "Komunikasi Lambat", desc: "Pengumuman sekolah hanya lewat surat kertas atau grup WA yang sering tidak terbaca." },
  { icon: Users, title: "Wali Murid Tidak Tahu", desc: "Orang tua tidak tahu kehadiran, jadwal, dan tagihan anak secara real-time." },
  { icon: FileText, title: "Laporan Tidak Akurat", desc: "Data manual sulit diaudit — absensi, keuangan, dan jadwal sering tidak cocok." },
];

const SOLUTIONS = [
  { icon: QrCode, problem: "Absensi Manual", solution: "Scan QR & Face AI", desc: "Siswa absen via QR atau Face Recognition AI. Proses kurang dari 1 detik, tanpa kontak." },
  { icon: BarChart3, problem: "Proses Lambat", solution: "Rekap Otomatis", desc: "Rekap harian, mingguan, bulanan dibuat otomatis dengan statistik lengkap & export Excel/PDF." },
  { icon: CalendarDays, problem: "Jadwal Berantakan", solution: "Jadwal Mengajar Live", desc: "Atur jadwal per guru & kelas. Live schedule menampilkan kelas berlangsung & berikutnya." },
  { icon: Receipt, problem: "Tagihan SPP Manual", solution: "Generate SPP Sekali Klik", desc: "Generate tagihan SPP per kelas atau seluruh sekolah dalam satu klik, kirim WA otomatis." },
  { icon: CreditCard, problem: "Pembayaran Ribet", solution: "Bayar SPP Online", desc: "Wali murid bayar SPP via QRIS atau Transfer Bank langsung dari WhatsApp. Status update otomatis." },
  { icon: Bell, problem: "Komunikasi Lambat", solution: "Notifikasi WhatsApp", desc: "Absensi, jadwal, pengumuman, dan tagihan SPP dikirim otomatis ke WhatsApp wali murid." },
  { icon: Monitor, problem: "Wali Murid Tidak Tahu", solution: "Portal Wali Murid", desc: "Dashboard khusus wali murid untuk pantau absensi, jadwal anak, pengumuman, dan riwayat SPP." },
  { icon: FileBarChart, problem: "Laporan Tidak Akurat", solution: "Laporan Terintegrasi", desc: "Laporan absensi, keuangan SPP, dan jadwal mengajar dalam satu sistem — akurat & bisa diaudit." },
];

const WHY_ITEMS = [
  { icon: Lock, title: "Keamanan Tingkat Tinggi", desc: "Data terenkripsi end-to-end dengan standar keamanan enterprise." },
  { icon: Smartphone, title: "Akses dari Mana Saja", desc: "Web-based, responsive di semua perangkat tanpa install aplikasi." },
  { icon: TrendingUp, title: "Skalabel Tanpa Batas", desc: "Dari 30 siswa hingga ribuan. Infrastruktur yang tumbuh bersama Anda." },
  { icon: Star, title: "Setup 5 Menit", desc: "Import data, aktifkan scan, langsung pakai. Tanpa training rumit." },
];

/* ─── Testimonial Slider ─── */
const TestimonialSlider = ({ testimonials }: { testimonials: Testimonial[] }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const next = useCallback(() => { setDirection(1); setCurrent(p => (p + 1) % testimonials.length); }, [testimonials.length]);
  const prev = useCallback(() => { setDirection(-1); setCurrent(p => (p - 1 + testimonials.length) % testimonials.length); }, [testimonials.length]);
  useEffect(() => { const t = setInterval(next, 6000); return () => clearInterval(t); }, [next]);
  const t = testimonials[current];
  if (!t) return null;
  const variants = { enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }) };

  return (
    <section className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Testimoni</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Apa Kata Pengguna Kami?</h2>
        </motion.div>
        <div className="relative">
          <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-6 z-20 h-10 w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center"><ChevronLeft className="h-5 w-5 text-slate-700 dark:text-white" /></button>
          <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-6 z-20 h-10 w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center"><ChevronRight className="h-5 w-5 text-slate-700 dark:text-white" /></button>
          <div className="overflow-hidden min-h-[220px] flex items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={current} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35 }} className="w-full">
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-8 sm:p-10 text-center relative">
                  <Quote className="h-8 w-8 text-indigo-500/10 absolute top-6 left-6" />
                  <div className="flex justify-center gap-1 mb-4">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed italic max-w-2xl mx-auto">"{t.text}"</p>
                  <div className="mt-5"><p className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p></div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, i) => <button key={i} onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }} className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-6 bg-indigo-500" : "w-2 bg-slate-300 dark:bg-slate-600"}`} />)}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── Main Theme B Component ─── */
const LandingThemeB = () => {
  const navigate = useNavigate();
  const { enabled: waCreditEnabled } = useWaCreditEnabled();
  const [content, setContent] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [trustedSchools, setTrustedSchools] = useState<TrustedSchool[]>(DEFAULT_TRUSTED_SCHOOLS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [headerLogo, setHeaderLogo] = useState("/images/logo-atskolla.png");

  useEffect(() => {
    Promise.all([
      supabase.from("landing_content").select("key, value"),
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("landing_trusted_schools").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("landing_testimonials").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("platform_settings").select("key, value").in("key", ["header_logo_url"]),
    ]).then(([contentRes, plansRes, schoolsRes, testimonialsRes, settingsRes]) => {
      const map: Record<string, string> = {};
      (contentRes.data || []).forEach((item: any) => { map[item.key] = item.value; });
      setContent(map);
      if (settingsRes.data) {
        const sMap = Object.fromEntries(settingsRes.data.map((d: any) => [d.key, d.value]));
        if (sMap.header_logo_url) setHeaderLogo(sMap.header_logo_url);
      }
      const allPlans = (plansRes.data || []) as any[];
      const landingPlans = allPlans.filter((p: any) => p.show_on_landing !== false);
      setPlans(landingPlans as PlanRow[]);
      setShowPricing(false);
      if (schoolsRes.data && schoolsRes.data.length > 0) setTrustedSchools(schoolsRes.data as TrustedSchool[]);
      if (testimonialsRes.data && testimonialsRes.data.length > 0) setTestimonials(testimonialsRes.data as Testimonial[]);
      setLoading(false);
    });
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const get = (key: string, fallback = "") => content[key] || fallback;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 animate-pulse" />
          <p className="text-slate-500 text-sm">Memuat...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">

      {/* ─── Floating Navbar ─── */}
      <nav className="fixed top-3 left-3 right-3 z-50 transition-all duration-300 rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200/80 dark:border-slate-700/50">
        <div className="relative px-4 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 z-10">
            <img src={headerLogo} alt="ATSkolla" className="h-8 sm:h-9 object-contain" />
          </div>
          <div className="hidden md:flex items-center gap-6 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {[
              { href: "#features", label: "Fitur" },
              { href: "#how-it-works", label: "Cara Kerja" },
              ...(showPricing ? [{ href: "#pricing", label: "Harga" }] : []),
              { href: "https://wa.me/6289605757557", label: "Kontak", external: true },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#5B6CF9] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 z-10">
            <ThemeToggle />
            <button onClick={() => navigate("/admin")} className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              Masuk
            </button>
            <button onClick={() => navigate("/register")} className="inline-flex items-center gap-1.5 bg-[#5B6CF9] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]">
              Coba Gratis <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section (1 screen) ─── */}
      <section className="relative min-h-screen flex flex-col overflow-visible bg-[#5B6CF9]">
        {/* Digital grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Animated digital nodes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating circuit dots */}
          {[
            { top: '12%', left: '8%', size: 4, delay: 0 },
            { top: '25%', left: '85%', size: 3, delay: 1.2 },
            { top: '60%', left: '15%', size: 5, delay: 0.6 },
            { top: '35%', left: '72%', size: 3, delay: 1.8 },
            { top: '70%', left: '90%', size: 4, delay: 0.3 },
            { top: '18%', left: '45%', size: 3, delay: 2.1 },
            { top: '80%', left: '55%', size: 4, delay: 1.5 },
            { top: '45%', left: '5%', size: 3, delay: 0.9 },
          ].map((dot, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ top: dot.top, left: dot.left, width: dot.size, height: dot.size }}
              animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.8, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: dot.delay, ease: 'easeInOut' }}
            />
          ))}
          {/* Horizontal scan lines */}
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ top: ['100%', '0%'] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
          {/* Data stream lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <line x1="10%" y1="0" x2="30%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="6 12" />
            <line x1="50%" y1="0" x2="70%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="4 16" />
            <line x1="80%" y1="0" x2="60%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="8 14" />
            <line x1="25%" y1="0" x2="45%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="3 18" />
          </svg>
        </div>
        {/* Radial glow accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -left-32 w-[400px] h-[400px] bg-indigo-400/[0.08] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-[350px] h-[350px] bg-violet-400/[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* Text content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-28 sm:pt-24 pb-2 sm:pb-4 flex-shrink-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-xs font-bold text-white/90 mb-3 sm:mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Platform Digital Sekolah #1
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
            className="text-center text-3xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15] max-w-3xl">
            <span className="block text-white mb-2">
              {get("hero_title", "ATSkolla")}
            </span>
            <span className="block min-h-[1.2em]">
              <TypingEffect
                texts={["Platform Digital Sekolah", "Absensi QR & Face AI", "Jadwal Mengajar Live", "Bayar SPP Online", "Notifikasi WhatsApp", "Cepat, Aman & Terintegrasi"]}
                speed={60}
                deleteSpeed={35}
                pauseTime={2500}
                className="text-white/75"
              />
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-2 sm:mt-3 text-sm text-white/60 max-w-lg mx-auto leading-relaxed text-center hidden sm:block">
            {get("hero_subtitle", "Platform absensi modern dengan barcode scan & face recognition AI. Dirancang khusus untuk sekolah Indonesia.")}
          </motion.p>

          {/* Desktop buttons - hidden on mobile */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mt-5 hidden sm:flex flex-row gap-3">
            <a href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-2xl font-semibold text-sm transition-all border border-white/15">
              <Play className="h-4 w-4" /> Lihat Demo
            </a>
          </motion.div>
        </div>

        {/* Hero image - centered between title and buttons on mobile */}
        <div className="relative z-30 px-4 sm:px-6 lg:px-8 sm:-mb-28 lg:-mb-40 flex-1 sm:flex-none flex items-center sm:block">
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="max-w-5xl mx-auto overflow-visible w-full">
            <img src={get("hero_image") || heroMockup} alt="Dashboard ATSkolla"
              className="w-full h-auto object-contain" />
          </motion.div>
        </div>

        {/* Mobile buttons - pinned near bottom */}
        <div className="relative z-30 flex sm:hidden flex-col gap-2.5 px-6 mt-auto pb-16">
          <button onClick={() => navigate("/register")}
            className="inline-flex items-center justify-center gap-2 bg-white text-[#5B6CF9] px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-black/10 active:scale-[0.98]">
            <Zap className="h-4 w-4" /> {get("cta_text", "Mulai Gratis Sekarang")}
          </button>
          <a href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all border border-white/15">
            <Play className="h-4 w-4" /> Lihat Demo
          </a>
        </div>

        {/* Rounded bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-14 bg-white dark:bg-slate-950 rounded-t-[2rem] sm:rounded-t-[3rem] z-[5]" />
      </section>

      {/* ─── Trusted Schools & Stats ─── */}
      <section className="pt-32 sm:pt-44 lg:pt-52 pb-16 sm:pb-24 bg-slate-50/80 dark:bg-slate-900/30 border-y border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Kepercayaan</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Dipercaya Sekolah di Seluruh Indonesia</h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mb-12">
            {trustedSchools.map((school, i) => (
              <div key={i} className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center shadow-sm overflow-hidden">
                {school.logo_url ? <img src={school.logo_url} alt={school.name} className="h-full w-full object-contain p-2" /> : <span className="text-xs sm:text-sm font-extrabold text-indigo-500/60">{school.initials}</span>}
              </div>
            ))}
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: get("hero_stat_1_value", "500+"), label: get("hero_stat_1_label", "Sekolah Aktif") },
              { value: get("hero_stat_2_value", "120K+"), label: get("hero_stat_2_label", "Siswa Terdaftar") },
              { value: get("hero_stat_3_value", "99.9%"), label: get("hero_stat_3_label", "Data Akurat") },
              { value: get("hero_stat_4_value", "34"), label: get("hero_stat_4_label", "Provinsi") },
            ].map((stat, i) => (
              <motion.div key={i} custom={i + 2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center py-4">
                <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{stat.value}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Problems ─── */}
      <section className="py-20 sm:py-28 bg-white dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/3 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-red-500 bg-red-50 dark:bg-red-500/10 px-4 py-1.5 rounded-full mb-4">Latar Belakang</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Tantangan Administrasi Sekolah Saat Ini</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Absensi manual, jadwal mengajar berantakan, tagihan SPP di Excel, dan komunikasi wali murid yang lambat — sekolah Indonesia menghadapi banyak inefisiensi.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {PROBLEMS.map((p, i) => (
              <motion.div key={p.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative bg-white dark:bg-slate-800/60 border border-red-100 dark:border-red-500/10 rounded-2xl p-6 cursor-default overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-red-500/10">
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-bl-[3rem] group-hover:w-28 group-hover:h-28 group-hover:bg-red-500/10 transition-all duration-500" />
                <span className="absolute top-3 right-4 text-5xl font-black text-red-500/[0.06] group-hover:text-red-500/[0.12] transition-colors duration-500 select-none">0{i + 1}</span>
                <div className="relative">
                  <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4 group-hover:bg-red-100 dark:group-hover:bg-red-500/20 group-hover:scale-110 transition-all duration-300">
                    <p.icon className="h-5 w-5 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1.5">{p.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="flex flex-col items-center mb-16">
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-14 w-14 rounded-full bg-[#5B6CF9] flex items-center justify-center shadow-xl shadow-indigo-500/25">
              <ArrowDown className="h-6 w-6 text-white" />
            </motion.div>
            <p className="mt-3 font-bold text-[#5B6CF9] text-sm">Solusi Kami</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-[#5B6CF9] bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Jawaban Tepat</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">ATSkolla — Platform Digital Sekolah Terintegrasi</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-5">
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.solution} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                whileHover={{ y: -6, scale: 1.01 }}
                className="group relative bg-white dark:bg-slate-800/60 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl p-6 cursor-default overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
                <div className="absolute inset-y-0 left-0 w-1 bg-[#5B6CF9]/0 group-hover:bg-[#5B6CF9] transition-all duration-300 rounded-l-2xl" />
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#5B6CF9] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 line-through opacity-70">{s.problem}</span>
                      <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <ArrowRight className="h-3.5 w-3.5 text-[#5B6CF9] shrink-0" />
                      </motion.span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[#5B6CF9]">{s.solution}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{s.solution}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section id="features" className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Fitur Unggulan</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Semua yang Sekolah Anda Butuhkan</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">Platform lengkap untuk absensi, jadwal mengajar, pembayaran SPP, dan komunikasi wali murid — semua terintegrasi.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEFAULT_FEATURES.map((f, i) => {
              const title = get(`feature_${i + 1}_title`) || f.title;
              const desc = get(`feature_${i + 1}_desc`) || f.desc;
              return (
                <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="group bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-6 hover:border-indigo-200 dark:hover:border-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1">
                  <div className={`h-14 w-14 rounded-2xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <f.icon className={`h-7 w-7 ${f.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Dashboard Showcase ─── */}
      <section id="dashboards" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Fitur Dashboard</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard untuk Setiap Peran</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">Setiap pengguna punya tampilan dashboard sendiri, sesuai kebutuhan dan akses datanya.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { img: illustSchool, title: "Dashboard Sekolah", desc: "Statistik global kehadiran, monitoring real-time, manajemen kelas & siswa, hingga laporan rekap lengkap." },
              { img: illustTeacher, title: "Dashboard Wali Kelas & Guru", desc: "Akses cepat ke kelas binaan, jadwal mengajar, rekap absensi mapel, dan leaderboard kelas." },
              { img: illustBendahara, title: "Dashboard Bendahara", desc: "Kelola tagihan SPP, transaksi, saldo sekolah, pencairan, dan laporan keuangan dalam satu sistem." },
              { img: illustParent, title: "Dashboard Wali Murid", desc: "Pantau kehadiran anak secara real-time, notifikasi WhatsApp instan, dan riwayat absensi lengkap." },
            ].map((d, i) => (
              <motion.div key={d.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="relative group bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="relative aspect-[4/3] overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-center">
                  <img src={d.img} alt={d.title} loading="lazy" width={768} height={576} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{d.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{d.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Choose Us ─── */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/3 rounded-full blur-[150px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Kenapa Kami</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                {get("why_title", "Platform Digital Sekolah yang Terpercaya")}
              </h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400 leading-relaxed">
                {get("why_desc", "ATSkolla menyediakan platform digital terintegrasi: absensi, jadwal mengajar, pembayaran SPP online, dan komunikasi wali murid dalam satu sistem.")}
              </p>
              <button onClick={() => navigate("/register")} className="mt-8 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WHY_ITEMS.map((item, i) => (
                <motion.div key={item.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 hover:border-indigo-200 dark:hover:border-indigo-500/20 hover:shadow-lg transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3"><item.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Product Showcase ─── */}
      <section className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <img src={dashboardPreviewStack} alt="Platform ATSkolla" className="w-full h-auto" loading="lazy" width={1280} height={1280} />
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Tentang Platform</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                {get("why_title", "Platform Digital Sekolah yang Terpercaya")}
              </h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400 leading-relaxed">
                {get("why_desc", "ATSkolla menyediakan platform digital terintegrasi untuk absensi, jadwal mengajar, pembayaran SPP online, dan komunikasi wali murid. Cepat, aman, dan mudah digunakan oleh siapa saja.")}
              </p>
              <div className="mt-6 space-y-3">
                {[
                  get("why_item_1_title", "Keamanan Tingkat Tinggi"),
                  get("why_item_2_title", "Akses dari Mana Saja"),
                  get("why_item_3_title", "Skalabel Tanpa Batas"),
                  get("why_item_4_title", "Setup 5 Menit"),
                ].filter(Boolean).map((item, i) => (
                  <div key={i} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-500 shrink-0" /><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item}</span></div>
                ))}
              </div>
              <button onClick={() => navigate("/register")} className="mt-8 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Cara Kerja</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mulai dalam 3 Langkah Mudah</h2>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="relative text-center group">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                  <div className="h-28 w-28 mx-auto mb-5 relative"><img src={step.img} alt={step.title} className="h-full w-full object-contain" loading="lazy" width={512} height={512} /></div>
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-xs font-bold mb-3">{step.step}</div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10"><ChevronRight className="h-5 w-5 text-indigo-500/30" /></div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      {showPricing && (
        <section id="pricing" className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Harga</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pilih Paket Terbaik</h2>
              <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Harga transparan, tanpa biaya tersembunyi.</p>
            </motion.div>
            <PlanCardsGrid
              plans={transformPlanFeatures(plans as any, waCreditEnabled)}
              ctaLabel="Mulai Sekarang"
              hidePremiumBadge
              onSelect={() => navigate("/register")}
            />

          </div>
        </section>
      )}

      {/* ─── Testimonials ─── */}
      <TestimonialSlider testimonials={testimonials} />

      {/* ─── Payment Methods ─── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full mb-4">Pembayaran</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Semua Metode Pembayaran</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Bebas pilih cara bayar yang paling nyaman.</p>
          </motion.div>
          <div className="space-y-6">
            {[
              { title: "E-Wallet", img: "/images/payments/ewallet.webp", small: false },
              { title: "Transfer Bank", img: "/images/payments/transfer-bank.webp", small: false },
              { title: "Gerai / Outlet", img: "/images/payments/gerai.webp", small: true },
            ].map((cat, ci) => (
              <motion.div key={ci} custom={ci} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 sm:p-6">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3">{cat.title}</h4>
                <img src={cat.img} alt={cat.title} className={cat.small ? "h-8 sm:h-10 w-auto object-contain" : "max-w-full sm:max-w-2xl h-auto object-contain"} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
            <div className="relative z-10">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-6"><GraduationCap className="h-7 w-7 text-white" /></div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-4">{get("cta_banner_text", "Siap Digitalisasi Sekolah Anda?")}</h2>
              <p className="text-white/80 text-sm sm:text-base mb-8 max-w-lg mx-auto">{get("cta_banner_desc", "Kelola absensi, jadwal mengajar, SPP, komunikasi wali murid, hingga laporan dalam satu platform terpadu. Tanpa biaya setup.")}</p>
              <button onClick={() => navigate("/register")} className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-white/90 shadow-xl hover:scale-[1.02]">
                <Zap className="h-4 w-4" /> Daftar Gratis Sekarang
              </button>
              <p className="text-white/50 text-xs mt-4">Coba gratis 14 hari • Tanpa instalasi rumit</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer (style mockup) ─── */}
      <footer id="contact" className="relative bg-slate-50 dark:bg-slate-900/40 pt-10 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl pt-12 pb-8 px-6 sm:px-10 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
              {/* Brand */}
              <div className="col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  {get("footer_logo")
                    ? <img src={get("footer_logo")} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                    : <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow"><GraduationCap className="h-5 w-5 text-white" /></div>}
                  <p className="font-extrabold text-slate-900 dark:text-white text-lg">{get("footer_brand_name", "ATSkolla")}</p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                  {get("footer_description", "Solusi digital terpadu untuk sekolah modern Indonesia — absensi, jadwal mengajar, SPP, dan portal wali murid dalam satu platform.")}
                </p>
                <div className="flex items-center gap-3 pt-1 text-slate-500 dark:text-slate-400">
                  <a href="#" aria-label="Facebook" className="hover:text-indigo-600 transition-colors"><Facebook className="h-4 w-4" /></a>
                  <a href="#" aria-label="Twitter" className="hover:text-indigo-600 transition-colors"><Twitter className="h-4 w-4" /></a>
                  <a href="#" aria-label="Instagram" className="hover:text-indigo-600 transition-colors"><Instagram className="h-4 w-4" /></a>
                  <a href="#" aria-label="Linkedin" className="hover:text-indigo-600 transition-colors"><Linkedin className="h-4 w-4" /></a>
                </div>
              </div>

              {/* Company */}
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">Perusahaan</p>
                <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <li><a href="#features" className="hover:text-indigo-600 transition-colors">Fitur</a></li>
                  <li><a href="#how-it-works" className="hover:text-indigo-600 transition-colors">Cara Kerja</a></li>
                  {showPricing && <li><a href="#pricing" className="hover:text-indigo-600 transition-colors">Harga</a></li>}
                  <li><button onClick={() => navigate("/fitur")} className="hover:text-indigo-600 transition-colors">Semua Fitur</button></li>
                </ul>
              </div>

              {/* Tautan */}
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">Tautan</p>
                <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <li><button onClick={() => navigate("/admin")} className="hover:text-indigo-600 transition-colors">Login</button></li>
                  <li><button onClick={() => navigate("/register")} className="hover:text-indigo-600 transition-colors">Daftar Gratis</button></li>
                  <li><button onClick={() => navigate("/parent-login")} className="hover:text-indigo-600 transition-colors">Portal Wali Murid</button></li>
                  
                  <li><button onClick={() => navigate("/panduan")} className="hover:text-indigo-600 transition-colors">Panduan</button></li>
                </ul>
              </div>

              {/* Kontak Kami */}
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">Kontak Kami</p>
                <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                  {get("footer_phone") && (
                    <li className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"><Phone className="h-3.5 w-3.5" /></span>
                      <a href={`tel:${get("footer_phone")}`} className="hover:text-indigo-600 transition-colors">{get("footer_phone")}</a>
                    </li>
                  )}
                  {get("footer_email") && (
                    <li className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"><Mail className="h-3.5 w-3.5" /></span>
                      <a href={`mailto:${get("footer_email")}`} className="hover:text-indigo-600 transition-colors">{get("footer_email")}</a>
                    </li>
                  )}
                  {get("footer_address") && (
                    <li className="flex items-start gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5"><MapPin className="h-3.5 w-3.5" /></span>
                      <span className="leading-snug">{get("footer_address")}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400">© {new Date().getFullYear()} {get("footer_brand_name", "ATSkolla")}. All rights reserved.</p>
              <div className="flex items-center gap-5 text-xs text-slate-400">
                {get("footer_link_privacy") && <a href={get("footer_link_privacy")} target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition-colors">Kebijakan Privasi</a>}
                <button onClick={() => navigate("/panduan")} className="hover:text-indigo-600 transition-colors">Panduan</button>
                <a href="#features" className="hover:text-indigo-600 transition-colors">Fitur</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingThemeB;
