import { PrismaApiKeyRepository } from '../../modules/api-keys/infrastructure/repositories/prisma-api-key.repository';

import { PrismaAccountRepository } from '../../modules/accounts/infrastructure/repositories/prisma-account.repository';

import { CreateApiKeyUseCase } from '../../modules/api-keys/application/use-cases/create-api-key.use-case';

import { ListApiKeysUseCase } from '../../modules/api-keys/application/use-cases/list-api-keys.use-case';

import { RevokeApiKeyUseCase } from '../../modules/api-keys/application/use-cases/revoke-api-key.use-case';

import { ApiKeyController } from '../../modules/api-keys/presentation/http/api-key.controller';

const apiKeyRepository =
  new PrismaApiKeyRepository();

const accountRepository =
  new PrismaAccountRepository();

const createApiKeyUseCase =
  new CreateApiKeyUseCase(
    apiKeyRepository,
    accountRepository,
  );

const listApiKeysUseCase =
  new ListApiKeysUseCase(
    apiKeyRepository,
    accountRepository,
  );

const revokeApiKeyUseCase =
  new RevokeApiKeyUseCase(
    apiKeyRepository,
    accountRepository,
  );

export const apiKeyController =
  new ApiKeyController(
    createApiKeyUseCase,
    listApiKeysUseCase,
    revokeApiKeyUseCase,
  );