import { Scope } from '../../../../shared/auth/scopes';
import { ApiKey } from '../entities/api-key.entity';

export interface CreateApiKeyData {
  accountId: string;
  name: string;

  prefix: string;
  keyHash: string;

  scopes: Scope[];

  expiresAt?: Date | null;
}

export interface ApiKeyAuthenticationData {
  id: string;

  accountId: string;

  keyHash: string;

  scopes: Scope[];

  expiresAt: Date | null;
  revokedAt: Date | null;

  accountStatus: string;
  accountDeletedAt: Date | null;
}

export interface ApiKeyRepository {
  create(data: CreateApiKeyData): Promise<ApiKey>;

  findManyByAccountId(
    accountId: string,
  ): Promise<ApiKey[]>;

  findForAuthentication(
    keyHash: string,
  ): Promise<ApiKeyAuthenticationData | null>;

  revoke(
    id: string,
    accountId: string,
  ): Promise<boolean>;

  updateLastUsedAt(id: string): Promise<void>;
}