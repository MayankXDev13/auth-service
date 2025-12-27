import { getRedisClient } from '../lib/redis';
import logger from '../logger/winston.logger';

/**
 * Cache user data
 * @param userId - User ID
 * @param userData - User data to cache
 * @param ttl - Time to live in seconds (default: 1 hour)
 */
export const cacheUser = async (
  userId: string,
  userData: any,
  ttl = 3600
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(`user:${userId}`, ttl, JSON.stringify(userData));
    logger.debug('User data cached', { userId });
  } catch (error) {
    logger.warn('Failed to cache user data', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get cached user data
 * @param userId - User ID
 * @returns Cached user data or null if not found
 */
export const getCachedUser = async (userId: string): Promise<any | null> => {
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
    logger.warn('Failed to get cached user data', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};

/**
 * Delete cached user data
 * @param userId - User ID
 */
export const deleteCachedUser = async (userId: string): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(`user:${userId}`);
    logger.debug('User data removed from cache', { userId });
  } catch (error) {
    logger.warn('Failed to delete cached user data', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Cache general data
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds
 */
export const cacheData = async (
  key: string,
  data: any,
  ttl = 3600
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    logger.warn('Failed to cache data', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get cached data
 * @param key - Cache key
 * @returns Cached data or null if not found
 */
export const getCachedData = async (key: string): Promise<any | null> => {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn('Failed to get cached data', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};

/**
 * Delete cached data
 * @param key - Cache key
 */
export const deleteCachedData = async (key: string): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    logger.warn('Failed to delete cached data', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};