import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContainer';
import { regionApi } from '../../api/resources';
import { useMapStore } from '../../stores/mapStore';
import { childLevelOf, levelOf, type RegionLevel } from '../../utils/regionId';
import { toast } from '../../stores/toastStore';

const BASE_STYLE: L.PathOptions = { color: '#1d4ed8', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.06 };
const ACTIVE_STYLE: L.PathOptions = { color: '#b91c1c', weight: 3, fillColor: '#ef4444', fillOpacity: 0.08 };

// Skala warna choropleth (terang → gelap) + pembagi bucket sederhana per kuantil max
const CHORO_COLORS = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'];

function buildBuckets(max: number): { from: number; to: number; color: string }[] {
  const step = Math.max(1, Math.ceil(max / CHORO_COLORS.length));
  return CHORO_COLORS.map((color, i) => ({ from: i * step + 1, to: (i + 1) * step, color }));
}

function colorFor(count: number, buckets: { from: number; to: number; color: string }[]): string {
  for (const b of buckets) if (count <= b.to) return b.color;
  return buckets[buckets.length - 1]!.color;
}

/**
 * Layer wilayah on-demand (PRD §5.2):
 * - tanpa wilayah aktif → outline kabupaten saja
 * - ada wilayah aktif → outline wilayah aktif + anak-anaknya
 * Layer lama SELALU dibuang sebelum render baru (hindari memory leak).
 */
export function RegionLayer({ onSelect }: { onSelect?: (regionId: string, name: string) => void }) {
  const map = useMap();
  const activeRegion = useMapStore((s) => s.activeRegion);
  const setActiveRegion = useMapStore((s) => s.setActiveRegion);
  const choropleth = useMapStore((s) => s.choropleth);
  const categoryFilter = useMapStore((s) => s.categoryFilter);
  const setChoroplethBuckets = useMapStore((s) => s.setChoroplethBuckets);
  const layersRef = useRef<L.GeoJSON[]>([]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    // cleanup layer lama SEBELUM fetch baru
    for (const layer of layersRef.current) layer.remove();
    layersRef.current = [];

    const zoom = map.getZoom();
    const detail: 'low' | 'high' = zoom >= 14 ? 'high' : 'low';

    // parent & level anak yang dirender: tanpa wilayah aktif = kecamatan se-kabupaten
    const parentId = activeRegion?.region_id ?? '1306';
    const childLevel = activeRegion ? childLevelOf(activeRegion.level) : 'kec';

    async function render() {
      try {
        if (!activeRegion) {
          const fc = await regionApi.geojson('kab', undefined, 'low');
          if (cancelled || !map) return;
          const layer = L.geoJSON(fc, { style: BASE_STYLE, interactive: false }).addTo(map);
          layersRef.current.push(layer);
          if (!choropleth) return; // default: outline kabupaten saja (hemat — PRD §5.2)
        } else {
          // outline wilayah aktif
          const activeFc = await regionApi.geojson(activeRegion.level, activeRegion.region_id, detail);
          if (cancelled || !map) return;
          const activeLayer = L.geoJSON(activeFc, { style: ACTIVE_STYLE, interactive: false }).addTo(map);
          layersRef.current.push(activeLayer);
        }

        // anak-anak wilayah (klik → jadi wilayah aktif baru); choropleth mewarnai fill-nya
        if (!childLevel) {
          setChoroplethBuckets(null);
          return;
        }

        let countById = new Map<string, number>();
        let buckets: { from: number; to: number; color: string }[] = [];
        if (choropleth) {
          const stats = await regionApi.stats(childLevel, parentId, categoryFilter);
          if (cancelled) return;
          countById = new Map(stats.map((s) => [s.region_id, s.count]));
          const max = Math.max(0, ...stats.map((s) => s.count));
          buckets = max > 0 ? buildBuckets(max) : [];
          setChoroplethBuckets(buckets.length ? buckets : null);
        } else {
          setChoroplethBuckets(null);
        }

        const styleFor = (regionId: string): L.PathOptions => {
          if (!choropleth || buckets.length === 0) return BASE_STYLE;
          const count = countById.get(regionId) ?? 0;
          return count === 0
            ? { ...BASE_STYLE, fillColor: '#f3f4f6', fillOpacity: 0.4 }
            : { ...BASE_STYLE, fillColor: colorFor(count, buckets), fillOpacity: 0.65 };
        };

        const childFc = await regionApi.geojson(childLevel, parentId, detail);
        if (cancelled || !map) return;
        const childLayer = L.geoJSON(childFc, {
          style: (feature) => styleFor((feature?.properties as { region_id: string }).region_id),
          onEachFeature: (feature, layer) => {
            const props = feature.properties as { region_id: string; name: string };
            layer.on('click', () => {
              onSelect?.(props.region_id, props.name);
              const level = levelOf(props.region_id);
              if (level) {
                const bounds = (layer as L.Polygon).getBounds();
                setActiveRegion({
                  region_id: props.region_id,
                  level,
                  name: props.name,
                  bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
                });
              }
            });
            const count = countById.get(props.region_id);
            layer.bindTooltip(choropleth && count !== undefined ? `${props.name} — ${count} infrastruktur` : props.name, {
              sticky: true,
            });
            layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 3 }));
            layer.on('mouseout', () => (layer as L.Path).setStyle(styleFor(props.region_id)));
          },
        }).addTo(map);
        layersRef.current.push(childLayer);
      } catch {
        if (!cancelled) toast.error('Gagal memuat batas wilayah');
      }
    }

    void render();
    return () => {
      cancelled = true;
      for (const layer of layersRef.current) layer.remove();
      layersRef.current = [];
    };
  }, [map, activeRegion, onSelect, setActiveRegion, choropleth, categoryFilter, setChoroplethBuckets]);

  // zoom ke bbox wilayah aktif saat berubah
  useEffect(() => {
    if (!map || !activeRegion?.bbox) return;
    const [minLng, minLat, maxLng, maxLat] = activeRegion.bbox;
    map.fitBounds(L.latLngBounds([minLat, minLng], [maxLat, maxLng]), { padding: [24, 24] });
  }, [map, activeRegion]);

  return null;
}

export type { RegionLevel };
