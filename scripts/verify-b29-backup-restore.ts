/**
 * Backup restore dry-run verify (sheet 492).
 * Usage: BASE_URL=http://127.0.0.1:5000 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx ts-node scripts/verify-b29-backup-restore.ts
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@workindia.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123!';

async function api(pathName: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${pathName}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: res.status, body };
}

async function main() {
  const failures: string[] = [];

  const login = await api('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!login.body?.success) {
    console.error('FAIL admin login', login.body);
    process.exit(1);
  }
  const token = login.body.data.accessToken as string;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const listed = await api('/api/v1/admin/system/backups', { headers });
  if (!listed.body?.success) {
    failures.push(`list backups failed: ${JSON.stringify(listed.body)}`);
  }

  // Prefer dry-run restore against newest backup if any; otherwise just list OK.
  const backups = (listed.body?.data?.backups ?? []) as Array<{ name: string; kind: string }>;
  const dir = backups.find((b) => b.kind === 'directory');
  if (dir) {
    const dry = await api(
      `/api/v1/admin/system/backups/${encodeURIComponent(dir.name)}/restore?dryRun=true`,
      { method: 'POST', headers },
    );
    if (!dry.body?.success || dry.body.data?.dryRun !== true) {
      failures.push(`restore dry-run failed: ${JSON.stringify(dry.body)}`);
    } else {
      console.log(`restore dry-run OK for ${dir.name}`);
    }
  } else {
    console.log('no directory backup yet — list endpoint OK (create backup in staging to fully exercise restore)');
  }

  if (failures.length) {
    console.error('FAIL', failures);
    process.exit(1);
  }
  console.log('OK verify-b29-backup-restore');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
