# Peta Tematik Kabupaten Padang Pariaman

Aplikasi web peta tematik (kab `1306`): wilayah 5 level (kab→kec→desa→SLS→sub-SLS),
pinpoint infrastruktur berikon per kategori, dan manajemen kegiatan lapangan berbasis token.
Dokumentasi lengkap ada di [docs/](docs/README.md) — mulai dari `docs/PRD.md`.
Panduan langkah-demi-langkah (dev & deploy ke VPS) ada di **[howto.md](howto.md)**.

## Menjalankan (development)

Prasyarat: Node.js 20+, Docker (untuk PostgreSQL + PostGIS).

```bash
# 1. Install semua workspace
npm install

# 2. Nyalakan database (PostGIS di port 5433, DB test di 5434)
docker compose up -d db

# 3. Siapkan backend
cd backend
cp .env.example .env        # sesuaikan bila perlu (PORT default 3000)
npx prisma migrate deploy
npm run seed                # password semua akun dari SEED_ADMIN_PASSWORD; token dicetak di console
npm run dev                 # API di http://localhost:3000

# 4. Frontend (terminal lain)
cd frontend
npm run dev                 # http://localhost:5173 (proxy /api → :3000)
```

Login dev: `admin` atau `petugas1`, dengan password dari `SEED_ADMIN_PASSWORD`.

## Import data wilayah asli

Seed hanya membuat wilayah dummy (persegi). Untuk data BPS asli:

```bash
cd backend
npm run import:regions -- --file=../data/geojson/kec.geojson --level=kec
# ulangi untuk kab, desa, sls, subsls
```

File GeoJSON mentah diletakkan di `data/` dan **tidak boleh di-commit / diakses publik**
(lihat `docs/ARCHITECTURE.md` §5).

## Test, lint, typecheck

```bash
npm test                       # semua workspace
npm run lint && npm run typecheck

# test API backend butuh DB test:
docker compose up -d db_test
cd backend
set DATABASE_URL_TEST=postgresql://peta:peta@localhost:5434/peta_test   # PowerShell: $env:DATABASE_URL_TEST=...
npx prisma migrate deploy      # dengan DATABASE_URL menunjuk DB test
npm test
```

## Struktur

- `backend/` — Express 4 + TypeScript + Prisma + PostGIS (REST API, JWT)
- `frontend/` — React 18 + Vite + Leaflet + Tailwind (SPA)
- `docs/` — PRD, arsitektur, skema DB, spesifikasi API, tasks, keputusan PO
- `data/` — geojson mentah (privat, gitignore)
