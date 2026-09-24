import { PrismaVehicleRepository } from '../../modules/vehicles/infrastructure/repositories/prisma-vehicle.repository';
import { VehicleController } from '../../modules/vehicles/presentation/http/vehicle.controller';
import { CreateVehicleUseCase } from '../../modules/vehicles/application/use-cases/create-vehicle.use-case';
import { GetVehicleUseCase } from '../../modules/vehicles/application/use-cases/get-vehicle.use-case';
import { ListVehiclesUseCase } from '../../modules/vehicles/application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from '../../modules/vehicles/application/use-cases/update-vehicle.use-case';
import { DeleteVehicleUseCase } from '../../modules/vehicles/application/use-cases/delete-vehicle.use-case';

export const vehicleRepository = new PrismaVehicleRepository();

export const vehicleController = new VehicleController(
  new CreateVehicleUseCase(vehicleRepository),
  new GetVehicleUseCase(vehicleRepository),
  new ListVehiclesUseCase(vehicleRepository),
  new UpdateVehicleUseCase(vehicleRepository),
  new DeleteVehicleUseCase(vehicleRepository),
);
