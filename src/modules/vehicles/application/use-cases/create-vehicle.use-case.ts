import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { CreateVehicleDTO } from '../dto/create-vehicle.dto';

export class CreateVehicleUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, input: CreateVehicleDTO) {
    return this.repository.create(accountId, input);
  }
}
