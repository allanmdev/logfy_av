import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';

import { PrismaAccountRepository } from '../src/modules/accounts/infrastructure/repositories/prisma-account.repository';
import { prisma } from '../src/shared/database/prisma';
import { AppError } from '../src/shared/errors/app-error';

const repository = new PrismaAccountRepository();

for (const operation of ['create', 'update'] as const) {
  const execute = () => operation === 'create'
    ? repository.create({ name: 'Account', slug: 'reserved' })
    : repository.update('account-id', { slug: 'reserved' });

  test(`${operation}: a database uniqueness conflict returns 409`, async (t) => {
    // Adapter metadata from the reported failure: no meta.target is provided.
    const error = new Prisma.PrismaClientKnownRequestError('Duplicate slug', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: {
        modelName: 'Account',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'accounts_slug_key' },
          },
        },
      },
    });
    const original = prisma.account[operation];
    prisma.account[operation] = (() => Promise.reject(error)) as typeof original;
    t.after(() => { prisma.account[operation] = original; });

    await assert.rejects(execute, (actual: unknown) => {
      assert.ok(actual instanceof AppError);
      assert.equal(actual.statusCode, 409);
      assert.equal(actual.code, operation === 'create'
        ? 'ACCOUNT_ALREADY_EXISTS'
        : 'ACCOUNT_SLUG_ALREADY_EXISTS');
      return true;
    });
  });

  test(`${operation}: unexpected database errors are preserved`, async (t) => {
    const error = new Error('Database unavailable');
    const original = prisma.account[operation];
    prisma.account[operation] = (() => Promise.reject(error)) as typeof original;
    t.after(() => { prisma.account[operation] = original; });
    await assert.rejects(execute, (actual: unknown) => actual === error);
  });
}
