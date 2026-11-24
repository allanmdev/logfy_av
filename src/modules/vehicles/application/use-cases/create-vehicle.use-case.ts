import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { CreateVehicleDTO } from '../dto/create-vehicle.dto';
import { VehicleNamePolicy } from './vehicle-name-policy';

export class CreateVehicleUseCase {
  private readonly namePolicy: VehicleNamePolicy;

  constructor(private readonly repository: VehicleRepository) {
    this.namePolicy = new VehicleNamePolicy(repository);
  }

  async execute(accountId: string, input: CreateVehicleDTO) {
    await this.namePolicy.ensureAvailable(accountId, input.name);
    return this.repository.create(accountId, input);
  }
}
