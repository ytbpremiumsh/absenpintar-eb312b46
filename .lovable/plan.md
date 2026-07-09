# Sistem Paket Sekolah ATSkolla

Menambahkan sistem dua paket sekolah tanpa mengubah/menghapus fitur existing (Free/Basic/Premium/School tetap berjalan). Ini adalah **lapisan baru** untuk model bisnis payment-based.

## 1. Konsep Paket

| Paket | Biaya | Wajib Payment ATSkolla | Konsekuensi |
|---|---|---|---|
| **ATSkolla Payment** | Gratis | Ya | Auto-suspend jika 90 hari tanpa aktivitas payment |
| **ATSkolla Mandiri** | Rp 1.000/siswa/bulan | Tidak | Tidak ada suspend berbasis payment |

Semua fitur tetap aktif di kedua paket.

## 2. Database (migrasi baru)

**Tambah kolom di `schools`:**
- `package_type` text default `'payment'` — `'payment' | 'mandiri'`
- `package_status` text default `'active'` — `'active' | 'pending_activation'`
- `package_status_changed_at` timestamptz
- `last_payment_activity_at` timestamptz — di-update oleh trigger dari `spp_invoices`, `payment_transactions`, `spp_settlements`
- `mandiri_monthly_rate` bigint default 1000

**Tabel baru `package_settings` (global, 1 row):**
- `grace_period_days` int default 90
- `disabled_features` jsonb default `["attendance_create","scan_qr","face_recognition","rfid"]`

**Tabel baru `package_audit_log`:**
- `school_id`, `action` (`suspended|reactivated|package_changed`), `old_value`, `new_value`, `reason`, `actor_user_id`, `created_at`

**Trigger `touch_payment_activity`:** update `schools.last_payment_activity_at = now()` saat insert `spp_invoices`, insert `payment_transactions` (status paid), insert `spp_settlements`.

## 3. Edge Function + Cron

**`check-package-status`** (edge function, cron harian 01:00 WIB):
- Untuk semua sekolah `package_type='payment'` & `package_status='active'`:
  - Jika `last_payment_activity_at < now() - grace_period_days` → set `pending_activation`, log ke audit.
- Untuk sekolah `pending_activation` yang punya aktivitas baru → auto-reactivate + log.

## 4. Frontend — Enforcement

**Hook baru `usePackageStatus.ts`** — fetch `package_type`, `package_status`, `disabled_features`.

**Guard di halaman absensi:** `Scan.tsx`, `PublicMonitoring.tsx`, RFID scan endpoint, face recognition — jika `package_status='pending_activation'` dan feature termasuk di `disabled_features`, tampilkan banner + block action.

**Banner komponen `PackageStatusBanner.tsx`** di `AppLayout`:
- Muncul saat `pending_activation`
- CTA: "Aktifkan Pembayaran ATSkolla" (arah ke `/bendahara`) & "Beralih ke Paket Mandiri" (dialog konfirmasi).

## 5. Halaman Admin Sekolah

**`/paket-sekolah`** (baru, di menu Pengaturan):
- Info paket saat ini, status, hari sejak aktivitas payment terakhir.
- Tombol ubah paket (Payment ↔ Mandiri) dengan konfirmasi.
- Estimasi biaya Mandiri: jumlah siswa × Rp 1.000.

## 6. Super Admin

**`/super-admin/paket-sekolah`** (baru):
- Tabel semua sekolah: nama, package_type, package_status, `days_since_payment`, tombol **Aktifkan Kembali** & **Ubah Paket**.
- Panel pengaturan global: `grace_period_days`, checklist fitur yang dinonaktifkan.
- Filter status.
- Semua aksi tercatat di `package_audit_log`.
- Link ke halaman audit log paket.

## 7. Detail Teknis

- Reuse `useSubscriptionFeatures` — tidak diubah. Package baru bersifat orthogonal.
- Route baru didaftarkan di `src/App.tsx`.
- Menu sidebar admin: item "Paket Sekolah" di grup Pengaturan.
- Menu SuperAdmin sidebar: item "Paket Sekolah" di hub Sekolah/Langganan.
- Cron dijadwalkan via `pg_cron` + `pg_net` memanggil edge function.
- Tidak ada data yang dihapus saat suspend — hanya action yang di-block.
- RLS: `package_settings` & `package_audit_log` hanya super_admin write; sekolah read miliknya sendiri.

## 8. Urutan Implementasi

1. Migrasi DB (kolom + tabel + trigger + grants + RLS).
2. Edge function `check-package-status` + jadwalkan cron.
3. Hook `usePackageStatus` + `PackageStatusBanner` di `AppLayout`.
4. Guard di halaman scan/RFID/face.
5. Halaman admin `/paket-sekolah`.
6. Halaman super admin `/super-admin/paket-sekolah` + audit log viewer.
7. Registrasi route + item sidebar.
