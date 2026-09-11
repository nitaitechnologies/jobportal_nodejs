import { api, expectErrorShape } from '../helpers';

describe('Health & base API', () => {
  it('GET /api/v1/health returns success without secrets', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: {
        service: 'workindia-api',
        database: 'connected',
      },
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(raw).not.toMatch(/JWT_SECRET|password/i);
  });

  it('unknown route returns standard 404', async () => {
    const res = await api().get('/api/v1/this-route-does-not-exist');
    await expectErrorShape(res, 404);
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\.|node_modules/);
  });
});
