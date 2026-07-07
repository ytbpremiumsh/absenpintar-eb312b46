## Tujuan
Menambahkan role **Kepala Sekolah** (`principal`) dan Dashboard khusus sebagai pusat monitoring seluruh aktivitas sekolah (akademik, kehadiran, keuangan, approval). Tidak mengubah fitur yang sudah berjalan.

## Ruang lingkup

### 1. Backend (Migration)
- Tambah nilai `principal` ke enum `app_role`.
- Perluas kebijakan akses (RLS) agar Kepala Sekolah dapat **membaca** seluruh data di sekolahnya (siswa, guru, kelas, absensi, SPP, kas, settlement, pengumuman, izin, jurnal) dan **menyetujui** item approval (izin, pengumuman, pengeluaran kas, pencairan bendahara/settlement).
- Tidak membuat tabel baru — memanfaatkan tabel yang sudah ada.

### 2. Auth & Routing
- Register/ManageStaff: opsi role "Kepala Sekolah".
- SelectRole: kartu Kepala Sekolah.
- Router: `/kepsek` (atau reuse `/admin` view khusus principal) → `PrincipalDashboard`.
- Redirect login: user dengan role principal masuk ke dashboard baru.
- Sidebar principal: menu read-only ke Absensi, SPP, Kas, Pengumuman, Laporan, Approval, Kalender.

### 3. Dashboard Kepala Sekolah — komponen baru
Susunan atas → bawah, mobile-first, semantic tokens (tanpa emoji).

**A. Header Ringkas**
- Nama sekolah, tanggal, jam realtime, kondisi cuaca opsional (skip jika kompleks).

**B. Statistik Utama (grid 6 kartu)**
Total Siswa, Total Guru, Guru Hadir, Siswa Hadir, Kelas Aktif Hari Ini, % Kehadiran Hari Ini.

**C. Monitoring Realtime Pembelajaran**
Ambil dari `teaching_schedules` + `subject_attendance`: daftar kelas berlangsung sekarang (mata pelajaran, guru, jumlah siswa hadir/total, progress bar jam pelajaran).

**D. Monitoring Kehadiran**
- Guru: Hadir / Izin / Sakit / Belum Absen / Tidak Hadir (dari `teacher_attendance_logs`).
- Siswa: ringkasan hari ini + tabel rekap per kelas (dari `attendance_logs` + `classes`).

**E. Dashboard Keuangan**
Total Tagihan, Total Pembayaran, Tunggakan (`spp_invoices`); Saldo Buku Kas (`cash_book_entries`); Dana Menunggu Pencairan + Riwayat Settlement (`spp_settlements`).

**F. Approval Center**
Tab: Izin Siswa (`parent_leave_requests`), Pengumuman (`school_announcements` status draft), Pengeluaran Kas (`cash_book_entries` pending jika ada), Surat (skip jika belum ada tabel), Pencairan (`spp_settlements`, `affiliate_withdrawals`). Aksi Setujui / Tolak dengan catatan.

**G. Grafik Bulanan** (Recharts)
Line/Bar: Absensi Guru, Absensi Siswa, Pembayaran SPP, Pendapatan Kas, Pengeluaran Kas — 6 bulan terakhir.

**H. Notifikasi Penting**
Guru belum isi jurnal hari ini, kelas belum absen, pembayaran masuk hari ini, approval menunggu.

**I. Ranking Kelas**
Berdasarkan % kehadiran, kedisiplinan (jumlah terlambat/alfa terendah), % lunas SPP.

**J. Kalender Kegiatan**
Reuse `school_holidays` + `school_announcements` bertipe agenda + `teaching_schedules` besar → tampilan bulanan sederhana.

**K. Timeline Aktivitas Terbaru**
Union dari absensi, pembayaran, pengumuman, kas, settlement — 20 item terbaru dengan ikon per jenis.

**L. Menu Laporan Cepat**
Tombol download: Rekap Absensi Siswa, Rekap Absensi Guru, Rekap SPP, Buku Kas, Settlement, Jurnal Mengajar → memanggil util export yang sudah ada.

### 4. Perlindungan fitur eksisting
- Tidak menyentuh Dashboard admin/bendahara/wali kelas.
- Semua akses principal bersifat **read-only** kecuali endpoint approval.

## File yang akan dibuat / diubah

**Baru:**
- `src/pages/PrincipalDashboard.tsx`
- `src/components/principal/StatCards.tsx`
- `src/components/principal/LiveClassMonitor.tsx`
- `src/components/principal/AttendanceMonitor.tsx`
- `src/components/principal/FinanceOverview.tsx`
- `src/components/principal/ApprovalCenter.tsx`
- `src/components/principal/MonthlyCharts.tsx`
- `src/components/principal/PrincipalNotifications.tsx`
- `src/components/principal/ClassRanking.tsx`
- `src/components/principal/SchoolCalendar.tsx`
- `src/components/principal/ActivityTimeline.tsx`
- `src/components/principal/QuickReports.tsx`
- `src/components/principal/PrincipalSidebar.tsx`

**Diubah minimal:**
- `App.tsx` (route `/kepsek`)
- `Login.tsx` / `SelectRole.tsx` (redirect + kartu role)
- `Register.tsx`, `ManageStaff.tsx` (opsi role)
- Migration SQL (enum + RLS tambahan)

## Detail teknis
- Data fetching pakai pola project: `useEffect` + `setLoading(false)` di finally.
- Chart: `recharts` (sudah dipakai).
- Realtime: subscribe `attendance_logs`, `teacher_attendance_logs`, `spp_invoices` untuk kartu statistik.
- Timezone WIB/WITA/WIT dari `schools.timezone`.
- Semua warna via token; tanpa emoji; ikon Lucide.

## Konfirmasi cepat
Jalankan plan ini apa adanya, atau ada penyesuaian scope (mis. skip Kalender / Surat)?