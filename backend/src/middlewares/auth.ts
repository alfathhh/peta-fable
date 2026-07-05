import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errorHandler';

export interface AuthUser {
  sub: string;
  role: 'admin' | 'petugas';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || (payload.role !== 'admin' && payload.role !== 'petugas')) {
      next(unauthorized());
      return;
    }
    req.user = { sub: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized());
  }
}
