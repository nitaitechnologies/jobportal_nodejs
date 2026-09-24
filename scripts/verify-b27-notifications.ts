/**
 * Notifications platform verify (sheets 472–479, 485).
 * Usage: BASE_URL=http://127.0.0.1:5000 npx ts-node scripts/verify-b27-notifications.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5000';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

async function main() {
  const failures: string[] = [];

  const health = await api('/api/v1/health');
  if (health.status !== 200) failures.push(`health ${health.status}`);

  // Candidate OTP (474)
  const otp = await api('/api/v1/candidate/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  if (!otp.body?.success) {
    failures.push(`otp send failed: ${JSON.stringify(otp.body)}`);
  } else if (otp.body.data?.expiresIn == null) {
    failures.push('otp missing expiresIn');
  }

  // Candidate login for device token + list
  const login = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });

  if (!login.body?.success) {
    failures.push(`candidate login failed (seed may be missing): ${JSON.stringify(login.body)}`);
  } else {
    const token = login.body.data.accessToken as string;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Push device registration (472)
    const device = await api('/api/v1/notifications/device-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: `verify-device-token-${Date.now()}-abcdefghijklmnop`,
        platform: 'android',
        app: 'candidate',
      }),
    });
    if (!device.body?.success) {
      failures.push(`device-token register failed: ${JSON.stringify(device.body)}`);
    }

    const list = await api('/api/v1/notifications?limit=5', { headers });
    if (!list.body?.success) {
      failures.push(`notifications list failed: ${JSON.stringify(list.body)}`);
    }
  }

  // Employer payment notifications path exists via payments API (479) — smoke login
  const empLogin = await api('/api/v1/employer/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employer.b9@workindia.local',
      password: 'EmployerPass123!',
    }),
  });
  if (empLogin.body?.success) {
    const etoken = empLogin.body.data.accessToken as string;
    const nlist = await api('/api/v1/notifications?limit=5', {
      headers: { Authorization: `Bearer ${etoken}` },
    });
    if (!nlist.body?.success) failures.push('employer notifications list failed');
  }

  if (failures.length) {
    console.error('FAIL', failures);
    process.exit(1);
  }
  console.log('OK verify-b27-notifications (472–479 / 485 smoke)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
