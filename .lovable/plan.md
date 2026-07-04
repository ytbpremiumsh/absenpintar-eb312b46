# Setup VPS ATSkolla — Step-by-Step Mulai dari Nol

DNS di Cloudflare sudah **benar dan siap** (A record `@`, `www`, `*`, `bayar` → `45.128.x.x`, semua DNS-only). Sekarang tinggal setup VPS-nya. Saya akan pandu berurutan, per fase, supaya mudah diikuti.

## Yang Sudah OK
- Wildcard DNS `*.atskolla.com` → VPS ✅
- Proxy Cloudflare abu-abu (DNS only) → cocok untuk Let's Encrypt di VPS ✅
- `bayar.atskolla.com` juga ke VPS yang sama → otomatis kena wildcard SSL, bisa dipakai untuk halaman pembayaran khusus ✅

## Yang Akan Dilakukan

Karena VPS **belum disentuh sama sekali**, saya akan buat **1 file panduan baru** yang ringkas, urut, dan bisa dicopy-paste langsung ke terminal VPS. Panduan lama (`VPS_WILDCARD_SETUP.md`) tetap ada sebagai referensi lengkap, panduan baru ini versi **quick-start berurutan**.

## File yang Akan Dibuat

**`VPS_QUICKSTART.md`** — panduan berurutan 7 fase:

### Fase 1 — Login & Update VPS (5 menit)
```bash
ssh root@45.128.x.x
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-dns-cloudflare git curl unzip ufw
```

### Fase 2 — Firewall (2 menit)
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

### Fase 3 — Install Bun + Clone Repo (10 menit)
- Install Bun runtime
- Clone repo GitHub ATSkolla ke `/var/www/atskolla`
- Buat file `.env` dengan `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- Jalankan `bun install && bun run build`

### Fase 4 — Cloudflare API Token untuk SSL (5 menit)
- Panduan bergambar cara buat token di Cloudflare dashboard (Zone.DNS Edit untuk `atskolla.com`)
- Simpan ke `/root/.secrets/cloudflare.ini` dengan permission 600

### Fase 5 — Request Wildcard SSL (5 menit)
```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d atskolla.com -d "*.atskolla.com" \
  --agree-tos -m admin@atskolla.com --non-interactive
```
Verifikasi cert include `*.atskolla.com`.

### Fase 6 — Nginx Config (5 menit)
- Buat `/etc/nginx/sites-available/atskolla` (wildcard `server_name`, SSL, SPA fallback, gzip, security headers)
- Symlink ke `sites-enabled`, hapus default
- `nginx -t && systemctl reload nginx`

### Fase 7 — Verifikasi & Auto-Deploy (5 menit)
- Test 4 URL:
  - `https://atskolla.com` → landing
  - `https://smkcendikia.atskolla.com` → login ber-branding (kalau slug ada)
  - `https://random.atskolla.com` → "Sekolah tidak ditemukan"
  - `https://bayar.atskolla.com` → serve app (nanti bisa dibuat route khusus)
- Pasang `update.sh` + cron `*/10 * * * *` untuk auto-pull dari GitHub

### Bonus — Checklist Troubleshooting Cepat
Tabel 5 error paling umum (502, 404 refresh, SSL invalid, subdomain no resolve, Supabase 401) + solusi 1 baris.

## Yang TIDAK Diubah
- Kode aplikasi (tidak perlu — `TenantProvider` sudah universal)
- Backend Lovable Cloud (tetap di sana)
- File `VPS_WILDCARD_SETUP.md` (tetap sebagai referensi lengkap)
- File `WILDCARD_SUBDOMAIN.md` (sudah link ke panduan lama)

## Estimasi Total Waktu
~40 menit dari VPS kosong sampai `smkcendikia.atskolla.com` bisa diakses dengan SSL valid.

Klik **Implement plan** untuk saya buatkan file `VPS_QUICKSTART.md`-nya.
