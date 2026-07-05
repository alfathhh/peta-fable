import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../middlewares/errorHandler';
import { getOwnedProject } from './projectService';
import { DEFAULT_LAYER_STYLE } from '../schemas';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const LAYERS_DIR = path.join(STORAGE_ROOT, 'layers');

export async function listLayers(projectId: string, user: { sub: string; role: string }) {
  await getOwnedProject(projectId, user);
  return prisma.projectLayer.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
}

export async function createLayer(
  projectId: string,
  user: { sub: string; role: string },
  file: { buffer: Buffer; originalname: string },
  name?: string,
) {
  await getOwnedProject(projectId, user);

  let parsed: { type?: string; features?: unknown[] };
  try {
    parsed = JSON.parse(file.buffer.toString('utf-8'));
  } catch {
    throw badRequest('File bukan GeoJSON yang valid');
  }
  if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw badRequest('File harus berupa GeoJSON FeatureCollection');
  }

  const layer = await prisma.projectLayer.create({
    data: {
      projectId,
      name: name?.trim() || file.originalname.replace(/\.(geo)?json$/i, ''),
      geojsonPath: '',
      featureCount: parsed.features.length,
      style: DEFAULT_LAYER_STYLE,
      sortOrder: await prisma.projectLayer.count({ where: { projectId } }),
    },
  });

  fs.mkdirSync(LAYERS_DIR, { recursive: true });
  const relPath = path.join('layers', `${layer.id}.geojson`);
  fs.writeFileSync(path.join(STORAGE_ROOT, relPath), file.buffer);
  return prisma.projectLayer.update({ where: { id: layer.id }, data: { geojsonPath: relPath } });
}

async function getOwnedLayer(id: string, user: { sub: string; role: string }) {
  const layer = await prisma.projectLayer.findUnique({ where: { id }, include: { project: true } });
  if (!layer || layer.project.deletedAt) throw notFound('Layer tidak ditemukan');
  if (user.role !== 'admin' && layer.project.userId !== user.sub) throw notFound('Layer tidak ditemukan');
  return layer;
}

/** Path absolut file geojson layer — HANYA dipanggil dari route ber-auth. */
export async function getLayerGeojsonPath(id: string, user: { sub: string; role: string }): Promise<string> {
  const layer = await getOwnedLayer(id, user);
  const abs = path.resolve(STORAGE_ROOT, layer.geojsonPath);
  if (!abs.startsWith(STORAGE_ROOT)) throw notFound('Layer tidak ditemukan'); // path traversal guard
  if (!fs.existsSync(abs)) throw notFound('File layer tidak ditemukan');
  return abs;
}

export async function updateLayer(
  id: string,
  user: { sub: string; role: string },
  input: { name?: string; style?: unknown; is_visible?: boolean; sort_order?: number },
) {
  await getOwnedLayer(id, user);
  return prisma.projectLayer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.style !== undefined ? { style: input.style as object } : {}),
      ...(input.is_visible !== undefined ? { isVisible: input.is_visible } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    },
  });
}

export async function deleteLayer(id: string, user: { sub: string; role: string }) {
  const layer = await getOwnedLayer(id, user);
  await prisma.projectLayer.delete({ where: { id } });
  const abs = path.resolve(STORAGE_ROOT, layer.geojsonPath);
  if (abs.startsWith(STORAGE_ROOT) && fs.existsSync(abs)) fs.unlinkSync(abs);
}
