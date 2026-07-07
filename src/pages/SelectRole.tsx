import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Check,
  Crown,
  LayoutDashboard,
  Shield,
  GraduationCap,
  Wallet,
  School as SchoolIcon,
} from "lucide-react";
import { getAvailableDashboards } from "@/lib/dashboards";
import atskollaLogo from "@/assets/Logo_atskolla.png";

// Outline icon override for the picker (separate from sidebar icons)
const OUTLINE_ICONS: Record<string, any> = {
  super_admin: Crown,
  school_admin: LayoutDashboard,
  staff: Shield,
  teacher: GraduationCap,
  bendahara: Wallet,
};

export default function SelectRole() {
  const { roles, profile, user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [school, setSchool] = useState<{ name: string; logo: string | null } | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("schools").select("name, logo").eq("id", profile.school_id).single().then(({ data }) => {
      if (data) setSchool({ name: data.name, logo: data.logo });
    });
  }, [profile?.school_id]);

  const dashboards = useMemo(() => getAvailableDashboards(roles), [roles]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (dashboards.length === 0) { navigate("/dashboard", { replace: true }); return; }
    if (dashboards.length === 1) { navigate(dashboards[0].path, { replace: true }); return; }
    if (!selected) setSelected(dashboards[0].key);
  }, [loading, user, dashboards, navigate, selected]);

  const handleContinue = () => {
    const d = dashboards.find((x) => x.key === selected);
    if (!d) return;
    sessionStorage.setItem("dashboard_chosen", "1");
    sessionStorage.setItem("active_dashboard", d.key);
    navigate(d.path, { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading || dashboards.length <= 1) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-background rounded-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/40">
        <div className="px-6 sm:px-12 py-10 sm:py-14">
          {/* Header / Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 flex items-center justify-center mb-3">
              {school?.logo ? (
                <img src={school.logo} alt={school.name} className="h-14 w-14 object-contain" />
              ) : (
                <SchoolIcon className="h-10 w-10 text-[#5B6CF9]" strokeWidth={1.5} />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-wide text-[#5B6CF9]">
              Pilih Dashboard
            </h1>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Halo, <span className="font-medium text-foreground">{profile?.full_name || "User"}</span> — pilih dashboard yang ingin Anda buka.
            </p>
          </div>

          {/* Cards centered */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
            {dashboards.map((d, i) => {
              const Icon = OUTLINE_ICONS[d.key] ?? d.icon;
              const isSelected = selected === d.key;
              return (
                <motion.button
                  key={d.key}
                  type="button"
                  onClick={() => setSelected(d.key)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col items-center group focus:outline-none"
                >
                  <div
                    className={`relative h-24 w-24 sm:h-28 sm:w-28 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? "border-2 border-[#5B6CF9] bg-[#5B6CF9]/[0.04] shadow-md shadow-[#5B6CF9]/20"
                        : "border border-slate-200 dark:border-slate-800 group-hover:border-[#5B6CF9]/50"
                    }`}
                  >
                    <Icon
                      className={`h-11 w-11 sm:h-12 sm:w-12 transition-colors ${
                        isSelected ? "text-[#5B6CF9]" : "text-slate-300 dark:text-slate-600 group-hover:text-[#5B6CF9]/60"
                      }`}
                      strokeWidth={1.5}
                    />
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-md bg-[#5B6CF9] text-white flex items-center justify-center shadow-md"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                  <span
                    className={`mt-3 text-sm font-medium transition-colors ${
                      isSelected ? "text-[#5B6CF9]" : "text-slate-400 group-hover:text-[#5B6CF9]/80"
                    }`}
                  >
                    {d.label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Continue button */}
          <div className="flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={!selected}
              className="h-12 px-10 rounded-md text-sm font-medium bg-[#5B6CF9] hover:bg-[#4c5ded] text-white shadow-lg shadow-[#5B6CF9]/30"
            >
              Lanjutkan
            </Button>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B6CF9]" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          </div>

          {/* Sign out */}
          <div className="text-center mt-6">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
