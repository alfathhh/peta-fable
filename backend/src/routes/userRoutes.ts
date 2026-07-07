import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { ok, created } from '../lib/respond';
import { createUserSchema, updateUserSchema } from '../schemas';
import * as userService from '../services/userService';
import * as auditService from '../services/auditService';

export const userRoutes = Router();

// scoped ke path-nya — jangan pakai use() tanpa path (ikut menangkap request
// yang tidak match dan mengubah 404 jadi 403)
userRoutes.use('/admin/users', auth, requireRole('admin'));

userRoutes.get('/admin/users', async (_req, res, next) => {
  try {
    ok(res, await userService.listUsers());
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/admin/users', async (req, res, next) => {
  try {
    const user = await userService.createUser(createUserSchema.parse(req.body));
    auditService.record(req.user, 'create', 'user', user.id, { username: user.username, role: user.role });
    created(res, user);
  } catch (err) {
    next(err);
  }
});

userRoutes.put('/admin/users/:id', async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id, body);
    auditService.record(req.user, 'update', 'user', user.id, {
      username: user.username,
      ...(body.password ? { password_reset: true } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    });
    ok(res, user);
  } catch (err) {
    next(err);
  }
});

userRoutes.delete('/admin/users/:id', async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user!.sub);
    auditService.record(req.user, 'delete', 'user', req.params.id);
    ok(res, { message: 'User dihapus' });
  } catch (err) {
    next(err);
  }
});
