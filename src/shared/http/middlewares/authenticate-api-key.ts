import { RequestHandler } from 'express';
import { AuthenticateApiKeyUseCase } from '../../../modules/api-keys/application/use-cases/authenticate-api-key.use-case';
import { AppError } from '../../errors/app-error';

export function authenticateApiKey(
  useCase: AuthenticateApiKeyUseCase,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const key = req.header('x-api-key');
      if (!key) {
        throw new AppError('UNAUTHORIZED', 401, 'A valid API key is required.');
      }
      req.auth = await useCase.execute(key);
      next();
    } catch (error) {
      next(error);
    }
  };
}
