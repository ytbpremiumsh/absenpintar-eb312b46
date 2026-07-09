import { Lock, CreditCard, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePackageStatus } from "@/hooks/usePackageStatus";

interface Props {
  feature: string;
  children: React.ReactNode;
  label?: string;
}

export function PackageFeatureBlock({ feature, children, label }: Props) {
  const navigate = useNavigate();
  const pkg = usePackageStatus();

  if (pkg.loading) return <>{children}</>;
  if (!pkg.isFeatureBlocked(feature)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl my-8 rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-50 via-white to-orange-50/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-orange-950/20 p-8 text-center shadow-lg">
      <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-4">
        <Lock className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Fitur {label || feature} Dinonaktifkan Sementara</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Sekolah Anda menggunakan <b>Paket ATSkolla Payment (Gratis)</b> namun tidak ada aktivitas Pembayaran Online ATSkolla
        selama lebih dari <b>{pkg.gracePeriodDays} hari</b>. Aktifkan kembali modul pembayaran, atau beralih ke Paket Mandiri untuk
        mengaktifkan seluruh fitur absensi.
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-5">
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => navigate("/bendahara")}>
          <CreditCard className="h-4 w-4" />
          Aktifkan Pembayaran
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => navigate("/paket-sekolah")}>
          <Package className="h-4 w-4" />
          Lihat Paket Sekolah
        </Button>
      </div>
    </div>
  );
}
