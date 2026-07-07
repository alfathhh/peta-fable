import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { ok } from '../lib/respond';
import * as dashboardService from '../services/dashboardService';
import * as auditService from '../services/auditService';

export const dashboardRoutes = Router();

dashboardRoutes.get('/admin/dashboard', auth, requireRole('admin'), async (_req, res, next) => {
  try {
    ok(res, await dashboardService.getDashboard());
  } catch (err) {
    next(err);
  }
});

dashboardRoutes.get('/admin/audit-logs', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows, meta } = await auditService.listAuditLogs({
      page: req.query.page ? Number(req.query.page) : undefined,
      per_page: req.query.per_page ? Number(req.query.per_page) : undefined,
      entity: req.query.entity ? String(req.query.entity) : undefined,
      user_id: req.query.user_id ? String(req.query.user_id) : undefined,
    });
    ok(res, rows, meta);
  } catch (err) {
    next(err);
  }
});
