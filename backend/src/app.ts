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
import { fileRoutes } from './routes/fileRoutes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api', regionRoutes);
  app.use('/api', categoryRoutes);
  app.use('/api', infraRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', projectRoutes);
  app.use('/api', userRoutes);
  app.use('/api', exportImportRoutes);
  app.use('/api', fileRoutes);

  app.use((_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));
  app.use(errorHandler);
  return app;
}
