import { create } from 'zustand';
import type { RegionLevel } from '../utils/regionId';

export interface ActiveRegion {
  region_id: string;
  level: RegionLevel;
  name: string;
  bbox: [number, number, number, number] | null;
}

export interface ChoroplethBucket {
  from: number;
  to: number;
  color: string;
}

interface MapState {
  activeRegion: ActiveRegion | null;
  categoryFilter: string[]; // id kategori yang dicentang
  infraSearch: string;
  choropleth: boolean; // pewarnaan poligon berdasarkan jumlah infrastruktur
  choroplethBuckets: ChoroplethBucket[] | null; // diisi RegionLayer untuk legenda
  setActiveRegion: (region: ActiveRegion | null) => void;
  setCategoryFilter: (ids: string[]) => void;
  toggleCategory: (id: string) => void;
  setInfraSearch: (q: string) => void;
  setChoropleth: (on: boolean) => void;
  setChoroplethBuckets: (buckets: ChoroplethBucket[] | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  activeRegion: null,
  categoryFilter: [],
  infraSearch: '',
  choropleth: false,
  choroplethBuckets: null,
  setActiveRegion: (activeRegion) => set({ activeRegion }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  toggleCategory: (id) =>
    set((s) => ({
      categoryFilter: s.categoryFilter.includes(id)
        ? s.categoryFilter.filter((c) => c !== id)
        : [...s.categoryFilter, id],
    })),
  setInfraSearch: (infraSearch) => set({ infraSearch }),
  setChoropleth: (choropleth) => set({ choropleth, ...(choropleth ? {} : { choroplethBuckets: null }) }),
  setChoroplethBuckets: (choroplethBuckets) => set({ choroplethBuckets }),
}));
