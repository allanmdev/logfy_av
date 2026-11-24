import { AppError } from '../../../../shared/errors/app-error';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository';

export class VehicleNamePolicy {
  constructor(private readonly repository: VehicleRepository) {}

  async ensureAvailable(
    accountId: string,
    name: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByName(accountId, name.trim());
    if (existing && existing.id !== ignoreId) {
      throw new AppError(
        'VEHICLE_NAME_ALREADY_EXISTS',
        409,
        'Já existe um veículo com este nome nesta conta.',
      );
    }
  }
}
