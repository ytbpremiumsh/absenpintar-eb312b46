import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Activity,
  CalendarDays, FileSpreadsheet, LogOut, ChevronRight, Crown,
  Users, GraduationCap, ClipboardList, Receipt, Wallet, BookOpen, Landmark,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import atskollaLogo from "@/assets/Logo_atskolla.png";

const groups: { label: string; items: { title: string; url: string; icon: any; end?: boolean }[] }[] = [
  {
    label: "Ringkasan",
    items: [{ title: "Dashboard", url: "/kepsek", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Operasional",
    items: [
      { title: "Monitoring", url: "/kepsek/monitoring", icon: Activity },
      { title: "Kalender & Aktivitas", url: "/kepsek/agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Laporan Akademik",
    items: [
      { title: "Ringkasan Laporan", url: "/kepsek/laporan", icon: FileSpreadsheet, end: true },
      { title: "Absensi Siswa", url: "/kepsek/laporan/absensi-siswa", icon: Users },
      { title: "Absensi Guru", url: "/kepsek/laporan/absensi-guru", icon: GraduationCap },
      { title: "Jurnal Mengajar", url: "/kepsek/laporan/jurnal", icon: ClipboardList },
    ],
  },
  {
    label: "Laporan Keuangan",
    items: [
      { title: "Pembayaran SPP", url: "/kepsek/laporan/spp", icon: Receipt },
      { title: "Tunggakan", url: "/kepsek/laporan/tunggakan", icon: Wallet },
      { title: "Buku Kas", url: "/kepsek/laporan/buku-kas", icon: BookOpen },
      { title: "Settlement", url: "/kepsek/laporan/settlement", icon: Landmark },
    ],
  },
];

export function PrincipalSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [school, setSchool] = useState<{ name: string; logo: string | null } | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("schools").select("name, logo").eq("id", profile.school_id).maybeSingle().then(({ data }) => {
      if (data) setSchool(data as any);
    });
  }, [profile?.school_id]);

  const isActive = (url: string, end?: boolean) => end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border/30 font-['Inter',sans-serif]">
      <SidebarHeader className="p-3 pb-2">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-[#5B6CF9] to-blue-600 p-3 shadow-lg shadow-indigo-500/20">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={school?.logo || atskollaLogo} alt="logo" className="h-8 w-8 object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-extrabold text-white tracking-tight truncate leading-tight">
                {school?.name || "ATSkolla"}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/95 bg-white/20 backdrop-blur-sm px-1.5 py-[1px] rounded-md border border-white/15">
                  <Crown className="h-2.5 w-2.5" /> Kepala Sekolah
                </span>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 overflow-y-auto">
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 mb-1.5 text-muted-foreground/60">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {g.items.map((it) => {
                  const active = isActive(it.url, it.end);
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink
                          to={it.url}
                          end={it.end}
                          onClick={() => isMobile && setOpenMobile(false)}
                          className={`relative rounded-xl px-3 py-2.5 transition-all duration-200 gap-3 ${
                            active
                              ? "bg-gradient-to-r from-indigo-600 to-[#5B6CF9] text-white font-semibold shadow-lg shadow-indigo-500/25"
                              : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300"
                          }`}
                        >
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-white/20" : "bg-muted/80"}`}>
                            <it.icon className={`h-[15px] w-[15px] ${active ? "text-white" : ""}`} />
                          </div>
                          <span className={`text-[13px] truncate flex-1 ${active ? "text-white" : ""}`}>{it.title}</span>
                          {active && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70 text-white" />}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="mb-2 mx-2 h-px bg-gradient-to-r from-transparent via-sidebar-border/60 to-transparent" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl px-3 py-2.5"
              onClick={async () => { await signOut(); navigate("/admin"); }}
            >
              <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-[15px] w-[15px]" />
              </div>
              <span className="text-[13px] font-medium">Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
