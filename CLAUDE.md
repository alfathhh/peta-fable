# AGENTS.md — Panduan untuk AI Coding Agent

> File ini dibaca oleh AI coding agent (Claude Code, Cursor, dll) **dan** oleh developer.
> Isinya: konteks proyek, perintah penting, aturan yang tidak boleh dilanggar.
> Simpan salinan/symlink sebagai `CLAUDE.md` di root repo jika memakai Claude Code.

---

## Konteks Proyek (baca dulu)

Aplikasi web peta tematik Kabupaten Padang Pariaman (kode BPS `1306`):
peta wilayah 5 level (kab→kec→desa/nagari→sls/korong→subsls), pinpoint infrastruktur
dengan ikon per kategori, manajemen kegiatan lapangan berbasis token,
**2 peran saja: `admin` dan `petugas`**.

Dokumen sumber kebenaran (JANGAN mengarang requirement di luar ini):
- `docs/PRD.md` — apa yang dibangun
- `docs/ARCHITECTURE.md` — stack & pola
- `docs/DATABASE.md` — skema
- `docs/API-SPEC.md` — kontrak endpoint
- `docs/TASKS.md` — urutan pengerjaan
- `docs/DECISIONS.md` — keputusan product owner (mengikat)

Kalau requirement ambigu → tulis asumsi di PR description, jangan diam-diam memutuskan.

## Stack (JANGAN diganti tanpa persetujuan)

- **Full JavaScript/TypeScript. DILARANG: PHP/Laravel, DILARANG: Next.js.**
- Backend: Node.js 20 + Express 4 + TypeScript, Prisma (+ raw SQL untuk PostGIS),
  JWT (`jsonwebtoken`) + `bcryptjs`, zod, multer, exceljs, express-rate-limit
- DB: PostgreSQL 16 + PostGIS (WAJIB — banyak logika pakai fungsi ST_*)
- Frontend: React 18 + Vite + TypeScript (SPA), Leaflet 1.9 + markercluster,
  Tailwind + shadcn/ui, zustand, lucide-react (ikon kategori), shpjs,
  browser-image-compression
- Testing: vitest (+ supertest di BE)
- Monorepo npm workspaces: `backend/`, `frontend/`

## Perintah Penting

```bash
# Root
npm install                          # install semua workspace

# Backend (folder backend/)
cp .env.example .env                 # isi DATABASE_URL, JWT_SECRET, dll
npx prisma migrate dev               # migrasi (termasuk SQL manual PostGIS)
npm run seed                         # admin + kategori + data dummy (token dicetak di console)
npm run dev                          # tsx watch, http://localhost:3000
npm test                             # vitest + supertest — WAJIB hijau sebelum commit
npm run lint && npm run typecheck    # WAJIB lolos sebelum commit

# Import data wilayah (sekali di awal / saat file berubah)
npm run import:regions -- --file=../data/geojson/kec.geojson --level=kec

# Frontend (folder frontend/)
npm run dev                          # http://localhost:5173 (proxy /api → :3000)
npm run build
npm run lint && npm run typecheck
```

## Aturan Domain yang TIDAK BOLEH Dilanggar

1. **Id wilayah selalu string**, bukan number. Panjang menentukan level:
   4=kab, 7=kec, 10=desa, 14=sls, 16=subsls. Relasi parent-child = prefix
   (`child.startsWith(parent)`). Helper: `backend/src/lib/regionId.ts` dan
   `frontend/src/utils/regionId.ts` (logika identik) — pakai helper itu,
   jangan tulis ulang logika.
2. **Sorting wilayah** = order by id sebagai string ascending.
3. **Infrastruktur tidak pernah ditampilkan tanpa filter.** `GET /infrastructures`
   harus menolak (422) request tanpa `category_id`/`q`.
4. **Koordinat infrastruktur milik petugas berasal dari GPS** — tidak ada input
   manual lat/lng di UI petugas, dan endpoint update menolak perubahan lat/lng
   dari peran petugas.
5. **Otorisasi di backend** (middleware `auth` + `requireRole` + cek kepemilikan
   di service), bukan cuma menyembunyikan tombol di React.
6. **Hanya 2 role: `admin` dan `petugas`.** Jangan menambah role lain.
7. Token kegiatan: 7 karakter dari alfabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
   (tanpa 0,O,1,I,L), unik, punya `expires_at`. Klaim dicek dalam transaction
   dengan increment atomik `claims_count`.
8. **Load wilayah on-demand.** Jangan pernah membuat endpoint/kode yang mengirim
   seluruh subsls se-kabupaten sekaligus.
9. **Basemap**: keputusan PO (lihat `docs/DECISIONS.md` #4) memakai endpoint XYZ
   Google langsung dari frontend — street `lyrs=m`, hybrid `lyrs=y`. URL hanya
   boleh didefinisikan di `frontend/src/config/basemaps.ts` (satu tempat), wajib
   ada atribusi Google di peta, dan wajib ada entri fallback OSM/Esri di config
   yang bisa diaktifkan lewat env FE. Jangan menambahkan API key atau proxy tiles.
10. **Ikon kategori** = nama ikon lucide yang disimpan di DB, divalidasi terhadap
    daftar kurasi `frontend/src/config/categoryIcons.ts` (mirror di zod schema BE).
    Marker peta dirender via Leaflet `divIcon` berisi SVG lucide + warna kategori.
11. **GeoJSON TIDAK BOLEH publik.** Dilarang: menaruh file geojson di
    `frontend/public/`, membundelnya ke build FE, meng-import-nya sebagai modul,
    atau membuat endpoint geojson tanpa middleware `auth`. Semua respons geojson
    (`/regions*`, `/layers/{id}/geojson`) wajib `Cache-Control: private, no-store`.
    File mentah di `data/` tidak boleh di-commit ke repo publik.
12. Keputusan PO yang mengikat (lihat `DECISIONS.md`): wilayah proyek **minimal
    level `desa`** (kab/kec → 422); infrastruktur **maksimal 1 foto**
    (`photo_path` di tabel infrastruktur); titik di luar wilayah proyek
    **tetap disimpan** dengan flag `is_outside_region=true` + warning.

## Konvensi Kode

- TypeScript `strict: true` di BE dan FE.
- Controller tipis → logika bisnis di `backend/src/services/*`; query spasial
  hanya boleh ada di services (jangan tebar `$queryRaw` di controller).
- React: functional component + hooks; state global hanya di zustand
  (`authStore`, `mapStore`); komponen peta di `src/components/map/`.
- Validasi request: zod schema di `backend/src/schemas/*`, dipanggil middleware.
- Penamaan: tabel & kolom Inggris; teks UI Bahasa Indonesia.
- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
- Satu PR = satu task dari `TASKS.md`. Sertakan cara tes manual di deskripsi PR.

## Testing Minimal per Fitur

- Backend: test untuk (a) happy path, (b) 403 peran/kepemilikan salah,
  (c) validasi 422. Contoh wajib: klaim token expired, petugas edit infra
  milik orang lain, list infra tanpa filter.
- DB test pakai database terpisah (`DATABASE_URL_TEST`); PostGIS tersedia di CI
  (docker image `postgis/postgis:16-3.4`).

## Hal yang Sering Bikin Bug di Proyek Ini (pelajari!)

- Leaflet memakai urutan `[lat, lng]`; GeoJSON memakai `[lng, lat]`. Selalu
  cek dua kali saat konversi.
- `ST_MakePoint(lng, lat)` — longitude dulu.
- `$queryRaw` Prisma: pakai tagged template (`$queryRaw\`...\``) agar
  ter-parameterisasi — jangan konkatenasi string (SQL injection).
- Jangan simpan FeatureCollection besar di React state tanpa membuang layer
  lama → memory leak. Gunakan pola cleanup di `RegionLayer`.
- File geojson mentah BPS bisa memakai nama properti berbeda (`idsls` vs
  `IDSLS`) — normalisasi lowercase saat import.
- Angka id wilayah 16 digit: jangan pernah `parseInt`/`Number()` — presisi hilang.
- Timezone: simpan UTC, tampilkan WIB (`Asia/Jakarta`).

## Yang TIDAK Boleh Dilakukan Agent

- Menambah dependency baru tanpa menuliskannya di PR + alasan.
- Mengubah skema DB tanpa migration Prisma (jangan edit migration lama yang
  sudah jalan di main — buat migration baru).
- Menghapus / mengubah isi `docs/*.md` kecuali diminta.
- Membuat fitur di luar `TASKS.md` / PRD ("scope creep").
- Mengekspos data wilayah/layer tanpa autentikasi, atau menaruh GeoJSON sebagai
  aset statis frontend (aturan #11).
- Mengganti Express ke framework lain, atau SPA Vite ke Next.js.
