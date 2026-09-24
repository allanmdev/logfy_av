import { NextFunction, Request, Response } from 'express';
import { getAuth } from '../../../../shared/auth/auth-context';
import { paginationSchema } from '../../../../shared/http/pagination';
import { CreateRoutePlanUseCase } from '../../application/use-cases/create-route-plan.use-case';
import { GetRoutePlanUseCase } from '../../application/use-cases/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../../application/use-cases/list-route-plans.use-case';
import { UpdateRoutePlanUseCase } from '../../application/use-cases/update-route-plan.use-case';
import { DeleteRoutePlanUseCase } from '../../application/use-cases/delete-route-plan.use-case';

export class RoutePlanController {
  constructor(
    private readonly createUseCase: CreateRoutePlanUseCase,
    private readonly getUseCase: GetRoutePlanUseCase,
    private readonly listUseCase: ListRoutePlansUseCase,
    private readonly updateUseCase: UpdateRoutePlanUseCase,
    private readonly deleteUseCase: DeleteRoutePlanUseCase,
  ) {}

  create = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(
        getAuth(req).accountId,
        req.body,
      );
      res.status(201).json({ data: result });
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
      const result = await this.getUseCase.execute(
        getAuth(req).accountId,
        req.params.id,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  index = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.listUseCase.execute(
        getAuth(req).accountId,
        paginationSchema.parse(req.query),
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute(
        getAuth(req).accountId,
        req.params.id,
        req.body,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.deleteUseCase.execute(getAuth(req).accountId, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
