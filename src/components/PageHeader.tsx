import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  variant?: "primary" | "emerald" | "purple";
}

const VARIANTS: Record<NonNullable<PageHeaderProps["variant"]>, string> = {
  primary: "from-[#5B6CF9] to-[#4c5ded]",
  emerald: "from-emerald-600 to-teal-700",
  purple: "from-[#7c3aed] via-[#6d28d9] to-[#5b21b6]",
};

export const PageHeader = ({ icon: Icon, title, subtitle, actions, variant = "primary" }: PageHeaderProps) => {
  const [showShapes, setShowShapes] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "hero_shadow_shapes_enabled")
        .maybeSingle();
      if (data) {
        setShowShapes(data.value !== "false");
      }
    };
    fetchSetting();
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${VARIANTS[variant]} p-5 sm:p-6 text-white shadow-xl`}>
      {showShapes && (
        <>
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        </>
      )}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 shrink-0 aspect-square rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
            <Icon className="h-6 w-6 text-white shrink-0" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
            <p className="text-white/70 text-xs sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
