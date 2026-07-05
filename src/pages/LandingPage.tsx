import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import TypingEffect from "@/components/TypingEffect";
import LandingThemeB from "@/components/landing/LandingThemeB";
import {
  Monitor, FileBarChart,
  ArrowRight, CheckCircle2, Mail, Phone, MapPin,
  Zap, Bell, QrCode, Users, GraduationCap,
  UserCheck, BarChart3, Shield, Smartphone, Star, TrendingUp, Lock,
  ChevronRight, Sparkles, Play, ArrowDown,
  AlertTriangle, XCircle, Clock, FileText, Globe,
  Quote, ChevronLeft, School,
  CalendarDays, Wallet, CreditCard, MessageSquare, BookOpen, Receipt,
} from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PlanCardsGrid } from "@/components/PlanCardsGrid";
import { useWaCreditEnabled } from "@/hooks/useWaCreditEnabled";
import { transformPlanFeatures } from "@/lib/planFeatures";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const DEFAULT_FEATURES = [
  { icon: QrCode, title: "Scan QR & Face AI", desc: "Absensi instan via QR Code atau Face Recognition AI. Tanpa kartu, tanpa sentuhan, kurang dari 1 detik.", color: "from-blue-500 to-indigo-600" },
  { icon: Monitor, title: "Dashboard Real-Time", desc: "Pantau kehadiran, jadwal mengajar, dan keuangan SPP secara live dengan grafik interaktif.", color: "from-emerald-500 to-teal-600" },
  { icon: CalendarDays, title: "Jadwal Mengajar Live", desc: "Atur jadwal mengajar per guru & kelas. Live schedule menampilkan kelas berlangsung & berikutnya.", color: "from-violet-500 to-purple-600" },
  { icon: Receipt, title: "Tagihan SPP Otomatis", desc: "Generate tagihan SPP per kelas atau seluruh sekolah sekali klik, kirim WA otomatis ke wali murid.", color: "from-amber-500 to-orange-600" },
  { icon: CreditCard, title: "Pembayaran Online", desc: "Wali murid bayar SPP via QRIS atau Transfer Bank. Status update otomatis tanpa konfirmasi manual.", color: "from-rose-500 to-pink-600" },
  { icon: Bell, title: "Notifikasi WhatsApp", desc: "Absensi, jadwal, pengumuman, dan tagihan SPP dikirim otomatis ke WhatsApp wali murid.", color: "from-green-500 to-emerald-600" },
  { icon: Users, title: "Portal Wali Murid", desc: "Dashboard khusus orang tua untuk pantau absensi, jadwal anak, pengumuman, dan riwayat SPP.", color: "from-cyan-500 to-blue-600" },
  { icon: FileBarChart, title: "Laporan Terintegrasi", desc: "Rekap absensi, keuangan SPP, dan jadwal dalam satu sistem. Export Excel & PDF kapan saja.", color: "from-indigo-500 to-violet-600" },
  { icon: GraduationCap, title: "Multi-Role & Multi Sekolah", desc: "4 peran (Admin, Bendahara, Wali Kelas, Wali Murid) dan arsitektur multi-tenant untuk banyak sekolah.", color: "from-fuchsia-500 to-purple-600" },
];

const DEFAULT_HERO_STATS = [
  { value: "500+", label: "Sekolah Aktif", icon: School, iconColor: "text-emerald-300", ringColor: "ring-emerald-400/30", bgGlow: "from-emerald-400/20 to-emerald-600/5" },
  { value: "120K+", label: "Siswa Terdaftar", icon: Users, iconColor: "text-amber-300", ringColor: "ring-amber-400/30", bgGlow: "from-amber-400/20 to-amber-600/5" },
  { value: "99.9%", label: "Data Akurat", icon: Shield, iconColor: "text-cyan-300", ringColor: "ring-cyan-400/30", bgGlow: "from-cyan-400/20 to-cyan-600/5" },
  { value: "34", label: "Provinsi", icon: MapPin, iconColor: "text-rose-300", ringColor: "ring-rose-400/30", bgGlow: "from-rose-400/20 to-rose-600/5" },
];

const WHY_ITEMS = [
  { icon: Lock, title: "Keamanan Tingkat Tinggi", desc: "Data terenkripsi end-to-end dengan standar keamanan enterprise." },
  { icon: Smartphone, title: "Akses dari Mana Saja", desc: "Web-based, responsive di semua perangkat tanpa install aplikasi." },
  { icon: TrendingUp, title: "Skalabel Tanpa Batas", desc: "Dari 30 siswa hingga ribuan. Infrastruktur yang tumbuh bersama Anda." },
  { icon: Star, title: "Setup 5 Menit", desc: "Import data, aktifkan scan, langsung pakai. Tanpa training rumit." },
];

const WORKFLOW = [
  { step: "01", title: "Daftar & Setup Sekolah", desc: "Buat akun, import data siswa, guru, kelas, serta atur jadwal mengajar dan tagihan SPP." },
  { step: "02", title: "Aktivitas Harian", desc: "Siswa absen via QR/Face Recognition, guru mengajar sesuai jadwal live, bendahara generate tagihan." },
  { step: "03", title: "Wali Murid Terhubung", desc: "Orang tua menerima notifikasi WhatsApp untuk absensi, jadwal, pengumuman, dan tagihan SPP." },
  { step: "04", title: "Laporan & Pembayaran", desc: "Rekap absensi, monitoring live, pembayaran SPP online (QRIS/Transfer), dan export Excel/PDF." },
];

const DEFAULT_TRUSTED_SCHOOLS = [
  { name: "SD Negeri 1 Jakarta", initials: "SDN1", logo_url: null },
  { name: "SMP Islam Al-Azhar", initials: "SIA", logo_url: null },
  { name: "TK Bunda Mulia", initials: "TBM", logo_url: null },
  { name: "SD IT Nurul Fikri", initials: "SINF", logo_url: null },
  { name: "SMP Negeri 5 Bandung", initials: "SMP5", logo_url: null },
  { name: "TK Aisyiyah Bustanul", initials: "TAB", logo_url: null },
  { name: "SD Muhammadiyah 9", initials: "SDM9", logo_url: null },
  { name: "SMP Labschool", initials: "LAB", logo_url: null },
];

const DEFAULT_TESTIMONIALS = [
  { name: "Ibu Sari Dewi", role: "Kepala Sekolah, SD Negeri 1 Jakarta", text: "Sejak menggunakan ATSkolla, proses absensi jadi lebih cepat dan akurat. Guru-guru sangat terbantu karena tidak perlu lagi mencatat manual. Orang tua juga senang karena langsung dapat notifikasi WhatsApp.", rating: 5 },
  { name: "Pak Ahmad Fauzi", role: "Wakil Kepala Sekolah, SMP Islam Al-Azhar", text: "Sistem yang luar biasa! Dashboard real-time memudahkan kami memantau kehadiran siswa. Rekap otomatis setiap bulan menghemat waktu administrasi hingga 80%. Sangat direkomendasikan!", rating: 5 },
  { name: "Ibu Rina Kartika", role: "Guru Kelas, TK Bunda Mulia", text: "Fitur scan barcode sangat memudahkan. Anak-anak TK yang belum bisa absen sendiri bisa dibantu dengan cepat. Notifikasi ke orang tua juga membuat mereka lebih tenang.", rating: 5 },
  { name: "Pak Hendra Wijaya", role: "Kepala Sekolah, SD IT Nurul Fikri", text: "Kami sudah mencoba berbagai sistem absensi, tapi ATSkolla yang paling cocok untuk kebutuhan sekolah kami. Setup mudah, harga terjangkau, dan support responsif.", rating: 5 },
  { name: "Ibu Linda Kusuma", role: "Wali Murid, SMP Negeri 5 Bandung", text: "Sebagai orang tua, saya sangat apresiasi notifikasi WhatsApp otomatis. Saya bisa tahu kapan anak saya tiba di sekolah tanpa harus menelepon guru setiap hari.", rating: 5 },
];

const PROBLEMS = [
  { icon: AlertTriangle, title: "Absensi Manual", desc: "Pencatatan kehadiran masih pakai buku tulis, rawan kesalahan dan manipulasi data." },
  { icon: Clock, title: "Proses Lambat", desc: "Guru memanggil siswa satu per satu untuk absensi, memakan waktu jam belajar." },
  { icon: CalendarDays, title: "Jadwal Mengajar Berantakan", desc: "Jadwal mengajar guru masih dikelola lewat kertas atau grup WA, sering bentrok dan terlewat." },
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

interface PlanRow {
  id: string;
  name: string;
  price: number;
  description: string | null;
  features: any;
  max_students: number | null;
  sort_order: number;
}

interface TrustedSchool { name: string; initials: string; logo_url: string | null; }
interface Testimonial { name: string; role: string; text: string; rating: number; }

const TestimonialSlider = ({ testimonials }: { testimonials: Testimonial[] }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const t = testimonials[current];

  if (!t) return null;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <section className="py-16 sm:py-24 bg-indigo-50/40 dark:bg-indigo-950/10 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Testimoni</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Apa Kata Mereka?
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">Cerita nyata dari pengguna ATSkolla di seluruh Indonesia.</p>
        </motion.div>

        <div className="relative">
          <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-6 z-20 h-10 w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-white" />
          </button>
          <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-6 z-20 h-10 w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ChevronRight className="h-5 w-5 text-slate-700 dark:text-white" />
          </button>

          <div className="overflow-hidden min-h-[260px] flex items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="w-full"
              >
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-8 sm:p-10 text-center relative">
                  <Quote className="h-8 w-8 text-indigo-500/15 absolute top-6 left-6" />
                  <div className="flex justify-center gap-1 mb-5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed italic max-w-2xl mx-auto">
                    "{t.text}"
                  </p>
                  <div className="mt-6">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-6 bg-indigo-500" : "w-2 bg-slate-300 dark:bg-slate-600 hover:bg-indigo-300"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { enabled: waCreditEnabled } = useWaCreditEnabled();
  const [content, setContent] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [landingTheme, setLandingTheme] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [trustedSchools, setTrustedSchools] = useState<TrustedSchool[]>(DEFAULT_TRUSTED_SCHOOLS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [headerLogo, setHeaderLogo] = useState("/images/logo-atskolla.png");
  const [heroStats, setHeroStats] = useState(DEFAULT_HERO_STATS);
  const [showShadowShapes, setShowShadowShapes] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("landing_content").select("key, value"),
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("landing_trusted_schools").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("landing_testimonials").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("platform_settings").select("key, value").in("key", ["header_logo_url", "hero_shadow_shapes_enabled", "landing_theme"]),
    ]).then(([contentRes, plansRes, schoolsRes, testimonialsRes, settingsRes]) => {
      const map: Record<string, string> = {};
      (contentRes.data || []).forEach((item: any) => { map[item.key] = item.value; });
      setContent(map);
      if (settingsRes.data) {
        const sMap = Object.fromEntries(settingsRes.data.map((d: any) => [d.key, d.value]));
        if (sMap.header_logo_url) setHeaderLogo(sMap.header_logo_url);
        if (sMap.hero_shadow_shapes_enabled === "false") setShowShadowShapes(false);
        if (sMap.landing_theme) setLandingTheme(sMap.landing_theme);
      }
      // Build hero stats from content if available
      const ICON_MAP: Record<string, any> = { School, Users, Shield, Globe, GraduationCap, MapPin };
      const ICON_COLOR_MAP: Record<string, string> = { School: "text-emerald-300", GraduationCap: "text-amber-300", Shield: "text-cyan-300", Globe: "text-rose-300", Users: "text-amber-300", MapPin: "text-rose-300" };
      const RING_COLOR_MAP: Record<string, string> = { School: "ring-emerald-400/30", Users: "ring-amber-400/30", Shield: "ring-cyan-400/30", MapPin: "ring-rose-400/30", GraduationCap: "ring-amber-400/30", Globe: "ring-rose-400/30" };
      const GLOW_MAP: Record<string, string> = { School: "from-emerald-400/20 to-emerald-600/5", Users: "from-amber-400/20 to-amber-600/5", Shield: "from-cyan-400/20 to-cyan-600/5", MapPin: "from-rose-400/20 to-rose-600/5", GraduationCap: "from-amber-400/20 to-amber-600/5", Globe: "from-rose-400/20 to-rose-600/5" };
      const statsKeys = ["hero_stat_1", "hero_stat_2", "hero_stat_3", "hero_stat_4"];
      const loadedStats = statsKeys.map((k, i) => {
        const val = map[`${k}_value`];
        const label = map[`${k}_label`];
        const iconName = map[`${k}_icon`] || DEFAULT_HERO_STATS[i]?.icon?.name || "Shield";
        return {
          value: val || DEFAULT_HERO_STATS[i]?.value || "",
          label: label || DEFAULT_HERO_STATS[i]?.label || "",
          icon: ICON_MAP[iconName] || DEFAULT_HERO_STATS[i]?.icon || Shield,
          iconColor: ICON_COLOR_MAP[iconName] || DEFAULT_HERO_STATS[i]?.iconColor || "text-white/70",
          ringColor: RING_COLOR_MAP[iconName] || DEFAULT_HERO_STATS[i]?.ringColor || "ring-white/10",
          bgGlow: GLOW_MAP[iconName] || DEFAULT_HERO_STATS[i]?.bgGlow || "from-white/10 to-transparent",
        };
      }).filter(s => s.value && s.label);
      if (loadedStats.length > 0) setHeroStats(loadedStats);

      const allPlans = (plansRes.data || []) as any[];
      const landingPlans = allPlans.filter((p: any) => p.show_on_landing !== false);
      setPlans(landingPlans as PlanRow[]);
      setShowPricing(false);
      if (schoolsRes.data && schoolsRes.data.length > 0) {
        setTrustedSchools(schoolsRes.data as TrustedSchool[]);
      }
      if (testimonialsRes.data && testimonialsRes.data.length > 0) {
        setTestimonials(testimonialsRes.data as Testimonial[]);
      }
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

  // Theme B (Modern SaaS)
  if (landingTheme === "modern") {
    return <LandingThemeB />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      {/* ─── Floating Navbar ─── */}
      <nav className="fixed top-3 left-3 right-3 z-50 transition-all duration-300 rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200/80 dark:border-slate-700/50">
        <div className="px-4 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={headerLogo} alt="ATSkolla" className="h-8 sm:h-9 object-contain" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button onClick={() => navigate("/admin")} className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              Masuk
            </button>
            <button onClick={() => navigate("/register")} className="inline-flex items-center gap-1.5 bg-[#5B6CF9] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]">
              Mulai Gratis <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section (1 screen) ─── */}
      <section className="relative h-screen flex flex-col overflow-hidden bg-[#5B6CF9]">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        {/* Floating scan animation elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
          {[
            { top: '12%', left: '4%', delay: 0 },
            { top: '22%', left: '92%', delay: 1 },
            { top: '65%', left: '6%', delay: 0.5 },
            { top: '75%', left: '88%', delay: 1.5 },
            { top: '45%', left: '2%', delay: 2 },
            { top: '50%', left: '96%', delay: 0.8 },
          ].map((dot, i) => (
            <motion.div
              key={`hero-dot-${i}`}
              className="absolute w-2 h-2 rounded-full bg-white"
              style={{ top: dot.top, left: dot.left }}
              animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: dot.delay }}
            />
          ))}

          {/* Scan line */}
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />

          {/* Barcode visualization - left */}
          <div className="hidden lg:flex absolute left-[6%] top-1/2 -translate-y-1/2 flex-col items-center gap-1 opacity-15">
            {Array.from({ length: 20 }, (_, i) => (
              <motion.div
                key={`bar-l-${i}`}
                className="bg-white rounded-full"
                style={{ width: Math.random() * 35 + 15, height: 2 }}
                animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.08 }}
              />
            ))}
          </div>

          {/* Barcode visualization - right */}
          <div className="hidden lg:flex absolute right-[6%] top-1/2 -translate-y-1/2 flex-col items-center gap-1 opacity-15">
            {Array.from({ length: 20 }, (_, i) => (
              <motion.div
                key={`bar-r-${i}`}
                className="bg-white rounded-full"
                style={{ width: Math.random() * 35 + 15, height: 2 }}
                animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.08 + 0.5 }}
              />
            ))}
          </div>

          {/* QR outline - left */}
          <motion.div
            className="hidden lg:block absolute left-[12%] top-[18%] w-24 h-24 border-2 border-white/10 rounded-2xl"
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.03, 1] }}
            transition={{ duration: 6, repeat: Infinity }}
          />

          {/* QR outline - right */}
          <motion.div
            className="hidden lg:block absolute right-[12%] bottom-[25%] w-20 h-20 border-2 border-white/10 rounded-xl"
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 7, repeat: Infinity, delay: 1 }}
          />
        </div>

        {/* Text content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 pb-4 flex-shrink-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-xs font-bold text-white/90 mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Platform Digital Sekolah #1
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }}
            className="text-center text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15] max-w-3xl">
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

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-3 text-xs sm:text-sm text-white/60 max-w-lg mx-auto leading-relaxed text-center">
            {get("hero_subtitle", "Platform absensi modern dengan barcode scan & face recognition AI. Dirancang khusus untuk sekolah Indonesia.")}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate("/register")}
              className="inline-flex items-center justify-center gap-2 bg-white text-[#5B6CF9] px-6 py-2.5 rounded-2xl font-bold transition-all shadow-xl shadow-black/10 hover:shadow-black/20 hover:scale-[1.02] active:scale-[0.98] text-sm">
              <Zap className="h-4 w-4" /> {get("cta_text", "Coba Gratis Sekarang")}
            </button>
            <a href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-2xl font-semibold transition-all text-sm border border-white/15">
              <Play className="h-4 w-4" /> Cara Kerja
            </a>
          </motion.div>
        </div>

        {/* Hero image - fills remaining space, no border */}
        <div className="relative z-10 flex-1 min-h-0 px-4 sm:px-6 lg:px-8 pb-0">
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
            className="max-w-4xl mx-auto h-full">
            <motion.img
              src={get("hero_image") || heroDashboard}
              alt="Dashboard ATSkolla"
              className="w-full h-full object-cover object-top rounded-t-2xl shadow-2xl shadow-black/20"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.4 }}
            />
          </motion.div>
        </div>

        {/* Rounded bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-14 bg-white dark:bg-slate-950 rounded-t-[2rem] sm:rounded-t-[3rem] z-[5]" />
      </section>

      {/* ─── Hero Stats Banner ─── */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/8 rounded-full blur-[120px]" />
        </div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {heroStats.map((stat, i) => {
              const extraProps = stat as any;
              const progressValues: Record<string, number> = {
                "Sekolah Aktif": 78,
                "Siswa Terdaftar": 92,
                "Data Akurat": 99,
                "Provinsi": 65,
              };
              const progressColors: Record<string, string> = {
                "Sekolah Aktif": "from-emerald-400 to-emerald-500",
                "Siswa Terdaftar": "from-amber-400 to-amber-500",
                "Data Akurat": "from-cyan-400 to-cyan-500",
                "Provinsi": "from-rose-400 to-rose-500",
              };
              const progressBg: Record<string, string> = {
                "Sekolah Aktif": "bg-emerald-500/20",
                "Siswa Terdaftar": "bg-amber-500/20",
                "Data Akurat": "bg-cyan-500/20",
                "Provinsi": "bg-rose-500/20",
              };
              const pct = progressValues[stat.label] || 70;
              const pColor = progressColors[stat.label] || "from-indigo-400 to-indigo-500";
              const pBg = progressBg[stat.label] || "bg-indigo-500/20";

              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 40, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: "easeOut" }}
                  className="group"
                >
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-5 sm:p-7 transition-all duration-500 hover:-translate-y-2 hover:border-white/[0.16] hover:shadow-[0_24px_80px_-12px_rgba(99,102,241,0.25)]">
                    <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${extraProps.bgGlow || "from-white/10 to-transparent"} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03] flex items-center justify-center ring-1 ${extraProps.ringColor || "ring-white/10"} group-hover:scale-110 transition-all duration-500 shadow-lg shadow-black/20`}>
                          <stat.icon className={`h-5 w-5 sm:h-5.5 sm:w-5.5 ${extraProps.iconColor || "text-white/70"}`} strokeWidth={1.5} />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs text-slate-400/80 font-medium truncate">{stat.label}</p>
                          <p className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{stat.value}</p>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className={`w-full h-2 rounded-full ${pBg} overflow-hidden`}>
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 1.2, ease: "easeOut" }}
                          className={`h-full rounded-full bg-gradient-to-r ${pColor}`}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400/60 font-medium text-right">{pct}% target tercapai</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Problems ─── */}
      <section className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/3 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-500 mb-3 block">Latar Belakang</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Tantangan Administrasi Sekolah Saat Ini
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Absensi manual, jadwal mengajar berantakan, tagihan SPP di Excel, dan komunikasi wali murid yang lambat — sekolah Indonesia menghadapi banyak inefisiensi.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {PROBLEMS.map((p, i) => (
              <motion.div key={p.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative bg-white dark:bg-slate-800/60 border border-red-100 dark:border-red-500/10 rounded-2xl p-6 cursor-default overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-red-500/10">
                {/* Animated corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-bl-[3rem] group-hover:w-28 group-hover:h-28 group-hover:bg-red-500/10 transition-all duration-500" />
                {/* Number badge */}
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

          {/* Arrow */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="flex flex-col items-center mb-16">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-14 w-14 rounded-full bg-[#5B6CF9] flex items-center justify-center shadow-xl shadow-indigo-500/25">
              <ArrowDown className="h-6 w-6 text-white" />
            </motion.div>
            <p className="mt-3 font-bold text-[#5B6CF9] text-sm">Solusi Kami</p>
          </motion.div>

          {/* Solutions */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B6CF9] mb-3 block">Jawaban Tepat</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ATSkolla — Platform Digital Sekolah Terintegrasi
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Setiap permasalahan memiliki solusi teknologi modern yang terintegrasi dalam satu platform.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-5">
            {SOLUTIONS.map((s, i) => (
              <motion.div key={s.solution} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                whileHover={{ y: -6, scale: 1.01 }}
                className="group relative bg-white dark:bg-slate-800/60 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl p-6 cursor-default overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
                {/* Animated bg stripe */}
                <div className="absolute inset-y-0 left-0 w-1 bg-[#5B6CF9]/0 group-hover:bg-[#5B6CF9] transition-all duration-300 rounded-l-2xl" />
                <div className="flex items-center gap-1.5 mb-3 flex-nowrap whitespace-nowrap">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 line-through opacity-70 whitespace-nowrap shrink-0">{s.problem}</span>
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="shrink-0">
                    <ArrowRight className="h-3.5 w-3.5 text-[#5B6CF9]" />
                  </motion.span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[#5B6CF9] whitespace-nowrap shrink-0">{s.solution}</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#5B6CF9] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <s.icon className="h-5.5 w-5.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{s.solution}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-20 sm:py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 dark:from-slate-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Cara Kerja</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Mulai dalam 4 Langkah Mudah
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Dari setup sekolah, absensi & jadwal mengajar, hingga pembayaran SPP online — semua dalam satu platform.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW.map((w, i) => (
              <motion.div key={w.step} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="relative group">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 h-full hover:border-indigo-200 dark:hover:border-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300">
                  <span className="text-4xl font-black text-indigo-500/15 group-hover:text-indigo-500/25 transition-colors">{w.step}</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2 mb-2">{w.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{w.desc}</p>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                    <ChevronRight className="h-5 w-5 text-indigo-500/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Fitur Unggulan</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Semua yang Sekolah Anda Butuhkan
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">Platform lengkap untuk absensi, jadwal mengajar, pembayaran SPP, dan komunikasi wali murid.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(() => {
              const ICON_FEAT_MAP: Record<string, any> = { scan: QrCode, monitor: Monitor, message: Bell, chart: FileBarChart, face: UserCheck, school: GraduationCap };
              const COLORS = ["from-blue-500 to-indigo-600", "from-violet-500 to-purple-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-pink-500 to-rose-600", "from-cyan-500 to-blue-600"];
              const features = Array.from({ length: 9 }, (_, i) => {
                const n = i + 1;
                const title = get(`feature_${n}_title`) || DEFAULT_FEATURES[i]?.title || "";
                const desc = get(`feature_${n}_desc`) || DEFAULT_FEATURES[i]?.desc || "";
                const iconKey = get(`feature_${n}_icon`) || "";
                const icon = ICON_FEAT_MAP[iconKey] || DEFAULT_FEATURES[i]?.icon || QrCode;
                const color = DEFAULT_FEATURES[i]?.color || COLORS[i % COLORS.length];
                return { title, desc, icon, color };
              }).filter(f => f.title);
              return features.map((f, i) => (
                <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="group bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-6 sm:p-7 hover:border-indigo-200 dark:hover:border-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1">
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* ─── Why Choose Us ─── */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/3 rounded-full blur-[150px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">{get("why_label", "Kenapa Kami")}</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                {get("why_title") || <>Solusi Digital Sekolah yang <span className="text-indigo-600 dark:text-indigo-400">Terpercaya</span></>}
              </h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400 leading-relaxed">
                {get("why_desc", "Kami menyediakan platform digital terintegrasi: absensi, jadwal mengajar, pembayaran SPP online, dan komunikasi wali murid dalam satu sistem.")}
              </p>
              {get("why_image") && (
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                  className="mt-6 rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                  <img src={get("why_image")} alt="Platform Terpercaya" className="w-full h-auto object-cover" />
                </motion.div>
              )}
              <button onClick={() => navigate("/register")}
                className="mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-[1.02]">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const whyItems = Array.from({ length: 4 }, (_, i) => {
                  const n = i + 1;
                  return {
                    title: get(`why_item_${n}_title`) || WHY_ITEMS[i]?.title || "",
                    desc: get(`why_item_${n}_desc`) || WHY_ITEMS[i]?.desc || "",
                    icon: WHY_ITEMS[i]?.icon || Lock,
                  };
                }).filter(w => w.title);
                return whyItems.map((item, i) => (
                <motion.div key={item.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 hover:border-indigo-200 dark:hover:border-indigo-500/20 hover:shadow-lg transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3">
                    <item.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
                ));
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      {showPricing && (
      <section className="py-20 sm:py-28 bg-slate-50/80 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Harga</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pilih Paket Terbaik</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Harga transparan, tanpa biaya tersembunyi. Mulai gratis, upgrade kapan saja.</p>
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
      {/* ─── Trusted By Schools ─── */}
      <section className="py-16 sm:py-20 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Kepercayaan</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {get("trusted_title", "Dipercaya Sekolah di Seluruh Indonesia")}
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">{get("trusted_subtitle", "Bergabung bersama sekolah-sekolah yang telah merasakan manfaat platform digital terintegrasi.")}</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
            {trustedSchools.map((school, i) => (
              <motion.div key={school.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="group flex flex-col items-center gap-2.5">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center overflow-hidden transition-all duration-500">
                  {school.logo_url ? (
                    <img src={school.logo_url} alt={school.name} className="h-full w-full object-contain p-1 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                  ) : (
                    <span className="text-lg sm:text-xl font-extrabold text-slate-400 grayscale group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-500">{school.initials}</span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 text-center max-w-[100px] leading-tight group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors duration-300">{school.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <TestimonialSlider testimonials={testimonials} />

      {/* ─── Payment Methods ─── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-3 block">Pembayaran</span>
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
            className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
            {showShadowShapes && <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />}
            {showShadowShapes && <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />}

            <div className="relative z-10">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-4">
                {get("cta_banner_text", "Siap Digitalisasi Sekolah Anda?")}
              </h2>
              <p className="text-white/80 text-sm sm:text-base mb-8 max-w-lg mx-auto">
                {get("cta_banner_desc", "Kelola absensi, jadwal mengajar, SPP, komunikasi wali murid, hingga laporan dalam satu platform terpadu. Tanpa biaya setup.")}
              </p>
              <button onClick={() => navigate("/register")}
                className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all hover:bg-white/90 shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                <Zap className="h-4 w-4" /> Daftar Gratis Sekarang
              </button>
              <p className="text-white/50 text-xs mt-4">Tidak perlu kartu kredit • Setup instan</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative bg-slate-900 dark:bg-slate-950 text-white overflow-hidden">
        {/* Top gradient line */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-500" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand Column */}
            <div className="lg:col-span-1 space-y-5">
              <div className="flex items-center gap-3">
                {get("footer_logo") ? (
                  <img src={get("footer_logo")} alt="Logo" className="h-11 w-11 rounded-xl object-cover shadow-lg" />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-white text-base">{get("footer_brand_name", "ATSkolla")}</p>
                  <p className="text-xs text-slate-400">{get("footer_brand_tagline", "Platform Digital Sekolah")}</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {get("footer_description", "Platform digital #1 untuk sekolah modern. Absensi, jadwal mengajar, SPP online, dan monitoring wali murid — semua terintegrasi dalam satu sistem.")}
              </p>
            </div>

            {/* Product Links */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-white uppercase tracking-wider">Produk</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-indigo-400 transition-colors">Fitur Unggulan</button></li>
                <li><button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-indigo-400 transition-colors">Cara Kerja</button></li>
                {showPricing && <li><button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-indigo-400 transition-colors">Harga & Paket</button></li>}
                <li><button onClick={() => navigate("/register")} className="hover:text-indigo-400 transition-colors">Daftar Gratis</button></li>
              </ul>
            </div>

            {/* Resource Links */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-white uppercase tracking-wider">Dukungan</p>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><button onClick={() => navigate("/admin")} className="hover:text-indigo-400 transition-colors">Login</button></li>
                <li><button onClick={() => navigate("/panduan")} className="hover:text-indigo-400 transition-colors">Panduan Penggunaan</button></li>
                {get("footer_link_faq") && <li><a href={get("footer_link_faq")} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">FAQ</a></li>}
                {get("footer_link_docs") && <li><a href={get("footer_link_docs")} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Dokumentasi</a></li>}
                {get("footer_link_privacy") && <li><a href={get("footer_link_privacy")} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Kebijakan Privasi</a></li>}
                {get("footer_link_terms") && <li><a href={get("footer_link_terms")} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Syarat & Ketentuan</a></li>}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-white uppercase tracking-wider">Hubungi Kami</p>
              <div className="flex flex-col gap-3 text-sm text-slate-400">
                {get("footer_address") && (
                  <span className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-indigo-400 shrink-0" /> {get("footer_address")}</span>
                )}
                {get("footer_email") && (
                  <a href={`mailto:${get("footer_email")}`} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><Mail className="h-4 w-4 text-indigo-400 shrink-0" /> {get("footer_email")}</a>
                )}
                {get("footer_phone") && (
                  <a href={`tel:${get("footer_phone")}`} className="flex items-center gap-2 hover:text-indigo-400 transition-colors"><Phone className="h-4 w-4 text-indigo-400 shrink-0" /> {get("footer_phone")}</a>
                )}
              </div>
              {get("footer_social_text") && (
                <p className="text-xs text-slate-500 pt-2">{get("footer_social_text")}</p>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} {get("footer_brand_name", "ATSkolla")} — {get("footer_brand_tagline", "Platform Digital Sekolah")}. All rights reserved.</p>
            <p className="text-[10px] text-slate-600">Dipercaya sekolah-sekolah di seluruh Indonesia</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
