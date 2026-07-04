import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileFooterNav } from "./MobileFooterNav";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Settings, LogOut, School, KeyRound, Gift, LayoutGrid, Activity, ScanLine, Users, CalendarDays, HelpCircle, Award, Repeat, BookOpen } from "lucide-react";
import { getAvailableDashboards } from "@/lib/dashboards";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import atskollaLogo from "@/assets/Logo_atskolla.png";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

const buildFooterItems = (isTeacherOnly: boolean, isWaliKelas: boolean) => [
  { label: "Dashboard", icon: LayoutGrid, path: isTeacherOnly ? "/teacher-dashboard" : "/dashboard" },
  { label: "Monitoring", icon: Activity, path: "/monitoring" },
  { label: "Scan", icon: ScanLine, path: "/scan", isCenter: true },
  // Guru murni (bukan wali kelas) → Riwayat laporan. Wali kelas / admin → Siswa
  isTeacherOnly && !isWaliKelas
    ? { label: "Riwayat", icon: BookOpen, path: "/mapel/laporan" }
    : { label: "Siswa", icon: Users, path: isTeacherOnly ? "/wali-kelas-students" : "/students" },
  { label: "Jadwal", icon: CalendarDays, path: "/jadwal" },
];

function AppContent() {
  const { user, profile, roles, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobileDevice = useIsMobile();

  const [headerLogo, setHeaderLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [isWaliKelas, setIsWaliKelas] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").eq("key", "login_logo_url").maybeSingle().then(({ data }) => {
      if (data?.value) setHeaderLogo(data.value);
    });
  }, []);

  useEffect(() => {
    if (!user || !profile?.school_id) return;
    supabase.from("class_teachers").select("id").eq("user_id", user.id).eq("school_id", profile.school_id).limit(1).then(({ data }) => {
      setIsWaliKelas((data || []).length > 0);
    });
  }, [user, profile?.school_id]);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle().then(({ data }) => {
      if (data?.name) setSchoolName(data.name);
    });
  }, [profile?.school_id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles.includes("super_admin")) return <Navigate to="/super-admin" replace />;

  const activeDashboard = typeof window !== "undefined" ? sessionStorage.getItem("active_dashboard") : null;

  // Bendahara: hanya redirect jika user secara aktif memilih dashboard bendahara,
  // atau jika role-nya cuma bendahara (tidak ada role lain).
  const isBendaharaOnly = roles.includes("bendahara") && !roles.includes("school_admin") && !roles.includes("staff") && !roles.includes("teacher");
  if ((activeDashboard === "bendahara" || isBendaharaOnly) && !location.pathname.startsWith("/bendahara") && location.pathname !== "/account-settings" && location.pathname !== "/support") {
    return <Navigate to="/bendahara" replace />;
  }

  // Teacher: aktif jika user memilih dashboard guru, atau hanya punya role teacher.
  const isTeacherActive = activeDashboard === "teacher" || (roles.includes("teacher") && !roles.includes("school_admin") && !roles.includes("staff"));
  const isTeacherOnly = isTeacherActive;
  if (isTeacherOnly && location.pathname === "/dashboard") {
    return <Navigate to="/teacher-dashboard" replace />;
  }
  // Sebaliknya: jika user memilih admin/operator tapi sedang di /teacher-dashboard, redirect ke /dashboard
  if (!isTeacherActive && location.pathname === "/teacher-dashboard" && (roles.includes("school_admin") || roles.includes("staff"))) {
    return <Navigate to="/dashboard" replace />;
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const logoSrc = headerLogo || atskollaLogo;

  return (
    <>
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="h-14 flex items-center justify-between glass-subtle border-b border-border/40 px-3 sm:px-5 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <SidebarTrigger className="h-8 w-8 rounded-xl hover:bg-secondary/80 transition-colors shrink-0" />
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-sm shrink-0">
              <img src={logoSrc} alt="Logo" className="h-5 w-5 object-contain" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight truncate max-w-[160px] sm:max-w-[280px]">
                {schoolName || "ATSkolla"}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 font-medium truncate">
                {isTeacherActive ? "Guru / Wali Kelas" : roles.includes("school_admin") ? "Admin Sekolah" : "Operator"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl hover:bg-secondary/80 transition-all duration-200 p-1.5 pr-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                    <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <Settings className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-elevated border-border/50">
                <DropdownMenuLabel className="font-normal px-4 py-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{profile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {getAvailableDashboards(roles).length > 1 && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/select-role")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                      <Repeat className="h-4 w-4 mr-2.5 text-muted-foreground" />
                      Switch Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {roles.includes("school_admin") && (
                  <DropdownMenuItem onClick={() => navigate("/school-settings")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <School className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    Identitas Sekolah
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/account-settings")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <KeyRound className="h-4 w-4 mr-2.5 text-muted-foreground" />
                  Ganti Password
                </DropdownMenuItem>
                {/* Admin Sekolah pakai Referral & Point */}
                {roles.includes("school_admin") && (
                  <DropdownMenuItem onClick={() => navigate("/referral")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <Award className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    Referral & Point
                  </DropdownMenuItem>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <HelpCircle className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    Pusat Bantuan
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="rounded-2xl shadow-elevated border-border/50">
                      <DropdownMenuItem onClick={() => navigate("/panduan")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                        <BookOpen className="h-4 w-4 mr-2.5 text-muted-foreground" />
                        Panduan Penggunaan
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/support")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                        <HelpCircle className="h-4 w-4 mr-2.5 text-muted-foreground" />
                        Hubungi Support
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2.5" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className={cn("flex-1 overflow-auto p-3 sm:p-5 md:p-6", isMobileDevice && "pb-24")}>
          <Suspense fallback={<div className="h-32" />}>
            <Outlet />
          </Suspense>
        </main>
        {isMobileDevice && <MobileFooterNav items={buildFooterItems(isTeacherOnly, isWaliKelas)} />}
      </div>
    </>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-svh flex w-full bg-background">
        <AppContent />
      </div>
    </SidebarProvider>
  );
}
