
# Perbaikan Akses Subdomain Sekolah ("Tidak Aman")

## Diagnosa singkat

Screenshot menunjukkan `https://surakarta.atskolla.com` = "Tidak Aman". Penyebabnya **bukan bug kode** — Lovable hosting hanya menerbitkan SSL per-domain (bukan wildcard), jadi setiap `*.atskolla.com` / `*.absenpintar.online` tidak punya sertifikat valid. Kode `src/lib/tenant.tsx` sendiri sudah benar mengenali slug.

## Solusi (2 bagian)

### Bagian A — Path-based fallback (kode, jalan sekarang)

Tambahkan URL alternatif yang pasti secure di infra Lovable saat ini:
- Format: `https://absenpintar.online/s/{slug}` (mis. `/s/surakarta`)
- Tenant di-resolve dari param URL, bukan hostname.
- Semua fitur tenant (login, dashboard, dst) tetap jalan sama persis.

### Bagian B — Update tampilan URL sekolah

Di halaman **Pengaturan Sekolah → Identitas**:
- Tombol Copy & tombol "Buka" memakai URL path-based (`/s/{slug}`) — dijamin secure.
- Subdomain (`{slug}.atskolla.com`) tetap ditampilkan sebagai info, dengan catatan kecil: "URL subdomain aktif setelah domain diarahkan ke DNS wildcard".

### Bagian C — Panduan wildcard SSL (opsional, untuk nanti)

Ringkas: pindahkan DNS `atskolla.com` ke Cloudflare (gratis), tambah record `CNAME * → atskolla.com` proxied, aktifkan Universal SSL. Setelah itu subdomain otomatis HTTPS. Ini dilakukan di luar aplikasi kapan pun Anda siap.

## Detail Teknis

**File yang diubah:**
- `src/lib/tenant.tsx` — `parseSubdomain()` juga cek `location.pathname` untuk `/s/{slug}`; `buildTenantUrl()` prefer path-based; ekspor `stripTenantPathPrefix()` untuk router.
- `src/App.tsx` (router) — route `/s/:slug/*` menyalurkan ke tree tenant yang sama; basename disesuaikan agar link internal tetap konsisten.
- `src/pages/SchoolSettings.tsx` — Copy & Open button pakai path-based URL, tambah catatan kecil di bawah field subdomain.

**Tidak diubah:** database, edge functions, auth flow.

## Verifikasi

- Buka `https://absenpintar.online/s/surakarta` → harus load dashboard sekolah "Surakarta" dengan gembok hijau.
- Copy URL dari Pengaturan Sekolah → hasilkan URL path-based.
- Subdomain lama tetap berfungsi jika DNS/SSL sudah benar.
