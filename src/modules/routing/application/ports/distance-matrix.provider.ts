import {
  Coordinates,
  DistanceMatrix,
} from '../../domain/entities/optimization.entity';

export interface DistanceMatrixProvider {
  compute(points: Coordinates[]): Promise<DistanceMatrix>;
}
