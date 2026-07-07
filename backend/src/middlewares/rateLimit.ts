import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const keyByUser = (req: Request): string => req.user?.sub ?? req.ip ?? 'anon';

export const claimTokenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan klaim token. Coba lagi sebentar lagi.' },
});

// Endpoint publik satu-satunya — cegah brute-force password.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

export const regionsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan data wilayah. Coba lagi sebentar lagi.' },
});
