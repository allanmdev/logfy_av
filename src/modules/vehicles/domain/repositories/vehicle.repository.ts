import { Vehicle } from '../entities/vehicle.entity';
import { Pagination, Page } from '../../../../shared/domain/pagination';

export interface CreateVehicleData {
  name: string;
  capacity: number;
  active: boolean;
}

export type UpdateVehicleData = Partial<CreateVehicleData>;

export interface VehicleRepository {
  create(accountId: string, data: CreateVehicleData): Promise<Vehicle>;
  findById(accountId: string, id: string): Promise<Vehicle | null>;
  findMany(accountId: string, options: Pagination): Promise<Page<Vehicle>>;
  update(
    accountId: string,
    id: string,
    data: UpdateVehicleData,
  ): Promise<Vehicle>;
  delete(accountId: string, id: string): Promise<void>;
}
