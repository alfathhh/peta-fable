import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useMap } from './MapContainer';
import { useMapStore } from '../../stores/mapStore';
import { infraApi } from '../../api/resources';
import { categoryMarkerIcon } from './markerIcon';
import { getCategoryIcon } from '../../config/categoryIcons';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { toast } from '../../stores/toastStore';
import type { InfraMarkerData } from '../../types';

function popupHtml(detailName: string, category: InfraMarkerData['category']): HTMLElement {
  // dibangun via DOM + textContent (bukan innerHTML string dari data user)
  const wrap = document.createElement('div');
  wrap.className = 'text-sm min-w-[180px]';
  const catRow = document.createElement('div');
  catRow.className = 'flex items-center gap-1.5 text-xs font-medium';
  catRow.style.color = category.color;
  catRow.innerHTML = renderToStaticMarkup(createElement(getCategoryIcon(category.icon), { size: 14 }));
  const catName = document.createElement('span');
  catName.textContent = category.name;
  catRow.appendChild(catName);
  const title = document.createElement('div');
  title.className = 'font-semibold mt-0.5';
  title.textContent = detailName;
  const loading = document.createElement('div');
  loading.className = 'text-xs text-gray-500 mt-1';
  loading.textContent = 'Memuat detail...';
  loading.dataset.slot = 'detail';
  wrap.append(catRow, title, loading);
  return wrap;
}

async function fillPopupDetail(el: HTMLElement, infraId: string) {
  try {
    const d = await infraApi.detail(infraId);
    const slot = el.querySelector('[data-slot="detail"]');
    if (!slot) return;
    const box = document.createElement('div');
    box.className = 'mt-1 space-y-1';
    if (d.photo_url) {
      const img = document.createElement('img');
      img.src = d.photo_url;
      img.alt = d.name;
      img.className = 'rounded max-h-36 w-full object-cover';
      box.appendChild(img);
    }
    if (d.description) {
      const p = document.createElement('p');
      p.className = 'text-xs text-gray-600';
      p.textContent = d.description;
      box.appendChild(p);
    }
    const regionNames = ['subsls', 'sls', 'desa', 'kec'].map((l) => d.region_names[l]).filter(Boolean);
    if (regionNames.length) {
      const p = document.createElement('p');
      p.className = 'text-xs text-gray-500';
      p.textContent = regionNames.join(', ');
      box.appendChild(p);
    }
    if (d.isOutsideRegion) {
      const p = document.createElement('p');
      p.className = 'text-xs font-medium text-amber-600';
      p.textContent = '⚠ Di luar wilayah proyek';
      box.appendChild(p);
    }
    const a = document.createElement('a');
    a.href = d.gmaps_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'inline-block text-xs font-medium text-blue-600 hover:underline';
    a.textContent = 'Buka di Google Maps ↗';
    box.appendChild(a);
    slot.replaceWith(box);
  } catch {
    /* biarkan */
  }
}

/**
 * Marker infrastruktur — HANYA muncul bila ada filter kategori / pencarian
 * (aturan domain #3), selalu dibatasi wilayah aktif. Cluster bila > 50 pin.
 */
export function InfraMarkers() {
  const map = useMap();
  const { activeRegion, categoryFilter, infraSearch } = useMapStore();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    groupRef.current?.remove();
    groupRef.current = null;

    const hasFilter = categoryFilter.length > 0 || infraSearch.trim().length > 0;
    if (!hasFilter) return; // aturan: tanpa filter, tidak ada pin

    async function render() {
      try {
        // satu request — backend menerima category_id berbentuk daftar dipisah koma
        const results = await infraApi.list({
          category_id: categoryFilter.length ? categoryFilter.join(',') : undefined,
          q: infraSearch.trim() || undefined,
          region_id: activeRegion?.region_id,
        });
        if (cancelled || !map) return;

        const markers = results.map((infra) => {
          const marker = L.marker([infra.lat, infra.lng], {
            icon: categoryMarkerIcon(infra.category.icon, infra.category.color),
          });
          const el = popupHtml(infra.name, infra.category);
          marker.bindPopup(el, { maxWidth: 260 });
          marker.on('popupopen', () => void fillPopupDetail(el, infra.id));
          return marker;
        });

        const group: L.LayerGroup =
          markers.length > 50 ? L.markerClusterGroup({ maxClusterRadius: 50 }) : L.layerGroup();
        for (const m of markers) group.addLayer(m);
        group.addTo(map);
        groupRef.current = group;
      } catch {
        if (!cancelled) toast.error('Gagal memuat infrastruktur');
      }
    }

    void render();
    return () => {
      cancelled = true;
      groupRef.current?.remove();
      groupRef.current = null;
    };
  }, [map, activeRegion, categoryFilter, infraSearch]);

  return null;
}
