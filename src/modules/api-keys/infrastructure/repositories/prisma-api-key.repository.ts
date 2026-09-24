import { ApiKey as PrismaApiKey } from '@prisma/client';

import { Scope } from '../../../../shared/auth/scopes';
import { prisma } from '../../../../shared/database/prisma';

import { ApiKey } from '../../domain/entities/api-key.entity';
import {
  ApiKeyAuthenticationData,
  ApiKeyRepository,
  CreateApiKeyData,
} from '../../domain/repositories/api-key.repository';

export class PrismaApiKeyRepository
  implements ApiKeyRepository
{
  async create(
    data: CreateApiKeyData,
  ): Promise<ApiKey> {
    const apiKey = await prisma.apiKey.create({
      data: {
        accountId: data.accountId,
        name: data.name,
        prefix: data.prefix,
        keyHash: data.keyHash,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
      },
    });

    return this.toDomain(apiKey);
  }

  async findManyByAccountId(
    accountId: string,
  ): Promise<ApiKey[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        accountId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiKeys.map((apiKey) =>
      this.toDomain(apiKey),
    );
  }

  async findForAuthentication(
    keyHash: string,
  ): Promise<ApiKeyAuthenticationData | null> {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        keyHash,
      },

      include: {
        account: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!apiKey) {
      return null;
    }

    return {
      id: apiKey.id,
      accountId: apiKey.accountId,
      keyHash: apiKey.keyHash,
      scopes: apiKey.scopes as Scope[],
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      accountStatus: apiKey.account.status,
      accountDeletedAt: apiKey.account.deletedAt,
    };
  }

  async revoke(
    id: string,
    accountId: string,
  ): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id,
        accountId,
        revokedAt: null,
      },

      data: {
        revokedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async updateLastUsedAt(
    id: string,
  ): Promise<void> {
    await prisma.apiKey.update({
      where: {
        id,
      },

      data: {
        lastUsedAt: new Date(),
      },
    });
  }

  private toDomain(
    apiKey: PrismaApiKey,
  ): ApiKey {
    return {
      id: apiKey.id,
      accountId: apiKey.accountId,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes as Scope[],
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }
}
