// Helper id wilayah BPS — id SELALU string; panjang menentukan level.
// Logika identik dengan backend/src/lib/regionId.ts.

export type RegionLevel = 'kab' | 'kec' | 'desa' | 'sls' | 'subsls';

const LENGTH_TO_LEVEL: Record<number, RegionLevel> = {
  4: 'kab',
  7: 'kec',
  10: 'desa',
  14: 'sls',
  16: 'subsls',
};

export const LEVEL_TO_LENGTH: Record<RegionLevel, number> = {
  kab: 4,
  kec: 7,
  desa: 10,
  sls: 14,
  subsls: 16,
};

export const LEVELS: RegionLevel[] = ['kab', 'kec', 'desa', 'sls', 'subsls'];

export const LEVEL_LABELS: Record<RegionLevel, string> = {
  kab: 'Kabupaten',
  kec: 'Kecamatan',
  desa: 'Desa/Nagari',
  sls: 'SLS/Korong',
  subsls: 'Sub-SLS',
};

export function levelOf(id: string): RegionLevel | null {
  return LENGTH_TO_LEVEL[id.length] ?? null;
}

export function parentOf(id: string): string | null {
  const level = levelOf(id);
  if (!level || level === 'kab') return null;
  const idx = LEVELS.indexOf(level);
  return id.slice(0, LEVEL_TO_LENGTH[LEVELS[idx - 1]]);
}

export function isChildOf(child: string, parent: string): boolean {
  return child !== parent && child.startsWith(parent);
}

export function childLevelOf(level: RegionLevel): RegionLevel | null {
  const idx = LEVELS.indexOf(level);
  return LEVELS[idx + 1] ?? null;
}
