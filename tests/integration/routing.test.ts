import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prisma';
import { GoogleMapsDistanceMatrixProvider } from '../../src/modules/routing/infrastructure/providers/google-maps-distance-matrix.provider';
import { PrismaOptimizationRepository } from '../../src/modules/routing/infrastructure/repositories/prisma-optimization.repository';
import { PrismaDeliveryRepository } from '../../src/modules/deliveries/infrastructure/repositories/prisma-delivery.repository';
import { CheapestInsertionOptimizer } from '../../src/modules/routing/infrastructure/optimization/cheapest-insertion.optimizer';
import { AppError } from '../../src/shared/errors/app-error';

const testDatabase = process.env.LOGFY_INTEGRATION_DATABASE;
if (
  !testDatabase ||
  !/^logfy_test_[a-f0-9]+$/.test(testDatabase) ||
  new URL(process.env.DATABASE_URL!).pathname !== `/${testDatabase}`
) {
  throw new Error('Run this test using npm run test:integration.');
}

test('routing HTTP flow, tenant isolation, persistence and optimistic concurrency on PostgreSQL', async (t) => {
  t.after(() => prisma.$disconnect());
  const originalCompute = GoogleMapsDistanceMatrixProvider.prototype.compute;
  let matrixCalls = 0;
  GoogleMapsDistanceMatrixProvider.prototype.compute = async (points) => {
    matrixCalls++;
    return {
      provider: 'integration-fixture',
      costs: points.map((_, i) =>
        points.map((_, j) => ({
          distanceMeters: i === j ? 0 : 100,
          durationSeconds: i === j ? 0 : 10,
        })),
      ),
    };
  };
  t.after(() => {
    GoogleMapsDistanceMatrixProvider.prototype.compute = originalCompute;
  });
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/v1`;
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    key?: string,
    admin = false,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-api-key': key } : {}),
        ...(admin ? { 'x-admin-key': process.env.ADMIN_API_KEY! } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, body: data };
  }
  const adminRequest = (path: string, method = 'GET', body?: unknown) =>
    request(path, method, body, undefined, true);
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/accounts')).status, 401);
  assert.equal(
    (await request('/accounts', 'POST', { name: 'Bypass', slug: 'bypass' }))
      .status,
    401,
  );
  assert.equal((await request('/route-plans')).status, 401);
  assert.equal(
    (await request('/vehicles', 'GET', undefined, 'invalid')).status,
    401,
  );
  const accountA = (
    await adminRequest('/accounts', 'POST', {
      name: 'Tenant A',
      slug: 'tenant-a',
    })
  ).body.data;
  const accountB = (
    await adminRequest('/accounts', 'POST', {
      name: 'Tenant B',
      slug: 'tenant-b',
    })
  ).body.data;
  const issueKey = async (accountId: string, scopes: string[]) => {
    const response = await adminRequest(
      `/accounts/${accountId}/api-keys`,
      'POST',
      { name: 'Integration key', scopes },
    );
    assert.equal(response.status, 201);
    assert.ok(!('keyHash' in response.body.data));
    return response.body.data;
  };
  const keyA = await issueKey(accountA.id, ['routing:read', 'routing:write']);
  const keyB = await issueKey(accountB.id, ['routing:read', 'routing:write']);
  const readKey = await issueKey(accountA.id, ['routing:read']);
  const a = (path: string, method = 'GET', body?: unknown) =>
    request(path, method, body, keyA.key);
  const b = (path: string, method = 'GET', body?: unknown) =>
    request(path, method, body, keyB.key);
  assert.equal(
    (
      await request(
        '/vehicles',
        'POST',
        { name: 'Denied', capacity: 5 },
        readKey.key,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request('/accounts', 'GET', undefined, keyA.key)).status,
    401,
  );
  assert.equal(
    (
      await request(
        `/accounts/${accountA.id}/api-keys`,
        'POST',
        { name: 'Escalation', scopes: ['routing:write'] },
        readKey.key,
      )
    ).status,
    401,
  );
  const vehicleResponse = await a('/vehicles', 'POST', {
    name: 'Van A',
    capacity: 5,
  });
  assert.equal(vehicleResponse.status, 201);
  const vehicle = vehicleResponse.body.data;
  const vehicleB = (
    await b('/vehicles', 'POST', { name: 'Van B', capacity: 10 })
  ).body.data;
  const planResponse = await a('/route-plans', 'POST', {
    name: 'Morning',
    depotLatitude: -23,
    depotLongitude: -46,
  });
  assert.equal(planResponse.status, 201);
  const plan = planResponse.body.data;
  const path = `/route-plans/${plan.id}`;
  assert.equal(plan.accountId, accountA.id);
  assert.equal((await b(path)).status, 404);
  assert.equal((await b(path, 'PATCH', { name: 'Intrusion' })).status, 404);
  assert.equal((await b(path, 'DELETE')).status, 404);
  assert.equal((await b(`${path}/deliveries`)).status, 404);
  assert.equal((await b(`/vehicles/${vehicle.id}`)).status, 404);
  assert.equal(
    (await b(`/vehicles/${vehicle.id}`, 'PATCH', { capacity: 100 })).status,
    404,
  );
  assert.equal((await b(`/vehicles/${vehicle.id}`, 'DELETE')).status, 404);
  assert.deepEqual((await b('/route-plans')).body.data, []);
  assert.equal((await a('/route-plans?page=0')).status, 422);
  assert.equal((await a('/vehicles?limit=101')).status, 422);
  assert.equal(
    (await a(path, 'PATCH', { accountId: accountB.id })).status,
    422,
  );
  assert.equal(
    (
      await a('/route-plans', 'POST', {
        name: 'Bad',
        depotLatitude: 91,
        depotLongitude: 0,
      })
    ).status,
    422,
  );
  assert.equal(
    (await a(`${path}/optimize`, 'POST', { vehicleIds: [vehicle.id] })).status,
    422,
  );
  assert.equal(matrixCalls, 0);
  const deliveryResponse = await a(`${path}/deliveries`, 'POST', {
    reference: 'D1',
    latitude: -23.1,
    longitude: -46.1,
    demand: 2,
    serviceDurationSeconds: 30,
  });
  assert.equal(deliveryResponse.status, 201);
  const delivery = deliveryResponse.body.data;
  await assert.rejects(
    prisma.delivery.create({
      data: {
        accountId: accountB.id,
        routePlanId: plan.id,
        reference: 'Database isolation',
        latitude: 0,
        longitude: 0,
        demand: 1,
      },
    }),
  );
  assert.equal(
    (
      await a(`${path}/deliveries`, 'POST', {
        reference: 'D1',
        latitude: 0,
        longitude: 0,
        demand: 1,
      })
    ).status,
    409,
  );
  const second = await a(`${path}/deliveries`, 'POST', {
    reference: 'D2',
    latitude: -23.2,
    longitude: -46.2,
    demand: 3,
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.data.serviceDurationSeconds, 0);
  assert.equal((await b(`${path}/deliveries/${delivery.id}`)).status, 404);
  assert.equal(
    (await b(`${path}/deliveries/${delivery.id}`, 'PATCH', { demand: 1 }))
      .status,
    404,
  );
  assert.equal(
    (await b(`${path}/deliveries/${delivery.id}`, 'DELETE')).status,
    404,
  );
  assert.equal(
    (
      await b(`${path}/deliveries`, 'POST', {
        reference: 'Foreign',
        latitude: 0,
        longitude: 0,
        demand: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (await b(`${path}/optimize`, 'POST', { vehicleIds: [vehicleB.id] })).status,
    404,
  );
  assert.equal(
    (await a(`${path}/optimize`, 'POST', { vehicleIds: [vehicleB.id] })).status,
    404,
  );
  assert.equal(
    (
      await a(`${path}/optimize`, 'POST', {
        vehicleIds: [vehicle.id, vehicle.id],
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await a(`${path}/optimize`, 'POST', {
        vehicleIds: [vehicle.id],
        accountId: accountB.id,
      })
    ).status,
    422,
  );
  assert.equal(matrixCalls, 0);
  const optimized = await a(`${path}/optimize`, 'POST', {
    vehicleIds: [vehicle.id],
  });
  assert.equal(optimized.status, 200, JSON.stringify(optimized.body));
  assert.equal(matrixCalls, 1);
  const result = optimized.body.data.result;
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].load, 5);
  assert.equal(result.routes[0].stops.length, 2);
  assert.equal(result.totalDistanceMeters, 300);
  assert.equal(result.totalDurationSeconds, 60);
  assert.deepEqual(
    (await a(`${path}/optimization`)).body.data,
    optimized.body.data,
  );
  assert.equal((await b(`${path}/optimization`)).status, 404);
  assert.equal((await a(path)).body.data.status, 'optimized');
  assert.equal(
    await prisma.routeOptimization.count({ where: { routePlanId: plan.id } }),
    1,
  );
  const optimizedAgain = await a(`${path}/optimize`, 'POST', {
    vehicleIds: [vehicle.id],
  });
  assert.equal(optimizedAgain.status, 200);
  assert.equal(
    await prisma.routeOptimization.count({ where: { routePlanId: plan.id } }),
    1,
  );
  assert.equal(
    (await a(`${path}/deliveries/${delivery.id}`, 'PATCH', { demand: 1 }))
      .status,
    200,
  );
  assert.equal(
    (await a(`${path}/deliveries/${delivery.id}`)).body.data
      .serviceDurationSeconds,
    30,
  );
  assert.equal((await a(`${path}/optimization`)).status, 404);
  assert.equal((await a(path)).body.data.status, 'draft');
  assert.equal(
    (await a(`${path}/deliveries/${delivery.id}`, 'PATCH', {})).status,
    422,
  );
  assert.equal((await a(`/vehicles/${vehicle.id}`, 'PATCH', {})).status, 422);
  assert.equal(
    (await a(`/vehicles/${vehicle.id}`, 'PATCH', { active: false })).status,
    200,
  );
  assert.equal(
    (await a(`/vehicles/${vehicle.id}`, 'PATCH', { name: 'Still inactive' }))
      .body.data.active,
    false,
  );
  assert.equal(
    (await a(`${path}/optimize`, 'POST', { vehicleIds: [vehicle.id] })).status,
    404,
  );
  await a(`/vehicles/${vehicle.id}`, 'PATCH', { active: true });

  const repository = new PrismaOptimizationRepository();
  const deliveryRepository = new PrismaDeliveryRepository();
  const engine = new CheapestInsertionOptimizer();
  const snapshot = await repository.loadSnapshot(
    accountA.id,
    plan.id,
    [vehicle.id],
    100,
  );
  const matrix = await GoogleMapsDistanceMatrixProvider.prototype.compute(
    snapshot.deliveries
      .map(() => ({ latitude: 0, longitude: 0 }))
      .concat({ latitude: 0, longitude: 0 }),
  );
  const computed = engine.optimize(snapshot, matrix);
  await deliveryRepository.update(accountA.id, plan.id, delivery.id, {
    demand: 2,
  });
  await assert.rejects(
    repository.save(snapshot, computed),
    (error: unknown) =>
      error instanceof AppError && error.code === 'CONCURRENT_MODIFICATION',
  );
  assert.equal(await repository.findByRoutePlanId(accountA.id, plan.id), null);
  const current = await repository.loadSnapshot(
    accountA.id,
    plan.id,
    [vehicle.id],
    100,
  );
  const saved = await repository.save(
    current,
    engine.optimize(current, matrix),
  );
  await assert.rejects(
    repository.save(current, computed),
    (error: unknown) =>
      error instanceof AppError && error.code === 'CONCURRENT_MODIFICATION',
  );
  assert.equal(
    (await repository.findByRoutePlanId(accountA.id, plan.id))!.id,
    saved.id,
  );
  const beforeVehicleChange = await repository.loadSnapshot(
    accountA.id,
    plan.id,
    [vehicle.id],
    100,
  );
  await a(`/vehicles/${vehicle.id}`, 'PATCH', { capacity: 20 });
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { updatedAt: beforeVehicleChange.vehicles[0]!.updatedAt },
  });
  await assert.rejects(
    repository.save(beforeVehicleChange, computed),
    (error: unknown) =>
      error instanceof AppError && error.code === 'CONCURRENT_MODIFICATION',
  );
  await a(path, 'PATCH', { name: 'Updated' });
  assert.equal((await a(`${path}/optimization`)).status, 404);
  assert.equal((await a(path)).body.data.status, 'draft');
  const competingSnapshot = await repository.loadSnapshot(
    accountA.id,
    plan.id,
    [vehicle.id],
    100,
  );
  const competingResult = engine.optimize(competingSnapshot, matrix);
  const competing = await Promise.allSettled([
    repository.save(competingSnapshot, competingResult),
    repository.save(competingSnapshot, competingResult),
  ]);
  assert.equal(
    competing.filter((entry) => entry.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    competing.filter((entry) => entry.status === 'rejected').length,
    1,
  );
  assert.equal(
    await prisma.routeOptimization.count({ where: { routePlanId: plan.id } }),
    1,
  );

  const keyRecord = await prisma.apiKey.findUniqueOrThrow({
    where: { id: keyA.id },
  });
  assert.ok(keyRecord.lastUsedAt);
  assert.notEqual(keyRecord.keyHash, keyA.key);
  await prisma.apiKey.update({
    where: { id: keyA.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal((await a('/route-plans')).status, 401);
  await prisma.apiKey.update({
    where: { id: keyA.id },
    data: { expiresAt: null },
  });
  await prisma.account.update({
    where: { id: accountA.id },
    data: { status: 'SUSPENDED' },
  });
  assert.equal((await a('/route-plans')).status, 401);
  await prisma.account.update({
    where: { id: accountA.id },
    data: { status: 'INACTIVE' },
  });
  assert.equal((await a('/route-plans')).status, 401);
  await prisma.account.update({
    where: { id: accountA.id },
    data: { status: 'ACTIVE', deletedAt: new Date() },
  });
  assert.equal((await a('/route-plans')).status, 401);
  await prisma.account.update({
    where: { id: accountA.id },
    data: { deletedAt: null },
  });
  assert.equal(
    (await a(`${path}/deliveries/${delivery.id}`, 'DELETE')).status,
    204,
  );
  assert.equal((await a(`${path}/optimization`)).status, 404);
  assert.equal((await a(path, 'DELETE')).status, 204);
  assert.equal(
    await prisma.delivery.count({ where: { routePlanId: plan.id } }),
    0,
  );
  assert.equal(
    await prisma.routeOptimization.count({ where: { routePlanId: plan.id } }),
    0,
  );
  assert.equal((await a(`/vehicles/${vehicle.id}`, 'DELETE')).status, 204);
  await adminRequest(`/accounts/${accountA.id}/api-keys/${keyA.id}`, 'DELETE');
  assert.equal((await a('/route-plans')).status, 401);
});
