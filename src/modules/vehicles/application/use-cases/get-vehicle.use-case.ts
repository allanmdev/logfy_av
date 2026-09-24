import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { AppError } from '../../../../shared/errors/app-error';

export class GetVehicleUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, id: string) {
    const result = await this.repository.findById(accountId, id);
    if (!result) {
      throw new AppError('VEHICLE_NOT_FOUND', 404, 'Vehicle not found.');
    }
    return result;
  }
}
