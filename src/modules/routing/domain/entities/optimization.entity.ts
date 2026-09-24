import { RoutePlan } from '../../../route-plans/domain/entities/route-plan.entity';
import { Delivery } from '../../../deliveries/domain/entities/delivery.entity';
import { Vehicle } from '../../../vehicles/domain/entities/vehicle.entity';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TravelCost {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DistanceMatrix {
  provider: string;
  costs: (TravelCost | null)[][];
}

export interface OptimizationSnapshot {
  plan: RoutePlan;
  deliveries: Delivery[];
  vehicles: Vehicle[];
}

export interface OptimizedStop extends TravelCost {
  deliveryId: string;
  reference: string;
  latitude: number;
  longitude: number;
  demand: number;
  serviceDurationSeconds: number;
  sequence: number;
  arrivalSeconds: number;
}

export interface OptimizedRoute {
  vehicleId: string;
  vehicleName: string;
  capacity: number;
  load: number;
  stops: OptimizedStop[];
  returnToDepot: TravelCost;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export interface OptimizationResult {
  algorithm: string;
  matrixProvider: string;
  depot: Coordinates;
  routes: OptimizedRoute[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export interface RouteOptimization {
  id: string;
  accountId: string;
  routePlanId: string;
  createdAt: Date;
  result: OptimizationResult;
}
