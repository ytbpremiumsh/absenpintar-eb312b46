import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet, Users, GraduationCap, Wallet, BookOpen,
  Receipt, Landmark, ArrowRight, ClipboardList,
} from "lucide-react";

const reports = [
  { label: "Rekap Absensi Siswa", desc: "Per siswa & per kelas, dengan detail terlambat", icon: Users, path: "/kepsek/laporan/absensi-siswa", tone: "primary" },
  { label: "Rekap Absensi Guru", desc: "Detail hadir/belum hari ini + rekap periode", icon: GraduationCap, path: "/kepsek/laporan/absensi-guru", tone: "violet" },
  { label: "Rekap SPP", desc: "Semua invoice, kanal bayar, biaya gateway", icon: Receipt, path: "/kepsek/laporan/spp", tone: "emerald" },
  { label: "Rekap Tunggakan", desc: "Siswa menunggak + hari menunggak & kontak", icon: Wallet, path: "/kepsek/laporan/tunggakan", tone: "rose" },
  { label: "Buku Kas Sekolah", desc: "Saldo awal, mutasi, saldo berjalan, grafik", icon: BookOpen, path: "/kepsek/laporan/buku-kas", tone: "sky" },
  { label: "Settlement / Pencairan", desc: "Riwayat pencairan dana SPP", icon: Landmark, path: "/kepsek/laporan/settlement", tone: "amber" },
  { label: "Jurnal Mengajar", desc: "Sesi mengajar guru & kehadiran per sesi", icon: ClipboardList, path: "/kepsek/laporan/jurnal", tone: "indigo" },
];

const tones: Record<string, string> = {
  primary: "from-primary/15 to-primary/5 text-primary",
  violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
  indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600",
};

export default function PrincipalLaporan() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Sekolah"
        subtitle="Pilih jenis laporan — setiap laporan tampil di halaman detailnya sendiri"
        icon={FileSpreadsheet}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => (
          <button
            key={r.path}
            onClick={() => navigate(r.path)}
            className={`text-left p-5 rounded-2xl border border-border/50 bg-gradient-to-br ${tones[r.tone]} hover:shadow-lg transition-all group`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-11 w-11 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shadow-sm">
                <r.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-3" />
            </div>
            <div className="text-sm font-bold text-foreground">{r.label}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">{r.desc}</div>
          </button>
        ))}
      </div>

      <Card className="rounded-2xl bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Semua laporan menampilkan data langsung dari sistem sekolah aktif, dengan filter tanggal & unduh CSV di masing-masing halaman.
        </CardContent>
      </Card>
    </div>
  );
}
