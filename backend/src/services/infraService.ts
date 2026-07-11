import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../middlewares/errorHandler';
import { levelOf } from '../lib/regionId';
import { isOutsideRegion, resolveRegionFromPoint } from './regionResolver';
import { assertProjectWritable, getOwnedProject } from './projectService';
import { STORAGE_ROOT } from './layerService';

const INFRA_DIR = path.join(STORAGE_ROOT, 'infra');

function isStoragePath(absolutePath: string): boolean {
  const relative = path.relative(STORAGE_ROOT, absolutePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

const categorySelect = { select: { id: true, name: true, icon: true, color: true } } as const;

const REGION_COLUMN: Record<string, 'idkab' | 'idkec' | 'iddesa' | 'idsls' | 'idsubsls'> = {
  kab: 'idkab',
  kec: 'idkec',
  desa: 'iddesa',
  sls: 'idsls',
  subsls: 'idsubsls',
};

function regionFilter(regionId: string | undefined): Record<string, string> {
  if (!regionId) return {};
  const level = levelOf(regionId);
  if (!level) throw badRequest('region_id tidak valid');
  return { [REGION_COLUMN[level]!]: regionId };
}

function photoUrl(photoPath: string | null): string | null {
  return photoPath ? `/api/infrastructures/${photoPath.split('/')[1]}/photo` : null;
}

function thumbPathOf(photoPath: string): string {
  return photoPath.replace(/\.jpg$/i, '_thumb.jpg');
}

/**
 * URL thumbnail (?size=thumb) bila filenya ada — foto lama dari sebelum fitur
 * thumbnail tidak punya, jatuh ke foto utama. Dipakai popup peta agar hemat kuota.
 */
function photoThumbUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  const hasThumb = fs.existsSync(path.resolve(STORAGE_ROOT, thumbPathOf(photoPath)));
  const base = photoUrl(photoPath);
  return hasThumb && base ? `${base}?size=thumb` : base;
}

/** category_id bisa berisi daftar dipisah koma (filter multi-kategori = satu request). */
function categoryFilter(categoryId: string | undefined) {
  if (!categoryId) return {};
  const ids = categoryId.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return {};
  return ids.length === 1 ? { categoryId: ids[0] } : { categoryId: { in: ids } };
}

/**
 * List untuk marker peta — WAJIB minimal salah satu filter category_id / q (aturan domain #3).
 */
export async function listInfrastructures(
  filters: {
    category_id?: string;
    q?: string;
    region_id?: string;
    activity_id?: string;
  },
) {
  const categoryIds = filters.category_id?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  const query = filters.q?.trim() ?? '';
  if (categoryIds.length === 0 && !query) {
    throw badRequest('Wajib memilih filter kategori atau kata kunci pencarian', {
      category_id: ['Isi category_id atau q'],
    });
  }

  const rows = await prisma.infrastructure.findMany({
    where: {
      deletedAt: null,
      approvalStatus: 'approved',
      ...categoryFilter(categoryIds.join(',')),
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      ...(filters.activity_id ? { activityId: filters.activity_id } : {}),
      ...regionFilter(filters.region_id),
    },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      isOutsideRegion: true,
      approvalStatus: true,
      approvalNote: true,
      category: categorySelect,
    },
    take: 2000,
    orderBy: { name: 'asc' },
  });
  return rows;
}

/** Daftar infrastruktur proyek selalu melalui cek ownership, bukan bypass list marker umum. */
export async function listProjectInfrastructures(projectId: string, user: { sub: string; role: string }) {
  await getOwnedProject(projectId, user);
  return prisma.infrastructure.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      isOutsideRegion: true,
      approvalStatus: true,
      approvalNote: true,
      category: categorySelect,
    },
    orderBy: { name: 'asc' },
  });
}

export async function getInfrastructure(id: string, user: { sub: string; role: string }) {
  const infra = await prisma.infrastructure.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: categorySelect,
      user: { select: { id: true, name: true, username: true } },
      project: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true } },
    },
  });
  if (!infra) throw notFound('Infrastruktur tidak ditemukan');
  // Belum/tidak di-acc admin → hanya pembuatnya & admin yang boleh melihat detail
  if (infra.approvalStatus !== 'approved' && user.role !== 'admin' && infra.userId !== user.sub) {
    throw notFound('Infrastruktur tidak ditemukan');
  }

  const regionIds = [infra.idsubsls, infra.idsls, infra.iddesa, infra.idkec, infra.idkab].filter(
    (v): v is string => !!v,
  );
  const regions = regionIds.length
    ? await prisma.region.findMany({ where: { regionId: { in: regionIds } }, select: { regionId: true, name: true, level: true } })
    : [];
  const regionNames = Object.fromEntries(regions.map((r) => [r.level, r.name]));

  return {
    ...infra,
    photo_url: photoUrl(infra.photoPath),
    photo_thumb_url: photoThumbUrl(infra.photoPath),
    region_names: regionNames,
    gmaps_url: `https://www.google.com/maps?q=${infra.lat},${infra.lng}`,
  };
}

/** Foto selalu dipetakan dari record infrastruktur, bukan dari path yang dikirim klien. */
export async function getInfrastructurePhotoPath(
  id: string,
  user: { sub: string; role: string },
  size: 'full' | 'thumb' = 'full',
): Promise<string> {
  const infra = await prisma.infrastructure.findFirst({
    where: { id, deletedAt: null },
    select: { photoPath: true, approvalStatus: true, userId: true },
  });
  if (!infra || !infra.photoPath) throw notFound('Foto tidak ditemukan');
  if (infra.approvalStatus !== 'approved' && user.role !== 'admin' && infra.userId !== user.sub) {
    throw notFound('Foto tidak ditemukan');
  }
  if (size === 'thumb') {
    const thumb = thumbPathOf(infra.photoPath);
    // foto lama dari sebelum fitur thumbnail tidak punya file thumb → foto utama
    if (fs.existsSync(path.resolve(STORAGE_ROOT, thumb))) return thumb;
  }
  return infra.photoPath;
}

async function savePhoto(id: string, buffer: Buffer): Promise<string> {
  const dir = path.join(INFRA_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const relPath = path.join('infra', id, `${Date.now()}-${crypto.randomUUID()}.jpg`);
  // Semua format yang diterima dinormalisasi agar ekstensi, MIME, dan isi file konsisten.
  const image = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
  fs.writeFileSync(path.join(STORAGE_ROOT, relPath), image);
  // thumbnail kecil untuk popup peta — hemat kuota petugas di lapangan
  try {
    const thumb = await sharp(image).resize({ width: 320, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    fs.writeFileSync(path.resolve(STORAGE_ROOT, thumbPathOf(relPath)), thumb);
  } catch (err) {
    console.error('Gagal membuat thumbnail (foto utama tetap tersimpan):', err);
  }
  return relPath.replace(/\\/g, '/');
}

function removePhoto(photoPath: string | null): void {
  if (!photoPath) return;
  for (const rel of [photoPath, thumbPathOf(photoPath)]) {
    const abs = path.resolve(STORAGE_ROOT, rel);
    if (isStoragePath(abs) && fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}

/**
 * Wilayah manual: petugas memilih SLS (wajib — kec & desa turunan prefix idsls)
 * dan sub-SLS opsional. Validasi terhadap master regions.
 */
async function resolveManualRegion(idsls: string, idsubsls?: string | null): Promise<ResolvedFields> {
  const sls = await prisma.region.findFirst({ where: { regionId: idsls, level: 'sls' } });
  if (!sls) throw badRequest('SLS tidak dikenal', { idsls: [`idsls ${idsls} tidak ada di master wilayah`] });
  if (idsubsls) {
    if (!idsubsls.startsWith(idsls)) {
      throw badRequest('Sub-SLS tidak berada di dalam SLS terpilih', { idsubsls: ['Harus diawali idsls'] });
    }
    const sub = await prisma.region.findFirst({ where: { regionId: idsubsls, level: 'subsls' } });
    if (!sub) throw badRequest('Sub-SLS tidak dikenal', { idsubsls: [`idsubsls ${idsubsls} tidak ada di master wilayah`] });
  }
  // urut dari idsls: semua id level di atasnya = prefix
  return {
    idkab: idsls.slice(0, 4),
    idkec: idsls.slice(0, 7),
    iddesa: idsls.slice(0, 10),
    idsls,
    idsubsls: idsubsls ?? null,
    deepestId: idsubsls ?? idsls,
  };
}

interface ResolvedFields {
  idkab: string | null;
  idkec: string | null;
  iddesa: string | null;
  idsls: string | null;
  idsubsls: string | null;
  deepestId: string | null;
}

export async function createInfrastructure(
  user: { sub: string; role: string },
  input: {
    name: string;
    category_id: string;
    description?: string | null;
    lat: number;
    lng: number;
    gps_accuracy_m?: number | null;
    project_id: string;
    idsls?: string | null;
    idsubsls?: string | null;
  },
  photo?: Buffer,
) {
  const project = await getOwnedProject(input.project_id, user); // 404 bila bukan miliknya
  await assertProjectWritable(project, user);
  if (user.role !== 'admin' && (input.idsls || input.idsubsls)) {
    throw badRequest('Wilayah petugas ditentukan otomatis dari koordinat GPS');
  }
  const category = await prisma.category.findUnique({ where: { id: input.category_id } });
  if (!category || !category.isActive) {
    throw badRequest('Kategori tidak tersedia', { category_id: ['Pilih kategori yang masih aktif'] });
  }

  // Wilayah: manual (idsls wajib, idsubsls opsional) atau auto-detect dari titik
  const resolved: ResolvedFields = input.idsls
    ? await resolveManualRegion(input.idsls, input.idsubsls)
    : await resolveRegionFromPoint(input.lat, input.lng);
  const outside = isOutsideRegion(resolved, project.regionId);

  const infraId = crypto.randomUUID();
  let photoPath: string | null = null;
  try {
    if (photo) photoPath = await savePhoto(infraId, photo);
    const infra = await prisma.$transaction(async (tx) => {
      const created = await tx.infrastructure.create({
        data: {
          id: infraId,
      name: input.name,
      categoryId: input.category_id,
      description: input.description ?? null,
      lat: input.lat,
      lng: input.lng,
      gpsAccuracyM: input.gps_accuracy_m ?? null,
      idkab: resolved.idkab,
      idkec: resolved.idkec,
      iddesa: resolved.iddesa,
      idsls: resolved.idsls,
      idsubsls: resolved.idsubsls,
      isOutsideRegion: outside,
      userId: user.sub,
      projectId: project.id,
      activityId: project.activityId,
          source: 'manual',
          photoPath,
        },
      });
      await tx.$executeRaw`
        UPDATE infrastructures SET geom = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326) WHERE id = ${created.id};
      `;
      return created;
    });

    return {
      infra: { ...infra, photoPath, photo_url: photoUrl(photoPath), photo_thumb_url: photoThumbUrl(photoPath) },
      warning: outside ? 'Titik berada di luar wilayah proyek. Data tetap disimpan dengan penanda.' : undefined,
    };
  } catch (err) {
    removePhoto(photoPath);
    throw err;
  }
}

export async function adminCreateInfrastructure(
  userId: string,
  input: { name: string; category_id: string; description?: string | null; lat: number; lng: number },
  photo?: Buffer,
) {
  const category = await prisma.category.findFirst({ where: { id: input.category_id, isActive: true } });
  if (!category) throw badRequest('Kategori tidak tersedia');
  const resolved = await resolveRegionFromPoint(input.lat, input.lng);
  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  try {
    if (photo) photoPath = await savePhoto(id, photo);
    const infra = await prisma.infrastructure.create({
      data: {
        id, name: input.name, categoryId: input.category_id, description: input.description ?? null,
        lat: input.lat, lng: input.lng, photoPath,
        idkab: resolved.idkab, idkec: resolved.idkec, iddesa: resolved.iddesa,
        idsls: resolved.idsls, idsubsls: resolved.idsubsls,
        isOutsideRegion: resolved.idkab !== '1306', userId, source: 'manual', approvalStatus: 'approved',
      },
      include: { category: categorySelect },
    });
    await prisma.$executeRaw`
      UPDATE infrastructures SET geom = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326) WHERE id = ${id};
    `;
    return { ...infra, photo_url: photoUrl(photoPath), photo_thumb_url: photoThumbUrl(photoPath) };
  } catch (err) {
    removePhoto(photoPath);
    throw err;
  }
}

async function getEditable(id: string, user: { sub: string; role: string }) {
  const infra = await prisma.infrastructure.findFirst({ where: { id, deletedAt: null }, include: { project: true } });
  if (!infra || (user.role !== 'admin' && infra.userId !== user.sub)) throw notFound('Infrastruktur tidak ditemukan');
  if (infra.project) await assertProjectWritable(infra.project, user);
  return infra;
}

export async function updateInfrastructure(
  id: string,
  user: { sub: string; role: string },
  input: {
    name?: string;
    category_id?: string;
    description?: string | null;
    lat?: number;
    lng?: number;
    idsls?: string | null;
    idsubsls?: string | null;
  },
  photo?: Buffer,
) {
  const infra = await getEditable(id, user);

  if (input.category_id !== undefined && input.category_id !== infra.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.category_id } });
    if (!category || !category.isActive) {
      throw badRequest('Kategori tidak tersedia', { category_id: ['Pilih kategori yang masih aktif'] });
    }
  }

  // Edit koordinat HANYA admin (aturan domain #4); petugas: koordinat terkunci setelah dibuat
  if (user.role !== 'admin' && (input.lat !== undefined || input.lng !== undefined)) {
    throw badRequest('Koordinat hanya bisa diubah oleh admin.', {
      lat: ['Koordinat hanya bisa diubah oleh admin'],
    });
  }

  if (user.role !== 'admin' && (input.idsls !== undefined || input.idsubsls !== undefined)) {
    throw badRequest('Wilayah manual hanya dapat dipilih saat membuat infrastruktur.', {
      idsls: ['Wilayah tidak dapat diubah oleh petugas'],
    });
  }

  let coordUpdate: { lat: number; lng: number } | null = null;
  let regionUpdate: Record<string, string | null | boolean> = {};

  // Koreksi wilayah manual (pemilik/admin): idsls wajib bila diisi, idsubsls opsional
  if (input.idsls) {
    const manual = await resolveManualRegion(input.idsls, input.idsubsls);
    regionUpdate = {
      idkab: manual.idkab,
      idkec: manual.idkec,
      iddesa: manual.iddesa,
      idsls: manual.idsls,
      idsubsls: manual.idsubsls,
    };
    if (infra.projectId) {
      const project = await prisma.project.findUnique({ where: { id: infra.projectId } });
      if (project) regionUpdate.isOutsideRegion = isOutsideRegion(manual, project.regionId);
    } else regionUpdate.isOutsideRegion = manual.idkab !== '1306';
  }

  // Geser koordinat via minimap (admin): wilayah di-resolve ulang dari titik baru
  if (input.lat !== undefined && input.lng !== undefined) {
    coordUpdate = { lat: input.lat, lng: input.lng };
    if (!input.idsls) {
      // tanpa pilihan manual → auto-detect ulang dari koordinat baru
      const resolved = await resolveRegionFromPoint(input.lat, input.lng);
      regionUpdate = {
        idkab: resolved.idkab,
        idkec: resolved.idkec,
        iddesa: resolved.iddesa,
        idsls: resolved.idsls,
        idsubsls: resolved.idsubsls,
      };
      if (infra.projectId) {
        const project = await prisma.project.findUnique({ where: { id: infra.projectId } });
        if (project) regionUpdate.isOutsideRegion = isOutsideRegion(resolved, project.regionId);
      } else regionUpdate.isOutsideRegion = resolved.idkab !== '1306';
    }
  }

  let photoPath: string | undefined;
  try {
    if (photo) photoPath = await savePhoto(id, photo);
    const publicContentChanged =
      input.name !== undefined || input.category_id !== undefined || input.description !== undefined || photo !== undefined;
    const requiresReapproval =
      user.role === 'petugas' && publicContentChanged && infra.approvalStatus !== 'pending';
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.infrastructure.update({
        where: { id },
        data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category_id !== undefined ? { categoryId: input.category_id } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(coordUpdate ?? {}),
      ...regionUpdate,
      ...(photoPath !== undefined ? { photoPath } : {}),
      ...(requiresReapproval ? { approvalStatus: 'pending', approvalNote: null } : {}),
        },
        include: { category: categorySelect },
      });
      if (coordUpdate) {
        await tx.$executeRaw`
          UPDATE infrastructures SET geom = ST_SetSRID(ST_MakePoint(${coordUpdate.lng}, ${coordUpdate.lat}), 4326) WHERE id = ${id};
        `;
      }
      return result;
    });
    if (photoPath !== undefined) removePhoto(infra.photoPath);
    return { ...updated, photo_url: photoUrl(updated.photoPath), photo_thumb_url: photoThumbUrl(updated.photoPath) };
  } catch (err) {
    removePhoto(photoPath ?? null);
    throw err;
  }
}

export async function deleteInfrastructure(id: string, user: { sub: string; role: string }) {
  await getEditable(id, user);
  await prisma.infrastructure.update({ where: { id }, data: { deletedAt: new Date() } }); // soft delete
}

/** ACC/tolak infrastruktur — hanya admin (dipaksa di route). Note = alasan (terlihat pembuat). */
export async function setApprovalStatus(id: string, status: 'pending' | 'approved' | 'rejected', note?: string | null) {
  const infra = await prisma.infrastructure.findFirst({ where: { id, deletedAt: null } });
  if (!infra) throw notFound('Infrastruktur tidak ditemukan');
  return prisma.infrastructure.update({
    where: { id },
    data: { approvalStatus: status, approvalNote: status === 'approved' ? null : (note ?? null) },
    include: { category: categorySelect },
  });
}

/** Tabel admin: pagination + semua filter, tanpa kewajiban filter. */
export async function adminListInfrastructures(filters: {
  page?: number;
  per_page?: number;
  category_id?: string;
  q?: string;
  region_id?: string;
  project_id?: string;
  activity_id?: string;
  user_id?: string;
  is_outside_region?: boolean;
  approval_status?: string;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.per_page ?? 20));
  const where = {
    deletedAt: null,
    ...categoryFilter(filters.category_id),
    ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' as const } } : {}),
    ...(filters.project_id ? { projectId: filters.project_id } : {}),
    ...(filters.activity_id ? { activityId: filters.activity_id } : {}),
    ...(filters.user_id ? { userId: filters.user_id } : {}),
    ...(filters.is_outside_region !== undefined ? { isOutsideRegion: filters.is_outside_region } : {}),
    ...(filters.approval_status ? { approvalStatus: filters.approval_status } : {}),
    ...regionFilter(filters.region_id),
  };
  const [total, rows] = await Promise.all([
    prisma.infrastructure.count({ where }),
    prisma.infrastructure.findMany({
      where,
      include: {
        category: categorySelect,
        user: { select: { id: true, name: true, username: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, photo_url: photoUrl(r.photoPath), photo_thumb_url: photoThumbUrl(r.photoPath) })),
    meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  };
}
