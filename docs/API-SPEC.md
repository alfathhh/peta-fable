# API-SPEC.md — Spesifikasi REST API

> Base URL: `/api`. Semua endpoint (kecuali login) butuh header
> `Authorization: Bearer {jwt}`. Format sukses: `{ "data": ..., "meta"?: ... }`.
> Format error: `{ "message": "...", "errors"?: { "field": ["..."] } }`.
>
> Peran di kolom **Akses**: `A` = admin, `P` = petugas. `login` = keduanya (asal login).
>
> **Keamanan data wilayah:** seluruh respons GeoJSON (`/regions*`, `/layers/{id}/geojson`)
> hanya untuk user login dan dikirim dengan header `Cache-Control: private, no-store`.
> Tidak boleh ada file GeoJSON yang bisa diakses tanpa autentikasi.

---

## 1. Auth

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | body: `{username, password}` → `{token, user}` |
| POST | `/auth/logout` | login | (opsional v1 — JWT stateless; cukup hapus token di FE) |
| GET | `/auth/me` | login | profil user login |
| PUT | `/auth/me/password` | login | `{current_password, new_password}` |

---

## 2. Basemap (TIDAK ada endpoint API)

Keputusan PO (`DECISIONS.md` #4): basemap dipanggil frontend **langsung** ke endpoint
XYZ Google (`lyrs=m` = street, `lyrs=y` = hybrid) — tanpa API key, tanpa proxy backend.
URL hanya didefinisikan di `frontend/src/config/basemaps.ts`. Risiko & fallback: `ARCHITECTURE.md` §3.
Yang wajib dilindungi auth adalah **data wilayah & layer** (§3, §7.1), bukan basemap.

---

## 3. Wilayah (regions)

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/regions` | login | Query: `level` (wajib), `parent`, `detail=low\|high` (default `low`). `parent` berupa parent langsung mengambil daftar anak; `parent` berupa ID dengan level sama mengambil **tepat satu polygon** untuk outline wilayah terpilih, termasuk level `kec`. Untuk level granular (`desa`/`sls`/`subsls`), tanpa `parent` → 422 (anti-dump massal). Response: **GeoJSON FeatureCollection** |
| GET | `/regions/{region_id}` | login | Detail 1 wilayah + bbox + statistik ringkas (jumlah infra **approved** per kategori, dengan icon & color kategori) |
| GET | `/regions/search?q=` | login | Cari by nama/id, semua level. Response: array `{region_id, level, name, path_name, bbox}` — `path_name` contoh: "Korong Kasai, Katapiang, Batang Anai". Maks 20 hasil |
| GET | `/regions/options?level=&parent=` | login | Versi ringan untuk dropdown (tanpa geometri): `[{region_id, name}]`, sorted by `region_id`. Level granular wajib `parent` langsung (kec→desa, desa→sls, sls→subsls) |
| GET | `/regions/stats?level=&parent=&category_id=` | login | Jumlah infrastruktur **approved** per wilayah pada satu level (untuk choropleth): `[{region_id, count}]`. `parent` boleh ancestor (prefix); `category_id` boleh daftar dipisah koma |
| POST | `/admin/regions/upload` | A | multipart: `level`, `file` (.geojson). Validasi field id & nama sesuai level → replace. Response: `{upload_id, status}` |
| GET | `/admin/regions/uploads` | A | riwayat upload |

Contoh:
```
GET /api/regions?level=sls&parent=1306010001&detail=low
→ FeatureCollection berisi semua SLS di Nagari 1306010001,
  tiap feature.properties = { region_id, name, level }
```

---

## 4. Kategori Infrastruktur

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/categories` | login | `[{id, name, icon, color, is_active}]` — dipakai FE untuk filter + legenda + marker |
| POST | `/admin/categories` | A | `{name, icon, color}` — `icon` divalidasi terhadap daftar ikon yang dikurasi |
| PUT | `/admin/categories/{id}` | A | |
| DELETE | `/admin/categories/{id}` | A | tolak jika masih dipakai infrastruktur → 409 |

---

## 5. Infrastruktur

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/infrastructures` | login | **Wajib minimal salah satu filter**: `category_id` (boleh daftar dipisah koma) atau `q` (search nama) — nilai kosong/spasi ditolak 422. Filter tambahan: `region_id` (kolom denormalisasi per level), `activity_id`. Hanya menampilkan data **approved** (peta umum). Response ringan untuk marker: `[{id, name, lat, lng, approvalStatus, category:{id,name,icon,color}}]` |
| GET | `/infrastructures/{id}` | login | Detail lengkap + `photo_url` + `photo_thumb_url` + nama wilayah + `is_outside_region` + `approvalStatus`/`approvalNote` + `gmaps_url`. Data non-approved hanya terlihat pembuat & admin (lainnya 404) |
| GET | `/infrastructures/{id}/photo?size=full\|thumb` | login | Stream foto dari record DB (bukan path dari klien) dengan cek pemilik/status ACC; `size=thumb` = versi 320px untuk popup (fallback ke foto utama bila tidak ada). Menggantikan route lama `/files/*` yang sudah DIHAPUS |
| POST | `/infrastructures` | P | multipart: `name, category_id, description?, lat, lng, gps_accuracy_m?, project_id, photo?` (maks 1 foto; dinormalisasi JPEG) + wilayah manual opsional `idsls` (14 digit, wajib bila manual) & `idsubsls` (16 digit, butuh `idsls`). Tanpa manual → backend resolve dari titik (`ST_Covers`). Titik **di luar wilayah proyek** → tetap simpan `is_outside_region=true` + `warning`. Status awal `pending` (butuh ACC admin). **404** jika `project_id` bukan milik user |
| PUT | `/infrastructures/{id}` | P (miliknya) / A | Petugas: name, category_id (yang aktif), description (string kosong = hapus), photo. **lat/lng & wilayah manual hanya admin** (422 bila petugas); lat/lng wajib dikirim berpasangan; admin ubah koordinat → wilayah + flag outside di-resolve ulang |
| PUT | `/admin/infrastructures/{id}/approval` | A | `{status: pending\|approved\|rejected, note?}` — hanya `approved` tampil di peta umum; `note` (alasan penolakan) terlihat pembuat |
| DELETE | `/infrastructures/{id}` | P (miliknya) / A | soft delete |
| GET | `/my/projects/{id}/infrastructures` | P (miliknya) / A | Daftar SEMUA status infrastruktur milik proyek (pending/rejected termasuk) — lewat cek kepemilikan proyek, bukan bypass filter marker |
| GET | `/admin/infrastructures` | A | tabel lengkap + pagination + semua filter (`is_outside_region`, `approval_status`, dll), tanpa kewajiban filter |

---

## 6. Kegiatan & Token

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/activities` | A | |
| POST | `/admin/activities` | A | `{name, description?}` |
| PUT/DELETE | `/admin/activities/{id}` | A | delete ditolak jika sudah ada proyek → 409 |
| GET | `/admin/tokens` | A | + filter status/kegiatan |
| POST | `/admin/tokens` | A | `{activity_id, expires_at, max_claims?}` → server generate token 7 char |
| PUT | `/admin/tokens/{id}` | A | ubah `expires_at`, `is_active` |
| DELETE | `/admin/tokens/{id}` | A | |
| POST | `/tokens/claim` | P | `{token}` → validasi (ada? aktif? belum expired? kuota? belum pernah klaim?) → buat `activity_claims`. Error jelas per kasus. **Rate limit 10/menit** |
| GET | `/my/activities` | P | kegiatan hasil klaim (untuk dropdown proyek) |

---

## 7. Proyek

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/my/projects` | P | daftar proyek milik user |
| POST | `/my/projects` | P | `{name, activity_id, region_id}` — `activity_id` harus hasil klaim user **dengan token yang masih aktif & belum kedaluwarsa** (DECISIONS #11); `region_id` wajib tepat satu master wilayah level `kec`\|`desa`\|`sls`\|`subsls`; level `kab` → 422 |
| GET | `/my/projects/{id}` | P (miliknya) | detail mempertahankan `regionId` + `regionLevel`, menyertakan bbox/detail master wilayah dan daftar layer; FE mengambil exact-region GeoJSON untuk outline + `fitBounds` |
| PUT/DELETE | `/my/projects/{id}` | P (miliknya) | |
| GET | `/admin/projects` | A | semua proyek + filter user/kegiatan/wilayah |
| PUT/DELETE | `/admin/projects/{id}` | A | project management admin |

### 7.1 Layer proyek

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/my/projects/{id}/layers` | P/A | daftar layer + style |
| POST | `/my/projects/{id}/layers` | P | multipart `file` (.geojson, hasil konversi shp di client) + `name?`. Server validasi GeoJSON valid & ≤ 20 MB |
| GET | `/layers/{id}/geojson` | P/A | stream isi geojson (untuk dirender Leaflet) |
| PUT | `/layers/{id}` | P | update `name`, `style` (json), `is_visible`, `sort_order` |
| DELETE | `/layers/{id}` | P | |

---

## 8. User Management

| Method | Endpoint | Akses |
|---|---|---|
| GET | `/admin/users` | A |
| POST | `/admin/users` | A (`{name, username, email?, password, role}` — role: `admin`\|`petugas`) |
| PUT | `/admin/users/{id}` | A (termasuk `is_active`, reset password) |
| DELETE | `/admin/users/{id}` | A (soft delete; tolak hapus diri sendiri) |

---

## 9. Export & Import

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/export/{module}?format=csv\|xlsx&...filters` | A | `module`: `users`\|`infrastructures`\|`projects`\|`tokens`\|`activities`. Mengikuti filter query yang sama dengan endpoint list-nya. Dibangun dengan `exceljs` (xlsx) / `csv-stringify` (csv) |
| GET | `/admin/import/infrastructures/template` | A | unduh template XLSX (sheet Data + Petunjuk + Referensi kategori & wilayah) |
| POST | `/admin/import/infrastructures/validate` | A | upload XLSX → response preview: `{upload_id, valid_rows, invalid_rows:[{row, errors[]}], summary}` — belum menyimpan apa pun (file diparkir sementara di storage) |
| POST | `/admin/import/infrastructures/commit` | A | `{upload_id}` dari langkah validate → simpan baris valid dalam **satu transaction (all-or-nothing)**; idempoten — commit ulang mengembalikan hasil pertama, commit bersamaan → 409. Response: jumlah tersimpan + link unduh baris gagal (.xlsx) |
| GET | `/my/export/infrastructures?format=csv\|xlsx` | P | export seluruh infrastruktur milik petugas login ("Export Data Saya") |

### 9.1 Dashboard & Audit (admin)

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/dashboard` | A | ringkasan: totals (users, infrastruktur, antrean ACC, di luar wilayah, proyek aktif, token aktif), sebaran per kategori & kecamatan, 5 data terbaru |
| GET | `/admin/audit-logs?page=&entity=&user_id=` | A | riwayat aksi penting (approve/reject, CRUD user·kategori·token, upload wilayah, import) + pagination |

Kolom template import infrastruktur:
`nama* | kategori* (harus sama dgn master) | lat* | lng* | deskripsi | idsls (opsional — kalau kosong, resolve dari koordinat)`

---

## 10. Kode Status yang Dipakai

| Kode | Kapan |
|---|---|
| 200/201 | sukses |
| 401 | belum login / JWT invalid/expired |
| 403 | peran tidak berhak / bukan pemilik resource |
| 404 | resource tidak ada (atau milik orang lain — jangan bocorkan keberadaannya) |
| 409 | konflik (hapus kategori terpakai, token sudah diklaim, dsb) |
| 422 | validasi gagal (termasuk token expired, GPS tidak dikirim, filter infra kosong) |
| 429 | rate limit (klaim token) |
