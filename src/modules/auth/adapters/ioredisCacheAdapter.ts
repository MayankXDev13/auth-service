import type { CachePort } from '../ports';
import { Redis } from 'ioredis';
import logger from '../../../logger/winston.logger';

export class IORedisCacheAdapter implements CachePort {
  private client: Redis | null = null;
  constructor(private readonly redisUrl: string) {}

  async init(): Promise<void> {
    if (!this.redisUrl) {
      logger.warn('REDIS_URL not provided — cache disabled');
      return;
    }
    this.client = new Redis(this.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
    this.client.on('error', err => logger.error('Redis error', { error: err.message }));
    await this.client.connect().catch(err => {
      logger.warn('Redis connect failed — cache disabled', { error: err.message });
      this.client = null;
    });
  }

  async close(): Promise<void> {
    if (this.client) await this.client.quit().catch(() => {});
    this.client = null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      logger.warn('Cache get failed', { key, error: e });
      return null;
    }
  }

  async setex<T>(key: string, ttlSec: number, value: T): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.setex(key, ttlSec, JSON.stringify(value));
    } catch (e) {
      logger.warn('Cache setex failed', { key, error: e });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (e) {
      logger.warn('Cache del failed', { key, error: e });
    }
  }
}

export class NoopCacheAdapter implements CachePort {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async setex<T>(_key: string, _ttl: number, _value: T): Promise<void> {}
  async del(_key: string): Promise<void> {}
}
