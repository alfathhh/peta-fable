import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { claimTokenLimiter } from '../middlewares/rateLimit';
import { ok, created } from '../lib/respond';
import { activitySchema, claimTokenSchema, createTokenSchema, updateTokenSchema } from '../schemas';
import * as activityService from '../services/activityService';
import * as tokenService from '../services/tokenService';

export const activityRoutes = Router();

activityRoutes.use(auth);

// ----- kegiatan (admin) -----
activityRoutes.get('/admin/activities', requireRole('admin'), async (_req, res, next) => {
  try {
    ok(res, await activityService.listActivities());
  } catch (err) {
    next(err);
  }
});

activityRoutes.post('/admin/activities', requireRole('admin'), async (req, res, next) => {
  try {
    created(res, await activityService.createActivity(activitySchema.parse(req.body), req.user!.sub));
  } catch (err) {
    next(err);
  }
});

activityRoutes.put('/admin/activities/:id', requireRole('admin'), async (req, res, next) => {
  try {
    ok(res, await activityService.updateActivity(req.params.id, activitySchema.partial().parse(req.body)));
  } catch (err) {
    next(err);
  }
});

activityRoutes.delete('/admin/activities/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await activityService.deleteActivity(req.params.id);
    ok(res, { message: 'Kegiatan dihapus' });
  } catch (err) {
    next(err);
  }
});

// ----- token (admin) -----
activityRoutes.get('/admin/tokens', requireRole('admin'), async (req, res, next) => {
  try {
    ok(
      res,
      await tokenService.listTokens({
        activity_id: req.query.activity_id ? String(req.query.activity_id) : undefined,
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

activityRoutes.post('/admin/tokens', requireRole('admin'), async (req, res, next) => {
  try {
    created(res, await tokenService.createToken(createTokenSchema.parse(req.body), req.user!.sub));
  } catch (err) {
    next(err);
  }
});

activityRoutes.put('/admin/tokens/:id', requireRole('admin'), async (req, res, next) => {
  try {
    ok(res, await tokenService.updateToken(req.params.id, updateTokenSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

activityRoutes.delete('/admin/tokens/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await tokenService.deleteToken(req.params.id);
    ok(res, { message: 'Token dihapus' });
  } catch (err) {
    next(err);
  }
});

// ----- petugas -----
activityRoutes.post('/tokens/claim', requireRole('petugas'), claimTokenLimiter, async (req, res, next) => {
  try {
    const body = claimTokenSchema.parse(req.body);
    ok(res, await tokenService.claimToken(body.token, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

activityRoutes.get('/my/activities', requireRole('petugas'), async (req, res, next) => {
  try {
    ok(res, await activityService.myActivities(req.user!.sub));
  } catch (err) {
    next(err);
  }
});
