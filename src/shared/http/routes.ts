import { Router } from 'express';
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

apiRouter.use('/accounts/:accountId/api-keys', apiKeyRouter);
apiRouter.use('/accounts', accountRouter);
