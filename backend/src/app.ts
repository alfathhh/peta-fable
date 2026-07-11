import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/authRoutes';
import { regionRoutes } from './routes/regionRoutes';
import { categoryRoutes } from './routes/categoryRoutes';
import { infraRoutes } from './routes/infraRoutes';
import { activityRoutes } from './routes/activityRoutes';
import { projectRoutes } from './routes/projectRoutes';
import { userRoutes } from './routes/userRoutes';
import { exportImportRoutes } from './routes/exportImportRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Readiness: proses hidup TIDAK berarti siap melayani — cek DB benar-benar terjangkau
  // (dipakai healthcheck container / load balancer sebelum mengarahkan trafik).
  app.get('/api/ready', async (_req, res) => {
    try {
      const { prisma } = await import('./lib/prisma');
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ready: true });
    } catch {
      res.status(503).json({ ready: false, message: 'Database tidak terjangkau' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', regionRoutes);
  app.use('/api', categoryRoutes);
  app.use('/api', infraRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', projectRoutes);
  app.use('/api', userRoutes);
  app.use('/api', exportImportRoutes);
  app.use('/api', dashboardRoutes);

  app.use((_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));
  app.use(errorHandler);
  return app;
}
