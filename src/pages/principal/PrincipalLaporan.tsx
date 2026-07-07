import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet, Users, GraduationCap, Wallet, BookOpen,
  Receipt, Landmark, ClipboardList, DollarSign, TrendingDown, ArrowRight,
} from "lucide-react";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { fmtIDR } from "./_shared";

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

type Report = { label: string; desc: string; icon: any; path: string; tone: string };

const akademik: Report[] = [
  { label: "Absensi Siswa", desc: "Per siswa & per kelas, dengan detail terlambat", icon: Users, path: "/kepsek/laporan/absensi-siswa", tone: "primary" },
  { label: "Absensi Guru", desc: "Detail hadir/belum hari ini + rekap periode", icon: GraduationCap, path: "/kepsek/laporan/absensi-guru", tone: "violet" },
  { label: "Jurnal Mengajar", desc: "Sesi mengajar guru & kehadiran per sesi", icon: ClipboardList, path: "/kepsek/laporan/jurnal", tone: "indigo" },
];

const keuangan: Report[] = [
  { label: "Pembayaran SPP", desc: "Semua invoice, kanal bayar, biaya gateway", icon: Receipt, path: "/kepsek/laporan/spp", tone: "emerald" },
  { label: "Tunggakan", desc: "Siswa menunggak + hari menunggak & kontak", icon: Wallet, path: "/kepsek/laporan/tunggakan", tone: "rose" },
  { label: "Buku Kas", desc: "Saldo awal, mutasi, saldo berjalan, grafik", icon: BookOpen, path: "/kepsek/laporan/buku-kas", tone: "sky" },
  { label: "Settlement", desc: "Riwayat pencairan dana SPP", icon: Landmark, path: "/kepsek/laporan/settlement", tone: "amber" },
];

const tones: Record<string, string> = {
  primary: "from-[#5B6CF9]/15 to-[#5B6CF9]/5 text-[#5B6CF9]",
  violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
  indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600",
};

function ReportGrid({ items }: { items: Report[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((r) => (
        <button
          key={r.path}
          onClick={() => navigate(r.path)}
          className={`text-left p-4 rounded-2xl border border-border/50 bg-gradient-to-br ${tones[r.tone]} hover:shadow-md transition-all group`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shadow-sm">
              <r.icon className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-3" />
          </div>
          <div className="text-sm font-bold text-foreground">{r.label}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-snug">{r.desc}</div>
        </button>
      ))}
    </div>
  );
}

export default function PrincipalLaporan() {
  const { finance, settlements } = usePrincipalData();
  const pendingSettleCount = settlements.filter((s: any) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan Sekolah"
        subtitle="Ringkasan keuangan & seluruh laporan sekolah — pilih laporan dari menu samping atau kartu di bawah"
        icon={FileSpreadsheet}
        variant="primary"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <OverviewStat icon={DollarSign} label="Total Pembayaran" value={fmtIDR(finance.totalPembayaran)} sub="SPP terbayar" tone="emerald" />
        <OverviewStat icon={TrendingDown} label="Tunggakan" value={fmtIDR(finance.tunggakan)} sub="belum terbayar" tone="rose" />
        <OverviewStat icon={Wallet} label="Saldo Buku Kas" value={fmtIDR(finance.saldoKas)} sub="saldo berjalan" tone="primary" />
        <OverviewStat icon={Landmark} label="Settlement" value={settlements.length} sub={`${pendingSettleCount} pending`} tone="amber" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-7 w-7 rounded-lg bg-[#5B6CF9]/15 text-[#5B6CF9] flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-bold">Laporan Akademik</h2>
          <span className="text-[11px] text-muted-foreground">Kehadiran & aktivitas belajar</span>
        </div>
        <ReportGrid items={akademik} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-bold">Laporan Keuangan</h2>
          <span className="text-[11px] text-muted-foreground">SPP, kas & pencairan dana</span>
        </div>
        <ReportGrid items={keuangan} />
      </div>
    </div>
  );
}
