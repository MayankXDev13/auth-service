import type { CachePort, Clock } from '../ports';

type Entry = { value: any; expiresAt: number | null };

export class InMemoryCacheAdapter implements CachePort {
  private store = new Map<string, Entry>();

  constructor(private readonly clock: Clock = { now: () => new Date() }) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < this.clock.now().getTime()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async setex<T>(key: string, ttlSec: number, value: T): Promise<void> {
    const expiresAt = ttlSec > 0 ? this.clock.now().getTime() + ttlSec * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}
