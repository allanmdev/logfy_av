import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/shared/database/prisma';
import { assertIntegrationDatabase, buildApp, provisionTenant, removeTenants } from '../support/integration';

assertIntegrationDatabase();

describe('Integração - /v1/route-plans/:routePlanId/deliveries', () => {
  const app = buildApp();
  let tenant: Awaited<ReturnType<typeof provisionTenant>>;
  let planId: string;
  let deliveryId: string;
  const depot = { depotLatitude: -26.3044, depotLongitude: -48.8487 };
  const payload = {
    reference: 'PEDIDO-001',
    latitude: -26.2951,
    longitude: -48.8458,
    demand: 10,
    serviceDurationSeconds: 300,
  };

  const api = {
    post: (url: string) => request(app).post(url).set('X-API-Key', tenant.key),
    get: (url: string) => request(app).get(url).set('X-API-Key', tenant.key),
    put: (url: string) => request(app).put(url).set('X-API-Key', tenant.key),
    patch: (url: string) => request(app).patch(url).set('X-API-Key', tenant.key),
    delete: (url: string) => request(app).delete(url).set('X-API-Key', tenant.key),
  };
  const base = () => `/v1/route-plans/${planId}/deliveries`;

  beforeAll(async () => {
    tenant = await provisionTenant(app);
    const plan = await api.post('/v1/route-plans').send({ name: 'Plano de entregas', ...depot }).expect(201);
    planId = plan.body.data.id;
  });

  afterAll(async () => {
    await removeTenants(tenant.accountId);
  });

  it('POST cria a entrega vinculada ao plano e retorna 201', async () => {
    const response = await api.post(base()).send(payload).expect(201);
    expect(response.body.data).toMatchObject({ ...payload, routePlanId: planId, accountId: tenant.accountId });
    deliveryId = response.body.data.id;
  });

  it('POST aplica serviceDurationSeconds = 0 por padrão', async () => {
    const response = await api
      .post(base())
      .send({ reference: 'PEDIDO-002', latitude: -26.29, longitude: -48.84, demand: 5 })
      .expect(201);
    expect(response.body.data.serviceDurationSeconds).toBe(0);
  });

  it('POST rejeita referência duplicada no plano com 409', async () => {
    const response = await api.post(base()).send(payload).expect(409);
    expect(response.body.error.code).toBe('DELIVERY_REFERENCE_ALREADY_EXISTS');
  });

  it('POST rejeita entrega na coordenada do depósito com 422', async () => {
    const response = await api
      .post(base())
      .send({ ...payload, reference: 'NO-DEPOSITO', latitude: depot.depotLatitude, longitude: depot.depotLongitude })
      .expect(422);
    expect(response.body.error.code).toBe('DELIVERY_AT_DEPOT');
  });

  it('POST retorna 404 quando o plano não existe', async () => {
    const response = await api
      .post(`/v1/route-plans/${randomUUID()}/deliveries`)
      .send(payload)
      .expect(404);
    expect(response.body.error.code).toBe('ROUTE_PLAN_NOT_FOUND');
  });

  it('GET lista as entregas do plano', async () => {
    const response = await api.get(`${base()}?limit=1`).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('GET por id retorna a entrega', async () => {
    const response = await api.get(`${base()}/${deliveryId}`).expect(200);
    expect(response.body.data.reference).toBe('PEDIDO-001');
  });

  it('PUT substitui todos os dados da entrega', async () => {
    const response = await api
      .put(`${base()}/${deliveryId}`)
      .send({ ...payload, reference: 'PEDIDO-001-A', demand: 15 })
      .expect(200);
    expect(response.body.data).toMatchObject({ reference: 'PEDIDO-001-A', demand: 15 });
  });

  it('PATCH impede trocar para uma referência existente', async () => {
    await api.patch(`${base()}/${deliveryId}`).send({ reference: 'PEDIDO-002' }).expect(409);
  });

  it('PATCH altera parcialmente a entrega', async () => {
    const response = await api.patch(`${base()}/${deliveryId}`).send({ demand: 20 }).expect(200);
    expect(response.body.data).toMatchObject({ reference: 'PEDIDO-001-A', demand: 20 });
  });

  it('alterar entregas devolve o plano para rascunho e incrementa a versão', async () => {
    const plan = await api.get(`/v1/route-plans/${planId}`).expect(200);
    expect(plan.body.data.status).toBe('draft');
    expect(plan.body.data.version).toBeGreaterThanOrEqual(4);
  });

  it('DELETE remove a entrega e retorna 204', async () => {
    await api.delete(`${base()}/${deliveryId}`).expect(204);
    await api.get(`${base()}/${deliveryId}`).expect(404);
  });

  it('excluir o plano remove as entregas em cascata (chave estrangeira)', async () => {
    await api.delete(`/v1/route-plans/${planId}`).expect(204);
    expect(await prisma.delivery.count({ where: { routePlanId: planId } })).toBe(0);
  });
});
