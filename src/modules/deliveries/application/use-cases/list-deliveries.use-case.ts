import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { Pagination } from '../../../../shared/domain/pagination';

export class ListDeliveriesUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(accountId: string, routePlanId: string, options: Pagination) {
    const result = await this.repository.findMany(
      accountId,
      routePlanId,
      options,
    );
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
