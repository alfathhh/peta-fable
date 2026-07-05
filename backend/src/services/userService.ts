import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { conflict, notFound } from '../middlewares/errorHandler';

const select = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function listUsers() {
  return prisma.user.findMany({ where: { deletedAt: null }, select, orderBy: { createdAt: 'asc' } });
}

export async function createUser(input: {
  name: string;
  username: string;
  email?: string | null;
  password: string;
  role: 'admin' | 'petugas';
}) {
  const exists = await prisma.user.findFirst({ where: { username: input.username } });
  if (exists) throw conflict('Username sudah dipakai');
  return prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email ?? null,
      password: await bcrypt.hash(input.password, 10),
      role: input.role,
    },
    select,
  });
}

export async function updateUser(
  id: string,
  input: { name?: string; email?: string | null; password?: string; role?: 'admin' | 'petugas'; is_active?: boolean },
) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw notFound();
  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
      ...(input.password ? { password: await bcrypt.hash(input.password, 10) } : {}),
    },
    select,
  });
}

export async function deleteUser(id: string, requesterId: string) {
  if (id === requesterId) throw conflict('Tidak bisa menghapus akun sendiri');
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw notFound();
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}
