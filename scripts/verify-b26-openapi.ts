/**
 * B26 OpenAPI / Swagger verification.
 * Usage: BASE_URL=http://127.0.0.1:5033 ENABLE_API_DOCS=true npx ts-node scripts/verify-b26-openapi.ts
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildOpenApiDocument } from '../src/docs/openapi';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5033';

async function api(pathName: string) {
  const res = await fetch(`${BASE}${pathName}`);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return { status: res.status, body: await res.json(), text: '' };
  }
  return { status: res.status, body: null, text: await res.text() };
}

function assert(cond: unknown, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

async function main() {
  const failures: string[] = [];

  // Validate document offline
  const doc = buildOpenApiDocument();
  assert(doc.openapi.startsWith('3.'), 'openapi version missing', failures);
  assert(doc.paths && Object.keys(doc.paths).length > 50, 'too few paths documented', failures);

  const opIds = new Set<string>();
  const dupes: string[] = [];
  for (const item of Object.values(doc.paths ?? {})) {
    if (!item) continue;
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method];
      if (!op?.operationId) continue;
      if (opIds.has(op.operationId)) dupes.push(op.operationId);
      opIds.add(op.operationId);
    }
  }
  assert(dupes.length === 0, `duplicate operationIds: ${dupes.join(', ')}`, failures);

  const serialized = JSON.stringify(doc);
  assert(!/JWT_SECRET/i.test(serialized), 'spec leaked JWT_SECRET', failures);
  assert(!/mongodb:\/\//i.test(serialized), 'spec leaked mongodb uri', failures);
  assert(!/passwordHash/i.test(serialized), 'spec leaked passwordHash schema', failures);
  assert(!/change-me-to-a-long-random-secret/i.test(serialized), 'spec leaked example secret', failures);

  try {
    await SwaggerParser.validate(doc as never);
  } catch (error) {
    failures.push(`OpenAPI validate failed: ${error instanceof Error ? error.message : error}`);
  }

  // Required routes present
  const required = [
    '/api/v1/health',
    '/api/v1/candidate/auth/login',
    '/api/v1/employer/auth/login',
    '/api/v1/admin/auth/login',
    '/api/v1/jobs',
    '/api/v1/settings/public',
    '/api/v1/admin/settings',
    '/api/v1/candidate/profile/resume/download',
    '/api/v1/admin/analytics/overview',
  ];
  for (const path of required) {
    assert(Boolean(doc.paths?.[path]), `missing path ${path}`, failures);
  }

  // Live HTTP
  const json = await api('/api/docs/openapi.json');
  const liveDoc = json.body as { openapi?: string; components?: { securitySchemes?: { bearerAuth?: unknown } } } | null;
  assert(json.status === 200 && liveDoc?.openapi, `openapi.json failed: ${json.status}`, failures);
  assert(liveDoc?.components?.securitySchemes?.bearerAuth, 'bearerAuth missing in live JSON', failures);

  const ui = await api('/api/docs/');
  assert(ui.status === 200 && ui.text.includes('swagger'), `Swagger UI failed: ${ui.status}`, failures);

  // v1 health still works
  const health = await api('/api/v1/health');
  assert(health.status === 200 && (health.body as { success?: boolean })?.success, 'health regression', failures);

  if (failures.length) {
    console.error('B26 VERIFY FAILED:\n' + failures.map((f) => `- ${f}`).join('\n'));
    process.exit(1);
  }

  console.log(
    `B26 VERIFY PASSED (${Object.keys(doc.paths ?? {}).length} paths, ${opIds.size} operations)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
