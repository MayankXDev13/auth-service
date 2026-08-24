import { getRedisClient } from '../lib/redis';
import logger from '../logger/winston.logger';

export const cacheUser = async (userId: string, userData: any, ttl = 3600) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(`user:${userId}`, ttl, JSON.stringify(userData));
    logger.debug('User data cached', { userId });
  } catch (error) {
    logger.warn('Failed to cache user data', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCachedUser = async (userId: string) => {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const cached = await redis.get(`user:${userId}`);
    if (cached) {
      logger.debug('User data retrieved from cache', { userId });
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    logger.warn('Failed to get cached user data', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};

export const deleteCachedUser = async (userId: string) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(`user:${userId}`);
    logger.debug('User data removed from cache', { userId });
  } catch (error) {
    logger.warn('Failed to delete cached user data', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const cacheData = async (key: string, data: any, ttl = 3600) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    logger.warn('Failed to cache data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCachedData = async (key: string) => {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn('Failed to get cached data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};

export const deleteCachedData = async (key: string) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    logger.warn('Failed to delete cached data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
