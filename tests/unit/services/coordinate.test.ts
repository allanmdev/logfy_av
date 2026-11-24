import { describe, expect, it } from 'vitest';
import { Coordinate } from '../../../src/shared/domain/coordinate';
import { AppError } from '../../../src/shared/errors/app-error';

describe('Coordinate', () => {
  it('cria uma coordenada válida e expõe latitude e longitude', () => {
    const coordinate = Coordinate.create(-26.3, -48.8);
    expect(coordinate.latitude).toBe(-26.3);
    expect(coordinate.longitude).toBe(-48.8);
  });

  it.each([
    [91, 0],
    [-91, 10],
    [10, 181],
    [10, -181],
    [Number.NaN, 10],
  ])('rejeita latitude/longitude fora da faixa (%s, %s)', (latitude, longitude) => {
    expect(() => Coordinate.create(latitude, longitude)).toThrowError(AppError);
  });

  it('rejeita a coordenada (0, 0) por não representar um endereço real', () => {
    expect(() => Coordinate.create(0, 0)).toThrowError(
      expect.objectContaining({ code: 'INVALID_COORDINATE', statusCode: 422 }),
    );
  });

  it('compara coordenadas considerando a tolerância de precisão', () => {
    const depot = Coordinate.create(-26.3, -48.8);
    expect(depot.equals(Coordinate.create(-26.3000001, -48.8000001))).toBe(true);
    expect(depot.equals(Coordinate.create(-26.31, -48.8))).toBe(false);
  });
});
