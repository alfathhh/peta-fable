import { prisma } from '../lib/prisma';
import { conflict, notFound } from '../middlewares/errorHandler';

export async function listActivities() {
  return prisma.activity.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tokens: true, projects: true } } },
  });
}

export async function createActivity(input: { name: string; description?: string | null }, createdBy: string) {
  return prisma.activity.create({
    data: { name: input.name, description: input.description ?? null, createdBy },
  });
}

export async function updateActivity(id: string, input: { name?: string; description?: string | null }) {
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) throw notFound('Kegiatan tidak ditemukan');
  return prisma.activity.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

export async function deleteActivity(id: string) {
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) throw notFound('Kegiatan tidak ditemukan');
  const projects = await prisma.project.count({ where: { activityId: id, deletedAt: null } });
  if (projects > 0) throw conflict('Kegiatan sudah dipakai proyek, tidak bisa dihapus');
  await prisma.$transaction([
    prisma.activityClaim.deleteMany({ where: { activityId: id } }),
    prisma.activityToken.deleteMany({ where: { activityId: id } }),
    prisma.activity.delete({ where: { id } }),
  ]);
}

/** Kegiatan hasil klaim petugas (untuk dropdown proyek). */
export async function myActivities(userId: string) {
  const claims = await prisma.activityClaim.findMany({
    where: { userId },
    include: { activity: true, token: { select: { expiresAt: true, isActive: true } } },
    orderBy: { claimedAt: 'desc' },
  });
  return claims.map((c) => ({
    activity_id: c.activityId,
    name: c.activity.name,
    description: c.activity.description,
    claimed_at: c.claimedAt,
    token_expires_at: c.token.expiresAt,
    token_is_active: c.token.isActive,
  }));
}
