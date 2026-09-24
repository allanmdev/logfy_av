import { env } from '../../config/env';
import { PrismaOptimizationRepository } from '../../modules/routing/infrastructure/repositories/prisma-optimization.repository';
import { GoogleMapsDistanceMatrixProvider } from '../../modules/routing/infrastructure/providers/google-maps-distance-matrix.provider';
import { CheapestInsertionOptimizer } from '../../modules/routing/infrastructure/optimization/cheapest-insertion.optimizer';
import { OptimizeRoutePlanUseCase } from '../../modules/routing/application/use-cases/optimize-route-plan.use-case';
import { GetRouteOptimizationUseCase } from '../../modules/routing/application/use-cases/get-route-optimization.use-case';
import { RoutingController } from '../../modules/routing/presentation/http/routing.controller';

const repository = new PrismaOptimizationRepository();
const matrixProvider = new GoogleMapsDistanceMatrixProvider(
  env.GOOGLE_MAPS_API_KEY,
  env.GOOGLE_MAPS_TIMEOUT_MS,
);
const optimizer = new CheapestInsertionOptimizer();

export const routingController = new RoutingController(
  new OptimizeRoutePlanUseCase(
    repository,
    matrixProvider,
    optimizer,
    env.ROUTING_MAX_DELIVERIES,
  ),
  new GetRouteOptimizationUseCase(repository),
);
