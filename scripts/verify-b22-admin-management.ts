/**
 * B22 admin management verification.
 * Usage: BASE_URL=http://127.0.0.1:5027 npx ts-node scripts/verify-b22-admin-management.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5027';

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

async function main() {
  const failures: string[] = [];

  const unauth = await api('/api/v1/admin/candidates');
  if (unauth.status !== 401) failures.push(`expected 401, got ${unauth.status}`);

  const candidateLogin = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });
  if (candidateLogin.body?.success) {
    const forbidden = await api('/api/v1/admin/candidates', {
      headers: { Authorization: `Bearer ${candidateLogin.body.data.accessToken}` },
    });
    if (forbidden.status !== 403) {
      failures.push(`candidate token should be 403 on admin, got ${forbidden.status}`);
    }
  }

  const login = await api('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@workindia.local',
      password: 'AdminPass123!',
    }),
  });
  if (!login.body?.success) {
    failures.push(`admin login failed: ${JSON.stringify(login.body)}`);
  } else {
    const token = login.body.data.accessToken as string;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const endpoints = [
      '/api/v1/admin/admin-users?limit=5',
      '/api/v1/admin/candidates?limit=5',
      '/api/v1/admin/employers?limit=5',
      '/api/v1/admin/companies?limit=5',
      '/api/v1/admin/jobs?limit=5',
      '/api/v1/admin/applications?limit=5',
      '/api/v1/admin/interviews?limit=5',
      '/api/v1/admin/audit-logs?limit=5',
    ];
    for (const path of endpoints) {
      const res = await api(path, { headers });
      if (!res.body?.success) failures.push(`${path} failed: ${JSON.stringify(res.body)}`);
    }

    // Mass assignment / Mongo operators rejected
    const mass = await api('/api/v1/admin/admin-users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Hack',
        email: 'hack@example.com',
        password: 'Password123!',
        passwordHash: 'nope',
      }),
    });
    if (mass.body?.success) failures.push('passwordHash mass assignment should fail');

    const op = await api('/api/v1/admin/candidates?status[$gt]=', { headers });
    if (op.body?.success) failures.push('mongo operator query should fail');

    // Create support admin then list
    const stamp = Date.now();
    const created = await api('/api/v1/admin/admin-users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Support Bot',
        email: `support.b22.${stamp}@workindia.local`,
        password: 'SupportPass123!',
        role: 'support',
      }),
    });
    if (!created.body?.success) {
      failures.push(`create admin failed: ${JSON.stringify(created.body)}`);
    } else {
      const id = created.body.data.adminUser.id as string;
      if (created.body.data.adminUser.passwordHash) {
        failures.push('passwordHash leaked in create response');
      }
      const detail = await api(`/api/v1/admin/admin-users/${id}`, { headers });
      if (!detail.body?.success) failures.push('get admin user failed');

      // Cannot create super_admin via nested privilege from response shape alone — verify role is support
      if (created.body.data.adminUser.role !== 'support') {
        failures.push('created role mismatch');
      }
    }

    // Company list + optional verification on first company
    const companies = await api('/api/v1/admin/companies?limit=1', { headers });
    if (companies.body?.success && companies.body.data.companies?.[0]) {
      const cid = companies.body.data.companies[0].id;
      const verify = await api(`/api/v1/admin/companies/${cid}/verification`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'pending' }),
      });
      if (!verify.body?.success && verify.status !== 409) {
        failures.push(`company verification failed: ${JSON.stringify(verify.body)}`);
      }
    }

    const health = await api('/api/v1/health');
    if (!health.body?.success) failures.push('health failed');
  }

  if (failures.length) {
    console.error('B22 VERIFY FAILED');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }
  console.log('B22 VERIFY OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
