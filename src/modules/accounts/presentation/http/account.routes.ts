import { Router } from 'express';

import { accountController } from '../../../../shared/container/accounts.container';
import { validate } from '../../../../shared/http/middlewares/validate';

import {
  createAccountSchema,
  listAccountsSchema,
  getAccountSchema,
  updateAccountSchema,
  patchAccountSchema,
  deleteAccountSchema,
} from './account.schemas';

export const accountRouter = Router();

accountRouter.post(
  '/',
  validate(createAccountSchema),
  accountController.create,
);

accountRouter.get(
  '/',
  validate(listAccountsSchema),
  accountController.index,
);

accountRouter.get(
  '/:id',
  validate(getAccountSchema),
  accountController.show,
);

accountRouter.put(
  '/:id',
  validate(updateAccountSchema),
  accountController.update,
);

accountRouter.patch(
  '/:id',
  validate(patchAccountSchema),
  accountController.patch,
);

accountRouter.delete(
  '/:id',
  validate(deleteAccountSchema),
  accountController.delete,
);