import LegalLayout from "./LegalLayout";

export default function Refund() {
  return (
    <LegalLayout
      title="Kebijakan Refund"
      description="Prosedur, syarat, dan estimasi waktu pengembalian dana (refund) untuk layanan ATSkolla dan pembayaran SPP melalui platform."
      path="/kebijakan-refund"
      updatedAt="7 Juli 2026"
    >
      <p>
        ATSkolla berkomitmen memberikan pengalaman transaksi yang adil dan transparan.
        Halaman ini menjelaskan prosedur pengembalian dana (refund) untuk pembayaran
        berlangganan dan pembayaran SPP yang diproses melalui platform.
      </p>

      <h2>1. Kondisi yang Dapat Direfund</h2>
      <ul>
        <li>Kesalahan sistem yang mengakibatkan dana terpotong ganda (double charge).</li>
        <li>Pembayaran berhasil namun tagihan tidak terupdate pada sistem karena gangguan teknis.</li>
        <li>Kesalahan input jumlah pembayaran oleh sistem (bukan oleh pengguna).</li>
        <li>Pembatalan berlangganan pada masa uji coba (trial) yang tidak sengaja ter-charge.</li>
      </ul>

      <h2>2. Kondisi yang Tidak Dapat Direfund</h2>
      <ul>
        <li>Pembayaran SPP yang sudah dikonfirmasi diterima oleh sekolah dan tercatat di rekening tujuan.</li>
        <li>Berlangganan yang sudah dipakai (fitur premium telah aktif dan digunakan).</li>
        <li>Kesalahan input nominal atau data pembayaran oleh pengguna.</li>
        <li>Perubahan keputusan sepihak setelah layanan diterima.</li>
        <li>Biaya layanan payment gateway (VA, QRIS, retail) yang sudah dipotong pihak ketiga.</li>
      </ul>

      <h2>3. Prosedur Pengajuan Refund</h2>
      <ol>
        <li>Kirim permohonan refund ke <a href="mailto:halo@atskolla.com">halo@atskolla.com</a> dengan subjek <em>"Permohonan Refund - [Nama Sekolah]"</em>.</li>
        <li>Sertakan informasi berikut:
          <ul>
            <li>Nama sekolah / nama pemilik akun</li>
            <li>Nomor invoice / ID transaksi</li>
            <li>Tanggal dan nominal pembayaran</li>
            <li>Metode pembayaran yang digunakan</li>
            <li>Bukti transfer / screenshot pembayaran</li>
            <li>Alasan pengajuan refund</li>
          </ul>
        </li>
        <li>Tim kami akan melakukan verifikasi maksimal <strong>3 hari kerja</strong> sejak pengajuan diterima.</li>
        <li>Jika permohonan disetujui, dana akan dikembalikan ke rekening/sumber dana asal.</li>
      </ol>

      <h2>4. Estimasi Waktu Proses Refund</h2>
      <ul>
        <li><strong>Virtual Account / Transfer Bank:</strong> 3–7 hari kerja setelah disetujui.</li>
        <li><strong>QRIS / E-Wallet:</strong> 3–14 hari kerja tergantung penyedia layanan.</li>
        <li><strong>Retail (Alfamart / Indomaret):</strong> 7–14 hari kerja.</li>
      </ul>
      <p className="text-sm text-slate-500">
        Waktu proses di atas dihitung sejak permohonan <strong>disetujui</strong>, bukan sejak permohonan diajukan.
        Waktu aktual dapat bervariasi tergantung kebijakan bank/penyedia pembayaran.
      </p>

      <h2>5. Kontak Refund</h2>
      <p>
        Untuk pertanyaan atau pengajuan refund, silakan hubungi:
      </p>
      <ul>
        <li>Email: <a href="mailto:halo@atskolla.com">halo@atskolla.com</a></li>
        <li>WhatsApp: <a href="https://wa.me/6288861175370" target="_blank" rel="noreferrer">+62 888 6117 537</a></li>
        <li>Jam operasional: Senin–Jumat, 08.00–17.00 WIB</li>
      </ul>
    </LegalLayout>
  );
}
