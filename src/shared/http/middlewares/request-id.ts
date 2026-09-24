import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { randomUUID } from 'node:crypto';

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingRequestId = req.header('x-request-id');

  const id = incomingRequestId || randomUUID();

  req.headers['x-request-id'] = id;

  res.setHeader('X-Request-Id', id);

  next();
}