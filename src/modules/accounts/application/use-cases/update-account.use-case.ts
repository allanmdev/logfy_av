import { AppError } from '../../../../shared/errors/app-error';

import {
  Account,
  AccountStatus,
} from '../../domain/entities/account.entity';

import { AccountRepository } from '../../domain/repositories/account.repository';

export interface UpdateAccountInput {
  name?: string;
  slug?: string;
  status?: AccountStatus;
}

export class UpdateAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateAccountInput,
  ): Promise<Account> {
    const account =
      await this.accountRepository.findById(id);

    if (!account) {
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        404,
        'Conta não encontrada. Verifique o identificador informado.',
      );
    }

    if (
      input.slug &&
      input.slug !== account.slug
    ) {
      const accountWithSameSlug =
        await this.accountRepository.findBySlug(
          input.slug,
        );

      if (accountWithSameSlug) {
        throw new AppError(
          'ACCOUNT_SLUG_ALREADY_EXISTS',
          409,
          'Este slug já está em uso por outra conta. Escolha um slug diferente.',
        );
      }
    }

    return this.accountRepository.update(
      id,
      input,
    );
  }
}
