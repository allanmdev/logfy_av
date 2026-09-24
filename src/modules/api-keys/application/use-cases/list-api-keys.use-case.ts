import { AppError } from '../../../../shared/errors/app-error';

import { AccountRepository } from '../../../accounts/domain/repositories/account.repository';

import { ApiKey } from '../../domain/entities/api-key.entity';
import { ApiKeyRepository } from '../../domain/repositories/api-key.repository';

export class ListApiKeysUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    accountId: string,
  ): Promise<ApiKey[]> {
    const account =
      await this.accountRepository.findById(accountId);

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Account not found.',
      );
    }

    return this.apiKeyRepository.findManyByAccountId(
      accountId,
    );
  }
}
