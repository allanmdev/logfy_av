import { Router } from 'express';
import { vehicleController } from '../../../../shared/container/vehicles.container';
import { validate } from '../../../../shared/http/middlewares/validate';
import { requireScopes } from '../../../../shared/http/middlewares/require-scopes';
import { SCOPES } from '../../../../shared/auth/scopes';
import {
  createVehicleSchema,
  updateVehicleSchema,
  getVehicleSchema,
  listVehicleSchema,
} from './vehicle.schemas';

export const vehicleRouter = Router({ mergeParams: true });

vehicleRouter.post(
  '/',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(createVehicleSchema),
  vehicleController.create,
);

vehicleRouter.get(
  '/',
  requireScopes(SCOPES.ROUTING_READ),
  validate(listVehicleSchema),
  vehicleController.index,
);

vehicleRouter.get(
  '/:id',
  requireScopes(SCOPES.ROUTING_READ),
  validate(getVehicleSchema),
  vehicleController.show,
);

vehicleRouter.patch(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(updateVehicleSchema),
  vehicleController.update,
);

vehicleRouter.delete(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(getVehicleSchema),
  vehicleController.delete,
);
