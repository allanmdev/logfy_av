import { beforeEach, describe, expect, it } from 'vitest';
import { CreateDeliveryUseCase } from '../../../src/modules/deliveries/application/use-cases/create-delivery.use-case';
import { GetDeliveryUseCase } from '../../../src/modules/deliveries/application/use-cases/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../../../src/modules/deliveries/application/use-cases/list-deliveries.use-case';
import { UpdateDeliveryUseCase } from '../../../src/modules/deliveries/application/use-cases/update-delivery.use-case';
import { DeleteDeliveryUseCase } from '../../../src/modules/deliveries/application/use-cases/delete-delivery.use-case';
import {
  ACCOUNT_ID,
  deliveryRepositoryMock,
  makeDelivery,
  makeRoutePlan,
  routePlanRepositoryMock,
} from '../../support/factories';

const plan = makeRoutePlan();
const input = {
  reference: 'PEDIDO-001',
  latitude: -26.2951,
  longitude: -48.8458,
  demand: 10,
  serviceDurationSeconds: 300,
};

describe('Serviços de entregas', () => {
  let deliveries: ReturnType<typeof deliveryRepositoryMock>;
  let routePlans: ReturnType<typeof routePlanRepositoryMock>;

  beforeEach(() => {
    deliveries = deliveryRepositoryMock();
    routePlans = routePlanRepositoryMock();
    routePlans.findById.mockResolvedValue(plan);
    deliveries.countByRoutePlan.mockResolvedValue(0);
    deliveries.findByReference.mockResolvedValue(null);
  });

  describe('CreateDeliveryUseCase', () => {
    const create = () => new CreateDeliveryUseCase(deliveries, routePlans, 3);

    it('cadastra a entrega quando todas as regras são atendidas', async () => {
      deliveries.create.mockResolvedValue(makeDelivery());

      const result = await create().execute(ACCOUNT_ID, plan.id, input);

      expect(result.reference).toBe('PEDIDO-001');
      expect(deliveries.create).toHaveBeenCalledWith(ACCOUNT_ID, plan.id, input);
    });

    it('retorna 404 quando o plano não existe na empresa', async () => {
      routePlans.findById.mockResolvedValue(null);

      await expect(create().execute(ACCOUNT_ID, plan.id, input)).rejects.toMatchObject({
        code: 'ROUTE_PLAN_NOT_FOUND',
        statusCode: 404,
      });
      expect(deliveries.create).not.toHaveBeenCalled();
    });

    it('impede entrega na mesma coordenada do depósito', async () => {
      await expect(
        create().execute(ACCOUNT_ID, plan.id, {
          ...input,
          latitude: plan.depotLatitude,
          longitude: plan.depotLongitude,
        }),
      ).rejects.toMatchObject({ code: 'DELIVERY_AT_DEPOT', statusCode: 422 });
    });

    it('impede ultrapassar o limite de entregas por plano', async () => {
      deliveries.countByRoutePlan.mockResolvedValue(3);

      await expect(create().execute(ACCOUNT_ID, plan.id, input)).rejects.toMatchObject({
        code: 'ROUTE_PLAN_DELIVERY_LIMIT_REACHED',
        statusCode: 422,
      });
      expect(deliveries.create).not.toHaveBeenCalled();
    });

    it('impede referência duplicada dentro do mesmo plano', async () => {
      deliveries.findByReference.mockResolvedValue(makeDelivery());

      await expect(create().execute(ACCOUNT_ID, plan.id, input)).rejects.toMatchObject({
        code: 'DELIVERY_REFERENCE_ALREADY_EXISTS',
        statusCode: 409,
      });
    });
  });

  describe('GetDeliveryUseCase', () => {
    it('retorna a entrega encontrada', async () => {
      deliveries.findById.mockResolvedValue(makeDelivery());
      await expect(
        new GetDeliveryUseCase(deliveries).execute(ACCOUNT_ID, plan.id, makeDelivery().id),
      ).resolves.toMatchObject({ demand: 10 });
    });

    it('retorna 404 para entrega inexistente', async () => {
      deliveries.findById.mockResolvedValue(null);
      await expect(
        new GetDeliveryUseCase(deliveries).execute(ACCOUNT_ID, plan.id, 'missing'),
      ).rejects.toMatchObject({ code: 'DELIVERY_NOT_FOUND' });
    });
  });

  describe('ListDeliveriesUseCase', () => {
    it('retorna as entregas com metadados de paginação', async () => {
      deliveries.findMany.mockResolvedValue({ data: [makeDelivery()], total: 1 });
      const result = await new ListDeliveriesUseCase(deliveries).execute(ACCOUNT_ID, plan.id, {
        page: 1,
        limit: 10,
      });
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });
  });

  describe('UpdateDeliveryUseCase', () => {
    const update = () => new UpdateDeliveryUseCase(deliveries, routePlans, 3);

    it('atualiza a demanda mantendo a referência', async () => {
      const current = makeDelivery();
      deliveries.findById.mockResolvedValue(current);
      deliveries.update.mockResolvedValue({ ...current, demand: 20 });

      const result = await update().execute(ACCOUNT_ID, plan.id, current.id, { demand: 20 });

      expect(result.demand).toBe(20);
      expect(deliveries.findByReference).not.toHaveBeenCalled();
    });

    it('permite trocar a referência quando a nova está livre', async () => {
      const current = makeDelivery();
      deliveries.findById.mockResolvedValue(current);
      deliveries.update.mockResolvedValue({ ...current, reference: 'PEDIDO-002' });

      await update().execute(ACCOUNT_ID, plan.id, current.id, { reference: 'PEDIDO-002' });

      expect(deliveries.findByReference).toHaveBeenCalledWith(ACCOUNT_ID, plan.id, 'PEDIDO-002');
      expect(deliveries.update).toHaveBeenCalled();
    });

    it('impede trocar a referência para uma já utilizada no plano', async () => {
      const current = makeDelivery();
      deliveries.findById.mockResolvedValue(current);
      deliveries.findByReference.mockResolvedValue(
        makeDelivery({ id: '44444444-4444-4444-8444-444444444444', reference: 'PEDIDO-002' }),
      );

      await expect(
        update().execute(ACCOUNT_ID, plan.id, current.id, { reference: 'PEDIDO-002' }),
      ).rejects.toMatchObject({ code: 'DELIVERY_REFERENCE_ALREADY_EXISTS' });
      expect(deliveries.update).not.toHaveBeenCalled();
    });

    it('impede mover a entrega para o depósito', async () => {
      deliveries.findById.mockResolvedValue(makeDelivery());

      await expect(
        update().execute(ACCOUNT_ID, plan.id, makeDelivery().id, {
          latitude: plan.depotLatitude,
          longitude: plan.depotLongitude,
        }),
      ).rejects.toMatchObject({ code: 'DELIVERY_AT_DEPOT' });
    });

    it('retorna 404 quando a entrega não existe', async () => {
      deliveries.findById.mockResolvedValue(null);
      await expect(
        update().execute(ACCOUNT_ID, plan.id, 'missing', { demand: 1 }),
      ).rejects.toMatchObject({ code: 'DELIVERY_NOT_FOUND' });
    });

    it('retorna 404 quando o plano não existe', async () => {
      routePlans.findById.mockResolvedValue(null);
      await expect(
        update().execute(ACCOUNT_ID, plan.id, 'missing', { demand: 1 }),
      ).rejects.toMatchObject({ code: 'ROUTE_PLAN_NOT_FOUND' });
    });
  });

  describe('DeleteDeliveryUseCase', () => {
    it('exclui a entrega existente', async () => {
      deliveries.findById.mockResolvedValue(makeDelivery());
      await new DeleteDeliveryUseCase(deliveries).execute(ACCOUNT_ID, plan.id, makeDelivery().id);
      expect(deliveries.delete).toHaveBeenCalledWith(ACCOUNT_ID, plan.id, makeDelivery().id);
    });

    it('retorna 404 ao excluir entrega inexistente', async () => {
      deliveries.findById.mockResolvedValue(null);
      await expect(
        new DeleteDeliveryUseCase(deliveries).execute(ACCOUNT_ID, plan.id, 'missing'),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(deliveries.delete).not.toHaveBeenCalled();
    });
  });
});
