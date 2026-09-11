# Analytics & Event Tracking (B21)

WorkIndia analytics is an **internal, privacy-conscious event stream** plus **admin/employer aggregation APIs**.

Operational counters (`Job.views`, `Job.applicationsCount`, `Category.jobCount`) remain denormalized counters for product UX. `AnalyticsEvent` provides historical / time-series analytics and must not replace those counters.

## Architecture

```
Domain service success
  → trackSafely({ eventType, derived actor, entity refs, safe metadata })
  → AnalyticsEvent insert (isolated — failures are logged, not thrown to clients)

Admin / employer read APIs
  → Zod-validated query params
  → MongoDB aggregations on AnalyticsEvent (+ lifetime counts from domain collections)
```

Central APIs:

- `trackAnalyticsEvent()` — validates controlled types; throws on bad input
- `trackSafely()` — wraps tracking so non-critical analytics failures do not break core flows

There is **no** public client event ingestion endpoint. Clients cannot submit trusted `actorUserId` / `employerId` / `companyId` for ownership.

## AnalyticsEvent model

Extended (backward-compatible) fields:

| Field | Purpose |
|-------|---------|
| `eventType` | Controlled enum |
| `userId` | Actor user when known |
| `actorRole` | `candidate` \| `employer` \| `admin` \| `anonymous` \| `system` |
| `entityType` / `entityId` | Primary subject |
| `jobId`, `companyId`, `employerId`, `candidateId`, `categoryId`, `locationId` | Denormalized refs for aggregation |
| `metadata` | Sanitized scalars only (no passwords/JWTs/bodies) |
| `sessionId`, `ipHash`, `userAgent` | Optional, privacy-limited |
| `occurredAt` | Event time (UTC); used for all date filters |
| `createdAt` | Insert time |

Indexes cover common filters: `eventType + occurredAt`, actor/entity/job/company/employer/candidate/category/location + occurredAt.

## Event types

Controlled in `ANALYTICS_EVENT_TYPES` (`src/constants/enums.ts`).

**Auth:** `candidate_login`, `employer_login`, `admin_login`

**Jobs:** `job_view`, `job_created`, `job_published`, `job_paused`, `job_closed` (+ legacy: `job_search`, `company_view`, `job_featured`)

**Applications:** `application_submitted`, `application_withdrawn`, `application_status_changed`

**Saved jobs:** `job_saved`, `job_unsaved`

**Interviews:** `interview_scheduled`, `interview_rescheduled`, `interview_cancelled`, `interview_confirmed`, `interview_declined`

**Career:** `career_article_view` (+ legacy `profile_view`)

**Reports:** `report_created`, `report_resolved`

**Subscriptions:** `subscription_activated`, `subscription_changed`

### Deferred / unused today

- `job_featured` — no employer “feature job” mutation yet (B20 entitlements only)
- `subscription_expired` — no expiry worker yet (not in enum)
- `job_search` / `company_view` / `profile_view` — legacy enum values; not wired in B21

## Integrated flows

| Flow | Event(s) |
|------|----------|
| Candidate / employer / admin login | `*_login` |
| Public job detail | `job_view` **after** `$inc` views |
| Job create / publish / resume / pause / close | lifecycle events |
| Application submit / withdraw / status change | application events |
| Save / unsave / toggle | saved job events |
| Interview schedule / reschedule / cancel / confirm / decline | interview events |
| Career article public detail | `career_article_view` (views counter preserved) |
| Report create / resolve | report events |
| Admin subscription activate | `subscription_activated` or `subscription_changed` |

## Admin endpoints

All require JWT + admin + `analytics.read` (`super_admin` bypasses permission checks).

| Method | Path |
|--------|------|
| `GET` | `/api/v1/admin/analytics/overview` |
| `GET` | `/api/v1/admin/analytics/events` |
| `GET` | `/api/v1/admin/analytics/jobs` |
| `GET` | `/api/v1/admin/analytics/employers` |
| `GET` | `/api/v1/admin/analytics/candidates` |
| `GET` | `/api/v1/admin/analytics/categories` |
| `GET` | `/api/v1/admin/analytics/locations` |

### Shared query params

- `preset`: `today` \| `last_7_days` \| `last_30_days` (default) \| `last_90_days` \| `custom`
- `from` / `to`: ISO date or datetime (required for `custom`)
- `granularity` (overview): `day` \| `week` \| `month` (default `day`)
- `page` / `limit` (max 100) where paginated
- Events also: `eventType`, `actorRole`, `entityType`, `jobId`, `employerId`, `candidateId`, `companyId`, `categoryId`, `locationId`

Mongo `$` operators in query/body are rejected.

## Employer analytics

`GET /api/v1/employer/analytics`

Scoped strictly to `req.employer.companyId` (derived from JWT → Employer → Company). Client-supplied company/employer IDs are ignored for authorization.

## Date handling

- All ranges computed in **UTC**
- Bounds: **inclusive `from` day start**, **exclusive `to` next-day start** (`occurredAt >= from AND occurredAt < to`)
- Custom range max **366 days**
- Time-series uses MongoDB `$dateTrunc` with `timezone: 'UTC'`

## Privacy & security

- No passwords, JWTs, full request bodies, or arbitrary client payloads in events
- Metadata strips sensitive keys and `$` operators
- Admin event listing omits `ipHash` / `userAgent`
- Candidate analytics return aggregate activity IDs, not emails/phones
- Analytics failures are logged via `trackSafely` and do not fail the parent business operation

## Performance

- Aggregations run in MongoDB (no load-all-into-Node)
- Bounded date ranges and page sizes
- Compound indexes on filter + `occurredAt`
- Lifetime totals use collection `countDocuments` where appropriate

## Out of scope (B21)

External analytics providers, Redis, queues, WebSockets, fraud systems, React Admin / Next.js dashboards, payment analytics, arbitrary client event POST APIs.
