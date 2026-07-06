
## Manajemen Perangkat RFID ATSkolla

Fitur ini menambahkan manajemen perangkat RFID resmi yang dikendalikan Super Admin, dengan lisensi per sekolah, aktivasi berbasis Device ID + Secret Token, heartbeat, log, dan integrasi ke sistem absensi.

---

### 1. Struktur data (Lovable Cloud / Postgres)

Tabel baru di skema `public`:

- **`rfid_devices`** — inventaris seluruh perangkat resmi
  - `device_id` (unik, format `ATS-RFID-XXXXXX`)
  - `serial_number`, `mac_address` (unik)
  - `activation_code` (kode 8-digit sekali pakai untuk aktivasi awal)
  - `secret_token_hash` (SHA-256 dari secret token — token asli hanya ditampilkan sekali saat generate)
  - `school_id` (nullable — null berarti belum di-assign)
  - `location_label`, `status` (`unassigned` | `assigned` | `active` | `inactive` | `revoked`)
  - `last_online_at`, `last_heartbeat_at`, `last_ip`
  - `firmware_version`, `notes`, `activated_at`

- **`rfid_device_licenses`** — kuota lisensi per sekolah
  - `school_id`, `license_count` (jumlah slot lisensi yang dibeli/dibagi Super Admin)

- **`rfid_device_logs`** — audit trail perangkat
  - `device_id_ref` (fk ke `rfid_devices`), `school_id`, `event_type`
    (`activation` | `heartbeat` | `online` | `offline` | `scan` | `config_change` | `revoke` | `license_change`)
  - `payload jsonb` (data event: card_number, student_id, mac, dll)
  - `created_at`

- **`rfid_size_tiers`** — aturan minimal perangkat berdasarkan jumlah siswa
  - `min_students`, `max_students` (nullable = tak terbatas), `min_devices`
  - Seed default: 0–300 → 1, 301–700 → 2, 701–1200 → 3, 1201+ → 4

Semua tabel: `GRANT` sesuai role, RLS ON, kolom `created_at`/`updated_at`.

### 2. Aturan RLS

- **Super Admin** (`has_role(uid,'super_admin')`) — full CRUD di keempat tabel.
- **School Admin / Bendahara / Teacher** dari sekolah yang sama —
  hanya `SELECT` pada `rfid_devices`, `rfid_device_licenses`, `rfid_device_logs`
  (`school_id = get_user_school_id(uid)`), tidak ada INSERT/UPDATE/DELETE.
- Perangkat sendiri tidak login lewat Supabase auth — komunikasi lewat edge
  function `rfid-device` menggunakan Device ID + Secret Token (verify_jwt=false).

### 3. Edge Function `rfid-device`

Satu endpoint publik (verify_jwt=false) dengan action:

- `activate` — input: `device_id`, `activation_code`, `mac_address`. Validasi:
  device ada, code cocok & belum dipakai, sekolah punya slot lisensi kosong.
  Output: `secret_token` (plaintext, hanya sekali) + `assigned_school_id`.
  Sets `status='active'`, tulis log `activation`.
- `heartbeat` — input: `device_id`, `secret_token`, `firmware_version?`.
  Verifikasi hash token → update `last_heartbeat_at`, `last_online_at`,
  `status='active'`. Log ringan (rate-limited: 1 baris log per 5 menit).
- `scan` — input: `device_id`, `secret_token`, `card_number`, `scanned_at`.
  Wajib `status='active'` DAN heartbeat < 3 menit lalu — kalau tidak,
  reject dengan `device_offline`. Cari siswa via `students.card_number`,
  panggil path absensi yang sudah ada (reuse handler `public-scan-attendance`
  atau tulis langsung ke `attendance_logs` dengan `method='rfid'`).
  Tulis log `scan`.
- `deactivate` (Super Admin only via JWT) — revoke token & set `status='revoked'`.

Job pemarkir offline: karena Lovable Cloud tak menjamin cron di dalam edge
function, kita gunakan **derivasi status di query** — helper SQL / view
menghitung `computed_status` = `active` jika `last_heartbeat_at > now() - 3 min`,
selain itu `offline`. Selain itu, pg_cron per menit (sudah tersedia — dipakai
auto-mark-alfa) memanggil fungsi SQL `mark_offline_rfid_devices()` yang
meng-update `status='inactive'` untuk perangkat yang lewat 3 menit tanpa
heartbeat dan menulis log `offline` sekali.

### 4. UI Super Admin (baru)

Route baru: `/super-admin/rfid` — masuk sidebar Super Admin.

Halaman `SuperAdminRFID.tsx` dengan 3 tab:

1. **Perangkat** — tabel semua device: Device ID, Serial, MAC, Sekolah, Lokasi,
   Status (badge: Aktif/Offline/Belum Aktivasi/Revoked), Last Online, aksi
   (Assign ke sekolah, Regenerate Secret, Revoke, Hapus). Tombol **Tambah
   Perangkat** membuka dialog untuk generate device baru (Device ID otomatis
   `ATS-RFID-XXXXXX`, activation code 8 digit, secret token 32 hex — token
   ditampilkan sekali dengan tombol copy + warning).
2. **Lisensi Sekolah** — daftar sekolah + jumlah lisensi + jumlah aktif +
   status (OK / Kurang / Melebihi). Tombol +/- untuk atur lisensi.
   Tampilkan juga jumlah siswa & minimal perangkat menurut tier.
3. **Aturan Ukuran (Tier)** — CRUD `rfid_size_tiers` (min_students,
   max_students, min_devices).

Tambah tab **Log** di detail perangkat (dialog): 100 event terakhir.

### 5. UI Admin Sekolah (read-only)

Tambahan route `/rfid-devices` di sidebar School Admin — hanya menampilkan
perangkat milik sekolah, status live, dan log. Tanpa tombol edit/hapus.

### 6. Peringatan pada dashboard

- **Dashboard School Admin (`Dashboard.tsx`)** — banner kuning muncul jika
  `count(active_devices) < required_min_devices` (dihitung dari tier siswa).
  Klik → menuju `/rfid-devices`.
- **Dashboard Super Admin** — kartu ringkas: total perangkat, aktif, offline,
  sekolah yang under-licensed.

### 7. Integrasi ke absensi yang sudah ada

- Reuse tabel `attendance_logs` dengan `method='rfid'`.
- Edge function `rfid-device` action `scan` memanggil logika absensi yang
  sudah ada (import shared helper dari `public-scan-attendance`), sehingga
  audio announce, WA notifikasi, dan Alfa-check tetap jalan tanpa perubahan.
- Tidak menambahkan istilah "penjemputan/pickup" — konsisten sekolah.

### 8. Yang TIDAK dilakukan di iterasi ini

- Tidak menyediakan firmware fisik / dokumen hardware.
- Tidak menghitung biaya lisensi otomatis (Super Admin atur manual).
- Tidak menyentuh flow QR / Face lain — hanya menambah channel RFID.

### 9. File yang akan ditambah/diubah (technical)

- Migrasi: 4 tabel + tier seed + fungsi `mark_offline_rfid_devices()` + pg_cron.
- Edge function baru: `supabase/functions/rfid-device/index.ts`.
- `supabase/functions/_shared/rfidAttendance.ts` (helper reuse).
- Frontend:
  - `src/pages/super-admin/SuperAdminRFID.tsx` (baru, 3 tab)
  - `src/pages/SchoolRFIDDevices.tsx` (baru, read-only)
  - Sidebar Super Admin & School Admin diupdate.
  - Route baru di `src/App.tsx`.
  - Banner peringatan tambahan di `src/pages/Dashboard.tsx`.

### 10. Alur singkat aktivasi perangkat

```text
Super Admin ── generate device ──> ATS-RFID-000123 + code:12345678 + token(sekali)
      │
      └── assign device ke Sekolah A (pakai slot lisensi)

Perangkat fisik ── POST /rfid-device action=activate ──> validasi code + lisensi
                                                        └── return secret_token
Perangkat ── POST heartbeat tiap 45s ──> last_heartbeat_at
Perangkat ── POST scan(card) ──> attendance_logs (method=rfid)
Cron 1 menit ── mark_offline_rfid_devices() ──> status=inactive + log offline
```

Setelah kamu setujui plan ini, saya jalankan migrasi dulu, lalu edge function, lalu UI Super Admin, dan terakhir view read-only + banner sekolah.
