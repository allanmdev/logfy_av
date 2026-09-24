import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CheapestInsertionOptimizer } from '../src/modules/routing/infrastructure/optimization/cheapest-insertion.optimizer';
import {
  DistanceMatrix,
  OptimizationSnapshot,
} from '../src/modules/routing/domain/entities/optimization.entity';
import { AppError } from '../src/shared/errors/app-error';
import { OptimizeRoutePlanUseCase } from '../src/modules/routing/application/use-cases/optimize-route-plan.use-case';
import { OptimizationRepository } from '../src/modules/routing/domain/repositories/optimization.repository';

const now = new Date();
function snapshot(demands = [2, 3], capacities = [5]): OptimizationSnapshot {
  return {
    plan: {
      id: 'plan',
      accountId: 'account',
      name: 'Plan',
      depotLatitude: 0,
      depotLongitude: 0,
      status: 'draft',
      version: 0,
      createdAt: now,
      updatedAt: now,
    },
    deliveries: demands.map((demand, i) => ({
      id: `delivery-${i}`,
      reference: `D${i}`,
      accountId: 'account',
      routePlanId: 'plan',
      latitude: i,
      longitude: i,
      demand,
      serviceDurationSeconds: 7,
      createdAt: now,
      updatedAt: now,
    })),
    vehicles: capacities.map((capacity, i) => ({
      id: `vehicle-${i}`,
      accountId: 'account',
      name: `V${i}`,
      capacity,
      active: true,
      createdAt: now,
      updatedAt: now,
    })),
  };
}
function matrix(size: number): DistanceMatrix {
  return {
    provider: 'fixture',
    costs: Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => ({
        distanceMeters: i === j ? 0 : 100,
        durationSeconds: i === j ? 0 : 10,
      })),
    ),
  };
}
const optimizer = new CheapestInsertionOptimizer();

test('optimizer uses directed travel costs, service durations and return to depot', () => {
  const input = snapshot();
  const costs: DistanceMatrix = {
    provider: 'fixture',
    costs: [
      [
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 10, durationSeconds: 1 },
        { distanceMeters: 100, durationSeconds: 10 },
      ],
      [
        { distanceMeters: 100, durationSeconds: 10 },
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 20, durationSeconds: 2 },
      ],
      [
        { distanceMeters: 30, durationSeconds: 3 },
        { distanceMeters: 100, durationSeconds: 10 },
        { distanceMeters: 0, durationSeconds: 0 },
      ],
    ],
  };
  const result = optimizer.optimize(input, costs);
  const route = result.routes[0]!;
  assert.deepEqual(
    route.stops.map((stop) => stop.deliveryId),
    ['delivery-0', 'delivery-1'],
  );
  assert.deepEqual(
    route.stops.map((stop) => stop.arrivalSeconds),
    [1, 10],
  );
  assert.deepEqual(
    route.stops.map((stop) => stop.sequence),
    [1, 2],
  );
  assert.equal(result.totalDistanceMeters, 60);
  assert.equal(result.totalDurationSeconds, 20);
  assert.equal(route.load, 5);
  assert.equal(route.returnToDepot.durationSeconds, 3);
  assert.equal(input.deliveries[0]!.id, 'delivery-0');
});

test('optimizer assigns each delivery once and respects individual vehicle capacities', () => {
  const result = optimizer.optimize(snapshot([3, 3, 2, 2], [5, 5]), matrix(5));
  assert.equal(result.routes.length, 2);
  const ids = result.routes.flatMap((route) =>
    route.stops.map((stop) => stop.deliveryId),
  );
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  for (const route of result.routes) assert.ok(route.load <= route.capacity);
});

test('unreachable deliveries and insufficient capacities never produce partial results', () => {
  const inaccessible = matrix(3);
  inaccessible.costs[0]![1] = null;
  inaccessible.costs[2]![1] = null;
  for (const [input, costs] of [
    [snapshot(), inaccessible],
    [snapshot([6], [5]), matrix(2)],
  ] as const) {
    assert.throws(
      () => optimizer.optimize(input, costs),
      (error: unknown) =>
        error instanceof AppError && error.code === 'OPTIMIZATION_INCOMPLETE',
    );
  }
});

test('optimizer rejects invalid matrix dimensions and negative costs', () => {
  assert.throws(() => optimizer.optimize(snapshot(), matrix(2)), AppError);
  const invalid = matrix(3);
  invalid.costs[0]![1]!.durationSeconds = -1;
  assert.throws(() => optimizer.optimize(snapshot(), invalid), AppError);
});

test('use case rejects infeasible input before calling a paid provider and never saves failed computations', async () => {
  let current = snapshot([6], [5]);
  let calls = 0;
  let saves = 0;
  const repository = {
    loadSnapshot: async () => current,
    save: async () => {
      saves++;
      throw new Error('Unexpected save');
    },
    findByRoutePlanId: async () => null,
  } satisfies OptimizationRepository;
  const useCase = new OptimizeRoutePlanUseCase(
    repository,
    {
      compute: async () => {
        calls++;
        throw new Error('Provider failed');
      },
    },
    optimizer,
    100,
  );
  await assert.rejects(
    useCase.execute('account', 'plan', ['vehicle']),
    (error: unknown) =>
      error instanceof AppError && error.code === 'INSUFFICIENT_CAPACITY',
  );
  assert.equal(calls, 0);
  current = snapshot();
  await assert.rejects(
    useCase.execute('account', 'plan', ['vehicle']),
    /Provider failed/,
  );
  assert.equal(calls, 1);
  assert.equal(saves, 0);
  await assert.rejects(
    useCase.execute('account', 'plan', ['vehicle', 'vehicle']),
    AppError,
  );
});
