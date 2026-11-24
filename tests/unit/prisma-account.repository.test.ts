import assert from 'node:assert/strict';
import { test, onTestFinished } from 'vitest';
import { Prisma } from '@prisma/client';

import { PrismaAccountRepository } from '../../src/modules/accounts/infrastructure/repositories/prisma-account.repository';
import { prisma } from '../../src/shared/database/prisma';
import { AppError } from '../../src/shared/errors/app-error';

const repository = new PrismaAccountRepository();

for (const operation of ['create', 'update'] as const) {
  const execute = () => operation === 'create'
    ? repository.create({ name: 'Account', slug: 'reserved' })
    : repository.update('account-id', { slug: 'reserved' });

  test(`${operation}: a database uniqueness conflict returns 409`, async () => {
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
    const delegate = prisma.account as unknown as Record<string, unknown>;
    const original = delegate[operation];
    delegate[operation] = () => Promise.reject(error);
    onTestFinished(() => { delegate[operation] = original; });

    await assert.rejects(execute, (actual: unknown) => {
      assert.ok(actual instanceof AppError);
      assert.equal(actual.statusCode, 409);
      assert.equal(actual.code, operation === 'create'
        ? 'ACCOUNT_ALREADY_EXISTS'
        : 'ACCOUNT_SLUG_ALREADY_EXISTS');
      return true;
    });
  });

  test(`${operation}: unexpected database errors are preserved`, async () => {
    const error = new Error('Database unavailable');
    const delegate = prisma.account as unknown as Record<string, unknown>;
    const original = delegate[operation];
    delegate[operation] = () => Promise.reject(error);
    onTestFinished(() => { delegate[operation] = original; });
    await assert.rejects(execute, (actual: unknown) => actual === error);
  });
}
