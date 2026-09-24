import { Scope } from '../../../../shared/auth/scopes';

export interface CreateApiKeyDTO {
  accountId: string;

  name: string;

  scopes: Scope[];

  expiresAt?: Date | null;
}