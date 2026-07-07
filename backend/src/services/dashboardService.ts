import { prisma } from '../lib/prisma';

/** Ringkasan untuk dashboard admin: total, antrean ACC, sebaran per kategori & kecamatan. */
export async function getDashboard() {
  const [
    userCount,
    infraCount,
    pendingCount,
    outsideCount,
    projectActiveCount,
    activityCount,
    activeTokenCount,
    byCategory,
    byKec,
    latest,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    prisma.infrastructure.count({ where: { deletedAt: null } }),
    prisma.infrastructure.count({ where: { deletedAt: null, approvalStatus: 'pending' } }),
    prisma.infrastructure.count({ where: { deletedAt: null, isOutsideRegion: true } }),
    prisma.project.count({ where: { deletedAt: null, status: 'aktif' } }),
    prisma.activity.count(),
    prisma.activityToken.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
    prisma.infrastructure.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.infrastructure.groupBy({
      by: ['idkec'],
      where: { deletedAt: null, idkec: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.infrastructure.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        category: { select: { name: true, icon: true, color: true } },
        user: { select: { username: true } },
      },
    }),
  ]);

  const categories = byCategory.length
    ? await prisma.category.findMany({ where: { id: { in: byCategory.map((c) => c.categoryId) } } })
    : [];
  const catById = new Map(categories.map((c) => [c.id, c]));

  const kecIds = byKec.map((k) => k.idkec).filter((v): v is string => !!v);
  const kecRegions = kecIds.length
    ? await prisma.region.findMany({ where: { regionId: { in: kecIds } }, select: { regionId: true, name: true } })
    : [];
  const kecNameById = new Map(kecRegions.map((r) => [r.regionId, r.name]));

  return {
    totals: {
      users: userCount,
      infrastructures: infraCount,
      pending_approval: pendingCount,
      outside_region: outsideCount,
      active_projects: projectActiveCount,
      activities: activityCount,
      active_tokens: activeTokenCount,
    },
    by_category: byCategory
      .map((c) => {
        const cat = catById.get(c.categoryId);
        return cat
          ? { category_id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, count: c._count._all }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.count - a!.count),
    by_kecamatan: byKec.map((k) => ({
      region_id: k.idkec!,
      name: kecNameById.get(k.idkec!) ?? k.idkec!,
      count: k._count._all,
    })),
    latest: latest.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      username: i.user.username,
      approval_status: i.approvalStatus,
      created_at: i.createdAt,
    })),
  };
}
