// frontend/src/config/basemaps.ts — SATU-SATUNYA tempat URL basemap boleh ditulis
// (keputusan PO, DECISIONS.md #4 — lihat catatan risiko di ARCHITECTURE.md §3)
export const BASEMAPS = {
  street: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google',
    label: 'Street',
  },
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // y = satelit + label (hybrid)
    attribution: '&copy; Google',
    label: 'Hybrid',
  },
  // FALLBACK — aktifkan via VITE_BASEMAP_FALLBACK=1 bila endpoint Google bermasalah
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    label: 'OSM',
  },
  esriImagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Citra Esri',
  },
} as const;

export type BasemapKey = keyof typeof BASEMAPS;

export const FALLBACK_ENABLED = import.meta.env.VITE_BASEMAP_FALLBACK === '1';

/** Daftar basemap yang boleh dipilih user sesuai env. */
export function availableBasemaps(): BasemapKey[] {
  return FALLBACK_ENABLED
    ? ['street', 'hybrid', 'osm', 'esriImagery']
    : ['street', 'hybrid'];
}
