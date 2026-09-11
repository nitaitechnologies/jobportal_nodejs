# Reports & Safety (B19)

In-app safety reporting for candidates and employers, plus admin review workflows.

## Schema (actual B3 + B19)

| Field | Notes |
|-------|--------|
| `reporterId` | From JWT (`req.auth.userId`) |
| `targetType` | `job` \| `company` \| `employer` \| `candidate` \| `user` |
| `targetId` | ObjectId of the target |
| `reason` | Controlled enum (below) |
| `description` | Optional; required (≥10 chars) when `reason=other` |
| `status` | `pending` \| `reviewing` \| `resolved` \| `dismissed` |
| `reviewedBy` / `reviewedAt` | Admin review metadata |
| `resolution` | Admin-facing outcome text |

There is **no** `application` target, `priority`, or `internalNotes` field in the Report model.

## Reasons

```text
fraud, scam, fake_job, misleading_information, harassment, spam,
discrimination, inappropriate_content, duplicate_listing, privacy_concern, other
```

## Status transitions

```text
pending → reviewing | resolved | dismissed
reviewing → resolved | dismissed | pending
resolved / dismissed → terminal
```

## User endpoints

JWT + role `candidate` | `employer`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/reports` | Submit report |
| `GET` | `/api/v1/reports/my` | Own reports (`page`, `limit`, `status`, `targetType`) |
| `GET` | `/api/v1/reports/my/:id` | Own report detail |

No public `GET /reports`. No user PATCH of status/resolution.

### Create rules

- Target must exist and be reportable (e.g. public published jobs)
- Self-reports blocked (own user/company/job/employer/candidate)
- Duplicate active report (`pending`/`reviewing`) for same target → `409`
- After resolve/dismiss, a new report may be filed

## Admin endpoints

JWT + admin + permission.

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/api/v1/admin/reports` | `reports.read` |
| `GET` | `/api/v1/admin/reports/:id` | `reports.read` |
| `PATCH` | `/api/v1/admin/reports/:id` | `reports.resolve` |

Admin filters: `status`, `targetType`, `reason`, `sort=latest|oldest`, pagination.

Admin update whitelist: `status`, `resolution`, `reviewedBy` (must be active admin user).

## Notifications

When status becomes `resolved` or `dismissed`, reporter receives `REPORT_STATUS_CHANGED` via B17 `notifySafely` (failure does not roll back the report update).

## Moderation

B19 does **not** auto-ban jobs/users. Admins review reports and use existing domain APIs (e.g. employer job pause/close) separately.
