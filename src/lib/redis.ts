import Redis from 'ioredis';
import logger from '../logger/winston.logger';

let redisClient: Redis | null = null;

/**
 * Initialize Redis client
 */
export const initRedis = (): Redis | null => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL);

      redisClient.on('ready', () => {
        logger.info('Redis client ready');
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      redisClient.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
      });

      return redisClient;
    } else {
      logger.warn('REDIS_URL not configured, caching disabled');
      return null;
    }
  } catch (error) {
    logger.error('Failed to initialize Redis', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis | null => {
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};