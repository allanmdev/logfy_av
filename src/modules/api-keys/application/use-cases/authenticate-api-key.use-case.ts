import { createHash } from 'node:crypto';
import { ApiKeyRepository } from '../../domain/repositories/api-key.repository';
import { AuthContext } from '../../../../shared/auth/auth-context';
import { AppError } from '../../../../shared/errors/app-error';

export class AuthenticateApiKeyUseCase {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async execute(key: string): Promise<AuthContext> {
    if (!/^lgfy_test_[a-f0-9]{64}$/.test(key)) {
      throw new AppError('UNAUTHORIZED', 401, 'A valid API key is required.');
    }
    const hash = createHash('sha256').update(key).digest('hex');
    const record = await this.apiKeyRepository.findForAuthentication(hash);
    if (
      !record ||
      record.revokedAt ||
      (record.expiresAt && record.expiresAt.getTime() <= Date.now()) ||
      record.accountStatus !== 'ACTIVE' ||
      record.accountDeletedAt
    ) {
      throw new AppError('UNAUTHORIZED', 401, 'A valid API key is required.');
    }
    await this.apiKeyRepository.updateLastUsedAt(record.id);
    return {
      accountId: record.accountId,
      apiKeyId: record.id,
      scopes: record.scopes,
    };
  }
}
