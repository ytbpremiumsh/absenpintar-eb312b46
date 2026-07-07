import { useState } from "react";
import { ChevronDown } from "lucide-react";
import LegalLayout from "./LegalLayout";
import { cn } from "@/lib/utils";

interface QA {
  q: string;
  a: string;
}

interface Section {
  title: string;
  items: QA[];
}

const SECTIONS: Section[] = [
  {
    title: "Umum",
    items: [
      { q: "Apa itu ATSkolla?", a: "ATSkolla adalah platform digital sekolah terintegrasi yang menyatukan absensi (QR, Face Recognition, RFID), pembayaran SPP online, manajemen keuangan, jadwal mengajar, pengumuman, dan portal wali murid dalam satu aplikasi." },
      { q: "Sekolah apa saja yang bisa menggunakan ATSkolla?", a: "Semua jenjang: PAUD/TK, SD, SMP, SMA/SMK, hingga pesantren dan lembaga pendidikan non-formal." },
      { q: "Apakah ada uji coba gratis?", a: "Ya. Setiap sekolah yang mendaftar otomatis mendapatkan akses Premium Trial untuk mencoba seluruh fitur premium." },
    ],
  },
  {
    title: "Pembayaran SPP",
    items: [
      { q: "Bagaimana cara wali murid membayar SPP?", a: "Wali murid login ke portal wali murid, memilih tagihan yang ingin dibayar, lalu memilih metode pembayaran (VA bank, QRIS, atau retail). Setelah bayar, status tagihan otomatis terupdate." },
      { q: "Apakah pembayaran langsung masuk ke rekening sekolah?", a: "Ya. Dana masuk ke saldo sekolah dan dapat dicairkan (withdraw) ke rekening resmi sekolah melalui menu Bendahara." },
      { q: "Bagaimana jika wali murid salah transfer nominal?", a: "Sistem hanya menerima nominal yang sesuai tagihan. Untuk VA, nominal sudah terkunci sehingga tidak bisa salah bayar." },
    ],
  },
  {
    title: "Virtual Account & QRIS",
    items: [
      { q: "Bank apa saja yang didukung untuk Virtual Account?", a: "Mandiri, BRI, BNI, BCA, dan BSI. VA berlaku hingga tagihan dibayar atau kedaluwarsa." },
      { q: "Apakah QRIS bisa digunakan dari semua e-wallet?", a: "Ya. QRIS dapat dipindai dari GoPay, OVO, DANA, ShopeePay, LinkAja, serta mobile banking bank manapun." },
      { q: "Berapa biaya layanannya?", a: "VA: Rp 5.000. QRIS: minimal Rp 3.000 (persentase dari nominal). Retail: Rp 8.000. Biaya ini transparan ditampilkan pada saat checkout." },
    ],
  },
  {
    title: "Status Pembayaran",
    items: [
      { q: "Berapa lama status pembayaran terupdate?", a: "Umumnya di bawah 1 menit setelah pembayaran berhasil. Sistem menerima notifikasi otomatis dari payment gateway (webhook)." },
      { q: "Sudah bayar tapi status masih pending, apa yang harus dilakukan?", a: "Tunggu maksimal 15 menit. Jika masih pending, hubungi tim ATSkolla dengan menyertakan bukti pembayaran." },
      { q: "Apakah bisa cetak bukti pembayaran?", a: "Ya. Wali murid dan bendahara bisa mengunduh invoice PDF setelah pembayaran berhasil." },
    ],
  },
  {
    title: "Refund",
    items: [
      { q: "Apakah pembayaran SPP bisa direfund?", a: "Refund hanya berlaku pada kondisi tertentu seperti double charge atau kesalahan sistem. Detail lengkap dapat dibaca pada halaman Kebijakan Refund." },
      { q: "Berapa lama proses refund?", a: "3–7 hari kerja untuk transfer bank, 3–14 hari kerja untuk QRIS/e-wallet, 7–14 hari kerja untuk retail." },
    ],
  },
  {
    title: "Akun Sekolah & Wali Murid",
    items: [
      { q: "Bagaimana cara mendaftarkan sekolah?", a: "Kunjungi halaman Daftar Gratis, isi data sekolah (nama, NPSN, WhatsApp admin), dan akun akan langsung aktif dengan Trial Premium." },
      { q: "Bagaimana wali murid mendapatkan akun?", a: "Sekolah menginput data siswa dan orang tua. Wali murid login menggunakan nomor WhatsApp/NIS sesuai konfigurasi sekolah." },
      { q: "Lupa password, bagaimana?", a: "Gunakan menu Lupa Password. Kode OTP akan dikirim ke nomor WhatsApp yang terdaftar." },
    ],
  },
];

function FaqItem({ q, a }: QA) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left group"
      >
        <span className="font-medium text-[#0b1020] group-hover:text-[#5B6CF9] transition-colors">{q}</span>
        <ChevronDown className={cn("h-5 w-5 text-slate-400 flex-shrink-0 transition-transform mt-0.5", open && "rotate-180")} />
      </button>
      {open && <p className="pb-4 text-slate-600 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function FAQ() {
  return (
    <LegalLayout
      title="Pertanyaan yang Sering Diajukan (FAQ)"
      description="Jawaban atas pertanyaan umum seputar ATSkolla: pembayaran SPP, Virtual Account, QRIS, status pembayaran, refund, akun sekolah, dan portal wali murid."
      path="/faq"
    >
      <p>
        Berikut adalah kumpulan pertanyaan yang paling sering diajukan oleh sekolah dan
        wali murid. Klik pertanyaan untuk melihat jawaban.
      </p>

      {SECTIONS.map((sec) => (
        <div key={sec.title} className="not-prose mt-8">
          <h2 className="font-display text-2xl font-bold text-[#0b1020] mb-2">{sec.title}</h2>
          <div className="bg-white border border-slate-200 rounded-2xl px-5 divide-y divide-slate-100">
            {sec.items.map((it) => (
              <FaqItem key={it.q} {...it} />
            ))}
          </div>
        </div>
      ))}

      <div className="not-prose mt-10 rounded-2xl bg-gradient-to-br from-[#5B6CF9]/5 to-[#5B6CF9]/10 border border-[#5B6CF9]/20 p-6 text-center">
        <p className="font-semibold text-[#0b1020]">Masih ada pertanyaan?</p>
        <p className="text-sm text-slate-600 mt-1">Tim kami siap membantu — hubungi kami kapan saja.</p>
        <a
          href="/kontak"
          className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-[#5B6CF9] text-white text-sm font-medium hover:bg-[#4a5ce8] transition-colors"
        >
          Hubungi Kami
        </a>
      </div>
    </LegalLayout>
  );
}
