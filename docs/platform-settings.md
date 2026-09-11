# Platform Settings & Configuration (B24)

Centralized runtime configuration for WorkIndia using the existing B3 `PlatformSetting` model.

Secrets (`JWT_SECRET`, `MONGODB_URI`, storage credentials, payment keys, SMTP) stay in environment variables. They are never stored in `PlatformSetting`.

## Architecture

```
Routes → Controllers → SettingsService → PlatformSetting
                         ↓
                   DEFAULT_PLATFORM_SETTINGS (fallback)
```

- Controllers stay thin; typed coercion and resolution live in `src/services/settings.service.ts`.
- Domain modules should call `settingsService` helpers (`getNumber`, `getBoolean`, `getString`, `clampPublicJobPageSize`) instead of querying Mongo directly.
- Lightweight in-process cache (30s TTL) with immediate invalidation on admin mutations. No Redis.

## Model (`PlatformSetting`)

| Field | Purpose |
|-------|---------|
| `key` | Unique setting key (validated; camelCase allowed) |
| `value` | Mixed typed value |
| `type` | `string` \| `number` \| `boolean` \| `json` |
| `group` | Logical group (whitelist) |
| `description` | Admin-facing description |
| `isPublic` | Explicit public visibility |
| `isActive` | Soft activation |
| `isEditable` | Blocks ordinary updates when false |
| `updatedBy` | Last admin user id |
| timestamps | `createdAt` / `updatedAt` |

## Key format

Keys are trimmed and validated as `^[a-zA-Z][a-zA-Z0-9._-]*$` (camelCase allowed, e.g. `jobs.defaultPageSize`). Protected namespace checks are case-insensitive.

## Types

Supported: `string`, `number`, `boolean`, `json`.

Values are coerced explicitly — a boolean setting never treats an arbitrary non-empty string as truthy.

## Groups

`general`, `jobs`, `applications`, `notifications`, `candidate`, `employer`, `subscriptions`, `uploads`, `seo`, `analytics`, `maintenance`

## Visibility tiers

1. **Public** — `isPublic: true` and `isActive: true` only, via `GET /api/v1/settings/public`
2. **Admin** — all non-secret DB settings for authorized admins
3. **Protected / internal** — namespaces blocked from ordinary create/update:

- `auth.*`, `security.*`, `database.*`
- `storage.credentials.*`, `payment.credentials.*`
- `internal.*`, `jwt.*`, `mongodb.*`

## Resolution

```
Active DB row → use typed DB value
Else → application default (if defined)
Else → caller fallback / not found
```

`ensureDefaultSettings()` inserts missing defaults only; never overwrites existing values. Safe to run repeatedly (invoked at server startup).

## Endpoints

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/settings/public` | Public |

Returns a flat `settings` map of explicitly public active keys.

### Admin

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/admin/settings` | `settings.read` |
| `GET` | `/api/v1/admin/settings/:key` | `settings.read` |
| `POST` | `/api/v1/admin/settings` | `settings.create` + admin/super_admin |
| `PATCH` | `/api/v1/admin/settings/:key` | `settings.update` + admin/super_admin |
| `PATCH` | `/api/v1/admin/settings/:key/status` | `settings.update` + admin/super_admin |

List filters: `search`, `group`, `type`, `isPublic`, `isActive`, `isEditable`, pagination, whitelist sort (`key`, `group`, `updatedAt`, `createdAt`).

Type is immutable after create. Soft deactivate via status endpoint (no casual hard delete).

## Permissions

| Role | Access |
|------|--------|
| `super_admin` | Full |
| `admin` | Read + create + update operational settings |
| `support` | Read only |
| `moderator` | No settings permissions by default |

## Maintenance mode

Keys:

- `platform.maintenance.enabled` (default `false`)
- `platform.maintenance.message`

Middleware `maintenanceGate` blocks non-exempt v1 routes with HTTP 503 when enabled.

Always allowed: `/health`, all `/admin/*` (including auth), `/settings/public`.

Fails open if settings cannot be read.

## Integrations

| Area | Behavior |
|------|----------|
| Jobs (B11/B12) | Public list clamps `limit` via `jobs.public.maxPageSize` (validator ceiling 100 remains) |
| Subscriptions (B20) | `subscriptions.plansPublic` can hide public plan listing; plan entitlements unchanged |
| Analytics (B21) | `analytics.enabled` gates `trackSafely` |
| Uploads (B23) | Display-only size hints in public settings; MIME/security rules stay code constants |
| Career | Public `career.public.defaultPageSize` for clients; listing validators unchanged |

## Audit

Mutations write `AdminAuditLog` entries: `setting_created`, `setting_updated`, `setting_activated`, `setting_deactivated`. Values are summarized; secrets must not be stored as settings.

## Examples

Public:

```http
GET /api/v1/settings/public
```

Create:

```http
POST /api/v1/admin/settings
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "key": "jobs.customBanner",
  "value": "Hiring week",
  "type": "string",
  "group": "jobs",
  "description": "Optional public jobs banner",
  "isPublic": true,
  "isActive": true
}
```

Deactivate:

```http
PATCH /api/v1/admin/settings/jobs.customBanner/status
Authorization: Bearer <adminToken>
Content-Type: application/json

{ "isActive": false }
```

## Cache strategy

In-process Map + public snapshot, 30s TTL. Any create/update/status clears the affected key and the public snapshot. Suitable for single-process deployments; multi-instance cache can be added later without API changes.
