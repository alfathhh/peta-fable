// Daftar kurasi nama ikon lucide untuk kategori infrastruktur.
// MIRROR dari frontend/src/config/categoryIcons.ts — jaga tetap sinkron.

export const CATEGORY_ICONS = [
  'school',
  'graduation-cap',
  'book-open',
  'library',
  'hospital',
  'cross',
  'stethoscope',
  'pill',
  'ambulance',
  'landmark',
  'church',
  'building',
  'building-2',
  'home',
  'hotel',
  'store',
  'shopping-cart',
  'shopping-bag',
  'utensils',
  'coffee',
  'factory',
  'warehouse',
  'route',
  'signpost',
  'fuel',
  'bus',
  'train-front',
  'ship',
  'plane',
  'anchor',
  'droplets',
  'zap',
  'wifi',
  'radio-tower',
  'trees',
  'sprout',
  'wheat',
  'fish',
  'tent',
  'map-pin',
  'flag',
  'shield',
  'banknote',
  'mail',
  'trash-2',
  'dumbbell',
  'waves',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export function isValidCategoryIcon(icon: string): icon is CategoryIcon {
  return (CATEGORY_ICONS as readonly string[]).includes(icon);
}
