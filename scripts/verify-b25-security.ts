/**
 * B25 security hardening verification.
 * Usage: BASE_URL=http://127.0.0.1:5032 npx ts-node scripts/verify-b25-security.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5032';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body, headers: res.headers };
}

function assert(cond: unknown, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

async function main() {
  const failures: string[] = [];

  // Health — no secrets
  const health = await api('/api/v1/health');
  assert(health.body?.success, 'health failed', failures);
  const healthStr = JSON.stringify(health.body);
  assert(!/mongodb:\/\//i.test(healthStr), 'health leaked mongo uri', failures);
  assert(!/jwt/i.test(healthStr), 'health leaked jwt', failures);

  // Missing token
  const noTok = await api('/api/v1/candidate/profile');
  assert(noTok.status === 401, `expected 401 missing token, got ${noTok.status}`, failures);

  // Malformed JWT
  const badJwt = await api('/api/v1/candidate/profile', {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  assert(badJwt.status === 401, `expected 401 bad jwt, got ${badJwt.status}`, failures);

  // Invalid credentials (generic message)
  const badLogin = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nosuch@workindia.local', password: 'WrongPass123!' }),
  });
  assert(badLogin.status === 401, `expected 401 bad login, got ${badLogin.status}`, failures);
  assert(
    !String(badLogin.body?.message || '').toLowerCase().includes('not found'),
    'login should not enumerate users',
    failures,
  );

  // Mongo operator injection on settings (admin)
  const adminLogin = await api('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@workindia.local',
      password: 'AdminPass123!',
    }),
  });
  assert(adminLogin.body?.success, `admin login failed: ${JSON.stringify(adminLogin.body)}`, failures);
  const adminToken = adminLogin.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const inj = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: `jobs.secInj${Date.now()}`,
      value: { $gt: '' },
      type: 'json',
      group: 'jobs',
    }),
  });
  assert(inj.status === 400, `expected mongo op rejection, got ${inj.status}`, failures);

  // Mass assignment — role on candidate profile
  const candLogin = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });
  assert(candLogin.body?.success, `candidate login failed: ${JSON.stringify(candLogin.body)}`, failures);
  const candToken = candLogin.body.data.accessToken as string;

  const mass = await api('/api/v1/candidate/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${candToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin', passwordHash: 'x', status: 'active' }),
  });
  assert(mass.status === 400, `expected mass-assignment rejection, got ${mass.status}`, failures);

  // Candidate cannot hit admin
  const candAdmin = await api('/api/v1/admin/settings', {
    headers: { Authorization: `Bearer ${candToken}` },
  });
  assert(
    candAdmin.status === 401 || candAdmin.status === 403,
    `candidate→admin should be denied (${candAdmin.status})`,
    failures,
  );

  // Invalid ObjectId
  const badId = await api('/api/v1/employer/jobs/not-an-objectid', {
    headers: {
      Authorization: `Bearer ${(
        await api('/api/v1/employer/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'employer.b9@workindia.local',
            password: 'EmployerPass123!',
          }),
        })
      ).body?.data?.accessToken}`,
    },
  });
  assert(badId.status === 400, `expected 400 invalid job id, got ${badId.status}`, failures);

  // Huge pagination limit rejected
  const huge = await api('/api/v1/jobs?limit=9999');
  assert(huge.status === 400, `expected 400 huge limit, got ${huge.status}`, failures);

  // Unsafe sort rejected if present
  const badSort = await api('/api/v1/jobs?sort=passwordHash');
  assert(badSort.status === 400, `expected 400 bad sort, got ${badSort.status}`, failures);

  // Public settings still work
  const pub = await api('/api/v1/settings/public');
  assert(pub.body?.success, 'public settings regression', failures);
  assert(pub.body?.data?.settings?.['JWT_SECRET'] === undefined, 'settings leaked JWT', failures);

  // Weak register password
  const weak = await api('/api/v1/candidate/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Weak User',
      email: `weak${Date.now()}@workindia.local`,
      phone: '9876543210',
      password: 'password',
    }),
  });
  assert(weak.status === 400, `expected weak password rejection, got ${weak.status}`, failures);

  // Error disclosure — force 404 and ensure no stack in production-like response shape
  const nf = await api('/api/v1/jobs/000000000000000000000000');
  const nfStr = JSON.stringify(nf.body);
  assert(!nfStr.includes('at '), 'not-found should not include stack frames', failures);
  assert(!nfStr.toLowerCase().includes('mongodb'), 'errors should not mention mongodb', failures);

  // Regression smoke
  const jobs = await api('/api/v1/jobs?limit=5');
  assert(jobs.body?.success, `jobs regression: ${JSON.stringify(jobs.body)}`, failures);
  const settingsAdmin = await api('/api/v1/admin/settings?limit=3', { headers: auth });
  assert(settingsAdmin.body?.success, 'admin settings regression', failures);

  if (failures.length) {
    console.error('B25 VERIFY FAILED:\n' + failures.map((f) => `- ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('B25 VERIFY PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
