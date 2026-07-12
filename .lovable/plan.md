# Modul Disbursement Otomatis ke Rekening Sekolah

Mengganti tab **Pencairan** di `/bendahara/withdraw` menjadi modul **Disbursement Otomatis** yang siap diintegrasikan ke API Payment Gateway (DOKU Disbursement, dll), tanpa memanggil API sungguhan.

## Yang Dibangun

### 1. Halaman baru: `BendaharaDisbursement.tsx`
Menggantikan komponen `BendaharaPencairan` di tab Pencairan (tab Saldo & Riwayat tetap).

### 2. Dashboard Ringkasan (5 kartu)
Dihitung otomatis dari `spp_settlements` sekolah:
- Saldo Siap Dicairkan (dari invoice paid online tanpa settlement)
- Saldo Sedang Diproses (settlement `pending`/`approved`)
- Total Berhasil Dicairkan (settlement `paid`)
- Total Gagal Dicairkan (settlement `rejected`)
- Total Transaksi Disbursement (jumlah baris settlement)

### 3. Tabel Daftar Pencairan
Kolom: ID/Kode, Bank, No. Rek, Pemilik, Jumlah, Biaya, Total Dikirim, Status (badge warna: hijau/kuning/abu/merah), Tanggal Pengajuan, Tanggal Berhasil.
Fitur: search (kode/bank/pemilik), filter status, filter tanggal (from/to), pagination 10/page.

### 4. Dialog Detail Pencairan
Tiga section:
- **Informasi Sekolah**: nama, NPSN, bendahara (dari profile), rekening, bank, pemilik
- **Informasi Dana**: total masuk, fee gateway, biaya disbursement, dana bersih, nominal dikirim
- **Riwayat & API**: timeline (dibuat/diproses/berhasil-gagal), response API placeholder (JSON `disbursement_response`)

### 5. Pengajuan Pencairan
Tombol **Ajukan Pencairan** → hitung saldo tersedia, pilih rekening terverifikasi, konfirmasi. Insert row `spp_settlements` dengan `disbursement_status='pending'`. Log ke `spp_logs`. Tetap pakai flow OTP existing.

### 6. Rekening Pencairan (Verifikasi)
Tambah kolom `verification_status` (`pending`/`verified`/`rejected`) + `verified_at` pada `bendahara_bank_accounts`. Hanya rekening `verified` yang boleh dipilih untuk pencairan. Super Admin memverifikasi (untuk sekarang: default `pending`, admin sekolah tandai request; verifikasi manual via update — tombol verifikasi ditampilkan hanya utk super_admin).

### 7. Struktur API-Ready (client-side helper)
`src/lib/disbursement.ts` — builder payload berisi:
```
{ beneficiaryName, bankCode, accountNumber, amount, referenceId, notes, callbackUrl }
```
Dipakai saat pengajuan (payload disimpan ke `disbursement_response.request` sebagai placeholder). Tidak ada fetch ke gateway.

### 8. Export
Tombol Export **PDF** (jsPDF+autotable), **Excel** (xlsx), **CSV** untuk data tabel yang difilter.

### 9. Validasi
- Cek rekening terverifikasi
- Cek saldo > 0
- `spp_invoices.settlement_id` guard (sudah ada) mencegah double-cair
- Semua aktivitas dicatat ke `spp_logs`

## Detail Teknis

**Files baru:**
- `src/pages/bendahara/BendaharaDisbursement.tsx` (module utama)
- `src/lib/disbursement.ts` (payload builder + bank code map)

**Files diubah:**
- `src/pages/bendahara/BendaharaWithdraw.tsx` — pakai `BendaharaDisbursement` untuk tab Pencairan
- `src/components/layout/BendaharaSidebar.tsx` — rename menu "Saldo & Penarikan" → "Disbursement"

**Migration:**
- `ALTER TABLE bendahara_bank_accounts ADD verification_status text DEFAULT 'pending', ADD verified_at timestamptz, ADD verified_by uuid`

**Tidak diubah:**
- Skema `spp_settlements` (semua field sudah tersedia)
- Flow OTP & edge functions
- Komponen `BendaharaSaldo` di tab Saldo & Riwayat

## Bukan Lingkup
- Tidak memanggil DOKU Disbursement API (payload disiapkan saja)
- Tidak membuat callback endpoint (siap ditambah kemudian)
