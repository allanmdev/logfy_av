import { AppError } from '../../../../shared/errors/app-error';
import { DeliveryRepository } from '../../domain/repositories/delivery.repository';

export class DeleteDeliveryUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(accountId: string, routePlanId: string, id: string) {
    const current = await this.repository.findById(accountId, routePlanId, id);
    if (!current) {
      throw new AppError('DELIVERY_NOT_FOUND', 404, 'Delivery not found.');
    }
    await this.repository.delete(accountId, routePlanId, id);
  }
}
