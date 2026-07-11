# ARCHITECTURE.md — Arsitektur Teknis (Full JavaScript/TypeScript)

> Versi 1.2. Baca `PRD.md` dulu supaya paham fiturnya. Dokumen ini menjelaskan **bagaimana** membangunnya.
> Batasan dari product owner: **wajib JavaScript/TypeScript**, **dilarang Next.js**, tanpa PHP/Laravel,
> basemap XYZ Google langsung (`DECISIONS.md` #4), dan **GeoJSON tidak boleh diakses publik** (`DECISIONS.md` #6).

---

## 1. Tech Stack (dan alasan memilihnya)

| Lapisan | Pilihan | Kenapa (untuk junior dev) |
|---|---|---|
| Runtime backend | **Node.js 20 LTS + TypeScript** | Satu bahasa untuk FE & BE, tim cukup jago satu ekosistem |
| Framework backend | **Express 4** (REST API) | Paling banyak tutorial & contoh; middleware pattern mudah dipahami |
| ORM | **Prisma** + **raw SQL (`$queryRaw`) untuk query spasial** | Prisma: migration & type-safety enak buat junior. PostGIS belum didukung native → kolom geometry pakai `Unsupported(...)` dan query ST_* pakai raw SQL yang diisolasi di service |
| Database | **PostgreSQL 16 + PostGIS 3** | PostGIS = jantung aplikasi (simpan poligon, point-in-polygon, simplify) |
| Auth | **JWT** (`jsonwebtoken`) + `bcryptjs` | Sederhana untuk SPA; access token 1 hari, dikirim via header `Authorization: Bearer` |
| Validasi | **zod** | Skema validasi request yang sama gayanya dengan TypeScript |
| Upload | **multer** | Standar Express untuk multipart |
| Excel/CSV | **exceljs** (XLSX) + **csv-stringify/csv-parse** | Export, import, dan generate template |
| Frontend | **React 18 + Vite + TypeScript** (SPA murni, BUKAN Next.js) | Peta sangat interaktif; Vite ringan & cepat |
| Peta | **Leaflet 1.9** + `leaflet.markercluster` | Lebih mudah dipelajari junior daripada MapLibre |
| Ikon | **lucide-react** | Ikon kategori pin dipilih dari pustaka ini (nama ikon disimpan di DB) |
| UI kit | **Tailwind CSS + shadcn/ui** | Cepat rapi tanpa desainer |
| State FE | **zustand** | Store global sederhana (auth, wilayah aktif, layer) |
| SHP → GeoJSON | **shpjs** (di browser) | Konversi di client, server tidak perlu GDAL |
| Kompres foto | **browser-image-compression** (di browser) | Hemat kuota petugas |
| Simplifikasi geometri | **PostGIS `ST_SimplifyPreserveTopology`** | Simplify tanpa merusak topologi |
| Testing | **vitest + supertest** (BE), **vitest + testing-library** (FE) | Satu test runner untuk semua |
| Storage foto & layer | Disk lokal (`backend/storage/`) v1 → S3-compatible (MinIO) saat scale | Mulai sederhana; **tidak pernah di-serve sebagai folder statis publik** |
| Cache | **In-memory (Map/LRU)** di backend untuk respons GeoJSON per wilayah | GeoJSON jarang berubah; cache hanya di server, respons ke browser tetap `private, no-store` |

> **Aturan emas:** jangan menambah library baru tanpa diskusi dengan lead. Stack di atas sudah cukup untuk seluruh PRD.

---

## 2. Diagram Arsitektur

```
┌─────────────────────────────┐      tile basemap (gambar peta dasar saja,
│  Browser (React + Leaflet)  │────▶ bukan data kita) langsung ke endpoint
│  - Peta, filter, form       │      XYZ Google (lyrs=m / lyrs=y)
│  - shpjs (SHP→GeoJSON)      │
│  - kompres foto             │
└──────────┬──────────────────┘
           │ HTTPS (JSON / multipart, JWT Bearer)
           │ SEMUA data wilayah/infra/layer lewat sini — ber-auth
           ▼
┌─────────────────────────────┐
│  Node.js + Express API      │
│  - middleware auth & role   │
│  - routes wilayah/infra/    │
│    proyek/token/export      │
│  - Prisma + raw SQL PostGIS │
│  - Cache-Control: private   │
└──────┬───────────┬──────────┘
       │           │
       ▼           ▼
┌────────────┐  ┌──────────────────────┐
│ PostgreSQL │  │ Storage foto & file  │
│ + PostGIS  │  │ geojson layer        │
└────────────┘  │ (privat, via route   │
                │  ber-auth, bukan     │
                │  static folder)      │
                └──────────────────────┘
```

---

## 3. Basemap Google (Street & Hybrid) — Keputusan PO + catatan risiko

**Keputusan PO (`DECISIONS.md` #4):** memakai endpoint tile XYZ Google langsung, tanpa API key:

```ts
// frontend/src/config/basemaps.ts — SATU-SATUNYA tempat URL basemap boleh ditulis
export const BASEMAPS = {
  street: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google',
    label: 'Street',
  },
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',   // y = satelit + label (hybrid)
    attribution: '&copy; Google',
    label: 'Hybrid',
  },
  // FALLBACK — aktifkan via VITE_BASEMAP_FALLBACK=1 bila endpoint Google bermasalah
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: 'OSM',
  },
  esriImagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Citra Esri',
  },
} as const;
```

**Catatan risiko (satu kali, sudah diterima PO):** endpoint `mt1.google.com/vt/...` bukan
API resmi ber-lisensi — Google bisa mengubah/memblokirnya sewaktu-waktu dan penggunaannya
berada di luar ToS Google Maps Platform. Mitigasi yang kita siapkan:
1. URL terpusat di satu file config → ganti provider = ubah 1 file.
2. Fallback OSM + Esri sudah tersedia di config, bisa diaktifkan lewat env tanpa deploy ulang kode.
3. Basemap hanyalah gambar latar; **tidak ada data aplikasi** yang bergantung padanya.

Aturan implementasi: tampilkan atribusi di pojok peta, subdomain cukup `mt1` (jangan
membuat load berlebihan), dan JANGAN menambahkan proxy backend untuk tile (menghemat
bandwidth server dan tidak menambah jejak).

---

## 4. Strategi Data Wilayah & GeoJSON (jawaban "1 file atau banyak?")

### 4.1 Keputusan

**GeoJSON dipisah per level (5 dataset), dan PostGIS menjadi sumber kebenaran.**
File GeoJSON dari BPS hanyalah bahan **import**; aplikasi tidak membaca file mentah saat runtime,
dan file mentah **tidak pernah** disajikan ke browser.

### 4.2 Pipeline import (dilakukan admin / skrip)

```
geojson mentah (per level)
   │  1. validasi field wajib (idxxx, nmxxx — normalisasi lowercase)
   │  2. insert ke PostGIS
   ▼
tabel `regions`
   - satu tabel untuk semua level, kolom `level` ('kab','kec','desa','sls','subsls')
   - kolom geom (geometry MultiPolygon, SRID 4326)
   - kolom geom_simplified, dibuat via:
     UPDATE regions SET geom_simplified =
       ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0005));
```

Skrip import = CLI Node: `npm run import:regions -- --file=data/geojson/sls.geojson --level=sls`
(baca file streaming, insert batch 500 fitur pakai `$executeRaw` + `ST_GeomFromGeoJSON`).

Admin "update file GeoJSON wilayah" = upload file per level → sistem validasi → replace baris `regions` untuk level tsb (dalam `prisma.$transaction`) → catat versi & tanggal.

### 4.3 Penyajian on-demand (runtime)

Endpoint utama (ber-auth, `Cache-Control: private, no-store`):

```
GET /api/regions?level=sls&parent=1306010001&detail=low|high
```

- `parent` difilter pakai **prefix id**: `WHERE region_id LIKE '1306010001%' AND level='sls'`.
- `detail=low` → kirim `geom_simplified`; `high` → `geom` asli. Frontend memilih berdasarkan zoom.
- Respons = FeatureCollection GeoJSON, di-generate langsung oleh PostGIS (cepat, tidak perlu serialisasi di Node):
  ```sql
  SELECT json_build_object(
    'type','FeatureCollection',
    'features', COALESCE(json_agg(ST_AsGeoJSON(t.*)::json), '[]')
  ) AS fc
  FROM (SELECT region_id, name, level, geom_simplified AS geom
        FROM regions WHERE level = $1 AND region_id LIKE $2 || '%') t;
  ```
  Di Express: kirim `fc` apa adanya (`res.type('application/geo+json').send(row.fc)`).
- **Cache LRU di server** per (level,parent,detail) — invalidate saat admin replace geojson.
  Cache HANYA di sisi server; ke browser tetap `private, no-store` (aturan privasi).

Aturan frontend (biar hemat resource, sesuai PRD §5.2):

| Aksi user | Yang di-load |
|---|---|
| Buka peta | outline kabupaten saja |
| Pilih level kecamatan | semua kecamatan (±17 fitur) |
| Pilih 1 kecamatan | nagari dalam kecamatan itu |
| Pilih 1 nagari | SLS dalam nagari itu |
| Pilih 1 SLS | sub-SLS dalam SLS itu |

Layer level dalam **dibuang dari memori** saat user naik level lagi (cleanup di komponen `RegionLayer`) — jangan menumpuk ribuan poligon.

> **Fase 2 (kalau data terasa berat):** generate vector tiles PMTiles dengan tippecanoe — tapi
> harus tetap disajikan lewat endpoint ber-auth, BUKAN static hosting publik. Untuk v1,
> pendekatan GeoJSON per-parent sudah cukup karena payload selalu kecil.

### 4.4 Resolve wilayah dari koordinat (untuk infrastruktur)

Saat petugas menyimpan infrastruktur, backend menjalankan point-in-polygon (di `services/regionResolver.ts`):

```sql
SELECT region_id FROM regions
WHERE level = 'subsls'
  AND ST_Covers(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))  -- Covers: titik tepat di boundary ikut terhitung
LIMIT 1;
```

Dari `idsubsls` (16 digit), semua id di atasnya = substring: `idsls = idsubsls.slice(0,14)`, `iddesa = .slice(0,10)`, `idkec = .slice(0,7)`, `idkab = .slice(0,4)`. Simpan kelimanya di baris infrastruktur (denormalisasi sengaja — mempermudah filter & export).

**Flag `is_outside_region` (`DECISIONS.md` #3):** setelah resolve, bandingkan dengan wilayah
proyek: `is_outside_region = !resolvedId.startsWith(project.region_id)` (dan `true` juga bila
titik tidak ter-resolve sama sekali / di luar kabupaten). Data tetap disimpan; response
menyertakan `warning` agar FE menampilkan peringatan.

---

## 5. Perlindungan Data GeoJSON (aturan PO: TIDAK BOLEH PUBLIK)

Prinsip: **satu-satunya jalur data wilayah & layer ke browser adalah API ber-JWT.**

Checklist implementasi (masuk audit M8.3):

- [ ] TIDAK ADA file `.geojson`/`.json` data wilayah di `frontend/public/`, di `src/` (di-import sebagai modul), atau di hasil `npm run build`. Tambahkan pengecekan CI sederhana: `! grep -rl '"FeatureCollection"' frontend/dist`.
- [ ] Folder `backend/storage/` TIDAK di-mount sebagai `express.static`. File layer & foto disajikan lewat route ber-auth (`GET /layers/{id}/geojson`, `GET /infrastructures/{id}/photo`) yang memetakan file dari record DB + validasi kepemilikan/role + path traversal. Route file generik `/files/*` sudah DIHAPUS.
- [ ] Semua respons geojson memakai `Cache-Control: private, no-store` supaya tidak tersimpan di proxy/CDN bersama.
- [ ] CORS hanya mengizinkan origin FE (`CORS_ORIGIN`); tolak origin lain.
- [ ] Rate limit umum di endpoint `/regions*` (mis. 120 req/menit/user) untuk memperlambat scraping massal.
- [ ] File mentah di `data/` masuk `.gitignore` bila repo bisa diakses pihak luar; distribusi file antar tim lewat storage internal.
- [ ] Tidak ada halaman peta tanpa login (semua route FE di belakang route guard; API tetap benteng utamanya).

> Catatan jujur untuk tim: user yang **sudah login** secara teknis selalu bisa menyimpan
> data yang dirender browsernya (network tab). Itu tidak bisa dicegah oleh teknologi apa pun —
> kontrolnya adalah manajemen akun (akun dibuat admin, bisa dinonaktifkan) dan aturan internal.
> Yang dijamin arsitektur ini: **tanpa akun, tidak ada satu byte GeoJSON pun yang bisa diambil.**

---

## 6. Struktur Folder (monorepo npm workspaces)

```
repo/
├─ package.json              # workspaces: ["backend", "frontend"]
├─ backend/
│  ├─ src/
│  │  ├─ index.ts            # bootstrap express
│  │  ├─ app.ts              # register middleware + routes
│  │  ├─ routes/             # auth, regions, categories, infrastructures,
│  │  │                      # activities, tokens, projects, layers,
│  │  │                      # users, export, import, files
│  │  ├─ controllers/        # tipis: parse request → panggil service → response
│  │  ├─ services/           # logika bisnis: tokenService, regionResolver,
│  │  │                      # regionImport, exportService, importService
│  │  ├─ middlewares/        # auth.ts (verifikasi JWT), requireRole.ts,
│  │  │                      # errorHandler.ts, rateLimit.ts, upload.ts (multer),
│  │  │                      # noStore.ts (set Cache-Control: private, no-store)
│  │  ├─ lib/                # prisma.ts (singleton), regionId.ts (helper prefix/level),
│  │  │                      # cache.ts (LRU), tokenGenerator.ts
│  │  └─ schemas/            # zod schema per resource
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/         # termasuk migration SQL manual untuk PostGIS
│  │  └─ seed.ts
│  ├─ tests/                 # vitest + supertest
│  └─ storage/               # foto & geojson layer (gitignore, TIDAK statis publik)
├─ frontend/
│  ├─ src/
│  │  ├─ api/                # axios client per resource
│  │  ├─ components/
│  │  │  ├─ map/             # MapView, RegionLayer, InfraMarkers, BasemapToggle,
│  │  │  │                   # CurrentLocation, UploadedLayer, LayerStylePanel,
│  │  │  │                   # CategoryIcon (render ikon lucide → divIcon Leaflet)
│  │  │  ├─ filters/         # RegionCascade, CategoryFilter, SearchBox
│  │  │  └─ ui/
│  │  ├─ pages/              # Login, MapHome, Projects, ProjectDetail,
│  │  │                      # admin/(Users|Categories|Tokens|Activities|Infra|Projects|RegionUpload)
│  │  ├─ stores/             # zustand: authStore, mapStore
│  │  ├─ config/             # basemaps.ts (URL tile — satu-satunya tempat),
│  │  │                      # categoryIcons.ts (daftar kurasi ikon lucide)
│  │  └─ utils/              # regionId.ts (SAMA logikanya dgn backend), photo.ts
├─ data/                     # geojson mentah + skrip — PRIVAT (gitignore bila repo
│  └─ scripts/               # bisa diakses pihak luar); JANGAN commit file besar
└─ docs/                     # semua .md ini
```

---

## 7. Auth & Konvensi Penting

- **JWT**: payload `{ sub: userId, role }`, expired 24 jam. FE simpan di memori (zustand) + `localStorage` (trade-off diterima untuk v1). Middleware `auth.ts` verifikasi & tempel `req.user`. Middleware `requireRole('admin')` untuk route admin.
- **Semua id wilayah = string.** Helper `regionId.ts` (ada versi BE & FE, logika identik): `levelOf(id)` (dari panjang 4/7/10/14/16), `parentOf(id)`, `isChildOf(child, parent)` → `child.startsWith(parent)`. **Pakai helper, jangan tulis ulang.**
- **ID entitas** (user, proyek, infrastruktur, dst) pakai **CUID** (`@default(cuid())` bawaan Prisma).
- Response API konsisten: sukses `{ "data": ..., "meta"?: ... }`, error `{ "message": "...", "errors"?: { field: ["..."] } }` (dibangun oleh `errorHandler.ts` dari ZodError/AppError).
- Zona waktu: simpan timestamp UTC, tampilkan WIB (`Asia/Jakarta`) di FE (`Intl.DateTimeFormat`).
- Foto: path `storage/infra/{id}/{timestamp}-{uuid}.jpg` (+ `_thumb.jpg`); jangan pernah percaya nama file dari user; serve via route ber-auth `GET /infrastructures/{id}/photo?size=full|thumb` — path diambil dari record DB, bukan dari URL.
- Env wajib: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`. FE: `VITE_BASEMAP_FALLBACK` (opsional).

---

## 8. Keamanan (checklist minimal)

- [ ] Semua route API (kecuali `/api/auth/login`) memakai middleware `auth`.
- [ ] Otorisasi kepemilikan di service: contoh update infrastruktur → `if (infra.userId !== req.user.sub && req.user.role !== 'admin') throw Forbidden`.
- [ ] Validasi wilayah proyek: `region_level` harus `desa|sls|subsls` (keputusan PO #1).
- [ ] Validasi upload: geojson/zip ≤ 20 MB, foto ≤ 5 MB (1 file), cek MIME asli (`file-type`), bukan cuma ekstensi.
- [ ] Rate limit klaim token (`express-rate-limit`, 10x/menit/user) — alfabet 31 karakter → 31^7 ≈ 27,5 miliar kombinasi, aman dengan rate limit.
- [ ] Seluruh checklist **Perlindungan Data GeoJSON** di §5.
- [ ] `helmet` + CORS whitelist `CORS_ORIGIN`.
- [ ] Escape/limit field label yang dirender dari properti GeoJSON upload (render pakai `textContent`, bukan innerHTML).
- [ ] Password: `bcryptjs` cost 10; jangan pernah log password/token.

---

## 9. Performa (checklist)

- [ ] Index DB: `regions(level)`, prefix index `regions(region_id varchar_pattern_ops)`, GIST di `geom`, GIN full-text di `name`.
- [ ] Cache LRU sisi server untuk `/api/regions` (per level+parent+detail).
- [ ] Marker infrastruktur banyak → `leaflet.markercluster`.
- [ ] Lazy-load halaman admin (React `lazy()` + `Suspense`).
- [ ] Foto dikompres client-side sebelum upload.
- [ ] Streaming saat import geojson besar (pakai `stream-json` bila file sub-SLS sangat besar — jangan `JSON.parse` ratusan MB sekaligus).
