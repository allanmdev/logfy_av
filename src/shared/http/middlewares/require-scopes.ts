import { RequestHandler } from 'express';
import { getAuth } from '../../auth/auth-context';
import { Scope } from '../../auth/scopes';
import { AppError } from '../../errors/app-error';

export function requireScopes(...scopes: Scope[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = getAuth(req);
      if (!scopes.every((scope) => auth.scopes.includes(scope))) {
        throw new AppError(
          'FORBIDDEN',
          403,
          'The API key does not have the required scopes.',
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
