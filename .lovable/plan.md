# Panduan VPS Wildcard Subdomain ATSkolla

Saya akan menulis dokumentasi **`VPS_WILDCARD_SETUP.md`** yang berisi panduan lengkap deploy ATSkolla ke VPS dengan dukungan wildcard subdomain (`*.atskolla.com`).

## Arsitektur

```text
User Browser
   ↓ smkcendikia.atskolla.com
Cloudflare DNS (orange cloud OFF / DNS only)
   ↓ A record * → IP VPS
VPS (Ubuntu 22.04)
   ├── Nginx (reverse proxy + wildcard SSL)
   │     ↓ serve dist/index.html + assets
   └── Build statis Vite (folder /var/www/atskolla/dist)
        ↓ JS client baca window.location.hostname
        ↓ TenantProvider resolve slug → schools table
Lovable Cloud (Supabase) — backend tetap di sini
```

VPS hanya jadi **origin server statis + reverse proxy**. Backend (DB, Auth, Edge Functions, cron `auto-mark-alfa`) **tetap di Lovable Cloud** — tidak perlu pindah.

## Isi Dokumentasi yang Akan Dibuat

### 1. Prasyarat
- VPS Ubuntu 22.04+, RAM 1GB minimum, akses root/sudo
- Domain `atskolla.com` sudah terdaftar (boleh di Cloudflare/Niagahoster/dll)
- IP publik VPS (misal `123.45.67.89`)

### 2. DNS Setup (Cloudflare DNS-Only Mode)
- Hapus CNAME `@` dan `*` yang lama (yang ke `absenpintar.lovable.app`)
- Tambah **A record**:
  - `@` → `123.45.67.89` (Proxy: **DNS only / abu-abu**)
  - `www` → `123.45.67.89` (DNS only)
  - `*` → `123.45.67.89` (DNS only) ← wildcard
- Catatan: Proxy harus **OFF** karena SSL akan dihandle Nginx di VPS (Let's Encrypt). Kalau mau pakai Cloudflare proxy, perlu mode "Full (strict)" + Origin Certificate.

### 3. Install Dependencies di VPS
```bash
apt update && apt install -y nginx certbot python3-certbot-nginx python3-certbot-dns-cloudflare git curl
curl -fsSL https://bun.sh/install | bash
```

### 4. Clone Project & Build
```bash
mkdir -p /var/www/atskolla
cd /var/www/atskolla
git clone <repo-github-anda> .
bun install
bun run build   # hasilkan folder dist/
```

`.env` berisi `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (sama dengan Lovable Cloud sekarang).

### 5. Nginx Config Wildcard
File `/etc/nginx/sites-available/atskolla`:
```nginx
server {
  listen 80;
  listen 443 ssl http2;
  server_name atskolla.com www.atskolla.com *.atskolla.com;

  ssl_certificate     /etc/letsencrypt/live/atskolla.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/atskolla.com/privkey.pem;

  root /var/www/atskolla/dist;
  index index.html;

  # SPA fallback — wajib supaya React Router & subdomain routing bekerja
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache asset hashed
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```
Aktifkan: `ln -s /etc/nginx/sites-available/atskolla /etc/nginx/sites-enabled/`

### 6. Wildcard SSL via Let's Encrypt (DNS-01 Challenge)
Wildcard cert **wajib pakai DNS challenge** (HTTP challenge tidak support wildcard).

**Opsi A — Cloudflare API Token (rekomendasi):**
```bash
# Buat token di Cloudflare: Zone.DNS Edit untuk atskolla.com
mkdir -p /root/.secrets && nano /root/.secrets/cloudflare.ini
# Isi: dns_cloudflare_api_token = <TOKEN>
chmod 600 /root/.secrets/cloudflare.ini

certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d atskolla.com -d "*.atskolla.com" \
  --agree-tos -m admin@atskolla.com
```

**Auto-renew:** Certbot sudah pasang cron sendiri (`/etc/cron.d/certbot`). Test: `certbot renew --dry-run`.

### 7. Update Script & Auto-Deploy
Script `update.sh` (sudah ada di project, tinggal sesuaikan):
```bash
#!/bin/bash
cd /var/www/atskolla
git pull origin main
bun install
bun run build
systemctl reload nginx
```
Cron tiap 10 menit (opsional): `*/10 * * * * /var/www/atskolla/update.sh >> /var/log/atskolla.log 2>&1`

### 8. Verifikasi
- `https://atskolla.com` → landing page
- `https://smkcendikia.atskolla.com` → login page ber-branding SMK Cendikia
- `https://random123.atskolla.com` → halaman "Sekolah tidak ditemukan"

### 9. Troubleshooting
- **502/404 di subdomain:** cek `try_files ... /index.html` ada di Nginx
- **SSL invalid:** pastikan cert berisi `*.atskolla.com` (`certbot certificates`)
- **Session login hilang antar subdomain:** ini **by design** (localStorage per-origin); tiap sekolah punya sesi terpisah
- **Backend connection error:** pastikan `.env` Supabase URL benar

### 10. Perbandingan dengan Lovable Hosting
| | Lovable + Cloudflare Proxy | VPS Self-Host |
|---|---|---|
| Wildcard SSL | Otomatis (Cloudflare Universal) | Manual Let's Encrypt DNS-01 |
| Auto-deploy | Push Lovable = live | Perlu `update.sh` + cron |
| Maintenance | Zero | Update OS, Nginx, cert renewal |
| Biaya | Lovable plan saja | + VPS (~$5/bulan) |
| Kontrol | Terbatas | Penuh (custom Nginx, header, dll) |

## File yang akan dibuat/diubah

1. **CREATE** `VPS_WILDCARD_SETUP.md` — dokumentasi lengkap di atas
2. **UPDATE** `WILDCARD_SUBDOMAIN.md` — tambah bagian "Alternatif: Self-Host VPS" yang menunjuk ke dokumen baru

**Tidak ada perubahan kode aplikasi** — `TenantProvider`, `slug` resolver, dan semua kode yang sudah dibuat sebelumnya **otomatis bekerja** di VPS karena hanya membaca `window.location.hostname` di browser.

## Yang TIDAK Termasuk

- Migrasi backend ke self-hosted Supabase (tetap pakai Lovable Cloud)
- Setup PM2/Docker (karena Vite output statis, cukup Nginx serve file)
- Load balancing multi-VPS (belum diperlukan)

Apakah panduan ini sudah sesuai? Klik **Implement plan** untuk saya buatkan file dokumentasinya.
