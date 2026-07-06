import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BASEMAPS } from '../../config/basemaps';

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="infra-marker" style="background:#2563eb;width:26px;height:26px"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/**
 * Minimap untuk menggeser koordinat: drag pin atau klik peta untuk memindahkan
 * titik. Dipakai form infrastruktur (petugas & admin).
 */
export function MiniMapPicker({
  lat,
  lng,
  onChange,
  className = 'h-52 w-full',
}: {
  lat: number;
  lng: number;
  onChange: (pos: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true });
    L.tileLayer(BASEMAPS.street.url, { attribution: BASEMAPS.street.attribution, maxZoom: 20 }).addTo(map);
    map.setView([lat, lng], 17);

    const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current({ lat: p.lat, lng: p.lng });
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // peta dibuat sekali; posisi berikutnya lewat effect di bawah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sinkron dari luar (mis. GPS masih update sebelum digeser manual)
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-300 ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
