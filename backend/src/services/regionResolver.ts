import { prisma } from '../lib/prisma';
import { parentIdsOf, type RegionLevel } from '../lib/regionId';

export interface ResolvedRegion {
  idkab: string | null;
  idkec: string | null;
  iddesa: string | null;
  idsls: string | null;
  idsubsls: string | null;
  deepestId: string | null;
}

const EMPTY: ResolvedRegion = { idkab: null, idkec: null, iddesa: null, idsls: null, idsubsls: null, deepestId: null };

/**
 * Point-in-polygon: cari wilayah terdalam yang memuat titik, lalu turunkan
 * semua id level di atasnya lewat prefix (ARCHITECTURE §4.4).
 * ST_MakePoint(lng, lat) — longitude dulu!
 */
export async function resolveRegionFromPoint(lat: number, lng: number): Promise<ResolvedRegion> {
  const levels: RegionLevel[] = ['subsls', 'sls', 'desa', 'kec', 'kab'];
  for (const level of levels) {
    const rows = await prisma.$queryRaw<{ region_id: string }[]>`
      SELECT region_id FROM regions
      WHERE level = ${level}
        AND geom IS NOT NULL
        AND ST_Contains(geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      LIMIT 1;
    `;
    const found = rows[0]?.region_id;
    if (found) {
      const ids = parentIdsOf(found);
      return {
        idkab: ids.kab ?? null,
        idkec: ids.kec ?? null,
        iddesa: ids.desa ?? null,
        idsls: ids.sls ?? null,
        idsubsls: ids.subsls ?? null,
        deepestId: found,
      };
    }
  }
  return EMPTY;
}

/**
 * true bila titik di luar wilayah proyek (keputusan PO #3):
 * `!resolvedId.startsWith(project.region_id)` — juga true bila titik
 * tidak ter-resolve sama sekali (di luar kabupaten).
 */
export function isOutsideRegion(resolved: ResolvedRegion, projectRegionId: string): boolean {
  return !resolved.deepestId?.startsWith(projectRegionId);
}
