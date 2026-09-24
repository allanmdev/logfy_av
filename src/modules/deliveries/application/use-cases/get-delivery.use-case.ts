import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { AppError } from '../../../../shared/errors/app-error';

export class GetDeliveryUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(accountId: string, routePlanId: string, id: string) {
    const result = await this.repository.findById(accountId, routePlanId, id);
    if (!result) {
      throw new AppError('DELIVERY_NOT_FOUND', 404, 'Delivery not found.');
    }
    return result;
  }
}
