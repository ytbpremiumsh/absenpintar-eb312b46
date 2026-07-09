import { Suspense } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PrincipalSidebar } from "./PrincipalSidebar";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrincipalNotificationBell } from "@/components/PrincipalNotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut, KeyRound, Repeat, RefreshCcw, HelpCircle } from "lucide-react";
import { getAvailableDashboards } from "@/lib/dashboards";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import atskollaLogo from "@/assets/Logo_atskolla.png";
import { PrincipalDataProvider, usePrincipalData } from "@/hooks/usePrincipalData";
import { Button } from "@/components/ui/button";
import { SchoolAccessGate } from "@/components/SchoolAccessGate";

function HeaderInner() {
  const { schoolName } = usePrincipalData();
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-xs sm:text-sm font-bold tracking-tight truncate max-w-[160px] sm:max-w-[260px]">
          {schoolName || "ATSkolla"}
        </span>
        <span className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 font-medium truncate">
          Kepala Sekolah<span className="hidden sm:inline"> · Ringkasan Sekolah</span>
        </span>
      </div>
    </div>
  );
}

export function PrincipalLayout() {
  const { user, profile, roles, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").eq("key", "login_logo_url").maybeSingle().then(({ data }) => {
      if (data?.value) setHeaderLogo(data.value as string);
    });
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/admin" replace />;
  if (!roles.includes("principal") && !roles.includes("school_admin") && !roles.includes("super_admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "K";

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin");
  };

  return (
    <PrincipalDataProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <PrincipalSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-30 px-3 gap-2">
              <SidebarTrigger />
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-sm shrink-0">
                <img src={headerLogo || atskollaLogo} alt="Logo" className="h-5 w-5 object-contain" />
              </div>
              <HeaderInner />
              <ThemeToggle />
              <PrincipalNotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl hover:bg-secondary/80 transition p-1.5 pr-2.5">
                    <Avatar className="h-8 w-8 ring-2 ring-indigo-500/20">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-[#5B6CF9] text-white text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <Settings className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-2xl shadow-elevated border-border/50">
                  <DropdownMenuLabel className="font-normal px-4 py-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold">{profile?.full_name || "Kepala Sekolah"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getAvailableDashboards(roles).length > 1 && (
                    <DropdownMenuItem onClick={() => navigate("/select-role")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                      <Repeat className="h-4 w-4 mr-2.5 text-muted-foreground" /> Switch Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/account-settings")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <KeyRound className="h-4 w-4 mr-2.5 text-muted-foreground" /> Ganti Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/support")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <HelpCircle className="h-4 w-4 mr-2.5 text-muted-foreground" /> Hubungi Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2.5" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <main className="no-motion flex-1 p-4 md:p-6 w-full pb-10">
              <Suspense fallback={<div className="h-32" />}>
                <SchoolAccessGate>
                  <Outlet />
                </SchoolAccessGate>
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PrincipalDataProvider>
  );
}
