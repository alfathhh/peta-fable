import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { infraApi, regionApi } from '../../api/resources';
import { useMapStore } from '../../stores/mapStore';
import { levelOf } from '../../utils/regionId';
import type { InfraMarkerData, RegionSearchResult } from '../../types';

/** Search gabungan wilayah dan infrastruktur approved dalam wilayah aktif. */
export function SearchBox() {
  const [q, setQ] = useState('');
  const [regions, setRegions] = useState<RegionSearchResult[]>([]);
  const [infrastructures, setInfrastructures] = useState<InfraMarkerData[]>([]);
  const [open, setOpen] = useState(false);
  const activeRegion = useMapStore((s) => s.activeRegion);
  const setActiveRegion = useMapStore((s) => s.setActiveRegion);
  const setInfraSearch = useMapStore((s) => s.setInfraSearch);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const requestId = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const id = ++requestId.current;
    if (q.trim().length < 2) {
      setRegions([]);
      setInfrastructures([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      const query = q.trim();
      Promise.all([
        regionApi.search(query).catch(() => []),
        activeRegion
          ? infraApi.list({ q: query, region_id: activeRegion.region_id }).catch(() => [])
          : Promise.resolve([]),
      ]).then(([regionResults, infrastructureResults]) => {
          if (id !== requestId.current) return;
          setRegions(regionResults);
          setInfrastructures(infrastructureResults);
          setOpen(true);
        });
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q, activeRegion]);

  function pick(r: RegionSearchResult) {
    const level = levelOf(r.region_id);
    if (!level) return;
    setActiveRegion({ region_id: r.region_id, level, name: r.name, bbox: r.bbox });
    setOpen(false);
    setQ(r.name);
  }

  function pickInfrastructure(infra: InfraMarkerData) {
    setInfraSearch(infra.name);
    setOpen(false);
    setQ(infra.name);
  }

  const hasResults = regions.length > 0 || infrastructures.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hasResults && setOpen(true)}
          placeholder="Cari wilayah atau infrastruktur..."
          className="w-full py-2.5 text-sm focus:outline-none"
        />
      </div>
      {open && (
        <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {regions.length > 0 && <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-gray-400">Wilayah</li>}
          {regions.map((r) => (
            <li key={r.region_id}>
              <button
                onClick={() => pick(r)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-1 text-xs uppercase text-gray-400">{r.level}</span>
                <div className="text-xs text-gray-500">{r.path_name}</div>
              </button>
            </li>
          ))}
          {infrastructures.length > 0 && (
            <li className="border-t px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-gray-400">Infrastruktur</li>
          )}
          {infrastructures.map((infra) => (
            <li key={infra.id}>
              <button
                onClick={() => pickInfrastructure(infra)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: infra.category.color }} />
                <span>
                  <span className="block font-medium">{infra.name}</span>
                  <span className="block text-xs text-gray-500">{infra.category.name}</span>
                </span>
              </button>
            </li>
          ))}
          {!hasResults && (
            <li className="px-3 py-3 text-xs text-gray-500">
              {activeRegion ? 'Wilayah atau infrastruktur tidak ditemukan.' : 'Wilayah tidak ditemukan. Pilih wilayah untuk mencari infrastruktur.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
