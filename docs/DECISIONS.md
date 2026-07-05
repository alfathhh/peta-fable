# DECISIONS.md — Log Keputusan Product Owner

> Keputusan di sini bersifat **mengikat** untuk tim & AI coding agent.
> Kalau ada perubahan, tambah entri baru dengan tanggal — jangan hapus yang lama.

| # | Tanggal | Keputusan | Dampak ke dokumen/kode |
|---|---|---|---|
| 1 | Jul 2026 | **Wilayah proyek minimal level desa/nagari.** Yang boleh: `desa`, `sls`, `subsls`. Level `kab`/`kec` ditolak backend (422). Dropdown kecamatan tetap ada, tapi hanya untuk mempersempit pilihan desa. | PRD §3.2, §5.7 · API-SPEC §7 · DATABASE §2.7 · TASKS 4.5–4.6 |
| 2 | Jul 2026 | **Infrastruktur maksimal 1 foto.** Kolom `photo_path` langsung di tabel `infrastructures`; tidak ada tabel foto terpisah. | PRD §5.9 · DATABASE §2.9 · API-SPEC §5 · TASKS 5.1 |
| 3 | Jul 2026 | **Titik GPS di luar wilayah proyek: tetap disimpan + flag** `is_outside_region = true`, disertai peringatan di UI. Admin bisa memfilter data ber-flag. Flag dihitung server, client tidak boleh mengirimnya. | PRD §5.9 · DATABASE §2.9 & aturan #8 · API-SPEC §5 · ARCHITECTURE §4.4 · TASKS 5.2, 7.1 |
| 4 | Jul 2026 | **Basemap memakai endpoint XYZ Google langsung, tanpa API key:**<br>`street = https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`<br>`hybrid = https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`<br>Risiko: bukan API resmi ber-lisensi — bisa berubah/diblokir Google sewaktu-waktu dan di luar ToS Google Maps Platform. **Risiko diketahui & diterima PO.** Mitigasi: URL terpusat di `frontend/src/config/basemaps.ts`, fallback OSM/Esri siap diaktifkan via env, dan tidak ada data aplikasi yang bergantung pada basemap. | ARCHITECTURE §3 · API-SPEC §2 (tidak ada endpoint tiles) · TASKS 2.9 · AGENTS aturan #9 |
| 5 | Jul 2026 | **Mode offline tidak diperlukan.** Dicoret dari roadmap. | PRD §8 |
| 6 | Jul 2026 | **GeoJSON tidak boleh diakses publik dan tidak boleh berada di frontend** (bukan aset statis, tidak dibundel ke build, tidak di repo publik). Satu-satunya jalur: API ber-autentikasi JWT dengan `Cache-Control: private, no-store`. | ARCHITECTURE §5 (checklist lengkap) · API-SPEC header · PRD §7 · AGENTS aturan #11 · TASKS 8.3 |

## Konsekuensi teknis ringkas (untuk junior)

- Form proyek: tombol simpan disable sampai user memilih minimal desa.
- Tidak ada lagi service tile session / proxy tiles di backend — basemap urusan frontend (config).
- Tabel `infrastructure_photos` dan `tile_sessions` DIHAPUS dari skema (lihat DATABASE v1.2).
- CI menambahkan pengecekan: hasil build FE tidak boleh mengandung FeatureCollection.
