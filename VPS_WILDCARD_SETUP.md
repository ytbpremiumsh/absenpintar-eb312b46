# Setup VPS Wildcard Subdomain ATSkolla

Panduan lengkap deploy ATSkolla ke VPS sendiri dengan dukungan wildcard subdomain (`*.atskolla.com`), sehingga setiap sekolah baru otomatis dapat URL seperti `smkcendikia.atskolla.com` tanpa konfigurasi DNS tambahan.

> **Catatan:** Backend (Database, Auth, Edge Functions, cron `auto-mark-alfa`) **tetap berjalan di Lovable Cloud**. VPS hanya menjadi origin server untuk frontend (build statis Vite + Nginx reverse proxy).

---

## Arsitektur

```text
User Browser
   │  smkcendikia.atskolla.com
   ▼
Cloudflare DNS (DNS-only / abu-abu)
   │  A record *.atskolla.com → IP VPS
   ▼
VPS Ubuntu 22.04
   ├── Nginx (wildcard SSL + SPA fallback)
   └── /var/www/atskolla/dist  (build Vite)
         │  JS baca window.location.hostname
         │  TenantProvider → resolve slug
         ▼
Lovable Cloud (Supabase)
   └── Database, Auth, Edge Functions, Storage
```

---

## 1. Prasyarat

- VPS Ubuntu 22.04+ (RAM minimum 1GB, disk 10GB)
- Akses root atau user dengan `sudo`
- IP publik VPS (contoh `123.45.67.89`)
- Domain `atskolla.com` sudah terdaftar dan nameserver mengarah ke Cloudflare (gratis)
- GitHub repository project ATSkolla (dari Lovable → GitHub connector)

---

## 2. Setup DNS di Cloudflare (Mode DNS-Only)

Hapus semua CNAME lama yang mengarah ke `absenpintar.lovable.app`, lalu tambahkan:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| A | `@`  | `123.45.67.89` | **DNS only** (abu-abu) |
| A | `www` | `123.45.67.89` | DNS only |
| A | `*`   | `123.45.67.89` | DNS only |

> **Kenapa Proxy OFF?** Karena SSL akan dihandle Nginx + Let's Encrypt di VPS. Kalau ingin tetap pakai Cloudflare Proxy (orange cloud), gunakan SSL mode **Full (strict)** dan pasang Cloudflare Origin Certificate di VPS.

Tunggu 1–5 menit untuk propagasi DNS. Test:
```bash
dig +short test123.atskolla.com
# harus return IP VPS Anda
```

---

## 3. Install Dependencies di VPS

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-dns-cloudflare git curl unzip

# Install Bun (runtime untuk build Vite)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

---

## 4. Clone Project & Build Pertama

```bash
sudo mkdir -p /var/www/atskolla
sudo chown $USER:$USER /var/www/atskolla
cd /var/www/atskolla

git clone https://github.com/<username>/<repo>.git .

# Buat file .env (jangan commit ke git)
cat > .env <<EOF
VITE_SUPABASE_URL=https://bohuglednqirnaearrkj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=bohuglednqirnaearrkj
EOF

bun install
bun run build
# hasil ada di /var/www/atskolla/dist
```

---

## 5. Konfigurasi Nginx Wildcard

Buat file `/etc/nginx/sites-available/atskolla`:

```nginx
# Redirect HTTP → HTTPS untuk semua subdomain
server {
  listen 80;
  listen [::]:80;
  server_name atskolla.com www.atskolla.com *.atskolla.com;
  return 301 https://$host$request_uri;
}

# Server utama HTTPS
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name atskolla.com www.atskolla.com *.atskolla.com;

  ssl_certificate     /etc/letsencrypt/live/atskolla.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/atskolla.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  root /var/www/atskolla/dist;
  index index.html;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Cache asset hashed (immutable)
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SPA fallback — WAJIB supaya React Router & deep-link bekerja
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Gzip
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
  gzip_min_length 1024;
}
```

Aktifkan dan test:
```bash
sudo ln -s /etc/nginx/sites-available/atskolla /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```

> Jangan reload dulu — SSL certificate belum dibuat. Lanjut ke step 6.

---

## 6. Wildcard SSL via Let's Encrypt (DNS-01 Challenge)

Wildcard certificate **wajib** menggunakan DNS-01 challenge (HTTP-01 tidak mendukung wildcard).

### 6.1. Buat Cloudflare API Token

Di Cloudflare dashboard:
1. **My Profile → API Tokens → Create Token**
2. Template: **Edit zone DNS**
3. Zone Resources: `Include → Specific zone → atskolla.com`
4. Copy token yang dihasilkan.

### 6.2. Simpan Token di VPS

```bash
sudo mkdir -p /root/.secrets
sudo nano /root/.secrets/cloudflare.ini
```

Isi:
```ini
dns_cloudflare_api_token = <PASTE_TOKEN_DI_SINI>
```

Amankan permission:
```bash
sudo chmod 600 /root/.secrets/cloudflare.ini
```

### 6.3. Request Certificate

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d atskolla.com \
  -d "*.atskolla.com" \
  --agree-tos \
  -m admin@atskolla.com \
  --non-interactive
```

Cek hasil:
```bash
sudo certbot certificates
# Pastikan ada: Domains: atskolla.com *.atskolla.com
```

### 6.4. Reload Nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6.5. Auto-Renew

Certbot sudah otomatis pasang cron renewal (`/etc/cron.d/certbot`). Test:
```bash
sudo certbot renew --dry-run
```

Tambahkan hook reload Nginx setelah renew:
```bash
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```
Isi:
```bash
#!/bin/bash
systemctl reload nginx
```
```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 7. Script Auto-Deploy

Buat `/var/www/atskolla/update.sh`:

```bash
#!/bin/bash
set -e
cd /var/www/atskolla

echo "[$(date)] Pulling latest code..."
git pull origin main

echo "[$(date)] Installing dependencies..."
bun install --frozen-lockfile

echo "[$(date)] Building..."
bun run build

echo "[$(date)] Reloading Nginx..."
sudo systemctl reload nginx

echo "[$(date)] Deploy done."
```

```bash
chmod +x /var/www/atskolla/update.sh
```

Auto-update tiap 10 menit (opsional):
```bash
crontab -e
```
Tambah:
```cron
*/10 * * * * /var/www/atskolla/update.sh >> /var/log/atskolla-deploy.log 2>&1
```

---

## 8. Verifikasi

Cek setiap URL:

| URL | Expected |
|-----|----------|
| `https://atskolla.com` | Landing page marketing |
| `https://www.atskolla.com` | Sama dengan root |
| `https://smkcendikia.atskolla.com` | Login page ber-branding "SMK Cendikia" |
| `https://random-tidak-ada.atskolla.com` | Halaman "Sekolah tidak ditemukan" |

Cek SSL grade: https://www.ssllabs.com/ssltest/analyze.html?d=smkcendikia.atskolla.com

---

## 9. Sekolah Baru = Subdomain Otomatis

Setelah setup di atas selesai, **tidak perlu konfigurasi DNS lagi** untuk sekolah baru:

1. Sekolah daftar lewat form di `atskolla.com/register`
2. Trigger database otomatis generate `slug` dari nama sekolah
3. URL `{slug}.atskolla.com` langsung aktif (dilayani wildcard `*` DNS + wildcard SSL)
4. `TenantProvider` di frontend resolve slug dari `window.location.hostname` → fetch data sekolah dari Supabase

---

## 10. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `502 Bad Gateway` | Cek `sudo nginx -t`, lihat log `/var/log/nginx/error.log` |
| `404` saat refresh halaman | Pastikan blok `try_files $uri $uri/ /index.html;` ada di Nginx |
| SSL "NET::ERR_CERT_COMMON_NAME_INVALID" untuk subdomain | Cert tidak include `*.atskolla.com`. Re-run `certbot` step 6.3 |
| Subdomain tidak resolve | Cek DNS: `dig +short xxx.atskolla.com` harus return IP VPS |
| Login session hilang saat pindah subdomain | **By design** — localStorage Supabase Auth bersifat per-origin. Tiap sekolah punya sesi terpisah (justru baik untuk multi-tenant) |
| Backend error / API tidak respon | Cek `.env` Supabase URL & key benar |
| Update tidak ke-pull | `cd /var/www/atskolla && git pull` manual, cek SSH key GitHub |

---

## 11. Perbandingan dengan Lovable Hosting

| Aspek | Lovable + Cloudflare Proxy | VPS Self-Host |
|-------|----------------------------|---------------|
| Wildcard SSL | Otomatis (Cloudflare Universal) | Manual (Let's Encrypt DNS-01) |
| Auto-deploy | Push Lovable = live | Perlu `update.sh` + cron |
| Maintenance OS | Tidak perlu | Update Ubuntu, Nginx, certbot |
| Biaya | Lovable plan saja | + VPS (~Rp 80rb–150rb/bulan) |
| Kontrol header/cache | Terbatas | Penuh (custom Nginx) |
| Skala | Auto-scale | Manual (upgrade RAM/CPU/load balancer) |

---

## 12. Yang TIDAK Termasuk Panduan Ini

- Migrasi backend ke self-hosted Supabase (tetap pakai Lovable Cloud)
- Setup PM2/Docker (build Vite statis cukup di-serve langsung oleh Nginx)
- Load balancing multi-VPS (belum diperlukan untuk skala awal)
- Backup database (sudah dihandle via fitur "Database Backup" di Super Admin)

---

**Selesai!** Setiap sekolah baru yang daftar di ATSkolla langsung dapat subdomain ber-SSL otomatis tanpa intervensi manual.
