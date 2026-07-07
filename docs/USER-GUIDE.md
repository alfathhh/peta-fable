# USER-GUIDE.md — Panduan Pengguna Singkat

> Versi 1.0 · Juli 2026. Untuk admin & petugas. Panduan teknis (dev/deploy) ada di `howto.md`.

Login memakai akun yang dibuat admin (tidak ada pendaftaran mandiri). Aplikasi
nyaman dipakai di HP — petugas lapangan disarankan memakai Chrome/Safari terbaru
dengan **izin lokasi (GPS) aktif**.

---

## Untuk Petugas

### 1. Klaim token kegiatan
1. Menu **Kegiatan Saya** → masukkan token 7 karakter dari admin (contoh: `A7K9M2X`) → **Klaim**.
2. Kegiatan muncul di daftar dan bisa dipakai membuat proyek selama token belum kedaluwarsa.

### 2. Buat proyek
1. Menu **Proyek** → **Proyek Baru**.
2. Isi nama, pilih kegiatan (hasil klaim), lalu pilih wilayah lewat dropdown
   berjenjang. Kecamatan hanya untuk mempersempit — yang bisa disimpan minimal
   **desa/nagari** (boleh SLS atau sub-SLS).

### 3. Mendata infrastruktur (di dalam proyek)
1. Buka proyek → peta otomatis zoom ke wilayah proyek; titik biru = posisi GPS Anda.
2. Tekan **+ Infrastruktur**:
   - **Foto** (opsional, maks 1): ambil dari kamera/galeri, lalu atur lewat
     editor (geser, zoom, crop) — tombol **Edit** untuk mengatur ulang foto tersimpan.
   - Nama, kategori (dengan pratinjau ikon pin), deskripsi.
   - **Koordinat** terisi dari GPS; bila pin kurang tepat, geser di minimap
     sebelum menyimpan (setelah tersimpan, koordinat tidak bisa diubah — hubungi admin).
   - **Wilayah**: otomatis dari lokasi, atau pilih manual (kecamatan, desa,
     SLS wajib; sub-SLS opsional).
3. Bila titik di luar wilayah proyek, data tetap tersimpan dengan penanda peringatan.
4. Data baru berstatus **Menunggu ACC** — hanya terlihat di proyek Anda sampai
   di-ACC admin. Jika **Ditolak**, alasan dari admin tampil di daftar
   "Infrastruktur Saya"; perbaiki datanya (edit/hapus-buat ulang).

### 4. Layer peta tambahan
Di panel **Layer Proyek**: upload GeoJSON atau Shapefile (.zip), lalu atur
outline/fill, warna, opasitas, tebal garis, dan label atribut (mis. `nmsls`).

### 5. Export data saya
Menu **Proyek** → **Export Data Saya** untuk mengunduh seluruh infrastruktur
yang Anda input (XLSX).

---

## Untuk Admin

### Alur kegiatan
1. **Kegiatan & Token** → buat kegiatan (mis. "Susenas 2026") → **Generate Token**
   (atur kedaluwarsa & batas pemakaian) → bagikan token ke petugas.

### Meninjau data (ACC)
1. **Dashboard** menampilkan jumlah data menunggu ACC; klik untuk meninjau.
2. **Infrastruktur** → kolom ACC: ✓ meng-ACC (tampil di peta umum),
   ✗ menolak (bisa disertai alasan yang terlihat petugas). Filter tersedia untuk
   status ACC dan titik di luar wilayah proyek. Admin juga bisa mengoreksi
   koordinat (minimap), foto, dan atribut lain.

### Data wilayah
**Data Wilayah** → pilih level → upload file GeoJSON. Proses berjalan di
server (file besar aman); status tampil di tabel riwayat. Upload MENGGANTI
seluruh data level tersebut.

### Master & pengguna
- **Kategori**: nama + ikon (pustaka Lucide) + warna pin.
- **Pengguna**: buat akun petugas/admin, reset password, nonaktifkan.

### Peta tematik
Di panel filter peta, aktifkan **choropleth** untuk mewarnai wilayah
berdasarkan jumlah infrastruktur ter-ACC (mengikuti filter kategori).

### Export, import, audit
- **Import/Export**: export CSV/XLSX semua modul; import bulk infrastruktur
  (unduh template → isi → validasi → simpan baris valid → unduh baris gagal).
- **Audit Log**: riwayat aksi penting (ACC/tolak, CRUD pengguna/kategori/token,
  upload wilayah, import).

---

## Masalah Umum

| Masalah | Solusi |
|---|---|
| Form infrastruktur tidak bisa disimpan | Pastikan izin lokasi (GPS) diizinkan di browser, lalu muat ulang halaman |
| Pin tidak muncul di peta | Pin hanya tampil setelah memilih filter kategori / mengetik pencarian, dan hanya data yang sudah di-ACC admin |
| Token ditolak saat klaim | Cek ejaan (huruf kapital), masa berlaku, dan apakah token masih aktif — hubungi admin |
| Akun tidak bisa login | Akun mungkin dinonaktifkan; hubungi admin |
