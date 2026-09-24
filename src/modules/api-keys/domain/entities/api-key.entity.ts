import { Scope } from '../../../../shared/auth/scopes';

export interface ApiKey {
  id: string;

  accountId: string;

  name: string;

  prefix: string;

  scopes: Scope[];

  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}