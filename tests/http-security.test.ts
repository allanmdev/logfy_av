import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { rateLimit } from '../src/shared/http/middlewares/rate-limit';
import { requestId } from '../src/shared/http/middlewares/request-id';
import { errorHandler } from '../src/shared/http/middlewares/error-handler';
import { RateLimitStore } from '../src/shared/security/rate-limit-store';

async function serve(t: any, store: RateLimitStore) {
  const app = express();
  app.use(requestId);
  app.use(rateLimit(store, 2, 1000));
  app.use(express.json({ limit: 32 }));
  app.all('/test', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address() as { port: number };
  return `http://127.0.0.1:${address.port}/test`;
}

test('rate limiter blocks excess traffic and ignores forged proxy headers', async (t) => {
  let count = 0;
  const keys: string[] = [];
  const url = await serve(t, { async consume(key) { keys.push(key); return { count: ++count, ttlMs: 900 }; } });
  for (let index = 0; index < 3; index++) {
    const response = await fetch(url, { headers: { 'x-forwarded-for': `10.0.0.${index}`, 'x-request-id': 'invalid id' } });
    assert.equal(response.status, index === 2 ? 429 : 200);
    assert.match(response.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
    if (index === 2) {
      assert.equal(response.headers.get('retry-after'), '1');
      assert.equal(response.headers.get('ratelimit-remaining'), '0');
    }
    await response.text();
  }
  assert.equal(new Set(keys).size, 1);
  assert.match(keys[0]!, /^[a-f0-9]{64}$/);
});

test('rate limiter fails closed without leaking dependency errors', async (t) => {
  const url = await serve(t, { async consume() { throw new Error('secret connection URL'); } });
  const response = await fetch(url);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret/);
});

test('body parser errors return safe client errors with request IDs', async (t) => {
  const url = await serve(t, { async consume() { return { count: 1, ttlMs: 1000 }; } });
  for (const [body, status, code] of [['{', 400, 'INVALID_JSON'], [JSON.stringify({ value: 'a'.repeat(40) }), 413, 'PAYLOAD_TOO_LARGE']] as const) {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'test-id' }, body });
    assert.equal(response.status, status);
    const result = await response.json() as any;
    assert.equal(result.error.code, code);
    assert.equal(result.error.request_id, 'test-id');
  }
});
