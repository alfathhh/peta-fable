# TASKS.md — Breakdown Tugas per Milestone

> Untuk junior developer: kerjakan **berurutan**. Setiap task kecil, bisa selesai
> 0.5–2 hari. Centang kalau sudah lolos "Definition of Done" di PRD §9.
> Estimasi total: ± 8–10 minggu untuk 2 developer.

---

## Milestone 0 — Setup (Minggu 1)

- [ ] 0.1 Buat repo monorepo npm workspaces (`backend/`, `frontend/`, `docs/`, `data/`), setup git + branch protection.
- [ ] 0.2 Backend: Express + TypeScript boilerplate (`src/index.ts`, `app.ts`, errorHandler), Prisma init, koneksi PostgreSQL + migration pertama `CREATE EXTENSION postgis;`. Bukti: `npx prisma migrate dev` jalan & `GET /api/health` balas `{ok:true}`.
- [ ] 0.3 Frontend: Vite + React + TS + Tailwind, halaman kosong "Hello Peta", Leaflet tampil dengan basemap OSM (sementara), proxy Vite `/api` → `:3000`.
- [ ] 0.4 Docker compose untuk dev (image `postgis/postgis:16-3.4` + backend + frontend) — opsional tapi sangat disarankan.
- [ ] 0.5 CI sederhana: `npm test`, `npm run lint`, `npm run typecheck` (BE & FE) di setiap PR.

## Milestone 1 — Auth & Peran (Minggu 1–2)

- [ ] 1.1 Model Prisma `users` (role `admin`/`petugas`, is_active) + seed admin & 2 petugas.
- [ ] 1.2 Endpoint login/me/ganti-password (API-SPEC §1): bcryptjs verify → JWT sign; + test (login salah, user nonaktif).
- [ ] 1.3 Middleware `auth` (verifikasi JWT → `req.user`) + `requireRole('admin')` + contoh route admin terkunci + test 401/403.
- [ ] 1.4 FE: halaman login, `authStore` (token + user), axios interceptor Authorization, route guard, layout dasar (peta untuk semua, sidebar admin untuk admin).

## Milestone 2 — Data Wilayah & Peta Dasar (Minggu 2–4) ← inti aplikasi

- [ ] 2.1 Migration `regions` (kolom geometry via SQL manual) + semua index (DATABASE §2.2).
- [ ] 2.2 CLI `npm run import:regions`: baca geojson (streaming utk file besar), normalisasi properti lowercase, insert batch via `ST_GeomFromGeoJSON`, hitung `geom_simplified` & bbox. Tes dengan file kab & kec asli.
- [ ] 2.3 Endpoint `GET /regions` (level, parent, detail) — FeatureCollection dibangun PostGIS (ARCHITECTURE §4.3) + cache LRU + test (cek prefix filter benar).
- [ ] 2.4 Endpoint `GET /regions/options` untuk dropdown + `GET /regions/search`.
- [ ] 2.5 FE `MapView`: render outline kabupaten saat load.
- [ ] 2.6 FE `RegionCascade` (dropdown berjenjang) + `RegionLayer` on-demand: pilih level → fetch → render → cleanup layer lama. **Uji memori: naik-turun level 20x tidak melambat.**
- [ ] 2.7 FE search wilayah: ketik → hasil → klik → zoom ke bbox + set filter aktif.
- [ ] 2.8 Klik poligon → highlight + panel info (nama, id).
- [ ] 2.9 Basemap Google: isi `frontend/src/config/basemaps.ts` dengan URL XYZ dari `DECISIONS.md` #4 (street `lyrs=m`, hybrid `lyrs=y`) + atribusi Google di peta + toggle Street/Hybrid + entri fallback OSM/Esri di config yang bisa diaktifkan lewat env FE bila endpoint Google bermasalah.

## Milestone 3 — Kategori (dengan Ikon) & Infrastruktur di Peta (Minggu 4–5)

- [ ] 3.1 CRUD `categories` (admin) + halaman admin dengan **icon picker** (daftar kurasi lucide di `config/categoryIcons.ts`) + color picker + preview marker.
- [ ] 3.2 Migration `infrastructures` (termasuk kolom `photo_path` & `is_outside_region`).
- [ ] 3.3 Service `regionResolver` (point → idsubsls → semua id prefix via slice) + unit test.
- [ ] 3.4 Endpoint `GET /infrastructures` (wajib filter!) + `GET /infrastructures/{id}` + test aturan "tanpa filter = 422".
- [ ] 3.5 FE filter kategori + search infrastruktur; **marker = divIcon SVG lucide + warna kategori**; muncul sesuai wilayah aktif; markercluster jika > 50 pin; legenda kategori aktif.
- [ ] 3.6 FE popup pin: foto, ikon & nama kategori, deskripsi, wilayah, tombol "Buka di Google Maps".
- [ ] 3.7 Panel statistik wilayah: jumlah infra per kategori (dengan ikon) di wilayah aktif.

## Milestone 4 — Kegiatan, Token, Proyek (Minggu 5–7)

- [ ] 4.1 CRUD admin `activities`.
- [ ] 4.2 CRUD admin `activity_tokens` (`lib/tokenGenerator.ts`, alfabet aman) + test unik & expired.
- [ ] 4.3 Endpoint klaim token + rate limit + semua kasus error (expired/nonaktif/kuota/dobel, transaction atomik) + test.
- [ ] 4.4 FE petugas: halaman "Kegiatan Saya" + form klaim token (pesan error jelas).
- [ ] 4.5 Endpoint proyek (my/projects + admin/projects) + cek kepemilikan di service + validasi wilayah **minimal level desa** (kab/kec → 422) + test.
- [ ] 4.6 FE form buat proyek: nama, dropdown kegiatan (hasil klaim), dropdown wilayah berjenjang (kec → desa → sls → subsls); tombol simpan aktif hanya jika terpilih **minimal level desa**.
- [ ] 4.7 FE halaman detail proyek: peta zoom ke wilayah + outline + lokasi GPS live (`watchPosition`, dot biru + lingkaran akurasi).

## Milestone 5 — Add Infrastruktur oleh Petugas (Minggu 7)

- [ ] 5.1 FE tombol "+ Infrastruktur" di proyek: form foto (**maks 1 foto**, kamera/galeri + `browser-image-compression`), nama, kategori (dropdown dengan preview ikon), deskripsi; koordinat read-only dari GPS + tampil akurasi.
- [ ] 5.2 Endpoint POST/PUT/DELETE infrastruktur petugas + cek kepemilikan (miliknya saja; lat/lng tak bisa diubah petugas) + **flag `is_outside_region`** bila titik di luar poligon wilayah proyek (tetap simpan + `warning` di response, toast peringatan di FE) + test.
- [ ] 5.3 FE daftar "Infrastruktur Saya" di proyek + edit/hapus.

## Milestone 6 — Layer Upload Proyek (Minggu 8)

- [ ] 6.1 FE upload geojson/zip-shapefile → `shpjs` konversi → kirim geojson ke backend.
- [ ] 6.2 Backend simpan file + validasi + endpoint layer (API-SPEC §7.1) + test.
- [ ] 6.3 FE render layer + `LayerStylePanel`: outline/fill, warna, opasitas, tebal garis — perubahan live & tersimpan (PUT style).
- [ ] 6.4 FE label atribut: dropdown field dari properti geojson, ukuran & warna font (Leaflet `Tooltip` permanent / marker div di centroid; render pakai textContent, bukan innerHTML).
- [ ] 6.5 Toggle show/hide, urutan, hapus layer.

## Milestone 7 — Admin Lengkap + Export/Import (Minggu 8–9)

- [ ] 7.1 Halaman admin: users CRUD, infrastruktur (tabel semua data + edit/hapus + filter `is_outside_region`), proyek semua user, token & kegiatan (rapikan dari M4).
- [ ] 7.2 Admin upload/replace GeoJSON wilayah per level + riwayat `region_uploads` + validasi & rollback transaction.
- [ ] 7.3 Export CSV/XLSX semua modul (ikuti filter tabel) via exceljs/csv-stringify.
- [ ] 7.4 Template import infrastruktur (sheet Data+Petunjuk+Referensi) — endpoint unduh, dibuat dengan exceljs.
- [ ] 7.5 Import: validate (preview error per baris) → commit → unduh baris gagal. Test: baris kategori salah, koordinat di luar 1306, id wilayah tak dikenal.

## Milestone 8 — Polish & Rilis (Minggu 9–10)

- [ ] 8.1 Responsif mobile menyeluruh (petugas = HP!): panel jadi bottom-sheet, tombol besar.
- [ ] 8.2 Loading state, empty state, error state konsisten di semua halaman.
- [ ] 8.3 Audit keamanan pakai checklist ARCHITECTURE §7 — **termasuk verifikasi tidak ada GeoJSON yang bisa diakses tanpa login** (cek build FE, folder public, response header).
- [ ] 8.4 Audit performa pakai checklist ARCHITECTURE §8 (tes di HP kentang + 4G).
- [ ] 8.5 Deploy staging → UAT bersama product owner → perbaikan → produksi.
- [ ] 8.6 Tulis `docs/USER-GUIDE.md` singkat (admin & petugas) + backup DB terjadwal.

---

## Keputusan Product Owner — SUDAH TERJAWAB (detail di `DECISIONS.md`)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Level minimal wilayah proyek? | **Minimal level desa** (desa/sls/subsls; kab & kec ditolak) |
| 2 | Infrastruktur boleh >1 foto? | **1 foto saja** (kolom `photo_path` langsung di tabel infrastruktur) |
| 3 | Titik GPS di luar wilayah proyek? | **Simpan + flag** `is_outside_region` + peringatan di UI |
| 4 | Basemap Google? | **Endpoint XYZ langsung** (`lyrs=m` street, `lyrs=y` hybrid), tanpa API key — risiko ToS diterima PO, siapkan fallback di config |
| 5 | Mode offline? | **Tidak diperlukan** |
| 6 | (Tambahan PO) Akses GeoJSON | **GeoJSON tidak boleh publik / tidak boleh jadi aset statis frontend** — hanya via API ber-auth |
