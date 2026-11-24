import { AppError } from '../../../../shared/errors/app-error';
import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { RoutePlanRepository } from '../../../route-plans/domain/repositories/route-plan.repository';
import { UpdateDeliveryDTO } from '../dto/create-delivery.dto';
import { DeliveryPolicy } from './delivery-policy';

export class UpdateDeliveryUseCase {
  private readonly policy: DeliveryPolicy;

  constructor(
    private readonly repository: DeliveryRepository,
    routePlans: RoutePlanRepository,
    maxDeliveriesPerPlan: number,
  ) {
    this.policy = new DeliveryPolicy(repository, routePlans, maxDeliveriesPerPlan);
  }

  async execute(
    accountId: string,
    routePlanId: string,
    id: string,
    input: UpdateDeliveryDTO,
  ) {
    const plan = await this.policy.requireRoutePlan(accountId, routePlanId);
    const current = await this.repository.findById(accountId, routePlanId, id);
    if (!current) {
      throw new AppError('DELIVERY_NOT_FOUND', 404, 'Delivery not found.');
    }
    this.policy.ensureAwayFromDepot(
      plan,
      input.latitude ?? current.latitude,
      input.longitude ?? current.longitude,
    );
    if (input.reference !== undefined && input.reference !== current.reference) {
      await this.policy.ensureUniqueReference(
        accountId,
        routePlanId,
        input.reference,
        id,
      );
    }
    return this.repository.update(accountId, routePlanId, id, input);
  }
}
