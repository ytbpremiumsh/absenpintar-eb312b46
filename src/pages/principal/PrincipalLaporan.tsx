import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet, Users, GraduationCap, Wallet, BookOpen,
  Receipt, Landmark, ClipboardList, DollarSign, TrendingDown,
} from "lucide-react";
import LaporanAbsensiSiswa from "./reports/LaporanAbsensiSiswa";
import LaporanAbsensiGuru from "./reports/LaporanAbsensiGuru";
import LaporanSPP from "./reports/LaporanSPP";
import LaporanTunggakan from "./reports/LaporanTunggakan";
import LaporanBukuKas from "./reports/LaporanBukuKas";
import LaporanSettlement from "./reports/LaporanSettlement";
import LaporanJurnal from "./reports/LaporanJurnal";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { fmtIDR } from "./_shared";

const tabs = [
  { key: "absensi-siswa", label: "Absensi Siswa", icon: Users, C: LaporanAbsensiSiswa },
  { key: "absensi-guru", label: "Absensi Guru", icon: GraduationCap, C: LaporanAbsensiGuru },
  { key: "spp", label: "SPP", icon: Receipt, C: LaporanSPP },
  { key: "tunggakan", label: "Tunggakan", icon: Wallet, C: LaporanTunggakan },
  { key: "buku-kas", label: "Buku Kas", icon: BookOpen, C: LaporanBukuKas },
  { key: "settlement", label: "Settlement", icon: Landmark, C: LaporanSettlement },
  { key: "jurnal", label: "Jurnal Mengajar", icon: ClipboardList, C: LaporanJurnal },
];

function OverviewStat({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: any; sub?: string;
  tone: "primary" | "emerald" | "sky" | "amber" | "rose";
}) {
  const tones = {
    primary: { icon: "bg-[#5B6CF9]/15 text-[#5B6CF9]", value: "text-[#5B6CF9]", bg: "bg-gradient-to-br from-[#5B6CF9]/10 to-transparent" },
    emerald: { icon: "bg-emerald-500/15 text-emerald-600", value: "text-emerald-600", bg: "" },
    sky: { icon: "bg-sky-500/15 text-sky-600", value: "text-sky-600", bg: "" },
    amber: { icon: "bg-amber-500/15 text-amber-600", value: "text-amber-600", bg: "" },
    rose: { icon: "bg-rose-500/15 text-rose-600", value: "text-rose-600", bg: "" },
  }[tone];
  return (
    <Card className={`border-0 shadow-sm overflow-hidden ${tones.bg}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${tones.icon}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{label}</p>
        </div>
        <div className="min-w-0">
          <p className={`text-base sm:text-lg font-extrabold ${tones.value} break-words leading-tight`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrincipalLaporan() {
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "absensi-siswa";
  const { finance, settlements } = usePrincipalData();

  const pendingSettleCount = settlements.filter((s: any) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan Sekolah"
        subtitle="Ringkasan keuangan & seluruh laporan sekolah dalam satu tempat"
        icon={FileSpreadsheet}
        variant="primary"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewStat icon={DollarSign} label="Total Pembayaran" value={fmtIDR(finance.totalPembayaran)} sub="SPP terbayar" tone="emerald" />
        <OverviewStat icon={TrendingDown} label="Tunggakan" value={fmtIDR(finance.tunggakan)} sub="belum terbayar" tone="rose" />
        <OverviewStat icon={Wallet} label="Saldo Buku Kas" value={fmtIDR(finance.saldoKas)} sub="saldo berjalan" tone="primary" />
        <OverviewStat icon={Landmark} label="Settlement" value={settlements.length} sub={`${pendingSettleCount} pending`} tone="amber" />
      </div>

      <Tabs value={active} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="w-full flex-wrap h-auto justify-start gap-1 bg-muted/50 p-1 rounded-2xl">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs"
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {active === t.key && <t.C />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
