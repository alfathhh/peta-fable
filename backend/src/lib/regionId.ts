// Helper id wilayah BPS — id SELALU string; panjang menentukan level.
// Logika ini identik dengan frontend/src/utils/regionId.ts. Jangan tulis ulang di tempat lain.

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

export function levelOf(id: string): RegionLevel | null {
  return LENGTH_TO_LEVEL[id.length] ?? null;
}

export function parentOf(id: string): string | null {
  const level = levelOf(id);
  if (!level || level === 'kab') return null;
  const idx = LEVELS.indexOf(level);
  const parentLevel = LEVELS[idx - 1]!;
  return id.slice(0, LEVEL_TO_LENGTH[parentLevel]);
}

export function isChildOf(child: string, parent: string): boolean {
  return child !== parent && child.startsWith(parent);
}

/** Dari id subsls/sls/desa, kembalikan semua id level di atasnya (termasuk dirinya). */
export function parentIdsOf(id: string): Partial<Record<RegionLevel, string>> {
  const result: Partial<Record<RegionLevel, string>> = {};
  for (const level of LEVELS) {
    const len = LEVEL_TO_LENGTH[level];
    if (id.length >= len) result[level] = id.slice(0, len);
  }
  return result;
}

export function childLevelOf(level: RegionLevel): RegionLevel | null {
  const idx = LEVELS.indexOf(level);
  return LEVELS[idx + 1] ?? null;
}
