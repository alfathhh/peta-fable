# Peta Tematik Padang Pariaman — Dokumentasi Proyek

Aplikasi web peta tematik Kabupaten Padang Pariaman (kode BPS `1306`):
peta wilayah 5 level (kabupaten → kecamatan → nagari/desa → SLS/korong → sub-SLS),
pinpoint infrastruktur dengan **ikon per kategori**, dan manajemen kegiatan lapangan
berbasis token. **2 peran: admin & petugas.**

**Stack: full JavaScript/TypeScript** — Node.js + Express (backend),
React + Vite SPA (frontend, bukan Next.js), PostgreSQL + PostGIS, Leaflet.

## Mulai dari Mana? (khusus junior dev)

Baca berurutan:

1. **`PRD.md`** — fitur & aturan bisnis. Ini "apa yang dibangun". Baca sampai habis.
2. **`ARCHITECTURE.md`** — stack, strategi GeoJSON on-demand, basemap Google, struktur folder.
3. **`DATABASE.md`** — skema tabel (Prisma + PostGIS). Pahami terutama tabel `regions` dan aturan id wilayah.
4. **`API-SPEC.md`** — kontrak endpoint. Frontend & backend sama-sama patuh ke sini.
5. **`TASKS.md`** — urutan pengerjaan per milestone. Ambil task dari sini, jangan loncat.
6. **`AGENTS.md`** — aturan main untuk AI coding agent & developer (perintah, konvensi, larangan). Salin sebagai `CLAUDE.md` di root repo bila memakai Claude Code.

## 4 Konsep Kunci yang Harus Kamu Pahami Sebelum Ngoding

1. **Kode wilayah BPS itu hierarkis.** `1306010001000100` (sub-SLS) mengandung
   `13060100010001` (SLS) mengandung `1306010001` (nagari) dst. Relasi
   parent-child cukup pakai *string prefix* — tidak perlu join rumit. Selalu
   simpan & proses sebagai **string** (jangan pernah `Number()`).
2. **Peta harus hemat.** Jangan pernah load semua poligon sekaligus. Load per
   level, per parent, dan pakai geometri yang sudah disederhanakan. Detail di
   `ARCHITECTURE.md` §4.
3. **Infrastruktur tidak tampil tanpa filter.** Pin (berikon sesuai kategori)
   hanya muncul setelah user memfilter kategori / mencari, dan selalu dibatasi
   wilayah aktif.
4. **GeoJSON itu rahasia.** Tidak boleh jadi file statis di frontend, tidak
   boleh bisa diakses tanpa login. Satu-satunya jalur ke browser: API ber-JWT
   dengan `Cache-Control: private, no-store`. Checklist: `ARCHITECTURE.md` §5.

## Ringkasan Alur Bisnis

```
Admin buat kegiatan → generate token (7 karakter, ada expired)
Petugas klaim token → buat proyek (pilih wilayah sampai level yang diinginkan)
Di proyek: lihat peta + GPS → upload & styling layer GeoJSON/SHP →
tambah infrastruktur (foto + data, koordinat otomatis dari GPS)
Admin memantau semua data → export CSV/Excel → import bulk bila perlu
```

## Status Dokumen

| File | Versi | Catatan |
|---|---|---|
| PRD.md | 1.2 | Keputusan PO diterapkan: min. desa, 1 foto, simpan+flag, tanpa offline, geojson privat |
| ARCHITECTURE.md | 1.2 | Basemap XYZ Google langsung (risiko tercatat) + bab Perlindungan Data GeoJSON |
| DATABASE.md | 1.3 | + `approval_status`/`approval_note`, tabel `audit_logs`, `idkab` nullable |
| API-SPEC.md | 1.3 | + approval, foto `/infrastructures/{id}/photo`, stats choropleth, dashboard/audit, export petugas, parent wajib level granular |
| TASKS.md | 1.2 | Semua pertanyaan terbuka terjawab → lihat DECISIONS.md |
| DECISIONS.md | 1.1 | + keputusan #7–#11 (approval, wilayah manual, minimap, fitur admin, token aktif utk proyek) |
| AGENTS.md | 1.2 | Salin/symlink sebagai CLAUDE.md di root repo |
