import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../lib/prisma';
import { badRequest } from '../middlewares/errorHandler';

export type ExportModule = 'users' | 'infrastructures' | 'projects' | 'tokens' | 'activities';

interface Sheet {
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

async function buildSheet(module: ExportModule, filters: Record<string, string | undefined>): Promise<Sheet> {
  switch (module) {
    case 'users': {
      const rows = await prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
      return {
        headers: ['id', 'nama', 'username', 'email', 'role', 'aktif', 'login_terakhir', 'dibuat'],
        rows: rows.map((u) => [
          u.id, u.name, u.username, u.email, u.role, u.isActive,
          u.lastLoginAt?.toISOString() ?? null, u.createdAt.toISOString(),
        ]),
      };
    }
    case 'infrastructures': {
      const rows = await prisma.infrastructure.findMany({
        where: {
          deletedAt: null,
          ...(filters.user_id ? { userId: filters.user_id } : {}), // dipakai export "data saya" petugas
          ...(filters.category_id ? { categoryId: filters.category_id } : {}),
          ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
          ...(filters.is_outside_region !== undefined && filters.is_outside_region !== ''
            ? { isOutsideRegion: filters.is_outside_region === 'true' }
            : {}),
        },
        include: {
          category: true,
          user: { select: { username: true } },
          project: { select: { name: true } },
          activity: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id', 'nama', 'kategori', 'deskripsi', 'lat', 'lng', 'akurasi_gps_m',
          'idkab', 'idkec', 'iddesa', 'idsls', 'idsubsls', 'di_luar_wilayah',
          'petugas', 'proyek', 'kegiatan', 'sumber', 'dibuat',
        ],
        rows: rows.map((r) => [
          r.id, r.name, r.category.name, r.description, r.lat, r.lng, r.gpsAccuracyM,
          r.idkab, r.idkec, r.iddesa, r.idsls, r.idsubsls, r.isOutsideRegion,
          r.user.username, r.project?.name ?? null, r.activity?.name ?? null, r.source, r.createdAt.toISOString(),
        ]),
      };
    }
    case 'projects': {
      const rows = await prisma.project.findMany({
        where: { deletedAt: null },
        include: { user: { select: { username: true } }, activity: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: ['id', 'nama', 'petugas', 'kegiatan', 'id_wilayah', 'level_wilayah', 'status', 'dibuat'],
        rows: rows.map((p) => [
          p.id, p.name, p.user.username, p.activity.name, p.regionId, p.regionLevel, p.status, p.createdAt.toISOString(),
        ]),
      };
    }
    case 'tokens': {
      const rows = await prisma.activityToken.findMany({
        include: { activity: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: ['id', 'token', 'kegiatan', 'kedaluwarsa', 'batas_klaim', 'jumlah_klaim', 'aktif', 'dibuat'],
        rows: rows.map((t) => [
          t.id, t.token, t.activity.name, t.expiresAt.toISOString(), t.maxClaims, t.claimsCount, t.isActive,
          t.createdAt.toISOString(),
        ]),
      };
    }
    case 'activities': {
      const rows = await prisma.activity.findMany({
        include: { _count: { select: { tokens: true, projects: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: ['id', 'nama', 'deskripsi', 'jumlah_token', 'jumlah_proyek', 'dibuat'],
        rows: rows.map((a) => [a.id, a.name, a.description, a._count.tokens, a._count.projects, a.createdAt.toISOString()]),
      };
    }
  }
}

export async function exportModule(
  module: string,
  format: string,
  filters: Record<string, string | undefined>,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const modules: ExportModule[] = ['users', 'infrastructures', 'projects', 'tokens', 'activities'];
  if (!modules.includes(module as ExportModule)) throw badRequest('Modul export tidak dikenal');
  if (format !== 'csv' && format !== 'xlsx') throw badRequest('Format harus csv atau xlsx');

  const sheet = await buildSheet(module as ExportModule, filters);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csv = stringify([sheet.headers, ...sheet.rows.map((r) => r.map((v) => (v === null ? '' : String(v))))]);
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv; charset=utf-8', filename: `${module}-${stamp}.csv` };
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(module);
  ws.addRow(sheet.headers).font = { bold: true };
  for (const row of sheet.rows) ws.addRow(row.map((v) => (v === null ? '' : v)));
  ws.columns.forEach((col) => {
    col.width = Math.max(12, ...(col.values ?? []).map((v) => String(v ?? '').length + 2));
  });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${module}-${stamp}.xlsx`,
  };
}
