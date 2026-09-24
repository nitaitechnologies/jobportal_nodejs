import {
  api,
  createAndLoginAdmin,
  createAndLoginEmployer,
} from '../helpers';
import { createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { env } from '../../src/config/env';

describe('Employer Account & Recruiters (157-164)', () => {
  it('registers owner, verifies contact, manages team, sessions, and permissions', async () => {
    const register = await api()
      .post('/api/v1/employer/auth/register')
      .send({
        name: 'Owner User',
        email: `owner_${Date.now()}@example.com`,
        phone: `9${String(Date.now()).slice(-9)}`,
        password: 'Password1',
        companyName: `Acme Team ${Date.now()}`,
        teamRole: 'owner',
      });
    expect(register.status).toBe(201);
    expect(register.body.data.employer.teamRole).toBe('owner');
    expect(register.body.data.employer.permissions.length).toBeGreaterThan(0);
    expect(register.body.data.sessionId).toBeTruthy();
    expect(register.body.data.accessToken).toBeTruthy();

    const ownerHeader = { Authorization: `Bearer ${register.body.data.accessToken}` };
    const ownerEmail = register.body.data.user.email as string;

    const sendOtp = await api()
      .post('/api/v1/employer/auth/otp/send')
      .set(ownerHeader)
      .send({ channel: 'phone' });
    expect(sendOtp.status).toBe(200);

    const verifyOtp = await api()
      .post('/api/v1/employer/auth/otp/verify')
      .set(ownerHeader)
      .send({ channel: 'phone', otp: env.candidateOtpDummy || '123456' });
    expect(verifyOtp.status).toBe(200);
    expect(verifyOtp.body.data.phoneVerified).toBe(true);

    const invite = await api()
      .post('/api/v1/employer/team/invite')
      .set(ownerHeader)
      .send({
        email: `recruiter_${Date.now()}@example.com`,
        name: 'Recruiter One',
        teamRole: 'recruiter',
      });
    expect(invite.status).toBe(201);
    const token = invite.body.data.invite.token as string;

    const accept = await api()
      .post('/api/v1/employer/auth/team/accept')
      .send({
        token,
        name: 'Recruiter One',
        phone: `8${String(Date.now()).slice(-9)}`,
        password: 'Password1',
      });
    expect(accept.status).toBe(201);
    expect(accept.body.data.employer.teamRole).toBe('recruiter');
    expect(accept.body.data.company.id).toBe(register.body.data.company.id);

    const recruiterHeader = { Authorization: `Bearer ${accept.body.data.accessToken}` };

    const companyDenied = await api()
      .patch('/api/v1/employer/company')
      .set(recruiterHeader)
      .send({ description: 'Should not update' });
    expect(companyDenied.status).toBe(403);

    const team = await api().get('/api/v1/employer/team').set(ownerHeader);
    expect(team.status).toBe(200);
    expect(team.body.data.members.length).toBeGreaterThanOrEqual(2);

    const sessions = await api().get('/api/v1/employer/auth/sessions').set(ownerHeader);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.sessions.length).toBeGreaterThanOrEqual(1);

    const logout = await api().post('/api/v1/employer/auth/logout').set(ownerHeader);
    expect(logout.status).toBe(200);
    expect(logout.body.data.revoked).toBe(true);

    const meAfterLogout = await api().get('/api/v1/employer/auth/me').set(ownerHeader);
    expect(meAfterLogout.status).toBe(401);

    // Login again for revoke-others
    const login = await api()
      .post('/api/v1/employer/auth/login')
      .send({ email: ownerEmail, password: 'Password1' });
    if (login.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('login failed', login.status, login.body);
    }
    expect(login.status).toBe(200);
    const login2 = await api()
      .post('/api/v1/employer/auth/login')
      .send({ email: ownerEmail, password: 'Password1' });
    expect(login2.status).toBe(200);

    const revokeOthers = await api()
      .post('/api/v1/employer/auth/sessions/revoke-others')
      .set({ Authorization: `Bearer ${login2.body.data.accessToken}` });
    expect(revokeOthers.status).toBe(200);
    expect(revokeOthers.body.data.revokedCount).toBeGreaterThanOrEqual(1);

    const stale = await api()
      .get('/api/v1/employer/auth/me')
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` });
    expect(stale.status).toBe(401);

    void createAndLoginAdmin;
    void createAndLoginEmployer;
    void createTestCategory;
    void createTestLocationTree;
  });
});
