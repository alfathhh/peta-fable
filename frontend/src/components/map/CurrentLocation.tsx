import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContainer';

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Dot biru lokasi GPS live (watchPosition, enableHighAccuracy) + lingkaran akurasi.
 * onChange dipakai form "+ Infrastruktur" untuk koordinat read-only.
 */
export function CurrentLocation({
  follow = false,
  onChange,
  onError,
}: {
  follow?: boolean;
  onChange?: (pos: GpsPosition | null) => void;
  onError?: (message: string) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const followedRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (!('geolocation' in navigator)) {
      onError?.('Browser tidak mendukung GPS');
      onChange?.(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        onChange?.({ lat, lng, accuracy });
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], {
            icon: L.divIcon({ className: '', html: '<div class="gps-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
            interactive: false,
          }).addTo(map);
          circleRef.current = L.circle([lat, lng], {
            radius: accuracy,
            color: '#2563eb',
            weight: 1,
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            interactive: false,
          }).addTo(map);
        } else {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current?.setLatLng([lat, lng]).setRadius(accuracy);
        }
        if (follow && !followedRef.current) {
          followedRef.current = true;
          map.setView([lat, lng], Math.max(map.getZoom(), 16));
        }
      },
      (err) => {
        onChange?.(null);
        onError?.(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser lalu muat ulang.'
            : 'Gagal mendapatkan lokasi GPS',
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [map, follow, onChange, onError]);

  return null;
}
