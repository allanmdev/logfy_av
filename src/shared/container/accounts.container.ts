import { CreateAccountUseCase } from '../../modules/accounts/application/use-cases/create-account.use-case';

import { GetAccountUseCase } from '../../modules/accounts/application/use-cases/get-account.use-case';

import { ListAccountsUseCase } from '../../modules/accounts/application/use-cases/list-accounts.use-case';

import { PrismaAccountRepository } from '../../modules/accounts/infrastructure/repositories/prisma-account.repository';

import { AccountController } from '../../modules/accounts/presentation/http/account.controller';

import { UpdateAccountUseCase } from '../../modules/accounts/application/use-cases/update-account.use-case';

import { DeleteAccountUseCase } from '../../modules/accounts/application/use-cases/delete-account.use-case';

const accountRepository =
  new PrismaAccountRepository();

const createAccountUseCase =
  new CreateAccountUseCase(accountRepository);

const getAccountUseCase =
  new GetAccountUseCase(accountRepository);

const listAccountsUseCase =
  new ListAccountsUseCase(accountRepository);

const updateAccountUseCase =
  new UpdateAccountUseCase(accountRepository);

const deleteAccountUseCase =
  new DeleteAccountUseCase(accountRepository);

export const accountController =
  new AccountController(
    createAccountUseCase,
    getAccountUseCase,
    listAccountsUseCase,
    updateAccountUseCase,
    deleteAccountUseCase,
  );