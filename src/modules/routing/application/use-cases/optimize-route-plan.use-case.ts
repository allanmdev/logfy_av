import { AppError } from '../../../../shared/errors/app-error';
import { OptimizationRepository } from '../../domain/repositories/optimization.repository';
import { DistanceMatrixProvider } from '../ports/distance-matrix.provider';
import { RouteOptimizer } from '../ports/route-optimizer';

export class OptimizeRoutePlanUseCase {
  constructor(
    private readonly repository: OptimizationRepository,
    private readonly matrixProvider: DistanceMatrixProvider,
    private readonly optimizer: RouteOptimizer,
    private readonly maxDeliveries: number,
  ) {}

  async execute(accountId: string, routePlanId: string, vehicleIds: string[]) {
    if (
      !vehicleIds.length ||
      vehicleIds.length > 100 ||
      new Set(vehicleIds).size !== vehicleIds.length
    ) {
      throw new AppError(
        'INVALID_VEHICLES',
        422,
        'Select between 1 and 100 distinct vehicles.',
      );
    }
    const snapshot = await this.repository.loadSnapshot(
      accountId,
      routePlanId,
      vehicleIds,
      this.maxDeliveries,
    );
    if (!snapshot.deliveries.length) {
      throw new AppError(
        'EMPTY_ROUTE_PLAN',
        422,
        'Add deliveries before optimizing.',
      );
    }
    if (snapshot.deliveries.length > this.maxDeliveries) {
      throw new AppError(
        'ROUTE_PLAN_TOO_LARGE',
        422,
        `At most ${this.maxDeliveries} deliveries can be optimized.`,
      );
    }
    const capacity = snapshot.vehicles.reduce(
      (sum, vehicle) => sum + vehicle.capacity,
      0,
    );
    const demand = snapshot.deliveries.reduce(
      (sum, delivery) => sum + delivery.demand,
      0,
    );
    const largestCapacity = Math.max(
      ...snapshot.vehicles.map((vehicle) => vehicle.capacity),
    );
    if (
      demand > capacity ||
      snapshot.deliveries.some((delivery) => delivery.demand > largestCapacity)
    ) {
      throw new AppError(
        'INSUFFICIENT_CAPACITY',
        422,
        'The selected vehicles cannot carry these deliveries.',
      );
    }
    const matrix = await this.matrixProvider.compute([
      {
        latitude: snapshot.plan.depotLatitude,
        longitude: snapshot.plan.depotLongitude,
      },
      ...snapshot.deliveries.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
    ]);
    const result = this.optimizer.optimize(snapshot, matrix);
    return this.repository.save(snapshot, result);
  }
}
