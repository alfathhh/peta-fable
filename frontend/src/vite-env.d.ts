/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASEMAP_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'shpjs' {
  type ShpOutput =
    | GeoJSON.FeatureCollection
    | (GeoJSON.FeatureCollection & { fileName?: string })[];
  function shp(input: ArrayBuffer | string): Promise<ShpOutput>;
  export default shp;
}
