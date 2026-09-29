import {
  DistanceMatrix,
  OptimizationSnapshot,
  OptimizationResult,
  OptimizationOptions,
} from '../../domain/entities/optimization.entity';

export interface RouteOptimizer {
  optimize(
    snapshot: OptimizationSnapshot,
    matrix: DistanceMatrix,
    options: OptimizationOptions,
  ): OptimizationResult;
}
