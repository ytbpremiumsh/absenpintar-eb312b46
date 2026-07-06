import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, CreditCard, Wallet, BarChart3, LayoutGrid,
  Users, Receipt, FileText, Upload, ArrowDownToLine, Tag, BookOpen, AlertTriangle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Floating bottom navigation for the entire Bendahara role.
 * Mounted in BendaharaLayout so it appears on every bendahara page on mobile.
 */
export function BendaharaFloatingNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (url: string, exact = false) =>
    exact ? pathname === url : pathname.startsWith(url);

  return (
    <nav className="md:hidden fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto relative flex items-center gap-1 bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-full px-2 py-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] ring-1 ring-border/60 max-w-md w-full">
        <NavBtn icon={Home} label="Beranda" active={isActive("/bendahara", true)} color="#5B6CF9" onClick={() => navigate("/bendahara")} />
        <NavBtn icon={CreditCard} label="Bayar" active={isActive("/bendahara/transaksi")} color="#EC4899" onClick={() => navigate("/bendahara/transaksi")} />

        <Sheet>
          <SheetTrigger asChild>
            <button
              className="relative -mt-8 mx-1 h-14 w-14 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white flex items-center justify-center shadow-[0_12px_28px_-8px_rgba(91,108,249,0.7)] ring-4 ring-background transition-transform active:scale-95 hover:scale-105 shrink-0"
              aria-label="Menu Lainnya"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-8">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-left">Menu Lainnya</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3">
              <SheetItem icon={Users} label="Data Siswa" gradient="from-[#5B6CF9] to-[#4c5ded]" onClick={() => navigate("/bendahara/siswa")} />
              <SheetItem icon={Receipt} label="Tarif SPP" gradient="from-indigo-500 to-violet-600" onClick={() => navigate("/bendahara/tarif")} />
              <SheetItem icon={Tag} label="Jenis Pembayaran" gradient="from-fuchsia-500 to-pink-600" onClick={() => navigate("/bendahara/jenis-pembayaran")} />
              <SheetItem icon={FileText} label="Buat Tagihan" gradient="from-amber-500 to-orange-600" onClick={() => navigate("/bendahara/generate")} />
              <SheetItem icon={AlertTriangle} label="Tunggakan" gradient="from-rose-500 to-red-600" onClick={() => navigate("/bendahara/tunggakan")} />
              <SheetItem icon={BookOpen} label="Buku Kas" gradient="from-emerald-500 to-teal-600" onClick={() => navigate("/bendahara/buku-kas")} />
              <SheetItem icon={Upload} label="Import" gradient="from-violet-500 to-purple-600" onClick={() => navigate("/bendahara/import-export")} />
              <SheetItem icon={Wallet} label="Saldo & Penarikan" gradient="from-sky-500 to-blue-600" onClick={() => navigate("/bendahara/withdraw")} />
              <SheetItem icon={ArrowDownToLine} label="Pencairan" gradient="from-rose-500 to-red-600" onClick={() => navigate("/bendahara/withdraw?tab=pencairan")} />
            </div>
          </SheetContent>
        </Sheet>

        <NavBtn icon={Wallet} label="Saldo" active={isActive("/bendahara/withdraw")} color="#0EA5E9" onClick={() => navigate("/bendahara/withdraw")} />
        <NavBtn icon={BarChart3} label="Sekolah" active={isActive("/bendahara/keuangan-sekolah")} color="#5B6CF9" onClick={() => navigate("/bendahara/keuangan-sekolah")} />
      </div>
    </nav>
  );
}

function NavBtn({ icon: Icon, label, active, color, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-all", active && "scale-105")}>
      <Icon className="h-5 w-5 transition-colors" style={{ color: active ? color : "hsl(var(--muted-foreground))" }} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] font-semibold transition-colors" style={{ color: active ? color : "hsl(var(--muted-foreground))" }}>{label}</span>
    </button>
  );
}

function SheetItem({ icon: Icon, label, gradient, onClick }: { icon: any; label: string; gradient: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card hover:bg-muted/40 border border-border/40 transition-all active:scale-95">
      <div className="relative h-12 w-12 rounded-2xl bg-white dark:bg-card flex items-center justify-center ring-1 ring-border/60 shadow-sm">
        <Icon className="h-5 w-5 text-[#3D4FE0]" strokeWidth={1.75} />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-card" />
      </div>
      <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}
