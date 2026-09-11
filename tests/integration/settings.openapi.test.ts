import { buildOpenApiDocument } from '../../src/docs/openapi';
import { api, createAndLoginAdmin, expectErrorShape } from '../helpers';

/**
 * Lightweight OpenAPI checks without ESM-only swagger-parser under Jest CJS.
 * Full $ref resolve is still exercised offline via buildOpenApiDocument paths.
 */
function assertOpenApiDocument(doc: Record<string, unknown>) {
  expect(doc.openapi).toEqual(expect.stringMatching(/^3\./));
  expect(doc.info).toBeTruthy();
  expect(doc.paths).toBeTruthy();
  const components = doc.components as {
    securitySchemes?: { bearerAuth?: unknown };
    schemas?: Record<string, unknown>;
  };
  expect(components?.securitySchemes?.bearerAuth).toBeTruthy();

  const paths = doc.paths as Record<string, Record<string, { operationId?: string; $ref?: string }>>;
  expect(paths['/api/v1/health']).toBeTruthy();
  expect(paths['/api/v1/candidate/auth/login']).toBeTruthy();

  const ids = new Set<string>();
  for (const [, item] of Object.entries(paths)) {
    if (!item) continue;
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method];
      if (!op) continue;
      expect(op.$ref).toBeUndefined();
      if (op.operationId) {
        expect(ids.has(op.operationId)).toBe(false);
        ids.add(op.operationId);
      }
    }
  }
  expect(ids.size).toBeGreaterThan(50);
}

describe('Settings & OpenAPI contract', () => {
  it('exposes valid OpenAPI JSON without secrets', async () => {
    const res = await api().get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    assertOpenApiDocument(res.body);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(raw).not.toMatch(/change-me-to-a-long-random-secret/i);
    expect(raw).not.toMatch(/AWS_SECRET|R2_|RAZORPAY|STRIPE_SECRET/i);

    assertOpenApiDocument(buildOpenApiDocument() as unknown as Record<string, unknown>);
  });

  it('serves Swagger UI HTML', async () => {
    const res = await api().get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain('swagger');
  });

  it('admin can list and create settings; public only sees public keys', async () => {
    const admin = await createAndLoginAdmin();
    const key = `jobs.banner${Date.now()}`;
    const created = await api()
      .post('/api/v1/admin/settings')
      .set(admin.header)
      .send({
        key,
        value: 'Hello',
        type: 'string',
        group: 'jobs',
        isPublic: true,
        isActive: true,
      });
    expect(created.status).toBe(201);

    const pub = await api().get('/api/v1/settings/public');
    expect(pub.body.data.settings[key]).toBe('Hello');

    await api()
      .patch(`/api/v1/admin/settings/${key}/status`)
      .set(admin.header)
      .send({ isActive: false });
    const pub2 = await api().get('/api/v1/settings/public');
    expect(pub2.body.data.settings[key]).toBeUndefined();
  });

  it('rejects invalid setting types', async () => {
    const admin = await createAndLoginAdmin();
    await expectErrorShape(
      await api()
        .post('/api/v1/admin/settings')
        .set(admin.header)
        .send({
          key: `jobs.bad${Date.now()}`,
          value: 'nope',
          type: 'number',
          group: 'jobs',
        }),
      400,
    );
  });
});
