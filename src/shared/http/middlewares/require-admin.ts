import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { env } from '../../../config/env';
import { AppError } from '../../errors/app-error';

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const key = req.header('x-admin-key');
  if (
    !env.ADMIN_API_KEY ||
    !key ||
    !timingSafeEqual(
      createHash('sha256').update(key).digest(),
      createHash('sha256').update(env.ADMIN_API_KEY).digest(),
    )
  ) {
    next(
      new AppError(
        'UNAUTHORIZED',
        401,
        'A valid administrator key is required.',
      ),
    );
    return;
  }
  next();
};
