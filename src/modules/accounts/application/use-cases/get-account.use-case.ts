import { AppError } from '../../../../shared/errors/app-error';

import { Account } from '../../domain/entities/account.entity';
import { AccountRepository } from '../../domain/repositories/account.repository';

export class GetAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(id: string): Promise<Account> {
    const account =
      await this.accountRepository.findById(id);

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Account not found.',
      );
    }

    return account;
  }
}