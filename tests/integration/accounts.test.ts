import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { adminKey, assertIntegrationDatabase, buildApp, removeTenants } from '../support/integration';

assertIntegrationDatabase();

describe('Integração - /v1/accounts e API Keys', () => {
  const app = buildApp();
  const slug = `empresa-${randomUUID().slice(0, 8)}`;
  let accountId: string;
  let apiKeyId: string;
  let key: string;
  const admin = {
    post: (url: string) => request(app).post(url).set('X-Admin-Key', adminKey()),
    get: (url: string) => request(app).get(url).set('X-Admin-Key', adminKey()),
    put: (url: string) => request(app).put(url).set('X-Admin-Key', adminKey()),
    patch: (url: string) => request(app).patch(url).set('X-Admin-Key', adminKey()),
    delete: (url: string) => request(app).delete(url).set('X-Admin-Key', adminKey()),
  };

  afterAll(async () => {
    await removeTenants(accountId);
  });

  it('exige a credencial administrativa', async () => {
    await request(app).get('/v1/accounts').expect(401);
  });

  it('POST cria a empresa', async () => {
    const response = await admin.post('/v1/accounts').send({ name: 'Empresa Teste', slug }).expect(201);
    expect(response.body.data).toMatchObject({ name: 'Empresa Teste', slug, status: 'active' });
    accountId = response.body.data.id;
  });

  it('POST rejeita slug duplicado', async () => {
    await admin.post('/v1/accounts').send({ name: 'Outra', slug }).expect(409);
  });

  it('GET lista e consulta a empresa', async () => {
    const list = await admin.get('/v1/accounts?deleted=false&limit=100').expect(200);
    expect(list.body.data.some((account: { id: string }) => account.id === accountId)).toBe(true);
    await admin.get(`/v1/accounts/${accountId}`).expect(200);
  });

  it('PUT e PATCH atualizam a empresa', async () => {
    await admin
      .put(`/v1/accounts/${accountId}`)
      .send({ name: 'Empresa Atualizada', slug, status: 'ACTIVE' })
      .expect(200);
    const response = await admin.patch(`/v1/accounts/${accountId}`).send({ name: 'Empresa Final' }).expect(200);
    expect(response.body.data.name).toBe('Empresa Final');
  });

  it('emite, lista e revoga API Keys', async () => {
    const created = await admin
      .post(`/v1/accounts/${accountId}/api-keys`)
      .send({ name: 'ERP', scopes: ['routing:read'] })
      .expect(201);
    apiKeyId = created.body.data.id;
    key = created.body.data.key;
    expect(created.body.data).not.toHaveProperty('keyHash');

    await request(app).get('/v1/vehicles').set('X-API-Key', key).expect(200);
    await request(app).post('/v1/vehicles').set('X-API-Key', key).send({ name: 'X', capacity: 1 }).expect(403);

    const list = await admin.get(`/v1/accounts/${accountId}/api-keys`).expect(200);
    expect(list.body.data).toHaveLength(1);

    await admin.delete(`/v1/accounts/${accountId}/api-keys/${apiKeyId}`).expect(204);
    await request(app).get('/v1/vehicles').set('X-API-Key', key).expect(401);
  });

  it('DELETE exclui logicamente a empresa', async () => {
    await admin.delete(`/v1/accounts/${accountId}`).expect(204);
    await admin.get(`/v1/accounts/${accountId}`).expect(404);
  });
});
