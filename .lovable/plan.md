## 1. Hapus Semua Halaman Affiliate

**File halaman & hook yang dihapus:**
- `src/pages/AffiliateRegister.tsx`
- `src/pages/AffiliateLogin.tsx`
- `src/pages/AffiliateDashboard.tsx`
- `src/pages/TeacherAffiliate.tsx`
- `src/pages/super-admin/SuperAdminAffiliate.tsx`
- `src/hooks/useTeacherAffiliate.ts`

**Referensi yang dibersihkan:**
- `src/App.tsx` — hapus 5 route & lazy import Affiliate
- `src/components/layout/AppLayout.tsx` — hapus menu "Affiliate & Komisi" di dropdown guru
- `src/components/layout/SuperAdminLayout.tsx` — hapus menu "Affiliate" super admin
- `src/components/landing/LandingThemeB.tsx` — hapus link footer "Affiliate"
- `src/pages/super-admin/SuperAdminRegistrationWA.tsx` — hapus template WA "Pencairan Dana Affiliate Guru" & pilihan event terkait

**Catatan database:** tabel `affiliates`, `affiliate_commissions`, `affiliate_withdrawals`, `referrals` tetap dipertahankan (data historis) — hanya UI dihapus, tanpa migrasi.

---

## 2. Ringankan Animasi

Terapkan pengurangan animasi yang **berdampak besar** tanpa menyentuh puluhan file secara acak:

**a. Nonaktifkan animasi global untuk perangkat kelas bawah & user prefer-reduced-motion:**
- Tambah blok CSS di `src/index.css` untuk `@media (prefers-reduced-motion: reduce)` yang menon-aktifkan semua `animation`, `transition`, dan transform framer-motion.
- Turunkan durasi default `fade-in` / `scale-in` / `accordion` dari 300ms → 150ms di `tailwind.config.ts`.

**b. Matikan animasi berat yang tidak esensial di halaman utama:**
- `Dashboard.tsx`: hapus stagger `initial/animate` pada 4 stat cards (loop `motion.div` → `div` biasa). Pertahankan hanya banner utama.
- `Login`/register pages: hapus `AnimatePresence` pada input transisi (tetap fungsional, tanpa slide).
- Landing page (LandingThemeB): kurangi jumlah blur decorative & animasi `motion` menjadi statis pada section non-hero.

**c. Nonaktifkan efek dekoratif berat:**
- Hapus/kurangi `backdrop-blur` besar & `blur-2xl` pada 3-5 hero card yang paling berat (Dashboard, ScanQR, PageHeader).

**Yang TIDAK diubah:** animasi fungsional (dialog open/close, dropdown, toast, accordion) — tetap ada karena bagian dari UX shadcn.

---

## Ringkasan

- 6 file Affiliate dihapus, 5 file referensi dibersihkan.
- 1 tambahan CSS global reduced-motion + tuning durasi tailwind.
- ~3-5 file halaman utama dikurangi animasi dekoratifnya.
- Tidak ada perubahan database.
- Tidak menyentuh fitur inti (absensi, bendahara, wali murid).