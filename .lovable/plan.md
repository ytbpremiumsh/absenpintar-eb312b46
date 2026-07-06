## Ringkasan Fitur yang Sudah Ada vs Yang Ditambahkan

Setelah menelusuri modul Bendahara yang sudah ada, banyak bagian yang diminta sebetulnya **sudah tersedia**. Berikut pemetaannya, dan hanya bagian yang belum lengkap yang akan saya bangun.

### Sudah ada (akan disempurnakan seperlunya, tanpa dibongkar)
- **Dashboard**: sudah menampilkan tagihan bulan berjalan, jumlah lunas/pending, tunggakan, saldo siap cair, grafik bulanan, per kelas, dan riwayat pembayaran.
- **Tarif SPP** (`/bendahara/tarif`): master tarif SPP per kelas/tahun ajaran.
- **Pembayaran** (`/bendahara/transaksi`): daftar & detail invoice SPP.
- **Saldo & Penarikan** (`/bendahara/withdraw`): withdraw ke rekening.
- **Laporan** (`Keuangan Sekolah` → `BendaharaLaporan`): export Excel/CSV/PDF per kelas/status/tahun ajaran + grafik tahunan.

### Yang akan ditambahkan / disempurnakan
1. **Dashboard — metrik yang belum ada**
   - Total pemasukan **hari ini**, **bulan ini**, **tahun ini** (kartu ringkas terpisah, di atas panel yang sudah ada).
   - **Tagihan jatuh tempo hari ini** (kartu + daftar 5 teratas).
   - **Total saldo kas** (menggabungkan saldo siap cair + saldo kas manual dari Buku Kas).
   - Jumlah siswa **sudah/belum membayar bulan berjalan** (kartu ringkas — saat ini hanya jumlah invoice, bukan jumlah siswa unik).

2. **Manajemen Jenis Pembayaran** (menu baru `/bendahara/jenis-pembayaran`)
   - Tabel baru `payment_types` (multi-tenant, RLS per `school_id`).
   - Field: Nama, Kategori (SPP/Daftar Ulang/Seragam/Buku/Ekskul/Lain-lain), Nominal, Berlaku untuk (semua/kelas tertentu/tingkat), Periode (bulanan/semester/tahunan/sekali), Aktif, Keterangan.
   - CRUD lengkap dengan filter kategori & status.

3. **Buku Kas** (menu baru `/bendahara/buku-kas`)
   - Tabel baru `cash_book_entries` (kas masuk & keluar manual) — RLS per `school_id`.
   - **Otomatis menarik** semua invoice SPP `paid` sebagai kas masuk (read-only, ditandai "auto") — digabung dengan entri manual.
   - Fitur: tambah kas masuk/keluar manual, filter tanggal, filter kategori, saldo berjalan, hapus entri manual, catatan.

4. **Rekap Tunggakan** (menu baru `/bendahara/tunggakan`)
   - Total tunggakan, jumlah siswa menunggak.
   - Rekap per kelas & per jenis pembayaran (sortable).
   - Filter: kelas, bulan, tahun ajaran.
   - **Tombol kirim reminder WhatsApp** per siswa & broadcast semua (memakai edge function `send-whatsapp` yang sudah ada + flag `bendahara_wa_enabled`).

5. **Laporan — jenis yang belum ada**
   - Menu tetap di `/bendahara/keuangan-sekolah`, ditambah **preset laporan**: Pembayaran Harian, Bulanan, Tahunan, Rekap per Kelas, Rekap per **Jenis Pembayaran**, Rekap per Siswa.
   - Export PDF & Excel untuk setiap preset (menggunakan util `jspdf` + `xlsx` yang sudah dipakai).

### Sidebar Bendahara
Menambahkan 3 menu baru di grup "Tagihan" dan "Keuangan":
- Jenis Pembayaran (grup Master Data)
- Buku Kas (grup Keuangan Sekolah)
- Rekap Tunggakan (grup Tagihan)

## Teknis Singkat

**Migrations (2 tabel baru)**
```sql
-- payment_types
CREATE TABLE public.payment_types (
  id uuid PK, school_id uuid FK schools,
  name text, category text, amount integer,
  applies_to text,           -- 'all' | 'class:<name>' | 'grade:<n>'
  period text,               -- 'monthly'|'semester'|'yearly'|'once'
  is_active boolean default true,
  description text,
  created_at, updated_at
);
-- + GRANT authenticated/service_role, RLS by school_id via get_user_school_id()

-- cash_book_entries
CREATE TABLE public.cash_book_entries (
  id uuid PK, school_id uuid FK,
  entry_date date, direction text CHECK IN ('in','out'),
  category text, amount integer,
  description text, reference text,
  created_by uuid, created_at, updated_at
);
-- + GRANT + RLS by school_id
```
Kas masuk otomatis dari `spp_invoices.status='paid'` dibaca on-the-fly (tidak diduplikasi ke tabel).

**Files yang dibuat/diubah**
- `supabase/migrations/*` — 2 tabel baru + policies.
- `src/pages/bendahara/BendaharaJenisPembayaran.tsx` (baru)
- `src/pages/bendahara/BendaharaBukuKas.tsx` (baru)
- `src/pages/bendahara/BendaharaTunggakan.tsx` (baru)
- `src/pages/bendahara/BendaharaPages.tsx` — tambah kartu dashboard baru (hari/bulan/tahun/jatuh tempo/saldo kas), tambah preset laporan.
- `src/components/layout/BendaharaSidebar.tsx` — 3 menu baru.
- `src/components/layout/BendaharaFloatingNav.tsx` — sinkron menu mobile.
- `src/App.tsx` — 3 route baru.

Tidak ada file existing yang dihapus / distruktur ulang. Data lama & tabel `spp_*` tetap sumber kebenaran; fitur baru menempel di sampingnya dan mendukung multi-tenant lewat `school_id` + RLS.
