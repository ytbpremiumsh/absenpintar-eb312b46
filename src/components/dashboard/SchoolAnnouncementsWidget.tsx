import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Megaphone, Pin, AlertTriangle, Info, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/RichContent";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  is_pinned: boolean;
  created_at: string;
  created_by: string | null;
}

const TYPE_STYLES: Record<string, { icon: any; badge: string; bar: string; iconBg: string; label: string }> = {
  info: {
    icon: Info,
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    bar: "bg-gradient-to-b from-sky-500 to-sky-400",
    iconBg: "bg-gradient-to-br from-sky-500 to-sky-600",
    label: "Informasi",
  },
  penting: {
    icon: Sparkles,
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    bar: "bg-gradient-to-b from-violet-500 to-violet-400",
    iconBg: "bg-gradient-to-br from-violet-500 to-violet-600",
    label: "Penting",
  },
  urgent: {
    icon: AlertTriangle,
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    bar: "bg-gradient-to-b from-red-500 to-orange-400",
    iconBg: "bg-gradient-to-br from-red-500 to-orange-500",
    label: "Mendesak",
  },
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  schoolId: string;
  isAdmin?: boolean;
}

export function SchoolAnnouncementsWidget({ schoolId, isAdmin = false }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    let mounted = true;
    const fetchData = async () => {
      const { data } = await supabase
        .from("school_announcements")
        .select("*")
        .eq("school_id", schoolId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (mounted) {
        setItems(data || []);
        setLoading(false);
      }
    };
    fetchData();

    const channel = supabase
      .channel(`school-announcements-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "school_announcements", filter: `school_id=eq.${schoolId}` }, fetchData)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [schoolId]);

  return (
    <>
      <div className="relative rounded-3xl overflow-hidden shadow-elevated bg-card border border-border/40">
        {/* Gradient hero header */}
        <div className="relative bg-gradient-to-br from-[#5B6CF9] via-[#5B6CF9] to-[#4c5ded] px-5 pt-5 pb-14 overflow-hidden">
          <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
          <svg className="absolute top-0 right-0 opacity-10" width="140" height="140" viewBox="0 0 140 140" fill="none">
            <pattern id="ann-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="white" />
            </pattern>
            <rect width="140" height="140" fill="url(#ann-dots)" />
          </svg>

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-lg"
              >
                <Megaphone className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Update Terbaru</p>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">Pengumuman Sekolah</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {items.length > 0 && (
                <span className="bg-white text-primary text-[11px] font-bold rounded-full h-6 min-w-6 px-2 flex items-center justify-center shadow-md">
                  {items.length}
                </span>
              )}
              {isAdmin && (
                <button
                  onClick={() => navigate("/announcements")}
                  className="h-7 px-2.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-[11px] font-semibold flex items-center gap-0.5 transition-all"
                >
                  Kelola <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Floating content overlap */}
        <div className="relative -mt-8 mx-3 mb-3 bg-card rounded-2xl shadow-card border border-border/30 p-2.5 min-h-[100px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-2">
                <Megaphone className="h-6 w-6 text-primary/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">Belum ada pengumuman</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pengumuman akan muncul di sini</p>
              {isAdmin && (
                <Button size="sm" variant="outline" className="mt-3 text-xs h-8 rounded-xl" onClick={() => navigate("/announcements")}>
                  Buat Pengumuman
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((a, i) => {
                const cfg = TYPE_STYLES[a.type] || TYPE_STYLES.info;
                const Icon = cfg.icon;
                return (
                  <motion.button
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 22 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setSelected(a)}
                    className={cn(
                      "w-full text-left relative overflow-hidden rounded-2xl border transition-all group",
                      "bg-gradient-to-br from-background via-background to-muted/30",
                      "hover:shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.25)]",
                      a.is_pinned
                        ? "border-amber-400/50 ring-1 ring-amber-400/20"
                        : "border-border/50 hover:border-primary/40"
                    )}
                  >
                    {/* Ambient accent glow */}
                    <div className={cn(
                      "absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity",
                      cfg.bar.includes("sky") && "bg-sky-500/30",
                      cfg.bar.includes("violet") && "bg-violet-500/30",
                      cfg.bar.includes("red") && "bg-red-500/30",
                    )} />

                    <div className="relative flex items-center gap-3 p-3">
                      {/* Compact rounded icon tile */}
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                        cfg.iconBg
                      )}>
                        <Icon className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {a.is_pinned && (
                            <Pin className="h-3 w-3 text-amber-500 shrink-0" fill="currentColor" />
                          )}
                          <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {a.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                          <span className={cn(
                            "inline-flex items-center h-4 px-1.5 rounded-md font-semibold border",
                            cfg.badge
                          )}>
                            {cfg.label}
                          </span>
                          <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
                          <span className="font-medium">{formatRelative(a.created_at)}</span>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
          {selected && (() => {
            const cfg = TYPE_STYLES[selected.type] || TYPE_STYLES.info;
            const Icon = cfg.icon;
            const heroGradient =
              selected.type === "urgent"
                ? "from-red-500 via-orange-500 to-amber-500"
                : selected.type === "penting"
                ? "from-violet-600 via-violet-500 to-fuchsia-500"
                : "from-sky-500 via-[#5B6CF9] to-[#4c5ded]";
            const fullDate = new Date(selected.created_at).toLocaleDateString("id-ID", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
            const fullTime = new Date(selected.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit", minute: "2-digit",
            });
            return (
              <>
                <div className={cn("relative overflow-hidden bg-gradient-to-br text-white px-5 pt-5 pb-6", heroGradient)}>
                  <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
                  <div className="absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                  <svg className="absolute top-0 right-0 opacity-15" width="160" height="160" viewBox="0 0 160 160" fill="none">
                    <pattern id="ann-hero-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1.4" fill="white" />
                    </pattern>
                    <rect width="160" height="160" fill="url(#ann-hero-dots)" />
                  </svg>
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {selected.is_pinned && (
                        <Badge className="bg-amber-400 text-amber-950 border-0 text-[10px] h-5 px-2 gap-0.5 font-bold shadow">
                          <Pin className="h-2.5 w-2.5" /> Disematkan
                        </Badge>
                      )}
                      <Badge className="bg-white/25 backdrop-blur-sm text-white border border-white/30 text-[10px] h-5 px-2 font-semibold">
                        {cfg.label}
                      </Badge>
                      <span className="text-[10px] text-white/80 font-medium ml-auto">{formatRelative(selected.created_at)}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0 shadow-lg">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <DialogTitle className="text-lg sm:text-xl font-bold leading-tight text-white">
                          {selected.title}
                        </DialogTitle>
                        <DialogDescription className="text-[11px] sm:text-xs text-white/85 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1"><Megaphone className="h-3 w-3" /> Pengumuman Sekolah</span>
                          <span className="text-white/50">•</span>
                          <span>{fullDate}</span>
                          <span className="text-white/50">•</span>
                          <span>{fullTime} WIB</span>
                        </DialogDescription>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-card">
                  <ScrollArea className="max-h-[60vh]">
                    <div className="px-5 sm:px-6 py-5">
                      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:p-5">
                        <RichContent
                          html={selected.message}
                          className="prose prose-sm dark:prose-invert max-w-none [&_p]:leading-relaxed [&_p]:text-[14px] [&_strong]:text-foreground [&_li]:my-1"
                        />
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 border border-border/40">
                        <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>Mohon dibaca dengan saksama. Hubungi admin sekolah untuk informasi lebih lanjut.</span>
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="px-5 sm:px-6 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">Diterbitkan {formatRelative(selected.created_at)}</span>
                    <Button size="sm" onClick={() => setSelected(null)} className="h-8 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90">
                      Saya Mengerti
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
