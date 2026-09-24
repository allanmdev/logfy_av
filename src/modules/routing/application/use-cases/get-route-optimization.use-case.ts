import { AppError } from '../../../../shared/errors/app-error';
import { OptimizationRepository } from '../../domain/repositories/optimization.repository';

export class GetRouteOptimizationUseCase {
  constructor(private readonly repository: OptimizationRepository) {}

  async execute(accountId: string, routePlanId: string) {
    const result = await this.repository.findByRoutePlanId(
      accountId,
      routePlanId,
    );
    if (!result) {
      throw new AppError(
        'OPTIMIZATION_NOT_FOUND',
        404,
        'Optimization not found.',
      );
    }
    return result;
  }
}
