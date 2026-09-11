/**
 * B21 analytics verification (manual — no Jest suite in package.json).
 * Usage: BASE_URL=http://127.0.0.1:5026 npx ts-node scripts/verify-b21-analytics.ts
 */
import mongoose from 'mongoose';
import { trackAnalyticsEvent, trackSafely } from '../src/services/analytics.service';
import { AnalyticsEvent } from '../src/models/AnalyticsEvent';
import { env } from '../src/config/env';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5026';

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

async function main() {
  const failures: string[] = [];

  // --- Service-level checks ---
  await mongoose.connect(env.mongodbUri);

  try {
    await trackAnalyticsEvent({
      eventType: 'job_view',
      actorRole: 'anonymous',
      entityType: 'job',
      metadata: { password: 'secret', token: 'x', ok: 1 },
    });
  } catch (e) {
    failures.push(`valid event creation failed: ${String(e)}`);
  }

  try {
    await trackAnalyticsEvent({ eventType: 'not_a_real_event' as never });
    failures.push('invalid event type should have been rejected');
  } catch {
    // expected
  }

  let isolated = false;
  await trackSafely({ eventType: 'not_a_real_event' as never });
  isolated = true;
  if (!isolated) failures.push('trackSafely isolation failed');

  const last = await AnalyticsEvent.findOne({ eventType: 'job_view' }).sort({ createdAt: -1 });
  if (last?.metadata && 'password' in (last.metadata as object)) {
    failures.push('sensitive metadata leaked');
  }
  if (last?.metadata && !('ok' in (last.metadata as object))) {
    failures.push('safe metadata missing');
  }

  // --- HTTP checks ---
  const unauth = await api('/api/v1/admin/analytics/overview');
  if (unauth.status !== 401) failures.push(`expected 401 unauth overview, got ${unauth.status}`);

  const login = await api('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@workindia.local',
      password: 'AdminPass123!',
    }),
  });
  if (!login.body?.success || !login.body?.data?.accessToken) {
    failures.push(`admin login failed: ${JSON.stringify(login.body)}`);
  } else {
    const token = login.body.data.accessToken as string;
    const headers = { Authorization: `Bearer ${token}` };

    const endpoints = [
      '/api/v1/admin/analytics/overview?preset=last_7_days&granularity=day',
      '/api/v1/admin/analytics/events?limit=5',
      '/api/v1/admin/analytics/jobs?limit=5',
      '/api/v1/admin/analytics/employers?limit=5',
      '/api/v1/admin/analytics/candidates?limit=5',
      '/api/v1/admin/analytics/categories?limit=5',
      '/api/v1/admin/analytics/locations?limit=5',
    ];

    for (const path of endpoints) {
      const res = await api(path, { headers });
      if (!res.body?.success) {
        failures.push(`${path} failed: ${JSON.stringify(res.body)}`);
      }
    }

    const badRange = await api(
      '/api/v1/admin/analytics/overview?preset=custom&from=2026-09-10&to=2026-09-01',
      { headers },
    );
    if (badRange.body?.success) {
      failures.push('invalid custom range should fail');
    }

    const employerLogin = await api('/api/v1/employer/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employer.b9@workindia.local',
        password: 'EmployerPass123!',
      }),
    });
    if (employerLogin.body?.success) {
      const et = employerLogin.body.data.accessToken as string;
      const empAnalytics = await api('/api/v1/employer/analytics?preset=last_30_days', {
        headers: { Authorization: `Bearer ${et}` },
      });
      if (!empAnalytics.body?.success) {
        failures.push(`employer analytics failed: ${JSON.stringify(empAnalytics.body)}`);
      } else if (
        empAnalytics.body.data?.companyId &&
        employerLogin.body.data?.employer?.companyId &&
        empAnalytics.body.data.companyId !== employerLogin.body.data.employer.companyId
      ) {
        failures.push('employer analytics companyId mismatch');
      }
    } else {
      failures.push(`employer login failed: ${JSON.stringify(employerLogin.body)}`);
    }

    // regression smoke
    const health = await api('/api/v1/health');
    if (!health.body?.success) failures.push('health check failed');
  }

  await mongoose.disconnect();

  if (failures.length) {
    console.error('B21 VERIFY FAILED');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }

  console.log('B21 VERIFY OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
