import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  ScanLine, Users, ClipboardCheck, MessageCircle, ScanFace, BarChart3, Calendar,
  CreditCard, Building2, Shield, Sparkles, FileSpreadsheet, Camera, Palette,
  Wallet, UserCheck, Bell, MapPin, Bot,
} from "lucide-react";

const FEATURES: Array<{ icon: any; title: string; desc: string; group: string }> = [
  { icon: ScanLine, title: "Absensi Barcode / QR", desc: "Scan cepat via kartu siswa atau QR code", group: "Absensi" },
  { icon: ScanFace, title: "Face Recognition", desc: "Absen otomatis dengan pengenalan wajah", group: "Absensi" },
  { icon: ClipboardCheck, title: "Absensi Guru & Staff", desc: "Log kehadiran guru harian & rekap", group: "Absensi" },
  { icon: Users, title: "Manajemen Siswa Unlimited", desc: "Tanpa batas kelas & siswa", group: "Manajemen" },
  { icon: UserCheck, title: "Multi Staff & Wali Kelas", desc: "Akses berjenjang untuk seluruh tim sekolah", group: "Manajemen" },
  { icon: Building2, title: "Multi Cabang", desc: "Kelola beberapa sekolah dalam satu akun", group: "Manajemen" },
  { icon: MessageCircle, title: "Notifikasi WhatsApp Otomatis", desc: "Info kehadiran & tagihan ke wali murid", group: "Komunikasi" },
  { icon: Bell, title: "Pengumuman Sekolah", desc: "Broadcast ke wali murid dalam satu klik", group: "Komunikasi" },
  { icon: Bot, title: "Portal Wali Murid", desc: "Login via WA atau Kode Kartu, riwayat lengkap", group: "Komunikasi" },
  { icon: BarChart3, title: "Analitik & Laporan", desc: "Rekap harian/bulanan, export Excel & PDF", group: "Laporan" },
  { icon: FileSpreadsheet, title: "Import / Export Data", desc: "Backup & migrasi data siswa cepat", group: "Laporan" },
  { icon: Calendar, title: "Jadwal Pelajaran", desc: "Sinkron jadwal mengajar & absensi mapel", group: "Laporan" },
  { icon: Wallet, title: "Manajemen Keuangan SPP", desc: "Tagihan otomatis, pembayaran online", group: "Keuangan" },
  { icon: CreditCard, title: "Payment Gateway", desc: "Terima pembayaran QRIS/VA/e-wallet", group: "Keuangan" },
  { icon: Palette, title: "Custom Logo & Branding", desc: "Tampil dengan identitas sekolah sendiri", group: "Branding" },
  { icon: Camera, title: "Upload Foto Siswa", desc: "Foto profil siswa untuk identifikasi", group: "Branding" },
  { icon: MapPin, title: "Monitoring Realtime", desc: "Pantau kehadiran langsung di layar", group: "Monitoring" },
  { icon: Shield, title: "Keamanan Data", desc: "Enkripsi & backup harian otomatis", group: "Keamanan" },
];

export default function AllFeatures() {
  const groups = Array.from(new Set(FEATURES.map((f) => f.group)));
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Semua Fitur Aktif"
        subtitle="Seluruh fitur ATSkolla tersedia untuk sekolah Anda tanpa batasan."
      />

      <Card className="border-0 bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white shadow-lg">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-lg">Akses Penuh Aktif</p>
            <p className="text-white/80 text-sm">Nikmati semua fitur premium tanpa pembatasan paket.</p>
          </div>
        </CardContent>
      </Card>

      {groups.map((g) => (
        <div key={g} className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">{g}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.filter((f) => f.group === g).map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{f.desc}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">Aktif</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
