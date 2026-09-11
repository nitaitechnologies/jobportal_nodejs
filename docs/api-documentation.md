# API Documentation (B26)

OpenAPI 3.0 / Swagger UI for the WorkIndia REST API.

## URLs

| Resource | URL |
|----------|-----|
| Swagger UI | `http://localhost:<PORT>/api/docs` |
| OpenAPI JSON | `http://localhost:<PORT>/api/docs/openapi.json` |

API routes remain under `/api/v1/*` and are unchanged.

## Enable / disable

| Environment | Default |
|-------------|---------|
| `development` / non-production | Docs **enabled** |
| `production` | Docs **disabled** |

Override with:

```env
ENABLE_API_DOCS=true
```

or `false` to force off.

Optional server entry for the OpenAPI `servers` list:

```env
API_PUBLIC_URL=https://api.example.com
```

Never put secrets in OpenAPI config. Swagger **Authorize** accepts a runtime JWT only.

## Authentication in Swagger

1. Call a login endpoint (`/api/v1/candidate/auth/login`, employer, or admin).
2. Copy `data.accessToken`.
3. Click **Authorize** → enter the token (without the `Bearer ` prefix).
4. Try secured endpoints.

## Postman

1. Import → Link / File → paste `http://localhost:<PORT>/api/docs/openapi.json`
2. Set Bearer token in the collection Authorization tab.

## Source layout

```text
src/docs/
├── openapi.ts          # Document assembly
├── components.ts       # Schemas, parameters, responses, security
├── helpers.ts          # Operation builders
├── registerDocs.ts     # Express mount for /api/docs
└── paths/              # Path modules by domain
```

The OpenAPI document is **generated at runtime** from TypeScript source — no committed giant JSON artifact.

## Keeping docs in sync

When adding an endpoint:

1. Implement route + validator + controller as usual.
2. Add/update the matching path in `src/docs/paths/`.
3. Reuse components (`ApiError`, enums, pagination params).
4. Give a stable `operationId` (e.g. `listEmployerJobs`).
5. Run `npx ts-node scripts/verify-b26-openapi.ts` against a running server.

Document **API DTOs** (serializer output), not raw Mongo models.

## Validation

`scripts/verify-b26-openapi.ts` checks:

- OpenAPI 3 validity (`@apidevtools/swagger-parser`)
- unique `operationId`s
- no leaked secrets in the spec
- live `/api/docs` and `/api/docs/openapi.json`
