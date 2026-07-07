import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { photoUpload, assertIsImage } from '../middlewares/upload';
import { ok, created } from '../lib/respond';
import { approvalSchema, createInfraSchema, updateInfraSchema } from '../schemas';
import * as infraService from '../services/infraService';
import * as auditService from '../services/auditService';

export const infraRoutes = Router();

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
          project_id: req.query.project_id ? String(req.query.project_id) : undefined,
          activity_id: req.query.activity_id ? String(req.query.activity_id) : undefined,
        },
        req.user!,
      ),
    );
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
    const q = req.query;
    const { rows, meta } = await infraService.adminListInfrastructures({
      page: q.page ? Number(q.page) : undefined,
      per_page: q.per_page ? Number(q.per_page) : undefined,
      category_id: q.category_id ? String(q.category_id) : undefined,
      q: q.q ? String(q.q) : undefined,
      region_id: q.region_id ? String(q.region_id) : undefined,
      project_id: q.project_id ? String(q.project_id) : undefined,
      activity_id: q.activity_id ? String(q.activity_id) : undefined,
      user_id: q.user_id ? String(q.user_id) : undefined,
      is_outside_region:
        q.is_outside_region === 'true' ? true : q.is_outside_region === 'false' ? false : undefined,
      approval_status: q.approval_status ? String(q.approval_status) : undefined,
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
