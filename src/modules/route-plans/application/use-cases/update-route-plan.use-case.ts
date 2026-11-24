import { AppError } from '../../../../shared/errors/app-error';
import { Coordinate } from '../../../../shared/domain/coordinate';
import { RoutePlanRepository } from '../../domain/repositories/route-plan.repository';
import { UpdateRoutePlanDTO } from '../dto/create-route-plan.dto';

export class UpdateRoutePlanUseCase {
  constructor(private readonly repository: RoutePlanRepository) {}

  async execute(accountId: string, id: string, input: UpdateRoutePlanDTO) {
    const current = await this.repository.findById(accountId, id);
    if (!current) {
      throw new AppError('ROUTE_PLAN_NOT_FOUND', 404, 'Route plan not found.');
    }
    Coordinate.create(
      input.depotLatitude ?? current.depotLatitude,
      input.depotLongitude ?? current.depotLongitude,
    );
    return this.repository.update(accountId, id, input);
  }
}
