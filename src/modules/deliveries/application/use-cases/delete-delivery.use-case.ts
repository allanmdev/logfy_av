import { DeliveryRepository } from '../../domain/repositories/delivery.repository';

export class DeleteDeliveryUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(accountId: string, routePlanId: string, id: string) {
    return this.repository.delete(accountId, routePlanId, id);
  }
}
