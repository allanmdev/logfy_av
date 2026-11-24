import { AppError } from '../../../../shared/errors/app-error';
import { Coordinate } from '../../../../shared/domain/coordinate';
import { RoutePlan } from '../../../route-plans/domain/entities/route-plan.entity';
import { RoutePlanRepository } from '../../../route-plans/domain/repositories/route-plan.repository';
import { DeliveryRepository } from '../../domain/repositories/delivery.repository';

export class DeliveryPolicy {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly routePlans: RoutePlanRepository,
    private readonly maxDeliveriesPerPlan: number,
  ) {}

  async requireRoutePlan(accountId: string, routePlanId: string) {
    const plan = await this.routePlans.findById(accountId, routePlanId);
    if (!plan) {
      throw new AppError('ROUTE_PLAN_NOT_FOUND', 404, 'Route plan not found.');
    }
    return plan;
  }

  ensureAwayFromDepot(plan: RoutePlan, latitude: number, longitude: number) {
    const location = Coordinate.create(latitude, longitude);
    const depot = Coordinate.create(plan.depotLatitude, plan.depotLongitude);
    if (location.equals(depot)) {
      throw new AppError(
        'DELIVERY_AT_DEPOT',
        422,
        'A entrega não pode estar na mesma coordenada do depósito.',
      );
    }
  }

  async ensureCapacity(accountId: string, routePlanId: string) {
    const total = await this.deliveries.countByRoutePlan(accountId, routePlanId);
    if (total >= this.maxDeliveriesPerPlan) {
      throw new AppError(
        'ROUTE_PLAN_DELIVERY_LIMIT_REACHED',
        422,
        `O plano já possui o máximo de ${this.maxDeliveriesPerPlan} entregas.`,
      );
    }
  }

  async ensureUniqueReference(
    accountId: string,
    routePlanId: string,
    reference: string,
    ignoreId?: string,
  ) {
    const existing = await this.deliveries.findByReference(
      accountId,
      routePlanId,
      reference,
    );
    if (existing && existing.id !== ignoreId) {
      throw new AppError(
        'DELIVERY_REFERENCE_ALREADY_EXISTS',
        409,
        'Já existe uma entrega com esta referência no plano.',
      );
    }
  }
}
