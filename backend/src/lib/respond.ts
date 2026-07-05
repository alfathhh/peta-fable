import type { Response } from 'express';

export function ok(res: Response, data: unknown, meta?: unknown): void {
  res.json(meta === undefined ? { data } : { data, meta });
}

export function created(res: Response, data: unknown, meta?: unknown): void {
  res.status(201).json(meta === undefined ? { data } : { data, meta });
}
