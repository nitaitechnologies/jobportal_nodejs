# Admin Management (B22)

Production admin APIs for the React Admin panel. No UI is included in this step.

## Architecture

```
authenticate → requireAdmin → requirePermission / requireAdminRole
  → validators (Zod + Mongo operator rejection)
  → controllers → services
  → optional writeAuditSafely + notifySafely
```

Reuses B3 models, B4 auth/permissions, B17 notifications, and domain services from B7–B21.

**Audit logs ≠ Analytics:** `AdminAuditLog` records administrative accountability. `AnalyticsEvent` (B21) tracks product metrics.

## Permissions

New / extended keys (see `ROLE_DEFAULT_PERMISSIONS`):

| Key | Purpose |
|-----|---------|
| `users.*` | Admin-user CRUD |
| `candidates.read/update` | Candidate management |
| `employers.read/update` | Employer management |
| `companies.read/update/verify` | Company moderation |
| `jobs.read/approve/reject/update/delete` | Job moderation |
| `applications.read` | Application oversight |
| `interviews.read` | Interview oversight |
| `audit_logs.read` | Audit log access |

`super_admin` bypasses permission checks. Role changes and admin deletion require `super_admin`.

## Endpoints

### Admin users — `/api/v1/admin/admin-users`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | List/search/filter |
| POST | `/` | Create (no public registration) |
| GET | `/:id` | Detail |
| PATCH | `/:id` | Name/email only |
| PATCH | `/:id/status` | active/inactive/suspended |
| PATCH | `/:id/role` | **super_admin only** |
| DELETE | `/:id` | **super_admin only** |

Protections: last active super_admin, self-demotion/delete, privilege escalation, no `passwordHash` in responses.

### Candidates — `/api/v1/admin/candidates`

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/:id` |
| PATCH | `/:id/status` |
| PATCH | `/:id/visibility` |

Account status uses existing `User.status` (`active` / `inactive` / `suspended`). Auth middleware continues to reject non-active users.

### Employers — `/api/v1/admin/employers`

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/:id` |
| PATCH | `/:id/status` |

Updates `Employer.status` and mirrors `User.status`. Suspended employers cannot use employer middleware.

### Companies — `/api/v1/admin/companies`

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/:id` |
| PATCH | `/:id/status` |
| PATCH | `/:id/verification` | body: `{ action: "approve"\|"reject"\|"pending", note? }` |

Verification uses existing `verificationStatus`. Approve/reject notifies the employer via B17 `SYSTEM`.

### Jobs — `/api/v1/admin/jobs`

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/:id` |
| PATCH | `/:id/status` | admin transition matrix in `utils/jobStatus.ts` |
| PATCH | `/:id/feature` | `{ featured: boolean }` admin override |
| PATCH | `/:id/urgent` | `{ urgent: boolean }` admin override |

Featured/urgent admin overrides **do not** change subscription entitlement balances (audited as `adminOverride: true`).

### Applications / Interviews (read-only oversight)

- `GET /api/v1/admin/applications`
- `GET /api/v1/admin/applications/:id`
- `GET /api/v1/admin/interviews`
- `GET /api/v1/admin/interviews/:id`

### Audit logs

- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/audit-logs/:id`

Restricted to `super_admin` / `admin` + `audit_logs.read`. Append-only; no update/delete APIs.

## Query conventions

Shared list params: `page`, `limit` (max 100), `search`, `sortBy` (whitelist), `sortOrder`, `from`, `to`, plus domain filters.

Mongo `$` operators in query/body are rejected.

## Bulk actions

**Deferred.** No bulk endpoints in B22 — list/detail/single-entity mutations cover the admin panel needs safely.

## Notifications

| Event | Type |
|-------|------|
| Candidate/employer suspend/deactivate | `SYSTEM` |
| Company verify/reject | `SYSTEM` |
| Job status moderation | `JOB_STATUS_CHANGED` |

## Security rules

- All routes under `/api/v1/admin/*` require admin JWT
- No mass assignment of ownership / passwordHash / arbitrary fields
- Explicit validation whitelists only
- Responses never include password hashes or tokens
- Application/interview detail redacts resume/meeting link content where appropriate

## Standalone MongoDB note

Admin-user create uses ordered writes with rollback (`User` then `AdminUser`). Full multi-document transactions require a replica set and are not mandated for local standalone Mongo.
