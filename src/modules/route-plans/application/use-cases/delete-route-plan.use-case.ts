import { AppError } from '../../../../shared/errors/app-error';
import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';

export class DeleteRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, id: string) {
    const current = await this.repository.findById(accountId, id);
    if (!current) {
      throw new AppError('ROUTE_PLAN_NOT_FOUND', 404, 'Route plan not found.');
    }
    await this.repository.delete(accountId, id);
  }
}
