import { Router } from 'express';
import { deliveryController } from '../../../../shared/container/deliveries.container';
import { validate } from '../../../../shared/http/middlewares/validate';
import { requireScopes } from '../../../../shared/http/middlewares/require-scopes';
import { SCOPES } from '../../../../shared/auth/scopes';
import {
  createDeliverySchema,
  updateDeliverySchema,
  getDeliverySchema,
  listDeliverySchema,
} from './delivery.schemas';

export const deliveryRouter = Router({ mergeParams: true });

deliveryRouter.post(
  '/',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(createDeliverySchema),
  deliveryController.create,
);

deliveryRouter.get(
  '/',
  requireScopes(SCOPES.ROUTING_READ),
  validate(listDeliverySchema),
  deliveryController.index,
);

deliveryRouter.get(
  '/:id',
  requireScopes(SCOPES.ROUTING_READ),
  validate(getDeliverySchema),
  deliveryController.show,
);

deliveryRouter.patch(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(updateDeliverySchema),
  deliveryController.update,
);

deliveryRouter.delete(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(getDeliverySchema),
  deliveryController.delete,
);
