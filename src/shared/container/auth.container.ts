import { PrismaApiKeyRepository } from '../../modules/api-keys/infrastructure/repositories/prisma-api-key.repository';
import { AuthenticateApiKeyUseCase } from '../../modules/api-keys/application/use-cases/authenticate-api-key.use-case';
import { authenticateApiKey } from '../http/middlewares/authenticate-api-key';

export const apiKeyAuthentication = authenticateApiKey(
  new AuthenticateApiKeyUseCase(new PrismaApiKeyRepository()),
);
