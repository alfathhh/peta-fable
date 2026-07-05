import { prisma } from '../lib/prisma';
import { cacheClear } from '../lib/cache';
import { badRequest } from '../middlewares/errorHandler';
import { LEVEL_TO_LENGTH, parentOf, type RegionLevel } from '../lib/regionId';

interface GeoFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// Kandidat nama properti id & nama per level (file BPS bisa beda-beda kapitalisasi/nama).
const ID_KEYS: Record<RegionLevel, string[]> = {
  kab: ['idkab', 'kdkab', 'id'],
  kec: ['idkec', 'kdkec', 'id'],
  desa: ['iddesa', 'idkel', 'kddesa', 'id'],
  sls: ['idsls', 'kdsls', 'id'],
  subsls: ['idsubsls', 'id_subsls', 'idsls_sub', 'id'],
};
const NAME_KEYS: Record<RegionLevel, string[]> = {
  kab: ['nmkab', 'nama', 'name'],
  kec: ['nmkec', 'nama', 'name'],
  desa: ['nmdesa', 'nmkel', 'nama', 'name'],
  sls: ['nmsls', 'nama', 'name'],
  subsls: ['nmsubsls', 'nmsls', 'nama', 'name'],
};

function lowercaseKeys(props: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) out[k.toLowerCase()] = v;
  return out;
}

function pick(props: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = props[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

export function parseFeatureCollection(raw: string | Buffer): FeatureCollection {
  let json: unknown;
  try {
    json = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
  } catch {
    throw badRequest('File bukan JSON yang valid');
  }
  const fc = json as FeatureCollection;
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw badRequest('File harus berupa GeoJSON FeatureCollection');
  }
  return fc;
}

/**
 * Import/replace data wilayah satu level (dipakai CLI & endpoint admin upload).
 * Replace dilakukan dalam satu transaction; gagal validasi = rollback.
 */
export async function importRegions(opts: {
  level: RegionLevel;
  fc: FeatureCollection;
  filename: string;
  uploadedBy?: string;
  sourceVersion?: string;
}): Promise<{ uploadId: string | null; featureCount: number }> {
  const { level, fc } = opts;
  const expectedLen = LEVEL_TO_LENGTH[level];

  // Validasi & normalisasi dulu di luar transaction
  const rows: { regionId: string; name: string; geometry: string; properties: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  fc.features.forEach((feature, i) => {
    const props = lowercaseKeys(feature.properties);
    const id = pick(props, ID_KEYS[level]);
    const name = pick(props, NAME_KEYS[level]);
    if (!id) return errors.push(`Fitur #${i + 1}: properti id (${ID_KEYS[level][0]}) tidak ditemukan`);
    if (id.length !== expectedLen) return errors.push(`Fitur #${i + 1}: panjang id "${id}" bukan ${expectedLen} digit`);
    if (!name) return errors.push(`Fitur #${i + 1}: properti nama (${NAME_KEYS[level][0]}) tidak ditemukan`);
    if (!feature.geometry) return errors.push(`Fitur #${i + 1}: geometry kosong`);
    rows.push({ regionId: id, name, geometry: JSON.stringify(feature.geometry), properties: props });
  });

  const uploadId = opts.uploadedBy
    ? (
        await prisma.regionUpload.create({
          data: { level, filename: opts.filename, uploadedBy: opts.uploadedBy, status: 'processing' },
        })
      ).id
    : null;

  if (errors.length > 0 || rows.length === 0) {
    const note = errors.length ? errors.slice(0, 20).join('; ') : 'Tidak ada fitur valid';
    if (uploadId) await prisma.regionUpload.update({ where: { id: uploadId }, data: { status: 'failed', note } });
    throw badRequest(`Validasi GeoJSON gagal: ${note}`);
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`DELETE FROM regions WHERE level = ${level};`;
        const BATCH = 200;
        for (let start = 0; start < rows.length; start += BATCH) {
          const batch = rows.slice(start, start + BATCH);
          for (const row of batch) {
            const parent = parentOf(row.regionId);
            await tx.$executeRaw`
              INSERT INTO regions (region_id, level, name, parent_id, geom, properties, source_version, updated_at)
              VALUES (
                ${row.regionId}, ${level}, ${row.name}, ${parent},
                ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(${row.geometry})), 3)),
                ${JSON.stringify(row.properties)}::jsonb,
                ${opts.sourceVersion ?? opts.filename},
                NOW()
              )
              ON CONFLICT (region_id) DO UPDATE SET
                level = EXCLUDED.level, name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
                geom = EXCLUDED.geom, properties = EXCLUDED.properties,
                source_version = EXCLUDED.source_version, updated_at = NOW();
            `;
          }
        }
        // Simplifikasi + bbox dihitung sekali per level
        await tx.$executeRaw`
          UPDATE regions
          SET geom_simplified = ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0005)),
              bbox = json_build_array(ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom))
          WHERE level = ${level};
        `;
      },
      { timeout: 300_000 },
    );
  } catch (err) {
    if (uploadId) {
      await prisma.regionUpload.update({
        where: { id: uploadId },
        data: { status: 'failed', note: err instanceof Error ? err.message : 'Gagal menyimpan' },
      });
    }
    throw err;
  }

  cacheClear();
  if (uploadId) {
    await prisma.regionUpload.update({
      where: { id: uploadId },
      data: { status: 'done', featureCount: rows.length },
    });
  }
  return { uploadId, featureCount: rows.length };
}

export async function listRegionUploads() {
  return prisma.regionUpload.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { uploader: { select: { id: true, name: true, username: true } } },
  });
}
