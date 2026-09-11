/**
 * B24 platform settings verification.
 * Usage: BASE_URL=http://127.0.0.1:5031 npx ts-node scripts/verify-b24-settings.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5031';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

function assert(cond: unknown, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

async function main() {
  const failures: string[] = [];
  const uniqueKey = `jobs.verifyBanner${Date.now()}`;

  // Public settings
  const pub = await api('/api/v1/settings/public');
  assert(pub.status === 200 && pub.body?.success, `public settings failed: ${JSON.stringify(pub.body)}`, failures);
  const settings = pub.body?.data?.settings ?? {};
  assert(typeof settings === 'object', 'public settings map missing', failures);
  assert(settings['general.appName'] !== undefined, 'expected general.appName in public settings', failures);
  assert(settings['JWT_SECRET'] === undefined, 'JWT_SECRET must never appear in public settings', failures);
  assert(settings['mongodb.uri'] === undefined, 'mongodb settings must never appear', failures);

  // Unauthenticated admin rejected
  const unauth = await api('/api/v1/admin/settings');
  assert(unauth.status === 401, `expected 401 admin settings, got ${unauth.status}`, failures);

  // Candidate rejected
  const candLogin = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });
  if (candLogin.body?.success) {
    const candToken = candLogin.body.data.accessToken as string;
    const candTry = await api('/api/v1/admin/settings', {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert(candTry.status === 403 || candTry.status === 401, `candidate should not list settings (${candTry.status})`, failures);
  } else {
    failures.push(`candidate login failed: ${JSON.stringify(candLogin.body)}`);
  }

  // Admin login
  const adminLogin = await api('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@workindia.local',
      password: 'AdminPass123!',
    }),
  });
  if (!adminLogin.body?.success) {
    failures.push(`admin login failed: ${JSON.stringify(adminLogin.body)}`);
    console.error(failures.join('\n'));
    process.exit(1);
  }
  const adminToken = adminLogin.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  // List
  const list = await api('/api/v1/admin/settings?limit=5&group=general', { headers: auth });
  assert(list.body?.success && Array.isArray(list.body.data?.settings), `admin list failed: ${JSON.stringify(list.body)}`, failures);

  // Detail
  const detail = await api('/api/v1/admin/settings/general.appName', { headers: auth });
  assert(detail.body?.success && detail.body.data?.setting?.key === 'general.appName', `detail failed: ${JSON.stringify(detail.body)}`, failures);

  // Create
  const created = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: uniqueKey,
      value: 'hello',
      type: 'string',
      group: 'jobs',
      description: 'verify banner',
      isPublic: true,
      isActive: true,
    }),
  });
  assert(created.status === 201 && created.body?.success, `create failed: ${JSON.stringify(created.body)}`, failures);

  // Duplicate key
  const dup = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: uniqueKey,
      value: 'again',
      type: 'string',
      group: 'jobs',
    }),
  });
  assert(dup.status === 409, `expected duplicate 409, got ${dup.status}`, failures);

  // Type rejection — number with invalid value
  const badNum = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: `jobs.badNum${Date.now()}`,
      value: 'not-a-number',
      type: 'number',
      group: 'jobs',
    }),
  });
  assert(badNum.status === 400, `expected number type rejection, got ${badNum.status}`, failures);

  // Boolean rejection
  const badBool = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: `jobs.badBool${Date.now()}`,
      value: 'yes',
      type: 'boolean',
      group: 'jobs',
    }),
  });
  assert(badBool.status === 400, `expected boolean type rejection, got ${badBool.status}`, failures);

  // Invalid JSON
  const badJson = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: `jobs.badJson${Date.now()}`,
      value: 'not-json{',
      type: 'json',
      group: 'jobs',
    }),
  });
  assert(badJson.status === 400, `expected json rejection, got ${badJson.status}`, failures);

  // Protected namespace
  const protectedCreate = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: 'auth.secretOverride',
      value: 'nope',
      type: 'string',
      group: 'general',
    }),
  });
  assert(protectedCreate.status === 403, `expected protected create 403, got ${protectedCreate.status}`, failures);

  // Mongo operator injection
  const inj = await api('/api/v1/admin/settings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      key: `jobs.inj${Date.now()}`,
      value: { $gt: '' },
      type: 'json',
      group: 'jobs',
    }),
  });
  assert(inj.status === 400, `expected mongo operator rejection, got ${inj.status}`, failures);

  // Mass assignment — type on update forbidden
  const mass = await api(`/api/v1/admin/settings/${uniqueKey}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ type: 'number', value: 1 }),
  });
  assert(mass.status === 400, `expected type mass-assignment rejection, got ${mass.status}`, failures);

  // Update value
  const updated = await api(`/api/v1/admin/settings/${uniqueKey}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ value: 'updated-banner' }),
  });
  assert(updated.body?.success && updated.body.data?.setting?.value === 'updated-banner', `update failed: ${JSON.stringify(updated.body)}`, failures);

  // Appears in public
  const pub2 = await api('/api/v1/settings/public');
  assert(pub2.body?.data?.settings?.[uniqueKey] === 'updated-banner', 'updated public setting missing from public map', failures);

  // Deactivate
  const deactivated = await api(`/api/v1/admin/settings/${uniqueKey}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ isActive: false }),
  });
  assert(deactivated.body?.success && deactivated.body.data?.setting?.isActive === false, `deactivate failed: ${JSON.stringify(deactivated.body)}`, failures);

  const pub3 = await api('/api/v1/settings/public');
  assert(pub3.body?.data?.settings?.[uniqueKey] === undefined, 'inactive public setting must not appear', failures);

  // Reactivate
  await api(`/api/v1/admin/settings/${uniqueKey}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ isActive: true }),
  });

  // Health still works
  const health = await api('/api/v1/health');
  assert(health.body?.success, 'health check failed', failures);

  // Jobs still list
  const jobs = await api('/api/v1/jobs?limit=5');
  assert(jobs.body?.success, `jobs regression: ${JSON.stringify(jobs.body)}`, failures);

  // Toggle maintenance briefly then restore
  await api('/api/v1/admin/settings/platform.maintenance.enabled', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ value: true }),
  });

  const blocked = await api('/api/v1/jobs?limit=1');
  assert(blocked.status === 503, `expected maintenance 503 on jobs, got ${blocked.status}`, failures);

  const adminOk = await api('/api/v1/admin/settings?limit=1', { headers: auth });
  assert(adminOk.body?.success, 'admin settings must work during maintenance', failures);

  const healthOk = await api('/api/v1/health');
  assert(healthOk.body?.success, 'health must work during maintenance', failures);

  const pubOk = await api('/api/v1/settings/public');
  assert(pubOk.body?.success, 'public settings must work during maintenance', failures);

  await api('/api/v1/admin/settings/platform.maintenance.enabled', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ value: false }),
  });

  const jobsAfter = await api('/api/v1/jobs?limit=1');
  assert(jobsAfter.body?.success, 'jobs should work after maintenance off', failures);

  if (failures.length) {
    console.error('B24 VERIFY FAILED:\n' + failures.map((f) => `- ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('B24 VERIFY PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
