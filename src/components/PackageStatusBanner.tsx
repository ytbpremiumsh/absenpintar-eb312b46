import { AlertTriangle, CreditCard, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePackageStatus } from "@/hooks/usePackageStatus";

export function PackageStatusBanner() {
  const navigate = useNavigate();
  const pkg = usePackageStatus();

  if (pkg.loading) return null;
  if (pkg.packageStatus !== "pending_activation" || pkg.packageType !== "payment") return null;

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-amber-950/30 dark:border-amber-800/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
            Status Paket: Menunggu Aktivasi
          </div>
          <p className="text-[12.5px] text-amber-800/90 dark:text-amber-200/80 mt-1 leading-relaxed">
            Paket <b>ATSkolla Payment (Gratis)</b> mengharuskan penggunaan modul Pembayaran Online ATSkolla.
            Fitur absensi (Scan QR, Face Recognition, RFID) dinonaktifkan sementara sampai aktivitas pembayaran kembali digunakan,
            atau Anda beralih ke Paket Mandiri.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => navigate("/bendahara")}>
              <CreditCard className="h-3.5 w-3.5" />
              Aktifkan Pembayaran ATSkolla
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/paket-sekolah")}>
              <Package className="h-3.5 w-3.5" />
              Beralih ke Paket Mandiri
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
