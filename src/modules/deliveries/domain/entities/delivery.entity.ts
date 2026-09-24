export interface Delivery {
  id: string;
  accountId: string;
  routePlanId: string;
  reference: string;
  latitude: number;
  longitude: number;
  demand: number;
  serviceDurationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}
