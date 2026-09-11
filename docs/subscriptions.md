# Subscriptions & Plans (B20)

Employer subscription plans, subscription lifecycle, and entitlement foundation.

**Payment gateways are intentionally out of scope.** B20 prepares domain/entitlement APIs for a future payment step.

## Architecture

```text
SubscriptionPlan  →  Subscription  →  Employer/User + Company
                              ↓
                     Entitlements service
                              ↓
                     Job create / publish checks
```

`Subscription` (B3) stores a plan **slug snapshot** in `plan`, plus `planId`, price (`amount`), `features`, and `limits` snapshots so later plan edits do not rewrite history.

## Free-tier defaults (no active subscription)

| Limit / feature | Value |
|-----------------|-------|
| `jobPostLimit` | 5 (lifetime non-deleted jobs) |
| `activeJobLimit` | 3 (`published` + `paused`) |
| `featuredJobLimit` | 0 |
| `featuredJobs` | false |
| `candidateContact` | false |

## Entitlement rules

### jobPostLimit

- **With subscription:** count jobs created for the company with `createdAt` in `[startDate, endDate]` (non-deleted).
- **Free tier:** count all non-deleted company jobs.

### activeJobLimit

Count jobs with status `published` or `paused` (not draft/closed/expired/rejected). Enforced on **publish**.

### Featured jobs

`canFeatureJob()` is available for future promotion flows. B11 still forces `featured=false` on create.

## Expiry

A subscription is active only when:

```text
status ∈ { active, trial }
AND (endDate is null OR endDate > now)
```

No cron worker in B20 — expiry is evaluated on read.

## Public plans

| Method | Path |
|--------|------|
| `GET` | `/api/v1/subscription-plans` |
| `GET` | `/api/v1/subscription-plans/:slug` |

Active plans only.

## Admin plans

Permissions: `plans.read` / `plans.create` / `plans.update`

| Method | Path |
|--------|------|
| `POST` | `/api/v1/admin/subscription-plans` |
| `GET` | `/api/v1/admin/subscription-plans` |
| `GET` | `/api/v1/admin/subscription-plans/:id` |
| `PATCH` | `/api/v1/admin/subscription-plans/:id` |
| `PATCH` | `/api/v1/admin/subscription-plans/:id/deactivate` |

Prefer deactivate over hard delete.

## Admin subscription activation

Permission: `subscriptions.manage`

```http
POST /api/v1/admin/subscriptions
{ "companyId": "...", "planId": "...", "autoRenew": false }
```

Server sets `startDate`, `endDate`, `status=active`, price/features/limits snapshots. Cancels prior live company subscriptions.

## Employer

| Method | Path |
|--------|------|
| `GET` | `/api/v1/employer/subscription` |
| `GET` | `/api/v1/employer/subscription/entitlements` |
| `GET` | `/api/v1/employer/subscriptions` |
| `GET` | `/api/v1/employer/subscription/:id` |

Employers cannot self-activate by PATCHing status.

## Future payment boundary

```text
Payment Provider → webhook/verification → activateSubscription() → Entitlements
```

Do not put provider SDKs in this service.
