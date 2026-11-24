import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prisma';
import { RateLimitStore } from '../../src/shared/security/rate-limit-store';

export function assertIntegrationDatabase() {
  const testDatabase = process.env.LOGFY_INTEGRATION_DATABASE;
  if (
    !testDatabase ||
    !/^logfy_test_[a-f0-9]+$/.test(testDatabase) ||
    new URL(process.env.DATABASE_URL!).pathname !== `/${testDatabase}`
  ) {
    throw new Error('Run integration tests using npm run test:integration.');
  }
}

class MemoryRateLimitStore implements RateLimitStore {
  async consume() {
    return { count: 1, ttlMs: 60000 };
  }
}

export function buildApp() {
  return createApp({
    rateLimitStore: new MemoryRateLimitStore(),
    readiness: async () => undefined,
  });
}

export const adminKey = () => process.env.ADMIN_API_KEY!;

export async function provisionTenant(app: ReturnType<typeof buildApp>) {
  const slug = `tenant-${randomUUID().slice(0, 8)}`;
  const account = await request(app)
    .post('/v1/accounts')
    .set('X-Admin-Key', adminKey())
    .send({ name: `Empresa ${slug}`, slug })
    .expect(201);
  const apiKey = await request(app)
    .post(`/v1/accounts/${account.body.data.id}/api-keys`)
    .set('X-Admin-Key', adminKey())
    .send({ name: 'Testes', scopes: ['routing:read', 'routing:write'] })
    .expect(201);
  return {
    accountId: account.body.data.id as string,
    key: apiKey.body.data.key as string,
  };
}

export async function removeTenants(...accountIds: string[]) {
  await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
}
