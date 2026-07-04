import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TenantProvider, useTenant } from "@/lib/tenant";

// Layouts kept eager (small + shared by many routes)
import { AppLayout } from "@/components/layout/AppLayout";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { BendaharaLayout } from "./components/layout/BendaharaLayout";

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
const PublicMonitoring = lazy(() => import("./pages/PublicMonitoring"));
const PublicClassMonitoring = lazy(() => import("./pages/PublicClassMonitoring"));
const PublicAttendanceMonitoring = lazy(() => import("./pages/PublicAttendanceMonitoring"));
const SchoolSettings = lazy(() => import("./pages/SchoolSettings"));
const HolidayManagement = lazy(() => import("./pages/HolidayManagement"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const SuperAdminPayments = lazy(() => import("./pages/super-admin/SuperAdminPayments"));
const ExportHistory = lazy(() => import("./pages/ExportHistory"));
const EditAttendance = lazy(() => import("./pages/EditAttendance"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const SuperAdminAnnouncements = lazy(() => import("./pages/super-admin/SuperAdminAnnouncements"));
const SuperAdminTickets = lazy(() => import("./pages/super-admin/SuperAdminTickets"));
const SuperAdminEmail = lazy(() => import("./pages/super-admin/SuperAdminEmail"));
const SuperAdminReferral = lazy(() => import("./pages/super-admin/SuperAdminReferral"));
const Panduan = lazy(() => import("./pages/Panduan"));
const PanduanDetail = lazy(() => import("./pages/PanduanDetail"));
const Presentation = lazy(() => import("./pages/Presentation"));
const Proposal = lazy(() => import("./pages/Proposal"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const ReferralDashboard = lazy(() => import("./pages/ReferralDashboard"));
const Penawaran = lazy(() => import("./pages/Penawaran"));
const SuperAdminPenawaran = lazy(() => import("./pages/super-admin/SuperAdminPenawaran"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AffiliateRegister = lazy(() => import("./pages/AffiliateRegister"));
const AffiliateLogin = lazy(() => import("./pages/AffiliateLogin"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const SuperAdminAffiliate = lazy(() => import("./pages/super-admin/SuperAdminAffiliate"));
const SuperAdminBackup = lazy(() => import("./pages/super-admin/SuperAdminBackup"));
const SuperAdminServerInfo = lazy(() => import("./pages/super-admin/SuperAdminServerInfo"));
const SuperAdminBendahara = lazy(() => import("./pages/super-admin/SuperAdminBendahara"));
const SuperAdminShortlinks = lazy(() => import("./pages/super-admin/SuperAdminShortlinks"));
const ShortlinkRedirect = lazy(() => import("./pages/ShortlinkRedirect"));
const SuperAdminMetaPixel = lazy(() => import("./pages/super-admin/SuperAdminMetaPixel"));
const CustomDomain = lazy(() => import("./pages/CustomDomain"));
const Addons = lazy(() => import("./pages/Addons"));
const OrderIdCard = lazy(() => import("./pages/OrderIdCard"));
const WaCredit = lazy(() => import("./pages/WaCredit"));
const LiveSchedule = lazy(() => import("./pages/LiveSchedule"));
const TeacherAffiliate = lazy(() => import("./pages/TeacherAffiliate"));
const SchoolAnnouncements = lazy(() => import("./pages/SchoolAnnouncements"));
const TeacherAttendanceRecap = lazy(() => import("./pages/TeacherAttendanceRecap"));
const ParentLogin = lazy(() => import("./pages/parent/ParentLogin"));
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ManageBendahara = lazy(() => import("./pages/ManageBendahara"));
const SelectRole = lazy(() => import("./pages/SelectRole"));
const BendaharaKeuangan = lazy(() => import("./pages/bendahara/BendaharaKeuangan"));
const LaporanAbsensi = lazy(() => import("./pages/LaporanAbsensi"));
const RekapSiswaPage = lazy(() => import("./pages/RekapSiswaPage"));
const JadwalCombined = lazy(() => import("./pages/JadwalCombined"));
const LanggananCombined = lazy(() => import("./pages/LanggananCombined"));
const AllFeatures = lazy(() => import("./pages/AllFeatures"));
const WaliKelasLaporan = lazy(() => import("./pages/WaliKelasLaporan"));
const MapelLaporan = lazy(() => import("./pages/MapelLaporan"));
const TeacherWaliDashboard = lazy(() => import("./pages/TeacherWaliDashboard"));
const SuperAdminSubscriptionsHub = lazy(() => import("./pages/super-admin/SuperAdminSubscriptionsHub"));
const SuperAdminWhatsAppHub = lazy(() => import("./pages/super-admin/SuperAdminWhatsAppHub"));
const SuperAdminCMS = lazy(() => import("./pages/super-admin/SuperAdminCMS"));
const SuperAdminSekolahHub = lazy(() => import("./pages/super-admin/SuperAdminSekolahHub"));

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

import { GoogleAnalytics } from "./components/GoogleAnalytics";
import MetaPixel from "./components/MetaPixel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return <div className="min-h-screen w-full bg-background" />;
}

function TenantNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">Sekolah tidak ditemukan</h1>
        <p className="text-muted-foreground mb-4">
          Subdomain <code className="font-mono">{typeof window !== "undefined" ? window.location.hostname : ""}</code> belum terdaftar di ATSkolla.
        </p>
        <a href="https://atskolla.com" className="text-primary underline">Kunjungi atskolla.com</a>
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
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/live/:schoolId" element={<PublicMonitoring />} />
        <Route path="/live/:schoolId/:className" element={<PublicClassMonitoring />} />
        <Route path="/attendance/:schoolId" element={<PublicAttendanceMonitoring />} />
        <Route path="/fitur" element={<Presentation />} />
        <Route path="/penawaran" element={<Penawaran />} />
        <Route path="/proposal" element={<Proposal />} />
        <Route path="/pitchdeck" element={<PitchDeck />} />
        <Route path="/affiliate/register" element={<AffiliateRegister />} />
        <Route path="/affiliate/login" element={<AffiliateLogin />} />
        <Route path="/affiliate/dashboard" element={<AffiliateDashboard />} />
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
          <Route path="/bendahara/keuangan" element={<BendaharaKeuangan />} />
          <Route path="/bendahara/saldo" element={<Navigate to="/bendahara/keuangan?tab=saldo" replace />} />
          <Route path="/bendahara/pencairan" element={<Navigate to="/bendahara/keuangan?tab=pencairan" replace />} />
          <Route path="/bendahara/laporan" element={<Navigate to="/bendahara/keuangan?tab=laporan" replace />} />
          <Route path="/bendahara/settlement" element={<BendaharaSettlement />} />
          <Route path="/bendahara/gateway" element={<Navigate to="/bendahara" replace />} />
        </Route>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/sekolah" element={<SuperAdminSekolahHub />} />
          <Route path="/super-admin/schools" element={<Navigate to="/super-admin/sekolah?tab=schools" replace />} />
          <Route path="/super-admin/branches" element={<Navigate to="/super-admin/sekolah?tab=branches" replace />} />
          <Route path="/super-admin/login-logs" element={<Navigate to="/super-admin/sekolah?tab=logs" replace />} />
          <Route path="/super-admin/langganan" element={<SuperAdminSubscriptionsHub />} />
          <Route path="/super-admin/plans" element={<Navigate to="/super-admin/langganan?tab=plans" replace />} />
          <Route path="/super-admin/subscriptions" element={<Navigate to="/super-admin/langganan?tab=schools" replace />} />
          <Route path="/super-admin/addons" element={<Navigate to="/super-admin/langganan?tab=addons" replace />} />
          <Route path="/super-admin/payments" element={<SuperAdminPayments />} />
          <Route path="/super-admin/wa" element={<SuperAdminWhatsAppHub />} />
          <Route path="/super-admin/whatsapp" element={<Navigate to="/super-admin/wa?tab=api" replace />} />
          <Route path="/super-admin/registration-wa" element={<Navigate to="/super-admin/wa?tab=aktivasi" replace />} />
          <Route path="/super-admin/announcements" element={<SuperAdminAnnouncements />} />
          <Route path="/super-admin/tickets" element={<SuperAdminTickets />} />
          <Route path="/super-admin/email" element={<SuperAdminEmail />} />
          <Route path="/super-admin/cms" element={<SuperAdminCMS />} />
          <Route path="/super-admin/landing" element={<Navigate to="/super-admin/cms?tab=landing" replace />} />
          <Route path="/super-admin/fitur" element={<Navigate to="/super-admin/cms?tab=fitur" replace />} />
          <Route path="/super-admin/penawaran" element={<Navigate to="/super-admin/cms?tab=penawaran" replace />} />
          <Route path="/super-admin/panduan" element={<Navigate to="/super-admin/cms?tab=panduan" replace />} />
          <Route path="/super-admin/testimonials" element={<Navigate to="/super-admin/cms?tab=testimoni" replace />} />
          <Route path="/super-admin/auto-caption" element={<Navigate to="/super-admin/cms?tab=caption" replace />} />
          <Route path="/super-admin/referral" element={<SuperAdminReferral />} />
          <Route path="/super-admin/affiliate" element={<SuperAdminAffiliate />} />
          <Route path="/super-admin/backup" element={<SuperAdminBackup />} />
          <Route path="/super-admin/server-info" element={<SuperAdminServerInfo />} />
          <Route path="/super-admin/bendahara" element={<SuperAdminBendahara />} />
          <Route path="/super-admin/shortlinks" element={<SuperAdminShortlinks />} />
          <Route path="/super-admin/meta-pixel" element={<SuperAdminMetaPixel />} />
        </Route>
        <Route path="/s/:code" element={<ShortlinkRedirect />} />
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
          <Route path="/langganan" element={<LanggananCombined />} />
          <Route path="/subscription" element={<Navigate to="/langganan?tab=paket" replace />} />
          <Route path="/addons" element={<Navigate to="/langganan?tab=addon" replace />} />
          <Route path="/all-features" element={<AllFeatures />} />
          <Route path="/school-settings" element={<SchoolSettings />} />
          <Route path="/holidays" element={<HolidayManagement />} />
          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="/support" element={<SupportTickets />} />
          <Route path="/referral" element={<ReferralDashboard />} />
          <Route path="/affiliate-teacher" element={<TeacherAffiliate />} />
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DynamicFavicon />
        <BrowserRouter>
          <TenantProvider>
            <AuthProvider>
              <GoogleAnalytics />
              <MetaPixel />
              <AppRoutes />
            </AuthProvider>
          </TenantProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
