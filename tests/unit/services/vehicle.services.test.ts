import { beforeEach, describe, expect, it } from 'vitest';
import { CreateVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/create-vehicle.use-case';
import { GetVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/get-vehicle.use-case';
import { ListVehiclesUseCase } from '../../../src/modules/vehicles/application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/update-vehicle.use-case';
import { DeleteVehicleUseCase } from '../../../src/modules/vehicles/application/use-cases/delete-vehicle.use-case';
import { ACCOUNT_ID, makeVehicle, vehicleRepositoryMock } from '../../support/factories';

describe('Serviços de veículos', () => {
  let repository: ReturnType<typeof vehicleRepositoryMock>;

  beforeEach(() => {
    repository = vehicleRepositoryMock();
  });

  describe('CreateVehicleUseCase', () => {
    it('cadastra o veículo quando o nome está disponível na empresa', async () => {
      const vehicle = makeVehicle();
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(vehicle);

      const result = await new CreateVehicleUseCase(repository).execute(ACCOUNT_ID, {
        name: 'Van 01',
        capacity: 100,
        active: true,
      });

      expect(result).toEqual(vehicle);
      expect(repository.findByName).toHaveBeenCalledWith(ACCOUNT_ID, 'Van 01');
      expect(repository.create).toHaveBeenCalledWith(ACCOUNT_ID, {
        name: 'Van 01',
        capacity: 100,
        active: true,
      });
    });

    it('impede cadastrar dois veículos com o mesmo nome na empresa', async () => {
      repository.findByName.mockResolvedValue(makeVehicle());

      await expect(
        new CreateVehicleUseCase(repository).execute(ACCOUNT_ID, {
          name: 'van 01',
          capacity: 50,
          active: true,
        }),
      ).rejects.toMatchObject({ code: 'VEHICLE_NAME_ALREADY_EXISTS', statusCode: 409 });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('GetVehicleUseCase', () => {
    it('retorna o veículo encontrado', async () => {
      repository.findById.mockResolvedValue(makeVehicle());
      await expect(
        new GetVehicleUseCase(repository).execute(ACCOUNT_ID, makeVehicle().id),
      ).resolves.toMatchObject({ name: 'Van 01' });
    });

    it('retorna 404 quando o veículo não pertence à empresa', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new GetVehicleUseCase(repository).execute(ACCOUNT_ID, 'missing'),
      ).rejects.toMatchObject({ code: 'VEHICLE_NOT_FOUND', statusCode: 404 });
    });
  });

  describe('ListVehiclesUseCase', () => {
    it('calcula a paginação a partir do total retornado', async () => {
      repository.findMany.mockResolvedValue({ data: [makeVehicle()], total: 41 });

      const result = await new ListVehiclesUseCase(repository).execute(ACCOUNT_ID, {
        page: 2,
        limit: 20,
      });

      expect(result.pagination).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('UpdateVehicleUseCase', () => {
    it('atualiza a capacidade sem verificar nome quando o nome não muda', async () => {
      const current = makeVehicle();
      repository.findById.mockResolvedValue(current);
      repository.update.mockResolvedValue({ ...current, capacity: 150 });

      const result = await new UpdateVehicleUseCase(repository).execute(ACCOUNT_ID, current.id, {
        name: 'Van 01',
        capacity: 150,
      });

      expect(result.capacity).toBe(150);
      expect(repository.findByName).not.toHaveBeenCalled();
    });

    it('permite renomear quando o novo nome está livre', async () => {
      const current = makeVehicle();
      repository.findById.mockResolvedValue(current);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...current, name: 'Caminhão 02' });

      await new UpdateVehicleUseCase(repository).execute(ACCOUNT_ID, current.id, {
        name: 'Caminhão 02',
      });

      expect(repository.update).toHaveBeenCalledWith(ACCOUNT_ID, current.id, {
        name: 'Caminhão 02',
      });
    });

    it('impede renomear para o nome de outro veículo', async () => {
      const current = makeVehicle();
      repository.findById.mockResolvedValue(current);
      repository.findByName.mockResolvedValue(
        makeVehicle({ id: '99999999-9999-4999-8999-999999999999', name: 'Caminhão 02' }),
      );

      await expect(
        new UpdateVehicleUseCase(repository).execute(ACCOUNT_ID, current.id, {
          name: 'Caminhão 02',
        }),
      ).rejects.toMatchObject({ code: 'VEHICLE_NAME_ALREADY_EXISTS' });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('retorna 404 ao atualizar veículo inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new UpdateVehicleUseCase(repository).execute(ACCOUNT_ID, 'missing', { capacity: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('DeleteVehicleUseCase', () => {
    it('exclui o veículo existente', async () => {
      repository.findById.mockResolvedValue(makeVehicle());
      repository.delete.mockResolvedValue();

      await new DeleteVehicleUseCase(repository).execute(ACCOUNT_ID, makeVehicle().id);

      expect(repository.delete).toHaveBeenCalledWith(ACCOUNT_ID, makeVehicle().id);
    });

    it('retorna 404 ao excluir veículo inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        new DeleteVehicleUseCase(repository).execute(ACCOUNT_ID, 'missing'),
      ).rejects.toMatchObject({ code: 'VEHICLE_NOT_FOUND' });
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
