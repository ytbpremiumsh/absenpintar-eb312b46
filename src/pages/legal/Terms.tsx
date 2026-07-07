import LegalLayout, { SectionHeading, Prose, CheckList, InfoCallout } from "./LegalLayout";

const TOC = [
  { id: "definisi", label: "1. Definisi" },
  { id: "pendaftaran", label: "2. Pendaftaran & Akun" },
  { id: "hak", label: "3. Hak & Kewajiban" },
  { id: "pembayaran", label: "4. Ketentuan Pembayaran" },
  { id: "keamanan", label: "5. Keamanan Sistem" },
  { id: "haki", label: "6. Kekayaan Intelektual" },
  { id: "batas", label: "7. Pembatasan Tanggung Jawab" },
  { id: "perubahan", label: "8. Perubahan Ketentuan" },
  { id: "hukum", label: "9. Hukum yang Berlaku" },
  { id: "kontak", label: "10. Kontak" },
];

export default function Terms() {
  return (
    <LegalLayout
      title="Syarat & Ketentuan"
      description="Aturan penggunaan layanan ATSkolla, hak & kewajiban pengguna, ketentuan pembayaran, keamanan akun, dan penggunaan sistem."
      path="/syarat-ketentuan"
      breadcrumb="Syarat & Ketentuan"
      updatedAt="7 Juli 2026"
      toc={TOC}
    >
      <Prose>
        <p>
          Selamat datang di <strong>ATSkolla</strong>. Dengan mendaftar dan menggunakan layanan
          kami, Anda dianggap telah membaca, memahami, dan menyetujui seluruh Syarat &
          Ketentuan berikut. Mohon dibaca dengan seksama sebelum menggunakan layanan.
        </p>
      </Prose>

      <SectionHeading id="definisi" num={1}>Definisi</SectionHeading>
      <CheckList
        items={[
          <><strong>Layanan</strong> — seluruh fitur dan modul pada platform ATSkolla, termasuk aplikasi web, portal wali murid, dan integrasi pihak ketiga.</>,
          <><strong>Pengguna</strong> — sekolah, staf sekolah, guru, wali kelas, bendahara, wali murid, atau pihak lain yang mengakses layanan.</>,
          <><strong>Akun</strong> — identitas yang digunakan pengguna untuk mengakses layanan.</>,
        ]}
      />

      <SectionHeading id="pendaftaran" num={2}>Pendaftaran & Akun</SectionHeading>
      <CheckList
        items={[
          "Pengguna wajib memberikan data yang benar, akurat, dan terkini pada saat pendaftaran.",
          "Pengguna bertanggung jawab penuh atas kerahasiaan kata sandi dan seluruh aktivitas pada akunnya.",
          "Segera hubungi tim ATSkolla apabila terdapat indikasi akses tidak sah pada akun Anda.",
        ]}
      />

      <SectionHeading id="hak" num={3}>Hak & Kewajiban Pengguna</SectionHeading>
      <CheckList
        variant="success"
        items={[
          "Pengguna berhak menggunakan fitur sesuai dengan paket berlangganan yang aktif.",
          "Pengguna berhak atas dukungan teknis melalui kanal resmi ATSkolla.",
          "Pengguna wajib menjaga kerahasiaan data siswa, guru, dan wali murid sesuai peraturan perundang-undangan yang berlaku.",
        ]}
      />
      <CheckList
        variant="danger"
        items={[
          "Dilarang menyalahgunakan layanan untuk tindakan melanggar hukum, spam, phising, atau merugikan pihak lain.",
          "Dilarang membagikan akses akun kepada pihak yang tidak berwenang.",
        ]}
      />

      <SectionHeading id="pembayaran" num={4}>Ketentuan Pembayaran</SectionHeading>
      <Prose>
        <p>
          Pembayaran berlangganan dan pembayaran SPP diproses melalui payment gateway resmi
          yang terintegrasi dengan ATSkolla. Seluruh transaksi tercatat dan dapat diverifikasi
          melalui riwayat transaksi.
        </p>
      </Prose>
      <CheckList
        items={[
          "Metode: Virtual Account bank nasional, QRIS (semua e-wallet), dan gerai retail (Alfamart / Indomaret).",
          "Biaya layanan payment gateway ditampilkan transparan pada saat checkout.",
          "Bukti pembayaran dikirim otomatis dan tersedia untuk diunduh dalam format PDF.",
        ]}
      />
      <InfoCallout tone="info" title="Verifikasi otomatis">
        Status pembayaran diverifikasi otomatis oleh sistem melalui webhook gateway.
        Konfirmasi diterima kurang dari 1 menit pada kondisi normal.
      </InfoCallout>

      <SectionHeading id="keamanan" num={5}>Keamanan Sistem</SectionHeading>
      <CheckList
        items={[
          "Data pengguna dienkripsi menggunakan standar industri (TLS 1.2+ untuk transmisi).",
          "Akses ke data sekolah dibatasi berdasarkan peran: Super Admin, Kepala Sekolah, Bendahara, Wali Kelas, Guru, dan Wali Murid.",
          "Dilarang melakukan upaya peretasan, reverse-engineering, penetration testing tanpa izin, atau eksploitasi celah keamanan.",
        ]}
      />

      <SectionHeading id="haki" num={6}>Kekayaan Intelektual</SectionHeading>
      <Prose>
        <p>
          Seluruh konten, logo, desain antarmuka, dan kode sumber ATSkolla dilindungi oleh hak
          cipta. Dilarang menyalin, mendistribusikan, atau memodifikasi tanpa izin tertulis
          dari kami.
        </p>
      </Prose>

      <SectionHeading id="batas" num={7}>Pembatasan Tanggung Jawab</SectionHeading>
      <Prose>
        <p>
          ATSkolla tidak bertanggung jawab atas kerugian yang timbul akibat kelalaian pengguna,
          gangguan jaringan pihak ketiga, atau kondisi force majeure. Ketersediaan layanan
          diupayakan setinggi mungkin, namun tidak dijamin tanpa gangguan 100%.
        </p>
      </Prose>

      <SectionHeading id="perubahan" num={8}>Perubahan Ketentuan</SectionHeading>
      <Prose>
        <p>
          Kami berhak memperbarui Syarat & Ketentuan ini sewaktu-waktu. Perubahan akan
          diinformasikan melalui platform dan berlaku efektif sejak tanggal publikasi.
        </p>
      </Prose>

      <SectionHeading id="hukum" num={9}>Hukum yang Berlaku</SectionHeading>
      <Prose>
        <p>
          Syarat & Ketentuan ini tunduk pada hukum yang berlaku di Republik Indonesia.
          Perselisihan yang timbul akan diselesaikan secara musyawarah, dan apabila tidak
          tercapai kesepakatan, akan diselesaikan melalui pengadilan yang berwenang.
        </p>
      </Prose>

      <SectionHeading id="kontak" num={10}>Kontak</SectionHeading>
      <Prose>
        <p>
          Pertanyaan terkait ketentuan ini dapat dikirim ke{" "}
          <a href="mailto:halo@atskolla.com">halo@atskolla.com</a> atau melalui halaman{" "}
          <a href="/kontak">Kontak Kami</a>.
        </p>
      </Prose>
    </LegalLayout>
  );
}
