import { useState } from "react";
import { Bell, ArrowRight, ClipboardList, School as SchoolIcon, BookOpen, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePrincipalData } from "@/hooks/usePrincipalData";

const ROUTE_MAP: Record<string, { path: string; icon: any }> = {
  approvals: { path: "/kepsek/agenda", icon: ClipboardList },
  attclass: { path: "/kepsek/pembelajaran", icon: SchoolIcon },
  jurnal: { path: "/kepsek/pembelajaran", icon: BookOpen },
  spp: { path: "/kepsek/keuangan", icon: Wallet },
};

const TONE_DOT: Record<string, string> = {
  warning: "bg-amber-500",
  info: "bg-sky-500",
  success: "bg-emerald-500",
};

export function PrincipalNotificationBell() {
  const { notifs } = usePrincipalData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const count = notifs.length;

  const go = (key: string) => {
    const target = ROUTE_MAP[key];
    if (!target) return;
    setOpen(false);
    navigate(target.path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Notifikasi Penting">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifikasi Penting
          </h3>
          <span className="text-[10px] text-muted-foreground">{count} item</span>
        </div>
        <ScrollArea className="max-h-96">
          {count === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Tidak ada notifikasi mendesak</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifs.map((n: any) => {
                const target = ROUTE_MAP[n.key];
                const Icon = target?.icon;
                return (
                  <button
                    key={n.key}
                    onClick={() => go(n.key)}
                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${TONE_DOT[n.tone] || "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      {target && (
                        <p className="text-[11px] text-primary flex items-center gap-1 mt-0.5">
                          {Icon && <Icon className="h-3 w-3" />} Buka halaman
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
