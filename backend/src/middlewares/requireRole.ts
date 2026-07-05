import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from './errorHandler';

export function requireRole(role: 'admin' | 'petugas') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (req.user.role !== role) {
      next(forbidden());
      return;
    }
    next();
  };
}
