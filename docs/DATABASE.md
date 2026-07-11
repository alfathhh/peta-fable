# DATABASE.md — Skema Database

> Versi 1.3. PostgreSQL 16 + PostGIS. ORM: **Prisma** — kolom geometry didefinisikan sebagai
> `Unsupported("geometry(...)")` di `schema.prisma`, dan index spasial/prefix dibuat
> lewat **migration SQL manual** (Prisma migrate mendukung `--create-only` lalu edit SQL-nya).
> Semua tabel punya `created_at`, `updated_at` (timestamp UTC).
> PK entitas aplikasi = **CUID** (string, `@default(cuid())`). Id wilayah = **VARCHAR** (kode BPS).
> Nama tabel & kolom bahasa Inggris, label UI bahasa Indonesia.

---

## 1. Diagram Relasi (ringkas)

```
users ──< activity_claims >── activities ──< activity_tokens
  │                               │
  │                               │
  └──< projects >─────────────────┘        regions (5 level, relasi via prefix id)
        │    │                                  ▲
        │    └──< project_layers               │ (resolve point-in-polygon)
        │                                       │
        └──< infrastructures >── categories ────┘
             (photo_path,          (punya icon + color)
              is_outside_region)
```

---

## 2. Tabel per Modul

### 2.1 `users`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| name | varchar(100) | |
| username | varchar(50) unique | login utama |
| email | varchar(150) unique nullable | |
| password | varchar | bcrypt |
| role | varchar(20) | **hanya 2 nilai: `admin` \| `petugas`** |
| is_active | boolean default true | nonaktif = tidak bisa login |
| last_login_at | timestamp nullable | |

### 2.2 `regions` — wilayah 5 level dalam SATU tabel
| Kolom | Tipe | Keterangan |
|---|---|---|
| region_id | varchar(16) PK | idkab/idkec/iddesa/idsls/idsubsls |
| level | varchar(10) | `kab` \| `kec` \| `desa` \| `sls` \| `subsls` |
| name | varchar(150) | nmkab/nmkec/... dari geojson |
| parent_id | varchar(16) nullable | redundan (bisa dihitung dari prefix) tapi memudahkan query |
| geom | geometry(MultiPolygon,4326) | asli — `Unsupported` di Prisma, akses via `$queryRaw` |
| geom_simplified | geometry(MultiPolygon,4326) | untuk zoom rendah |
| bbox | jsonb | [minLng,minLat,maxLng,maxLat] — untuk zoom-to cepat |
| properties | jsonb | atribut lain dari geojson (luas, statistik, dll) |
| source_version | varchar(50) | penanda versi upload admin |

Index (migration SQL manual):
```sql
CREATE INDEX idx_regions_level  ON regions(level);
CREATE INDEX idx_regions_prefix ON regions(region_id varchar_pattern_ops); -- untuk LIKE 'xxx%'
CREATE INDEX idx_regions_geom   ON regions USING GIST(geom);
CREATE INDEX idx_regions_name   ON regions USING GIN (to_tsvector('simple', name)); -- search
```

> Kenapa 1 tabel, bukan 5? Karena strukturnya identik dan query lintas level
> (search, resolve prefix) jadi satu query saja. `level` + prefix id sudah cukup
> membedakan.
>
> **Ingat:** data tabel ini rahasia — hanya boleh keluar lewat API ber-auth
> (`ARCHITECTURE.md` §5). Jangan pernah men-dump-nya ke file yang bisa diakses publik.

### 2.3 `categories` — kategori infrastruktur (dengan IKON)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| name | varchar(100) unique | mis. "Pendidikan", "Masjid" |
| icon | varchar(50) | **nama ikon Lucide** (mis. `school`, `hospital`, `landmark`) — FE render jadi marker |
| color | varchar(7) | hex, warna pin & legenda |
| is_active | boolean | |

> FE menyediakan **icon picker** (daftar ± 40 ikon lucide yang relevan, dikurasi di
> satu file `frontend/src/config/categoryIcons.ts`) supaya admin tinggal pilih,
> bukan mengetik nama ikon bebas.

### 2.4 `activities` — kegiatan (master)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| name | varchar(150) | "Susenas Maret 2026" |
| description | text nullable | |
| created_by | text FK users | admin |

### 2.5 `activity_tokens` — token kegiatan
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| activity_id | text FK activities | |
| token | char(7) unique | dari alfabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (tanpa 0,O,1,I,L) |
| expires_at | timestamp | wajib |
| max_claims | int nullable | null = tak terbatas |
| claims_count | int default 0 | update atomik |
| is_active | boolean default true | admin bisa mematikan |
| created_by | text FK users | |

### 2.6 `activity_claims` — petugas mengklaim token
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| user_id | text FK users | |
| activity_token_id | text FK | |
| activity_id | text FK | denormalisasi, mempermudah dropdown |
| claimed_at | timestamp | |

Unique: `(user_id, activity_token_id)` → tidak bisa klaim 2x.

### 2.7 `projects`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| user_id | text FK users | pemilik (petugas) |
| activity_id | text FK activities | dari token yang diklaim |
| name | varchar(150) | nama proyek |
| region_id | varchar(16) FK regions | wilayah proyek — **minimal level desa** (keputusan PO #1); validasi di service: level ∈ {`desa`,`sls`,`subsls`} |
| region_level | varchar(10) | disalin, memudahkan filter |
| status | varchar(20) default 'aktif' | `aktif` \| `selesai` \| `arsip` |

### 2.8 `project_layers` — layer GeoJSON/SHP yang diupload di proyek
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| project_id | text FK | |
| name | varchar(150) | nama layer (default: nama file) |
| geojson_path | varchar | path file geojson di `backend/storage/` — disajikan HANYA lewat endpoint ber-auth, bukan static |
| feature_count | int | info |
| style | jsonb | lihat contoh di bawah |
| is_visible | boolean default true | |
| sort_order | int | urutan layer |

Contoh isi `style`:
```json
{
  "mode": "outline",            // "outline" | "fill"
  "strokeColor": "#e11d48",
  "strokeWidth": 2,
  "fillColor": "#e11d48",
  "fillOpacity": 0.25,
  "label": {
    "field": "nmsls",           // null = tanpa label
    "fontSize": 12,
    "fontColor": "#111827"
  }
}
```

### 2.9 `infrastructures`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| name | varchar(150) | |
| category_id | text FK categories | |
| description | text nullable | |
| geom | geometry(Point,4326) | titik — `Unsupported` di Prisma |
| lat / lng | double | redundan agar query & export gampang tanpa raw SQL |
| gps_accuracy_m | double nullable | akurasi GPS saat input |
| **photo_path** | varchar nullable | **maks 1 foto** (keputusan PO #2) — langsung di tabel ini, tanpa tabel foto terpisah; file thumbnail `_thumb.jpg` disimpan berdampingan, disajikan via `?size=thumb` |
| idkab | varchar(4) **nullable** | di-resolve otomatis (ARCHITECTURE §4.4); null bila titik tidak ter-resolve ke polygon manapun (migration 3 — jangan dipaksa `1306`) |
| idkec | varchar(7) nullable | |
| iddesa | varchar(10) nullable | |
| idsls | varchar(14) nullable | bisa null kalau titik di luar poligon SLS |
| idsubsls | varchar(16) nullable | |
| **is_outside_region** | boolean default false | **true bila titik di luar wilayah proyek** (keputusan PO #3) — dihitung server saat simpan |
| **approval_status** | varchar(20) default 'pending' | `pending` \| `approved` \| `rejected` (keputusan PO #7) — hanya `approved` tampil di peta umum |
| **approval_note** | text nullable | alasan penolakan admin, terlihat oleh pembuat (keputusan PO #10) |
| user_id | text FK users | pembuat |
| project_id | text FK nullable | null jika dibuat admin via import |
| activity_id | text FK nullable | |
| source | varchar(20) | `manual` \| `import` |
| deleted_at | timestamp nullable | soft delete |

Index: GIST di `geom`, btree di `category_id`, `idkec`, `iddesa`, `idsls`, `user_id`, `is_outside_region`, `approval_status`.

### 2.10 `region_uploads` — riwayat admin replace GeoJSON wilayah
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| level | varchar(10) | level yang di-replace |
| filename | varchar | |
| feature_count | int | |
| uploaded_by | text FK users | |
| status | varchar(20) | `processing` \| `done` \| `failed` |
| note | text nullable | pesan error jika gagal |

### 2.11 `audit_logs` — riwayat aksi penting

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text PK (cuid) | |
| user_id | text nullable | **tanpa FK** — log harus tetap utuh walau user dihapus |
| username / role | varchar nullable | snapshot identitas saat aksi |
| action | varchar(50) | `create` \| `update` \| `delete` \| `approve` \| `reject` \| `upload` \| `import-commit` \| ... |
| entity | varchar(50) | `infrastructure` \| `user` \| `category` \| `token` \| `regions` \| ... |
| entity_id | text nullable | |
| detail | jsonb nullable | konteks tambahan (nama, alasan, jumlah baris) |
| created_at | timestamp | index btree; juga index `(entity, entity_id)` dan `user_id` |

---

## 3. Aturan Data Penting (baca sebelum coding)

1. **Jangan pernah cast id wilayah ke number.** 16 digit melebihi presisi aman JS untuk beberapa operasi, dan leading zero segmen bisa hilang. Selalu string.
2. **Sorting daftar wilayah**: `ORDER BY region_id ASC` (string) sudah menghasilkan urutan yang diminta PRD.
3. **Filter anak wilayah** selalu: `WHERE region_id LIKE :parent || '%' AND level = :childLevel`.
4. **Hapus infrastruktur = soft delete** (`deleted_at`) supaya export historis tetap jujur.
5. Saat admin **replace regions** satu level: lakukan dalam `prisma.$transaction` — `DELETE WHERE level=?` lalu bulk insert; kalau gagal validasi, rollback dan status upload `failed`. Infrastruktur TIDAK ikut terhapus (id wilayahnya tetap tersimpan sebagai teks).
6. `claims_count` di `activity_tokens` di-update pakai increment atomik (`UPDATE ... SET claims_count = claims_count + 1 WHERE ... AND (max_claims IS NULL OR claims_count < max_claims)`) dalam transaction — hindari race saat banyak petugas klaim bersamaan.
7. Migration yang menyentuh PostGIS (CREATE EXTENSION, kolom geometry, index GIST/prefix) ditulis manual: `npx prisma migrate dev --create-only` → edit file SQL → `npx prisma migrate dev`.
8. `is_outside_region` dihitung **hanya oleh server** saat create (dan saat admin mengoreksi koordinat data import): `!resolvedSubslsId?.startsWith(project.region_id)` — client tidak boleh mengirim field ini.
9. Ganti foto = hapus file lama di storage lalu tulis `photo_path` baru (jangan menumpuk file yatim).

---

## 4. Seeder Minimal untuk Development (`prisma/seed.ts`)

1. 1 admin (`admin` / password dari env `SEED_ADMIN_PASSWORD`), 2 petugas.
2. 6 kategori infrastruktur dengan ikon & warna: Pendidikan (`school`, biru), Kesehatan (`hospital`, merah), Ibadah (`landmark`, hijau), Pemerintahan (`building-2`, ungu), Ekonomi (`store`, oranye), Jalan/Jembatan (`route`, abu).
3. Import regions dari file geojson di `data/` (paling tidak level kab + kec agar peta hidup) — panggil service yang sama dengan CLI import.
4. 1 kegiatan + 1 token aktif (cetak token-nya di console agar gampang dites).
5. 10 infrastruktur dummy tersebar di 2 kecamatan (2 di antaranya ber-flag `is_outside_region` untuk menguji filter admin).
