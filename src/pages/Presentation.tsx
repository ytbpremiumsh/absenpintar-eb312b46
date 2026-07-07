import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, QrCode, Monitor, Users, GraduationCap, BarChart3, Clock, Bell, Globe, FileText, Settings, ChevronRight, CheckCircle2, Zap, Smartphone, Sparkles, Sun, Moon, ArrowDown, Star, TrendingUp, UserCheck, ScanLine, BookOpen, AlertTriangle, XCircle, ArrowRight, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import TypingEffect from "@/components/TypingEffect";
import atskollaLogo from "@/assets/atskolla-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

const PROBLEMS = [
  { icon: AlertTriangle, title: "Absensi Manual", desc: "Pencatatan kehadiran masih pakai buku tulis, rawan kesalahan dan manipulasi data." },
  { icon: Clock, title: "Proses Lambat", desc: "Guru harus memanggil siswa satu per satu untuk absensi, memakan waktu belajar." },
  { icon: XCircle, title: "Tidak Ada Rekap Digital", desc: "Sekolah kesulitan membuat laporan kehadiran bulanan karena data tidak terdigitalisasi." },
  { icon: Users, title: "Orang Tua Tidak Tahu", desc: "Wali murid tidak mendapat informasi real-time tentang kehadiran anaknya di sekolah." },
  { icon: FileText, title: "Laporan Tidak Akurat", desc: "Data absensi manual sulit diaudit dan sering terjadi ketidakcocokan." },
  { icon: Globe, title: "Tidak Transparan", desc: "Tidak ada monitoring kehadiran yang bisa diakses orang tua secara online." },
];

const SOLUTIONS = [
  { icon: QrCode, problem: "Absensi Manual", solution: "Scan Barcode Instan", desc: "Siswa cukup scan barcode untuk mencatat kehadiran. Proses kurang dari 1 detik." },
  { icon: UserCheck, problem: "Proses Lambat", solution: "Face Recognition AI", desc: "AI mengenali wajah siswa dan mencatat absensi secara otomatis tanpa sentuhan." },
  { icon: BarChart3, problem: "Tidak Ada Rekap", solution: "Rekap Otomatis", desc: "Rekap harian, mingguan, dan bulanan dibuat otomatis dengan statistik lengkap." },
  { icon: Monitor, problem: "Tidak Transparan", solution: "Dashboard Real-Time", desc: "Dashboard menampilkan statistik kehadiran secara live — hadir, izin, sakit, alfa." },
  { icon: Bell, problem: "Orang Tua Tidak Tahu", solution: "Notifikasi WhatsApp", desc: "Wali murid otomatis menerima notifikasi WhatsApp saat anak tercatat hadir." },
  { icon: FileText, problem: "Laporan Tidak Akurat", solution: "Export Excel & PDF", desc: "Laporan kehadiran lengkap bisa di-export dalam format Excel atau PDF kapan saja." },
];

const SCHOOL_FEATURES = [
  {
    title: "Dashboard Analitik",
    subtitle: "Pusat Kendali Sekolah Anda",
    desc: "Dashboard real-time yang menampilkan statistik kehadiran lengkap: total siswa, hadir, izin, sakit, alfa, dan belum absen. Dilengkapi grafik statistik harian/mingguan/bulanan serta donut chart status kehadiran interaktif.",
    points: [
      "Statistik harian real-time dengan 6 kartu indikator berwarna",
      "Grafik aktivitas kehadiran per jam dengan filter harian, mingguan, bulanan",
      "Donut chart interaktif — klik untuk melihat daftar siswa per status",
      "Feed absensi terbaru lengkap dengan nama, kelas, metode scan, dan waktu",
    ],
    image: "/images/presentation/ss-dashboard.webp",
    icon: BarChart3,
    accent: "from-blue-500 to-indigo-600",
    badge: "Core Feature",
  },
  {
    title: "Live Monitoring Absensi",
    subtitle: "Pantau Kehadiran Secara Real-Time",
    desc: "Sistem monitoring canggih dengan scanner built-in yang mendukung QR Code, Face Recognition, dan NIS Manual. Progress bar kehadiran seluruh sekolah terlihat dalam satu layar dengan live feed aktivitas terbaru.",
    points: [
      "Scanner multi-mode: QR Code, Face Recognition, dan NIS Manual dalam satu halaman",
      "Progress bar kehadiran real-time dengan persentase visual",
      "Live feed — setiap scan langsung muncul di panel aktivitas",
      "Mode Datang & Pulang otomatis sesuai jam operasional sekolah",
    ],
    image: "/images/presentation/ss-monitoring.webp",
    icon: Monitor,
    accent: "from-emerald-500 to-teal-600",
    badge: "Real-Time",
  },
  {
    title: "Scan Absensi Multi-Metode",
    subtitle: "QR Code + Face Recognition + NIS Manual",
    desc: "Halaman scan absensi yang mendukung 3 metode sekaligus: scan QR Code via kamera, pengenalan wajah (Face Recognition), dan input NIS manual. Dirancang untuk kecepatan dan kemudahan penggunaan di lapangan.",
    points: [
      "Scan QR Code — kamera aktif untuk scan barcode secara instan",
      "Face Recognition — cukup arahkan wajah siswa ke kamera",
      "NIS Manual — input NIS sebagai alternatif jika kartu tidak tersedia",
      "Indikator waktu & tanggal absensi di bagian atas halaman",
    ],
    image: "/images/presentation/ss-scan.webp",
    icon: ScanLine,
    accent: "from-violet-500 to-purple-600",
    badge: "Smart Scan",
  },
  {
    title: "Manajemen Kelas",
    subtitle: "Kelas Terorganisir dengan Statistik Lengkap",
    desc: "Kelola seluruh kelas dengan tampilan card visual yang menampilkan jumlah siswa, progress absensi harian, dan statistik kehadiran per kelas. Tambah, edit, atau hapus kelas dengan mudah.",
    points: [
      "Card visual per kelas: nama, jumlah siswa, progress absensi harian",
      "Badge status berwarna: hadir (hijau), izin (oranye), sakit (biru), alfa (merah)",
      "Statistik header: total kelas, total siswa, hadir hari ini, belum absen",
      "Integrasi WhatsApp Group per kelas untuk komunikasi cepat",
    ],
    image: "/images/presentation/ss-classes.webp",
    icon: GraduationCap,
    accent: "from-indigo-600 to-blue-600",
    badge: "Organized",
  },
  {
    title: "Database Siswa Lengkap",
    subtitle: "Data Siswa dalam Genggaman",
    desc: "Sistem manajemen data siswa komprehensif dengan tampilan accordion per kelas. Mendukung import/export Excel, pencetakan QR Code massal, dan fitur naik kelas otomatis.",
    points: [
      "Tampilan accordion per kelas — data terorganisir dan mudah dinavigasi",
      "Informasi lengkap: nama, NIS, wali murid, nomor HP, foto",
      "Import dari Excel & Export data untuk dokumentasi",
      "Cetak kartu QR Code individual atau massal, fitur Naik Kelas otomatis",
    ],
    image: "/images/presentation/ss-students.webp",
    icon: Users,
    accent: "from-cyan-500 to-blue-600",
    badge: "Complete",
  },
  {
    title: "QR Code Siswa",
    subtitle: "Identitas Digital Setiap Siswa",
    desc: "Setiap siswa memiliki QR Code unik yang dapat di-download dan dicetak sebagai kartu identitas. QR Code ini digunakan untuk proses scan absensi yang cepat dan aman.",
    points: [
      "QR Code unik per siswa — desain branded dengan warna sekolah",
      "Download dalam format gambar berkualitas tinggi",
      "Informasi siswa tertera: nama, kelas, dan NIS",
      "Bisa dicetak sebagai ID Card atau ditempelkan di kartu pelajar",
    ],
    image: "/images/presentation/ss-qrcode.webp",
    icon: QrCode,
    accent: "from-indigo-500 to-violet-600",
    badge: "ID Card",
  },
  {
    title: "Detail Profil Siswa",
    subtitle: "Riwayat Kehadiran Individual",
    desc: "Halaman profil siswa yang menampilkan identitas lengkap, data wali/orang tua, barcode siswa, serta riwayat kehadiran yang dapat di-filter dan di-download dalam format absensi nasional.",
    points: [
      "Profil visual dengan avatar, nama, kelas, NIS, dan status kehadiran hari ini",
      "Statistik kehadiran per siswa: hadir, izin, sakit, alfa",
      "Data wali murid: nama, nomor HP — terintegrasi WhatsApp",
      "Riwayat kehadiran lengkap dengan rekap bulanan & download PDF/Excel",
    ],
    image: "/images/presentation/ss-detail.webp",
    icon: UserCheck,
    accent: "from-pink-500 to-rose-600",
    badge: "Profile",
  },
  {
    title: "Data Wali Murid",
    subtitle: "Koneksi Langsung dengan Orang Tua",
    desc: "Halaman khusus menampilkan seluruh wali murid dengan card visual, nomor telepon, dan daftar anak terdaftar. Memudahkan komunikasi dan verifikasi identitas.",
    points: [
      "Card visual per wali: nama, nomor HP, dan daftar anak",
      "Relasi wali-siswa yang jelas — satu wali bisa punya beberapa anak",
      "Pencarian cepat berdasarkan nama wali, siswa, atau kelas",
      "Terintegrasi dengan sistem notifikasi WhatsApp otomatis",
    ],
    image: "/images/presentation/ss-walimurid.webp",
    icon: Users,
    accent: "from-teal-500 to-emerald-600",
    badge: "Connected",
  },
  {
    title: "Kelola Wali Kelas",
    subtitle: "Assign Wali Kelas per Kelas",
    desc: "Halaman manajemen wali kelas yang memungkinkan admin menugaskan guru sebagai wali kelas. Wali kelas mendapat dashboard khusus untuk memantau kelas yang diampu.",
    points: [
      "Tambah wali kelas dari daftar guru yang terdaftar",
      "Assign satu atau beberapa kelas per wali kelas",
      "Dashboard khusus wali kelas dengan data kelas yang diampu",
      "Fitur rekap & export absensi per kelas dari dashboard wali kelas",
    ],
    image: "/images/presentation/ss-walikelas.webp",
    icon: BookOpen,
    accent: "from-purple-500 to-fuchsia-600",
    badge: "Management",
  },
  {
    title: "Kelola Staff / Operator",
    subtitle: "Manajemen Akun Staf Sekolah",
    desc: "Halaman untuk menambah dan mengelola akun staff/operator yang memiliki akses operasional ke sistem absensi. Admin dapat mengatur nama, email, password, dan nomor WhatsApp setiap staf.",
    points: [
      "Tambah akun staff/operator dengan form yang mudah",
      "Card visual per staf: avatar, nama, dan role",
      "Edit profil staf: nama, email, password, dan nomor WhatsApp",
      "Hapus akun staf yang sudah tidak aktif",
    ],
    image: "/images/presentation/ss-staff.webp",
    icon: Settings,
    accent: "from-orange-500 to-amber-600",
    badge: "Staff",
  },
  {
    title: "Rekap & Export Absensi",
    subtitle: "Format Absensi Nasional Bulanan",
    desc: "Fitur rekap absensi dengan format tabel nasional bulanan. Tabel menampilkan grid tanggal 1-31 dengan kode warna (H, S, I, A), ringkasan per siswa, dan area tanda tangan wali kelas. Dapat di-export ke Excel dan PDF.",
    points: [
      "Format tabel absensi nasional: NO, NIS, Nama, Tanggal 1-31, Rekap H/S/I/A",
      "Kode warna status: Hijau (H), Biru (S), Kuning (I), Merah (A)",
      "Export Excel & PDF dengan format yang sama persis seperti preview",
      "Area tanda tangan wali kelas & alamat sekolah otomatis",
    ],
    image: "/images/presentation/ss-rekap.webp",
    icon: FileText,
    accent: "from-blue-600 to-indigo-700",
    badge: "Export",
  },
  {
    title: "Riwayat Absensi",
    subtitle: "Kelola Data Absensi Harian",
    desc: "Halaman riwayat absensi yang menampilkan data kehadiran harian per kelas. Admin dapat melihat, memfilter, dan mengubah status kehadiran siswa secara langsung dengan tombol ubah status interaktif.",
    points: [
      "Filter data per tanggal, kelas, dan nama/NIS siswa",
      "Statistik ringkas: Total, Hadir, Izin, Sakit, Alfa, Belum",
      "Ubah status kehadiran langsung dari tabel dengan satu klik",
      "Tab Kehadiran (Datang) dan Kepulangan (Pulang) terpisah",
    ],
    image: "/images/presentation/ss-riwayat.webp",
    icon: Clock,
    accent: "from-rose-500 to-red-600",
    badge: "History",
  },
  {
    title: "Notifikasi WhatsApp",
    subtitle: "Yang Sekolah Anda Butuhkan",
    desc: "Sistem notifikasi WhatsApp otomatis yang mengirimkan informasi kehadiran siswa langsung ke wali murid dan group kelas. Template pesan bisa dikustomisasi dengan placeholder dinamis seperti nama siswa, kelas, waktu, dan metode scan.",
    points: [
      "Notifikasi otomatis ke wali murid saat siswa scan datang & pulang",
      "Kirim ke group WhatsApp kelas atau langsung ke nomor wali murid",
      "Template pesan kustom dengan placeholder dinamis",
      "Broadcast massal & riwayat pengiriman pesan lengkap",
    ],
    image: "/images/presentation/ss-whatsapp.webp",
    icon: Bell,
    accent: "from-green-500 to-emerald-600",
    badge: "WhatsApp",
  },
  {
    title: "Langganan & Pembayaran",
    subtitle: "Yang Sekolah Anda Butuhkan",
    desc: "Sistem langganan fleksibel dengan berbagai paket sesuai kebutuhan sekolah. Mulai dari paket gratis hingga premium dengan fitur lengkap termasuk Face Recognition, Multi Cabang, dan WhatsApp Gateway. Pembayaran mudah melalui berbagai metode.",
    points: [
      "Paket fleksibel: Free, Basic, School, dan Premium",
      "Pembayaran otomatis via transfer bank, e-wallet, dan QRIS",
      "Dashboard langganan: masa aktif, fitur tersedia, statistik penggunaan",
      "Aktivasi otomatis setelah pembayaran berhasil diverifikasi",
    ],
    image: "/images/presentation/ss-langganan.webp",
    icon: Star,
    accent: "from-indigo-600 to-blue-600",
    badge: "Subscription",
  },
];

const WALIKELAS_FEATURES = [
  {
    title: "Dashboard Wali Kelas",
    subtitle: "Pantau Kelas yang Anda Ampu",
    desc: "Dashboard khusus wali kelas yang menampilkan ringkasan kehadiran kelas secara real-time. Dilengkapi kartu statistik (Total Siswa, Hadir, Izin, Sakit, Alfa, Belum), progress bar absensi harian, dan daftar siswa beserta status kehadiran terkini.",
    points: [
      "6 kartu statistik berwarna: Total Siswa, Hadir, Izin, Sakit, Alfa, Belum",
      "Progress bar absensi harian dengan persentase visual real-time",
      "Daftar siswa lengkap dengan badge status kehadiran (Hadir, Sakit, Alfa)",
      "Pencarian siswa cepat langsung dari dashboard",
    ],
    image: "/images/presentation/ss-wk-dashboard.webp",
    icon: LayoutDashboard,
    accent: "from-indigo-500 to-blue-600",
    badge: "Dashboard",
  },
  {
    title: "Absensi Manual Wali Kelas",
    subtitle: "Koreksi & Input Kehadiran Siswa",
    desc: "Halaman absensi manual yang memungkinkan wali kelas menginput atau mengoreksi status kehadiran siswa per kelas dan per tanggal. Dilengkapi tombol status interaktif (H/S/I/A) untuk setiap siswa serta fitur simpan batch.",
    points: [
      "Filter per kelas dan tanggal untuk input yang tepat",
      "Tombol status interaktif: H (Hadir), S (Sakit), I (Izin), A (Alfa)",
      "Simpan batch — ubah beberapa siswa sekaligus dalam satu klik",
      "Indikator jumlah siswa yang sudah terisi status",
    ],
    image: "/images/presentation/ss-wk-absensi.webp",
    icon: UserCheck,
    accent: "from-emerald-500 to-teal-600",
    badge: "Manual Input",
  },
  {
    title: "Siswa Kelas Saya",
    subtitle: "Direktori Siswa & Wali Murid",
    desc: "Halaman data siswa khusus kelas yang diampu oleh wali kelas. Menampilkan statistik kelas (Total Siswa, Laki-laki, Perempuan), daftar siswa lengkap dengan nama wali murid, dan persentase kehadiran individual.",
    points: [
      "4 kartu statistik: Total Siswa, Laki-laki, Perempuan, dan Kelas",
      "Daftar siswa dengan NIS, nama wali murid, dan persentase kehadiran",
      "Filter per kelas dan pencarian nama siswa atau wali murid",
      "Navigasi ke detail profil siswa dengan satu klik",
    ],
    image: "/images/presentation/ss-wk-siswa.webp",
    icon: Users,
    accent: "from-cyan-500 to-blue-600",
    badge: "My Students",
  },
  {
    title: "Rekap Absensi Wali Kelas",
    subtitle: "Laporan Kehadiran Format Nasional",
    desc: "Fitur rekap absensi bulanan dengan format tabel nasional yang dapat diakses langsung oleh wali kelas. Menampilkan grid tanggal 1-30 dengan kode warna status, ringkasan per siswa, serta area tanda tangan wali kelas. Mendukung export ke Excel.",
    points: [
      "Format tabel absensi nasional: NO, NIS, Nama, Tanggal, Rekap H/S/I/A",
      "Tab Rekap Kehadiran (Datang) dan Rekap Kepulangan (Pulang)",
      "Export Excel langsung dari halaman dengan format siap cetak",
      "Area tanda tangan wali kelas & nama sekolah otomatis",
    ],
    image: "/images/presentation/ss-wk-rekap.webp",
    icon: FileText,
    accent: "from-blue-600 to-indigo-700",
    badge: "Rekap",
  },
  {
    title: "Analytic Wali Kelas",
    subtitle: "Analitik Kehadiran Mendalam",
    desc: "Dashboard analitik per kelas yang menampilkan statistik lengkap: jumlah siswa, total record, persentase kehadiran, dan total alfa. Dilengkapi donut chart distribusi status serta persentase kehadiran per siswa dalam satu tampilan.",
    points: [
      "Kartu KPI: Jumlah Siswa, Total Record, % Kehadiran, Total Alfa",
      "Donut chart distribusi status: Hadir, Izin, Sakit, Alfa",
      "Tab Analisa Kelas dan Overview Kehadiran",
      "Filter periode: 30 hari, 60 hari, 90 hari, atau custom range",
    ],
    image: "/images/presentation/ss-wk-analytic.webp",
    icon: TrendingUp,
    accent: "from-amber-500 to-orange-600",
    badge: "Analytics",
  },
  {
    title: "Peringkat Kelas (Leaderboard)",
    subtitle: "Kompetisi Kehadiran Antar Kelas",
    desc: "Fitur peringkat kelas yang membandingkan tingkat kehadiran seluruh kelas di sekolah. Wali kelas dapat melihat posisi kelasnya, grafik perbandingan bar chart horizontal, dan papan peringkat lengkap berdasarkan persentase kehadiran 30 hari terakhir.",
    points: [
      "Posisi kelas Anda ditampilkan dengan highlight khusus",
      "Bar chart horizontal perbandingan kehadiran semua kelas",
      "Papan peringkat dengan medali emas, perak, perunggu",
      "Data berdasarkan persentase kehadiran 30 hari terakhir",
    ],
    image: "/images/presentation/ss-wk-leaderboard.webp",
    icon: Star,
    accent: "from-yellow-500 to-amber-600",
    badge: "Leaderboard",
  },
];

const EXTRA_FEATURES = [
  { icon: Globe, title: "Live Monitor Publik", desc: "Wali murid bisa memantau status kehadiran anak tanpa login via link khusus sekolah.", color: "from-teal-500 to-emerald-500" },
  { icon: Clock, title: "Riwayat Kehadiran", desc: "Rekam jejak lengkap seluruh aktivitas kehadiran yang bisa difilter tanggal, kelas, dan status.", color: "from-blue-500 to-indigo-500" },
  { icon: Bell, title: "Notifikasi WhatsApp", desc: "Notifikasi otomatis ke wali murid setiap kali anak di-scan masuk atau pulang sekolah.", color: "from-green-500 to-emerald-500" },
  { icon: Shield, title: "Multi-Role & Keamanan", desc: "3 level akses: School Admin, Staff/Operator, dan Wali Kelas.", color: "from-violet-500 to-purple-500" },
  { icon: Settings, title: "Pengaturan Lengkap", desc: "Konfigurasi jam operasional, logo sekolah, template pesan WhatsApp, dan integrasi gateway.", color: "from-rose-500 to-pink-500" },
  { icon: Smartphone, title: "Responsif & PWA-Ready", desc: "Tampilan optimal di smartphone, tablet, dan desktop tanpa perlu install aplikasi.", color: "from-cyan-500 to-blue-500" },
];

const STATS = [
  { value: "< 1 detik", label: "Waktu Scan" },
  { value: "3 Metode", label: "QR · Face · NIS Manual" },
  { value: "100%", label: "Data Terenkripsi" },
  { value: "Real-Time", label: "Live Monitoring" },
];

const Presentation = () => {
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [title, setTitle] = useState("ATSkolla");
  const [subtitle, setSubtitle] = useState("");
  const [ctaTitle, setCtaTitle] = useState("");
  const [ctaSubtitle, setCtaSubtitle] = useState("");
  const [ctaBtn1, setCtaBtn1] = useState("");
  const [ctaBtn2, setCtaBtn2] = useState("");
  const [ctaBtn1Link, setCtaBtn1Link] = useState("/register");
  const [ctaBtn2Link, setCtaBtn2Link] = useState("/login");
  const [dark, setDark] = useState(false);
  const [headerLogo, setHeaderLogo] = useState(atskollaLogo);

  useEffect(() => {
    const fetchData = async () => {
      const [presRes, settingsRes] = await Promise.all([
        supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["presentation_is_public", "presentation_title", "presentation_subtitle", "presentation_cta_title", "presentation_cta_subtitle", "presentation_cta_btn1", "presentation_cta_btn2", "presentation_cta_btn1_link", "presentation_cta_btn2_link"]),
        supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["header_logo_url"]),
      ]);
      if (presRes.data) {
        const map = Object.fromEntries(presRes.data.map((d) => [d.key, d.value]));
        setIsPublic(map.presentation_is_public === "true");
        if (map.presentation_title) setTitle(map.presentation_title);
        if (map.presentation_subtitle) setSubtitle(map.presentation_subtitle);
        if (map.presentation_cta_title) setCtaTitle(map.presentation_cta_title);
        if (map.presentation_cta_subtitle) setCtaSubtitle(map.presentation_cta_subtitle);
        if (map.presentation_cta_btn1) setCtaBtn1(map.presentation_cta_btn1);
        if (map.presentation_cta_btn2) setCtaBtn2(map.presentation_cta_btn2);
        if (map.presentation_cta_btn1_link) setCtaBtn1Link(map.presentation_cta_btn1_link);
        if (map.presentation_cta_btn2_link) setCtaBtn2Link(map.presentation_cta_btn2_link);
      }
      if (settingsRes.data) {
        const sMap = Object.fromEntries(settingsRes.data.map((d) => [d.key, d.value]));
        if (sMap.header_logo_url) setHeaderLogo(sMap.header_logo_url);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  if (!isPublic) return <Navigate to="/" replace />;

  const d = dark;
  const bg = d ? "bg-slate-950" : "bg-gradient-to-b from-slate-50 via-white to-slate-50";
  const text = d ? "text-white" : "text-slate-900";
  const muted = d ? "text-slate-400" : "text-slate-500";
  const cardBg = d ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const navBg = d ? "bg-slate-950/80 border-white/[0.05]" : "bg-white/80 border-slate-200";

  return (
    <div className={`min-h-screen ${bg} ${text} overflow-x-hidden transition-colors duration-500`} style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-40 left-1/3 w-[800px] h-[800px] rounded-full blur-[200px] ${d ? "bg-indigo-600/15" : "bg-indigo-200/40"}`} />
        <div className={`absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full blur-[200px] ${d ? "bg-emerald-600/10" : "bg-emerald-200/30"}`} />
        <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[200px] ${d ? "bg-blue-600/8" : "bg-blue-200/20"}`} />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl border-b ${navBg} transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={headerLogo} alt="ATSkolla" className="h-9 object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!d)} className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${d ? "bg-white/10 hover:bg-white/15 text-yellow-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
              {d ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href="/register" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
              Mulai Sekarang <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="min-h-screen flex flex-col items-center justify-center relative px-4 text-center pt-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium border ${d ? "bg-white/5 border-white/10 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-700"}`}>
            <Sparkles className="h-3.5 w-3.5" /> ATSkolla — Absensi Digital Sekolah #1 di Indonesia
          </span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
          <TypingEffect texts={[title || "ATSkolla — Absensi Digital Sekolah", "Cepat, Aman & Mudah Digunakan", "Solusi Absensi Modern untuk Sekolah"]} speed={60} className={`bg-gradient-to-b ${d ? "from-white via-white to-white/50" : "from-slate-900 via-indigo-900 to-indigo-700"} bg-clip-text text-transparent`} />
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className={`mt-6 text-base sm:text-lg md:text-xl ${muted} max-w-2xl leading-relaxed`}>
          {subtitle || "Sistem absensi siswa modern yang mengutamakan keamanan, efisiensi, dan transparansi. Dirancang khusus untuk sekolah Indonesia."}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-10 flex flex-col sm:flex-row gap-3">
          <a href="/register" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-3.5 rounded-2xl font-semibold shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-sm">
            <Zap className="h-4 w-4" /> Daftar Gratis Sekarang
          </a>
          <a href="#problems" className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-semibold transition-all text-sm border ${d ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"}`}>
            Lihat Selengkapnya <ArrowDown className="h-4 w-4" />
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full max-w-3xl">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-r ${d ? "from-indigo-300 to-blue-300" : "from-indigo-600 to-blue-500"} bg-clip-text text-transparent`}>
                {s.value}
              </div>
              <div className={`text-xs mt-1 ${d ? "text-slate-500" : "text-slate-400"}`}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className={`absolute bottom-8 ${d ? "text-slate-600" : "text-slate-300"}`}>
          <ArrowDown className="h-5 w-5" />
        </motion.div>
      </section>

      {/* ===== PERMASALAHAN & SOLUSI ===== */}
      <section id="problems" className={`py-20 sm:py-32 ${d ? "bg-white/[0.01]" : "bg-slate-50/80"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Problems */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className={`text-xs font-bold uppercase tracking-[0.2em] ${d ? "text-red-400" : "text-red-500"} mb-3 block`}>Latar Belakang</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Masalah Absensi di Sekolah
            </h2>
            <p className={`mt-3 ${muted} max-w-2xl mx-auto text-sm sm:text-base`}>Sistem absensi manual di sekolah Indonesia masih menyimpan banyak masalah dan ketidakefisienan.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div key={p.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className={`group rounded-2xl border p-6 transition-all duration-300 ${d ? "bg-red-500/[0.03] border-red-500/10 hover:border-red-500/20" : "bg-white border-red-100 hover:border-red-200 hover:shadow-lg"}`}>
                  <div className={`h-10 w-10 rounded-xl ${d ? "bg-red-500/10" : "bg-red-50"} flex items-center justify-center mb-4`}>
                    <Icon className={`h-5 w-5 ${d ? "text-red-400" : "text-red-500"}`} />
                  </div>
                  <h3 className="font-bold text-sm mb-1.5">{p.title}</h3>
                  <p className={`text-xs leading-relaxed ${muted}`}>{p.desc}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Arrow */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="flex flex-col items-center mb-16">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <ArrowDown className="h-6 w-6 text-white" />
            </div>
            <p className={`mt-3 font-bold text-sm ${d ? "text-indigo-400" : "text-indigo-600"}`}>Solusi Kami</p>
          </motion.div>

          {/* Solutions */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className={`text-xs font-bold uppercase tracking-[0.2em] ${d ? "text-indigo-400" : "text-indigo-600"} mb-3 block`}>Jawaban Tepat</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              ATSkolla — Absensi Digital Sekolah
            </h2>
            <p className={`mt-3 ${muted} max-w-2xl mx-auto text-sm sm:text-base`}>Setiap permasalahan memiliki solusi teknologi modern yang terintegrasi dalam satu platform.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {SOLUTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.solution} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className={`group rounded-2xl border p-6 transition-all duration-300 ${d ? "bg-indigo-500/[0.03] border-indigo-500/10 hover:border-indigo-500/20" : "bg-white border-indigo-100 hover:border-indigo-200 hover:shadow-lg"}`}>
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/15">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${d ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-500"}`}>{s.problem}</span>
                        <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${d ? "text-indigo-400" : "text-indigo-500"}`} />
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${d ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>{s.solution}</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${muted}`}>{s.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SCHOOL FEATURES ===== */}
      <section id="features" className="relative py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 sm:mb-24">
            <span className={`text-xs font-semibold uppercase tracking-widest ${d ? "text-indigo-400" : "text-indigo-600"}`}>Dashboard Sekolah</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-3">
              Fitur untuk <br className="hidden sm:block" />
              <span className={`bg-gradient-to-r ${d ? "from-indigo-300 to-blue-300" : "from-indigo-600 to-blue-500"} bg-clip-text text-transparent`}>Admin Sekolah</span>
            </h2>
            <p className={`mt-4 ${muted} max-w-xl mx-auto text-sm sm:text-base`}>
              {SCHOOL_FEATURES.length} fitur utama untuk mengelola absensi siswa secara digital, aman, dan efisien dari sisi admin sekolah.
            </p>
          </div>

          <div className="space-y-16 sm:space-y-32">
            {SCHOOL_FEATURES.map((f, idx) => {
              const isEven = idx % 2 === 0;
              const Icon = f.icon;
              return (
                <div key={f.title}>
                  {idx > 0 && (
                    <div className={`block sm:hidden w-16 h-px mx-auto mb-16 ${d ? "bg-white/10" : "bg-slate-200"}`} />
                  )}
                  <div className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} gap-8 lg:gap-16 items-center`}>
                    <div className="w-full lg:w-[58%]">
                      <div className={`rounded-2xl overflow-hidden border ${d ? "border-white/10" : "border-slate-200"} shadow-2xl ${d ? "shadow-black/40" : "shadow-slate-400/30"}`}>
                        <img src={f.image} alt={f.title} className="w-full h-auto block transition-transform duration-700" style={{ transform: "scale(1.012)" }} />
                      </div>
                    </div>
                    <div className="w-full lg:w-[42%]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center shadow-lg`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${d ? "text-slate-500" : "text-slate-400"}`}>{f.badge}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{f.title}</h3>
                      <p className={`text-xs uppercase tracking-widest font-semibold mt-1 ${d ? "text-indigo-400" : "text-indigo-600"}`}>{f.subtitle}</p>
                      <p className={`mt-4 text-sm leading-relaxed ${d ? "text-slate-300" : "text-slate-600"}`}>{f.desc}</p>
                      <ul className="mt-5 space-y-2.5">
                        {f.points.map((p, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${d ? "text-emerald-400" : "text-emerald-500"}`} />
                            <span className={`text-sm ${d ? "text-slate-400" : "text-slate-500"}`}>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WALI KELAS FEATURES ===== */}
      <section className={`relative py-20 sm:py-32 ${d ? "bg-white/[0.01]" : "bg-indigo-50/50"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 sm:mb-24">
            <span className={`text-xs font-semibold uppercase tracking-widest ${d ? "text-purple-400" : "text-purple-600"}`}>Dashboard Wali Kelas</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-3">
              Fitur untuk <br className="hidden sm:block" />
              <span className={`bg-gradient-to-r ${d ? "from-purple-300 to-indigo-300" : "from-purple-600 to-indigo-500"} bg-clip-text text-transparent`}>Wali Kelas</span>
            </h2>
            <p className={`mt-4 ${muted} max-w-xl mx-auto text-sm sm:text-base`}>
              {WALIKELAS_FEATURES.length} fitur khusus yang dirancang untuk membantu wali kelas memantau, mengelola, dan menganalisis kehadiran siswa kelas yang diampu.
            </p>
          </div>

          <div className="space-y-16 sm:space-y-32">
            {WALIKELAS_FEATURES.map((f, idx) => {
              const isEven = idx % 2 === 0;
              const Icon = f.icon;
              return (
                <div key={f.title}>
                  {idx > 0 && (
                    <div className={`block sm:hidden w-16 h-px mx-auto mb-16 ${d ? "bg-white/10" : "bg-slate-200"}`} />
                  )}
                  <div className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} gap-8 lg:gap-16 items-center`}>
                    <div className="w-full lg:w-[58%]">
                      <div className={`rounded-2xl overflow-hidden border ${d ? "border-white/10" : "border-slate-200"} shadow-2xl ${d ? "shadow-black/40" : "shadow-slate-400/30"}`}>
                        <img src={f.image} alt={f.title} className="w-full h-auto block transition-transform duration-700" style={{ transform: "scale(1.012)" }} />
                      </div>
                    </div>
                    <div className="w-full lg:w-[42%]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center shadow-lg`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${d ? "text-slate-500" : "text-slate-400"}`}>{f.badge}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{f.title}</h3>
                      <p className={`text-xs uppercase tracking-widest font-semibold mt-1 ${d ? "text-purple-400" : "text-purple-600"}`}>{f.subtitle}</p>
                      <p className={`mt-4 text-sm leading-relaxed ${d ? "text-slate-300" : "text-slate-600"}`}>{f.desc}</p>
                      <ul className="mt-5 space-y-2.5">
                        {f.points.map((p, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${d ? "text-emerald-400" : "text-emerald-500"}`} />
                            <span className={`text-sm ${d ? "text-slate-400" : "text-slate-500"}`}>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== EXTRA FEATURES ===== */}
      <section className={`py-20 sm:py-32 ${d ? "bg-white/[0.01]" : "bg-slate-50/80"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <span className={`text-xs font-semibold uppercase tracking-widest ${d ? "text-indigo-400" : "text-indigo-600"}`}>Dan Masih Banyak Lagi</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">Fitur Pendukung</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXTRA_FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className={`rounded-2xl border p-6 transition-all duration-300 ${d ? "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-lg"}`}>
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg mb-4`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-bold text-sm">{f.title}</h4>
                  <p className={`mt-2 text-xs leading-relaxed ${muted}`}>{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WHY CHOOSE ===== */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
               Mengapa{" "}
              <span className={`bg-gradient-to-r ${d ? "from-indigo-300 to-blue-300" : "from-indigo-600 to-blue-500"} bg-clip-text text-transparent`}>
                ATSkolla?
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Zap, title: "Cepat & Efisien", desc: "Scan absensi kurang dari 1 detik. Proses yang dulu memakan 30 menit kini selesai dalam hitungan detik." },
              { icon: Shield, title: "Aman & Terverifikasi", desc: "Setiap scan divalidasi sistem. Data terenkripsi dan hanya bisa diakses oleh pihak yang berwenang." },
              { icon: TrendingUp, title: "Data & Analitik", desc: "Dashboard analitik real-time membantu sekolah mengambil keputusan berbasis data kehadiran." },
              { icon: Star, title: "Mudah Digunakan", desc: "Tidak perlu pelatihan khusus. Antarmuka intuitif yang bisa digunakan oleh semua staf sekolah." },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className={`rounded-2xl border p-6 text-center transition-all duration-300 ${d ? "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-lg"}`}>
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-4">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-bold text-sm">{item.title}</h4>
                  <p className={`mt-2 text-xs leading-relaxed ${muted}`}>{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className={`py-20 sm:py-32 ${d ? "bg-gradient-to-b from-indigo-950/20 to-transparent" : "bg-gradient-to-b from-indigo-50/60 to-transparent"}`}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              {ctaTitle ? (
                <span className={`bg-gradient-to-r ${d ? "from-white via-white to-amber-300" : "from-slate-900 via-slate-800 to-amber-600"} bg-clip-text text-transparent`}>
                  {ctaTitle}
                </span>
              ) : (
                <>
                  Siap Memodernisasi{" "}
                  <span className={`bg-gradient-to-r ${d ? "from-indigo-300 to-blue-300" : "from-indigo-600 to-blue-500"} bg-clip-text text-transparent`}>
                    Absensi Sekolah Anda?
                  </span>
                </>
              )}
            </h2>
            <p className={`mt-4 ${muted} max-w-lg mx-auto text-sm sm:text-base`}>
              {ctaSubtitle || "Bergabung sekarang dan rasakan kemudahan sistem absensi digital yang aman, cepat, dan transparan."}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={ctaBtn1Link} className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-3.5 rounded-2xl font-semibold shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-sm">
                <Zap className="h-4 w-4" /> {ctaBtn1 || "Daftar Gratis"}
              </a>
              <a href={ctaBtn2Link} className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-semibold transition-all text-sm border ${d ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"}`}>
                {ctaBtn2 || "Masuk ke Dashboard"} <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`border-t py-10 ${d ? "border-white/5" : "border-slate-200"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={headerLogo} alt="ATSkolla" className="h-7 object-contain" />
          </div>
          <p className={`text-xs ${d ? "text-slate-600" : "text-slate-400"}`}>
            © {new Date().getFullYear()} ATSkolla — Absensi Digital Sekolah.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Presentation;
