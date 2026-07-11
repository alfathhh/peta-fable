import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../middlewares/errorHandler';

const ALLOWED_LEVELS = ['kec', 'desa', 'sls', 'subsls'];

const includeBasic = {
  activity: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, username: true } },
} as const;

async function regionInfo(regionId: string) {
  return prisma.region.findUnique({
    where: { regionId },
    select: { regionId: true, level: true, name: true, bbox: true },
  });
}

export async function listMyProjects(userId: string) {
  const projects = await prisma.project.findMany({
    where: { userId, deletedAt: null },
    include: { ...includeBasic, _count: { select: { infrastructures: { where: { deletedAt: null } }, layers: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const regionIds = [...new Set(projects.map((p) => p.regionId))];
  const regions = await prisma.region.findMany({
    where: { regionId: { in: regionIds } },
    select: { regionId: true, name: true },
  });
  const nameById = new Map(regions.map((r) => [r.regionId, r.name]));
  return projects.map((p) => ({ ...p, region_name: nameById.get(p.regionId) ?? p.regionId }));
}

export async function createProject(userId: string, input: { name: string; activity_id: string; region_id: string }) {
  // Kegiatan harus hasil klaim user
  const claim = await prisma.activityClaim.findFirst({
    where: {
      userId,
      activityId: input.activity_id,
      token: { isActive: true, expiresAt: { gt: new Date() } },
    },
    include: { token: true },
  });
  if (!claim) {
    throw badRequest('Kegiatan belum diklaim dengan token yang masih aktif', {
      activity_id: ['Klaim token kegiatan aktif terlebih dahulu'],
    });
  }

  // Satu master wilayah proyek; kabupaten terlalu luas untuk dipilih.
  const region = await regionInfo(input.region_id);
  if (!region) throw badRequest('Wilayah tidak ditemukan', { region_id: ['Wilayah tidak ditemukan'] });
  if (!ALLOWED_LEVELS.includes(region.level)) {
    throw badRequest('Wilayah proyek tidak boleh level kabupaten', {
      region_id: ['Pilih wilayah level kecamatan, desa, SLS, atau sub-SLS'],
    });
  }

  return prisma.project.create({
    data: {
      userId,
      activityId: input.activity_id,
      name: input.name,
      regionId: region.regionId,
      regionLevel: region.level,
    },
    include: includeBasic,
  });
}

/** Ambil proyek dengan cek kepemilikan; admin bebas. 404 bila milik orang lain (jangan bocorkan). */
export async function getOwnedProject(id: string, user: { sub: string; role: string }) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project || (user.role !== 'admin' && project.userId !== user.sub)) throw notFound('Proyek tidak ditemukan');
  return project;
}

export async function isProjectExpired(project: { userId: string; activityId: string }): Promise<boolean> {
  const activeClaim = await prisma.activityClaim.findFirst({
    where: {
      userId: project.userId,
      activityId: project.activityId,
      token: { isActive: true, expiresAt: { gt: new Date() } },
    },
    select: { id: true },
  });
  return !activeClaim;
}

/** Admin tetap dapat melakukan koreksi; proyek expired read-only bagi petugas. */
export async function assertProjectWritable(project: { userId: string; activityId: string }, user: { role: string }): Promise<void> {
  if (user.role !== 'admin' && await isProjectExpired(project)) {
    throw conflict('Proyek sudah kedaluwarsa dan hanya dapat dilihat');
  }
}

export async function getProjectDetail(id: string, user: { sub: string; role: string }) {
  const project = await getOwnedProject(id, user);
  const [region, layers, full, isExpired] = await Promise.all([
    regionInfo(project.regionId),
    prisma.projectLayer.findMany({ where: { projectId: id }, orderBy: { sortOrder: 'asc' } }),
    prisma.project.findUnique({ where: { id }, include: includeBasic }),
    isProjectExpired(project),
  ]);
  return { ...full!, region, layers, is_expired: isExpired };
}

export async function updateProject(id: string, user: { sub: string; role: string }, input: { name?: string; status?: string }) {
  const project = await getOwnedProject(id, user);
  await assertProjectWritable(project, user);
  return prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: includeBasic,
  });
}

export async function deleteProject(id: string, user: { sub: string; role: string }) {
  const project = await getOwnedProject(id, user);
  await assertProjectWritable(project, user);
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function adminListProjects(filters: { user_id?: string; activity_id?: string; region_id?: string }) {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(filters.user_id ? { userId: filters.user_id } : {}),
      ...(filters.activity_id ? { activityId: filters.activity_id } : {}),
      ...(filters.region_id ? { regionId: { startsWith: filters.region_id } } : {}),
    },
    include: { ...includeBasic, _count: { select: { infrastructures: { where: { deletedAt: null } }, layers: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const regionIds = [...new Set(projects.map((p) => p.regionId))];
  const regions = await prisma.region.findMany({
    where: { regionId: { in: regionIds } },
    select: { regionId: true, name: true },
  });
  const nameById = new Map(regions.map((r) => [r.regionId, r.name]));
  return projects.map((p) => ({ ...p, region_name: nameById.get(p.regionId) ?? p.regionId }));
}
