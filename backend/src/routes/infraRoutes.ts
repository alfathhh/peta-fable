import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { photoUpload, assertIsImage } from '../middlewares/upload';
import { ok, created } from '../lib/respond';
import { adminInfraQuerySchema, approvalSchema, createInfraSchema, updateInfraSchema } from '../schemas';
import * as infraService from '../services/infraService';
import * as auditService from '../services/auditService';
import { noStore } from '../middlewares/noStore';
import { notFound } from '../middlewares/errorHandler';
import { STORAGE_ROOT } from '../services/layerService';

export const infraRoutes = Router();

function isStoragePath(absolutePath: string): boolean {
  const relative = path.relative(STORAGE_ROOT, absolutePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

infraRoutes.use(auth);

infraRoutes.get('/infrastructures', async (req, res, next) => {
  try {
    ok(
      res,
      await infraService.listInfrastructures(
        {
          category_id: req.query.category_id ? String(req.query.category_id) : undefined,
          q: req.query.q ? String(req.query.q) : undefined,
          region_id: req.query.region_id ? String(req.query.region_id) : undefined,
          activity_id: req.query.activity_id ? String(req.query.activity_id) : undefined,
        },
      ),
    );
  } catch (err) {
    next(err);
  }
});

infraRoutes.get('/infrastructures/:id/photo', noStore, async (req, res, next) => {
  try {
    const size = req.query.size === 'thumb' ? 'thumb' : 'full';
    const photoPath = await infraService.getInfrastructurePhotoPath(req.params.id, req.user!, size);
    const absolutePath = path.resolve(STORAGE_ROOT, photoPath);
    if (!isStoragePath(absolutePath) || !fs.existsSync(absolutePath)) {
      throw notFound('Foto tidak ditemukan');
    }
    res.sendFile(absolutePath);
  } catch (err) {
    next(err);
  }
});

infraRoutes.get('/infrastructures/:id', async (req, res, next) => {
  try {
    ok(res, await infraService.getInfrastructure(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

infraRoutes.post('/infrastructures', photoUpload.single('photo'), async (req, res, next) => {
  try {
    const body = createInfraSchema.parse(req.body);
    if (req.file) await assertIsImage(req.file.buffer);
    const { infra, warning } = await infraService.createInfrastructure(req.user!, body, req.file?.buffer);
    auditService.record(req.user, 'create', 'infrastructure', infra.id, { name: infra.name });
    created(res, infra, warning ? { warning } : undefined);
  } catch (err) {
    next(err);
  }
});

infraRoutes.put('/infrastructures/:id', photoUpload.single('photo'), async (req, res, next) => {
  try {
    const body = updateInfraSchema.parse(req.body);
    if (req.file) await assertIsImage(req.file.buffer);
    const updated = await infraService.updateInfrastructure(req.params.id, req.user!, body, req.file?.buffer);
    auditService.record(req.user, 'update', 'infrastructure', req.params.id, { name: updated.name });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

infraRoutes.delete('/infrastructures/:id', async (req, res, next) => {
  try {
    await infraService.deleteInfrastructure(req.params.id, req.user!);
    auditService.record(req.user, 'delete', 'infrastructure', req.params.id);
    ok(res, { message: 'Infrastruktur dihapus' });
  } catch (err) {
    next(err);
  }
});

infraRoutes.get('/admin/infrastructures', requireRole('admin'), async (req, res, next) => {
  try {
    const q = adminInfraQuerySchema.parse(req.query);
    const { rows, meta } = await infraService.adminListInfrastructures({
      page: q.page,
      per_page: q.per_page,
      category_id: q.category_id,
      q: q.q,
      region_id: q.region_id,
      project_id: q.project_id,
      activity_id: q.activity_id,
      user_id: q.user_id,
      is_outside_region: q.is_outside_region === undefined ? undefined : q.is_outside_region === 'true',
      approval_status: q.approval_status,
    });
    ok(res, rows, meta);
  } catch (err) {
    next(err);
  }
});

// ACC / tolak infrastruktur oleh admin — menentukan tampil/tidaknya di peta umum
infraRoutes.put('/admin/infrastructures/:id/approval', requireRole('admin'), async (req, res, next) => {
  try {
    const body = approvalSchema.parse(req.body);
    const updated = await infraService.setApprovalStatus(req.params.id, body.status, body.note);
    auditService.record(req.user, body.status === 'approved' ? 'approve' : body.status === 'rejected' ? 'reject' : 'reset-approval', 'infrastructure', req.params.id, {
      name: updated.name,
      ...(body.note ? { note: body.note } : {}),
    });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});
