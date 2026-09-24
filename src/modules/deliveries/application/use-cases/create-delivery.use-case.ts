import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { CreateDeliveryDTO } from '../dto/create-delivery.dto';

export class CreateDeliveryUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(
    accountId: string,
    routePlanId: string,
    input: CreateDeliveryDTO,
  ) {
    return this.repository.create(accountId, routePlanId, input);
  }
}
