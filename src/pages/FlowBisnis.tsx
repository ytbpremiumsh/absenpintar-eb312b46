import { Link } from "react-router-dom";
import {
  Building2,
  Database,
  LogIn,
  ListChecks,
  Wallet,
  Send,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";

const STEPS = [
  {
    icon: Building2,
    title: "Sekolah Mendaftar",
    desc: "Sekolah melakukan pendaftaran dan membuat akun pada platform ATSkolla.",
  },
  {
    icon: Database,
    title: "Pengelolaan Data Sekolah",
    desc: "Operator sekolah mengelola data siswa, kelas, guru, serta membuat tagihan SPP atau tagihan pendidikan lainnya melalui sistem ATSkolla.",
  },
  {
    icon: LogIn,
    title: "Orang Tua Login",
    desc: "Orang tua atau wali murid masuk ke portal ATSkolla menggunakan akun yang diberikan oleh sekolah.",
  },
  {
    icon: ListChecks,
    title: "Memilih Tagihan",
    desc: "Orang tua melihat daftar tagihan yang harus dibayarkan, seperti:",
    list: ["SPP Bulanan", "Uang Kegiatan", "Uang Seragam", "Tagihan Pendidikan Lainnya"],
  },
  {
    icon: Wallet,
    title: "Memilih Metode Pembayaran",
    desc: "Orang tua memilih metode pembayaran yang tersedia melalui Payment Gateway, seperti:",
    list: ["Virtual Account", "QRIS", "E-Wallet", "Retail Outlet"],
  },
  {
    icon: Send,
    title: "Proses Pembayaran melalui Payment Gateway",
    desc: "ATSkolla mengirimkan data transaksi ke Payment Gateway. Selanjutnya orang tua menyelesaikan pembayaran menggunakan metode yang dipilih.",
  },
  {
    icon: CheckCircle2,
    title: "Konfirmasi Pembayaran",
    desc: "Setelah pembayaran berhasil, Payment Gateway mengirimkan notifikasi (Callback/Webhook) ke ATSkolla. ATSkolla kemudian:",
    list: [
      "Mengubah status tagihan menjadi Lunas.",
      "Mencatat transaksi pada riwayat pembayaran.",
      "Memperbarui laporan keuangan sekolah secara otomatis.",
      "Mengirim bukti pembayaran kepada orang tua.",
    ],
  },
];

export default function FlowBisnis() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-[#5B6CF9]">ATSkolla</Link>
          <span className="text-xs text-slate-500">Halaman Internal</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#5B6CF9]/10 text-[#5B6CF9] text-xs font-semibold mb-4">
            ALUR KERJA SISTEM
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Flow Bisnis ATSkolla
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Alur lengkap proses layanan ATSkolla dari pendaftaran sekolah hingga konfirmasi pembayaran otomatis melalui Payment Gateway.
          </p>
        </div>

        <ol className="space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i}>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-[#5B6CF9] text-white flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-[#5B6CF9]" />
                        <h2 className="font-semibold text-slate-900 text-lg">{s.title}</h2>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
                      {s.list && (
                        <ul className="mt-3 space-y-1.5">
                          {s.list.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5B6CF9] mt-1.5 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <footer className="mt-12 pt-8 border-t text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} ATSkolla &mdash; Dokumen Internal
        </footer>
      </main>
    </div>
  );
}
