export interface CreateVehicleDTO {
  name: string;
  capacity: number;
  active: boolean;
}

export type UpdateVehicleDTO = Partial<CreateVehicleDTO>;
