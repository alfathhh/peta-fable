import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { noStore } from '../middlewares/noStore';
import { regionsLimiter } from '../middlewares/rateLimit';
import { fileUpload } from '../middlewares/upload';
import { badRequest } from '../middlewares/errorHandler';
import { ok } from '../lib/respond';
import { LEVELS, type RegionLevel } from '../lib/regionId';
import * as regionService from '../services/regionService';
import * as regionImport from '../services/regionImportService';

export const regionRoutes = Router();

// SEMUA respons wilayah: ber-auth + private, no-store (aturan privasi GeoJSON)
regionRoutes.use(auth, noStore, regionsLimiter);

regionRoutes.get('/regions', async (req, res, next) => {
  try {
    const level = String(req.query.level ?? '');
    if (!level) throw badRequest('Parameter level wajib diisi', { level: ['Wajib diisi'] });
    const parent = req.query.parent ? String(req.query.parent) : undefined;
    const detail = req.query.detail === 'high' ? 'high' : 'low';
    const fc = await regionService.getRegionsGeoJSON(level, parent, detail);
    res.type('application/geo+json').send(fc);
  } catch (err) {
    next(err);
  }
});

regionRoutes.get('/regions/search', async (req, res, next) => {
  try {
    ok(res, await regionService.searchRegions(String(req.query.q ?? '')));
  } catch (err) {
    next(err);
  }
});

regionRoutes.get('/regions/options', async (req, res, next) => {
  try {
    const level = String(req.query.level ?? '');
    if (!level) throw badRequest('Parameter level wajib diisi', { level: ['Wajib diisi'] });
    const parent = req.query.parent ? String(req.query.parent) : undefined;
    const rows = await regionService.getRegionOptions(level, parent);
    ok(res, rows.map((r) => ({ region_id: r.regionId, name: r.name })));
  } catch (err) {
    next(err);
  }
});

regionRoutes.get('/regions/:regionId', async (req, res, next) => {
  try {
    ok(res, await regionService.getRegionDetail(req.params.regionId));
  } catch (err) {
    next(err);
  }
});

regionRoutes.post('/admin/regions/upload', requireRole('admin'), fileUpload.single('file'), async (req, res, next) => {
  try {
    const level = String(req.body.level ?? '') as RegionLevel;
    if (!(LEVELS as string[]).includes(level)) throw badRequest('Level tidak valid');
    if (!req.file) throw badRequest('File geojson wajib diunggah');
    const fc = regionImport.parseFeatureCollection(req.file.buffer);
    const result = await regionImport.importRegions({
      level,
      fc,
      filename: req.file.originalname,
      uploadedBy: req.user!.sub,
    });
    ok(res, { upload_id: result.uploadId, status: 'done', feature_count: result.featureCount });
  } catch (err) {
    next(err);
  }
});

regionRoutes.get('/admin/regions/uploads', requireRole('admin'), async (_req, res, next) => {
  try {
    ok(res, await regionImport.listRegionUploads());
  } catch (err) {
    next(err);
  }
});
