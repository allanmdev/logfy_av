import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case';
import { GetAccountUseCase } from '../../application/use-cases/get-account.use-case';
import { ListAccountsUseCase } from '../../application/use-cases/list-accounts.use-case';
import { UpdateAccountUseCase } from '../../application/use-cases/update-account.use-case';
import { DeleteAccountUseCase } from '../../application/use-cases/delete-account.use-case';

import { listAccountsQuerySchema } from './account.schemas';

export class AccountController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly getAccountUseCase: GetAccountUseCase,
    private readonly listAccountsUseCase: ListAccountsUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const account =
        await this.createAccountUseCase.execute({
          name: req.body.name,
          slug: req.body.slug,
        });

      res.status(201).json({
        data: account,
      });
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
      const account =
        await this.getAccountUseCase.execute(
          req.params.id,
        );

      res.status(200).json({
        data: account,
      });
    } catch (error) {
      next(error);
    }
  };

  index = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = listAccountsQuerySchema.parse(req.query);
      const result = await this.listAccountsUseCase.execute(query);

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
    const account =
      await this.updateAccountUseCase.execute(
        req.params.id,
        {
          name: req.body.name,
          slug: req.body.slug,
          status: req.body.status,
        },
      );

    res.status(200).json({
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

patch = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const account =
      await this.updateAccountUseCase.execute(
        req.params.id,
        req.body,
      );

    res.status(200).json({
      data: account,
    });
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
    await this.deleteAccountUseCase.execute(
      req.params.id,
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
}

