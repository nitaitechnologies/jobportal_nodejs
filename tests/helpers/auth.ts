import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../../src/constants/permissions';
import { AdminUser } from '../../src/models/AdminUser';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/utils/password';
import { api, authHeader, uniqueEmail, uniquePhone } from './http';

export async function createTestAdmin(input?: {
  email?: string;
  password?: string;
  role?: 'super_admin' | 'admin' | 'moderator' | 'support';
  name?: string;
}) {
  const email = input?.email ?? uniqueEmail('admin');
  const password = input?.password ?? 'AdminPass123!';
  const role = input?.role ?? 'super_admin';
  const name = input?.name ?? 'Test Admin';

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    status: 'active',
    emailVerified: true,
  });

  const admin = await AdminUser.create({
    userId: user._id,
    role,
    permissions:
      role === 'super_admin'
        ? [...ALL_PERMISSIONS]
        : [...ROLE_DEFAULT_PERMISSIONS[role]],
    status: 'active',
  });

  return { user, admin, email, password };
}

export async function loginAdmin(email: string, password: string) {
  const res = await api().post('/api/v1/admin/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  return {
    token: res.body.data.accessToken as string,
    header: authHeader(res.body.data.accessToken as string),
    body: res.body,
  };
}

export async function createAndLoginAdmin(
  opts?: Parameters<typeof createTestAdmin>[0],
) {
  const created = await createTestAdmin(opts);
  const session = await loginAdmin(created.email, created.password);
  return { ...created, ...session };
}

export async function registerCandidate(input?: {
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
}) {
  const payload = {
    name: input?.name ?? 'Test Candidate',
    email: input?.email ?? uniqueEmail('candidate'),
    phone: input?.phone ?? uniquePhone(),
    password: input?.password ?? 'CandidatePass123!',
  };
  const res = await api().post('/api/v1/candidate/auth/register').send(payload);
  return { res, payload };
}

export async function createAndLoginCandidate(
  input?: Parameters<typeof registerCandidate>[0],
) {
  const { res, payload } = await registerCandidate(input);
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  const token = res.body.data.accessToken as string;
  return {
    token,
    header: authHeader(token),
    payload,
    body: res.body,
  };
}

export async function registerEmployer(input?: {
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
  companyName?: string;
}) {
  const payload = {
    name: input?.name ?? 'Test Employer',
    email: input?.email ?? uniqueEmail('employer'),
    phone: input?.phone ?? uniquePhone(),
    password: input?.password ?? 'EmployerPass123!',
    companyName: input?.companyName ?? `Acme ${Date.now()}`,
  };
  const res = await api().post('/api/v1/employer/auth/register').send(payload);
  return { res, payload };
}

export async function createAndLoginEmployer(
  input?: Parameters<typeof registerEmployer>[0],
) {
  const { res, payload } = await registerEmployer(input);
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  const token = res.body.data.accessToken as string;
  return {
    token,
    header: authHeader(token),
    payload,
    body: res.body,
  };
}
