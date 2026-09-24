import { DeliveryRepository } from '../../domain/repositories/delivery.repository';
import { UpdateDeliveryDTO } from '../dto/create-delivery.dto';

export class UpdateDeliveryUseCase {
  constructor(private readonly repository: DeliveryRepository) {}

  async execute(
    accountId: string,
    routePlanId: string,
    id: string,
    input: UpdateDeliveryDTO,
  ) {
    return this.repository.update(accountId, routePlanId, id, input);
  }
}
