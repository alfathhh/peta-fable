import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { badRequest, unauthorized } from '../middlewares/errorHandler';

const publicUser = (u: { id: string; name: string; username: string; email: string | null; role: string }) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
});

export async function login(username: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { username, deletedAt: null },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized('Username atau password salah');
  }
  if (!user.isActive) throw unauthorized('Akun Anda dinonaktifkan. Hubungi admin.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '24h' });
  return { token, user: publicUser(user) };
}

export async function me(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true } });
  if (!user) throw unauthorized();
  return publicUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw badRequest('Password saat ini salah', { current_password: ['Password saat ini salah'] });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });
}
