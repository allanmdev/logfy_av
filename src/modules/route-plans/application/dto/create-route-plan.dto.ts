export interface CreateRoutePlanDTO {
  name: string;
  depotLatitude: number;
  depotLongitude: number;
}

export type UpdateRoutePlanDTO = Partial<CreateRoutePlanDTO>;
