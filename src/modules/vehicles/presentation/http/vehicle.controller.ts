import { NextFunction, Request, Response } from 'express';
import { getAuth } from '../../../../shared/auth/auth-context';
import { paginationSchema } from '../../../../shared/http/pagination';
import { CreateVehicleUseCase } from '../../application/use-cases/create-vehicle.use-case';
import { GetVehicleUseCase } from '../../application/use-cases/get-vehicle.use-case';
import { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from '../../application/use-cases/update-vehicle.use-case';
import { DeleteVehicleUseCase } from '../../application/use-cases/delete-vehicle.use-case';

export class VehicleController {
  constructor(
    private readonly createUseCase: CreateVehicleUseCase,
    private readonly getUseCase: GetVehicleUseCase,
    private readonly listUseCase: ListVehiclesUseCase,
    private readonly updateUseCase: UpdateVehicleUseCase,
    private readonly deleteUseCase: DeleteVehicleUseCase,
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
