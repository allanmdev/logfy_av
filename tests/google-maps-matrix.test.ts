import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GoogleMapsDistanceMatrixProvider } from '../src/modules/routing/infrastructure/providers/google-maps-distance-matrix.provider';
import { AppError } from '../src/shared/errors/app-error';

const points = [
  { latitude: -23, longitude: -46 },
  { latitude: -24, longitude: -47 },
];
const elements = [
  {
    originIndex: 1,
    destinationIndex: 1,
    condition: 'ROUTE_EXISTS',
    distanceMeters: 0,
    duration: '0s',
  },
  {
    originIndex: 1,
    condition: 'ROUTE_EXISTS',
    distanceMeters: 300,
    duration: '12.5s',
  },
  { destinationIndex: 1, condition: 'ROUTE_NOT_FOUND' },
  { condition: 'ROUTE_EXISTS', distanceMeters: 0, duration: '0s', status: {} },
];
const mockFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

test('Google adapter restores out-of-order indices, decimal seconds and unreachable roads', async () => {
  const provider = new GoogleMapsDistanceMatrixProvider(
    'test',
    100,
    mockFetch(elements),
  );
  const result = await provider.compute(points);
  assert.deepEqual(result.costs, [
    [{ distanceMeters: 0, durationSeconds: 0 }, null],
    [
      { distanceMeters: 300, durationSeconds: 12.5 },
      { distanceMeters: 0, durationSeconds: 0 },
    ],
  ]);
});

test('Google adapter batches both axes within 625 elements and preserves global indices', async () => {
  const requests: number[][] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    assert.equal(
      url,
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    );
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['X-Goog-Api-Key'], 'test');
    assert.ok(headers['X-Goog-FieldMask']!.includes('status'));
    const request = JSON.parse(init.body as string);
    assert.equal(request.travelMode, 'DRIVE');
    requests.push([request.origins.length, request.destinations.length]);
    return new Response(
      JSON.stringify(
        request.origins.flatMap((origin: any, originIndex: number) =>
          request.destinations.map(
            (destination: any, destinationIndex: number) => ({
              originIndex,
              destinationIndex,
              condition: 'ROUTE_EXISTS',
              distanceMeters:
                origin.waypoint.location.latLng.latitude * 100 +
                destination.waypoint.location.latLng.latitude,
              duration: '1s',
            }),
          ),
        ),
      ),
    );
  }) as typeof fetch;
  const result = await new GoogleMapsDistanceMatrixProvider(
    'test',
    100,
    fetcher,
  ).compute(
    Array.from({ length: 26 }, (_, i) => ({ latitude: i, longitude: i })),
  );
  assert.deepEqual(requests, [
    [25, 25],
    [25, 1],
    [1, 25],
    [1, 1],
  ]);
  assert.equal(result.costs[25]![24]!.distanceMeters, 2524);
  assert.equal(result.costs[24]![25]!.distanceMeters, 2425);
});

for (const [label, response] of [
  ['missing cells', elements.slice(1)],
  ['duplicate cells', [...elements, elements[0]]],
  [
    'out of range',
    [...elements.slice(0, 3), { ...elements[3], originIndex: 7 }],
  ],
  [
    'failed element',
    [...elements.slice(0, 3), { ...elements[3], status: { code: 13 } }],
  ],
  [
    'missing duration',
    [...elements.slice(0, 3), { ...elements[3], duration: undefined }],
  ],
  [
    'invalid duration',
    [...elements.slice(0, 3), { ...elements[3], duration: '-1s' }],
  ],
  ['invalid JSON shape', { error: 'unexpected' }],
] as const) {
  test(`Google adapter rejects ${label}`, async () => {
    await assert.rejects(
      new GoogleMapsDistanceMatrixProvider(
        'test',
        100,
        mockFetch(response),
      ).compute(points),
      (error: unknown) =>
        error instanceof AppError && error.code === 'INVALID_DISTANCE_MATRIX',
    );
  });
}

test('Google adapter handles configuration, HTTP errors and timeout without exposing credentials', async () => {
  await assert.rejects(
    new GoogleMapsDistanceMatrixProvider(undefined, 100).compute(points),
    (error: unknown) => error instanceof AppError && error.statusCode === 503,
  );
  await assert.rejects(
    new GoogleMapsDistanceMatrixProvider(
      'secret',
      100,
      mockFetch({}, 429),
    ).compute(points),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 502 &&
      !error.message.includes('secret'),
  );
  const timeout = (async () => {
    throw new DOMException('timed out', 'TimeoutError');
  }) as typeof fetch;
  await assert.rejects(
    new GoogleMapsDistanceMatrixProvider('test', 100, timeout).compute(points),
    (error: unknown) => error instanceof AppError && error.statusCode === 504,
  );
});
