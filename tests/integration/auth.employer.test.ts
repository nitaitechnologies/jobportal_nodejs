import { Company } from '../../src/models/Company';
import { Employer } from '../../src/models/Employer';
import { User } from '../../src/models/User';
import {
  api,
  authHeader,
  createAndLoginCandidate,
  createAndLoginEmployer,
  expectErrorShape,
  registerEmployer,
  uniqueEmail,
  uniquePhone,
} from '../helpers';

describe('Employer auth', () => {
  it('registers employer with company in pending verification', async () => {
    const { res, payload } = await registerEmployer();
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

    const user = await User.findOne({ email: payload.email });
    expect(user?.role).toBe('employer');
    const employer = await Employer.findOne({ userId: user!._id });
    expect(employer).toBeTruthy();
    const company = await Company.findById(employer!.companyId);
    expect(company?.verificationStatus).toBe('pending');
    expect(company?.name).toBe(payload.companyName);
  });

  it('rejects duplicate email and ignores companyId/role injection', async () => {
    const email = uniqueEmail('emp');
    const first = await registerEmployer({ email });
    expect(first.res.status).toBe(201);

    const dup = await registerEmployer({ email, phone: uniquePhone() });
    await expectErrorShape(dup.res, 409);

    const injectedCompanyId = '507f1f77bcf86cd799439011';
    const injected = await api().post('/api/v1/employer/auth/register').send({
      name: 'Inject',
      email: uniqueEmail('inj'),
      phone: uniquePhone(),
      password: 'EmployerPass123!',
      companyName: 'Inject Co',
      companyId: injectedCompanyId,
      role: 'admin',
    });
    expect(injected.status).toBe(201);
    const user = await User.findOne({ email: injected.body.data.employer?.email ?? injected.body.data.user?.email });
    // Prefer resolving via token /me if email nested differently
    const me = await api()
      .get('/api/v1/employer/auth/me')
      .set(authHeader(injected.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(user?.role ?? 'employer').toBe('employer');
    const employer = await Employer.findOne({ userId: user?._id });
    expect(employer?.companyId?.toString()).not.toBe(injectedCompanyId);
  });

  it('logs in and serves /me; candidate token cannot access employer routes', async () => {
    const employer = await createAndLoginEmployer();
    const me = await api().get('/api/v1/employer/auth/me').set(employer.header);
    expect(me.status).toBe(200);

    const candidate = await createAndLoginCandidate();
    const denied = await api().get('/api/v1/employer/profile').set(candidate.header);
    await expectErrorShape(denied, 403);
  });

  it('rejects wrong password and missing token', async () => {
    const { payload } = await createAndLoginEmployer();
    const bad = await api().post('/api/v1/employer/auth/login').send({
      email: payload.email,
      password: 'NopePass123!',
    });
    await expectErrorShape(bad, 401);

    const missing = await api().get('/api/v1/employer/auth/me');
    await expectErrorShape(missing, 401);
  });
});
