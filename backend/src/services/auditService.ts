import { prisma } from '../lib/prisma';
import type { AuthUser } from '../middlewares/auth';

/**
 * Catat aksi penting (siapa, apa, terhadap entitas mana). Fire-and-forget —
 * kegagalan menulis log tidak boleh menggagalkan request utamanya.
 */
export function record(
  user: AuthUser | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      let username: string | null = null;
      if (user) {
        const u = await prisma.user.findUnique({ where: { id: user.sub }, select: { username: true } });
        username = u?.username ?? null;
      }
      await prisma.auditLog.create({
        data: {
          userId: user?.sub ?? null,
          username,
          role: user?.role ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          detail: detail ? JSON.parse(JSON.stringify(detail)) : undefined,
        },
      });
    } catch (err) {
      console.error('Gagal menulis audit log:', err);
    }
  })();
}

export async function listAuditLogs(filters: { page?: number; per_page?: number; entity?: string; user_id?: string }) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.per_page ?? 30));
  const where = {
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.user_id ? { userId: filters.user_id } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return { rows, meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) } };
}
