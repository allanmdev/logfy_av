import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { Pagination } from '../../../../shared/domain/pagination';

export class ListVehiclesUseCase {
  constructor(private readonly repository: VehicleRepository) {}

  async execute(accountId: string, options: Pagination) {
    const result = await this.repository.findMany(accountId, options);
    return {
      data: result.data,
      pagination: {
        ...options,
        total: result.total,
        totalPages: Math.ceil(result.total / options.limit),
      },
    };
  }
}
