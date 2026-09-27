import assert from "node:assert/strict";
import { mock, test, TestContext } from "node:test";
import { CreateRoutePlanUseCase } from "../src/modules/route-plans/application/use-cases/create-route-plan.use-case";
import { RoutePlanRepository } from "../src/modules/route-plans/domain/repositories/route-plan.repository";
import { CreateDeliveryUseCase } from "../src/modules/deliveries/application/use-cases/create-delivery.use-case";
import { DeliveryRepository } from "../src/modules/deliveries/domain/repositories/delivery.repository";
import { OptimizeRoutePlanUseCase } from "../src/modules/routing/application/use-cases/optimize-route-plan.use-case";
import { DistanceMatrixProvider } from "../src/modules/routing/application/ports/distance-matrix.provider";
import { OptimizationRepository } from "../src/modules/routing/domain/repositories/optimization.repository";
import {
  DistanceMatrix,
  OptimizationSnapshot,
  OptimizedRoute,
} from "../src/modules/routing/domain/entities/optimization.entity";
import { CheapestInsertionOptimizer } from "../src/modules/routing/infrastructure/optimization/cheapest-insertion.optimizer";

const now = new Date("2026-09-24T08:00:00.000Z");
const accountId = "transportadora-teste";
const unused = async (): Promise<never> => {
  throw new Error("Operação inesperada");
};

function creationFixture() {
  let planSequence = 0;
  let deliverySequence = 0;
  const createPlan = mock.fn<RoutePlanRepository["create"]>(
    async (owner, data) => ({
      ...data,
      id: `plan-${++planSequence}`,
      accountId: owner,
      status: "draft",
      version: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const createDelivery = mock.fn<DeliveryRepository["create"]>(
    async (owner, routePlanId, data) => ({
      ...data,
      id: `delivery-${++deliverySequence}`,
      accountId: owner,
      routePlanId,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return {
    createPlan,
    createDelivery,
    plans: new CreateRoutePlanUseCase({
      create: createPlan,
      findById: unused,
      findMany: unused,
      update: unused,
      delete: unused,
    }),
    deliveries: new CreateDeliveryUseCase({
      create: createDelivery,
      findById: unused,
      findMany: unused,
      update: unused,
      delete: unused,
    }),
  };
}

async function journeyFixture() {
  const fixture = creationFixture();
  const plan = await fixture.plans.execute(accountId, {
    name: "Entregas da Ana",
    depotLatitude: -26.3,
    depotLongitude: -48.8,
  });
  const deliveries = await Promise.all(
    [3, 1, 2].map((position, index) =>
      fixture.deliveries.execute(accountId, plan.id, {
        reference: `PEDIDO-${index + 1}`,
        latitude: -26.3 + position * 0.001,
        longitude: -48.8,
        demand: 1,
        serviceDurationSeconds: 60,
      }),
    ),
  );
  const snapshot: OptimizationSnapshot = {
    plan,
    deliveries,
    vehicles: [
      {
        id: "van-ana",
        accountId,
        name: "Van da Ana",
        capacity: 3,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  const positions = [0, 3, 1, 2];
  const matrix: DistanceMatrix = {
    provider: "simulacao-local",
    costs: positions.map((from) =>
      positions.map((to) => ({
        distanceMeters: Math.abs(from - to) * 1000,
        durationSeconds: Math.abs(from - to) * 100,
      })),
    ),
  };
  return { snapshot, matrix };
}

function simulate(
  t: TestContext,
  snapshot: OptimizationSnapshot,
  matrix: DistanceMatrix,
  ids: string[],
) {
  let previous = 0;
  let elapsed = 0;
  let distance = 0;
  const events: {
    event: string;
    driver: string;
    deliveryId?: string;
    elapsed: number;
    timestamp: string;
  }[] = [];
  const log = (event: string, deliveryId?: string) => {
    const entry = {
      event,
      driver: "Ana",
      ...(deliveryId ? { deliveryId } : {}),
      elapsed,
      timestamp: new Date(now.getTime() + elapsed * 1000).toISOString(),
    };
    events.push(entry);
    t.diagnostic(JSON.stringify(entry));
  };
  log("saida_do_deposito");
  for (const id of ids) {
    const index = snapshot.deliveries.findIndex(
      (delivery) => delivery.id === id,
    );
    assert.ok(index >= 0);
    const delivery = snapshot.deliveries[index]!;
    const leg = matrix.costs[previous]![index + 1]!;
    assert.ok(leg);
    elapsed += leg.durationSeconds;
    distance += leg.distanceMeters;
    log("chegada", id);
    elapsed += delivery.serviceDurationSeconds;
    log("entrega_concluida", id);
    previous = index + 1;
  }
  const back = matrix.costs[previous]![0]!;
  assert.ok(back);
  elapsed += back.durationSeconds;
  distance += back.distanceMeters;
  log("retorno_ao_deposito");
  t.diagnostic(
    JSON.stringify({
      driver: "Ana",
      distanceMeters: distance,
      durationSeconds: elapsed,
    }),
  );
  return { events, distance, elapsed };
}

test("cria várias rotas com entregas vinculadas à conta e ao plano correto", async () => {
  const fixture = creationFixture();
  const plans = await Promise.all(
    ["Norte", "Sul", "Centro"].map((name) =>
      fixture.plans.execute(accountId, {
        name,
        depotLatitude: -26.3,
        depotLongitude: -48.8,
      }),
    ),
  );
  assert.equal(new Set(plans.map((plan) => plan.id)).size, 3);
  for (const plan of plans) {
    assert.equal(plan.accountId, accountId);
    assert.equal(plan.status, "draft");
    for (let index = 0; index < 4; index++) {
      const input = {
        reference: `${plan.name}-${index}`,
        latitude: -26.31,
        longitude: -48.81,
        demand: index + 1,
        serviceDurationSeconds: 120,
      };
      const delivery = await fixture.deliveries.execute(
        accountId,
        plan.id,
        input,
      );
      assert.equal(delivery.routePlanId, plan.id);
      assert.equal(delivery.accountId, accountId);
      assert.deepEqual(fixture.createDelivery.mock.calls.at(-1)!.arguments, [
        accountId,
        plan.id,
        input,
      ]);
    }
  }
  assert.equal(fixture.createPlan.mock.callCount(), 3);
  assert.equal(fixture.createDelivery.mock.callCount(), 12);
  assert.deepEqual(
    fixture.createPlan.mock.calls.map((call) => call.arguments),
    ["Norte", "Sul", "Centro"].map((name) => [
      accountId,
      { name, depotLatitude: -26.3, depotLongitude: -48.8 },
    ]),
  );
});

test("simula Ana fazendo entregas na ordem de cadastro com logs de cada etapa", async (t) => {
  const { snapshot, matrix } = await journeyFixture();
  const ids = snapshot.deliveries.map((delivery) => delivery.id);
  const journey = simulate(t, snapshot, matrix, ids);
  assert.deepEqual(
    journey.events.map((entry) => entry.event),
    [
      "saida_do_deposito",
      "chegada",
      "entrega_concluida",
      "chegada",
      "entrega_concluida",
      "chegada",
      "entrega_concluida",
      "retorno_ao_deposito",
    ],
  );
  assert.deepEqual(
    journey.events
      .filter((entry) => entry.event === "entrega_concluida")
      .map((entry) => entry.deliveryId),
    ids,
  );
  assert.deepEqual(
    journey.events.map((entry) => entry.elapsed),
    [0, 300, 360, 560, 620, 720, 780, 980],
  );
  assert.equal(journey.distance, 8000);
  assert.equal(journey.elapsed, 980);
  assert.equal(journey.events.at(-1)!.timestamp, "2026-09-24T08:16:20.000Z");
});

test("otimiza a jornada de entregas e reduz distância e tempo com logs", async (t) => {
  const { snapshot, matrix } = await journeyFixture();
  const loadSnapshot = mock.fn<OptimizationRepository["loadSnapshot"]>(
    async () => snapshot,
  );
  const save = mock.fn<OptimizationRepository["save"]>(
    async (input, result) => ({
      id: "optimization-1",
      accountId: input.plan.accountId,
      routePlanId: input.plan.id,
      createdAt: now,
      result,
    }),
  );
  const compute = mock.fn<DistanceMatrixProvider["compute"]>(
    async () => matrix,
  );
  const useCase = new OptimizeRoutePlanUseCase(
    { loadSnapshot, save, findByRoutePlanId: unused },
    { compute },
    new CheapestInsertionOptimizer(),
    100,
  );
  const optimized = await useCase.execute(accountId, snapshot.plan.id, [
    "van-ana",
  ]);
  assert.deepEqual(loadSnapshot.mock.calls[0]!.arguments, [
    accountId,
    snapshot.plan.id,
    ["van-ana"],
    100,
  ]);
  assert.deepEqual(compute.mock.calls[0]!.arguments, [
    [
      {
        latitude: snapshot.plan.depotLatitude,
        longitude: snapshot.plan.depotLongitude,
      },
      ...snapshot.deliveries.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
    ],
  ]);
  assert.equal(save.mock.callCount(), 1);
  assert.deepEqual(save.mock.calls[0]!.arguments, [snapshot, optimized.result]);
  assert.equal(optimized.result.routes.length, 1);
  const route: OptimizedRoute = optimized.result.routes[0]!;
  const ids = route.stops.map((stop) => stop.deliveryId);
  assert.deepEqual(
    [...ids].sort(),
    snapshot.deliveries.map((delivery) => delivery.id).sort(),
  );
  assert.equal(route.vehicleId, "van-ana");
  assert.equal(route.load, 3);
  assert.ok(route.load <= route.capacity);
  assert.deepEqual(
    route.stops.map((stop) => stop.sequence),
    [1, 2, 3],
  );
  const baseline = simulate(
    t,
    snapshot,
    matrix,
    snapshot.deliveries.map((delivery) => delivery.id),
  );
  const journey = simulate(t, snapshot, matrix, ids);
  const savedSeconds = baseline.elapsed - journey.elapsed;
  const savedPercentage = (savedSeconds / baseline.elapsed) * 100;
  const gasolineEfficiencyKmPerLiter = 10;
  const gasolineWithoutOptimizationLiters =
    baseline.distance / 1000 / gasolineEfficiencyKmPerLiter;
  const gasolineWithOptimizationLiters =
    journey.distance / 1000 / gasolineEfficiencyKmPerLiter;
  const savedGasolineLiters =
    gasolineWithoutOptimizationLiters - gasolineWithOptimizationLiters;
  const savedGasolinePercentage =
    (savedGasolineLiters / gasolineWithoutOptimizationLiters) * 100;
  assert.equal(gasolineWithoutOptimizationLiters, 0.8);
  assert.equal(gasolineWithOptimizationLiters, 0.6);
  assert.ok(Math.abs(savedGasolineLiters - 0.2) < 1e-9);
  assert.ok(Math.abs(savedGasolinePercentage - 25) < 1e-9);
  assert.ok(gasolineWithOptimizationLiters < gasolineWithoutOptimizationLiters);
  const formatDuration = (seconds: number) =>
    `${Math.floor(seconds / 60)}min ${String(seconds % 60).padStart(2, "0")}s`;
  assert.equal(baseline.elapsed, 980);
  assert.equal(savedSeconds, 200);
  assert.ok(savedPercentage >= 20);
  assert.equal(journey.distance, 6000);
  assert.equal(journey.elapsed, 780);
  assert.ok(journey.distance < baseline.distance);
  assert.ok(journey.elapsed < baseline.elapsed);
  assert.equal(optimized.result.totalDistanceMeters, journey.distance);
  assert.equal(optimized.result.totalDurationSeconds, journey.elapsed);
  assert.equal(route.totalDistanceMeters, journey.distance);
  assert.equal(route.totalDurationSeconds, journey.elapsed);
  assert.deepEqual(
    route.stops.map((stop) => stop.arrivalSeconds),
    journey.events
      .filter((entry) => entry.event === "chegada")
      .map((entry) => entry.elapsed),
  );
  t.diagnostic(
    `Tempo da rota sem otimização: ${formatDuration(baseline.elapsed)} (${baseline.elapsed}s)`,
  );
  t.diagnostic(
    `Tempo da rota com otimização: ${formatDuration(journey.elapsed)} (${journey.elapsed}s)`,
  );
  t.diagnostic(
    `Economia de tempo: ${formatDuration(savedSeconds)} (${savedPercentage.toFixed(2)}%)`,
  );
  t.diagnostic("Tempos simulados incluem deslocamento, atendimento e retorno ao depósito.");
  t.diagnostic(
    `Consumo estimado de gasolina considerando ${gasolineEfficiencyKmPerLiter} km/l constantes.`,
  );
  t.diagnostic(
    `Gasolina sem otimização: ${gasolineWithoutOptimizationLiters.toFixed(2)} L`,
  );
  t.diagnostic(
    `Gasolina com otimização: ${gasolineWithOptimizationLiters.toFixed(2)} L`,
  );
  t.diagnostic(
    `Economia de gasolina: ${savedGasolineLiters.toFixed(2)} L (${savedGasolinePercentage.toFixed(2)}%)`,
  );
  t.diagnostic(
    JSON.stringify({
      durationWithoutOptimizationSeconds: baseline.elapsed,
      durationWithOptimizationSeconds: journey.elapsed,
      savedMeters: baseline.distance - journey.distance,
      savedSeconds,
      savedPercentage: Number(savedPercentage.toFixed(2)),
      gasolineEfficiencyKmPerLiter,
      gasolineWithoutOptimizationLiters,
      gasolineWithOptimizationLiters,
      savedGasolineLiters: Number(savedGasolineLiters.toFixed(2)),
      savedGasolinePercentage: Number(savedGasolinePercentage.toFixed(2)),
    }),
  );
});
