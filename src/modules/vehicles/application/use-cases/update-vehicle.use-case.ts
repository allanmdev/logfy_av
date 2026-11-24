import { AppError } from '../../../../shared/errors/app-error';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { UpdateVehicleDTO } from '../dto/create-vehicle.dto';
import { VehicleNamePolicy } from './vehicle-name-policy';

export class UpdateVehicleUseCase {
  private readonly namePolicy: VehicleNamePolicy;

  constructor(private readonly repository: VehicleRepository) {
    this.namePolicy = new VehicleNamePolicy(repository);
  }

  async execute(accountId: string, id: string, input: UpdateVehicleDTO) {
    const current = await this.repository.findById(accountId, id);
    if (!current) {
      throw new AppError('VEHICLE_NOT_FOUND', 404, 'Vehicle not found.');
    }
    if (input.name !== undefined && input.name !== current.name) {
      await this.namePolicy.ensureAvailable(accountId, input.name, id);
    }
    return this.repository.update(accountId, id, input);
  }
}
