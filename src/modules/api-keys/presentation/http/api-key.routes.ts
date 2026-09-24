import { Router } from 'express';

import { apiKeyController } from '../../../../shared/container/api-keys.container';
import { validate } from '../../../../shared/http/middlewares/validate';

import {
  createApiKeySchema,
  listApiKeysSchema,
  revokeApiKeySchema,
} from './api-key.schemas';

export const apiKeyRouter = Router({
  mergeParams: true,
});

apiKeyRouter.post(
  '/',
  validate(createApiKeySchema),
  apiKeyController.create,
);

apiKeyRouter.get(
  '/',
  validate(listApiKeysSchema),
  apiKeyController.index,
);

apiKeyRouter.delete(
  '/:apiKeyId',
  validate(revokeApiKeySchema),
  apiKeyController.revoke,
);