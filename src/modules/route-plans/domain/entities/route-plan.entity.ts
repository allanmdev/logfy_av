export interface RoutePlan {
  id: string;
  accountId: string;
  status: 'draft' | 'optimized';
  version: number;
  name: string;
  depotLatitude: number;
  depotLongitude: number;
  createdAt: Date;
  updatedAt: Date;
}
