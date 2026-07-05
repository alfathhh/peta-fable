import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import { BASEMAPS, availableBasemaps, type BasemapKey } from '../../config/basemaps';

// Bounding box Kabupaten Padang Pariaman — view awal peta.
export const KAB_BOUNDS = L.latLngBounds([-0.85, 99.95], [-0.35, 100.5]);

const MapContext = createContext<L.Map | null>(null);

export function useMap(): L.Map | null {
  return useContext(MapContext);
}

/**
 * Wrapper Leaflet murni: buat map sekali di ref, sediakan instance ke children
 * lewat context. Basemap dikelola di sini (satu tile layer aktif).
 */
export function MapContainer({
  children,
  basemap,
  className = 'h-full w-full',
}: {
  children?: ReactNode;
  basemap: BasemapKey;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const m = L.map(containerRef.current, { zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.fitBounds(KAB_BOUNDS);
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const key = availableBasemaps().includes(basemap) ? basemap : 'street';
    const config = BASEMAPS[key];
    if (tileRef.current) tileRef.current.remove();
    tileRef.current = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: 20 }).addTo(map);
  }, [map, basemap]);

  return (
    <div ref={containerRef} className={className}>
      {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
    </div>
  );
}
