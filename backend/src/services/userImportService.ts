import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../middlewares/errorHandler';

interface UserRow {
  row: number;
  nama: string;
  username: string;
  email: string | null;
  password: string;
  role: 'admin' | 'petugas';
  aktif: boolean;
  errors: string[];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text);
  if (typeof value === 'object' && 'result' in value) return String((value as { result: unknown }).result ?? '');
  return String(value);
}

export async function buildUserTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet('Data');
  data.addRow(['nama*', 'username*', 'email', 'password*', 'role*', 'aktif*']).font = { bold: true };
  data.addRow(['Petugas Contoh', 'petugas.contoh', 'petugas@example.com', 'rahasia123', 'petugas', 'ya']);
  data.columns.forEach((column) => (column.width = 24));
  const guide = wb.addWorksheet('Petunjuk');
  [
    'PETUNJUK IMPORT PENGGUNA', '',
    '1. Kolom bertanda * wajib diisi.',
    '2. Username 3-50 karakter: huruf, angka, titik, underscore, atau strip.',
    '3. Password minimal 6 karakter.',
    '4. Role hanya admin atau petugas.',
    '5. Aktif diisi ya/tidak.',
    '6. Hapus baris contoh sebelum upload.',
  ].forEach((line) => guide.addRow([line]));
  guide.getColumn(1).width = 90;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function validateUserImport(buffer: Buffer, userId: string) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('File harus berupa XLSX yang valid');
  }
  const sheet = wb.getWorksheet('Data') ?? wb.worksheets[0];
  if (!sheet) throw badRequest('Sheet Data tidak ditemukan');

  const rows: UserRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const nama = cellText(row.getCell(1).value).trim();
    const username = cellText(row.getCell(2).value).trim();
    const email = cellText(row.getCell(3).value).trim() || null;
    const password = cellText(row.getCell(4).value);
    const roleText = cellText(row.getCell(5).value).trim().toLowerCase();
    const aktifText = cellText(row.getCell(6).value).trim().toLowerCase();
    if (!nama && !username && !email && !password && !roleText && !aktifText) return;
    const errors: string[] = [];
    if (!nama || nama.length > 100) errors.push('Nama wajib diisi, maksimal 100 karakter');
    if (!/^[a-z0-9._-]{3,50}$/i.test(username)) errors.push('Username tidak valid');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email tidak valid');
    if (password.length < 6) errors.push('Password minimal 6 karakter');
    if (roleText !== 'admin' && roleText !== 'petugas') errors.push('Role harus admin atau petugas');
    if (!['ya', 'tidak'].includes(aktifText)) errors.push('Aktif harus ya atau tidak');
    rows.push({
      row: rowNumber, nama, username, email, password,
      role: roleText === 'admin' ? 'admin' : 'petugas', aktif: aktifText === 'ya', errors,
    });
  });
  if (rows.length === 0) throw badRequest('Tidak ada baris data di file');

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.username.toLowerCase(), (counts.get(row.username.toLowerCase()) ?? 0) + 1);
  const existing = new Set((await prisma.user.findMany({
    where: { username: { in: rows.map((row) => row.username) } }, select: { username: true },
  })).map((user) => user.username.toLowerCase()));
  for (const row of rows) {
    if ((counts.get(row.username.toLowerCase()) ?? 0) > 1) row.errors.push('Username duplikat dalam file');
    if (existing.has(row.username.toLowerCase())) row.errors.push('Username sudah dipakai');
  }

  const job = await prisma.importJob.create({
    data: { createdBy: userId, module: 'users', rows: JSON.parse(JSON.stringify(rows)) },
  });
  const invalid = rows.filter((row) => row.errors.length > 0);
  return {
    upload_id: job.id,
    valid_rows: rows.length - invalid.length,
    invalid_rows: invalid.map((row) => ({ row: row.row, errors: row.errors })),
    summary: { total: rows.length, valid: rows.length - invalid.length, invalid: invalid.length },
  };
}

export async function commitUserImport(uploadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw notFound('Upload pengguna tidak ditemukan');
  const job = await prisma.importJob.findUnique({ where: { id: uploadId } });
  if (!job || job.module !== 'users') throw notFound('Upload pengguna tidak ditemukan');
  if (job.status === 'committed' && job.result) return job.result as { saved: number; failed: number };
  const rows = (job.rows as unknown as UserRow[]).filter((row) => row.errors.length === 0);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`
      UPDATE import_jobs SET status = 'committing', updated_at = timezone('utc', now())
      WHERE id = ${uploadId} AND module = 'users' AND status = 'validated';
    `;
    if (claimed === 0) throw conflict('Import sedang diproses');
    for (const row of rows) {
      if (await tx.user.findFirst({ where: { username: row.username } })) {
        throw conflict(`Username ${row.username} sudah dipakai; tidak ada baris yang disimpan`);
      }
      await tx.user.create({ data: {
        name: row.nama, username: row.username, email: row.email,
        password: await bcrypt.hash(row.password, 10), role: row.role, isActive: row.aktif,
      } });
    }
    const result = { saved: rows.length, failed: (job.rows as unknown as UserRow[]).length - rows.length, failed_download_url: null };
    await tx.importJob.update({ where: { id: uploadId }, data: { status: 'committed', result } });
    return result;
  }, { timeout: 120_000 });
}
