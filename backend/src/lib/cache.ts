// Cache LRU sederhana di memori server untuk respons GeoJSON per wilayah.
// HANYA sisi server — respons ke browser tetap Cache-Control: private, no-store.

const MAX_ENTRIES = 200;

const store = new Map<string, string>();

export function cacheGet(key: string): string | undefined {
  const value = store.get(key);
  if (value !== undefined) {
    // refresh posisi LRU
    store.delete(key);
    store.set(key, value);
  }
  return value;
}

export function cacheSet(key: string, value: string): void {
  if (store.has(key)) store.delete(key);
  store.set(key, value);
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

export function cacheInvalidateByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}
