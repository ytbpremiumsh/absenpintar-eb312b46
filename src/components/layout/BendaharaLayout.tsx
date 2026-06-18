import { Suspense } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BendaharaSidebar } from "./BendaharaSidebar";
import { BendaharaFloatingNav } from "./BendaharaFloatingNav";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut, School, Landmark, Repeat } from "lucide-react";
import { getAvailableDashboards } from "@/lib/dashboards";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import atskollaLogo from "@/assets/Logo_atskolla.png";

export function BendaharaLayout() {
  const { user, profile, roles, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [school, setSchool] = useState<{ name?: string; npsn?: string; address?: string; city?: string; province?: string } | null>(null);
  const [openProfile, setOpenProfile] = useState(false);
  const [openSchool, setOpenSchool] = useState(false);
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("schools").select("name, npsn, address, city, province").eq("id", profile.school_id).maybeSingle()
      .then(({ data }) => { if (data) setSchool(data); });
  }, [profile?.school_id]);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").eq("key", "login_logo_url").maybeSingle().then(({ data }) => {
      if (data?.value) setHeaderLogo(data.value as string);
    });
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes("bendahara") && !roles.includes("school_admin") && !roles.includes("super_admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "B";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <BendaharaSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-30 px-3 gap-2">
            <SidebarTrigger />
            {/* Logo + nama sekolah */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-sm shrink-0">
                <img src={headerLogo || atskollaLogo} alt="Logo" className="h-5 w-5 object-contain" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-xs sm:text-sm font-bold tracking-tight truncate max-w-[160px] sm:max-w-[260px]">
                  {school?.name || "ATSkolla"}
                </span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 font-medium truncate">
                  Bendahara<span className="hidden sm:inline"> · Sistem Keuangan</span>
                </span>
              </div>
            </div>
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl hover:bg-secondary/80 transition p-1.5 pr-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-[#5B6CF9]/20">
                    <AvatarFallback className="bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <Settings className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl shadow-elevated border-border/50">
                <DropdownMenuLabel className="font-normal px-4 py-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{profile?.full_name || "Bendahara"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setOpenProfile(true)} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <Settings className="h-4 w-4 mr-2.5 text-muted-foreground" /> Profil Bendahara
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOpenSchool(true)} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <School className="h-4 w-4 mr-2.5 text-muted-foreground" /> Identitas Sekolah
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/bendahara/pencairan?manage=bank")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <Landmark className="h-4 w-4 mr-2.5 text-muted-foreground" /> Rekening Pencairan
                </DropdownMenuItem>
                {getAvailableDashboards(roles).length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/select-role")} className="rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                      <Repeat className="h-4 w-4 mr-2.5 text-muted-foreground" /> Switch Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive rounded-xl mx-1 px-3 py-2.5 cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2.5" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 md:p-6 w-full pb-28 md:pb-6">
            <Suspense fallback={<div className="h-32" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* Mobile floating nav — visible on every bendahara page */}
        <BendaharaFloatingNav />
      </div>

      {/* Profil Bendahara — Read Only */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Profil Bendahara</DialogTitle>
            <DialogDescription>Identitas akun bendahara (read only). Untuk mengubah, hubungi Admin Sekolah.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs text-muted-foreground">Nama Lengkap</Label><Input readOnly value={profile?.full_name || "-"} className="bg-muted/40" /></div>
            <div><Label className="text-xs text-muted-foreground">Email</Label><Input readOnly value={user.email || "-"} className="bg-muted/40" /></div>
            <div><Label className="text-xs text-muted-foreground">No. HP</Label><Input readOnly value={(profile as any)?.phone || "-"} className="bg-muted/40" /></div>
            <div><Label className="text-xs text-muted-foreground">Peran</Label><Input readOnly value={roles.join(", ") || "bendahara"} className="bg-muted/40" /></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Identitas Sekolah — Read Only */}
      <Dialog open={openSchool} onOpenChange={setOpenSchool}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Identitas Sekolah</DialogTitle>
            <DialogDescription>Data sekolah (read only).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs text-muted-foreground">Nama Sekolah</Label><Input readOnly value={school?.name || "-"} className="bg-muted/40" /></div>
            <div><Label className="text-xs text-muted-foreground">NPSN</Label><Input readOnly value={school?.npsn || "-"} className="bg-muted/40" /></div>
            <div><Label className="text-xs text-muted-foreground">Alamat</Label><Input readOnly value={school?.address || "-"} className="bg-muted/40" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Kota</Label><Input readOnly value={school?.city || "-"} className="bg-muted/40" /></div>
              <div><Label className="text-xs text-muted-foreground">Provinsi</Label><Input readOnly value={school?.province || "-"} className="bg-muted/40" /></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
