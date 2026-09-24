import { AppError } from '../../../../shared/errors/app-error';

import { AccountRepository } from '../../../accounts/domain/repositories/account.repository';

import { ApiKeyRepository } from '../../domain/repositories/api-key.repository';

export class RevokeApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    accountId: string,
    apiKeyId: string,
  ): Promise<void> {
    const account =
      await this.accountRepository.findById(accountId);

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Account not found.',
      );
    }

    const revoked =
      await this.apiKeyRepository.revoke(
        apiKeyId,
        accountId,
      );

    if (!revoked) {
      throw new AppError(
        'API_KEY_NOT_FOUND',
        404,
        'API key not found or already revoked.',
      );
    }
  }
}
