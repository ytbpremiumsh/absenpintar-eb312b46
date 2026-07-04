
# Rencana Implementasi

Perubahan besar dibagi 5 modul. Semua dilakukan berurutan agar tidak bentrok migrasi.

---

## 1. Kode Kartu Siswa (16 digit unik)

**Database**
- Tambah kolom `students.card_number TEXT UNIQUE` (16 digit angka).
- Trigger `BEFORE INSERT` generate otomatis jika kosong: 16 digit random, cek unik, retry sampai dapat.
- Backfill semua siswa existing dengan kode unik.

**UI**
- Tampilkan Kode Kartu di daftar Siswa (`Students.tsx`), detail siswa, kartu ID, dan monitoring.
- Read-only (tidak bisa diedit admin, aman & konsisten).
- Tombol "Copy" di detail siswa.

---

## 2. Login Wali Murid via Kode Kartu

**Alur** (di `ParentLogin.tsx`)
- Tab / toggle: "No WhatsApp" vs "Kode Kartu".
- Jika Kode Kartu → cari siswa by `card_number` → ambil `parent_phone` → kirim OTP WA ke nomor itu.
- Verifikasi OTP tetap sama seperti sekarang.

**Edge function**: update `send-otp` (parent portal) untuk terima parameter `card_number` sebagai alternatif `phone`.

---

## 3. Kartu Identitas Digital di Dashboard Wali Murid

Di `ParentDashboard.tsx` tambahkan komponen `StudentIdCard`:
- Layout kartu pelajar portrait: logo sekolah, foto siswa, nama, NIS, kelas, **Kode Kartu 16 digit** (format `XXXX XXXX XXXX XXXX`), QR code.
- Gradient primary, glassmorphism, tombol "Download PNG" (html-to-image sudah ada di project untuk ID card order).
- Muncul di atas widget kehadiran.

---

## 4. Toggle Sistem Langganan Global

**Super Admin**
- Di `SuperAdminSubscriptionsHub.tsx` tambahkan Switch "Aktifkan Sistem Langganan" (simpan di `platform_settings.subscription_enabled`).
- Saat OFF: semua sekolah otomatis diperlakukan sebagai Premium (data langganan & pembayaran tetap disimpan, tidak dihapus).

**Efek di app sekolah**
- `useSubscriptionFeatures` cek flag `subscription_enabled`. Jika `false` → paksa `planName = "Premium"`, semua flag `true`, unlimited.
- Sidebar: ganti menu "Paket Langganan" menjadi "Semua Fitur" (halaman baru read-only yang menampilkan daftar fitur aktif).
- Halaman `Subscription.tsx` & `Addons.tsx` disembunyikan dari sidebar saat OFF, tapi route tetap ada untuk Super Admin.
- Banner trial & warning tidak muncul saat OFF.

**Halaman baru `AllFeatures.tsx`**
- Grid daftar fitur (Monitoring realtime, Scan QR, Face Recognition, Multi-staff, WhatsApp, dst) dengan icon + status "Aktif".

---

## 5. Sistem Libur & Tanggal Merah (per sekolah)

**Database**
- Kolom baru di `schools`: `holiday_mode BOOLEAN DEFAULT false` (toggle darurat "hari ini libur").
- Tabel baru `school_holidays`:
  - `school_id`, `date DATE`, `label TEXT`, `created_at`
  - Unique (school_id, date).
  - RLS: admin sekolah full CRUD untuk `school_id` miliknya; monitoring publik boleh SELECT.

**UI Admin Sekolah** — di `SchoolSettings.tsx` tambah section "Libur":
- Switch besar "Mode Libur Aktif" (toggle `holiday_mode`).
- Kalender interaktif (react-day-picker sudah ada): klik tanggal untuk tandai/hapus tanggal merah, input label opsional.
- List tanggal merah bulan berjalan + tombol hapus.

**Efek ke sistem absensi**
- `auto-mark-alfa` edge function: skip jika `holiday_mode = true` **atau** tanggal ada di `school_holidays`.
- Scanner (Datang/Pulang), face recognition, manual attendance: blokir dengan pesan "Hari ini libur — [label]" saat kondisi terpenuhi.
- Dashboard admin: badge kuning "Mode Libur Aktif" jika ON.

---

## Dampak Lain / Catatan Teknis

- Wali Kelas & Absensi Guru: sudah ada (`WaliKelasDashboard`, `teacher_attendance_logs`) — tidak menambah baru, hanya pastikan menu accessible.
- Migrasi dilakukan sekali besar (add column + trigger + backfill + tabel baru + kolom schools). GRANT + RLS lengkap.
- `useSubscriptionFeatures` di-refactor supaya baca `platform_settings.subscription_enabled` sekali (di-cache).
- Kartu digital wali murid pakai `html-to-image` (sudah dipakai di `OrderIdCard`).

---

## Urutan Eksekusi

1. Migrasi DB (kode kartu + trigger + backfill + `school_holidays` + `schools.holiday_mode` + `platform_settings.subscription_enabled` default true).
2. Update UI Students + detail (tampilkan kode kartu).
3. Update ParentLogin + edge function untuk login via kode kartu.
4. StudentIdCard di ParentDashboard.
5. Toggle langganan Super Admin + refactor `useSubscriptionFeatures` + halaman "Semua Fitur" + sidebar swap.
6. Libur & tanggal merah di SchoolSettings + guard di scanner/edge functions.

Perkiraan: 6 batch perubahan, masing-masing bisa diverifikasi terpisah.
