import { AppError } from '../../../../shared/errors/app-error';

import { AccountRepository } from '../../domain/repositories/account.repository';

export class DeleteAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const account =
      await this.accountRepository.findById(id);

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Account not found.',
      );
    }

    await this.accountRepository.softDelete(id);
  }
}