import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { ok, created } from '../lib/respond';
import { categorySchema } from '../schemas';
import * as categoryService from '../services/categoryService';

export const categoryRoutes = Router();

categoryRoutes.use(auth);

categoryRoutes.get('/categories', async (_req, res, next) => {
  try {
    ok(res, await categoryService.listCategories());
  } catch (err) {
    next(err);
  }
});

categoryRoutes.post('/admin/categories', requireRole('admin'), async (req, res, next) => {
  try {
    created(res, await categoryService.createCategory(categorySchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

categoryRoutes.put('/admin/categories/:id', requireRole('admin'), async (req, res, next) => {
  try {
    ok(res, await categoryService.updateCategory(req.params.id, categorySchema.partial().parse(req.body)));
  } catch (err) {
    next(err);
  }
});

categoryRoutes.delete('/admin/categories/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    ok(res, { message: 'Kategori dihapus' });
  } catch (err) {
    next(err);
  }
});
