import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { CreateApiKeyUseCase } from '../../application/use-cases/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../application/use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../application/use-cases/revoke-api-key.use-case';

export class ApiKeyController {
  constructor(
    private readonly createApiKeyUseCase: CreateApiKeyUseCase,
    private readonly listApiKeysUseCase: ListApiKeysUseCase,
    private readonly revokeApiKeyUseCase: RevokeApiKeyUseCase,
  ) {}

  create = async (
    req: Request<{ accountId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const apiKey =
        await this.createApiKeyUseCase.execute({
          accountId: req.params.accountId,
          name: req.body.name,
          scopes: req.body.scopes,
          expiresAt: req.body.expiresAt,
        });

      res.status(201).json({
        data: apiKey,
      });
    } catch (error) {
      next(error);
    }
  };

  index = async (
    req: Request<{ accountId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const apiKeys =
        await this.listApiKeysUseCase.execute(
          req.params.accountId,
        );

      res.status(200).json({
        data: apiKeys,
      });
    } catch (error) {
      next(error);
    }
  };

  revoke = async (
    req: Request<{ accountId: string; apiKeyId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.revokeApiKeyUseCase.execute(
        req.params.accountId,
        req.params.apiKeyId,
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
