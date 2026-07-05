import { create } from 'zustand';
import type { RegionLevel } from '../utils/regionId';

export interface ActiveRegion {
  region_id: string;
  level: RegionLevel;
  name: string;
  bbox: [number, number, number, number] | null;
}

interface MapState {
  activeRegion: ActiveRegion | null;
  categoryFilter: string[]; // id kategori yang dicentang
  infraSearch: string;
  setActiveRegion: (region: ActiveRegion | null) => void;
  setCategoryFilter: (ids: string[]) => void;
  toggleCategory: (id: string) => void;
  setInfraSearch: (q: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  activeRegion: null,
  categoryFilter: [],
  infraSearch: '',
  setActiveRegion: (activeRegion) => set({ activeRegion }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  toggleCategory: (id) =>
    set((s) => ({
      categoryFilter: s.categoryFilter.includes(id)
        ? s.categoryFilter.filter((c) => c !== id)
        : [...s.categoryFilter, id],
    })),
  setInfraSearch: (infraSearch) => set({ infraSearch }),
}));
