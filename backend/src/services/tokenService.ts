import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/tokenGenerator';
import { badRequest, conflict, notFound } from '../middlewares/errorHandler';

export async function listTokens(filters: { activity_id?: string; is_active?: boolean }) {
  return prisma.activityToken.findMany({
    where: {
      ...(filters.activity_id ? { activityId: filters.activity_id } : {}),
      ...(filters.is_active !== undefined ? { isActive: filters.is_active } : {}),
    },
    include: { activity: { select: { id: true, name: true } }, _count: { select: { claims: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createToken(input: { activity_id: string; expires_at: Date; max_claims?: number | null }, createdBy: string) {
  const activity = await prisma.activity.findUnique({ where: { id: input.activity_id } });
  if (!activity) throw notFound('Kegiatan tidak ditemukan');
  if (input.expires_at.getTime() <= Date.now()) {
    throw badRequest('Tanggal kedaluwarsa harus di masa depan', { expires_at: ['Harus di masa depan'] });
  }

  // Token unik — coba ulang bila tabrakan (peluang sangat kecil, 31^7 kombinasi)
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken();
    const exists = await prisma.activityToken.findUnique({ where: { token } });
    if (!exists) {
      return prisma.activityToken.create({
        data: {
          activityId: input.activity_id,
          token,
          expiresAt: input.expires_at,
          maxClaims: input.max_claims ?? null,
          createdBy,
        },
        include: { activity: { select: { id: true, name: true } } },
      });
    }
  }
  throw new Error('Gagal membuat token unik');
}

export async function updateToken(id: string, input: { expires_at?: Date; is_active?: boolean; max_claims?: number | null }) {
  const token = await prisma.activityToken.findUnique({ where: { id } });
  if (!token) throw notFound('Token tidak ditemukan');
  if (input.expires_at && input.expires_at.getTime() <= Date.now()) throw badRequest('Tanggal kedaluwarsa harus di masa depan');
  if (input.max_claims !== undefined && input.max_claims !== null && input.max_claims < token.claimsCount) {
    throw badRequest(`Kuota tidak boleh lebih kecil dari ${token.claimsCount} klaim yang sudah digunakan`);
  }
  return prisma.activityToken.update({
    where: { id },
    data: {
      ...(input.expires_at !== undefined ? { expiresAt: input.expires_at } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
      ...(input.max_claims !== undefined ? { maxClaims: input.max_claims } : {}),
    },
  });
}

export async function deleteToken(id: string) {
  const token = await prisma.activityToken.findUnique({ where: { id } });
  if (!token) throw notFound('Token tidak ditemukan');
  await prisma.$transaction([
    prisma.activityClaim.deleteMany({ where: { activityTokenId: id } }),
    prisma.activityToken.delete({ where: { id } }),
  ]);
}

/**
 * Klaim token oleh petugas — semua pengecekan dalam satu transaction dengan
 * increment atomik claims_count (aturan domain #7, DATABASE aturan #6).
 */
export async function claimToken(code: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const token = await tx.activityToken.findUnique({
      where: { token: code },
      include: { activity: { select: { id: true, name: true } } },
    });
    if (!token) throw badRequest('Token tidak ditemukan. Periksa kembali kodenya.');
    if (!token.isActive) throw badRequest('Token sudah dinonaktifkan admin.');
    if (token.expiresAt.getTime() <= Date.now()) throw badRequest('Token sudah kedaluwarsa.');

    const already = await tx.activityClaim.findUnique({
      where: { userId_activityTokenId: { userId, activityTokenId: token.id } },
    });
    if (already) throw conflict('Anda sudah pernah mengklaim token ini.');

    // Increment atomik dengan guard kuota — hindari race saat klaim bersamaan
    const updated = await tx.$executeRaw`
      UPDATE activity_tokens
      SET claims_count = claims_count + 1, updated_at = timezone('utc', now())
      WHERE id = ${token.id}
        AND is_active = true
        AND expires_at > timezone('utc', now())
        AND (max_claims IS NULL OR claims_count < max_claims);
    `;
    if (updated === 0) {
      const current = await tx.activityToken.findUnique({ where: { id: token.id } });
      if (!current || !current.isActive) throw badRequest('Token sudah dinonaktifkan admin.');
      if (current.expiresAt.getTime() <= Date.now()) throw badRequest('Token sudah kedaluwarsa.');
      throw badRequest('Kuota pemakaian token sudah habis.');
    }

    await tx.activityClaim.create({
      data: { userId, activityTokenId: token.id, activityId: token.activityId },
    });
    return { activity: token.activity };
  });
}
