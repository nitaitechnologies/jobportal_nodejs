/**
 * B23 media upload verification.
 * Usage: BASE_URL=http://127.0.0.1:5030 npx ts-node scripts/verify-b23-media.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5030';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    return { status: res.status, body, buffer: null as Buffer | null };
  }
  const ab = await res.arrayBuffer();
  return { status: res.status, body: {} as Record<string, any>, buffer: Buffer.from(ab) };
}

function tinyPng(): Buffer {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

async function tinyPdf(): Promise<Buffer> {
  // Minimal valid-enough PDF signature for magic-byte checks.
  return Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
}

async function main() {
  const failures: string[] = [];

  const unauth = await api('/api/v1/candidate/profile/avatar', { method: 'POST' });
  if (unauth.status !== 401) failures.push(`expected 401 avatar, got ${unauth.status}`);

  const login = await api('/api/v1/candidate/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'candidate.b9@workindia.local',
      password: 'CandidatePass123!',
    }),
  });
  if (!login.body?.success) {
    failures.push(`candidate login failed: ${JSON.stringify(login.body)}`);
  } else {
    const token = login.body.data.accessToken as string;

    // Reject dangerous extension
    const formBad = new FormData();
    formBad.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'evil.svg');
    const badExt = await api('/api/v1/candidate/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formBad as any,
    });
    if (badExt.body?.success) failures.push('svg/png spoof with .svg name should fail');

    // Upload avatar
    const formAvatar = new FormData();
    formAvatar.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'avatar.png');
    const avatar = await api('/api/v1/candidate/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formAvatar as any,
    });
    if (!avatar.body?.success) {
      failures.push(`avatar upload failed: ${JSON.stringify(avatar.body)}`);
    } else {
      const url = avatar.body.data.avatar as string;
      if (!url.includes('/media/public/')) failures.push('avatar url not public media path');
      const mediaPath = url.startsWith('http') ? new URL(url).pathname : url;
      const streamed = await api(mediaPath);
      if (streamed.status !== 200) failures.push(`public avatar stream failed ${streamed.status}`);
    }

    // Resume PDF
    const pdf = await tinyPdf();
    const formResume = new FormData();
    formResume.append('file', new Blob([pdf], { type: 'application/pdf' }), 'resume.pdf');
    const resume = await api('/api/v1/candidate/profile/resume', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formResume as any,
    });
    if (!resume.body?.success) {
      failures.push(`resume upload failed: ${JSON.stringify(resume.body)}`);
    } else {
      const meta = await api('/api/v1/candidate/profile/resume', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meta.body?.success || !meta.body.data?.resume?.hasResume) {
        failures.push('resume metadata missing');
      }
      if (meta.body.data?.resume?.resume === 'media:') {
        failures.push('raw media ref leaked');
      }

      const dl = await api('/api/v1/candidate/profile/resume/download', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dl.status !== 200 || !dl.buffer?.length) {
        failures.push(`resume download failed status=${dl.status}`);
      }

      // IDOR: employer cannot download
      const empLogin = await api('/api/v1/employer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'employer.b9@workindia.local',
          password: 'EmployerPass123!',
        }),
      });
      if (empLogin.body?.success) {
        const et = empLogin.body.data.accessToken as string;
        const denied = await api('/api/v1/candidate/profile/resume/download', {
          headers: { Authorization: `Bearer ${et}` },
        });
        if (denied.status !== 403) {
          failures.push(`employer should be forbidden on resume download, got ${denied.status}`);
        }

        // Company logo
        const formLogo = new FormData();
        formLogo.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'logo.png');
        const logo = await api('/api/v1/employer/company/logo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${et}` },
          body: formLogo as any,
        });
        if (!logo.body?.success) {
          failures.push(`logo upload failed: ${JSON.stringify(logo.body)}`);
        }
      }
    }

    // Profile still works
    const profile = await api('/api/v1/candidate/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profile.body?.success) failures.push('profile regression failed');
  }

  if (failures.length) {
    console.error('B23 VERIFY FAILED');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }
  console.log('B23 VERIFY OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
