import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';

export class DeleteRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, id: string) {
    return this.repository.delete(accountId, id);
  }
}
