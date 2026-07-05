import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { regionApi } from '../../api/resources';
import { useMapStore } from '../../stores/mapStore';
import { levelOf } from '../../utils/regionId';
import type { RegionSearchResult } from '../../types';

/** Search wilayah: ketik → hasil → klik → zoom bbox + set wilayah aktif. */
export function SearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<RegionSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const setActiveRegion = useMapStore((s) => s.setActiveRegion);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      regionApi
        .search(q.trim())
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  function pick(r: RegionSearchResult) {
    const level = levelOf(r.region_id);
    if (!level) return;
    setActiveRegion({ region_id: r.region_id, level, name: r.name, bbox: r.bbox });
    setOpen(false);
    setQ(r.name);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Cari wilayah (nama / kode)..."
          className="w-full py-2.5 text-sm focus:outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((r) => (
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
        </ul>
      )}
    </div>
  );
}
