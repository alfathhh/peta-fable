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
| 7 | Jul 2026 | **Approval infrastruktur oleh admin.** Kolom `approval_status` (`pending`/`approved`/`rejected`, default `pending`) + `approval_note` (alasan penolakan, terlihat pembuat). Peta umum hanya menampilkan `approved`; semua status hanya terlihat di tampilan proyek milik petugas sendiri (atau admin). Endpoint: `PUT /admin/infrastructures/{id}/approval`. | infraService (visibilitas) · migration `1_add_infrastructure_approval` & `2_approval_note_and_audit_logs` · halaman admin Infrastruktur |
| 8 | Jul 2026 | **Wilayah infrastruktur bisa dipilih manual sampai sub-SLS** selain auto-detect point-in-polygon: mode manual mewajibkan kec/desa/SLS (cukup kirim `idsls` — id level di atasnya diturunkan dari prefix), sub-SLS opsional. Keduanya divalidasi ke master `regions`. | infraService `resolveManualRegion` · form InfraForm |
| 9 | Jul 2026 | **Koordinat boleh disesuaikan lewat minimap** (revisi sebagian keputusan lama "hanya dari GPS"): saat MEMBUAT titik, koordinat awal tetap dari GPS tapi petugas boleh menggeser pin di minimap; saat MENGEDIT, koordinat terkunci untuk petugas — **hanya admin** yang boleh mengubah (wilayah + flag `is_outside_region` di-resolve ulang otomatis). | AGENTS/CLAUDE aturan #4 (diperbarui) · MiniMapPicker · infraService update |
| 10 | Jul 2026 | **Fitur pendukung admin disetujui**: dashboard ringkasan, audit log aksi penting (approve/reject/CRUD user·kategori·token/upload wilayah/import), export "data saya" untuk petugas, choropleth jumlah infrastruktur, dan alasan penolakan ACC. | dashboardService · auditService · `/my/export/infrastructures` · `/regions/stats` |
| 11 | Jul 2026 | **Membuat proyek mensyaratkan token klaim yang masih aktif & belum kedaluwarsa.** Klaim atas token yang kemudian mati/kedaluwarsa TIDAK lagi bisa dipakai membuat proyek baru (semula klaim berlaku permanen); proyek yang sudah terlanjur dibuat tetap berjalan. Konsisten dengan filter dropdown kegiatan di FE. | projectService `createProject` · AUDIT-VERIFIKASI temuan #3 |
| 12 | 11 Jul 2026 | **Perubahan konten publik oleh petugas wajib melalui approval ulang.** Jika petugas mengubah nama, kategori, deskripsi, atau foto pada infrastruktur berstatus `approved` atau `rejected`, backend mengubah status menjadi `pending` dan mengosongkan `approval_note`. Edit oleh admin mempertahankan status dan catatan approval. Record yang sudah `pending` tetap `pending`. | DATABASE §2.9 & aturan #10 · `infraService.updateInfrastructure` |

## Konsekuensi teknis ringkas (untuk junior)

- Form proyek: tombol simpan disable sampai user memilih minimal desa.
- Tidak ada lagi service tile session / proxy tiles di backend — basemap urusan frontend (config).
- Tabel `infrastructure_photos` dan `tile_sessions` DIHAPUS dari skema (lihat DATABASE v1.2).
- CI menambahkan pengecekan: hasil build FE tidak boleh mengandung FeatureCollection.
