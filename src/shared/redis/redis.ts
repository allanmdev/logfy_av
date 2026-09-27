import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 3000,
  commandTimeout: 3000,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
});

redis.on('error', () => logger.warn('Redis connection unavailable'));
