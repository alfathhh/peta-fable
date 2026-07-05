import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { fileUpload } from '../middlewares/upload';
import { badRequest } from '../middlewares/errorHandler';
import { ok } from '../lib/respond';
import * as exportService from '../services/exportService';
import * as importService from '../services/importService';

export const exportImportRoutes = Router();

exportImportRoutes.use(['/admin/export', '/admin/import'], auth, requireRole('admin'));

exportImportRoutes.get('/admin/export/:module', async (req, res, next) => {
  try {
    const format = String(req.query.format ?? 'xlsx');
    const filters: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'format' && typeof value === 'string') filters[key] = value;
    }
    const { buffer, contentType, filename } = await exportService.exportModule(req.params.module, format, filters);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

exportImportRoutes.get('/admin/import/infrastructures/template', async (_req, res, next) => {
  try {
    const buffer = await importService.buildTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-infrastruktur.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

exportImportRoutes.post('/admin/import/infrastructures/validate', fileUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('File XLSX wajib diunggah');
    ok(res, await importService.validateImport(req.file.buffer, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

exportImportRoutes.post('/admin/import/infrastructures/commit', async (req, res, next) => {
  try {
    const uploadId = String(req.body.upload_id ?? '');
    if (!uploadId) throw badRequest('upload_id wajib diisi');
    ok(res, await importService.commitImport(uploadId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

exportImportRoutes.get('/admin/import/infrastructures/:uploadId/failed', async (req, res, next) => {
  try {
    const buffer = await importService.buildFailedRowsXlsx(req.params.uploadId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="baris-gagal.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
