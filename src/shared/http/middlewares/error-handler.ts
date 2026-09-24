import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { AppError } from '../../errors/app-error';
import { logger } from '../../logger/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  const requestId = req.header('x-request-id');

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        request_id: requestId,
      },
    });
  }

  logger.error(
    {
      err: error,
      requestId,
      method: req.method,
      path: req.originalUrl,
    },
    'Unhandled application error',
  );

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      request_id: requestId,
    },
  });
}