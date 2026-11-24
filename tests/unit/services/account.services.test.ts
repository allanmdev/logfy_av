import { beforeEach, describe, expect, it } from 'vitest';
import { CreateAccountUseCase } from '../../../src/modules/accounts/application/use-cases/create-account.use-case';
import { GetAccountUseCase } from '../../../src/modules/accounts/application/use-cases/get-account.use-case';
import { ListAccountsUseCase } from '../../../src/modules/accounts/application/use-cases/list-accounts.use-case';
import { UpdateAccountUseCase } from '../../../src/modules/accounts/application/use-cases/update-account.use-case';
import { DeleteAccountUseCase } from '../../../src/modules/accounts/application/use-cases/delete-account.use-case';
import { CreateApiKeyUseCase } from '../../../src/modules/api-keys/application/use-cases/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../../src/modules/api-keys/application/use-cases/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../../src/modules/api-keys/application/use-cases/revoke-api-key.use-case';
import { AccountStatus } from '../../../src/modules/accounts/domain/entities/account.entity';
import {
  ACCOUNT_ID,
  accountRepositoryMock,
  apiKeyRepositoryMock,
  makeAccount,
  now,
} from '../../support/factories';

describe('Serviços de empresas e API Keys', () => {
  let accounts: ReturnType<typeof accountRepositoryMock>;
  let apiKeys: ReturnType<typeof apiKeyRepositoryMock>;

  beforeEach(() => {
    accounts = accountRepositoryMock();
    apiKeys = apiKeyRepositoryMock();
  });

  it('cadastra empresa com slug disponível', async () => {
    accounts.findBySlug.mockResolvedValue(null);
    accounts.create.mockResolvedValue(makeAccount());

    await expect(
      new CreateAccountUseCase(accounts).execute({ name: 'Transportadora', slug: 'transportadora' }),
    ).resolves.toMatchObject({ slug: 'transportadora' });
  });

  it('impede cadastrar empresa com slug já utilizado', async () => {
    accounts.findBySlug.mockResolvedValue(makeAccount());

    await expect(
      new CreateAccountUseCase(accounts).execute({ name: 'Outra', slug: 'transportadora' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_ALREADY_EXISTS', statusCode: 409 });
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it('retorna 404 ao consultar ou excluir empresa inexistente', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(new GetAccountUseCase(accounts).execute(ACCOUNT_ID)).rejects.toMatchObject({ statusCode: 404 });
    await expect(new DeleteAccountUseCase(accounts).execute(ACCOUNT_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(accounts.softDelete).not.toHaveBeenCalled();
  });

  it('exclui logicamente a empresa existente', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    await new DeleteAccountUseCase(accounts).execute(ACCOUNT_ID);
    expect(accounts.softDelete).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('impede alterar o slug para um já utilizado por outra empresa', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    accounts.findBySlug.mockResolvedValue(makeAccount({ id: 'other', slug: 'ocupado' }));

    await expect(
      new UpdateAccountUseCase(accounts).execute(ACCOUNT_ID, { slug: 'ocupado' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_SLUG_ALREADY_EXISTS' });
  });

  it('suspende a empresa existente', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    accounts.update.mockResolvedValue(makeAccount({ status: AccountStatus.SUSPENDED }));

    await expect(
      new UpdateAccountUseCase(accounts).execute(ACCOUNT_ID, { status: AccountStatus.SUSPENDED }),
    ).resolves.toMatchObject({ status: 'suspended' });
  });

  it('retorna 404 ao atualizar empresa inexistente', async () => {
    accounts.findById.mockResolvedValue(null);
    await expect(
      new UpdateAccountUseCase(accounts).execute(ACCOUNT_ID, { name: 'X' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });

  it('lista empresas com paginação', async () => {
    accounts.findMany.mockResolvedValue({ data: [makeAccount()], total: 3 });
    const result = await new ListAccountsUseCase(accounts).execute({ page: 1, limit: 2, deleted: 'all' });
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('emite API Key armazenando apenas o hash e devolvendo a chave uma única vez', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    apiKeys.create.mockImplementation(async (data) => ({
      id: 'key-id',
      accountId: data.accountId,
      name: data.name,
      prefix: data.prefix,
      scopes: data.scopes,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await new CreateApiKeyUseCase(apiKeys, accounts).execute({
      accountId: ACCOUNT_ID,
      name: 'ERP',
      scopes: ['routing:read'],
    });

    expect(result.key).toMatch(/^lgfy_test_[a-f0-9]{64}$/);
    const stored = apiKeys.create.mock.calls[0]![0];
    expect(stored.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.keyHash).not.toContain(result.key);
  });

  it('não emite, lista ou revoga chaves de empresa inexistente', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(
      new CreateApiKeyUseCase(apiKeys, accounts).execute({ accountId: ACCOUNT_ID, name: 'X', scopes: ['routing:read'] }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    await expect(new ListApiKeysUseCase(apiKeys, accounts).execute(ACCOUNT_ID)).rejects.toMatchObject({ statusCode: 404 });
    await expect(new RevokeApiKeyUseCase(apiKeys, accounts).execute(ACCOUNT_ID, 'key')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('retorna 404 ao revogar chave inexistente ou já revogada', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    apiKeys.revoke.mockResolvedValue(false);

    await expect(
      new RevokeApiKeyUseCase(apiKeys, accounts).execute(ACCOUNT_ID, 'key'),
    ).rejects.toMatchObject({ code: 'API_KEY_NOT_FOUND' });
  });

  it('lista e revoga chaves de empresa existente', async () => {
    accounts.findById.mockResolvedValue(makeAccount());
    apiKeys.findManyByAccountId.mockResolvedValue([]);
    apiKeys.revoke.mockResolvedValue(true);

    await expect(new ListApiKeysUseCase(apiKeys, accounts).execute(ACCOUNT_ID)).resolves.toEqual([]);
    await expect(new RevokeApiKeyUseCase(apiKeys, accounts).execute(ACCOUNT_ID, 'key')).resolves.toBeUndefined();
  });
});
