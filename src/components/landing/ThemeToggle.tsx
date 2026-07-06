import { Sun, Moon } from "lucide-react";
import type { LandingTheme } from "@/hooks/useLandingTheme";

interface Props {
  theme: LandingTheme;
  onToggle: () => void;
  className?: string;
}

export default function ThemeToggle({ theme, onToggle, className = "" }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-[#0b1020] hover:border-[#5B6CF9]/40 hover:text-[#5B6CF9] transition-all ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
