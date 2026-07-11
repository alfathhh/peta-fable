# HOWTO — Menjalankan & Men-deploy Peta Tematik Padang Pariaman

> Panduan praktis. Untuk konteks fitur/arsitektur baca `docs/` (mulai dari `docs/PRD.md`).
> Aturan & larangan untuk AI coding agent ada di `CLAUDE.md`.

Daftar isi:
1. [Development lokal](#1-development-lokal)
2. [Import data wilayah asli](#2-import-data-wilayah-asli)
3. [Test, lint, typecheck](#3-test-lint-typecheck)
4. [Deploy ke VPS — Opsi A: Docker Compose (disarankan)](#4-deploy-ke-vps--opsi-a-docker-compose-disarankan)
5. [TLS/HTTPS di VPS (nginx host + certbot)](#5-tlshttps-di-vps-nginx-host--certbot)
6. [Deploy ke VPS — Opsi B: tanpa Docker (PM2 + nginx)](#6-deploy-ke-vps--opsi-b-tanpa-docker-pm2--nginx)
7. [Update aplikasi (redeploy)](#7-update-aplikasi-redeploy)
8. [Backup & restore database](#8-backup--restore-database)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Development lokal

Prasyarat: Node.js 20+, Docker Desktop (untuk PostgreSQL + PostGIS).

```bash
# 1. Install semua workspace (root + backend + frontend)
npm install

# 2. Nyalakan database dev (PostGIS di port 5433, DB test di 5434)
docker compose up -d db

# 3. Siapkan backend
cd backend
cp .env.example .env        # isi JWT_SECRET dengan string acak, sesuaikan PORT bila perlu
npx prisma migrate deploy
npm run seed                 # admin/admin123, petugas1/admin123 — token kegiatan dicetak di console
npm run dev                  # API di http://localhost:3001 (atau PORT di .env)

# 4. Frontend (terminal lain)
cd frontend
npm run dev                  # http://localhost:5173, proxy /api → backend (lihat vite.config.ts)
```

Login dev: `admin` / `admin123` (admin) atau `petugas1` / `admin123` (petugas).

> Catatan Windows: bila port 3000 dipakai proses lain (mis. Docker Desktop backend),
> ganti `PORT` di `backend/.env` dan `VITE_API_TARGET`/target proxy di `frontend/vite.config.ts`.

## 2. Import data wilayah asli

Seed hanya membuat wilayah dummy (persegi) supaya peta & resolver bisa dites tanpa data asli.
Untuk data BPS sungguhan:

```bash
cd backend
npm run import:regions -- --file=../data/geojson/kab.geojson --level=kab
npm run import:regions -- --file=../data/geojson/kec.geojson --level=kec
npm run import:regions -- --file=../data/geojson/desa.geojson --level=desa
npm run import:regions -- --file=../data/geojson/sls.geojson --level=sls
npm run import:regions -- --file=../data/geojson/subsls.geojson --level=subsls
```

File GeoJSON mentah diletakkan di `data/` dan **tidak boleh di-commit / diakses publik**
(lihat `docs/ARCHITECTURE.md` §5) — cukup dipakai sekali untuk import, sumber kebenaran
setelahnya adalah tabel `regions` di PostGIS.

> **Penting:** setelah import via CLI, **restart backend**. Server menyimpan cache
> GeoJSON di memori dan CLI berjalan di proses terpisah, jadi peta masih menampilkan
> data lama sampai server di-restart. (Upload lewat halaman admin tidak perlu restart —
> cache dibersihkan otomatis.)

## 3. Test, lint, typecheck

```bash
npm test                       # semua workspace
npm run lint && npm run typecheck

# test API backend butuh database test terpisah:
docker compose up -d db_test
cd backend
$env:DATABASE_URL='postgresql://peta:peta@localhost:5434/peta_test'   # bash: export DATABASE_URL=...
npx prisma migrate deploy      # migrate DB test (bukan DB dev)
$env:DATABASE_URL_TEST='postgresql://peta:peta@localhost:5434/peta_test'
$env:JWT_SECRET='test-secret'
npm test
```

---

## 4. Deploy ke VPS — Opsi A: Docker Compose (disarankan)

Paling sederhana dirawat: satu `docker-compose.prod.yml` menjalankan DB + backend + frontend
sebagai container, nginx di VPS menangani HTTPS di depannya.

**Prasyarat VPS**: Ubuntu 22.04+ (atau setara), akses root/sudo, domain yang sudah
di-pointing (A record) ke IP VPS.

### 4.1 Siapkan server

```bash
# Install Docker Engine + plugin compose (skrip resmi Docker)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Firewall dasar — hanya SSH, HTTP, HTTPS yang terbuka ke publik
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 4.2 Ambil kode & konfigurasi

```bash
git clone <url-repo-anda> peta-fable
cd peta-fable
cp .env.prod.example .env.prod
nano .env.prod   # isi DB_PASSWORD, JWT_SECRET (acak, panjang), CORS_ORIGIN=https://domain-anda
```

`CORS_ORIGIN` **harus** persis domain publik (dengan `https://`), karena backend menolak
origin lain (`docs/ARCHITECTURE.md` §8 — CORS whitelist).

### 4.3 Build & jalankan

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml ps   # pastikan db, backend, frontend "Up"
```

Migration Prisma jalan otomatis setiap kali container `backend` start (lihat `backend/Dockerfile`).
Untuk seed data awal (sekali saja, opsional — biasanya untuk demo/staging):

```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

Frontend sekarang bisa diakses di `http://127.0.0.1:8080` **dari VPS itu sendiri** (belum
publik — port sengaja hanya bind ke localhost, lihat §5 untuk expose via HTTPS).

### 4.4 Import data wilayah asli di server

```bash
docker compose -f docker-compose.prod.yml exec backend \
  npx tsx src/cli/importRegions.ts --file=/app/backend/data-import/kec.geojson --level=kec
```

Salin file geojson ke VPS dulu (mis. `scp`), lalu `docker cp` ke dalam container, atau mount
volume sementara — pilih salah satu, jangan bake file mentah ke image (aturan privasi geojson).

---

## 5. TLS/HTTPS di VPS (nginx host + certbot)

Frontend container hanya bind ke `127.0.0.1:8080` (lihat `docker-compose.prod.yml`) — nginx
di **host** (bukan di dalam Docker) yang menerima trafik publik 80/443 dan menerus­kannya.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp deploy/nginx.host.conf.example /etc/nginx/sites-available/peta.conf
sudo nano /etc/nginx/sites-available/peta.conf   # ganti "peta.contoh.go.id" dengan domain asli
sudo ln -s /etc/nginx/sites-available/peta.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Terbitkan sertifikat + otomatis tambah blok HTTPS & redirect di config di atas
sudo certbot --nginx -d peta.contoh.go.id
```

Certbot otomatis memasang cron/systemd timer untuk perpanjangan. Cek dengan
`sudo certbot renew --dry-run`.

Setelah ini, `https://peta.contoh.go.id` sudah melayani aplikasi. Cek cepat:

```bash
curl -s https://peta.contoh.go.id/api/health   # {"ok":true}
```

---

## 6. Deploy ke VPS — Opsi B: tanpa Docker (PM2 + nginx)

Dipakai kalau VPS tidak boleh/tidak bisa memakai Docker. Lebih banyak langkah manual.

```bash
# Node 20 (via nvm), PostgreSQL 16 + PostGIS 3, nginx, pm2
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20
sudo apt install -y postgresql-16 postgresql-16-postgis-3 nginx
npm install -g pm2

# Buat DB + extension
sudo -u postgres psql -c "CREATE USER peta WITH PASSWORD 'ganti-password';"
sudo -u postgres psql -c "CREATE DATABASE peta OWNER peta;"
sudo -u postgres psql -d peta -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Ambil kode, install, build
git clone <url-repo-anda> peta-fable && cd peta-fable
npm install
cd backend
cp .env.example .env
nano .env   # DATABASE_URL ke Postgres lokal di atas, JWT_SECRET, CORS_ORIGIN=https://domain-anda, PORT=3001
npx prisma migrate deploy
npm run seed   # opsional

cd ../frontend
npm run build   # hasil di frontend/dist — SPA statis
```

Jalankan backend dengan PM2 (auto-restart, jalan sebagai service):

```bash
cd ../backend
pm2 start "npx tsx src/index.ts" --name peta-backend
pm2 save
pm2 startup   # ikuti instruksi yang ditampilkan agar pm2 start saat boot
```

Nginx host menyajikan `frontend/dist` sebagai statis dan proxy `/api` ke backend PM2
(port dari `PORT` di `backend/.env`, mis. 3001) — pakai isi `deploy/nginx.frontend.conf`
sebagai referensi, tapi ganti:
- `root` → path absolut ke `frontend/dist` di server (bukan `/usr/share/nginx/html`)
- `proxy_pass http://backend:3000/api/` → `proxy_pass http://127.0.0.1:3001/api/`

Lalu pasang HTTPS dengan certbot seperti §5 (`certbot --nginx -d domain-anda`).

---

## 7. Update aplikasi (redeploy)

**Opsi A (Docker):**
```bash
cd peta-fable
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
Migration Prisma baru otomatis jalan saat container backend restart.

**Opsi B (PM2):**
```bash
cd peta-fable && git pull
npm install
cd backend && npx prisma migrate deploy && cd ..
cd frontend && npm run build && cd ..
pm2 restart peta-backend
```

## 8. Backup & restore database

**Otomatis harian (disarankan)** — skrip `deploy/backup.sh` mem-backup DB (pg_dump gzip)
+ arsip volume storage (foto & layer), dengan rotasi 30 hari. Pasang cron di VPS:

```bash
chmod +x deploy/backup.sh
crontab -e
# tambahkan (backup jam 02:00, log ke file):
0 2 * * * /opt/peta-fable/deploy/backup.sh >> /var/log/peta-backup.log 2>&1
```

Hasil di `<repo>/backups/`: `peta-db-<tanggal>.sql.gz` + `peta-storage-<tanggal>.tar.gz`.
**Uji restore berkala** — backup yang tidak pernah diuji sama dengan tidak ada backup.

Restore manual:
```bash
gunzip -c backups/peta-db-2026-07-10-0200.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U peta peta
```

Non-Docker (Opsi B): `pg_dump`/`psql` biasa ke database `peta` lokal + tar `backend/storage/`,
dijadwalkan cron serupa (PRD §7 — "Backup DB harian").

Health/readiness: container backend punya endpoint `GET /api/ready` (cek DB benar-benar
terjangkau, dipakai healthcheck compose) selain `GET /api/health` (proses hidup).

## 9. Troubleshooting

| Gejala | Kemungkinan sebab / solusi |
|---|---|
| `CORS error` di browser | `CORS_ORIGIN` di backend tidak persis sama dengan domain (termasuk `https://`, tanpa trailing slash) |
| Peta blank / basemap tidak muncul | Endpoint tile Google (`mt1.google.com`) diblokir jaringan VPS/negara → set `VITE_BASEMAP_FALLBACK=1` saat build frontend, pakai OSM/Esri |
| `GET /api/regions` 401 terus | JWT_SECRET beda antara saat generate token (mungkin dari deploy lama) dan sekarang — user perlu login ulang |
| Foto/layer hilang setelah redeploy | `backend/storage/` tidak di-mount sebagai volume persisten — cek `docker-compose.prod.yml` volume `backend_storage` |
| `prisma migrate deploy` gagal (PostGIS) | Pastikan image DB adalah `postgis/postgis:16-3.4`, bukan `postgres` biasa |
| Upload geojson/shp gagal (413) | Naikkan `client_max_body_size` di nginx (host & container) — lihat `deploy/nginx.frontend.conf` |
