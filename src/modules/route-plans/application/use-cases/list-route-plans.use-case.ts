import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { Pagination } from '../../../../shared/domain/pagination';

export class ListRoutePlansUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

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
