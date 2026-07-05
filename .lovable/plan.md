
# Halaman Pilih Metode Pembayaran (Portal Wali Murid)

Menambahkan satu halaman perantara sebelum membuka link Mayar. Wali murid melihat rincian tagihan + pilih metode pembayaran (VA per bank / QRIS / Retail). Fee channel otomatis ditambah ke total tagihan, lalu link Mayar dibuat dengan nominal final.

Berlaku untuk **SPP** dan **tagihan lain** yang dibayar wali murid.

## Alur Baru

```text
Wali klik "Bayar"
        │
        ▼
┌─────────────────────────────────────┐
│  Halaman Pilih Metode Pembayaran   │
│  ─────────────────────────────────  │
│  Rincian Tagihan  Rp 500.000        │
│                                     │
│  ○ Virtual Account   +Rp 5.000     │
│      [BRI] [BNI] [Mandiri] [BSI]   │
│      [Permata] [BCA] [CIMB] [BJB]  │
│  ○ QRIS              +Rp 5.000     │
│  ○ Retail            +Rp 8.000     │
│      [Alfamart] [Indomaret]        │
│                                     │
│  Total Bayar     Rp 505.000         │
│  [ Lanjut Bayar → ]                 │
└─────────────────────────────────────┘
        │
        ▼
Buat link Mayar dengan amount = tagihan + fee
        │
        ▼
Halaman Mayar (gambar 1) — wali menyelesaikan pembayaran
```

## Yang Dibangun

### 1. Halaman/Dialog "Pilih Metode Pembayaran"
Komponen baru `PaymentMethodPicker` dipakai di:
- **Portal Wali Murid → Bayar SPP** (`parent-portal` view + `Login.tsx` → Parent Dashboard)
- **Tagihan lain yang dibayar wali** (kalau ada alur lain di masa depan, komponen ini reusable)

Isi halaman:
- Kartu ringkas: nama siswa, kelas, periode, nominal tagihan
- Grup channel dengan logo bank (radio card):
  - **Virtual Account** — logo BRI, BNI, Mandiri, BSI, Permata, BCA, CIMB, BJB, Danamon
  - **QRIS** — logo QRIS (semua e-wallet & mobile banking)
  - **Retail** — logo Alfamart & Indomaret
- Setiap grup menampilkan fee: **VA +Rp 5.000**, **QRIS +Rp 5.000**, **Retail +Rp 8.000**
- Baris total: `Tagihan + Biaya Layanan = Total Bayar` (real-time saat pilih)
- Tombol **Lanjut Bayar** → kirim `channel` + `fee` ke edge function → buka link Mayar

### 2. Perubahan Backend (edge function `spp-mayar`)
- `parent_create_payment` menerima parameter tambahan `channel` (`va` / `qris` / `retail`).
- Server menghitung `service_fee` (5.000 atau 8.000) berdasarkan channel.
- `amount` yang dikirim ke Mayar = `invoice.total_amount + service_fee`.
- Simpan `service_fee` dan `channel` di kolom baru pada tabel `payment_transactions` supaya bisa dilihat di riwayat & rekap bendahara.
- Fee ini **berbeda dan terpisah** dari `gateway_fee` internal yang dipakai buat rekap bendahara (yang sudah ada) — service_fee adalah biaya yang dibebankan ke wali, gateway_fee tetap seperti sekarang.

### 3. Perubahan Frontend Lain
- Kartu invoice di dashboard wali menampilkan estimasi total ("mulai Rp 505.000 termasuk biaya layanan") supaya wali tidak kaget.
- Notifikasi WhatsApp & email invoice ditambahi keterangan "Biaya layanan menyesuaikan metode pembayaran (Rp 5.000 VA/QRIS, Rp 8.000 Retail)".
- Bukti pembayaran (invoice PDF) menampilkan breakdown: `Tagihan`, `Biaya Layanan`, `Total Dibayar`.

### 4. Panel Konfigurasi (opsional, disarankan)
Di **Pengaturan Bendahara** tambahkan input agar sekolah bisa mengatur:
- `service_fee_va` (default 5.000)
- `service_fee_qris` (default 5.000)
- `service_fee_retail` (default 8.000)

Kalau sekolah tidak mengubah, dipakai nilai default di atas.

## Catatan Penting Soal Mayar

- Mayar **tidak bisa mengunci** channel pembayaran dari sisi API — di halaman Mayar wali tetap melihat semua channel. Yang dilakukan sistem:
  1. Wali memilih channel di ATSkolla → fee dihitung benar sesuai pilihan.
  2. Link Mayar dibuat dengan amount yang sudah termasuk fee tersebut.
  3. Sekolah tetap menerima nominal SPP penuh, karena selisihnya dari wali.
- Halaman pilih channel di ATSkolla berfungsi sebagai **informasi transparan** + kalkulator fee, bukan penguncian teknis. Kalau wali di halaman Mayar iseng pilih channel lain dengan fee real yang berbeda, itu sudah tanggungan wali sendiri (fee di sistem kita tetap sesuai pilihan awal).
- Kalau ke depan ingin fee benar-benar terkunci per channel (seperti Tripay), perlu pindah/ tambah provider — bisa dibahas terpisah.

## Detail Teknis

**File baru**
- `src/components/PaymentMethodPicker.tsx` — komponen radio-card channel + kalkulator fee.
- `src/lib/paymentChannels.ts` — konstanta channel, fee default, path logo bank.
- `src/assets/banks/` — SVG/PNG logo bank (BRI, BNI, Mandiri, BSI, Permata, BCA, CIMB, BJB, Danamon, QRIS, Alfamart, Indomaret) via `lovable-assets` atau simpanan lokal.

**File diedit**
- `src/pages/parent/ParentDashboard.tsx` — tombol Bayar membuka `PaymentMethodPicker` sebagai Dialog, bukan langsung memanggil `parent_create_payment`.
- `supabase/functions/spp-mayar/index.ts` — parameter `channel` di action `parent_create_payment`, hitung `service_fee`, tambahkan ke `amount`, simpan ke `payment_transactions`.
- `src/lib/sppInvoicePDF.ts` — tambah baris breakdown `Biaya Layanan` dan `Total Dibayar`.
- (Opsional) `src/pages/bendahara/BendaharaKeuangan.tsx` atau Pengaturan Bendahara — form konfigurasi fee per channel.

**Migrasi database**
- `ALTER TABLE payment_transactions ADD COLUMN service_fee INT DEFAULT 0, ADD COLUMN payment_channel TEXT`.
- (Opsional) `INSERT INTO bendahara_settings` key `service_fee_va|qris|retail`.

**Perhitungan (contoh)**
```text
SPP           = 500.000
Pilih channel = QRIS  → service_fee = 5.000
amount ke Mayar = 505.000
Wali bayar    = 505.000
Sekolah terima (setelah gateway_fee Mayar internal) = 500.000 - gateway_fee
Service fee 5.000 tetap masuk ke sekolah (bukan ke Mayar) sebagai kompensasi biaya layanan.
```

Setelah plan ini disetujui, saya lanjut implementasi.
