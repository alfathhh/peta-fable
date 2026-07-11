import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../middlewares/errorHandler';
import { getOwnedProject } from './projectService';
import { DEFAULT_LAYER_STYLE } from '../schemas';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const LAYERS_DIR = path.join(STORAGE_ROOT, 'layers');

function isStoragePath(absolutePath: string): boolean {
  const relative = path.relative(STORAGE_ROOT, absolutePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

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
  const MAX_FEATURES = 5000; // layer > ini membuat Leaflet berat & bukan use case lapangan
  if (parsed.features.length === 0) throw badRequest('FeatureCollection kosong — tidak ada yang bisa dirender');
  if (parsed.features.length > MAX_FEATURES) {
    throw badRequest(`Terlalu banyak feature (${parsed.features.length}); maksimal ${MAX_FEATURES} per layer`);
  }
  const invalidIdx = (parsed.features as { type?: string; geometry?: unknown }[]).findIndex(
    (f) => f?.type !== 'Feature' || f.geometry === undefined,
  );
  if (invalidIdx >= 0) throw badRequest(`Feature ke-${invalidIdx + 1} bukan objek Feature GeoJSON yang valid`);

  const id = crypto.randomUUID();
  const relPath = path.join('layers', `${id}.geojson`).replace(/\\/g, '/');
  const absPath = path.join(STORAGE_ROOT, relPath);
  fs.mkdirSync(LAYERS_DIR, { recursive: true });
  fs.writeFileSync(absPath, file.buffer);
  try {
    return await prisma.projectLayer.create({
      data: {
        id,
      projectId,
      name: name?.trim() || file.originalname.replace(/\.(geo)?json$/i, ''),
        geojsonPath: relPath,
      featureCount: parsed.features.length,
      style: DEFAULT_LAYER_STYLE,
      sortOrder: await prisma.projectLayer.count({ where: { projectId } }),
      },
    });
  } catch (err) {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    throw err;
  }
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
  if (!isStoragePath(abs)) throw notFound('Layer tidak ditemukan'); // path traversal guard
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
  const abs = path.resolve(STORAGE_ROOT, layer.geojsonPath);
  const deleting = `${abs}.deleting`;
  if (isStoragePath(abs) && fs.existsSync(abs)) fs.renameSync(abs, deleting);
  try {
    await prisma.projectLayer.delete({ where: { id } });
  } catch (err) {
    if (fs.existsSync(deleting)) fs.renameSync(deleting, abs);
    throw err;
  }
  // DB sudah commit — kegagalan bersih-bersih file tidak boleh membuat request 500;
  // sisa file .deleting hanya jadi yatim yang bisa disapu maintenance job.
  try {
    if (fs.existsSync(deleting)) fs.unlinkSync(deleting);
  } catch (err) {
    console.error(`Gagal menghapus file layer ${deleting} (layer sudah terhapus di DB):`, err);
  }
}
