import { prisma } from '../lib/prisma';
import { conflict, notFound } from '../middlewares/errorHandler';

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(input: { name: string; icon: string; color: string; is_active?: boolean }) {
  const exists = await prisma.category.findUnique({ where: { name: input.name } });
  if (exists) throw conflict('Nama kategori sudah dipakai');
  return prisma.category.create({
    data: { name: input.name, icon: input.icon, color: input.color, isActive: input.is_active ?? true },
  });
}

export async function updateCategory(id: string, input: { name?: string; icon?: string; color?: string; is_active?: boolean }) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw notFound('Kategori tidak ditemukan');
  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    },
  });
}

export async function deleteCategory(id: string) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw notFound('Kategori tidak ditemukan');
  // Soft-deleted infrastructure tetap menyimpan foreign key kategori.
  const used = await prisma.infrastructure.count({ where: { categoryId: id } });
  if (used > 0) throw conflict(`Kategori masih dipakai ${used} infrastruktur`);
  await prisma.category.delete({ where: { id } });
}
