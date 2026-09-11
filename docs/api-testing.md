# API Testing (B27)

Comprehensive integration, end-to-end, security, regression, and OpenAPI contract tests for the WorkIndia Node API.

## Architecture

| Layer | Location |
|-------|----------|
| Jest config | `jest.config.js` |
| Env bootstrap | `tests/setup/env.js` |
| MongoMemoryServer | `tests/setup/globalSetup.js` / `globalTeardown.js` |
| DB wipe + uploads cleanup | `tests/setup/jest.setup.ts` |
| HTTP helpers | `tests/helpers/http.ts` |
| Auth factories | `tests/helpers/auth.ts` |
| Domain fixtures | `tests/helpers/fixtures.ts` |
| Integration suites | `tests/integration/*.test.ts` |

Tests drive the real Express app (`createApp()`) with **supertest**, so middleware, validators, controllers, services, and MongoDB all run together.

## Test database

- `NODE_ENV=test`
- In-memory MongoDB via `mongodb-memory-server`, database name `workindia_test`
- URI written to `.jest-mongo-uri` (gitignored) by global setup
- Collections are cleared in `beforeEach`
- **Never** connects to the developer `workindia` database or remote Atlas hosts

Optional local override: create `.env.test` (gitignored). Variables already set by Jest are not overridden.

## Environment variables (set by the suite)

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Memory-server URI (`workindia_test`) |
| `JWT_SECRET` | Test-only secret (≥32 chars) |
| `STORAGE_PROVIDER` | `local` |
| `STORAGE_LOCAL_ROOT` | `tests/.tmp-uploads` (cleaned after suite) |
| `AUTH_RATE_LIMIT_MAX` | Raised to avoid cross-test 429 noise |
| `ENABLE_API_DOCS` | `true` |

## Commands

```bash
npm test                 # full suite, serial (`--runInBand`)
npm run test:watch       # watch mode
npm run test:coverage    # coverage under coverage/
npm run typecheck
npm run build
```

Suite runs with `maxWorkers: 1` for deterministic DB isolation.

## What is covered

- Health + 404 error contract
- Candidate / employer / admin authentication
- Job lifecycle, public search, saved jobs, applications, interviews
- Categories & locations hierarchy rules
- Candidate profile + completion
- Notifications (via workflow side effects)
- Career advice publish/public read
- Reports ownership
- Subscriptions / entitlements smoke
- Admin list endpoints smoke
- Platform settings + public/private separation
- File uploads (avatar, resume, company logo) + abuse cases
- Security: auth bypass, mass assignment, Mongo operators, IDOR, disclosure
- Rate-limit handler shape (isolated mini-app; suite uses high auth max)
- OpenAPI JSON structure, unique operationIds, Swagger UI (Jest CJS-safe checks)
- Cross-domain E2E platform flow

## Fixtures / helpers

- `createAndLoginAdmin|Candidate|Employer`
- `createTestCategory`, `createTestLocationTree`, `createPublishedJob`
- `api()`, `authHeader()`, `expectErrorShape()`, `uniqueEmail()`, `uniquePhone()`

## File upload tests

Multipart requests via supertest `.attach()`. Storage writes under `tests/.tmp-uploads` and is removed in `afterAll`. Do not commit upload artifacts.

## OpenAPI contract tests

`GET /api/docs/openapi.json` is checked for OpenAPI 3 shape, `bearerAuth`, required paths, unique `operationId`s, and absence of secrets. Deep `$ref` dereference via `@apidevtools/swagger-parser` is ESM-oriented under Jest; use `npx ts-node scripts/verify-b26-openapi.ts` for full validation outside Jest.

## Coverage

`npm run test:coverage` collects coverage from `src/**/*.ts` (excludes `server.ts` and OpenAPI path modules). Focus is business/security paths, not 100% line chase.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing `.jest-mongo-uri` | Ensure Jest globalSetup ran; re-run `npm test` |
| Port / download hangs on first run | Memory server downloads Mongo binary once |
| Auth 429 during tests | Suite sets high `AUTH_RATE_LIMIT_MAX`; reset env if overridden |
| Upload leftovers | Delete `tests/.tmp-uploads` |
| Flaky uniqueness | Helpers use timestamp + random email/phone |

## CI notes

- No interactive prompts
- No developer-specific paths
- No external AWS/S3/payment/email/SMS/Redis
- Requires Node ≥18 and network once for memory-server binary (or cached)

## Deferred / intentional limits

- Full auth rate-limit against the live app is not exercised end-to-end (would slow/flake the suite); behavior is verified via an isolated limiter mirroring production handler shape
- Deep swagger-parser `$ref` walk runs via B26 verify script, not Jest (ESM interop)
- Load/stress testing is out of scope for B27
