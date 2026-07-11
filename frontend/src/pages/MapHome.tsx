import { useEffect, useState } from 'react';
import { Layers, LocateFixed, SlidersHorizontal, X } from 'lucide-react';
import { MapContainer } from '../components/map/MapContainer';
import { RegionLayer } from '../components/map/RegionLayer';
import { InfraMarkers } from '../components/map/InfraMarkers';
import { CurrentLocation } from '../components/map/CurrentLocation';
import { RegionCascade } from '../components/filters/RegionCascade';
import { SearchBox } from '../components/filters/SearchBox';
import { CategoryFilter } from '../components/filters/CategoryFilter';
import { availableBasemaps, BASEMAPS, type BasemapKey } from '../config/basemaps';
import { useMapStore } from '../stores/mapStore';
import { regionApi } from '../api/resources';
import { getCategoryIcon } from '../config/categoryIcons';
import { toast } from '../stores/toastStore';
import type { RegionDetail } from '../types';

function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-white p-2.5 shadow-md hover:bg-gray-50"
      title="Lokasi saya"
    >
      <LocateFixed className="h-5 w-5 text-blue-600" />
    </button>
  );
}

/** Panel info wilayah aktif: nama, id, statistik infra per kategori (PRD §5.11). */
function RegionInfoPanel() {
  const activeRegion = useMapStore((s) => s.activeRegion);
  const setActiveRegion = useMapStore((s) => s.setActiveRegion);
  const [detail, setDetail] = useState<RegionDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!activeRegion) return;
    const regionId = activeRegion.region_id;
    let active = true;
    regionApi.detail(regionId).then((data) => {
      if (active && data.region_id === regionId) setDetail(data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [activeRegion]);

  if (!activeRegion) return null;
  return (
    <div className="pointer-events-auto rounded-xl bg-white p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{activeRegion.name}</p>
          <p className="text-xs text-gray-500">
            {activeRegion.region_id} · {activeRegion.level.toUpperCase()}
          </p>
        </div>
        <button onClick={() => setActiveRegion(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Hapus wilayah aktif">
          <X className="h-4 w-4" />
        </button>
      </div>
      {detail && detail.infrastructure_stats.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2">
          {detail.infrastructure_stats.map((s) => {
            const Icon = getCategoryIcon(s.icon);
            return (
              <li key={s.category_id} className="flex items-center gap-2 text-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: s.color }}>
                  <Icon className="h-3 w-3" />
                </span>
                <span className="flex-1">{s.name}</span>
                <span className="font-semibold">{s.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Legenda choropleth (buckets diisi RegionLayer). */
function ChoroplethLegend() {
  const buckets = useMapStore((s) => s.choroplethBuckets);
  if (!buckets) return null;
  return (
    <div className="pointer-events-auto rounded-xl bg-white p-3 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-gray-600">Jumlah infrastruktur</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2 text-xs">
          <span className="h-3.5 w-5 rounded-sm border border-gray-300" style={{ background: '#f3f4f6' }} />0
        </li>
        {buckets.map((b) => (
          <li key={b.from} className="flex items-center gap-2 text-xs">
            <span className="h-3.5 w-5 rounded-sm border border-gray-300" style={{ background: b.color }} />
            {b.from === b.to ? b.from : `${b.from}–${b.to}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MapHome() {
  const [basemap, setBasemap] = useState<BasemapKey>('street');
  const [panelOpen, setPanelOpen] = useState(false);
  const [locate, setLocate] = useState(false);
  const setActiveRegion = useMapStore((s) => s.setActiveRegion);
  const choropleth = useMapStore((s) => s.choropleth);
  const setChoropleth = useMapStore((s) => s.setChoropleth);

  return (
    <div className="relative h-full">
      <MapContainer basemap={basemap}>
        <RegionLayer />
        <InfraMarkers />
        {locate && <CurrentLocation follow onError={(m) => toast.warning(m)} />}
      </MapContainer>

      {/* kontrol kanan-atas */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
          {availableBasemaps().map((key) => (
            <button
              key={key}
              onClick={() => setBasemap(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
                basemap === key ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> {BASEMAPS[key].label}
            </button>
          ))}
        </div>
        <LocateButton onClick={() => setLocate((v) => !v)} />
      </div>

      {/* tombol filter (mobile bottom-sheet, desktop panel kiri) */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium shadow-md hover:bg-gray-50"
      >
        <SlidersHorizontal className="h-4 w-4 text-blue-600" /> Filter
      </button>

      {panelOpen && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-x-auto sm:left-3 sm:top-16 sm:bottom-auto sm:w-80 sm:rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filter Peta</h2>
            <button onClick={() => setPanelOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4">
            <SearchBox />
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Wilayah</h3>
              <RegionCascade
                onChange={(sel) => {
                  if (!sel) {
                    setActiveRegion(null);
                    return;
                  }
                  regionApi
                    .detail(sel.region_id)
                    .then((d) =>
                      setActiveRegion({
                        region_id: sel.region_id,
                        level: sel.level,
                        name: d.name,
                        bbox: d.bbox,
                      }),
                    )
                    .catch(() => {});
                }}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Infrastruktur</h3>
              <CategoryFilter />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Tematik</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={choropleth} onChange={(e) => setChoropleth(e.target.checked)} className="h-4 w-4" />
                Pewarnaan jumlah infrastruktur (choropleth)
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Mewarnai wilayah berdasarkan jumlah infrastruktur ter-ACC; ikut filter kategori bila dicentang.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* panel info wilayah aktif + legenda choropleth */}
      <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] flex w-72 max-w-[calc(100vw-6rem)] flex-col gap-2">
        <ChoroplethLegend />
        <RegionInfoPanel />
      </div>
    </div>
  );
}
