import fs from 'node:fs';
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { noStore } from '../middlewares/noStore';
import { fileUpload } from '../middlewares/upload';
import { badRequest } from '../middlewares/errorHandler';
import { ok, created } from '../lib/respond';
import { createProjectSchema, updateLayerSchema, updateProjectSchema } from '../schemas';
import * as projectService from '../services/projectService';
import * as layerService from '../services/layerService';
import * as infraService from '../services/infraService';
import { mutationLimiter } from '../middlewares/rateLimit';

export const projectRoutes = Router();

projectRoutes.use(auth);

// ----- proyek milik petugas -----
projectRoutes.get('/my/projects', requireRole('petugas'), async (req, res, next) => {
  try {
    ok(res, await projectService.listMyProjects(req.user!.sub));
  } catch (err) {
    next(err);
  }
});

projectRoutes.post('/my/projects', requireRole('petugas'), async (req, res, next) => {
  try {
    created(res, await projectService.createProject(req.user!.sub, createProjectSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

projectRoutes.get('/my/projects/:id', async (req, res, next) => {
  try {
    ok(res, await projectService.getProjectDetail(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

projectRoutes.get('/my/projects/:id/infrastructures', async (req, res, next) => {
  try {
    ok(res, await infraService.listProjectInfrastructures(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

projectRoutes.put('/my/projects/:id', async (req, res, next) => {
  try {
    ok(res, await projectService.updateProject(req.params.id, req.user!, updateProjectSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

projectRoutes.delete('/my/projects/:id', async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id, req.user!);
    ok(res, { message: 'Proyek dihapus' });
  } catch (err) {
    next(err);
  }
});

// ----- layer proyek -----
projectRoutes.get('/my/projects/:id/layers', noStore, async (req, res, next) => {
  try {
    ok(res, await layerService.listLayers(req.params.id, req.user!));
  } catch (err) {
    next(err);
  }
});

projectRoutes.post('/my/projects/:id/layers', mutationLimiter, fileUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('File geojson wajib diunggah');
    created(
      res,
      await layerService.createLayer(req.params.id, req.user!, req.file, req.body.name ? String(req.body.name) : undefined),
    );
  } catch (err) {
    next(err);
  }
});

projectRoutes.get('/layers/:id/geojson', noStore, async (req, res, next) => {
  try {
    const absPath = await layerService.getLayerGeojsonPath(req.params.id, req.user!);
    res.type('application/geo+json');
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

projectRoutes.put('/layers/:id', async (req, res, next) => {
  try {
    ok(res, await layerService.updateLayer(req.params.id, req.user!, updateLayerSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

projectRoutes.delete('/layers/:id', async (req, res, next) => {
  try {
    await layerService.deleteLayer(req.params.id, req.user!);
    ok(res, { message: 'Layer dihapus' });
  } catch (err) {
    next(err);
  }
});

// ----- admin project management -----
projectRoutes.get('/admin/projects', requireRole('admin'), async (req, res, next) => {
  try {
    ok(
      res,
      await projectService.adminListProjects({
        user_id: req.query.user_id ? String(req.query.user_id) : undefined,
        activity_id: req.query.activity_id ? String(req.query.activity_id) : undefined,
        region_id: req.query.region_id ? String(req.query.region_id) : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

projectRoutes.put('/admin/projects/:id', requireRole('admin'), async (req, res, next) => {
  try {
    ok(res, await projectService.updateProject(req.params.id, req.user!, updateProjectSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

projectRoutes.delete('/admin/projects/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id, req.user!);
    ok(res, { message: 'Proyek dihapus' });
  } catch (err) {
    next(err);
  }
});
