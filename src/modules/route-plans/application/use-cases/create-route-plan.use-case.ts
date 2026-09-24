import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { CreateRoutePlanDTO } from '../dto/create-route-plan.dto';

export class CreateRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, input: CreateRoutePlanDTO) {
    return this.repository.create(accountId, input);
  }
}
