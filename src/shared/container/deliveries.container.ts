import { PrismaDeliveryRepository } from '../../modules/deliveries/infrastructure/repositories/prisma-delivery.repository';
import { DeliveryController } from '../../modules/deliveries/presentation/http/delivery.controller';
import { CreateDeliveryUseCase } from '../../modules/deliveries/application/use-cases/create-delivery.use-case';
import { GetDeliveryUseCase } from '../../modules/deliveries/application/use-cases/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../../modules/deliveries/application/use-cases/list-deliveries.use-case';
import { UpdateDeliveryUseCase } from '../../modules/deliveries/application/use-cases/update-delivery.use-case';
import { DeleteDeliveryUseCase } from '../../modules/deliveries/application/use-cases/delete-delivery.use-case';

export const deliveryRepository = new PrismaDeliveryRepository();

export const deliveryController = new DeliveryController(
  new CreateDeliveryUseCase(deliveryRepository),
  new GetDeliveryUseCase(deliveryRepository),
  new ListDeliveriesUseCase(deliveryRepository),
  new UpdateDeliveryUseCase(deliveryRepository),
  new DeleteDeliveryUseCase(deliveryRepository),
);
