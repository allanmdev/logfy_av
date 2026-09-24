export interface CreateDeliveryDTO {
  reference: string;
  latitude: number;
  longitude: number;
  demand: number;
  serviceDurationSeconds: number;
}

export type UpdateDeliveryDTO = Partial<CreateDeliveryDTO>;
