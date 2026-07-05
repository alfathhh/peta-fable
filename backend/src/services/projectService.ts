import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../middlewares/errorHandler';

const ALLOWED_LEVELS = ['desa', 'sls', 'subsls'];

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
    where: { userId, activityId: input.activity_id },
    include: { token: true },
  });
  if (!claim) throw badRequest('Kegiatan bukan hasil klaim Anda', { activity_id: ['Klaim token kegiatan ini dulu'] });

  // Wilayah proyek minimal level desa (keputusan PO #1)
  const region = await regionInfo(input.region_id);
  if (!region) throw badRequest('Wilayah tidak ditemukan', { region_id: ['Wilayah tidak ditemukan'] });
  if (!ALLOWED_LEVELS.includes(region.level)) {
    throw badRequest('Wilayah proyek minimal level desa/nagari', {
      region_id: ['Pilih wilayah level desa, SLS, atau sub-SLS'],
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

export async function getProjectDetail(id: string, user: { sub: string; role: string }) {
  const project = await getOwnedProject(id, user);
  const [region, layers, full] = await Promise.all([
    regionInfo(project.regionId),
    prisma.projectLayer.findMany({ where: { projectId: id }, orderBy: { sortOrder: 'asc' } }),
    prisma.project.findUnique({ where: { id }, include: includeBasic }),
  ]);
  return { ...full!, region, layers };
}

export async function updateProject(id: string, user: { sub: string; role: string }, input: { name?: string; status?: string }) {
  await getOwnedProject(id, user);
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
  await getOwnedProject(id, user);
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
