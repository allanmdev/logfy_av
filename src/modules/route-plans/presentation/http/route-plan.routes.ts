import { routingController } from '../../../../shared/container/routing.container';
import { optimizeRoutePlanSchema } from '../../../routing/presentation/http/routing.schemas';
import { deliveryRouter } from '../../../deliveries/presentation/http/delivery.routes';
import { Router } from 'express';
import { routePlanController } from '../../../../shared/container/route-plans.container';
import { validate } from '../../../../shared/http/middlewares/validate';
import { requireScopes } from '../../../../shared/http/middlewares/require-scopes';
import { SCOPES } from '../../../../shared/auth/scopes';
import {
  createRoutePlanSchema,
  updateRoutePlanSchema,
  getRoutePlanSchema,
  listRoutePlanSchema,
} from './route-plan.schemas';

export const routePlanRouter = Router({ mergeParams: true });

routePlanRouter.post(
  '/',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(createRoutePlanSchema),
  routePlanController.create,
);

routePlanRouter.get(
  '/',
  requireScopes(SCOPES.ROUTING_READ),
  validate(listRoutePlanSchema),
  routePlanController.index,
);

routePlanRouter.get(
  '/:id',
  requireScopes(SCOPES.ROUTING_READ),
  validate(getRoutePlanSchema),
  routePlanController.show,
);

routePlanRouter.patch(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(updateRoutePlanSchema),
  routePlanController.update,
);

routePlanRouter.delete(
  '/:id',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(getRoutePlanSchema),
  routePlanController.delete,
);

routePlanRouter.post(
  '/:id/optimize',
  requireScopes(SCOPES.ROUTING_WRITE),
  validate(optimizeRoutePlanSchema),
  routingController.optimize,
);
routePlanRouter.get(
  '/:id/optimization',
  requireScopes(SCOPES.ROUTING_READ),
  validate(getRoutePlanSchema),
  routingController.show,
);
routePlanRouter.use('/:routePlanId/deliveries', deliveryRouter);
