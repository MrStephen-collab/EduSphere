// Shared in-process TTL cache for expensive server-side reads. Supabase
// traffic on this network opens a fresh TLS connection per request (~500ms
// handshake), so caching dashboard data for a few seconds removes those
// round trips from repeat page loads and across users of the same school.

type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 500;

export async function getServerData<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }

  const value = await loader();

  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}