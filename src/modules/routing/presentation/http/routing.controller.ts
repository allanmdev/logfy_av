import { NextFunction, Request, Response } from 'express';
import { getAuth } from '../../../../shared/auth/auth-context';
import { OptimizeRoutePlanUseCase } from '../../application/use-cases/optimize-route-plan.use-case';
import { GetRouteOptimizationUseCase } from '../../application/use-cases/get-route-optimization.use-case';

export class RoutingController {
  constructor(
    private readonly optimizeRoutePlanUseCase: OptimizeRoutePlanUseCase,
    private readonly getRouteOptimizationUseCase: GetRouteOptimizationUseCase,
  ) {}

  optimize = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.optimizeRoutePlanUseCase.execute(
        getAuth(req).accountId,
        req.params.id,
        req.body.vehicleIds,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  show = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.getRouteOptimizationUseCase.execute(
        getAuth(req).accountId,
        req.params.id,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}
