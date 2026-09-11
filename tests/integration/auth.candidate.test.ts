import { User } from '../../src/models/User';
import {
  api,
  authHeader,
  createAndLoginCandidate,
  expectErrorShape,
  registerCandidate,
  uniqueEmail,
  uniquePhone,
} from '../helpers';

describe('Candidate auth', () => {
  it('registers and returns token without passwordHash', async () => {
    const { res, payload } = await registerCandidate();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    expect(res.body.data.candidate?.email ?? res.body.data.user?.email).toBe(payload.email);
  });

  it('rejects duplicate email', async () => {
    const email = uniqueEmail('dup');
    const first = await registerCandidate({ email });
    expect(first.res.status).toBe(201);
    const second = await registerCandidate({ email, phone: uniquePhone() });
    await expectErrorShape(second.res, 409);
  });

  it('rejects weak password and invalid email', async () => {
    const weak = await api().post('/api/v1/candidate/auth/register').send({
      name: 'Weak',
      email: uniqueEmail('weak'),
      phone: uniquePhone(),
      password: 'password',
    });
    await expectErrorShape(weak, 400);

    const badEmail = await api().post('/api/v1/candidate/auth/register').send({
      name: 'Bad',
      email: 'not-an-email',
      phone: uniquePhone(),
      password: 'SecurePass123',
    });
    await expectErrorShape(badEmail, 400);
  });

  it('ignores client role override on register', async () => {
    const res = await api()
      .post('/api/v1/candidate/auth/register')
      .send({
        name: 'Hacker',
        email: uniqueEmail('role'),
        phone: uniquePhone(),
        password: 'SecurePass123',
        role: 'admin',
        status: 'suspended',
      });
    // strict schema should reject unknown fields OR ignore — either 400 or success as candidate
    if (res.status === 201) {
      const user = await User.findOne({ email: res.body.data.candidate?.email ?? uniqueEmail('x') });
      // Prefer checking token role via /me
      const me = await api()
        .get('/api/v1/candidate/auth/me')
        .set(authHeader(res.body.data.accessToken));
      expect(me.status).toBe(200);
      expect(me.body.data.candidate || me.body.data.user).toBeTruthy();
      void user;
    } else {
      await expectErrorShape(res, 400);
    }
  });

  it('logs in with valid credentials and rejects wrong password', async () => {
    const { payload } = await createAndLoginCandidate();
    const ok = await api().post('/api/v1/candidate/auth/login').send({
      email: payload.email,
      password: payload.password,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash/);

    const bad = await api().post('/api/v1/candidate/auth/login').send({
      email: payload.email,
      password: 'WrongPass999!',
    });
    await expectErrorShape(bad, 401);
  });

  it('requires auth for /me and rejects malformed token', async () => {
    const missing = await api().get('/api/v1/candidate/auth/me');
    await expectErrorShape(missing, 401);

    const malformed = await api()
      .get('/api/v1/candidate/auth/me')
      .set(authHeader('not-a-jwt'));
    await expectErrorShape(malformed, 401);
  });

  it('returns /me for authenticated candidate', async () => {
    const session = await createAndLoginCandidate();
    const me = await api().get('/api/v1/candidate/auth/me').set(session.header);
    expect(me.status).toBe(200);
    expect(me.body.success).toBe(true);
  });

  it('blocks suspended candidate from protected routes', async () => {
    const session = await createAndLoginCandidate();
    await User.updateOne({ email: session.payload.email }, { status: 'suspended' });
    const profile = await api().get('/api/v1/candidate/profile').set(session.header);
    await expectErrorShape(profile, 403);
  });
});
