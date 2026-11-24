import { AppError } from '../../../../shared/errors/app-error';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository';

export class DeleteVehicleUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, id: string) {
    const current = await this.repository.findById(accountId, id);
    if (!current) {
      throw new AppError('VEHICLE_NOT_FOUND', 404, 'Vehicle not found.');
    }
    await this.repository.delete(accountId, id);
  }
}
