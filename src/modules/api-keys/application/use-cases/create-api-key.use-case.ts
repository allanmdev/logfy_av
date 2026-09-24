import {
  createHash,
  randomBytes,
} from 'node:crypto';

import { AppError } from '../../../../shared/errors/app-error';

import { AccountRepository } from '../../../accounts/domain/repositories/account.repository';

import { ApiKeyRepository } from '../../domain/repositories/api-key.repository';

import { CreateApiKeyDTO } from '../dto/create-api-key.dto';

export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: CreateApiKeyDTO) {
    const account =
      await this.accountRepository.findById(
        input.accountId,
      );

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Account not found.',
      );
    }

    const prefix = 'lgfy_test_';

    const secret =
      randomBytes(32).toString('hex');

    const plainKey =
      `${prefix}${secret}`;

    const keyHash = createHash('sha256')
      .update(plainKey)
      .digest('hex');

    const apiKey =
      await this.apiKeyRepository.create({
        accountId: input.accountId,

        name: input.name,

        prefix,
        keyHash,

        scopes: input.scopes,

        expiresAt:
          input.expiresAt ?? null,
      });

    return {
      ...apiKey,

      key: plainKey,
    };
  }
}