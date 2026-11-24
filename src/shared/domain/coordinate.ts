import { AppError } from '../errors/app-error';

export class Coordinate {
  private static readonly TOLERANCE = 0.000001;

  private constructor(
    public readonly latitude: number,
    public readonly longitude: number,
  ) {}

  static create(latitude: number, longitude: number): Coordinate {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new AppError(
        'INVALID_COORDINATE',
        422,
        'Latitude deve estar entre -90 e 90.',
      );
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(
        'INVALID_COORDINATE',
        422,
        'Longitude deve estar entre -180 e 180.',
      );
    }
    if (latitude === 0 && longitude === 0) {
      throw new AppError(
        'INVALID_COORDINATE',
        422,
        'A coordenada (0, 0) não representa um endereço válido.',
      );
    }
    return new Coordinate(latitude, longitude);
  }

  equals(other: Coordinate): boolean {
    return (
      Math.abs(this.latitude - other.latitude) < Coordinate.TOLERANCE &&
      Math.abs(this.longitude - other.longitude) < Coordinate.TOLERANCE
    );
  }
}
