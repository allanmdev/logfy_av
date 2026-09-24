import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { UpdateVehicleDTO } from '../dto/create-vehicle.dto';

export class UpdateVehicleUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, id: string, input: UpdateVehicleDTO) {
    return this.repository.update(accountId, id, input);
  }
}
