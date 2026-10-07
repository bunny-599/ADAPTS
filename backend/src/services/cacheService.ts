/**
 * In-Memory TTL & LRU Cache Service
 * Provides fast main-memory caching for web research, topic queries, and frequent lookups
 * without repeatedly hitting external search APIs or the database.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export class CacheService {
  private static store = new Map<string, CacheEntry<any>>();
  private static readonly MAX_ENTRIES = 250;
  private static readonly DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

  /**
   * Retrieves a cached value if present and unexpired.
   */
  public static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  /**
   * Stores a value in memory with an optional TTL.
   */
  public static set<T>(key: string, value: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    // Evict least recently accessed if store exceeds max size
    if (this.store.size >= this.MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestAccess = Infinity;
      for (const [k, v] of this.store.entries()) {
        if (v.lastAccessed < oldestAccess) {
          oldestAccess = v.lastAccessed;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Checks if a key exists in cache without expiring.
   */
  public static has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clears a specific key or all keys.
   */
  public static delete(key: string): void {
    this.store.delete(key);
  }

  public static clear(): void {
    this.store.clear();
  }

  public static size(): number {
    return this.store.size;
  }
}
