import LegalLayout from "./LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Syarat & Ketentuan"
      description="Aturan penggunaan layanan ATSkolla, hak dan kewajiban pengguna, ketentuan pembayaran, keamanan akun, serta penggunaan sistem."
      path="/syarat-ketentuan"
      updatedAt="7 Juli 2026"
    >
      <p>
        Selamat datang di <strong>ATSkolla</strong>. Dengan mendaftar dan menggunakan layanan
        kami, Anda dianggap telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan
        di bawah ini. Mohon dibaca dengan seksama sebelum menggunakan layanan.
      </p>

      <h2>1. Definisi</h2>
      <ul>
        <li><strong>Layanan</strong> adalah seluruh fitur dan modul yang disediakan melalui platform ATSkolla, termasuk aplikasi web, portal wali murid, dan integrasi pihak ketiga.</li>
        <li><strong>Pengguna</strong> adalah sekolah, staf sekolah, guru, wali kelas, bendahara, wali murid, atau siapapun yang mengakses layanan.</li>
        <li><strong>Akun</strong> adalah identitas yang digunakan pengguna untuk mengakses layanan.</li>
      </ul>

      <h2>2. Pendaftaran & Akun</h2>
      <ul>
        <li>Pengguna wajib memberikan data yang benar, akurat, dan terkini saat pendaftaran.</li>
        <li>Pengguna bertanggung jawab penuh atas keamanan kata sandi dan seluruh aktivitas yang terjadi pada akunnya.</li>
        <li>Segera hubungi tim kami apabila mencurigai adanya akses tidak sah pada akun Anda.</li>
      </ul>

      <h2>3. Hak & Kewajiban Pengguna</h2>
      <ul>
        <li>Pengguna berhak menggunakan fitur sesuai dengan paket berlangganan yang aktif.</li>
        <li>Pengguna dilarang menyalahgunakan layanan untuk tindakan melanggar hukum, spam, atau merugikan pihak lain.</li>
        <li>Pengguna wajib menjaga kerahasiaan data siswa, guru, dan wali murid sesuai dengan peraturan perlindungan data pribadi.</li>
      </ul>

      <h2>4. Ketentuan Pembayaran</h2>
      <ul>
        <li>Pembayaran berlangganan dan pembayaran SPP dilakukan melalui payment gateway resmi yang terintegrasi dengan ATSkolla.</li>
        <li>Metode pembayaran yang didukung meliputi Virtual Account bank nasional, QRIS, dan gerai retail (Alfamart/Indomaret).</li>
        <li>Seluruh transaksi diproses secara aman dan dicatat sebagai bukti pembayaran resmi.</li>
        <li>Biaya layanan payment gateway ditampilkan secara transparan pada saat checkout.</li>
      </ul>

      <h2>5. Keamanan Sistem</h2>
      <ul>
        <li>ATSkolla menggunakan enkripsi standar industri untuk melindungi data pengguna.</li>
        <li>Akses ke data sekolah dibatasi berdasarkan peran (Super Admin, Kepala Sekolah, Bendahara, Wali Kelas, Guru, Wali Murid).</li>
        <li>Pengguna dilarang melakukan upaya peretasan, reverse-engineering, atau eksploitasi celah keamanan.</li>
      </ul>

      <h2>6. Kekayaan Intelektual</h2>
      <p>
        Seluruh konten, logo, desain, dan kode sumber ATSkolla dilindungi oleh hak cipta.
        Dilarang menyalin, mendistribusikan, atau memodifikasi tanpa izin tertulis dari kami.
      </p>

      <h2>7. Pembatasan Tanggung Jawab</h2>
      <p>
        ATSkolla tidak bertanggung jawab atas kerugian yang timbul akibat kelalaian pengguna,
        gangguan jaringan pihak ketiga, atau force majeure. Ketersediaan layanan diupayakan
        setinggi mungkin namun tidak dijamin 100% tanpa gangguan.
      </p>

      <h2>8. Perubahan Ketentuan</h2>
      <p>
        Kami berhak memperbarui Syarat & Ketentuan ini sewaktu-waktu. Perubahan akan
        diinformasikan melalui platform dan mulai berlaku sejak tanggal publikasi.
      </p>

      <h2>9. Hukum yang Berlaku</h2>
      <p>
        Syarat & Ketentuan ini tunduk pada hukum yang berlaku di Republik Indonesia.
      </p>

      <h2>10. Kontak</h2>
      <p>
        Pertanyaan terkait ketentuan ini dapat dikirim ke <a href="mailto:halo@atskolla.com">halo@atskolla.com</a>.
      </p>
    </LegalLayout>
  );
}
