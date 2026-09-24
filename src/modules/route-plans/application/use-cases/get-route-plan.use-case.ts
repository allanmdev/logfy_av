import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { AppError } from '../../../../shared/errors/app-error';

export class GetRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, id: string) {
    const result = await this.repository.findById(accountId, id);
    if (!result) {
      throw new AppError('ROUTE_PLAN_NOT_FOUND', 404, 'RoutePlan not found.');
    }
    return result;
  }
}
