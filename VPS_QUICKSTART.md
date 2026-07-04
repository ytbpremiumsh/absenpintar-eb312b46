# VPS Quickstart ATSkolla — Setup dari Nol (~40 menit)

Panduan **urut, copy-paste friendly** untuk deploy ATSkolla ke VPS dengan wildcard subdomain `*.atskolla.com`. DNS di Cloudflare sudah siap (A record `@`, `www`, `*`, `bayar` → IP VPS, semua **DNS-only** / awan abu-abu).

> Ganti `45.128.x.x` dengan IP VPS Anda yang sebenarnya di setiap perintah.
> Ganti `https://github.com/<username>/<repo>.git` dengan URL GitHub project Anda.
>
> Untuk penjelasan lebih mendalam, lihat [`VPS_WILDCARD_SETUP.md`](./VPS_WILDCARD_SETUP.md).

---

## Fase 1 — Login VPS + Update Sistem (5 menit)

Dari komputer Anda:
```bash
ssh root@45.128.x.x
```

Setelah masuk ke VPS:
```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-dns-cloudflare git curl unzip ufw
```

Verifikasi Nginx jalan:
```bash
systemctl status nginx --no-pager
# harus "active (running)"
```

Test buka `http://45.128.x.x` di browser → muncul halaman default Nginx = OK.

---

## Fase 2 — Firewall (2 menit)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

Output harus menampilkan: `22/tcp ALLOW`, `80,443/tcp (Nginx Full) ALLOW`.

---

## Fase 3 — Install Bun + Clone Repo + Build (10 menit)

### 3.1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version   # pastikan muncul versi
```

### 3.2. Clone repository
```bash
mkdir -p /var/www/atskolla
cd /var/www/atskolla
git clone https://github.com/<username>/<repo>.git .
```

> Jika repo private: setup SSH key dulu (`ssh-keygen -t ed25519 -C "vps-atskolla"`, lalu copy `~/.ssh/id_ed25519.pub` ke GitHub → Settings → Deploy keys).

### 3.3. Buat file `.env`
```bash
cat > /var/www/atskolla/.env <<'EOF'
VITE_SUPABASE_URL=https://bohuglednqirnaearrkj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvaHVnbGVkbnFpcm5hZWFycmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODE0NTYsImV4cCI6MjA4ODU1NzQ1Nn0.oK5vxz2mh7o4S22u1bsO8lFxDgT4f9PpPkQmMyZ1Ji8
VITE_SUPABASE_PROJECT_ID=bohuglednqirnaearrkj
EOF
```

### 3.4. Install dependencies & build
```bash
cd /var/www/atskolla
bun install
bun run build
ls -la dist/index.html   # harus ada
```

---

## Fase 4 — Cloudflare API Token untuk SSL (5 menit)

### 4.1. Buat token di Cloudflare
1. Login Cloudflare → klik ikon profil kanan atas → **My Profile**
2. Tab **API Tokens** → tombol **Create Token**
3. Pilih template **"Edit zone DNS"** → **Use template**
4. Bagian **Zone Resources**: pilih `Include` → `Specific zone` → `atskolla.com`
5. Klik **Continue to summary** → **Create Token**
6. **Copy token** yang muncul (hanya tampil sekali — simpan di password manager)

### 4.2. Simpan token di VPS
```bash
mkdir -p /root/.secrets
nano /root/.secrets/cloudflare.ini
```

Isi (paste token yang tadi):
```ini
dns_cloudflare_api_token = PASTE_TOKEN_DI_SINI
```

Simpan (`Ctrl+O`, `Enter`, `Ctrl+X`) lalu amankan permission:
```bash
chmod 600 /root/.secrets/cloudflare.ini
```

---

## Fase 5 — Request Wildcard SSL Let's Encrypt (5 menit)

```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d atskolla.com \
  -d "*.atskolla.com" \
  --agree-tos \
  -m admin@atskolla.com \
  --non-interactive
```

Tunggu ~1–2 menit. Kalau sukses akan muncul:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/atskolla.com/fullchain.pem
```

Verifikasi cert mencakup wildcard:
```bash
certbot certificates
# Cari baris: Domains: atskolla.com *.atskolla.com
```

Test auto-renew:
```bash
certbot renew --dry-run
```

Pasang hook reload Nginx setelah renew (agar cert baru langsung dipakai):
```bash
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/bash
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Fase 6 — Konfigurasi Nginx (5 menit)

### 6.1. Buat config
```bash
nano /etc/nginx/sites-available/atskolla
```

Paste:
```nginx
# HTTP → HTTPS redirect (semua subdomain)
server {
  listen 80;
  listen [::]:80;
  server_name atskolla.com www.atskolla.com *.atskolla.com;
  return 301 https://$host$request_uri;
}

# Main HTTPS server
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

  # Cache hashed assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SPA fallback — WAJIB agar React Router & deep-link jalan
  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
  gzip_min_length 1024;
}
```

### 6.2. Aktifkan
```bash
ln -sf /etc/nginx/sites-available/atskolla /etc/nginx/sites-enabled/atskolla
rm -f /etc/nginx/sites-enabled/default
nginx -t
# harus: "syntax is ok" + "test is successful"
systemctl reload nginx
```

---

## Fase 7 — Verifikasi + Auto-Deploy (5 menit)

### 7.1. Test 4 URL di browser
| URL | Yang harus muncul |
|-----|-------------------|
| `https://atskolla.com` | Landing page marketing |
| `https://www.atskolla.com` | Landing page (sama) |
| `https://smkcendikia.atskolla.com` | Login page ber-branding (jika slug `smkcendikia` sudah ada di DB) |
| `https://random-xyz.atskolla.com` | Halaman "Sekolah tidak ditemukan" |
| `https://bayar.atskolla.com` | App (nanti bisa dibuat route khusus pembayaran) |

Semua harus dengan **gembok hijau SSL valid**.

### 7.2. Script auto-deploy
```bash
cat > /var/www/atskolla/update.sh <<'EOF'
#!/bin/bash
set -e
cd /var/www/atskolla
echo "[$(date)] Pull..."
git pull origin main
echo "[$(date)] Install..."
bun install --frozen-lockfile
echo "[$(date)] Build..."
bun run build
echo "[$(date)] Reload Nginx..."
systemctl reload nginx
echo "[$(date)] Done."
EOF
chmod +x /var/www/atskolla/update.sh
```

Test manual:
```bash
/var/www/atskolla/update.sh
```

### 7.3. Cron auto-pull tiap 10 menit (opsional)
```bash
crontab -e
```
Tambah baris:
```cron
*/10 * * * * /var/www/atskolla/update.sh >> /var/log/atskolla-deploy.log 2>&1
```

---

## Troubleshooting Cepat

| Error | Solusi |
|-------|--------|
| `502 Bad Gateway` | `nginx -t` + cek `/var/log/nginx/error.log`. Biasanya path `dist/` salah. |
| `404` saat refresh halaman | Pastikan blok `try_files $uri $uri/ /index.html;` ada di config Nginx. |
| SSL `NET::ERR_CERT_COMMON_NAME_INVALID` di subdomain | Cert tidak include `*.atskolla.com`. Ulangi Fase 5. |
| Subdomain tidak resolve (`DNS_PROBE_FINISHED_NXDOMAIN`) | Cek `dig +short xxx.atskolla.com` — harus return IP VPS. Kalau tidak, cek Cloudflare A record `*`. |
| Backend error 401/403 (Supabase) | Cek `.env` benar (`VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`), lalu rebuild: `bun run build && systemctl reload nginx`. |
| Session login hilang saat pindah subdomain | **Normal / by design** — localStorage per-origin. Tiap sekolah punya sesi terpisah. |
| `certbot` gagal DNS challenge | Cek token Cloudflare punya permission `Zone.DNS Edit` untuk `atskolla.com`, dan file `/root/.secrets/cloudflare.ini` permission `600`. |

---

## Setelah Selesai

- Setiap sekolah baru yang daftar via `atskolla.com/register` **otomatis** dapat subdomain ber-SSL (`{slug}.atskolla.com`) — tidak perlu konfigurasi DNS tambahan.
- Backend (DB, Auth, Edge Functions, cron `auto-mark-alfa`) tetap di **Lovable Cloud** — tidak ada yang perlu dimigrasi.
- Update kode: cukup push ke GitHub, cron `update.sh` akan auto-pull & rebuild dalam 10 menit. Atau jalankan `/var/www/atskolla/update.sh` manual untuk deploy instant.

Selamat! 🎉 ATSkolla sekarang jalan di infrastruktur sendiri dengan wildcard subdomain.
