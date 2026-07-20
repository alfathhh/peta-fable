import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../middlewares/errorHandler';
import { parentIdsOf } from '../lib/regionId';
import { assertWorkbookShape } from '../lib/importLimits';
import { resolveRegionFromPoint } from './regionResolver';

interface ParsedRow {
  row: number;
  nama: string;
  kategori: string;
  lat: number;
  lng: number;
  deskripsi: string | null;
  idsls: string | null;
  category_id?: string;
  errors: string[];
}

interface ImportResult {
  saved: number;
  failed: number;
  failed_download_url: string | null;
}

/** Template XLSX: sheet Data + Petunjuk + Referensi (kategori & kode wilayah). */
export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const data = wb.addWorksheet('Data');
  data.addRow(['nama*', 'kategori*', 'lat*', 'lng*', 'deskripsi', 'idsls']).font = { bold: true };
  data.addRow(['SD Negeri 01 Contoh', 'Pendidikan', -0.62, 100.12, 'Contoh baris — hapus sebelum upload', '']);
  data.columns.forEach((c) => (c.width = 24));

  const guide = wb.addWorksheet('Petunjuk');
  [
    'PETUNJUK PENGISIAN IMPORT INFRASTRUKTUR',
    '',
    '1. Kolom bertanda * wajib diisi.',
    '2. "kategori" harus sama persis dengan nama kategori di sheet Referensi.',
    '3. "lat" dan "lng" berupa angka desimal (contoh: -0.62 dan 100.12).',
    '4. "idsls" opsional (14 digit). Jika kosong, sistem menentukan wilayah dari koordinat.',
    '5. Jangan mengubah baris judul (baris pertama) sheet Data.',
    '6. Hapus baris contoh sebelum meng-upload.',
  ].forEach((line) => guide.addRow([line]));
  guide.getColumn(1).width = 90;

  const ref = wb.addWorksheet('Referensi');
  ref.addRow(['KATEGORI (pakai nama persis)']).font = { bold: true };
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  for (const c of categories) ref.addRow([c.name]);
  ref.addRow([]);
  ref.addRow(['KODE WILAYAH SLS (idsls — nama)']).font = { bold: true };
  const slsRows = await prisma.region.findMany({
    where: { level: 'sls' },
    select: { regionId: true, name: true },
    orderBy: { regionId: 'asc' },
    take: 5000,
  });
  for (const r of slsRows) ref.addRow([r.regionId, r.name]);
  ref.getColumn(1).width = 22;
  ref.getColumn(2).width = 50;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text);
  if (typeof value === 'object' && 'result' in value) return String((value as { result: unknown }).result ?? '');
  return String(value);
}

/**
 * Langkah 1: validasi per baris. Belum menyimpan infrastruktur apa pun —
 * hasil parsing diparkir sebagai job di DB (durable lintas restart).
 */
export async function validateImport(buffer: Buffer, userId: string) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('File harus berupa XLSX yang valid');
  }
  const sheet = wb.getWorksheet('Data') ?? wb.worksheets[0];
  if (!sheet) throw badRequest('Sheet Data tidak ditemukan');
  assertWorkbookShape(wb.worksheets.length, Math.max(0, sheet.rowCount - 1));

  const categories = await prisma.category.findMany({ where: { isActive: true } });
  const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const nama = cellText(row.getCell(1).value).trim();
    const kategori = cellText(row.getCell(2).value).trim();
    const latStr = cellText(row.getCell(3).value).trim();
    const lngStr = cellText(row.getCell(4).value).trim();
    const deskripsi = cellText(row.getCell(5).value).trim() || null;
    const idsls = cellText(row.getCell(6).value).trim() || null;
    if (!nama && !kategori && !latStr && !lngStr) return; // baris kosong

    const errors: string[] = [];
    if (!nama) errors.push('Nama wajib diisi');
    const cat = catByName.get(kategori.toLowerCase());
    if (!cat) errors.push(`Kategori "${kategori}" tidak ada di master`);
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!latStr || Number.isNaN(lat) || lat < -90 || lat > 90) errors.push('Latitude tidak valid');
    if (!lngStr || Number.isNaN(lng) || lng < -180 || lng > 180) errors.push('Longitude tidak valid');
    if (idsls && idsls.length !== 14) errors.push('idsls harus 14 digit');

    rows.push({ row: rowNumber, nama, kategori, lat, lng, deskripsi, idsls, category_id: cat?.id, errors });
  });

  if (rows.length === 0) throw badRequest('Tidak ada baris data di file');

  // Validasi idsls terhadap master wilayah (batch)
  const idslsList = [...new Set(rows.map((r) => r.idsls).filter((v): v is string => !!v && v.length === 14))];
  const known = idslsList.length
    ? new Set(
        (
          await prisma.region.findMany({ where: { regionId: { in: idslsList }, level: 'sls' }, select: { regionId: true } })
        ).map((r) => r.regionId),
      )
    : new Set<string>();
  for (const r of rows) {
    if (r.idsls && r.idsls.length === 14 && !known.has(r.idsls)) r.errors.push(`idsls ${r.idsls} tidak dikenal`);
  }

  const job = await prisma.importJob.create({
    data: { createdBy: userId, module: 'infrastructures', rows: JSON.parse(JSON.stringify(rows)) },
  });

  const invalid = rows.filter((r) => r.errors.length > 0);
  return {
    upload_id: job.id,
    valid_rows: rows.length - invalid.length,
    invalid_rows: invalid.map((r) => ({ row: r.row, errors: r.errors })),
    summary: { total: rows.length, valid: rows.length - invalid.length, invalid: invalid.length },
  };
}

async function getJob(uploadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw notFound('Upload tidak ditemukan');
  const job = await prisma.importJob.findUnique({ where: { id: uploadId } });
  if (!job) throw notFound('Upload tidak ditemukan atau sudah kedaluwarsa');
  if (job.module !== 'infrastructures') throw notFound('Upload infrastruktur tidak ditemukan');
  return job;
}

/**
 * Langkah 2: commit — hanya baris valid yang disimpan, all-or-nothing.
 * Klaim job + insert seluruh baris + tanda 'committed' terjadi dalam SATU
 * transaction: crash kapan pun ter-rollback ke status 'validated' (aman retry),
 * commit ulang mengembalikan hasil pertama, dan dua commit bersamaan tidak
 * pernah menduplikasi baris (UPDATE ... WHERE status='validated' bersifat atomik).
 */
export async function commitImport(uploadId: string, userId: string): Promise<ImportResult> {
  const job = await getJob(uploadId);
  if (job.status === 'committed' && job.result) return job.result as unknown as ImportResult;

  const allRows = job.rows as unknown as ParsedRow[];
  const valid = allRows.filter((r) => r.errors.length === 0);

  // Resolusi wilayah (read-only) dikerjakan di luar transaction agar transaksinya pendek
  const resolvedRows = await Promise.all(
    valid.map(async (r) => {
      if (r.idsls) {
        const parents = parentIdsOf(r.idsls);
        return {
          row: r,
          ids: { idkab: parents.kab ?? null, idkec: parents.kec ?? null, iddesa: parents.desa ?? null, idsls: r.idsls, idsubsls: null },
        };
      }
      const resolved = await resolveRegionFromPoint(r.lat, r.lng);
      return {
        row: r,
        ids: { idkab: resolved.idkab, idkec: resolved.idkec, iddesa: resolved.iddesa, idsls: resolved.idsls, idsubsls: resolved.idsubsls },
      };
    }),
  );

  return prisma.$transaction(
    async (tx) => {
      const claimed = await tx.$executeRaw`
        UPDATE import_jobs SET status = 'committing', updated_at = timezone('utc', now())
        WHERE id = ${uploadId} AND status = 'validated';
      `;
      if (claimed === 0) {
        // Sudah diklaim transaksi lain: selesai → kembalikan hasilnya; masih berjalan → 409
        const current = await tx.importJob.findUnique({ where: { id: uploadId } });
        if (current?.status === 'committed' && current.result) return current.result as unknown as ImportResult;
        throw conflict('Import sedang diproses');
      }

      for (const { row, ids } of resolvedRows) {
        const category = await tx.category.findFirst({ where: { id: row.category_id!, isActive: true }, select: { id: true } });
        if (!category) {
          // sebut nomor barisnya — import bersifat all-or-nothing, admin perlu tahu
          // baris mana yang menggagalkan seluruh commit
          throw badRequest(
            `Baris ${row.row}: kategori "${row.kategori}" sudah tidak aktif/tersedia. ` +
              'Tidak ada baris yang disimpan — perbaiki lalu commit ulang.',
          );
        }
        const infra = await tx.infrastructure.create({
          data: {
            name: row.nama,
            categoryId: category.id,
            description: row.deskripsi,
            lat: row.lat,
            lng: row.lng,
            idkab: ids.idkab,
            idkec: ids.idkec,
            iddesa: ids.iddesa,
            idsls: ids.idsls,
            idsubsls: ids.idsubsls,
            isOutsideRegion: ids.idkab !== '1306',
            userId,
            source: 'import',
            approvalStatus: 'approved',
          },
        });
        await tx.$executeRaw`
          UPDATE infrastructures SET geom = ST_SetSRID(ST_MakePoint(${row.lng}, ${row.lat}), 4326) WHERE id = ${infra.id};
        `;
      }

      const failed = allRows.filter((r) => r.errors.length > 0);
      const result: ImportResult = {
        saved: resolvedRows.length,
        failed: failed.length,
        failed_download_url: failed.length ? `/api/admin/import/infrastructures/${uploadId}/failed` : null,
      };
      await tx.importJob.update({
        where: { id: uploadId },
        data: { status: 'committed', result: JSON.parse(JSON.stringify(result)) },
      });
      return result;
    },
    { timeout: 120_000 },
  );
}

/** File XLSX berisi baris gagal + alasannya, untuk diperbaiki lalu di-upload ulang. */
export async function buildFailedRowsXlsx(uploadId: string): Promise<Buffer> {
  const job = await getJob(uploadId);
  const failed = (job.rows as unknown as ParsedRow[]).filter((r) => r.errors.length > 0);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(['nama*', 'kategori*', 'lat*', 'lng*', 'deskripsi', 'idsls', 'ALASAN GAGAL']).font = { bold: true };
  for (const r of failed) {
    ws.addRow([r.nama, r.kategori, r.lat, r.lng, r.deskripsi, r.idsls, r.errors.join('; ')]);
  }
  ws.columns.forEach((c) => (c.width = 24));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
