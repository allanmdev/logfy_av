import { VehicleRepository } from '../../domain/repositories/vehicle.repository';

export class DeleteVehicleUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, id: string) {
    return this.repository.delete(accountId, id);
  }
}
