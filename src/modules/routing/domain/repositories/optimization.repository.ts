import {
  OptimizationSnapshot,
  OptimizationResult,
  RouteOptimization,
} from '../entities/optimization.entity';

export interface OptimizationRepository {
  loadSnapshot(
    accountId: string,
    routePlanId: string,
    vehicleIds: string[],
    maxDeliveries: number,
  ): Promise<OptimizationSnapshot>;
  save(
    snapshot: OptimizationSnapshot,
    result: OptimizationResult,
  ): Promise<RouteOptimization>;
  findByRoutePlanId(
    accountId: string,
    routePlanId: string,
  ): Promise<RouteOptimization | null>;
}
