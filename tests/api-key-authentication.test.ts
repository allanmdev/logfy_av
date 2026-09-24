import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { AuthenticateApiKeyUseCase } from '../src/modules/api-keys/application/use-cases/authenticate-api-key.use-case';
import {
  ApiKeyAuthenticationData,
  ApiKeyRepository,
} from '../src/modules/api-keys/domain/repositories/api-key.repository';
import { AppError } from '../src/shared/errors/app-error';

const key = `lgfy_test_${'a'.repeat(64)}`;
const hash = createHash('sha256').update(key).digest('hex');
const record: ApiKeyAuthenticationData = {
  id: 'key-id',
  accountId: 'account-id',
  keyHash: hash,
  scopes: ['routing:read'],
  expiresAt: null,
  revokedAt: null,
  accountStatus: 'ACTIVE',
  accountDeletedAt: null,
};

test('authentication looks up only the hash and returns tenant context without credentials', async () => {
  let used: string | undefined;
  const repository = {
    findForAuthentication: async (value: string) => {
      assert.equal(value, hash);
      return record;
    },
    updateLastUsedAt: async (id: string) => {
      used = id;
    },
  } as ApiKeyRepository;
  const result = await new AuthenticateApiKeyUseCase(repository).execute(key);
  assert.deepEqual(result, {
    accountId: 'account-id',
    apiKeyId: 'key-id',
    scopes: ['routing:read'],
  });
  assert.equal(used, 'key-id');
});

for (const [label, invalid] of [
  ['unknown key', null],
  ['revoked key', { ...record, revokedAt: new Date() }],
  ['expired key', { ...record, expiresAt: new Date(0) }],
  ['suspended account', { ...record, accountStatus: 'SUSPENDED' }],
  ['inactive account', { ...record, accountStatus: 'INACTIVE' }],
  ['deleted account', { ...record, accountDeletedAt: new Date() }],
] as const) {
  test(`authentication rejects ${label} without marking it as used`, async () => {
    const repository = {
      findForAuthentication: async () => invalid,
      updateLastUsedAt: async () => {
        assert.fail('Invalid key must not be marked as used');
      },
    } as ApiKeyRepository;
    await assert.rejects(
      new AuthenticateApiKeyUseCase(repository).execute(key),
      (error: unknown) => error instanceof AppError && error.statusCode === 401,
    );
  });
}

test('malformed keys are rejected before querying the repository', async () => {
  const repository = {
    findForAuthentication: async () => {
      assert.fail('No database call expected');
    },
  } as unknown as ApiKeyRepository;
  for (const invalid of ['', 'Bearer token', 'lgfy_test_123', key + 'a']) {
    await assert.rejects(
      new AuthenticateApiKeyUseCase(repository).execute(invalid),
      AppError,
    );
  }
});
