import { useMemo, useState } from "react";
import { Search, ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import LegalLayout from "./LegalLayout";
import { cn } from "@/lib/utils";

interface QA {
  q: string;
  a: string;
  category: string;
}

const CATEGORIES = [
  "Semua",
  "Umum",
  "Pembayaran SPP",
  "VA & QRIS",
  "Status Pembayaran",
  "Refund",
  "Akun",
] as const;

const FAQS: QA[] = [
  // Umum
  { category: "Umum", q: "Apa itu ATSkolla?", a: "ATSkolla adalah platform digital sekolah terintegrasi yang menyatukan absensi (QR, Face Recognition, RFID), pembayaran SPP online, manajemen keuangan, jadwal mengajar, pengumuman, dan portal wali murid dalam satu aplikasi." },
  { category: "Umum", q: "Sekolah apa saja yang bisa menggunakan ATSkolla?", a: "Semua jenjang: PAUD/TK, SD, SMP, SMA/SMK, hingga pesantren dan lembaga pendidikan non-formal." },
  { category: "Umum", q: "Apakah ada uji coba gratis?", a: "Bisa langsung digunakan, karena gratis. ATSkolla tidak menerapkan sistem langganan berpaket — seluruh fitur (absensi QR, Face Recognition, RFID, manajemen keuangan, portal wali murid, dll) aktif untuk semua sekolah tanpa batas waktu." },

  // SPP
  { category: "Pembayaran SPP", q: "Bagaimana cara wali murid membayar SPP?", a: "Wali murid login ke portal wali murid, memilih tagihan yang ingin dibayar, lalu memilih metode pembayaran (VA bank, QRIS, atau retail). Setelah bayar, status tagihan otomatis terupdate." },
  { category: "Pembayaran SPP", q: "Apakah pembayaran langsung masuk ke rekening sekolah?", a: "Ya. Dana masuk ke saldo sekolah dan dapat dicairkan (withdraw) ke rekening resmi sekolah melalui menu Bendahara." },
  { category: "Pembayaran SPP", q: "Bagaimana jika wali murid salah transfer nominal?", a: "Sistem hanya menerima nominal yang sesuai tagihan. Untuk VA, nominal sudah terkunci sehingga tidak bisa salah bayar." },

  // VA & QRIS
  { category: "VA & QRIS", q: "Bank apa saja yang didukung untuk Virtual Account?", a: "Mandiri, BRI, BNI, BCA, dan BSI. VA berlaku hingga tagihan dibayar atau kedaluwarsa." },
  { category: "VA & QRIS", q: "Apakah QRIS bisa digunakan dari semua e-wallet?", a: "Ya. QRIS dapat dipindai dari GoPay, OVO, DANA, ShopeePay, LinkAja, serta mobile banking bank manapun." },
  { category: "VA & QRIS", q: "Berapa biaya layanannya?", a: "VA: Rp 5.000. QRIS: minimal Rp 3.000 (persentase dari nominal tagihan). Retail: Rp 8.000. Biaya ini ditampilkan transparan pada saat checkout." },

  // Status
  { category: "Status Pembayaran", q: "Berapa lama status pembayaran terupdate?", a: "Umumnya kurang dari 1 menit setelah pembayaran berhasil. Sistem menerima notifikasi otomatis dari payment gateway (webhook)." },
  { category: "Status Pembayaran", q: "Sudah bayar tapi status masih pending, apa yang harus dilakukan?", a: "Tunggu maksimal 15 menit. Jika masih pending, hubungi tim ATSkolla dengan menyertakan bukti pembayaran." },
  { category: "Status Pembayaran", q: "Apakah bisa cetak bukti pembayaran?", a: "Ya. Wali murid dan bendahara dapat mengunduh invoice PDF setelah pembayaran berhasil." },

  // Refund
  { category: "Refund", q: "Apakah pembayaran SPP bisa direfund?", a: "Refund hanya berlaku pada kondisi tertentu seperti double charge atau kesalahan sistem. Detail lengkap dapat dibaca pada halaman Kebijakan Refund." },
  { category: "Refund", q: "Berapa lama proses refund?", a: "3–7 hari kerja untuk transfer bank, 3–14 hari kerja untuk QRIS/e-wallet, 7–14 hari kerja untuk retail." },

  // Akun
  { category: "Akun", q: "Bagaimana cara mendaftarkan sekolah?", a: "Kunjungi halaman Daftar Gratis, isi data sekolah (nama, NPSN, WhatsApp admin), dan akun langsung aktif. Gratis digunakan tanpa sistem langganan berpaket — sekolah tinggal memilih mode ATSkolla Payment (gratis, memakai payment gateway) atau ATSkolla Mandiri." },
  { category: "Akun", q: "Bagaimana wali murid mendapatkan akun?", a: "Sekolah menginput data siswa dan orang tua. Wali murid login menggunakan nomor WhatsApp/NIS sesuai konfigurasi sekolah." },
  { category: "Akun", q: "Lupa password, bagaimana?", a: "Gunakan menu Lupa Password. Kode OTP akan dikirim ke nomor WhatsApp yang terdaftar." },
];

export default function FAQ() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Semua");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (cat !== "Semua" && f.category !== cat) return false;
      if (!q) return true;
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    });
  }, [query, cat]);

  return (
    <LegalLayout
      title="Pertanyaan yang Sering Diajukan"
      description="Jawaban atas pertanyaan umum seputar ATSkolla: pembayaran SPP, Virtual Account, QRIS, status pembayaran, refund, akun sekolah, dan portal wali murid."
      path="/faq"
      breadcrumb="FAQ"
      contentWidth="wide"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenIdx(null); }}
          placeholder="Cari pertanyaan..."
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-sm focus:outline-none focus:border-[#5B6CF9] focus:ring-2 focus:ring-[#5B6CF9]/15 focus:bg-white transition-all"
        />
      </div>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => { setCat(c); setOpenIdx(null); }}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border",
              cat === c
                ? "bg-[#5B6CF9] text-white border-[#5B6CF9] shadow-sm shadow-[#5B6CF9]/30"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#5B6CF9]/40 hover:text-[#5B6CF9]",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Tidak ada pertanyaan yang cocok. Coba kata kunci lain atau{" "}
              <Link to="/kontak" className="text-[#5B6CF9] font-medium hover:underline">hubungi kami</Link>.
            </p>
          </div>
        ) : (
          filtered.map((f, i) => {
            const open = openIdx === i;
            return (
              <div
                key={f.q}
                className={cn(
                  "rounded-xl border transition-all",
                  open ? "border-[#5B6CF9]/40 bg-[#5B6CF9]/[0.03] shadow-sm" : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <button
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full flex items-start justify-between gap-4 text-left px-5 py-4"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase tracking-wider">
                      {f.category}
                    </span>
                    <span className={cn("font-medium text-[15px]", open ? "text-[#5B6CF9]" : "text-slate-900")}>
                      {f.q}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-slate-400 transition-transform mt-0.5",
                      open && "rotate-180 text-[#5B6CF9]",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0 text-[14px] text-slate-600 leading-relaxed border-t border-slate-100 mt-1 pt-4">
                        {f.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4a5ce8] p-6 md:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold">Masih punya pertanyaan?</p>
            <p className="text-sm text-white/85 mt-1">Tim kami siap membantu — hubungi kami kapan saja.</p>
          </div>
        </div>
        <Link
          to="/kontak"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#5B6CF9] text-sm font-semibold hover:bg-white/95 transition shrink-0"
        >
          Hubungi Kami
        </Link>
      </div>
    </LegalLayout>
  );
}
