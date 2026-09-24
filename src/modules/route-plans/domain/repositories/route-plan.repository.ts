import { RoutePlan } from '../entities/route-plan.entity';
import { Pagination, Page } from '../../../../shared/domain/pagination';

export interface CreateRoutePlanData {
  name: string;
  depotLatitude: number;
  depotLongitude: number;
}

export type UpdateRoutePlanData = Partial<CreateRoutePlanData>;

export interface RoutePlanRepository {
  create(accountId: string, data: CreateRoutePlanData): Promise<RoutePlan>;
  findById(accountId: string, id: string): Promise<RoutePlan | null>;
  findMany(accountId: string, options: Pagination): Promise<Page<RoutePlan>>;
  update(
    accountId: string,
    id: string,
    data: UpdateRoutePlanData,
  ): Promise<RoutePlan>;
  delete(accountId: string, id: string): Promise<void>;
}
