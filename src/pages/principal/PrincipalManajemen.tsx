import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Wallet, ClipboardList, DollarSign, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
import PrincipalKeuangan from "./PrincipalKeuangan";
import PrincipalPersetujuan from "./PrincipalPersetujuan";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { fmtIDR } from "./_shared";

function OverviewStat({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: any; sub?: string;
  tone: "primary" | "emerald" | "sky" | "amber" | "violet" | "rose";
}) {
  const tones = {
    primary: { icon: "bg-[#5B6CF9]/15 text-[#5B6CF9]", value: "text-[#5B6CF9]", bg: "bg-gradient-to-br from-[#5B6CF9]/10 to-transparent" },
    emerald: { icon: "bg-emerald-500/15 text-emerald-600", value: "text-emerald-600", bg: "" },
    sky: { icon: "bg-sky-500/15 text-sky-600", value: "text-sky-600", bg: "" },
    amber: { icon: "bg-amber-500/15 text-amber-600", value: "text-amber-600", bg: "" },
    violet: { icon: "bg-violet-500/15 text-violet-600", value: "text-violet-600", bg: "" },
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

export default function PrincipalManajemen() {
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "keuangan";
  const { finance, leaves, pendingSettlements, withdrawals } = usePrincipalData();
  const totalApprovals = leaves.length + pendingSettlements.length + withdrawals.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manajemen Sekolah"
        subtitle="Ringkasan keuangan & pusat persetujuan pengajuan"
        icon={Briefcase}
        variant="primary"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewStat icon={DollarSign} label="Pembayaran SPP" value={fmtIDR(finance.totalPembayaran)} sub="total masuk" tone="emerald" />
        <OverviewStat icon={TrendingDown} label="Tunggakan" value={fmtIDR(finance.tunggakan)} sub="belum terbayar" tone="rose" />
        <OverviewStat icon={Wallet} label="Saldo Buku Kas" value={fmtIDR(finance.saldoKas)} sub="saldo berjalan" tone="primary" />
        <OverviewStat icon={ClipboardList} label="Menunggu Persetujuan" value={totalApprovals} sub={`${leaves.length} izin • ${pendingSettlements.length} pencairan`} tone="amber" />
      </div>

      <Tabs value={active} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="bg-muted/50 p-1 rounded-2xl">
          <TabsTrigger value="keuangan" className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Wallet className="h-4 w-4" /> Keuangan
          </TabsTrigger>
          <TabsTrigger value="persetujuan" className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CheckCircle2 className="h-4 w-4" /> Persetujuan
            {totalApprovals > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none">{totalApprovals}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keuangan" className="mt-4">
          {active === "keuangan" && <PrincipalKeuangan />}
        </TabsContent>
        <TabsContent value="persetujuan" className="mt-4">
          {active === "persetujuan" && <PrincipalPersetujuan />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
