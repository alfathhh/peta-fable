import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { noStore } from '../middlewares/noStore';
import { mutationLimiter, regionsLimiter } from '../middlewares/rateLimit';
import { fileUpload } from '../middlewares/upload';
import { badRequest } from '../middlewares/errorHandler';
import { ok } from '../lib/respond';
import { LEVELS, type RegionLevel } from '../lib/regionId';
import * as regionService from '../services/regionService';
import * as regionImport from '../services/regionImportService';
import * as auditService from '../services/auditService';

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

// Jumlah infrastruktur (approved) per wilayah pada satu level — untuk choropleth
regionRoutes.get('/regions/stats', async (req, res, next) => {
  try {
    const level = String(req.query.level ?? '');
    if (!level) throw badRequest('Parameter level wajib diisi', { level: ['Wajib diisi'] });
    const parent = req.query.parent ? String(req.query.parent) : undefined;
    const categoryIds = req.query.category_id
      ? String(req.query.category_id).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    ok(res, await regionService.getRegionStats(level, parent, categoryIds));
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

regionRoutes.post('/admin/regions/upload', requireRole('admin'), mutationLimiter, fileUpload.single('file'), async (req, res, next) => {
  try {
    const level = String(req.body.level ?? '') as RegionLevel;
    if (!(LEVELS as string[]).includes(level)) throw badRequest('Level tidak valid');
    if (!req.file) throw badRequest('File geojson wajib diunggah');
    const fc = regionImport.parseFeatureCollection(req.file.buffer);
    // proses di background — file sub-SLS besar tidak memblokir request;
    // status dipantau lewat GET /admin/regions/uploads
    const uploadId = await regionImport.startRegionImportAsync({
      level,
      fc,
      filename: req.file.originalname,
      uploadedBy: req.user!.sub,
    });
    auditService.record(req.user, 'upload', 'regions', uploadId, {
      level,
      filename: req.file.originalname,
      features: fc.features.length,
    });
    ok(res, { upload_id: uploadId, status: 'processing' });
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
