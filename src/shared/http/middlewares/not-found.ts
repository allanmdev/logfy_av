import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { AppError } from '../../errors/app-error';

export function notFound(
  req: Request,
  _res: Response,
  next: NextFunction,
): void { 
  next(
    new AppError(
      'ROUTE_NOT_FOUND',
      404,
      `Route ${req.method} ${req.originalUrl} not found.`,
    ),
  );
}