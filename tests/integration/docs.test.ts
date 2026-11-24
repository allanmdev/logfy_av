import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { assertIntegrationDatabase, buildApp } from '../support/integration';

assertIntegrationDatabase();

describe('Integração - documentação e health check', () => {
  const app = buildApp();

  it('GET /api-docs.json retorna a especificação OpenAPI com as entidades', async () => {
    const response = await request(app).get('/api-docs.json').expect(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/vehicles',
        '/vehicles/{id}',
        '/route-plans',
        '/route-plans/{id}',
        '/route-plans/{routePlanId}/deliveries',
        '/route-plans/{routePlanId}/deliveries/{id}',
      ]),
    );
  });

  it('GET /api-docs/ entrega a interface do Swagger UI', async () => {
    const response = await request(app).get('/api-docs/').expect(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('GET /v1/health e /v1/health/ready retornam 200', async () => {
    await request(app).get('/v1/health').expect(200);
    await request(app).get('/v1/health/ready').expect(200);
  });

  it('rotas inexistentes retornam 404 padronizado', async () => {
    const response = await request(app).get('/v1/inexistente').expect(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
