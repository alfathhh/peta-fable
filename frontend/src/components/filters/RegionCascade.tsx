import { useEffect, useState } from 'react';
import { Select } from '../ui';
import { regionApi } from '../../api/resources';
import { LEVEL_LABELS, LEVELS, type RegionLevel } from '../../utils/regionId';
import type { RegionOption } from '../../types';

const CASCADE_LEVELS: RegionLevel[] = ['kec', 'desa', 'sls', 'subsls'];

/**
 * Dropdown berjenjang Kec → Desa → SLS → Sub-SLS (opsi via /regions/options,
 * difilter prefix parent). onChange menerima pilihan terdalam.
 */
export function RegionCascade({
  onChange,
  minLevel,
}: {
  onChange: (selection: { region_id: string; level: RegionLevel; name: string } | null) => void;
  /** untuk form proyek: level minimal yang dianggap valid (mis. 'desa') */
  minLevel?: RegionLevel;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, RegionOption[]>>({});

  useEffect(() => {
    regionApi.options('kec', '1306').then((opts) => setOptions((o) => ({ ...o, kec: opts }))).catch(() => {});
  }, []);

  async function handleSelect(level: RegionLevel, regionId: string) {
    const idx = CASCADE_LEVELS.indexOf(level);
    const cleared: Record<string, string> = {};
    for (let i = 0; i < idx; i++) cleared[CASCADE_LEVELS[i]] = selected[CASCADE_LEVELS[i]] ?? '';
    if (regionId) cleared[level] = regionId;
    setSelected(cleared);

    // muat opsi level berikutnya
    const next = CASCADE_LEVELS[idx + 1];
    if (regionId && next) {
      try {
        const opts = await regionApi.options(next, regionId);
        setOptions((o) => ({ ...o, [next]: opts }));
      } catch {
        /* abaikan */
      }
    }

    // laporkan pilihan terdalam
    const deepest = regionId
      ? { level, region_id: regionId }
      : idx > 0
        ? { level: CASCADE_LEVELS[idx - 1], region_id: cleared[CASCADE_LEVELS[idx - 1]] ?? '' }
        : null;
    if (!deepest?.region_id) {
      onChange(null);
      return;
    }
    if (minLevel && LEVELS.indexOf(deepest.level) < LEVELS.indexOf(minLevel)) {
      onChange(null);
      return;
    }
    const name =
      options[deepest.level]?.find((o) => o.region_id === deepest.region_id)?.name ?? deepest.region_id;
    onChange({ region_id: deepest.region_id, level: deepest.level, name });
  }

  return (
    <div className="space-y-2">
      {CASCADE_LEVELS.map((level, idx) => {
        const parentSelected = idx === 0 || !!selected[CASCADE_LEVELS[idx - 1]];
        return (
          <Select
            key={level}
            label={LEVEL_LABELS[level]}
            value={selected[level] ?? ''}
            disabled={!parentSelected}
            onChange={(e) => void handleSelect(level, e.target.value)}
          >
            <option value="">— Semua {LEVEL_LABELS[level]} —</option>
            {(options[level] ?? []).map((o) => (
              <option key={o.region_id} value={o.region_id}>
                {o.name} ({o.region_id})
              </option>
            ))}
          </Select>
        );
      })}
    </div>
  );
}
