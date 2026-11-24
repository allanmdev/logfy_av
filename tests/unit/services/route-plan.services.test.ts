import { beforeEach, describe, expect, it } from 'vitest';
import { CreateRoutePlanUseCase } from '../../../src/modules/route-plans/application/use-cases/create-route-plan.use-case';
import { GetRoutePlanUseCase } from '../../../src/modules/route-plans/application/use-cases/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../../../src/modules/route-plans/application/use-cases/list-route-plans.use-case';
import { UpdateRoutePlanUseCase } from '../../../src/modules/route-plans/application/use-cases/update-route-plan.use-case';
import { DeleteRoutePlanUseCase } from '../../../src/modules/route-plans/application/use-cases/delete-route-plan.use-case';
import { ACCOUNT_ID, makeRoutePlan, routePlanRepositoryMock } from '../../support/factories';

describe('Serviços de planos de rota', () => {
  let repository: ReturnType<typeof routePlanRepositoryMock>;

  beforeEach(() => {
    repository = routePlanRepositoryMock();
  });

  describe('CreateRoutePlanUseCase', () => {
    it('cadastra o plano com depósito válido', async () => {
      repository.create.mockResolvedValue(makeRoutePlan());

      const result = await new CreateRoutePlanUseCase(repository).execute(ACCOUNT_ID, {
        name: 'Rota da manhã',
        depotLatitude: -26.3044,
        depotLongitude: -48.8487,
      });

      expect(result.status).toBe('draft');
      expect(repository.create).toHaveBeenCalledOnce();
    });

    it('rejeita depósito na coordenada (0, 0)', async () => {
      await expect(
        new CreateRoutePlanUseCase(repository).execute(ACCOUNT_ID, {
          name: 'Inválido',
          depotLatitude: 0,
          depotLongitude: 0,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_COORDINATE', statusCode: 422 });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('GetRoutePlanUseCase', () => {
    it('retorna o plano encontrado', async () => {
      repository.findById.mockResolvedValue(makeRoutePlan());
      await expect(
        new GetRoutePlanUseCase(repository).execute(ACCOUNT_ID, makeRoutePlan().id),
      ).resolves.toMatchObject({ name: 'Rota da manhã' });
    });

    it('retorna 404 para plano inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new GetRoutePlanUseCase(repository).execute(ACCOUNT_ID, 'missing'),
      ).rejects.toMatchObject({ code: 'ROUTE_PLAN_NOT_FOUND', statusCode: 404 });
    });
  });

  describe('ListRoutePlansUseCase', () => {
    it('retorna zero páginas quando não há planos', async () => {
      repository.findMany.mockResolvedValue({ data: [], total: 0 });
      const result = await new ListRoutePlansUseCase(repository).execute(ACCOUNT_ID, {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('UpdateRoutePlanUseCase', () => {
    it('valida o depósito combinando os dados atuais com os novos', async () => {
      const current = makeRoutePlan({ depotLatitude: 0.5, depotLongitude: 0 });
      repository.findById.mockResolvedValue(current);

      await expect(
        new UpdateRoutePlanUseCase(repository).execute(ACCOUNT_ID, current.id, {
          depotLatitude: 0,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_COORDINATE' });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('atualiza o nome do plano', async () => {
      const current = makeRoutePlan();
      repository.findById.mockResolvedValue(current);
      repository.update.mockResolvedValue({ ...current, name: 'Rota da tarde', version: 1 });

      const result = await new UpdateRoutePlanUseCase(repository).execute(
        ACCOUNT_ID,
        current.id,
        { name: 'Rota da tarde' },
      );

      expect(result).toMatchObject({ name: 'Rota da tarde', version: 1 });
    });

    it('retorna 404 ao atualizar plano inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new UpdateRoutePlanUseCase(repository).execute(ACCOUNT_ID, 'missing', { name: 'X' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('DeleteRoutePlanUseCase', () => {
    it('exclui o plano existente', async () => {
      repository.findById.mockResolvedValue(makeRoutePlan());
      await new DeleteRoutePlanUseCase(repository).execute(ACCOUNT_ID, makeRoutePlan().id);
      expect(repository.delete).toHaveBeenCalledWith(ACCOUNT_ID, makeRoutePlan().id);
    });

    it('retorna 404 ao excluir plano inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new DeleteRoutePlanUseCase(repository).execute(ACCOUNT_ID, 'missing'),
      ).rejects.toMatchObject({ code: 'ROUTE_PLAN_NOT_FOUND' });
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
