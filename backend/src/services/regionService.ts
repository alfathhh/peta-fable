import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet } from '../lib/cache';
import { badRequest, notFound } from '../middlewares/errorHandler';
import { LEVELS, type RegionLevel } from '../lib/regionId';

function assertLevel(level: string): asserts level is RegionLevel {
  if (!(LEVELS as string[]).includes(level)) {
    throw badRequest('Level wilayah tidak valid', { level: [`Harus salah satu dari: ${LEVELS.join(', ')}`] });
  }
}

/**
 * FeatureCollection GeoJSON per level + parent (on-demand — ARCHITECTURE §4.3).
 * FeatureCollection dibangun langsung oleh PostGIS; Node hanya meneruskan string.
 */
export async function getRegionsGeoJSON(level: string, parent: string | undefined, detail: 'low' | 'high'): Promise<string> {
  assertLevel(level);
  const prefix = parent ?? '';
  const cacheKey = `regions:${level}:${prefix}:${detail}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const geomCol = detail === 'high' ? Prisma.sql`geom` : Prisma.sql`COALESCE(geom_simplified, geom)`;
  const rows = await prisma.$queryRaw<{ fc: string }[]>`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(t.g)::json,
          'properties', json_build_object('region_id', t.region_id, 'name', t.name, 'level', t.level)
        ) ORDER BY t.region_id
      ), '[]'::json)
    )::text AS fc
    FROM (
      SELECT region_id, name, level, ${geomCol} AS g
      FROM regions
      WHERE level = ${level} AND region_id LIKE ${prefix + '%'} AND geom IS NOT NULL
    ) t;
  `;
  const fc = rows[0]?.fc ?? '{"type":"FeatureCollection","features":[]}';
  cacheSet(cacheKey, fc);
  return fc;
}

/** Versi ringan untuk dropdown berjenjang — tanpa geometri. */
export async function getRegionOptions(level: string, parent: string | undefined) {
  assertLevel(level);
  return prisma.region.findMany({
    where: { level, ...(parent ? { regionId: { startsWith: parent } } : {}) },
    select: { regionId: true, name: true },
    orderBy: { regionId: 'asc' },
  });
}

/** Cari wilayah by nama / id, semua level, maks 20 hasil. */
export async function searchRegions(q: string) {
  const query = q.trim();
  if (!query) return [];
  const rows = await prisma.region.findMany({
    where: {
      OR: [{ name: { contains: query, mode: 'insensitive' } }, { regionId: { startsWith: query } }],
    },
    select: { regionId: true, level: true, name: true, bbox: true, parentId: true },
    orderBy: { regionId: 'asc' },
    take: 20,
  });

  // path_name: rangkai nama parent ("Korong Kasai, Katapiang, Batang Anai")
  const parentIds = new Set<string>();
  for (const r of rows) {
    let pid = r.parentId;
    // parent bisa bertingkat; ambil dari prefix
    while (pid) {
      parentIds.add(pid);
      pid = pid.length > 4 ? pid.slice(0, pid.length === 16 ? 14 : pid.length === 14 ? 10 : pid.length === 10 ? 7 : 4) : null;
      if (pid && pid.length < 4) pid = null;
    }
  }
  const parents = parentIds.size
    ? await prisma.region.findMany({ where: { regionId: { in: [...parentIds] } }, select: { regionId: true, name: true } })
    : [];
  const nameById = new Map(parents.map((p) => [p.regionId, p.name]));

  return rows.map((r) => {
    const path: string[] = [r.name];
    const lengths = [14, 10, 7].filter((l) => l < r.regionId.length);
    for (const l of lengths) {
      const name = nameById.get(r.regionId.slice(0, l));
      if (name) path.push(name);
    }
    return { region_id: r.regionId, level: r.level, name: r.name, path_name: path.join(', '), bbox: r.bbox };
  });
}

/** Detail 1 wilayah + statistik jumlah infrastruktur per kategori. */
export async function getRegionDetail(regionId: string) {
  const region = await prisma.region.findUnique({
    where: { regionId },
    select: { regionId: true, level: true, name: true, parentId: true, bbox: true, properties: true },
  });
  if (!region) throw notFound('Wilayah tidak ditemukan');

  const columnByLevel: Record<string, 'idkab' | 'idkec' | 'iddesa' | 'idsls' | 'idsubsls'> = {
    kab: 'idkab',
    kec: 'idkec',
    desa: 'iddesa',
    sls: 'idsls',
    subsls: 'idsubsls',
  };
  const col = columnByLevel[region.level]!;
  const grouped = await prisma.infrastructure.groupBy({
    by: ['categoryId'],
    where: { [col]: regionId, deletedAt: null },
    _count: { _all: true },
  });
  const categories = grouped.length
    ? await prisma.category.findMany({ where: { id: { in: grouped.map((g) => g.categoryId) } } })
    : [];
  const catById = new Map(categories.map((c) => [c.id, c]));
  const stats = grouped
    .map((g) => {
      const c = catById.get(g.categoryId);
      return c ? { category_id: c.id, name: c.name, icon: c.icon, color: c.color, count: g._count._all } : null;
    })
    .filter(Boolean);

  return {
    region_id: region.regionId,
    level: region.level,
    name: region.name,
    parent_id: region.parentId,
    bbox: region.bbox,
    properties: region.properties,
    infrastructure_stats: stats,
  };
}
