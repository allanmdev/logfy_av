import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import Redis from 'ioredis';
import { env } from '../../src/config/env';
import { RedisRateLimitStore } from '../../src/shared/redis/redis-rate-limit-store';

test('Redis counts concurrent requests across clients atomically and expires the window', async (t) => {
  const clients = [new Redis(env.REDIS_URL, { lazyConnect: true }), new Redis(env.REDIS_URL, { lazyConnect: true })];
  const key = randomUUID();
  t.after(async () => {
    try {
      if (clients[0]!.status === 'ready') await clients[0]!.del(`logfy:rate-limit:${key}`);
    } finally {
      clients.forEach((client) => client.disconnect());
    }
  });
  await Promise.all(clients.map((client) => client.connect()));
  const stores = clients.map((client) => new RedisRateLimitStore(client));
  const results = await Promise.all(Array.from({ length: 30 }, (_, index) => stores[index % 2]!.consume(key, 10000)));
  assert.deepEqual(results.map((result) => result.count).sort((a, b) => a - b), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.ok(results.every((result) => result.ttlMs > 0 && result.ttlMs <= 10000));
  await clients[0]!.pexpire(`logfy:rate-limit:${key}`, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await stores[1]!.consume(key, 10000)).count, 1);
});
