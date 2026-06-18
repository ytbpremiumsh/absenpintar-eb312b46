# Generate Custom + Rapikan Menu Bendahara

## 1. Database — perluas `spp_invoices` agar mendukung tagihan non-SPP

Tambah 2 kolom (migration):
- `bill_type text not null default 'spp'` — nilai: `'spp'` atau `'custom'`
- `bill_category text` — diisi untuk custom (mis. `"Ujian"`, `"Praktek"`, `"Daftar Ulang"`, atau bebas)

Index ringan: `(school_id, bill_type)` untuk filter cepat.

Tagihan SPP lama tetap aman (default `spp`). Tidak ada perubahan RLS — kebijakan existing sudah scoped via `school_id`.

## 2. Halaman Buat Tagihan — tambah tab "Custom"

File: `src/pages/bendahara/BendaharaPages.tsx` → `BendaharaGenerate`

Bungkus konten yang ada dengan **Tabs** di paling atas:

- **Tab "SPP Bulanan"** — persis seperti sekarang (mode Single / Range periode, ambil tarif dari `spp_tariffs`). Tidak diubah logikanya.
- **Tab "Custom"** — flow baru:
  1. **Nama Tagihan** (text, wajib) — contoh: "Ujian Tengah Semester Ganjil 2026"
  2. **Kategori** (select + free text) — Ujian, Praktek, Daftar Ulang, Study Tour, Seragam, Lainnya
  3. **Nominal** (number, wajib) — sama untuk semua siswa terpilih (versi v1)
  4. **Tanggal Jatuh Tempo** (date picker)
  5. **Pilih Kelas** (checkbox grid + "Pilih Semua") — reuse komponen kelas dari tab SPP
  6. **Preview**: jumlah siswa, total nominal, daftar siswa
  7. Toggle "Kirim WA otomatis setelah generate" (sama seperti SPP)
  8. Tombol **Generate Sekarang**

Insert ke `spp_invoices` dengan:
- `bill_type = 'custom'`, `bill_category = <kategori>`
- `period_month`/`period_year` = bulan/tahun jatuh tempo (untuk kompatibilitas grouping existing)
- `period_label` = nama tagihan (mis. "Ujian Tengah Semester Ganjil 2026")
- `description` = `"<nama tagihan> - <kelas> - <nama siswa>"`
- `invoice_number` = `CUSTOM/<yyyymm>/<student_id>/<slug-nama>` (jamin unik per siswa+nama)
- `amount` = `total_amount` = nominal input, `denda = 0`

Dedup: skip siswa yang sudah punya invoice dengan kombinasi (student_id, bill_type='custom', period_label) sama.

Reuse pipeline background yang sudah ada: panggil `spp-mayar create_payment_link` + kirim WA via `send-whatsapp` (template pesan diganti dari "Tagihan SPP Baru" → "Tagihan <nama> Baru").

Header halaman jadi: **"Buat Tagihan"** dengan deskripsi "SPP bulanan atau tagihan custom (Ujian, Praktek, dll)".

## 3. Halaman Pembayaran — tampilkan tipe tagihan

File: `BendaharaTransaksi` & `BendaharaSPPDetail`

- Tambah **filter tab/segment**: `Semua` · `SPP` · `Custom` (filter berdasarkan `bill_type`)
- Di tabel daftar invoice per siswa, tambah kolom kecil **"Jenis"** (badge "SPP" / "<kategori>")
- Statistik (Total Tagihan / Lunas / Sisa) tetap, hanya mengikuti filter aktif
- Pesan WA tetap reuse template — pakai `period_label` (sudah berisi nama tagihan untuk custom)

## 4. Rapikan Sidebar & Header

File: `src/components/layout/BendaharaSidebar.tsx` + `BendaharaFloatingNav.tsx`

Struktur baru (lebih ringkas & sesuai alur kerja):

```
Ringkasan
  - Dashboard

Master Data
  - Data Siswa
  - Tarif SPP

Tagihan
  - Buat Tagihan          (was: Generate Tagihan — sekarang ada tab SPP & Custom)
  - Pembayaran            (was: Pembayaran SPP — sekarang juga tampung custom)
  - Import Tagihan

Keuangan
  - Keuangan              (saldo, pencairan, laporan — sudah ada tab)
```

Mobile floating nav (`BendaharaFloatingNav`) ikut disesuaikan: Dashboard · Siswa · Buat · Bayar · Keuangan.

PageHeader masing-masing halaman juga diupdate (title + subtitle) agar konsisten dengan nama menu baru.

## 5. Yang TIDAK diubah
- Skema `spp_tariffs`, alur Mayar, edge functions, RLS
- Logika SPP bulanan (single/range) tetap apa adanya
- Halaman `Keuangan` (tab Saldo / Pencairan / Laporan) tetap

## Catatan teknis
- Migration kolom baru → setelah disetujui, `types.ts` Supabase regen, baru ubah kode UI.
- Field `period_month`/`period_year` di-reuse untuk custom (diambil dari jatuh tempo) agar laporan bulanan existing tidak pecah.
- v1 nominal custom seragam per generate. Nominal berbeda per siswa bisa ditambah nanti (v2).
