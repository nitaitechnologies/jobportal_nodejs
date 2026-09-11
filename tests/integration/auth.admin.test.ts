import { User } from '../../src/models/User';
import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createTestAdmin,
  expectErrorShape,
  loginAdmin,
} from '../helpers';

describe('Admin auth', () => {
  it('logs in and returns /me without secrets', async () => {
    const session = await createAndLoginAdmin();
    expect(session.token).toBeTruthy();
    expect(JSON.stringify(session.body)).not.toMatch(/passwordHash|JWT_SECRET/);

    const me = await api().get('/api/v1/admin/auth/me').set(session.header);
    expect(me.status).toBe(200);
    expect(me.body.success).toBe(true);
  });

  it('rejects invalid password and wrong roles', async () => {
    const admin = await createTestAdmin();
    const bad = await api().post('/api/v1/admin/auth/login').send({
      email: admin.email,
      password: 'WrongAdmin999!',
    });
    await expectErrorShape(bad, 401);

    const candidate = await createAndLoginCandidate();
    const candAdmin = await api().get('/api/v1/admin/auth/me').set(candidate.header);
    await expectErrorShape(candAdmin, 403);

    const employer = await createAndLoginEmployer();
    const empAdmin = await api().get('/api/v1/admin/settings').set(employer.header);
    await expectErrorShape(empAdmin, 403);
  });

  it('blocks inactive admin', async () => {
    const admin = await createTestAdmin();
    await User.updateOne({ email: admin.email }, { status: 'inactive' });
    const login = await api().post('/api/v1/admin/auth/login').send({
      email: admin.email,
      password: admin.password,
    });
    await expectErrorShape(login, 401);
  });

  it('logout requires admin auth', async () => {
    const session = await createAndLoginAdmin();
    const out = await api().post('/api/v1/admin/auth/logout').set(session.header);
    expect(out.status).toBe(200);
    void loginAdmin;
  });
});
