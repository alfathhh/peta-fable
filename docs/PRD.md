# PRD — Aplikasi Web Peta Tematik Kabupaten Padang Pariaman

> **Product Requirements Document** · Versi 1.3 · Juli 2026
> Perubahan v1.3 (keputusan PO #13): proyek memilih tepat satu master wilayah level kecamatan sampai sub-SLS; kabupaten ditolak; wilayah pilihan otomatis menjadi outline dan target fitBounds; upload layer tetap opsional.
> Perubahan v1.2 (keputusan PO, lihat `DECISIONS.md`): proyek minimal level desa, infrastruktur maks 1 foto, titik di luar wilayah = simpan+flag, basemap XYZ Google langsung, tanpa mode offline, **GeoJSON tidak boleh publik**.
> Perubahan v1.1: role disederhanakan menjadi 2 (admin & petugas), stack full JavaScript/TypeScript, penegasan ikon per kategori.
> Dokumen ini ditulis untuk junior developer. Baca pelan-pelan, semua istilah dijelaskan.

---

## 1. Ringkasan Produk

Aplikasi web peta tematik untuk wilayah **Kabupaten Padang Pariaman** (kode BPS: `1306`).
Tampilannya mirip Google Maps, tapi punya nilai tambah:

1. **Batas wilayah administratif** 5 level: Kabupaten → Kecamatan → Desa/Nagari → SLS (Korong) → Sub-SLS.
2. **Pinpoint infrastruktur** (sekolah, masjid, puskesmas, dll) — **setiap kategori punya ikon dan warna sendiri** — yang muncul **hanya saat difilter/dicari**, lengkap dengan foto, informasi, dan link ke Google Maps.
3. **Manajemen kegiatan lapangan** berbasis token: admin buat token kegiatan → petugas klaim token → petugas buat proyek per wilayah → petugas menambah infrastruktur dari lokasi GPS-nya saat itu.

Basemap memakai **Google Street (roadmap)** dan **Google Hybrid** (satelit + label) via tiles.

Teknologi: **full JavaScript/TypeScript** — backend Node.js (Express), frontend React + Vite (SPA, **bukan Next.js**), database PostgreSQL + PostGIS. Detail di `ARCHITECTURE.md`.

---

## 2. Masalah yang Diselesaikan

| Masalah | Solusi di aplikasi ini |
|---|---|
| Data infrastruktur wilayah tersebar di Excel/foto WA, tidak ada petanya | Semua infrastruktur punya koordinat, foto, ikon kategori, tampil di peta |
| Sulit memantau petugas lapangan mendata di wilayah yang benar | Proyek terikat wilayah (sampai level sub-SLS) dan koordinat infrastruktur otomatis dari GPS petugas |
| Kegiatan (misal Susenas 2026) butuh kontrol akses | Token kegiatan 7 karakter, ada masa kedaluwarsa, dibuat admin |
| Data wilayah berat kalau dirender semua | Layer wilayah di-load **on-demand** per level & per parent wilayah |

---

## 3. Pengguna & Peran (Roles)

Hanya ada **2 peran**: `admin` dan `petugas` (di brief disebut "user").

### 3.1 Admin
- CRUD user (buat akun, ganti peran, reset password, nonaktifkan).
- Update/replace file GeoJSON wilayah (per level).
- CRUD kategori infrastruktur — **termasuk memilih ikon dan warna** untuk pin kategori tsb.
- CRUD **semua** data infrastruktur (termasuk milik petugas).
- CRUD proyek milik semua user (project management).
- CRUD token kegiatan.
- CRUD kegiatan (master kegiatan, misal "Susenas 2026").
- **Export CSV/Excel** untuk semua modul (user, infrastruktur, proyek, token, kegiatan).
- **Import bulk Excel** untuk infrastruktur, dengan **template Excel yang bisa diunduh**.

### 3.2 Petugas ("user" pada brief)
- Lihat peta default + infrastruktur (sesuai aturan tampil di bagian 5.4).
- **Klaim token kegiatan**: memasukkan token 7 karakter → kegiatan itu jadi tersedia untuknya.
- Buat **proyek kegiatan**:
  - Pilih **tepat satu master wilayah** lewat dropdown berjenjang: Kecamatan → Desa/Nagari → SLS → Sub-SLS. Level yang boleh disimpan adalah kecamatan, desa, SLS, atau sub-SLS; kabupaten tidak bisa dipilih sebagai wilayah proyek.
  - Isi nama proyek.
  - Pilih nama kegiatan (dropdown, hanya dari token yang sudah ia klaim & belum kedaluwarsa).
- Di dalam proyek:
  - Lihat peta + **lokasi GPS saat ini**.
  - **Upload GeoJSON/Shapefile** tambahan (sampai level sub-SLS) sebagai layer proyek.
  - **Atur tampilan layer**: outline saja / fill, warna, opasitas.
  - **Tampilkan label atribut** dari GeoJSON (misal `idsls` atau `nmsls`), atur ukuran & warna font.
  - **CRUD infrastruktur miliknya sendiri**, dengan batasan: **koordinat otomatis diambil dari lokasi GPS saat ini** (tidak bisa diketik manual / geser pin). Form isian: foto (opsional), nama infrastruktur, kategori, koordinat (auto), deskripsi.
- Petugas **tidak bisa** mengedit/menghapus infrastruktur milik user lain.

### 3.3 Matriks Permission

| Fitur | Admin | Petugas |
|---|:--:|:--:|
| Lihat peta & wilayah | ✅ | ✅ |
| CRUD user | ✅ | ❌ |
| Update GeoJSON wilayah | ✅ | ❌ |
| CRUD kategori infrastruktur (ikon & warna) | ✅ | ❌ |
| CRUD token & kegiatan | ✅ | ❌ |
| Klaim token | ❌ | ✅ |
| CRUD proyek | ✅ (semua) | ✅ (miliknya) |
| CRUD infrastruktur | ✅ (semua) | ✅ (miliknya, lokasi GPS) |
| Upload layer GeoJSON/SHP di proyek | ✅ | ✅ (proyeknya) |
| Export CSV/Excel | ✅ | ❌ (fase 2: export data miliknya) |
| Import bulk Excel infrastruktur | ✅ | ❌ |

> Otorisasi WAJIB dicek di backend, bukan hanya menyembunyikan tombol di UI.

---

## 4. Struktur Data Wilayah (PENTING — baca ini dulu)

Kode wilayah mengikuti standar BPS dan **hierarkis** (kode anak diawali kode induk):

| Level | Field ID | Contoh | Panjang | Keterangan |
|---|---|---|---|---|
| Kabupaten | `idkab` | `1306` | 4 | 13 = Sumbar, 06 = Padang Pariaman |
| Kecamatan | `idkec` | `1306010` | 7 | `idkab` + 3 digit |
| Desa/Nagari | `iddesa` | `1306010001` | 10 | `idkec` + 3 digit |
| SLS/Korong | `idsls` | `13060100010001` | 14 | `iddesa` + 4 digit |
| Sub-SLS | `idsubsls` | `1306010001000100` | 16 | `idsls` + 2 digit |

Konsekuensi penting untuk developer:

1. **Relasi parent-child cukup pakai prefix.** Semua SLS di nagari `1306010001` adalah baris yang `idsls`-nya diawali `1306010001`. Tidak perlu foreign key rumit.
2. **Sorting** default: urutkan berdasarkan kolom id level tersebut (`ORDER BY idsubsls` / `idsls` / dst) sebagai **string**, jangan number (16 digit melebihi presisi aman integer JavaScript / int32 DB).
3. Simpan semua id sebagai **string/VARCHAR**, bukan angka (leading zero bisa hilang).

### 4.1 GeoJSON: satu file atau per layer?

**Keputusan: per layer (5 dataset terpisah), bukan 1 file gabungan.**

Alasan:
- Render on-demand: user di level kecamatan tidak perlu download ribuan poligon sub-SLS.
- File sub-SLS bisa sangat besar; kalau digabung, initial load berat.
- Update batas per level tidak menyentuh level lain.

Implementasi: GeoJSON di-import ke database (PostGIS) sebagai sumber kebenaran, lalu API menyajikan GeoJSON **per level + per parent** (contoh: "semua SLS di dalam desa X"). Detail di `ARCHITECTURE.md` bagian 4.

---

## 5. Fitur Detail

### 5.1 Peta & Basemap
- Basemap: **Google Street (roadmap)** dan **Google Hybrid**, user bisa toggle.
- Keputusan PO (`DECISIONS.md` #4): basemap memakai endpoint tile XYZ Google langsung — `lyrs=m` (street) dan `lyrs=y` (hybrid), tanpa API key. **Ada risiko ToS** — baca catatan & rencana cadangan di `ARCHITECTURE.md` §3.
- View awal: fit ke bounding box Kabupaten Padang Pariaman.
- Kontrol: zoom, tombol "lokasi saya", toggle basemap, toggle layer wilayah.

### 5.2 Layer Wilayah (on-demand)
- Saat pertama buka: hanya outline **kabupaten** (1 poligon, ringan).
- User memilih level lewat panel filter. Level lebih dalam **hanya di-load setelah parent dipilih**:
  - Pilih level "Kecamatan" → load semua kecamatan di 1306 (±17 poligon, ringan).
  - Klik/pilih 1 kecamatan → load nagari di dalamnya. Dan seterusnya sampai sub-SLS.
- Geometri yang dikirim API sudah **disederhanakan (simplified)** sesuai level zoom (lihat `ARCHITECTURE.md` §4.3).
- Klik poligon → highlight + tampilkan info ringkas (nama, id, statistik jika ada).

### 5.3 Filter & Search Wilayah
- **Filter**: dropdown berjenjang Kab → Kec → Desa → SLS → Sub-SLS. Setiap pilihan memfilter opsi level di bawahnya (pakai prefix id).
- **Search**: satu kotak pencarian. Mencari berdasarkan **nama wilayah** (nmkec, nmdesa, nmsls, dst) dan **id wilayah**. Hasil diklik → peta zoom ke wilayah itu dan filter aktif ikut ter-set.
- Filter wilayah yang aktif disebut **"wilayah aktif"** — dipakai fitur lain (5.4).

### 5.4 Pinpoint Infrastruktur (dengan ikon per kategori)
- **Setiap kategori punya ikon + warna sendiri** (diatur admin). Pin di peta dirender sebagai marker berikon (contoh: kategori "Pendidikan" = ikon sekolah warna biru, "Ibadah" = ikon masjid warna hijau). Ikon dipilih dari pustaka ikon **Lucide** (nama ikon disimpan di DB), warna hex bebas.
- **Aturan utama: infrastruktur TIDAK muncul semua secara default.** Pin baru muncul jika:
  1. User memilih **filter kategori** (misal: "Pendidikan"), **dan/atau**
  2. User melakukan **search infrastruktur** (by nama).
- Pin yang muncul **selalu dibatasi wilayah aktif**. Contoh: wilayah aktif = Nagari Katapiang → filter kategori "Masjid" hanya menampilkan masjid di dalam wilayah Katapiang.
- Klik pin → **popup** berisi: foto, ikon & nama kategori, nama infrastruktur, deskripsi, nama wilayah, tombol **"Buka di Google Maps"** (`https://www.google.com/maps?q={lat},{lng}`).
- Legenda ikon kategori tampil di panel filter saat ada kategori aktif.

### 5.5 Autentikasi & Manajemen User
- Login username/email + password. Tanpa registrasi publik — akun dibuat admin.
- Session pakai JWT (detail di `ARCHITECTURE.md` §6). Logout, ganti password sendiri.
- Admin: tabel user + tambah/edit/nonaktifkan/reset password, set peran (admin/petugas).

### 5.6 Token Kegiatan
- Admin membuat **kegiatan** (contoh: "Susenas Maret 2026") lalu men-generate **token**: string acak **7 karakter huruf kapital + angka** (contoh: `A7K9M2X`), hindari karakter membingungkan (`0/O`, `1/I/L`).
- Token punya: kegiatan terkait, tanggal kedaluwarsa, batas pemakaian (opsional, default tak terbatas), status aktif.
- **Petugas klaim token**: masukkan kode → jika valid & belum kedaluwarsa → kegiatan masuk daftar kegiatan miliknya. Token kedaluwarsa/nonaktif → tampilkan pesan error yang jelas.
- Satu petugas tidak bisa klaim token yang sama dua kali.

### 5.7 Proyek Kegiatan (milik petugas)
- Form buat proyek:
  - **Nama proyek** (teks bebas).
  - **Kegiatan** (dropdown dari token yang sudah diklaim & masih berlaku).
  - **Wilayah** (tepat satu pilihan dari dropdown berjenjang: kecamatan, desa, SLS, atau sub-SLS. Backend menolak level kabupaten dengan 422).
- Halaman proyek = peta yang:
  - Master wilayah terpilih otomatis menjadi outline proyek dan target `fitBounds`, diambil dari API GeoJSON wilayah terautentikasi dengan filter level + ID yang menghasilkan tepat satu feature.
  - Menampilkan **lokasi GPS user saat ini** (dot biru, update berkala).
  - Panel **layer proyek** (5.8) dan tombol **"+ Infrastruktur"** (5.9).

### 5.8 Layer Upload di Proyek (GeoJSON/Shapefile)
- Upload layer tambahan bersifat **opsional** karena outline master wilayah selalu tersedia otomatis. Petugas bisa upload file **GeoJSON** (`.geojson`/`.json`) atau **Shapefile** (`.zip` berisi .shp+.dbf+.shx+.prj) — maksimal level sub-SLS, ukuran maks 20 MB.
- Shapefile dikonversi ke GeoJSON **di browser** memakai library `shpjs` (tidak membebani server).
- Pengaturan tampilan per layer (disimpan ke DB agar persist):
  - Mode: **outline saja** atau **fill**.
  - Warna garis, warna fill, opasitas fill, tebal garis.
  - **Label atribut**: pilih 1 field dari properti GeoJSON (misal `nmsls`), atur ukuran font (px) dan warna font.
  - Toggle show/hide, hapus layer.

### 5.9 Tambah Infrastruktur oleh Petugas
- Hanya bisa dilakukan **di dalam proyek**.
- Form: foto (opsional, **maksimal 1 foto**, kamera/galeri, maks 5 MB, dikompres di client), nama infrastruktur, kategori (dropdown dengan preview ikon), **koordinat otomatis dari GPS saat ini** (read-only, tampilkan akurasi ±meter), deskripsi.
- Validasi:
  - GPS wajib aktif; jika izin lokasi ditolak → form tidak bisa disubmit, tampilkan panduan mengaktifkan lokasi.
  - Jika titik berada **di luar poligon wilayah proyek**: data **tetap disimpan** tapi diberi flag `is_outside_region = true`, dan UI menampilkan peringatan setelah simpan. Admin bisa memfilter data ber-flag ini (keputusan PO, `DECISIONS.md` #3).
- Infrastruktur menyimpan: pembuat (user_id), proyek, kegiatan, id wilayah (di-resolve otomatis dari koordinat via point-in-polygon di server → dapat `idsubsls` → semua id level di atasnya otomatis lewat prefix).
- Petugas bisa edit/hapus infrastruktur miliknya (edit nama/kategori/deskripsi/foto; **koordinat tidak bisa diedit** — kalau salah titik, hapus dan buat ulang di lokasi).

### 5.10 Export & Import
- **Export** (khusus admin, semua modul): tombol "Export" → pilih CSV atau XLSX → file terunduh, mengikuti filter aktif di tabel.
- **Import bulk infrastruktur** (admin):
  1. Unduh **template XLSX** (header + 1 baris contoh + sheet "Petunjuk" + sheet daftar kategori & kode wilayah).
  2. Isi → upload → sistem validasi per baris (kategori ada? koordinat valid? id wilayah valid?).
  3. Tampilkan **preview hasil validasi** (baris OK / baris error + alasannya) → user konfirmasi → hanya baris OK yang masuk. Baris error bisa diunduh sebagai file Excel untuk diperbaiki.

### 5.11 Statistik Wilayah (tematik)
- Panel info wilayah menampilkan agregat sederhana: jumlah infrastruktur per kategori (dengan ikonnya) di wilayah itu.
- (Fase 2) Choropleth: pewarnaan poligon berdasarkan jumlah infrastruktur / atribut statistik yang diupload admin.

---

## 6. Alur Utama (User Flow)

```
ADMIN                                PETUGAS
──────                               ────────
1. Buat kegiatan "Susenas 2026"
2. Generate token  A7K9M2X
   (expired: 31 Mar 2026)
                                     3. Login → menu "Klaim Token"
                                        → input A7K9M2X → sukses
                                     4. Buat Proyek:
                                        - Nama: "Listing Blok A"
                                        - Kegiatan: Susenas 2026
                                        - Wilayah: Kec. Batang Anai
                                          → Nagari Katapiang
                                          → SLS Korong Kasai
                                          → Sub-SLS 00
                                     5. Buka proyek → peta zoom ke
                                        wilayah + lokasi GPS tampil
                                     6. (Opsional) Upload SHP/GeoJSON
                                        → atur outline/fill/warna/label
                                     7. Tekan "+ Infrastruktur" di lokasi
                                        → foto + nama + kategori +
                                        deskripsi → simpan
8. Pantau semua proyek & data,
   export Excel bila perlu
```

---

## 7. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Performa peta | Initial load < 3 detik di 4G; layer wilayah di-load on-demand & tersimplifikasi; maks payload 1 request GeoJSON ± 2 MB |
| Responsif | Mobile-first (petugas di lapangan pakai HP), tetap nyaman di desktop |
| Browser | Chrome/Edge/Firefox/Safari 2 versi terakhir |
| Keamanan | Password bcrypt, semua endpoint API di belakang auth kecuali login, otorisasi per peran di server, validasi upload (tipe & ukuran file) |
| GPS | `navigator.geolocation.watchPosition` dengan `enableHighAccuracy: true`; simpan akurasi (meter) bersama titik |
| Foto | Kompres di client (maks lebar 1600px, JPEG q80) sebelum upload |
| Data | Backup DB harian; foto di storage terpisah dari DB |
| Privasi data wilayah | **GeoJSON tidak boleh diakses publik**: tidak ada file geojson statis di frontend/build/repo publik; semua data wilayah & layer hanya lewat API ber-autentikasi (JWT) dengan `Cache-Control: private, no-store`; tidak ada halaman peta tanpa login |
| Bahasa UI | Indonesia |

---

## 8. Di Luar Cakupan (Out of Scope) v1

- Mode offline / PWA sinkronisasi — **tidak diperlukan** (keputusan PO, `DECISIONS.md` #5).
- Peran tambahan (pengawas/verifikator) — arsitektur role berbasis string, gampang ditambah nanti.
- Multi-kabupaten (arsitektur disiapkan, tapi UI v1 hanya 1306).
- Notifikasi email/WA.
- Edit geometri wilayah lewat UI (admin hanya replace file).
- Upload ikon kategori custom (v1: pilih dari pustaka Lucide).

---

## 9. Definisi Selesai (Definition of Done) per Fitur

Sebuah fitur dianggap selesai jika:
1. Berfungsi sesuai deskripsi di PRD ini (happy path + validasi error).
2. Otorisasi peran dicek **di backend** dan sudah dites.
3. Responsif di layar 360px dan 1366px.
4. Ada minimal 1 test otomatis untuk logika penting (service/endpoint).
5. Direview 1 developer lain (atau lead).

---

## 10. Dokumen Terkait

| File | Isi |
|---|---|
| `ARCHITECTURE.md` | Stack JS/TS, struktur folder, strategi GeoJSON & tiles |
| `DATABASE.md` | Skema tabel + penjelasan |
| `API-SPEC.md` | Daftar endpoint + contoh request/response |
| `TASKS.md` | Breakdown tugas per milestone untuk junior dev |
| `DECISIONS.md` | Log keputusan product owner (jawaban pertanyaan terbuka) |
| `AGENTS.md` | Aturan untuk AI coding agent (Claude Code, dll) |
