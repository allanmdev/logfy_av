import { AppError } from '../../../../shared/errors/app-error';

import { Account } from '../../domain/entities/account.entity';
import { AccountRepository } from '../../domain/repositories/account.repository';

import { CreateAccountDTO } from '../dto/create-account.dto';

export class CreateAccountUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    input: CreateAccountDTO,
  ): Promise<Account> {
    const existingAccount =
      await this.accountRepository.findBySlug(input.slug);

    if (existingAccount) {
      throw new AppError(
        'ACCOUNT_ALREADY_EXISTS',
        409,
        'Já existe uma conta com este slug.',
      );
    }

    return this.accountRepository.create({
      name: input.name,
      slug: input.slug,
    });
  }
}