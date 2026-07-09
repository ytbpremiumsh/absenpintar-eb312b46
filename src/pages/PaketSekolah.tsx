import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePackageStatus } from "@/hooks/usePackageStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { CreditCard, Package, Users, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PaketSekolah() {
  const { profile, user } = useAuth();
  const pkg = usePackageStatus();
  const [studentCount, setStudentCount] = useState(0);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from("students").select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id).then(({ count }) => setStudentCount(count || 0));
  }, [profile?.school_id]);

  const switchTo = async (newType: "payment" | "mandiri") => {
    if (!profile?.school_id) return;
    setSwitching(true);
    const oldType = pkg.packageType;
    const { error } = await supabase.from("schools").update({
      package_type: newType,
      package_status: "active",
      package_status_changed_at: new Date().toISOString(),
      last_payment_activity_at: new Date().toISOString(),
    }).eq("id", profile.school_id);

    if (error) { toast.error("Gagal: " + error.message); setSwitching(false); return; }

    await supabase.from("package_audit_log").insert({
      school_id: profile.school_id,
      action: "package_changed",
      old_value: { package_type: oldType },
      new_value: { package_type: newType },
      reason: "Diubah oleh admin sekolah",
      actor_user_id: user?.id,
    });

    toast.success(`Paket berhasil diubah ke ATSkolla ${newType === "payment" ? "Payment" : "Mandiri"}`);
    pkg.refresh();
    setSwitching(false);
  };

  const monthlyEstimate = studentCount * pkg.mandiriMonthlyRate;
  const daysSincePayment = pkg.lastPaymentActivityAt
    ? Math.floor((Date.now() - new Date(pkg.lastPaymentActivityAt).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Paket Sekolah" subtitle="Pilih model layanan ATSkolla yang sesuai untuk sekolah Anda." icon={Package} />

      <Card className="p-5 rounded-2xl border-border/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Paket Saat Ini</div>
            <div className="text-xl font-bold mt-1">
              ATSkolla {pkg.packageType === "payment" ? "Payment (Gratis)" : "Mandiri"}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={pkg.packageStatus === "active"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-amber-100 text-amber-700 border-amber-200"}>
                {pkg.packageStatus === "active" ? "Aktif" : "Menunggu Aktivasi"}
              </Badge>
              {pkg.packageType === "payment" && daysSincePayment !== null && (
                <span className="text-xs text-muted-foreground">
                  Aktivitas pembayaran terakhir: {daysSincePayment} hari lalu
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Payment */}
        <Card className={`p-6 rounded-2xl border-2 ${pkg.packageType === "payment" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-border/50"}`}>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold">ATSkolla Payment</div>
              <div className="text-xs text-emerald-600 font-semibold">GRATIS</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Seluruh fitur aktif</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Tanpa biaya langganan</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Menggunakan Pembayaran Online ATSkolla (SPP/Tagihan)</li>
            <li className="flex gap-2"><AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Modul pembayaran wajib aktif ({pkg.gracePeriodDays} hari toleransi)</li>
          </ul>
          {pkg.packageType !== "payment" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full mt-4 bg-[#5B6CF9] hover:bg-[#4c5ded]" disabled={switching}>
                  Pilih Paket Ini <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Beralih ke ATSkolla Payment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sekolah wajib menggunakan Pembayaran Online ATSkolla. Jika tidak ada aktivitas pembayaran selama {pkg.gracePeriodDays} hari,
                    status akan berubah menjadi Menunggu Aktivasi dan fitur absensi akan dinonaktifkan sementara.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => switchTo("payment")}>Beralih</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </Card>

        {/* Mandiri */}
        <Card className={`p-6 rounded-2xl border-2 ${pkg.packageType === "mandiri" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-border/50"}`}>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold">ATSkolla Mandiri</div>
              <div className="text-xs text-amber-600 font-semibold">Rp {pkg.mandiriMonthlyRate.toLocaleString("id-ID")} / siswa / bulan</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Seluruh fitur aktif</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Tanpa wajib Payment Gateway ATSkolla</li>
            <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Estimasi biaya bulanan: <b>Rp {monthlyEstimate.toLocaleString("id-ID")}</b> ({studentCount} siswa)</li>
          </ul>
          {pkg.packageType !== "mandiri" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white" disabled={switching}>
                  Pilih Paket Ini <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Beralih ke ATSkolla Mandiri?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sekolah akan dikenakan biaya layanan Rp {pkg.mandiriMonthlyRate.toLocaleString("id-ID")} per siswa per bulan
                    (estimasi Rp {monthlyEstimate.toLocaleString("id-ID")} / bulan untuk {studentCount} siswa). Seluruh fitur tetap aktif tanpa
                    kewajiban menggunakan Pembayaran Online ATSkolla.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => switchTo("mandiri")}>Beralih</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </Card>
      </div>
    </div>
  );
}
