import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { UpdateRoutePlanDTO } from '../dto/create-route-plan.dto';

export class UpdateRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, id: string, input: UpdateRoutePlanDTO) {
    return this.repository.update(accountId, id, input);
  }
}
