import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertIntegrationDatabase, buildApp, provisionTenant, removeTenants } from '../support/integration';

assertIntegrationDatabase();

describe('Integração - /v1/vehicles', () => {
  const app = buildApp();
  let tenant: Awaited<ReturnType<typeof provisionTenant>>;
  let vehicleId: string;

  beforeAll(async () => {
    tenant = await provisionTenant(app);
  });

  afterAll(async () => {
    await removeTenants(tenant.accountId);
  });

  const api = () => ({
    post: (url: string) => request(app).post(url).set('X-API-Key', tenant.key),
    get: (url: string) => request(app).get(url).set('X-API-Key', tenant.key),
    put: (url: string) => request(app).put(url).set('X-API-Key', tenant.key),
    patch: (url: string) => request(app).patch(url).set('X-API-Key', tenant.key),
    delete: (url: string) => request(app).delete(url).set('X-API-Key', tenant.key),
  });

  it('POST cria um veículo e retorna 201 com os dados persistidos', async () => {
    const response = await api()
      .post('/v1/vehicles')
      .send({ name: 'Van 01', capacity: 100 })
      .expect(201);

    expect(response.body.data).toMatchObject({
      accountId: tenant.accountId,
      name: 'Van 01',
      capacity: 100,
      active: true,
    });
    expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    vehicleId = response.body.data.id;
  });

  it('POST rejeita nome duplicado na mesma empresa com 409', async () => {
    const response = await api().post('/v1/vehicles').send({ name: 'VAN 01', capacity: 10 }).expect(409);
    expect(response.body.error.code).toBe('VEHICLE_NAME_ALREADY_EXISTS');
  });

  it('POST rejeita capacidade inválida e campos desconhecidos com 422', async () => {
    await api().post('/v1/vehicles').send({ name: 'Moto', capacity: -1 }).expect(422);
    await api().post('/v1/vehicles').send({ name: 'Moto', capacity: 1, color: 'red' }).expect(422);
  });

  it('GET lista os veículos da empresa com paginação', async () => {
    const response = await api().get('/v1/vehicles?page=1&limit=10').expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('GET por id retorna o veículo', async () => {
    const response = await api().get(`/v1/vehicles/${vehicleId}`).expect(200);
    expect(response.body.data.id).toBe(vehicleId);
  });

  it('GET por id retorna 422 para id inválido e 404 para id inexistente', async () => {
    await api().get('/v1/vehicles/abc').expect(422);
    const response = await api().get(`/v1/vehicles/${randomUUID()}`).expect(404);
    expect(response.body.error.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('PUT substitui todos os dados do veículo', async () => {
    const response = await api()
      .put(`/v1/vehicles/${vehicleId}`)
      .send({ name: 'Van 01 Plus', capacity: 150, active: false })
      .expect(200);
    expect(response.body.data).toMatchObject({ name: 'Van 01 Plus', capacity: 150, active: false });
  });

  it('PUT exige o corpo completo', async () => {
    await api().put(`/v1/vehicles/${vehicleId}`).send({ capacity: 10 }).expect(422);
  });

  it('PATCH altera parcialmente o veículo', async () => {
    const response = await api().patch(`/v1/vehicles/${vehicleId}`).send({ active: true }).expect(200);
    expect(response.body.data).toMatchObject({ name: 'Van 01 Plus', active: true });
  });

  it('DELETE remove o veículo e retorna 204', async () => {
    await api().delete(`/v1/vehicles/${vehicleId}`).expect(204);
    await api().get(`/v1/vehicles/${vehicleId}`).expect(404);
    await api().delete(`/v1/vehicles/${vehicleId}`).expect(404);
  });

  it('retorna 401 sem API Key', async () => {
    const response = await request(app).get('/v1/vehicles').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
