# Security Hardening (B25)

Production security and validation hardening for the WorkIndia Node.js API after B1–B24.

This document describes the security architecture and deployment assumptions. It does not redesign authentication.

## Security architecture

```
Client
  → Helmet + CORS + body limits
  → /api/v1 routes
  → auth rate limit (login/register only)
  → Zod validation (body/params/query)
  → authenticate (JWT Bearer)
  → role / admin permission / ownership middleware
  → controllers → services (whitelist updates)
  → MongoDB
```

Secrets (`JWT_SECRET`, `MONGODB_URI`, storage credentials) stay in environment variables — never in `PlatformSetting` or responses.

## Authentication

- Bearer JWT in the `Authorization` header (`Authorization: Bearer <token>`).
- Tokens are signed/verified with **HS256** only.
- Payload claims: `userId`, `role`, optional `adminUserId` — no passwords or PII.
- `passwordHash` is `select: false` on User; bcrypt cost factor 12.
- Registration / admin-create passwords require ≥8 chars with at least one letter and one number.
- Login validators remain length-only so existing accounts are not locked out by policy changes.

### CSRF assumption

Auth is header-based JWT, not cookie sessions. Classic browser CSRF against cookie auth does not apply to the current design. If cookie-based auth is introduced later, CSRF protection must be reassessed.

## Authorization & ownership

| Layer | Mechanism |
|-------|-----------|
| Role | `requireRole` / `requireCandidate` / `requireEmployer` / `requireAdmin` |
| Account status | Live DB checks on role middleware; shared routes also use `requireActiveAccount` |
| Permissions | Admin `requirePermission` (B4/B22) |
| Ownership | Services scope by JWT-derived `candidateId` / `employerId` / `companyId` / `recipientId` |

Client-supplied owner IDs are never trusted for authorization.

## Rate limiting

In-memory `express-rate-limit` on:

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/candidate/auth/login`
- `POST /api/v1/candidate/auth/register`
- `POST /api/v1/employer/auth/login`
- `POST /api/v1/employer/auth/register`

Defaults: 20 attempts / 15 minutes / IP (`AUTH_RATE_LIMIT_*`).

Health and general APIs are not rate-limited by this middleware.

**Multi-instance:** replace the in-memory store with Redis (or similar) when running multiple API processes.

## Trust proxy

`TRUST_PROXY=0` by default. Set `TRUST_PROXY=1` behind a single trusted reverse proxy so `req.ip` (and rate limits) reflect the client. Do not enable blindly on an internet-facing Node process without a proxy.

## Validation

- Zod schemas with `.strict()` and forbidden-field lists on mutating endpoints.
- Shared helpers in `src/utils/validation.ts` (`objectIdSchema`, `containsMongoOperators`, `httpUrlSchema`, `escapeRegex`).
- Path params validated as 24-char hex ObjectIds before Mongo queries where routes accept `:id`.
- Pagination limits capped (typically max 50–100).
- Sort fields are whitelisted enums.
- Search strings length-capped and sanitized before text/regex use.

## MongoDB injection

Queries are built from validated primitives — never `Model.find(req.query)` or `update(req.body)`.

Operator keys (`$ne`, `$gt`, …) are rejected in middleware that inspects client objects.

## Mass assignment

Sensitive fields (`role`, `passwordHash`, ownership IDs, subscription dates, audit fields, …) are excluded via schema strictness and explicit forbidden lists. Updates apply only whitelisted DTO fields in services.

## File / media security (B23)

- Size ceilings (multer + category limits).
- Extension + magic-byte MIME validation.
- Local storage path traversal guards.
- Private resumes: owner-only download; public stream rejects private media.
- Employer application views redact `media:` resume references to `[resume on file]`.
- Apply flow accepts only owned `media:<id>` or http(s) URLs.

## Error handling

Production responses never include stack traces, filesystem paths, connection strings, or secrets.

Known mappings: `AppError`, Multer errors, CastError → 400, duplicate key → 409, rate limit → 429.

## CORS

Allowlist from `CLIENT_URL`, optional `ADMIN_CLIENT_URL`, optional `CORS_ORIGINS`.

No wildcard `*` in production (startup validation). Credentials enabled for the allowlist. Requests without `Origin` (curl/server) are allowed — auth remains JWT header based.

## Security headers

Helmet with API-appropriate settings: CSP disabled (not an HTML app), `referrerPolicy: no-referrer`, CORP `cross-origin` for media.

## Request limits

- JSON / urlencoded: **1mb**
- Multipart: multer / `UPLOAD_MAX_BYTES` (default 5MB)
- urlencoded `parameterLimit`: 100
- Admin list scans soft-capped at 5000 documents

## Settings / analytics / audit / subscriptions

- Settings: protected namespaces; no secrets in DB (B24).
- Analytics: identity from server context via `trackSafely`.
- Audit logs: admin-written only; sensitive keys scrubbed.
- Subscriptions: plan/status/dates not client-writable; entitlements via B20 services.

## Production environment checklist

| Variable | Notes |
|----------|--------|
| `NODE_ENV=production` | Enables safe errors + JWT secret checks |
| `JWT_SECRET` | ≥32 chars, not the example placeholder |
| `MONGODB_URI` | From env only |
| `CLIENT_URL` / `ADMIN_CLIENT_URL` | Explicit origins |
| `TRUST_PROXY` | `1` behind one reverse proxy |
| `AUTH_RATE_LIMIT_*` | Tune per traffic |

## Dependency security

Run `npm audit` regularly. B25 added `express-rate-limit` only for auth throttling. Do not upgrade unrelated packages without review.

## Intentionally deferred

- OAuth / MFA / password reset
- Redis-backed distributed rate limiting
- Full HTML sanitizer library (DOMPurify) — regex allowlist strengthened instead
- External WAF / SIEM / secrets vault
- Payment gateway
