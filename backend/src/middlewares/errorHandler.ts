import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (msg: string, errors?: Record<string, string[]>) => new AppError(422, msg, errors);
export const unauthorized = (msg = 'Belum login atau sesi kedaluwarsa') => new AppError(401, msg);
export const forbidden = (msg = 'Tidak berhak mengakses resource ini') => new AppError(403, msg);
export const notFound = (msg = 'Data tidak ditemukan') => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.') || '_';
      (errors[field] ??= []).push(issue.message);
    }
    res.status(422).json({ message: 'Validasi gagal', errors });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, ...(err.errors ? { errors: err.errors } : {}) });
    return;
  }
  // multer file too large
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(422).json({ message: 'Ukuran file melebihi batas' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
}
