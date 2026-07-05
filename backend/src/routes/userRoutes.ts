import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { ok, created } from '../lib/respond';
import { createUserSchema, updateUserSchema } from '../schemas';
import * as userService from '../services/userService';

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
    created(res, await userService.createUser(createUserSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

userRoutes.put('/admin/users/:id', async (req, res, next) => {
  try {
    ok(res, await userService.updateUser(req.params.id, updateUserSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

userRoutes.delete('/admin/users/:id', async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user!.sub);
    ok(res, { message: 'User dihapus' });
  } catch (err) {
    next(err);
  }
});
