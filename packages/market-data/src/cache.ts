interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Small in-process TTL cache. The API is single-user; no external cache is needed. */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  get(key: string, nowMs: number): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= nowMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, nowMs: number): void {
    this.entries.set(key, { value, expiresAt: nowMs + Math.max(0, ttlMs) });
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
