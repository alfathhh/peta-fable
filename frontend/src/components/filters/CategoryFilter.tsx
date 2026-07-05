import { useEffect, useState } from 'react';
import { categoryApi } from '../../api/resources';
import { useMapStore } from '../../stores/mapStore';
import { getCategoryIcon } from '../../config/categoryIcons';
import type { Category } from '../../types';

/** Filter kategori + legenda ikon (pin hanya muncul saat ada kategori dicentang / search). */
export function CategoryFilter() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { categoryFilter, toggleCategory, infraSearch, setInfraSearch } = useMapStore();

  useEffect(() => {
    categoryApi.list().then((c) => setCategories(c.filter((x) => x.isActive))).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <input
        value={infraSearch}
        onChange={(e) => setInfraSearch(e.target.value)}
        placeholder="Cari infrastruktur (nama)..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      <div className="space-y-1.5">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          const checked = categoryFilter.includes(cat.id);
          return (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
              <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat.id)} className="h-4 w-4" />
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background: cat.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm">{cat.name}</span>
            </label>
          );
        })}
        {categories.length === 0 && <p className="text-xs text-gray-500">Belum ada kategori.</p>}
      </div>
      {categoryFilter.length === 0 && !infraSearch && (
        <p className="text-xs text-gray-500">Centang kategori atau ketik pencarian untuk menampilkan pin.</p>
      )}
    </div>
  );
}
