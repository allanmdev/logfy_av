import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { ZodType } from 'zod';

import { AppError } from '../../errors/app-error';

export function validate(schema: ZodType) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      next(
        new AppError(
          'VALIDATION_ERROR',
          422,
          'The request contains invalid data.',
          result.error.flatten(),
        ),
      );

      return;
    }

    const data = result.data;

    if (typeof data === 'object' && data !== null && 'body' in data) {
      req.body = data.body;
    }

    next();
  };
}
