import { AppError } from '../../../../shared/errors/app-error';
import { RouteOptimizer } from '../../application/ports/route-optimizer';
import {
  DistanceMatrix,
  OptimizationSnapshot,
  OptimizationResult,
  TravelCost,
} from '../../domain/entities/optimization.entity';

export class CheapestInsertionOptimizer implements RouteOptimizer {
  optimize(
    snapshot: OptimizationSnapshot,
    matrix: DistanceMatrix,
  ): OptimizationResult {
    const count = snapshot.deliveries.length + 1;
    if (
      matrix.costs.length !== count ||
      matrix.costs.some(
        (row) =>
          row.length !== count ||
          row.some(
            (cost) =>
              cost !== null &&
              (!Number.isFinite(cost.distanceMeters) ||
                cost.distanceMeters < 0 ||
                !Number.isFinite(cost.durationSeconds) ||
                cost.durationSeconds < 0),
          ),
      )
    ) {
      throw new AppError(
        'INVALID_DISTANCE_MATRIX',
        502,
        'The distance matrix is invalid.',
      );
    }
    const cost = (from: number, to: number): TravelCost | null =>
      from === to
        ? { distanceMeters: 0, durationSeconds: 0 }
        : matrix.costs[from]![to]!;
    const routes = snapshot.vehicles.map((vehicle) => ({
      vehicle,
      load: 0,
      points: [0, 0],
    }));
    const deliveries = snapshot.deliveries
      .map((delivery, index) => ({ delivery, index: index + 1 }))
      .sort(
        (a, b) =>
          b.delivery.demand - a.delivery.demand ||
          a.delivery.id.localeCompare(b.delivery.id),
      );
    for (const { delivery, index } of deliveries) {
      let best: { route: number; position: number; delta: number } | undefined;
      for (const [routeIndex, route] of routes.entries()) {
        if (route.load + delivery.demand > route.vehicle.capacity) {
          continue;
        }
        for (let position = 1; position < route.points.length; position++) {
          const from = route.points[position - 1]!;
          const to = route.points[position]!;
          const incoming = cost(from, index);
          const outgoing = cost(index, to);
          const previous = cost(from, to);
          if (!incoming || !outgoing || !previous) {
            continue;
          }
          const delta =
            incoming.durationSeconds +
            outgoing.durationSeconds -
            previous.durationSeconds;
          if (!best || delta < best.delta) {
            best = { route: routeIndex, position, delta };
          }
        }
      }
      if (!best) {
        throw new AppError(
          'OPTIMIZATION_INCOMPLETE',
          422,
          'The heuristic could not assign all deliveries with the available capacity and reachable roads.',
        );
      }
      const route = routes[best.route]!;
      route.points.splice(best.position, 0, index);
      route.load += delivery.demand;
    }
    const optimized = routes
      .filter((route) => route.load > 0)
      .map((route) => {
        let elapsed = 0;
        let distance = 0;
        const stops = route.points.slice(1, -1).map((point, index) => {
          const delivery = snapshot.deliveries[point - 1]!;
          const leg = cost(route.points[index]!, point)!;
          elapsed += leg.durationSeconds;
          distance += leg.distanceMeters;
          const arrivalSeconds = elapsed;
          elapsed += delivery.serviceDurationSeconds;
          return {
            deliveryId: delivery.id,
            reference: delivery.reference,
            latitude: delivery.latitude,
            longitude: delivery.longitude,
            demand: delivery.demand,
            serviceDurationSeconds: delivery.serviceDurationSeconds,
            sequence: index + 1,
            arrivalSeconds,
            ...leg,
          };
        });
        const returnToDepot = cost(route.points[route.points.length - 2]!, 0)!;
        return {
          vehicleId: route.vehicle.id,
          vehicleName: route.vehicle.name,
          capacity: route.vehicle.capacity,
          load: route.load,
          stops,
          returnToDepot,
          totalDistanceMeters: distance + returnToDepot.distanceMeters,
          totalDurationSeconds: elapsed + returnToDepot.durationSeconds,
        };
      });
    return {
      algorithm: 'capacity-cheapest-insertion-v1',
      matrixProvider: matrix.provider,
      depot: {
        latitude: snapshot.plan.depotLatitude,
        longitude: snapshot.plan.depotLongitude,
      },
      routes: optimized,
      totalDistanceMeters: optimized.reduce(
        (sum, route) => sum + route.totalDistanceMeters,
        0,
      ),
      totalDurationSeconds: optimized.reduce(
        (sum, route) => sum + route.totalDurationSeconds,
        0,
      ),
    };
  }
}
