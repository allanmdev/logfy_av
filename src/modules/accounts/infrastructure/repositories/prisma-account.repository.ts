import {
  Prisma,
  Account as PrismaAccount,
  AccountStatus as PrismaAccountStatus,
} from '@prisma/client';

import {
  Account,
  AccountStatus,
} from '../../domain/entities/account.entity';

import {
  AccountRepository,
  AccountPage,
  ListAccountsOptions,
  CreateAccountData,
  UpdateAccountData,
} from '../../domain/repositories/account.repository';

import { prisma } from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/errors/app-error';

const statusToPrisma: Record<AccountStatus, PrismaAccountStatus> = {
  [AccountStatus.ACTIVE]: PrismaAccountStatus.ACTIVE,
  [AccountStatus.SUSPENDED]: PrismaAccountStatus.SUSPENDED,
  [AccountStatus.INACTIVE]: PrismaAccountStatus.INACTIVE,
};

const statusToDomain: Record<PrismaAccountStatus, AccountStatus> = {
  [PrismaAccountStatus.ACTIVE]: AccountStatus.ACTIVE,
  [PrismaAccountStatus.SUSPENDED]: AccountStatus.SUSPENDED,
  [PrismaAccountStatus.INACTIVE]: AccountStatus.INACTIVE,
};

export class PrismaAccountRepository
  implements AccountRepository
{
  async create(
    data: CreateAccountData,
  ): Promise<Account> {
    try {
      const account = await prisma.account.create({
        data: {
          name: data.name,
          slug: data.slug,
        },
      });

      return this.toDomain(account);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'ACCOUNT_ALREADY_EXISTS',
          409,
          'Já existe uma conta com este slug.',
        );
      }

      throw error;
    }
  }

  async findById(
    id: string,
  ): Promise<Account | null> {
    const account = await prisma.account.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!account) {
      return null;
    }

    return this.toDomain(account);
  }

  async findBySlug(
    slug: string,
  ): Promise<Account | null> {
    const account = await prisma.account.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!account) {
      return null;
    }

    return this.toDomain(account);
  }

  async findMany(options: ListAccountsOptions): Promise<AccountPage> {
    const where: Prisma.AccountWhereInput = options.deleted === 'all'
      ? {}
      : { deletedAt: options.deleted === 'true' ? { not: null } : null };

    const [accounts, total] = await prisma.$transaction([
      prisma.account.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      prisma.account.count({ where }),
    ], {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });

    return {
      data: accounts.map((account) => this.toDomain(account)),
      total,
    };
  }

  async update(
    id: string,
    data: UpdateAccountData,
  ): Promise<Account> {
    try {
      const account = await prisma.account.update({
        where: {
          id,
        },

        data: {
          ...(data.name !== undefined && {
            name: data.name,
          }),

          ...(data.slug !== undefined && {
            slug: data.slug,
          }),

          ...(data.status !== undefined && {
            status: statusToPrisma[data.status],
          }),
        },
      });

      return this.toDomain(account);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'ACCOUNT_SLUG_ALREADY_EXISTS',
          409,
          'Este slug já está em uso por outra conta. Escolha um slug diferente.',
        );
      }

      throw error;
    }
  }

  async softDelete(
    id: string,
  ): Promise<void> {
    await prisma.account.update({
      where: {
        id,
      },

      data: {
        deletedAt: new Date(),
      },
    });
  }
  private toDomain(
    account: PrismaAccount,
  ): Account {
      return {
        id: account.id,
      name: account.name,
      slug: account.slug,

      status: statusToDomain[account.status],

      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deletedAt: account.deletedAt,
    };
  }
}
