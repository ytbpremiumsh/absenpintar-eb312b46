
## Tujuan
1. Hilangkan sistem langganan berpaket (Free / Basic / School / Premium) dari sisi user (Admin Sekolah, Guru, Wali Kelas, Bendahara, dll).
2. Semua sekolah hanya mengenal dua mode: **ATSkolla Payment** (gratis, wajib pakai payment gateway) atau **ATSkolla Mandiri** (bayar per siswa / bulan).
3. Semua fitur dianggap aktif untuk semua sekolah (tidak ada lagi gating berdasarkan tier langganan).
4. Badge "Premium / School / Free" tidak muncul lagi di UI user. Info paket (Payment vs Mandiri) hanya ditampilkan di panel Super Admin.

## Perubahan Frontend

### Yang dihapus / disembunyikan dari user
- **`ActivePlanBadge`** (dipakai di sidebar / header) → tidak dirender lagi di layout user.
- **`PremiumGate`** → ubah jadi pass-through (langsung render `children`), tidak pernah blokir. Ini menghindari harus edit puluhan tempat pemanggilan.
- **Halaman `Subscription.tsx`** & **`LanggananCombined.tsx`** → route `/subscription` dan menu "Langganan" di sidebar dihapus. Add-on (`/addons`) tetap ada sebagai halaman berdiri sendiri.
- **`PlanCardsGrid`**, banner trial premium, countdown trial di dashboard → dihapus dari `Dashboard.tsx`.
- Kartu "premium glassmorphism" di `AppSidebar` yang menampilkan nama tier → diganti kartu ringkas tanpa tier, atau dihapus.
- Referensi tier di `MobileFooterNav`, `PageHeader`, notifikasi, dsb.

### Yang tetap ada untuk user
- Halaman **Paket Sekolah** (`/paket-sekolah`) tetap → pilih Payment vs Mandiri (sudah ada, tidak berubah).
- Halaman **Add-on** (`/addons`) tetap.
- Halaman **WA Credit**, **Custom Domain**, **ID Card** tetap (add-on murni, bukan paket langganan).

### Yang tetap untuk Super Admin
- `SuperAdminPaketSekolah` tetap (kelola Payment/Mandiri).
- `SuperAdminSubscriptions` & `SuperAdminPlans` & `SuperAdminSubscriptionsHub` → route dihapus dari sidebar Super Admin (file boleh tetap ada di codebase agar tidak break, tapi tidak diakses dari menu).
- Di kartu sekolah (`SchoolCard`) & dialog detail: badge tier "Free/Basic/School/Premium" diganti badge **Payment / Mandiri** (sudah ada di halaman Paket Sekolah, tinggal ditarik ke SchoolCard).

## Perubahan Hook / Logic

- **`useSubscriptionFeatures`** → di-refactor jadi selalu return:
  ```
  { planName: "Payment"|"Mandiri", loading: false, features: { all: true }, isPaid: true, ... }
  ```
  Semua flag fitur (`canScanQR`, `canFaceRecognition`, `canRfid`, dsb) di-hardcode `true`, jadi komponen existing yang cek flag tidak error.
- Trial premium logic, downgrade otomatis ke Free → dinonaktifkan (tidak dijalankan).
- Registrasi sekolah baru → tidak lagi auto-grant "Trial Premium"; default `package_type = 'payment'`, `package_status = 'active'`.

## Perubahan Database / Backend
- Tidak menghapus tabel `subscription_plans` / `school_subscriptions` (agar histori tetap aman & tidak break edge functions lain), hanya tidak lagi dipakai dari UI user.
- Edge function terkait trial / plan expiry: dibiarkan tapi tidak dijadwalkan dari UI (opsional dimatikan di iterasi berikutnya).
- Tidak ada migrasi schema di iterasi ini kecuali user memintanya.

## Memory yang harus di-update
- Tambah rule Core: "Tidak ada sistem langganan berpaket. Semua sekolah pakai model Payment atau Mandiri. Semua fitur aktif untuk semua sekolah. Badge tier tidak boleh muncul di UI user."
- Hapus / mark obsolete: `mem://features/subscription-management`, `mem://features/subscription-visibility`, `mem://constraints/subscription-tiers`, `mem://features/school-registration` bagian "auto-grant Trial Premium".

## Konfirmasi yang saya butuhkan sebelum implementasi
1. **Route `/subscription`**: hapus total dari sidebar & App.tsx, atau redirect ke `/paket-sekolah`?
2. **Sekolah existing** yang saat ini `subscription_plan_id` = Premium/School/Basic: perlu di-set default `package_type = 'payment'` sekalian, atau biarkan apa adanya?
3. **`SuperAdminSubscriptions` / `SuperAdminPlans`**: benar-benar dihapus dari menu, atau tetap ada untuk lihat histori?
