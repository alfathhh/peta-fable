import type { NextFunction, Request, Response } from 'express';

// Semua respons data wilayah/layer wajib private & no-store (aturan privasi GeoJSON).
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
}
