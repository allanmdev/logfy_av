import { Delivery } from '../entities/delivery.entity';
import { Pagination, Page } from '../../../../shared/domain/pagination';

export interface CreateDeliveryData {
  reference: string;
  latitude: number;
  longitude: number;
  demand: number;
  serviceDurationSeconds: number;
}

export type UpdateDeliveryData = Partial<CreateDeliveryData>;

export interface DeliveryRepository {
  create(
    accountId: string,
    routePlanId: string,
    data: CreateDeliveryData,
  ): Promise<Delivery>;
  findById(
    accountId: string,
    routePlanId: string,
    id: string,
  ): Promise<Delivery | null>;
  findMany(
    accountId: string,
    routePlanId: string,
    options: Pagination,
  ): Promise<Page<Delivery>>;
  update(
    accountId: string,
    routePlanId: string,
    id: string,
    data: UpdateDeliveryData,
  ): Promise<Delivery>;
  delete(accountId: string, routePlanId: string, id: string): Promise<void>;
}
