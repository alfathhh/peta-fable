import L from 'leaflet';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCategoryIcon } from '../../config/categoryIcons';

// Marker infrastruktur = Leaflet divIcon berisi SVG lucide + warna kategori
// (aturan domain #10). Jangan pakai L.Icon.Default (masalah path asset).
export function categoryMarkerIcon(iconName: string, color: string): L.DivIcon {
  const Icon = getCategoryIcon(iconName);
  const svg = renderToStaticMarkup(createElement(Icon, { size: 16, color: '#ffffff', strokeWidth: 2.2 }));
  return L.divIcon({
    className: '',
    html: `<div class="infra-marker" style="background:${color};width:30px;height:30px">${svg}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}
