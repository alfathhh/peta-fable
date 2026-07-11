import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet } from '../lib/cache';
import { badRequest, notFound } from '../middlewares/errorHandler';
import { LEVELS, childLevelOf, levelOf, type RegionLevel } from '../lib/regionId';

function assertLevel(level: string): asserts level is RegionLevel {
  if (!(LEVELS as string[]).includes(level)) {
    throw badRequest('Level wilayah tidak valid', { level: [`Harus salah satu dari: ${LEVELS.join(', ')}`] });
  }
}

function assertChildParent(level: RegionLevel, parent: string | undefined, allowExact = false): void {
  if (level !== 'desa' && level !== 'sls' && level !== 'subsls') return;
  const expectedParent = level === 'desa' ? 'kec' : level === 'sls' ? 'desa' : 'sls';
  const parentLevel = parent ? levelOf(parent) : null;
  const isExactRegion = allowExact && parentLevel === level;
  if (!parent || (!isExactRegion && (parentLevel !== expectedParent || childLevelOf(expectedParent) !== level))) {
    throw badRequest(`Parameter parent level ${expectedParent} wajib diisi untuk level ${level}`, {
      parent: [`Harus berupa id wilayah level ${expectedParent}`],
    });
  }
}

/**
 * FeatureCollection GeoJSON per level + parent (on-demand — ARCHITECTURE §4.3).
 * FeatureCollection dibangun langsung oleh PostGIS; Node hanya meneruskan string.
 */
export async function getRegionsGeoJSON(level: string, parent: string | undefined, detail: 'low' | 'high'): Promise<string> {
  assertLevel(level);
  // Selain daftar anak, peta meminta satu polygon aktif dengan ID level yang sama.
  assertChildParent(level, parent, true);
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
  assertChildParent(level, parent);
  return prisma.region.findMany({
    where: { level, ...(parent ? { regionId: { startsWith: parent } } : {}) },
    select: { regionId: true, name: true },
    orderBy: { regionId: 'asc' },
  });
}

/**
 * Cari wilayah by nama / id, semua level, maks 20 hasil.
 * Nama dicari via full-text (memakai index GIN to_tsvector — DATABASE §2.2)
 * dengan prefix match per kata; id dicari via prefix (index varchar_pattern_ops).
 */
export async function searchRegions(q: string) {
  const query = q.trim();
  if (!query) return [];

  interface Row {
    regionId: string;
    level: string;
    name: string;
    bbox: unknown;
    parentId: string | null;
  }

  let rows: Row[];
  if (/^\d+$/.test(query)) {
    rows = await prisma.$queryRaw<Row[]>`
      SELECT region_id AS "regionId", level, name, bbox, parent_id AS "parentId"
      FROM regions WHERE region_id LIKE ${query + '%'}
      ORDER BY region_id LIMIT 20;
    `;
  } else {
    // "korong kas" → to_tsquery 'korong & kas:*' — tiap kata harus cocok, kata terakhir prefix
    const words = query
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean);
    if (words.length === 0) return [];
    const tsquery = words.map((w) => `${w}:*`).join(' & ');
    rows = await prisma.$queryRaw<Row[]>`
      SELECT region_id AS "regionId", level, name, bbox, parent_id AS "parentId"
      FROM regions
      WHERE to_tsvector('simple', name) @@ to_tsquery('simple', ${tsquery})
      ORDER BY region_id LIMIT 20;
    `;
  }

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

const STATS_COLUMN: Record<string, 'idkab' | 'idkec' | 'iddesa' | 'idsls' | 'idsubsls'> = {
  kab: 'idkab',
  kec: 'idkec',
  desa: 'iddesa',
  sls: 'idsls',
  subsls: 'idsubsls',
};

/**
 * Jumlah infrastruktur (approved) per wilayah pada satu level — untuk choropleth.
 * Memakai kolom id denormalisasi di infrastructures, tanpa join spasial.
 */
export async function getRegionStats(level: string, parent: string | undefined, categoryIds: string[]) {
  assertLevel(level);
  // Statistik memakai prefix ancestor (mis. kabupaten -> seluruh desa), bukan daftar polygon.
  const col = STATS_COLUMN[level]!;
  const where = {
    deletedAt: null,
    approvalStatus: 'approved',
    ...(categoryIds.length ? { categoryId: { in: categoryIds } } : {}),
    [col]: parent ? { startsWith: parent, not: null } : { not: null },
  };
  const grouped = await prisma.infrastructure.groupBy({
    by: [col],
    where,
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ region_id: g[col] as string | null, count: g._count._all }))
    .filter((g): g is { region_id: string; count: number } => !!g.region_id);
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
    where: { [col]: regionId, deletedAt: null, approvalStatus: 'approved' },
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
