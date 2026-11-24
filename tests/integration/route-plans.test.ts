import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertIntegrationDatabase, buildApp, provisionTenant, removeTenants } from '../support/integration';

assertIntegrationDatabase();

describe('Integração - /v1/route-plans', () => {
  const app = buildApp();
  let tenant: Awaited<ReturnType<typeof provisionTenant>>;
  let other: Awaited<ReturnType<typeof provisionTenant>>;
  let planId: string;
  const payload = { name: 'Rota da manhã', depotLatitude: -26.3044, depotLongitude: -48.8487 };

  beforeAll(async () => {
    tenant = await provisionTenant(app);
    other = await provisionTenant(app);
  });

  afterAll(async () => {
    await removeTenants(tenant.accountId, other.accountId);
  });

  const as = (key: () => string) => ({
    post: (url: string) => request(app).post(url).set('X-API-Key', key()),
    get: (url: string) => request(app).get(url).set('X-API-Key', key()),
    put: (url: string) => request(app).put(url).set('X-API-Key', key()),
    patch: (url: string) => request(app).patch(url).set('X-API-Key', key()),
    delete: (url: string) => request(app).delete(url).set('X-API-Key', key()),
  });
  const api = as(() => tenant.key);
  const intruder = as(() => other.key);

  it('POST cria um plano em rascunho e retorna 201', async () => {
    const response = await api.post('/v1/route-plans').send(payload).expect(201);
    expect(response.body.data).toMatchObject({ ...payload, status: 'draft', version: 0 });
    planId = response.body.data.id;
  });

  it('POST rejeita depósito na coordenada (0, 0)', async () => {
    const response = await api
      .post('/v1/route-plans')
      .send({ name: 'Inválido', depotLatitude: 0, depotLongitude: 0 })
      .expect(422);
    expect(response.body.error.code).toBe('INVALID_COORDINATE');
  });

  it('POST rejeita latitude fora da faixa', async () => {
    await api.post('/v1/route-plans').send({ ...payload, depotLatitude: 95 }).expect(422);
  });

  it('GET lista os planos da empresa', async () => {
    const response = await api.get('/v1/route-plans').expect(200);
    expect(response.body.data.map((plan: { id: string }) => plan.id)).toEqual([planId]);
    expect(response.body.pagination.total).toBe(1);
  });

  it('GET por id retorna o plano e outra empresa recebe 404', async () => {
    await api.get(`/v1/route-plans/${planId}`).expect(200);
    await intruder.get(`/v1/route-plans/${planId}`).expect(404);
    await api.get(`/v1/route-plans/${randomUUID()}`).expect(404);
  });

  it('PUT substitui os dados e incrementa a versão', async () => {
    const response = await api
      .put(`/v1/route-plans/${planId}`)
      .send({ name: 'Rota da tarde', depotLatitude: -26.31, depotLongitude: -48.85 })
      .expect(200);
    expect(response.body.data).toMatchObject({ name: 'Rota da tarde', depotLatitude: -26.31, version: 1 });
  });

  it('PATCH altera somente o nome', async () => {
    const response = await api.patch(`/v1/route-plans/${planId}`).send({ name: 'Rota noturna' }).expect(200);
    expect(response.body.data).toMatchObject({ name: 'Rota noturna', depotLatitude: -26.31, version: 2 });
  });

  it('PATCH com corpo vazio retorna 422', async () => {
    await api.patch(`/v1/route-plans/${planId}`).send({}).expect(422);
  });

  it('DELETE de outra empresa retorna 404 e não remove o plano', async () => {
    await intruder.delete(`/v1/route-plans/${planId}`).expect(404);
    await api.get(`/v1/route-plans/${planId}`).expect(200);
  });

  it('DELETE remove o plano e retorna 204', async () => {
    await api.delete(`/v1/route-plans/${planId}`).expect(204);
    await api.get(`/v1/route-plans/${planId}`).expect(404);
  });
});
