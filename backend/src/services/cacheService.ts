interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * High-performance in-memory TTL cache for reducing database and LLM load.
 */
export class CacheService {
  private static store: Map<string, CacheEntry<any>> = new Map();
  private static readonly MAX_ENTRIES = 5000;

  /**
   * Retrieves a cached value if present and not expired.
   */
  public static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Sets a cache key with a TTL in seconds.
   */
  public static set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    if (this.store.size >= this.MAX_ENTRIES) {
      // Evict oldest entries
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidates a key or pattern prefix.
   */
  public static invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
      return;
    }

    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache.
   */
  public static clear(): void {
    this.store.clear();
  }
}
