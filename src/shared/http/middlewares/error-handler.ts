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
  if (res.headersSent) {
    _next(error);
    return res;
  }
  const bodyError = error as Error & { type?: string; status?: number };
  const bodyErrors: Record<string, [number, string, string]> = {
    'entity.parse.failed': [400, 'INVALID_JSON', 'Request body must be valid JSON.'],
    'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size.'],
    'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING', 'Request encoding is not supported.'],
    'charset.unsupported': [415, 'UNSUPPORTED_CHARSET', 'Request charset is not supported.'],
  };
  const mapped = bodyError.type ? bodyErrors[bodyError.type] : undefined;
  if (mapped && bodyError.status === mapped[0]) {
    error = new AppError(mapped[1], mapped[0], mapped[2]);
  }
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
      path: req.path,
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
