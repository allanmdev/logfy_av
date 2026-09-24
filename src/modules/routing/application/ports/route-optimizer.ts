import {
  DistanceMatrix,
  OptimizationSnapshot,
  OptimizationResult,
} from '../../domain/entities/optimization.entity';

export interface RouteOptimizer {
  optimize(
    snapshot: OptimizationSnapshot,
    matrix: DistanceMatrix,
  ): OptimizationResult;
}
