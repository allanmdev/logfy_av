import { z } from 'zod';
import { AppError } from '../../../../shared/errors/app-error';
import { DistanceMatrixProvider } from '../../application/ports/distance-matrix.provider';
import {
  Coordinates,
  DistanceMatrix,
  TravelCost,
} from '../../domain/entities/optimization.entity';

const elementSchema = z.object({
  originIndex: z.number().int().nonnegative().default(0),
  destinationIndex: z.number().int().nonnegative().default(0),
  status: z.object({ code: z.number().int().default(0) }).default({ code: 0 }),
  condition: z.string().optional(),
  distanceMeters: z.number().int().nonnegative().optional(),
  duration: z
    .string()
    .regex(/^\d+(?:\.\d+)?s$/)
    .optional(),
});

export class GoogleMapsDistanceMatrixProvider implements DistanceMatrixProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async compute(points: Coordinates[]): Promise<DistanceMatrix> {
    if (!this.apiKey) {
      throw new AppError(
        'MAPS_NOT_CONFIGURED',
        503,
        'The distance matrix provider is not configured.',
      );
    }
    const costs: (TravelCost | null)[][] = Array.from(
      { length: points.length },
      () => Array(points.length).fill(null),
    );
    const waypoint = (point: Coordinates) => ({
      waypoint: { location: { latLng: point } },
    });
    for (
      let originOffset = 0;
      originOffset < points.length;
      originOffset += 25
    ) {
      for (
        let destinationOffset = 0;
        destinationOffset < points.length;
        destinationOffset += 25
      ) {
        const origins = points.slice(originOffset, originOffset + 25);
        const destinations = points.slice(
          destinationOffset,
          destinationOffset + 25,
        );
        try {
          const response = await this.fetcher(
            'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': this.apiKey,
                'X-Goog-FieldMask':
                  'originIndex,destinationIndex,status,condition,distanceMeters,duration',
              },
              body: JSON.stringify({
                origins: origins.map(waypoint),
                destinations: destinations.map(waypoint),
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_UNAWARE',
              }),
              signal: AbortSignal.timeout(this.timeoutMs),
            },
          );
          if (!response.ok) {
            throw new AppError(
              'MAPS_UNAVAILABLE',
              502,
              'The distance matrix provider failed.',
            );
          }
          const elements = z.array(elementSchema).parse(await response.json());
          const seen = new Set<string>();
          for (const element of elements) {
            const { originIndex, destinationIndex } = element;
            const pair = `${originIndex}:${destinationIndex}`;
            if (
              originIndex >= origins.length ||
              destinationIndex >= destinations.length ||
              seen.has(pair)
            ) {
              throw new Error('Invalid matrix indices.');
            }
            seen.add(pair);
            if (element.status.code !== 0) {
              throw new Error('Matrix element failed.');
            }
            if (element.condition === 'ROUTE_NOT_FOUND') {
              continue;
            }
            if (
              element.condition !== 'ROUTE_EXISTS' ||
              element.distanceMeters === undefined ||
              element.duration === undefined
            ) {
              throw new Error('Missing matrix cost.');
            }
            const durationSeconds = Number(element.duration.slice(0, -1));
            if (!Number.isFinite(durationSeconds)) {
              throw new Error('Invalid matrix duration.');
            }
            costs[originOffset + originIndex]![
              destinationOffset + destinationIndex
            ] = {
              distanceMeters: element.distanceMeters,
              durationSeconds,
            };
          }
          if (seen.size !== origins.length * destinations.length) {
            throw new Error('Incomplete matrix.');
          }
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          if (
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')
          ) {
            throw new AppError(
              'MAPS_TIMEOUT',
              504,
              'The distance matrix provider timed out.',
            );
          }
          throw new AppError(
            'INVALID_DISTANCE_MATRIX',
            502,
            'The distance matrix provider returned an invalid or incomplete response.',
          );
        }
      }
    }
    return { provider: 'google-routes', costs };
  }
}
