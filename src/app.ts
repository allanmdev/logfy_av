import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { apiRouter } from './shared/http/routes';
import { errorHandler } from './shared/http/middlewares/error-handler';
import { notFound } from './shared/http/middlewares/not-found';
import { requestId } from './shared/http/middlewares/request-id';
import { env } from './config/env';
import { redis } from './shared/redis/redis';
import { prisma } from './shared/database/prisma';
import { RedisRateLimitStore } from './shared/redis/redis-rate-limit-store';
import { RateLimitStore } from './shared/security/rate-limit-store';
import { rateLimit } from './shared/http/middlewares/rate-limit';
import { logger } from './shared/logger/logger';

export function createApp(options: { rateLimitStore?: RateLimitStore; readiness?: () => Promise<unknown> } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY ? env.TRUST_PROXY.split(',').map((value) => value.trim()) : false);
  app.use(requestId);

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((value) => value.trim()) : false,
    }),
  );

  app.use(compression());

  app.use(
    pinoHttp({
      logger,

      customProps(req) {
        return {
          requestId: req.headers['x-request-id'],
        };
      },
    }),
  );

  app.get('/v1/health', (_req, res) => {
    res.json({ data: { service: 'logfy-api', status: 'ok', timestamp: new Date().toISOString() } });
  });
  app.get('/v1/health/ready', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await (options.readiness ?? (() => Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()])))();
      res.json({ data: { status: 'ready' } });
    } catch {
      res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' } });
    }
  });
  app.use('/v1', rateLimit(options.rateLimitStore ?? new RedisRateLimitStore(redis), env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS));
  app.use(express.json({ limit: '1mb' }));
  app.use('/v1', apiRouter);

  app.use(notFound);

  app.use(errorHandler);

  return app;
}
