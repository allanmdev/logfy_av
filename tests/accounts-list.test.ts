import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { accountRouter } from '../src/modules/accounts/presentation/http/account.routes';
import { errorHandler } from '../src/shared/http/middlewares/error-handler';
import { prisma } from '../src/shared/database/prisma';

test('GET accounts filters deleted records, paginates, and validates query parameters', async (t) => {
  const calls: any[] = [];
  const originals = {
    findMany: prisma.account.findMany,
    count: prisma.account.count,
    transaction: prisma.$transaction,
  };
  const rows = [
    { id: 'a', name: 'Visible', slug: 'visible', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
    { id: 'b', name: 'Deleted', slug: 'deleted', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() },
  ];
  const filtered = (where: any) => rows.filter((row) =>
    !('deletedAt' in where) || (where.deletedAt === null ? row.deletedAt === null : row.deletedAt !== null));
  prisma.account.findMany = (async (args: any) => {
    calls.push(args);
    return filtered(args.where).slice(args.skip, args.skip + args.take);
  }) as any;
  prisma.account.count = (async (args: any) => filtered(args.where).length) as any;
  prisma.$transaction = ((queries: any[]) => Promise.all(queries)) as any;
  t.after(() => {
    prisma.account.findMany = originals.findMany;
    prisma.account.count = originals.count;
    prisma.$transaction = originals.transaction;
  });

  const app = express();
  app.use('/v1/accounts', accountRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/v1/accounts`;

  for (const [query, expectedIds, pagination] of [
    ['', ['a', 'b'], { page: 1, limit: 20, total: 2, totalPages: 1 }],
    ['?deleted=false', ['a'], { page: 1, limit: 20, total: 1, totalPages: 1 }],
    ['?deleted=true', ['b'], { page: 1, limit: 20, total: 1, totalPages: 1 }],
    ['?deleted=all&page=2&limit=1', ['b'], { page: 2, limit: 1, total: 2, totalPages: 2 }],
    ['?page=3&limit=1', [], { page: 3, limit: 1, total: 2, totalPages: 2 }],
  ] as const) {
    const response = await fetch(url + query);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((row: any) => row.id), expectedIds);
    assert.deepEqual(body.pagination, pagination);
  }
  assert.deepEqual(calls[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  const countBeforeInvalid = calls.length;
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'limit=101', 'limit=0', 'deleted=no', 'page=abc', 'page=1&page=2', 'page=2147483647&limit=100']) {
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 422, query);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  }
  assert.equal(calls.length, countBeforeInvalid);
});
