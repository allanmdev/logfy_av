import { NextFunction, Request, Response } from 'express';
import { getAuth } from '../../../../shared/auth/auth-context';
import { paginationSchema } from '../../../../shared/http/pagination';
import { CreateDeliveryUseCase } from '../../application/use-cases/create-delivery.use-case';
import { GetDeliveryUseCase } from '../../application/use-cases/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../../application/use-cases/list-deliveries.use-case';
import { UpdateDeliveryUseCase } from '../../application/use-cases/update-delivery.use-case';
import { DeleteDeliveryUseCase } from '../../application/use-cases/delete-delivery.use-case';

export class DeliveryController {
  constructor(
    private readonly createUseCase: CreateDeliveryUseCase,
    private readonly getUseCase: GetDeliveryUseCase,
    private readonly listUseCase: ListDeliveriesUseCase,
    private readonly updateUseCase: UpdateDeliveryUseCase,
    private readonly deleteUseCase: DeleteDeliveryUseCase,
  ) {}

  create = async (
    req: Request<{ id: string; routePlanId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(
        getAuth(req).accountId,
        req.params.routePlanId,
        req.body,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  show = async (
    req: Request<{ id: string; routePlanId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.getUseCase.execute(
        getAuth(req).accountId,
        req.params.routePlanId,
        req.params.id,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  index = async (
    req: Request<{ id: string; routePlanId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.listUseCase.execute(
        getAuth(req).accountId,
        req.params.routePlanId,
        paginationSchema.parse(req.query),
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<{ id: string; routePlanId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute(
        getAuth(req).accountId,
        req.params.routePlanId,
        req.params.id,
        req.body,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<{ id: string; routePlanId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.deleteUseCase.execute(
        getAuth(req).accountId,
        req.params.routePlanId,
        req.params.id,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
