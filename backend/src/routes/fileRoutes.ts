import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { noStore } from '../middlewares/noStore';
import { notFound } from '../middlewares/errorHandler';
import { STORAGE_ROOT } from '../services/layerService';

// Storage TIDAK di-mount express.static — file disajikan lewat route ber-auth
// dengan validasi path traversal (ARCHITECTURE §5).
export const fileRoutes = Router();

fileRoutes.get('/files/*', auth, noStore, (req, res, next) => {
  try {
    const rel = decodeURIComponent(req.path.replace(/^\/files\//, ''));
    const abs = path.resolve(STORAGE_ROOT, rel);
    if (!abs.startsWith(STORAGE_ROOT)) throw notFound();
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw notFound();
    res.sendFile(abs);
  } catch (err) {
    next(err);
  }
});
