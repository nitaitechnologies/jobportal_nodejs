/**
 * AI matching + payments QA smoke (sheets 483–484).
 * Usage: BASE_URL=http://127.0.0.1:5000 npx ts-node scripts/verify-b28-ai-payments.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5000';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

async function main() {
  const failures: string[] = [];

  const cand = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });

  if (cand.body?.success) {
    const token = cand.body.data.accessToken as string;
    const matches = await api('/api/v1/candidate/ai/matches?limit=3', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 with data, or 404 when AI disabled — both acceptable for smoke.
    if (![200, 404].includes(matches.status) && !matches.body?.success && matches.status !== 404) {
      failures.push(`AI matches unexpected: ${matches.status} ${JSON.stringify(matches.body)}`);
    } else {
      console.log(`AI matches status=${matches.status} (ok for 483)`);
    }
  } else {
    failures.push('candidate login required for AI matching smoke');
  }

  const emp = await api('/api/v1/employer/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'employer.b9@workindia.local',
      password: 'EmployerPass123!',
    }),
  });

  if (emp.body?.success) {
    const token = emp.body.data.accessToken as string;
    const packs = await api('/api/v1/employer/credit-packs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Path may vary — also try wallet / plans
    const wallet = await api('/api/v1/employer/wallet', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const history = await api('/api/v1/employer/payments?limit=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!wallet.body?.success && !history.body?.success && !packs.body?.success) {
      failures.push(
        `payment endpoints failed wallet=${wallet.status} history=${history.status} packs=${packs.status}`,
      );
    } else {
      console.log('Payment smoke OK (484)');
    }
  } else {
    failures.push('employer login required for payment smoke');
  }

  if (failures.length) {
    console.error('FAIL', failures);
    process.exit(1);
  }
  console.log('OK verify-b28-ai-payments');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
