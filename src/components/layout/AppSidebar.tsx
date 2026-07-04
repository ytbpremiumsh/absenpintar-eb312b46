import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  Activity,
  LogOut,
  GraduationCap,
  UserCheck,
  BarChart3,
  
  ClipboardCheck,
  UsersRound,
  MessageCircle,
  ChevronRight,
  Crown,
  PenLine,
  Sparkles,
  Package,
  CalendarDays,
  Radio,
  BookOpen,
  Megaphone,
  FileText,
} from "lucide-react";
import atskollaLogo from "@/assets/Logo_atskolla.png";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Monitoring", url: "/monitoring", icon: Activity, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Scan Absensi", url: "/scan", icon: ScanLine, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Pengumuman", url: "/announcements", icon: Megaphone, accent: "from-[#5B6CF9]/85 to-[#4c5ded]", adminOnly: true },
];

const dataNav = [
  { title: "Kelas", url: "/classes", icon: GraduationCap, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Siswa", url: "/students", icon: Users, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Orang Tua", url: "/teachers", icon: UserCheck, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Wali Kelas", url: "/wali-kelas", icon: ClipboardCheck, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
  { title: "Guru & Staff", url: "/staff", icon: UsersRound, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
];

const scheduleNav = [
  { title: "Jadwal", url: "/jadwal", icon: CalendarDays, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
];

const whatsappNav = [
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
];

const settingsNavSubscription = [
  { title: "Langganan & Add-on", url: "/langganan", icon: Sparkles, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
];
const settingsNavAllFeatures = [
  { title: "Semua Fitur", url: "/all-features", icon: Sparkles, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
];

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, roles, profile, user } = useAuth();
  const features = useSubscriptionFeatures();
  const isActive = (path: string) => location.pathname.startsWith(path);

  const [schoolData, setSchoolData] = useState<{ name: string; logo: string | null } | null>(null);
  const [platformLogo, setPlatformLogo] = useState<string | null>(null);
  const [isWaliKelas, setIsWaliKelas] = useState(false);

  const isPremiumBrand = ["School", "Premium"].includes(features.planName);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").in("key", ["login_logo_url"]).then(({ data }) => {
      (data || []).forEach((d: any) => {
        if (d.key === "login_logo_url" && d.value) setPlatformLogo(d.value);
      });
    });
  }, []);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("schools").select("name, logo").eq("id", profile.school_id).single().then(({ data }) => {
      if (data) setSchoolData(data);
    });
  }, [profile?.school_id]);

  // Check if teacher is also wali kelas
  useEffect(() => {
    if (!user || !profile?.school_id) return;
    supabase.from("class_teachers").select("id").eq("user_id", user.id).eq("school_id", profile.school_id).limit(1).then(({ data }) => {
      setIsWaliKelas((data || []).length > 0);
    });
  }, [user, profile?.school_id]);

  const activeDashboard = typeof window !== "undefined" ? sessionStorage.getItem("active_dashboard") : null;
  const isTeacherOnly = activeDashboard === "teacher" || (roles.includes("teacher") && !roles.includes("school_admin") && !roles.includes("staff"));

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderNavItems = (items: typeof mainNav) =>
    items.map((item) => {
      const active = isActive(item.url);
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
            <NavLink
              to={item.url}
              end
              onClick={handleNavClick}
              className={`relative rounded-xl px-3 py-2.5 transition-all duration-200 group/nav gap-3 ${
                active
                  ? "bg-gradient-to-r " + item.accent + " text-white font-semibold shadow-lg shadow-[#5B6CF9]/20"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              activeClassName=""
            >
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                active ? "bg-white/20" : "bg-muted/80"
              }`}>
                <item.icon className={`h-[15px] w-[15px] stroke-[2] ${active ? "text-white" : ""}`} />
              </div>
              <span className={`text-[13px] truncate flex-1 ${active ? "text-white" : ""}`}>{item.title}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 stroke-[2.5] ml-auto shrink-0 opacity-70 text-white" />}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const renderGroupLabel = (label: string) => (
    <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 mb-1.5 text-muted-foreground/60">
      {label}
    </SidebarGroupLabel>
  );

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border/30 font-['Inter',sans-serif]">
      <SidebarHeader className="p-3 pb-2">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] p-3 shadow-lg shadow-[#5B6CF9]/15">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -bottom-3 -left-3 h-12 w-12 rounded-full bg-white/5 blur-lg" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              {isPremiumBrand && schoolData?.logo ? (
                <img src={schoolData.logo} alt={schoolData.name} className="h-8 w-8 object-contain" />
              ) : platformLogo ? (
                <img src={platformLogo} alt="ATSkolla" className="h-8 w-8 object-contain" />
              ) : (
                <img src={atskollaLogo} alt="ATSkolla" className="h-8 w-8 object-contain" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-extrabold text-white tracking-tight truncate leading-tight">
                {isPremiumBrand && schoolData ? schoolData.name : "ATSkolla"}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/90 bg-white/20 backdrop-blur-sm px-1.5 py-[1px] rounded-md border border-white/15">
                  {features.isTrial ? (
                    <Sparkles className="h-2.5 w-2.5" />
                  ) : (
                    <Crown className="h-2.5 w-2.5" />
                  )}
                  {features.isTrial
                    ? "Trial Premium"
                    : features.planName === "Free" ? "Free Plan" : `${features.planName}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 overflow-y-auto overflow-x-hidden">
        {isTeacherOnly ? (
          <>
            <SidebarGroup>
              {renderGroupLabel("Guru Mata Pelajaran")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                   {renderNavItems([
                    { title: "Dashboard", url: "/teacher-dashboard", icon: BookOpen, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                    { title: "Laporan Mapel", url: "/mapel/laporan", icon: BarChart3, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                  ])}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {isWaliKelas && (
              <SidebarGroup>
                {renderGroupLabel("Wali Kelas")}
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                     {renderNavItems([
                      { title: "Absensi Manual", url: "/wali-kelas-attendance", icon: ClipboardCheck, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                      { title: "Siswa Kelas Saya", url: "/wali-kelas-students", icon: Users, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                      { title: "Laporan Kelas", url: "/wali-kelas/laporan", icon: BarChart3, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                      { title: "Pengajuan Izin/Sakit", url: "/leave-requests", icon: FileText, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                    ])}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            <SidebarGroup>
              {renderGroupLabel("Jadwal")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {renderNavItems(scheduleNav)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup>
              {renderGroupLabel("Menu Utama")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{renderNavItems(mainNav.filter(i => !i.adminOnly || roles.includes("school_admin")))}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              {renderGroupLabel("Data Sekolah")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{renderNavItems(dataNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              {renderGroupLabel("Jadwal")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{renderNavItems(scheduleNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              {renderGroupLabel("Laporan")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {renderNavItems([
                    { title: "Laporan Absensi", url: "/laporan-absensi", icon: BarChart3, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                    { title: "Rekap Absensi Guru", url: "/teacher-attendance", icon: UsersRound, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                    { title: "Pengajuan Izin/Sakit", url: "/leave-requests", icon: FileText, accent: "from-[#5B6CF9]/85 to-[#4c5ded]" },
                  ])}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              {renderGroupLabel("WhatsApp")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{renderNavItems(whatsappNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              {renderGroupLabel("Pengaturan")}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{renderNavItems(features.subscriptionEnabled ? settingsNavSubscription : settingsNavAllFeatures)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="mb-2 mx-2 h-px bg-gradient-to-r from-transparent via-sidebar-border/60 to-transparent" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl px-3 py-2.5 transition-all duration-200"
              onClick={handleLogout}
            >
              <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-[15px] w-[15px] shrink-0" />
              </div>
              <span className="text-[13px] font-medium">Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
