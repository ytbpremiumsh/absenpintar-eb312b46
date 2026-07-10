import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TenantProvider, useTenant, getRootDomain, getTenantBasename } from "@/lib/tenant";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { handleError, normalizeError } from "@/lib/errorHandler";

// Layouts kept eager (small + shared by many routes)
import { AppLayout } from "@/components/layout/AppLayout";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { BendaharaLayout } from "./components/layout/BendaharaLayout";
import { PrincipalLayout } from "@/components/layout/PrincipalLayout";

// Auth/landing kept eager for fast first paint
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// All other pages lazy-loaded for code splitting
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const Students = lazy(() => import("./pages/Students"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const Classes = lazy(() => import("./pages/Classes"));
const Teachers = lazy(() => import("./pages/Teachers"));
const ManageWaliKelas = lazy(() => import("./pages/ManageWaliKelas"));
const ManageStaff = lazy(() => import("./pages/ManageStaff"));
const WaliKelasAttendance = lazy(() => import("./pages/WaliKelasAttendance"));
const WaliKelasStudents = lazy(() => import("./pages/WaliKelasStudents"));
const LeaveRequests = lazy(() => import("./pages/LeaveRequests"));
const Subscription = lazy(() => import("./pages/Subscription"));
const PaketSekolah = lazy(() => import("./pages/PaketSekolah"));
const SuperAdminPaketSekolah = lazy(() => import("./pages/super-admin/SuperAdminPaketSekolah"));
const PublicMonitoring = lazy(() => import("./pages/PublicMonitoring"));
const PublicClassMonitoring = lazy(() => import("./pages/PublicClassMonitoring"));
const PublicAttendanceMonitoring = lazy(() => import("./pages/PublicAttendanceMonitoring"));
const SchoolSettings = lazy(() => import("./pages/SchoolSettings"));
const HolidayManagement = lazy(() => import("./pages/HolidayManagement"));
const KalenderAkademik = lazy(() => import("./pages/KalenderAkademik"));
const AttendanceTime = lazy(() => import("./pages/AttendanceTime"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const SuperAdminPayments = lazy(() => import("./pages/super-admin/SuperAdminPayments"));
const SuperAdminPaymentGateway = lazy(() => import("./pages/super-admin/SuperAdminPaymentGateway"));
const ExportHistory = lazy(() => import("./pages/ExportHistory"));
const EditAttendance = lazy(() => import("./pages/EditAttendance"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const SuperAdminAnnouncements = lazy(() => import("./pages/super-admin/SuperAdminAnnouncements"));
const SuperAdminTickets = lazy(() => import("./pages/super-admin/SuperAdminTickets"));
const SuperAdminEmail = lazy(() => import("./pages/super-admin/SuperAdminEmail"));
const SuperAdminAuthEmail = lazy(() => import("./pages/super-admin/SuperAdminAuthEmail"));

const Panduan = lazy(() => import("./pages/Panduan"));
const PanduanDetail = lazy(() => import("./pages/PanduanDetail"));
const Presentation = lazy(() => import("./pages/Presentation"));
const Proposal = lazy(() => import("./pages/Proposal"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const LegalTerms = lazy(() => import("./pages/legal/Terms"));
const LegalRefund = lazy(() => import("./pages/legal/Refund"));
const LegalFAQ = lazy(() => import("./pages/legal/FAQ"));
const LegalContact = lazy(() => import("./pages/legal/Contact"));
const TentangKami = lazy(() => import("./pages/TentangKami"));

const Penawaran = lazy(() => import("./pages/Penawaran"));
const SuperAdminPenawaran = lazy(() => import("./pages/super-admin/SuperAdminPenawaran"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const SuperAdminBackup = lazy(() => import("./pages/super-admin/SuperAdminBackup"));
const SuperAdminServerInfo = lazy(() => import("./pages/super-admin/SuperAdminServerInfo"));
const SuperAdminBendahara = lazy(() => import("./pages/super-admin/SuperAdminBendahara"));
const SuperAdminShortlinks = lazy(() => import("./pages/super-admin/SuperAdminShortlinks"));
const ShortlinkRedirect = lazy(() => import("./pages/ShortlinkRedirect"));
const SuperAdminMetaPixel = lazy(() => import("./pages/super-admin/SuperAdminMetaPixel"));
const SuperAdminKeuanganHub = lazy(() => import("./pages/super-admin/SuperAdminKeuanganHub"));
const SuperAdminKomunikasiHub = lazy(() => import("./pages/super-admin/SuperAdminKomunikasiHub"));
const SuperAdminEmailHub = lazy(() => import("./pages/super-admin/SuperAdminEmailHub"));
const SuperAdminSistemHub = lazy(() => import("./pages/super-admin/SuperAdminSistemHub"));
const CustomDomain = lazy(() => import("./pages/CustomDomain"));
const Addons = lazy(() => import("./pages/Addons"));
const OrderIdCard = lazy(() => import("./pages/OrderIdCard"));
const WaCredit = lazy(() => import("./pages/WaCredit"));
const LiveSchedule = lazy(() => import("./pages/LiveSchedule"));
const RFIDCards = lazy(() => import("./pages/RFIDCards"));
const RFIDTest = lazy(() => import("./pages/RFIDTest"));

const SchoolAnnouncements = lazy(() => import("./pages/SchoolAnnouncements"));
const TeacherAttendanceRecap = lazy(() => import("./pages/TeacherAttendanceRecap"));
const ParentLogin = lazy(() => import("./pages/parent/ParentLogin"));
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ManageBendahara = lazy(() => import("./pages/ManageBendahara"));
const SelectRole = lazy(() => import("./pages/SelectRole"));
const PrincipalOverview = lazy(() => import("./pages/principal/PrincipalOverview"));
const PrincipalKehadiran = lazy(() => import("./pages/principal/PrincipalKehadiran"));
const PrincipalPembelajaran = lazy(() => import("./pages/principal/PrincipalPembelajaran"));
const PrincipalKeuangan = lazy(() => import("./pages/principal/PrincipalKeuangan"));
const PrincipalPersetujuan = lazy(() => import("./pages/principal/PrincipalPersetujuan"));
const PrincipalAgenda = lazy(() => import("./pages/principal/PrincipalAgenda"));
const PrincipalLaporan = lazy(() => import("./pages/principal/PrincipalLaporan"));
const LaporanAbsensiSiswa = lazy(() => import("./pages/principal/reports/LaporanAbsensiSiswa"));
const LaporanAbsensiGuru = lazy(() => import("./pages/principal/reports/LaporanAbsensiGuru"));
const LaporanSPP = lazy(() => import("./pages/principal/reports/LaporanSPP"));
const LaporanTunggakan = lazy(() => import("./pages/principal/reports/LaporanTunggakan"));
const LaporanBukuKas = lazy(() => import("./pages/principal/reports/LaporanBukuKas"));
const LaporanSettlement = lazy(() => import("./pages/principal/reports/LaporanSettlement"));
const LaporanJurnal = lazy(() => import("./pages/principal/reports/LaporanJurnal"));
const PrincipalMonitoring = lazy(() => import("./pages/principal/PrincipalMonitoring"));

const BendaharaWithdraw = lazy(() => import("./pages/bendahara/BendaharaWithdraw"));
const BendaharaKeuanganSekolah = lazy(() => import("./pages/bendahara/BendaharaKeuanganSekolah"));
const LaporanAbsensi = lazy(() => import("./pages/LaporanAbsensi"));
const RekapSiswaPage = lazy(() => import("./pages/RekapSiswaPage"));
const JadwalCombined = lazy(() => import("./pages/JadwalCombined"));
const LanggananCombined = lazy(() => import("./pages/LanggananCombined"));
const AllFeatures = lazy(() => import("./pages/AllFeatures"));
const WaliKelasLaporan = lazy(() => import("./pages/WaliKelasLaporan"));
const MapelLaporan = lazy(() => import("./pages/MapelLaporan"));
const TeacherWaliDashboard = lazy(() => import("./pages/TeacherWaliDashboard"));
const SuperAdminAddons = lazy(() => import("./pages/super-admin/SuperAdminAddons"));
const SuperAdminWhatsAppHub = lazy(() => import("./pages/super-admin/SuperAdminWhatsAppHub"));
const SuperAdminCMS = lazy(() => import("./pages/super-admin/SuperAdminCMS"));
const SuperAdminSekolahHub = lazy(() => import("./pages/super-admin/SuperAdminSekolahHub"));
const SuperAdminRFID = lazy(() => import("./pages/super-admin/SuperAdminRFID"));


// Bendahara grouped
const BendaharaPagesMod = () => import("./pages/bendahara/BendaharaPages");
const BendaharaDashboard = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaDashboard })));
const BendaharaSiswa = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaSiswa })));
const BendaharaTarif = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaTarif })));
const BendaharaGenerate = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaGenerate })));
const BendaharaTransaksi = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaTransaksi })));
const BendaharaSPPDetail = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaSPPDetail })));
const BendaharaImportExport = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaImportExport })));
const BendaharaSettlement = lazy(() => BendaharaPagesMod().then(m => ({ default: m.BendaharaSettlement })));

const BendaharaBukuKas = lazy(() => import("./pages/bendahara/BendaharaBukuKas"));
const BendaharaTunggakan = lazy(() => import("./pages/bendahara/BendaharaTunggakan"));
const BendaharaLaporanSPP = lazy(() => import("./pages/bendahara/BendaharaLaporanSPP"));

import { GoogleAnalytics } from "./components/GoogleAnalytics";
import MetaPixel from "./components/MetaPixel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        const norm = normalizeError(error);
        // Do not retry auth/permission/not-found errors
        if (norm.code === "PGRST116" || norm.code === "42501") return false;
        if (/JWT|Auth session|permission/i.test(norm.message)) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only toast on background refetches to avoid double-toast when component also catches.
      if (query.state.data !== undefined) {
        handleError(error, `query:${String(query.queryKey?.[0] ?? "unknown")}`);
      } else {
        // eslint-disable-next-line no-console
        console.error("[query error]", query.queryKey, error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Skip toast if the mutation defines its own onError handler
      if (mutation.options.onError) return;
      handleError(error, "mutation");
    },
  }),
});

function PageFallback() {
  return <div className="min-h-screen w-full bg-background" />;
}

function TenantNotFound() {
  const root = typeof window !== "undefined" ? getRootDomain() : "";
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">Sekolah tidak ditemukan</h1>
        <p className="text-muted-foreground mb-4">
          Subdomain <code className="font-mono">{typeof window !== "undefined" ? window.location.hostname : ""}</code> belum terdaftar.
        </p>
        {root && (
          <a href={`${window.location.protocol}//${root}`} className="text-primary underline">
            Kembali ke {root}
          </a>
        )}
      </div>
    </div>
  );
}

function RootRoute() {
  const { slug, school, loading, notFound } = useTenant();
  if (!slug) return <LandingPage />;
  if (loading) return <LoadingScreen />;
  if (notFound) return <TenantNotFound />;
  if (school) return <Navigate to="/login" replace />;
  return <LandingPage />;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/panduan" element={<Panduan />} />
        <Route path="/panduan/:role" element={<PanduanDetail />} />
        <Route path="/login" element={<Login forcedMode="parent" />} />
        <Route path="/admin" element={<Login forcedMode="school" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />

        <Route path="/register" element={<Register />} />
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/live/:schoolId" element={<PublicMonitoring />} />
        <Route path="/live/:schoolId/:className" element={<PublicClassMonitoring />} />
        <Route path="/attendance/:schoolId" element={<PublicAttendanceMonitoring />} />
        {/* Tenant subdomain shortcuts (schoolId resolved from tenant) */}
        <Route path="/monitor" element={<PublicMonitoring />} />
        <Route path="/monitor/:className" element={<PublicClassMonitoring />} />
        <Route path="/fitur" element={<Presentation />} />
        <Route path="/penawaran" element={<Penawaran />} />
        <Route path="/proposal" element={<Proposal />} />
        <Route path="/pitchdeck" element={<PitchDeck />} />
        <Route path="/syarat-ketentuan" element={<LegalTerms />} />
        <Route path="/kebijakan-refund" element={<LegalRefund />} />
        <Route path="/faq" element={<LegalFAQ />} />
        <Route path="/kontak" element={<LegalContact />} />
        <Route path="/tentang" element={<TentangKami />} />
        <Route path="/parent/login" element={<ParentLogin />} />
        <Route path="/parent" element={<ParentDashboard />} />
        {/* Bendahara */}
        <Route element={<BendaharaLayout />}>
          <Route path="/bendahara" element={<BendaharaDashboard />} />
          <Route path="/bendahara/siswa" element={<BendaharaSiswa />} />
          <Route path="/bendahara/tarif" element={<BendaharaTarif />} />
          <Route path="/bendahara/generate" element={<BendaharaGenerate />} />
          <Route path="/bendahara/transaksi" element={<BendaharaTransaksi />} />
          <Route path="/bendahara/transaksi/:studentId" element={<BendaharaSPPDetail />} />
          <Route path="/bendahara/import-export" element={<BendaharaImportExport />} />
          <Route path="/bendahara/withdraw" element={<BendaharaWithdraw />} />
          <Route path="/bendahara/keuangan-sekolah" element={<BendaharaKeuanganSekolah />} />
          <Route path="/bendahara/keuangan" element={<Navigate to="/bendahara/withdraw" replace />} />
          <Route path="/bendahara/saldo" element={<Navigate to="/bendahara/withdraw?tab=saldo" replace />} />
          <Route path="/bendahara/pencairan" element={<Navigate to="/bendahara/withdraw?tab=pencairan" replace />} />
          <Route path="/bendahara/laporan" element={<Navigate to="/bendahara/keuangan-sekolah" replace />} />
          <Route path="/bendahara/settlement" element={<BendaharaSettlement />} />
          
          <Route path="/bendahara/buku-kas" element={<BendaharaBukuKas />} />
          <Route path="/bendahara/tunggakan" element={<BendaharaTunggakan />} />
          <Route path="/bendahara/laporan-spp" element={<BendaharaLaporanSPP />} />
          <Route path="/bendahara/gateway" element={<Navigate to="/bendahara" replace />} />
        </Route>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/paket-sekolah" element={<SuperAdminPaketSekolah />} />

          {/* MANAJEMEN */}
          <Route path="/super-admin/sekolah" element={<SuperAdminSekolahHub />} />
          <Route path="/super-admin/schools" element={<Navigate to="/super-admin/sekolah?tab=schools" replace />} />
          <Route path="/super-admin/branches" element={<Navigate to="/super-admin/sekolah?tab=schools" replace />} />
          <Route path="/super-admin/login-logs" element={<Navigate to="/super-admin/sekolah?tab=logs" replace />} />
          <Route path="/super-admin/langganan" element={<Navigate to="/super-admin/paket-sekolah" replace />} />
          <Route path="/super-admin/plans" element={<Navigate to="/super-admin/paket-sekolah" replace />} />
          <Route path="/super-admin/subscriptions" element={<Navigate to="/super-admin/paket-sekolah" replace />} />
          <Route path="/super-admin/addons" element={<SuperAdminAddons />} />

          {/* OPERASIONAL — Keuangan */}
          <Route path="/super-admin/keuangan" element={<SuperAdminKeuanganHub />} />
          <Route path="/super-admin/payments" element={<Navigate to="/super-admin/keuangan?tab=payments" replace />} />
          <Route path="/super-admin/payment-gateway" element={<Navigate to="/super-admin/keuangan?tab=gateway" replace />} />
          <Route path="/super-admin/bendahara" element={<Navigate to="/super-admin/keuangan?tab=bendahara" replace />} />

          {/* OPERASIONAL — Komunikasi */}
          <Route path="/super-admin/komunikasi" element={<SuperAdminKomunikasiHub />} />
          <Route path="/super-admin/announcements" element={<Navigate to="/super-admin/komunikasi?tab=announcements" replace />} />
          <Route path="/super-admin/tickets" element={<Navigate to="/super-admin/komunikasi?tab=tickets" replace />} />
          <Route path="/super-admin/wa" element={<Navigate to="/super-admin/komunikasi?tab=whatsapp" replace />} />
          <Route path="/super-admin/whatsapp" element={<Navigate to="/super-admin/komunikasi?tab=whatsapp" replace />} />
          <Route path="/super-admin/registration-wa" element={<Navigate to="/super-admin/komunikasi?tab=whatsapp" replace />} />

          {/* OPERASIONAL — Email */}
          <Route path="/super-admin/email-hub" element={<SuperAdminEmailHub />} />
          <Route path="/super-admin/email" element={<Navigate to="/super-admin/email-hub?tab=smtp" replace />} />
          <Route path="/super-admin/auth-email" element={<Navigate to="/super-admin/email-hub?tab=auth" replace />} />

          {/* KONTEN & MARKETING */}
          <Route path="/super-admin/cms" element={<SuperAdminCMS />} />
          <Route path="/super-admin/landing" element={<Navigate to="/super-admin/cms?tab=landing" replace />} />
          <Route path="/super-admin/fitur" element={<Navigate to="/super-admin/cms?tab=fitur" replace />} />
          <Route path="/super-admin/penawaran" element={<Navigate to="/super-admin/cms?tab=penawaran" replace />} />
          <Route path="/super-admin/panduan" element={<Navigate to="/super-admin/cms?tab=panduan" replace />} />
          <Route path="/super-admin/testimonials" element={<Navigate to="/super-admin/cms?tab=testimoni" replace />} />
          <Route path="/super-admin/auto-caption" element={<Navigate to="/super-admin/cms?tab=caption" replace />} />
          <Route path="/super-admin/shortlinks" element={<Navigate to="/super-admin/cms?tab=shortlink" replace />} />
          <Route path="/super-admin/meta-pixel" element={<Navigate to="/super-admin/cms?tab=pixel" replace />} />
          <Route path="/super-admin/referral" element={<Navigate to="/super-admin" replace />} />

          {/* SISTEM */}
          <Route path="/super-admin/sistem" element={<SuperAdminSistemHub />} />
          <Route path="/super-admin/backup" element={<Navigate to="/super-admin/sistem?tab=backup" replace />} />
          <Route path="/super-admin/server-info" element={<Navigate to="/super-admin/sistem?tab=server" replace />} />
          <Route path="/super-admin/rfid" element={<Navigate to="/super-admin/sistem?tab=rfid" replace />} />
        </Route>

        <Route path="/s/:code" element={<ShortlinkRedirect />} />
        {/* Kepala Sekolah */}
        <Route element={<PrincipalLayout />}>
          <Route path="/kepsek" element={<PrincipalOverview />} />
          <Route path="/kepsek/monitoring" element={<PrincipalMonitoring />} />
          
          <Route path="/kepsek/agenda" element={<PrincipalAgenda />} />
          <Route path="/kepsek/laporan" element={<PrincipalLaporan />} />
          {/* Laporan — masing-masing punya menu sidebar tersendiri, dikelompokkan per kategori */}
          <Route path="/kepsek/laporan/absensi-siswa" element={<LaporanAbsensiSiswa />} />
          <Route path="/kepsek/laporan/absensi-guru" element={<LaporanAbsensiGuru />} />
          <Route path="/kepsek/laporan/jurnal" element={<LaporanJurnal />} />
          <Route path="/kepsek/laporan/spp" element={<LaporanSPP />} />
          <Route path="/kepsek/laporan/tunggakan" element={<LaporanTunggakan />} />
          <Route path="/kepsek/laporan/buku-kas" element={<LaporanBukuKas />} />
          <Route path="/kepsek/laporan/settlement" element={<LaporanSettlement />} />
          {/* Legacy redirects untuk halaman lama yang sudah digabung */}
          <Route path="/kepsek/kehadiran" element={<Navigate to="/kepsek/monitoring?tab=kehadiran" replace />} />
          <Route path="/kepsek/pembelajaran" element={<Navigate to="/kepsek/monitoring?tab=pembelajaran" replace />} />
          <Route path="/kepsek/keuangan" element={<Navigate to="/kepsek/manajemen?tab=keuangan" replace />} />
          <Route path="/kepsek/persetujuan" element={<Navigate to="/kepsek/manajemen?tab=persetujuan" replace />} />
        </Route>
        {/* School Admin / Staff */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/scan" element={<ScanQR />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/students" element={<Students />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/wali-kelas" element={<ManageWaliKelas />} />
          <Route path="/staff" element={<ManageStaff />} />
          <Route path="/bendahara-manage" element={<ManageBendahara />} />
          <Route path="/teacher-dashboard" element={<TeacherWaliDashboard />} />
          <Route path="/wali-kelas-dashboard" element={<Navigate to="/teacher-dashboard?tab=wali" replace />} />
          <Route path="/wali-kelas-attendance" element={<WaliKelasAttendance />} />
          <Route path="/wali-kelas-students" element={<WaliKelasStudents />} />
          <Route path="/wali-kelas/laporan" element={<WaliKelasLaporan />} />
          <Route path="/wali-kelas-export" element={<Navigate to="/wali-kelas/laporan?tab=rekap" replace />} />
          <Route path="/wali-kelas-history" element={<Navigate to="/wali-kelas/laporan?tab=analitik" replace />} />
          <Route path="/leave-requests" element={<LeaveRequests />} />
          <Route path="/laporan-absensi" element={<Navigate to="/laporan-absensi/siswa" replace />} />
          <Route path="/laporan-absensi/siswa" element={<RekapSiswaPage />} />
          <Route path="/laporan-absensi/guru" element={<TeacherAttendanceRecap />} />
          <Route path="/laporan-absensi/riwayat" element={<Navigate to="/laporan-absensi/siswa?tab=riwayat" replace />} />
          <Route path="/laporan-absensi/analitik" element={<Navigate to="/laporan-absensi/siswa?tab=analitik" replace />} />
          <Route path="/history" element={<Navigate to="/laporan-absensi/siswa?tab=analitik" replace />} />
          <Route path="/export-history" element={<Navigate to="/laporan-absensi/siswa" replace />} />
          <Route path="/edit-attendance" element={<Navigate to="/laporan-absensi/siswa?tab=riwayat" replace />} />
          <Route path="/mapel/laporan" element={<MapelLaporan />} />
          <Route path="/teacher-attendance" element={<TeacherAttendanceRecap />} />
          <Route path="/langganan" element={<Navigate to="/paket-sekolah" replace />} />
          <Route path="/subscription" element={<Navigate to="/paket-sekolah" replace />} />
          <Route path="/addons" element={<Navigate to="/langganan?tab=addon" replace />} />
          <Route path="/all-features" element={<AllFeatures />} />
          <Route path="/paket-sekolah" element={<PaketSekolah />} />
          <Route path="/school-settings" element={<SchoolSettings />} />
          <Route path="/holidays" element={<HolidayManagement />} />
          <Route path="/kalender-akademik" element={<KalenderAkademik />} />
          <Route path="/attendance-time" element={<AttendanceTime />} />
          <Route path="/rfid-devices" element={<Navigate to="/dashboard" replace />} />
          <Route path="/rfid-cards" element={<RFIDCards />} />
          <Route path="/rfid-test" element={<RFIDTest />} />

          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="/support" element={<SupportTickets />} />
          <Route path="/referral" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/whatsapp" element={<WhatsAppSettings />} />
          <Route path="/custom-domain" element={<CustomDomain />} />
          <Route path="/order-idcard" element={<OrderIdCard />} />
          <Route path="/wa-credit" element={<WaCredit />} />
          <Route path="/jadwal" element={<JadwalCombined />} />
          <Route path="/teaching-schedule" element={<Navigate to="/jadwal?tab=mengajar" replace />} />
          <Route path="/live-schedule" element={<Navigate to="/jadwal?tab=live" replace />} />
          <Route path="/announcements" element={<SchoolAnnouncements />} />
          <Route path="/wa-templates" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/wa-broadcast" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/wa-history" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/whatsapp-settings" element={<Navigate to="/whatsapp" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const tenantBasename = typeof window !== "undefined" ? getTenantBasename() : "";

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DynamicFavicon />
          <BrowserRouter basename={tenantBasename || undefined}>
            <TenantProvider>
              <AuthProvider>
                <GoogleAnalytics />
                <MetaPixel />
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </AuthProvider>
            </TenantProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
