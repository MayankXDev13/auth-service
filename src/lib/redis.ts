import Redis from 'ioredis';
import logger from '../logger/winston.logger';

let redisClient: Redis | null = null;

export const initRedis = () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL);
      redisClient.on('ready', () => logger.info('Redis client ready'));
      redisClient.on('connect', () => logger.info('Redis connected successfully'));
      redisClient.on('error', (error: Error) => logger.error('Redis connection error', { error: error.message }));
      return redisClient;
    } else {
      logger.warn('REDIS_URL not configured, caching disabled');
      return null;
    }
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};

export const getRedisClient = (): Redis | null => redisClient;

export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};
