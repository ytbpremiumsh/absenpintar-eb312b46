# Auto Wildcard Subdomain `*.atskolla.com`

Setiap sekolah baru otomatis mendapat URL `{slug}.atskolla.com` (mis. `smkcendikia.atskolla.com`).
Slug dibuat otomatis oleh database dari nama sekolah; Super Admin bisa mengubahnya
dari halaman **Manajemen Sekolah**.

## Setup Sekali Pakai (di Cloudflare)

Agar wildcard subdomain bekerja, domain `atskolla.com` harus diproxy oleh Cloudflare:

1. **Tambahkan `atskolla.com` ke Cloudflare** dan ubah nameserver di registrar
   domain ke nameserver Cloudflare.
2. **DNS Records** (Cloudflare → DNS):
   - `CNAME` `@` → `absenpintar.lovable.app` (Proxied / awan oranye ON)
   - `CNAME` `*` → `absenpintar.lovable.app` (Proxied / awan oranye ON)
   - `CNAME` `www` → `absenpintar.lovable.app` (Proxied / awan oranye ON)
3. **SSL/TLS** → Mode **Full**.
4. **SSL/TLS → Edge Certificates** → pastikan **Universal SSL** aktif (mencakup
   wildcard `*.atskolla.com` secara gratis).
5. **Lovable → Project Settings → Domains** → Connect Domain `atskolla.com`:
   - Centang **"Domain uses Cloudflare or a similar proxy"** untuk verifikasi CNAME.
   - Verifikasi cukup pada domain root. Wildcard `*` ditangani oleh Cloudflare
     ke origin yang sama.

Setelah langkah ini selesai sekali, **semua sekolah baru otomatis bisa diakses
via subdomain** tanpa konfigurasi DNS tambahan.

## Cara Sistem Memetakan Subdomain → Sekolah

- File `src/lib/tenant.tsx` membaca `window.location.hostname`, mengekstrak
  subdomain, lalu fetch baris di tabel `schools` berdasarkan kolom `slug`.
- Subdomain yang tidak terdaftar menampilkan halaman *"Sekolah tidak ditemukan"*.
- Domain root (`atskolla.com`, `www.atskolla.com`) tetap menampilkan landing
  page marketing.
- Saat sekolah baru daftar, trigger DB `schools_autoslug` membuat slug unik
  otomatis (collision di-handle dengan suffix `-2`, `-3`, dst).

## Slug yang Dipesan

Subdomain berikut diblokir oleh DB (tidak bisa dipakai sekolah):
`www`, `app`, `api`, `admin`, `super`, `affiliate`, `parent`, `support`, `help`,
`docs`, `blog`, `mail`, `wa`, `whatsapp`, `cdn`, `dashboard`, `login`,
`register`, `monitoring`, `scan`, `public`, `demo`, dll.

## Catatan Sesi Login

Session disimpan di localStorage sehingga **terisolasi per subdomain**. User
yang login di `smkA.atskolla.com` tidak otomatis ikut login di
`smkB.atskolla.com`. Ini sesuai pola multi-tenant.

## Override Host (Opsional)

Jika ingin menambah domain root lain (mis. `absenpintar.online`), tambahkan
ke env `VITE_ROOT_HOSTS` (comma-separated, lowercase). Default sudah mencakup
`atskolla.com`, `absenpintar.online`, `absenpintar.com`, `localhost`.
