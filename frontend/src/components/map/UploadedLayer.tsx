import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from './MapContainer';
import { layerApi } from '../../api/resources';
import type { ProjectLayer } from '../../types';

function styleFor(layer: ProjectLayer): L.PathOptions {
  const s = layer.style;
  return {
    color: s.strokeColor,
    weight: s.strokeWidth,
    fillColor: s.fillColor,
    fillOpacity: s.mode === 'fill' ? s.fillOpacity : 0,
    fill: s.mode === 'fill',
  };
}

/** Render satu layer upload proyek + label atribut (Tooltip permanen, textContent). */
export function UploadedLayer({ layer }: { layer: ProjectLayer }) {
  const map = useMap();
  const leafletRef = useRef<L.GeoJSON | null>(null);
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    layerApi
      .geojson(layer.id)
      .then((fc) => {
        if (!cancelled) setData(fc);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [layer.id]);

  useEffect(() => {
    if (!map || !data) return;
    leafletRef.current?.remove();
    if (!layer.isVisible) return;

    const labelCfg = layer.style.label;
    const geo = L.geoJSON(data, {
      style: () => styleFor(layer),
      onEachFeature: (feature, lyr) => {
        if (labelCfg?.field) {
          const raw = (feature.properties as Record<string, unknown> | null)?.[labelCfg.field];
          if (raw !== undefined && raw !== null && String(raw) !== '') {
            const span = document.createElement('span');
            span.textContent = String(raw).slice(0, 80); // textContent — bukan innerHTML
            span.style.fontSize = `${labelCfg.fontSize}px`;
            span.style.color = labelCfg.fontColor;
            lyr.bindTooltip(span, { permanent: true, direction: 'center', className: 'layer-label' });
          }
        }
      },
    }).addTo(map);
    leafletRef.current = geo;

    return () => {
      geo.remove();
      leafletRef.current = null;
    };
  }, [map, data, layer]);

  return null;
}
