import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContainer';
import { regionApi } from '../../api/resources';
import { useMapStore } from '../../stores/mapStore';
import { childLevelOf, levelOf, type RegionLevel } from '../../utils/regionId';
import { toast } from '../../stores/toastStore';

const BASE_STYLE: L.PathOptions = { color: '#1d4ed8', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.06 };
const ACTIVE_STYLE: L.PathOptions = { color: '#b91c1c', weight: 3, fillColor: '#ef4444', fillOpacity: 0.08 };

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
  const layersRef = useRef<L.GeoJSON[]>([]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    // cleanup layer lama SEBELUM fetch baru
    for (const layer of layersRef.current) layer.remove();
    layersRef.current = [];

    const zoom = map.getZoom();
    const detail: 'low' | 'high' = zoom >= 14 ? 'high' : 'low';

    async function render() {
      try {
        if (!activeRegion) {
          const fc = await regionApi.geojson('kab', undefined, 'low');
          if (cancelled || !map) return;
          const layer = L.geoJSON(fc, { style: BASE_STYLE, interactive: false }).addTo(map);
          layersRef.current.push(layer);
          return;
        }

        // outline wilayah aktif
        const activeFc = await regionApi.geojson(activeRegion.level, activeRegion.region_id, detail);
        if (cancelled || !map) return;
        const activeLayer = L.geoJSON(activeFc, { style: ACTIVE_STYLE, interactive: false }).addTo(map);
        layersRef.current.push(activeLayer);

        // anak-anak wilayah aktif (klik → jadi wilayah aktif baru)
        const childLevel = childLevelOf(activeRegion.level);
        if (childLevel) {
          const childFc = await regionApi.geojson(childLevel, activeRegion.region_id, detail);
          if (cancelled || !map) return;
          const childLayer = L.geoJSON(childFc, {
            style: BASE_STYLE,
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
              layer.bindTooltip(props.name, { sticky: true });
              layer.on('mouseover', () => (layer as L.Path).setStyle({ fillOpacity: 0.25 }));
              layer.on('mouseout', () => (layer as L.Path).setStyle(BASE_STYLE));
            },
          }).addTo(map);
          layersRef.current.push(childLayer);
        }
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
  }, [map, activeRegion, onSelect, setActiveRegion]);

  // zoom ke bbox wilayah aktif saat berubah
  useEffect(() => {
    if (!map || !activeRegion?.bbox) return;
    const [minLng, minLat, maxLng, maxLat] = activeRegion.bbox;
    map.fitBounds(L.latLngBounds([minLat, minLng], [maxLat, maxLng]), { padding: [24, 24] });
  }, [map, activeRegion]);

  return null;
}

export type { RegionLevel };
