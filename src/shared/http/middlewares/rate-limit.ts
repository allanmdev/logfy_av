import { createHash } from 'node:crypto';
import { RequestHandler } from 'express';
import { RateLimitStore } from '../../security/rate-limit-store';
import { AppError } from '../../errors/app-error';

export function rateLimit(store: RateLimitStore, max: number, windowMs: number): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = createHash('sha256').update(req.ip ?? req.socket.remoteAddress ?? 'unknown').digest('hex');
      const { count, ttlMs } = await store.consume(key, windowMs);
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('RateLimit-Reset', Math.ceil(ttlMs / 1000));
      if (count > max) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil(ttlMs / 1000)));
        next(new AppError('RATE_LIMIT_EXCEEDED', 429, 'Too many requests. Try again later.'));
        return;
      }
      next();
    } catch {
      next(new AppError('SERVICE_UNAVAILABLE', 503, 'Service temporarily unavailable.'));
    }
  };
}
