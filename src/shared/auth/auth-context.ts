import { Request } from 'express';
import { Scope } from './scopes';
import { AppError } from '../errors/app-error';

export interface AuthContext {
  accountId: string;
  apiKeyId: string;
  scopes: Scope[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError('UNAUTHORIZED', 401, 'A valid API key is required.');
  }
  return req.auth;
}
