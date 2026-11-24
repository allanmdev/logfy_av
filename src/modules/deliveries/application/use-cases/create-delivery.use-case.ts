import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { RoutePlanRepository } from '../../../route-plans/domain/repositories/route-plan.repository';
import { CreateDeliveryDTO } from '../dto/create-delivery.dto';
import { DeliveryPolicy } from './delivery-policy';

export class CreateDeliveryUseCase {
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
    input: CreateDeliveryDTO,
  ) {
    const plan = await this.policy.requireRoutePlan(accountId, routePlanId);
    this.policy.ensureAwayFromDepot(plan, input.latitude, input.longitude);
    await this.policy.ensureCapacity(accountId, routePlanId);
    await this.policy.ensureUniqueReference(
      accountId,
      routePlanId,
      input.reference,
    );
    return this.repository.create(accountId, routePlanId, input);
  }
}
