import { CheckCircle2, XCircle, Clock } from "lucide-react";
import LegalLayout, { SectionHeading, Prose, InfoCallout } from "./LegalLayout";

const TOC = [
  { id: "dapat", label: "1. Yang Dapat Direfund" },
  { id: "tidak", label: "2. Yang Tidak Dapat Direfund" },
  { id: "prosedur", label: "3. Prosedur Pengajuan" },
  { id: "waktu", label: "4. Estimasi Waktu" },
  { id: "kontak", label: "5. Kontak Refund" },
];

const REFUNDABLE = [
  "Kesalahan sistem yang mengakibatkan dana terpotong ganda (double charge).",
  "Pembayaran berhasil namun tagihan tidak terupdate pada sistem karena gangguan teknis.",
  "Kesalahan input nominal oleh sistem (bukan oleh pengguna).",
  "Pembatalan berlangganan pada masa uji coba (trial) yang tidak sengaja ter-charge.",
];

const NON_REFUNDABLE = [
  "Pembayaran SPP yang sudah dikonfirmasi diterima sekolah dan tercatat di rekening tujuan.",
  "Berlangganan yang sudah dipakai (fitur premium telah aktif dan digunakan).",
  "Kesalahan input nominal atau data pembayaran oleh pengguna.",
  "Perubahan keputusan sepihak setelah layanan diterima.",
  "Biaya layanan payment gateway (VA, QRIS, retail) yang sudah dipotong pihak ketiga.",
];

const STEPS = [
  {
    title: "Kirim Permohonan",
    desc: 'Email ke halo@atskolla.com dengan subjek "Permohonan Refund - [Nama Sekolah]".',
  },
  {
    title: "Lengkapi Data",
    desc: "Sertakan nama sekolah, nomor invoice/ID transaksi, tanggal & nominal, metode pembayaran, bukti transfer, dan alasan.",
  },
  {
    title: "Verifikasi",
    desc: "Tim ATSkolla melakukan verifikasi maksimal 3 hari kerja sejak permohonan diterima.",
  },
  {
    title: "Pengembalian Dana",
    desc: "Jika disetujui, dana akan dikembalikan ke rekening/sumber dana asal.",
  },
];

const ETA = [
  { label: "Virtual Account / Transfer Bank", value: "3–7 hari kerja" },
  { label: "QRIS / E-Wallet", value: "3–14 hari kerja" },
  { label: "Retail (Alfamart / Indomaret)", value: "7–14 hari kerja" },
];

export default function Refund() {
  return (
    <LegalLayout
      title="Kebijakan Refund"
      description="Prosedur, syarat, dan estimasi waktu pengembalian dana (refund) untuk layanan ATSkolla dan pembayaran SPP melalui platform."
      path="/kebijakan-refund"
      breadcrumb="Kebijakan Refund"
      updatedAt="7 Juli 2026"
      toc={TOC}
    >
      <Prose>
        <p>
          ATSkolla berkomitmen memberikan pengalaman transaksi yang adil dan transparan.
          Halaman ini menjelaskan prosedur pengembalian dana (refund) untuk pembayaran
          berlangganan dan pembayaran SPP yang diproses melalui platform.
        </p>
      </Prose>

      {/* Two-column: refundable vs not */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div id="dapat" className="scroll-mt-24 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Dapat Direfund</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            {REFUNDABLE.map((it) => (
              <li key={it} className="flex gap-2">
                <span className="text-emerald-600 shrink-0">✓</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>

        <div id="tidak" className="scroll-mt-24 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Tidak Dapat Direfund</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            {NON_REFUNDABLE.map((it) => (
              <li key={it} className="flex gap-2">
                <span className="text-red-600 shrink-0">✕</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SectionHeading id="prosedur" num={3}>Prosedur Pengajuan Refund</SectionHeading>
      <ol className="mt-4 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <div className="shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#4a5ce8] text-white font-bold flex items-center justify-center shadow-sm shadow-[#5B6CF9]/30">
              {i + 1}
            </div>
            <div className="flex-1 pt-1">
              <p className="font-semibold text-slate-900">{s.title}</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <SectionHeading id="waktu" num={4}>Estimasi Waktu Proses Refund</SectionHeading>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {ETA.map((e) => (
          <div key={e.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Clock className="h-3.5 w-3.5" /> Estimasi
            </div>
            <p className="mt-2 text-lg font-bold text-[#5B6CF9]">{e.value}</p>
            <p className="text-xs text-slate-600 mt-1">{e.label}</p>
          </div>
        ))}
      </div>
      <InfoCallout tone="warning" title="Catatan penting">
        Waktu proses dihitung sejak permohonan <strong>disetujui</strong>, bukan sejak
        permohonan diajukan. Waktu aktual dapat bervariasi tergantung kebijakan
        bank/penyedia pembayaran.
      </InfoCallout>

      <SectionHeading id="kontak" num={5}>Kontak Refund</SectionHeading>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Email</p>
            <a href="mailto:halo@atskolla.com" className="font-semibold text-[#5B6CF9] hover:underline">
              halo@atskolla.com
            </a>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">WhatsApp</p>
            <a href="https://wa.me/6288861175370" target="_blank" rel="noreferrer" className="font-semibold text-[#5B6CF9] hover:underline">
              +62 888 6117 537
            </a>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Jam Operasional</p>
            <p className="font-semibold text-slate-900">Sen–Jum, 08.00–17.00 WIB</p>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
}
