import { Router } from 'express';

import { apiKeyAuthentication } from '../container/auth.container';
import { requireAdmin } from './middlewares/require-admin';
import { routePlanRouter } from '../../modules/route-plans/presentation/http/route-plan.routes';
import { vehicleRouter } from '../../modules/vehicles/presentation/http/vehicle.routes';
import { accountRouter } from '../../modules/accounts/presentation/http/account.routes';
import { apiKeyRouter } from '../../modules/api-keys/presentation/http/api-key.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  return res.status(200).json({
    data: {
      service: 'logfy-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.use('/accounts/:accountId/api-keys', requireAdmin, apiKeyRouter);
apiRouter.use('/accounts', requireAdmin, accountRouter);

apiRouter.use('/route-plans', apiKeyAuthentication, routePlanRouter);
apiRouter.use('/vehicles', apiKeyAuthentication, vehicleRouter);
