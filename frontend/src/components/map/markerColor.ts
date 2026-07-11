export function safeCategoryColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2563eb';
}
