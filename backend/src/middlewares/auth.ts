import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errorHandler';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  sub: string;
  role: 'admin' | 'petugas';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export async function auth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    next(unauthorized());
    return;
  }
  if (typeof payload.sub !== 'string' || (payload.role !== 'admin' && payload.role !== 'petugas')) {
    next(unauthorized());
    return;
  }
  try {
    // Token hanya membuktikan identitas saat login. Status dan role harus selalu
    // berasal dari DB supaya akun nonaktif atau role yang berubah langsung berlaku.
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user || (user.role !== 'admin' && user.role !== 'petugas')) {
      next(unauthorized());
      return;
    }
    req.user = { sub: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}
