import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import {
  api,
  authHeader,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  expectErrorShape,
  uniqueEmail,
  uniquePhone,
} from '../helpers';

describe('Security regression', () => {
  it('rejects missing/invalid tokens on protected routes', async () => {
    await expectErrorShape(await api().get('/api/v1/candidate/profile'), 401);
    await expectErrorShape(
      await api().get('/api/v1/candidate/profile').set(authHeader('abc.def.ghi')),
      401,
    );
  });

  it('rejects expired JWT', async () => {
    const expired = jwt.sign(
      {
        userId: '507f1f77bcf86cd799439011',
        role: 'candidate',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.jwtSecret,
      { algorithm: 'HS256' },
    );
    await expectErrorShape(
      await api().get('/api/v1/candidate/profile').set(authHeader(expired)),
      401,
    );
  });

  it('blocks mass assignment on candidate profile', async () => {
    const candidate = await createAndLoginCandidate();
    const res = await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({
        role: 'admin',
        status: 'active',
        passwordHash: 'hacked',
        candidateId: '507f1f77bcf86cd799439011',
        headline: 'Safe headline update',
      });
    await expectErrorShape(res, 400);
  });

  it('blocks Mongo operators in settings create', async () => {
    const admin = await createAndLoginAdmin();
    const res = await api()
      .post('/api/v1/admin/settings')
      .set(admin.header)
      .send({
        key: `jobs.inj${Date.now()}`,
        value: { $gt: '' },
        type: 'json',
        group: 'jobs',
      });
    await expectErrorShape(res, 400);
  });

  it('blocks protected settings namespace', async () => {
    const admin = await createAndLoginAdmin();
    const res = await api()
      .post('/api/v1/admin/settings')
      .set(admin.header)
      .send({
        key: 'auth.secretOverride',
        value: 'nope',
        type: 'string',
        group: 'general',
      });
    await expectErrorShape(res, 403);
  });

  it('rejects oversized search and invalid ObjectId params', async () => {
    await expectErrorShape(
      await api().get('/api/v1/jobs').query({ q: 'x'.repeat(500) }),
      400,
    );
    const employer = await createAndLoginEmployer();
    await expectErrorShape(
      await api().get('/api/v1/employer/jobs/not-an-id').set(employer.header),
      400,
    );
  });

  it('public settings never expose secrets', async () => {
    const res = await api().get('/api/v1/settings/public');
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/JWT_SECRET|MONGODB_URI|passwordHash/i);
  });

  it('candidate cannot register as admin via body', async () => {
    const res = await api().post('/api/v1/candidate/auth/register').send({
      name: 'Nope',
      email: uniqueEmail('sec'),
      phone: uniquePhone(),
      password: 'SecurePass123',
      role: 'admin',
    });
    expect(res.status).toBe(201);
    const me = await api()
      .get('/api/v1/candidate/auth/me')
      .set(authHeader(res.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.candidate || me.body.data.user).toBeTruthy();
    const raw = JSON.stringify(me.body);
    expect(raw).not.toMatch(/"role"\s*:\s*"admin"/);
  });

  it('rejects candidate token on employer analytics', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api().get('/api/v1/employer/analytics').set(candidate.header),
      403,
    );
  });
});
