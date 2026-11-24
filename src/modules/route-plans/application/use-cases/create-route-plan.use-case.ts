import { Coordinate } from '../../../../shared/domain/coordinate';
import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { CreateRoutePlanDTO } from '../dto/create-route-plan.dto';

export class CreateRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, input: CreateRoutePlanDTO) {
    Coordinate.create(input.depotLatitude, input.depotLongitude);
    return this.repository.create(accountId, input);
  }
}
