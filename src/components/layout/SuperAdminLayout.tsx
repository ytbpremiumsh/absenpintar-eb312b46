import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, School, Wallet, Receipt, LogOut, Shield, CalendarCheck, Building2, Megaphone, Globe, Presentation, Clock, Gift, Crown, UsersRound, MessageCircle, Eye, Palette, ChevronRight, Handshake, CreditCard, Settings, Database, Package, Server, Banknote, Mail, Wand2, BookOpen, Link2, Activity, Radio } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MobileFooterNav } from "./MobileFooterNav";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { NotificationBell } from "@/components/NotificationBell";

const navItems = [
  // OVERVIEW
  { title: "Dashboard", url: "/super-admin", icon: LayoutGrid, group: "overview" },

  // MANAJEMEN
  { title: "Sekolah & Pengguna", url: "/super-admin/sekolah", icon: School, group: "manage" },
  { title: "Paket Sekolah", url: "/super-admin/paket-sekolah", icon: Wallet, group: "manage" },
  { title: "Add-on", url: "/super-admin/addons", icon: Wallet, group: "manage" },

  // OPERASIONAL
  { title: "Keuangan", url: "/super-admin/keuangan", icon: Banknote, group: "ops" },
  { title: "Komunikasi", url: "/super-admin/komunikasi", icon: MessageCircle, group: "ops" },
  { title: "Email", url: "/super-admin/email-hub", icon: Mail, group: "ops" },

  // KONTEN & MARKETING
  { title: "CMS & Konten Publik", url: "/super-admin/cms", icon: Palette, group: "content" },

  // SISTEM
  { title: "Backup, Server & Perangkat", url: "/super-admin/sistem", icon: Server, group: "system" },
];


const groups = [
  { key: "overview", label: "OVERVIEW" },
  { key: "manage", label: "MANAJEMEN" },
  { key: "ops", label: "OPERASIONAL" },
  { key: "content", label: "KONTEN & MARKETING" },
  { key: "system", label: "SISTEM" },
];

const superAdminFooterItems = [
  { label: "Dashboard", icon: LayoutGrid, path: "/super-admin" },
  { label: "Sekolah", icon: School, path: "/super-admin/sekolah" },
  { label: "Keuangan", icon: Banknote, path: "/super-admin/keuangan", isCenter: true },
  { label: "Komunikasi", icon: MessageCircle, path: "/super-admin/komunikasi" },
  { label: "CMS", icon: Palette, path: "/super-admin/cms" },
];

function SuperAdminSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const isActive = (path: string) => path === "/super-admin" ? location.pathname === "/super-admin" : location.pathname.startsWith(path);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/admin");
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border/30 font-['Inter',sans-serif]">
      <SidebarHeader className="p-3 pb-2">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-3 shadow-lg shadow-red-500/15">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -bottom-3 -left-3 h-12 w-12 rounded-full bg-white/5 blur-lg" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-extrabold text-white tracking-tight truncate leading-tight">Super Admin</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/90 bg-white/20 backdrop-blur-sm px-1.5 py-[1px] rounded-md border border-white/15">
                  <Crown className="h-2.5 w-2.5" />
                  Platform Control
                </span>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 overflow-y-auto overflow-x-hidden">
        {groups.map((group) => {
          const items = navItems.filter((n) => n.group === group.key);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 mb-1.5 text-muted-foreground/60">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <NavLink
                            to={item.url}
                            end={item.url === "/super-admin"}
                            onClick={handleNavClick}
                            className={`relative rounded-xl px-3 py-2.5 transition-all duration-200 group/nav gap-3 ${
                              active
                                ? "bg-gradient-to-r from-red-500/85 to-rose-600 text-white font-semibold shadow-lg shadow-red-500/20"
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
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
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

export function SuperAdminLayout() {
  const { user, roles, loading, profile } = useAuth();
  const isMobileDevice = useIsMobile();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-8 w-32" /></div>;
  if (!user) return <Navigate to="/admin" replace />;
  if (!roles.includes("super_admin")) return <Navigate to="/dashboard" replace />;

  const initials = profile?.full_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "SA";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SuperAdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between glass-subtle border-b border-border/40 px-3 sm:px-5 sticky top-0 z-30">
            <div className="flex items-center gap-2.5">
              <SidebarTrigger className="h-8 w-8 rounded-xl hover:bg-secondary/80 transition-colors" />
              {/* Mobile logo */}
              <div className="sm:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                  <Shield className="h-4 w-4 text-white stroke-[2.5]" />
                </div>
                <span className="text-sm font-bold text-foreground tracking-tight">Super Admin</span>
              </div>
              {/* Desktop */}
              <span className="text-sm font-semibold text-foreground/70 hidden sm:inline">Super Admin Panel</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
              <Avatar className="h-8 w-8 ring-2 ring-destructive/10">
                <AvatarFallback className="bg-gradient-to-br from-red-500 to-rose-600 text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className={cn("no-motion flex-1 p-4 md:p-6 overflow-auto", isMobileDevice && "pb-24")}>
            <Suspense fallback={<div className="h-32" />}>
              <Outlet />
            </Suspense>
          </main>
          {isMobileDevice && (
            <MobileFooterNav
              items={superAdminFooterItems}
              accentColor="from-red-500 to-rose-600"
            />
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
