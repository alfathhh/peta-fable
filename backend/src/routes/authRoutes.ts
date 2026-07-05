import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { ok } from '../lib/respond';
import { changePasswordSchema, loginSchema } from '../schemas';
import * as authService from '../services/authService';

export const authRoutes = Router();

authRoutes.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    ok(res, await authService.login(body.username, body.password));
  } catch (err) {
    next(err);
  }
});

authRoutes.get('/me', auth, async (req, res, next) => {
  try {
    ok(res, await authService.me(req.user!.sub));
  } catch (err) {
    next(err);
  }
});

authRoutes.put('/me/password', auth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.sub, body.current_password, body.new_password);
    ok(res, { message: 'Password berhasil diganti' });
  } catch (err) {
    next(err);
  }
});
