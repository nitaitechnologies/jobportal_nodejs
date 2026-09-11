# WorkIndia Node API

REST API backend for the WorkIndia job marketplace platform. Serves the Next.js user-facing app and the React admin panel.

## Tech stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose

## Domain models

B3 establishes the marketplace domain schema under `src/models/` (User, Candidate, Employer, Company, Job, Category, Location, Application, SavedJob, Interview, Notification, CareerArticle, Report, Subscription, AdminUser, PlatformSetting, AnalyticsEvent).

Full collection relationships, enums, and indexes are documented in [docs/database-schema.md](docs/database-schema.md).

Feature APIs that use these models are introduced in later roadmap steps.

**Backend phase (B1–B28) is complete.** See [docs/backend-final-audit.md](docs/backend-final-audit.md).

## Getting started

### 1. Install dependencies

```bash
cd WorkIndia-node-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Requires a local MongoDB instance (default URI `mongodb://127.0.0.1:27017/workindia`). Set a long random `JWT_SECRET`.

Edit `.env` as needed:

| Variable      | Description                          | Default                                      |
|---------------|--------------------------------------|----------------------------------------------|
| `NODE_ENV`    | `development` or `production`        | `development`                                |
| `PORT`        | HTTP server port                     | `5000`                                       |
| `API_PREFIX`  | Base path for all API routes         | `/api/v1`                                    |
| `CLIENT_URL`  | Allowed CORS origin (Next.js app)    | `http://localhost:3000`                      |
| `ADMIN_CLIENT_URL` | Optional admin panel CORS origin | _(empty)_                                    |
| `CORS_ORIGINS` | Optional comma-separated extra origins | _(empty)_                                 |
| `MONGODB_URI` | MongoDB connection string            | `mongodb://127.0.0.1:27017/workindia`        |
| `JWT_SECRET`  | Secret used to sign access tokens    | _(required — set a long random value)_       |
| `JWT_EXPIRES_IN` | Access token lifetime             | `1d`                                         |
| `TRUST_PROXY` | Reverse-proxy hop count for `req.ip` | `0`                                          |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate-limit window     | `900000` (15m)                               |
| `AUTH_RATE_LIMIT_MAX` | Max auth attempts per window     | `20`                                         |
| `ENABLE_API_DOCS` | Swagger UI at `/api/docs`       | on in non-production                         |
| `STORAGE_PROVIDER` | File storage (`local`)           | `local`                                      |
| `STORAGE_LOCAL_ROOT` | Local upload root              | `./storage/uploads`                          |
| `UPLOAD_MAX_BYTES` | Multipart ceiling (bytes)        | `5242880`                                    |

### 3. Demo data / seeder (development only)

Populate a deterministic fictional demo dataset for local UI walkthroughs:

```bash
npm run seed          # upsert demo data (idempotent)
npm run seed:verify   # read-only integrity audit
npm run seed:reset    # remove identifiable @workindia.demo / catalog seed rows only
```

**Safety:** refuses `NODE_ENV=production`, only allows `development` / `staging` / `test`, and requires `SEED_ALLOW_RESET=1` for destructive reset (`npm run seed:reset` sets this). Does not run on server start. Demo passwords come from `SEED_DEMO_PASSWORD` (hashed before insert; never printed in logs).

Account emails and full workflow notes: [docs/seed-data.md](docs/seed-data.md).

### 4. Run development server

```bash
npm run dev
```

- API base: `http://localhost:5000/api/v1`
- Health: `http://localhost:5000/api/v1/health`
- Swagger: `http://localhost:5000/api/docs` (when docs enabled)

> **Note:** On macOS, port `5000` is often used by AirPlay Receiver. If the server fails to bind, set `PORT=5001` (or another free port) in `.env`.

### 5. Build for production

```bash
npm run build
```

### 6. Run production server

```bash
npm start
```

SIGTERM/SIGINT shut down the HTTP server and disconnect MongoDB cleanly.

## Admin authentication

Admin panel auth uses **JWT** access tokens and **bcrypt** password hashes.

### Endpoints

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/admin/auth/login` | Public |
| `GET` | `/api/v1/admin/auth/me` | Bearer token |
| `POST` | `/api/v1/admin/auth/logout` | Bearer token |

Login example:

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

Authenticated requests:

```http
Authorization: Bearer <accessToken>
```

Logout is client-driven for this release: discard the access token locally. The API confirms logout but does not maintain a server-side token blacklist yet.

There is **no public admin registration** endpoint. Create development admins with:

```bash
npx ts-node scripts/create-dev-admin.ts \
  --email=admin@example.com \
  --password='YourStrongPass1!' \
  --name='Super Admin' \
  --role=super_admin
```

This script refuses to run when `NODE_ENV=production`. Never commit real passwords or JWT secrets.

## Candidate authentication

Candidate auth reuses the same JWT + bcrypt foundation as admin auth.

### Endpoints

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/candidate/auth/register` | Public |
| `POST` | `/api/v1/candidate/auth/login` | Public |
| `GET` | `/api/v1/candidate/auth/me` | Bearer token (candidate) |
| `POST` | `/api/v1/candidate/auth/logout` | Bearer token (candidate) |

Register example:

```http
POST /api/v1/candidate/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "StrongPassword123"
}
```

Login example:

```http
POST /api/v1/candidate/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

Authenticated requests use:

```http
Authorization: Bearer <accessToken>
```

### Security notes

- Registration always assigns `role: candidate` (client-supplied roles are ignored).
- Passwords are stored only as bcrypt `passwordHash` and never returned.
- JWT payload contains minimal identity (`userId`, `role`) only.
- Admin/employer accounts cannot authenticate via candidate login.
- Logout is client-driven for this release (discard the token locally).

## Candidate profile

Authenticated candidates manage their own profile (B7 + B15). See `docs/candidate-profile.md`.

### Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/candidate/profile` | Bearer token (candidate) |
| `PATCH` | `/api/v1/candidate/profile` | Bearer token (candidate) |
| `GET` | `/api/v1/candidate/profile/completion` | Bearer token (candidate) |
| `POST` / `DELETE` | `/api/v1/candidate/profile/skills` | Bearer token (candidate) |
| `POST` / `PATCH` / `DELETE` | `/api/v1/candidate/profile/education` | Bearer token (candidate) |
| `POST` / `PATCH` / `DELETE` | `/api/v1/candidate/profile/experience` | Bearer token (candidate) |
| `POST` / `PATCH` / `DELETE` | `/api/v1/candidate/profile/certifications` | Bearer token (candidate) |
| `GET` / `DELETE` | `/api/v1/candidate/profile/resume` | Bearer token (candidate) |

`PATCH` is partial: omitted fields are unchanged. When nested arrays (`skills`, `education`, `workExperience`, `certifications`, `languages`, `preferredLocations`) are sent, they **replace** the existing array. Section routes add/update/remove individual entries without full array replace.

Example update:

```http
PATCH /api/v1/candidate/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "headline": "Senior Laravel Developer",
  "skills": ["Laravel", "PHP", "MySQL"],
  "profileVisibility": "public"
}
```

### Server-controlled fields

These cannot be changed through profile update:

- `email`, `role`, `status`, `password` / `passwordHash`
- `profileCompletion` (recalculated server-side; weighted sections)
- ownership fields (`userId`, `candidateId`)

Resume is URL metadata only until B23 file uploads. URLs must be `http`/`https`.

## Employer authentication

Employer auth reuses the same JWT + bcrypt foundation. Registration creates **User → Employer → Company**.

### Endpoints

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/employer/auth/register` | Public |
| `POST` | `/api/v1/employer/auth/login` | Public |
| `GET` | `/api/v1/employer/auth/me` | Bearer token (employer) |
| `POST` | `/api/v1/employer/auth/logout` | Bearer token (employer) |

Register example:

```http
POST /api/v1/employer/auth/register
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john@company.com",
  "phone": "9876543210",
  "password": "StrongPassword123",
  "companyName": "ABC Technologies"
}
```

Login example:

```http
POST /api/v1/employer/auth/login
Content-Type: application/json

{
  "email": "john@company.com",
  "password": "StrongPassword123"
}
```

Authenticated requests use:

```http
Authorization: Bearer <accessToken>
```

### Security notes

- Registration always assigns `role: employer` (client-supplied roles/`companyId` are ignored).
- A new Company is created from `companyName` with a unique slug and `verificationStatus: pending`.
- Passwords are stored only as bcrypt `passwordHash` and never returned.
- JWT payload contains minimal identity (`userId`, `role`) only.
- Admin/candidate accounts cannot authenticate via employer login.
- Logout is client-driven for this release (discard the token locally).

## Employer profile & company

Authenticated employers manage their own profile and associated company. Ownership is always derived from the JWT (`User → Employer → Company`).

### Employer endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/employer/profile` | Bearer (employer) |
| `PATCH` | `/api/v1/employer/profile` | Bearer (employer) |
| `GET` | `/api/v1/employer/company` | Bearer (employer) |
| `PATCH` | `/api/v1/employer/company` | Bearer (employer) |

Employer PATCH may update: `name`, `phone`, `avatar`, `designation`, `department`.

Company PATCH may update: `name`, `description`, `website`, `industry`, `companySize`, `foundedYear`, `headquarters`, `locations`, `contactEmail`, `contactPhone`, `socialLinks`, `logo`, `coverImage`.

Cannot change via these APIs: `email`, `role`, `status`, `verified`, `verificationStatus`, `slug`, `userId`, `companyId`, `passwordHash`.

Company **name** updates do **not** change the public **slug** (stable URLs).

Employer-owned company responses include a computed `profileCompletion` (0–100).

### Public company

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/companies/:slug` | Public |

Visibility rule: `status === active` and `verificationStatus !== rejected`.

Public responses omit private contact fields (`contactEmail`, `contactPhone`).

## Categories

Public category discovery (active only) and admin category management.

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/categories` | Public |
| `GET` | `/api/v1/categories/:slug` | Public |
| `GET` | `/api/v1/categories/:slug/subcategories` | Public |

Query params for list: `search`, `parentId` (`root`/`null` for roots), `page`, `limit`.

Default list returns root categories with immediate children. Hierarchy is limited to **two levels** (root → subcategory).

### Admin

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/admin/categories` | Admin + `categories.create` |
| `GET` | `/api/v1/admin/categories` | Admin + `categories.read` |
| `GET` | `/api/v1/admin/categories/:id` | Admin + `categories.read` |
| `PATCH` | `/api/v1/admin/categories/:id` | Admin + `categories.update` |
| `DELETE` | `/api/v1/admin/categories/:id` | Admin + `categories.delete` |

`super_admin` bypasses permission checks. Slugs are server-generated from `name` by default; an optional create-time `slug` is normalized and uniquified. Name updates keep **slug** stable. Only **active** categories appear on public endpoints. Unsafe deletes (children or linked jobs) **deactivate** the category instead of hard-deleting. `jobCount` is not client-writable.

## Locations

Country → state → city → area hierarchy for job/candidate/company geography. See `docs/location-schema.md`.

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/locations` | Public |
| `GET` | `/api/v1/locations/:slug` | Public |
| `GET` | `/api/v1/locations/:slug/children` | Public |

Query params: `search`, `type` (`country`\|`state`\|`city`\|`area`), `parentId` (`root`/`null` for countries), `page`, `limit`.

Only **active** locations are returned. Detail includes parent breadcrumb summary and immediate children.

### Admin

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/admin/locations` | Admin + `locations.create` |
| `GET` | `/api/v1/admin/locations` | Admin + `locations.read` |
| `GET` | `/api/v1/admin/locations/:id` | Admin + `locations.read` |
| `PATCH` | `/api/v1/admin/locations/:id` | Admin + `locations.update` |
| `DELETE` | `/api/v1/admin/locations/:id` | Admin + `locations.delete` |

Hierarchy is validated on create/update. Duplicate names under the same parent are rejected. Slugs are globally unique and stable on rename. Type changes are blocked when children exist. Unsafe deletes deactivate instead of hard-deleting.

## Jobs

Employer job CRUD/lifecycle and public job listing. See `docs/jobs.md`. Advanced search is **B12**.

### Employer (JWT + employer role)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/employer/jobs` | Create draft |
| `GET` | `/api/v1/employer/jobs` | List own jobs |
| `GET` | `/api/v1/employer/jobs/:id` | Own job detail |
| `PATCH` | `/api/v1/employer/jobs/:id` | Update whitelist fields |
| `DELETE` | `/api/v1/employer/jobs/:id` | Soft-delete |
| `PATCH` | `/api/v1/employer/jobs/:id/publish` | Publish |
| `PATCH` | `/api/v1/employer/jobs/:id/pause` | Pause |
| `PATCH` | `/api/v1/employer/jobs/:id/resume` | Resume |
| `PATCH` | `/api/v1/employer/jobs/:id/close` | Close |

Ownership (`employerId` / `companyId`) is derived from the JWT. Counters, moderation fields, `featured`/`urgent`, and status (except via lifecycle routes) are not client-writable.

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/jobs` | Public (search/filter — see `docs/job-search.md`) |
| `GET` | `/api/v1/jobs/:slug` | Public |

Only **published**, non-deleted, non-expired jobs from publicly visible companies are returned.

Search supports `q`, category, location (with hierarchy), workMode, employmentType, experience/salary ranges, featured/urgent, pagination, and sort (`latest`, `relevance`, `salary_high`, `salary_low`, `experience_low`).

## Saved Jobs

Candidate bookmarks for public jobs. See `docs/saved-jobs.md`.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/candidate/saved-jobs/:jobId` | Candidate |
| `DELETE` | `/api/v1/candidate/saved-jobs/:jobId` | Candidate |
| `PATCH` | `/api/v1/candidate/saved-jobs/:jobId/toggle` | Candidate |
| `GET` | `/api/v1/candidate/saved-jobs/:jobId` | Candidate (saved status) |
| `GET` | `/api/v1/candidate/saved-jobs` | Candidate (paginated list) |

Ownership is JWT-derived. Duplicate saves are idempotent. Closed/expired jobs remain in the list with `available: false`.

## Applications

Candidate apply/withdraw and employer review. See `docs/applications.md`.

### Candidate

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/candidate/jobs/:jobId/apply` | Candidate |
| `GET` | `/api/v1/candidate/applications` | Candidate |
| `GET` | `/api/v1/candidate/applications/:id` | Candidate |
| `PATCH` | `/api/v1/candidate/applications/:id/withdraw` | Candidate |

### Employer

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/employer/applications` | Employer |
| `GET` | `/api/v1/employer/applications/:id` | Employer |
| `PATCH` | `/api/v1/employer/applications/:id/status` | Employer |

Statuses follow the B3 enum (`applied`, `viewed`, `shortlisted`, `interview`, `hired`, `rejected`, `withdrawn`) with enforced transitions.

## Interviews

Employer scheduling and candidate confirm/decline. See `docs/interviews.md`.

### Employer

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/employer/interviews` | Employer |
| `GET` | `/api/v1/employer/interviews` | Employer |
| `GET` | `/api/v1/employer/interviews/:id` | Employer |
| `PATCH` | `/api/v1/employer/interviews/:id` | Employer |
| `PATCH` | `/api/v1/employer/interviews/:id/reschedule` | Employer |
| `PATCH` | `/api/v1/employer/interviews/:id/cancel` | Employer |
| `PATCH` | `/api/v1/employer/interviews/:id/complete` | Employer |

### Candidate

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/candidate/interviews` | Candidate |
| `GET` | `/api/v1/candidate/interviews/:id` | Candidate |
| `PATCH` | `/api/v1/candidate/interviews/:id/confirm` | Candidate |
| `PATCH` | `/api/v1/candidate/interviews/:id/decline` | Candidate |

Types: `online` | `phone` | `onsite`. Meeting links must be `https`.

## Notifications

In-app notifications for candidates and employers. See `docs/notifications.md`.

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/notifications` | Candidate or Employer |
| `GET` | `/api/v1/notifications/unread-count` | Candidate or Employer |
| `PATCH` | `/api/v1/notifications/read-all` | Candidate or Employer |
| `GET` | `/api/v1/notifications/:id` | Candidate or Employer |
| `PATCH` | `/api/v1/notifications/:id/read` | Candidate or Employer |
| `PATCH` | `/api/v1/notifications/:id/unread` | Candidate or Employer |
| `DELETE` | `/api/v1/notifications/:id` | Candidate or Employer |

No public create endpoint. Domain events (applications, interviews) create notifications internally.

## Career Advice

Public career articles and admin editorial management. See `docs/career-advice.md`.

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/career-advice` | Public |
| `GET` | `/api/v1/career-advice/:slug` | Public |

### Admin

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/admin/career-advice` | Admin (`articles.create`) |
| `GET` | `/api/v1/admin/career-advice` | Admin (`articles.read`) |
| `GET` | `/api/v1/admin/career-advice/:id` | Admin (`articles.read`) |
| `PATCH` | `/api/v1/admin/career-advice/:id` | Admin (`articles.update`) |
| `PATCH` | `/api/v1/admin/career-advice/:id/publish` | Admin (`articles.publish`) |
| `PATCH` | `/api/v1/admin/career-advice/:id/unpublish` | Admin (`articles.publish`) |
| `DELETE` | `/api/v1/admin/career-advice/:id` | Admin (`articles.delete`, archives) |

## Reports & Safety

User safety reports and admin review. See `docs/reports-safety.md`.

### User

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/reports` | Candidate or Employer |
| `GET` | `/api/v1/reports/my` | Candidate or Employer |
| `GET` | `/api/v1/reports/my/:id` | Candidate or Employer |

### Admin

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/admin/reports` | Admin (`reports.read`) |
| `GET` | `/api/v1/admin/reports/:id` | Admin (`reports.read`) |
| `PATCH` | `/api/v1/admin/reports/:id` | Admin (`reports.resolve`) |

Targets: `job`, `company`, `employer`, `candidate`, `user`. No public report listing.

## Subscriptions

Plans and employer entitlements (no payment gateway). See `docs/subscriptions.md`.

### Public

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/subscription-plans` | Public |
| `GET` | `/api/v1/subscription-plans/:slug` | Public |

### Employer

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/employer/subscription` | Employer |
| `GET` | `/api/v1/employer/subscription/entitlements` | Employer |
| `GET` | `/api/v1/employer/subscriptions` | Employer |
| `GET` | `/api/v1/employer/subscription/:id` | Employer |

### Admin

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/admin/subscription-plans` | Admin (`plans.create`) |
| `GET` | `/api/v1/admin/subscription-plans` | Admin (`plans.read`) |
| `PATCH` | `/api/v1/admin/subscription-plans/:id` | Admin (`plans.update`) |
| `PATCH` | `/api/v1/admin/subscription-plans/:id/deactivate` | Admin (`plans.update`) |
| `POST` | `/api/v1/admin/subscriptions` | Admin (`subscriptions.manage`) |

## Analytics

Internal event tracking + admin/employer aggregations. Operational counters (`Job.views`, etc.) are unchanged. See `docs/analytics.md`.

### Admin

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/admin/analytics/overview` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/events` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/jobs` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/employers` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/candidates` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/categories` | Admin (`analytics.read`) |
| `GET` | `/api/v1/admin/analytics/locations` | Admin (`analytics.read`) |

### Employer

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/employer/analytics` | Employer (own company only) |

## Admin Management

Platform moderation APIs for React Admin. See `docs/admin-management.md`.

| Method | Path | Auth |
|--------|------|------|
| `GET/POST` | `/api/v1/admin/admin-users` | Admin (`users.*`) |
| `GET/PATCH/DELETE` | `/api/v1/admin/admin-users/:id` | Admin (+ `super_admin` for role/delete) |
| `GET` | `/api/v1/admin/candidates` | Admin (`candidates.read`) |
| `PATCH` | `/api/v1/admin/candidates/:id/status` | Admin (`candidates.update`) |
| `GET` | `/api/v1/admin/employers` | Admin (`employers.read`) |
| `PATCH` | `/api/v1/admin/employers/:id/status` | Admin (`employers.update`) |
| `GET` | `/api/v1/admin/companies` | Admin (`companies.read`) |
| `PATCH` | `/api/v1/admin/companies/:id/verification` | Admin (`companies.verify`) |
| `GET` | `/api/v1/admin/jobs` | Admin (`jobs.read`) |
| `PATCH` | `/api/v1/admin/jobs/:id/status` | Admin (`jobs.approve`/`reject`/`update`) |
| `GET` | `/api/v1/admin/applications` | Admin (`applications.read`) |
| `GET` | `/api/v1/admin/interviews` | Admin (`interviews.read`) |
| `GET` | `/api/v1/admin/audit-logs` | Admin (`audit_logs.read` + admin/super_admin) |

## File Upload & Media

Provider-agnostic uploads (local storage in development). See `docs/file-upload-media.md`.

| Method | Path | Auth |
|--------|------|------|
| `POST/DELETE` | `/api/v1/candidate/profile/avatar` | Candidate |
| `POST/GET/DELETE` | `/api/v1/candidate/profile/resume` | Candidate |
| `GET` | `/api/v1/candidate/profile/resume/download` | Candidate |
| `POST/DELETE` | `/api/v1/employer/company/logo` | Employer |
| `POST/DELETE` | `/api/v1/employer/company/cover-image` | Employer |
| `POST/DELETE` | `/api/v1/admin/career-advice/:id/image` | Admin (`articles.update`) |
| `GET` | `/api/v1/media/public/:id` | Public (public media only) |

## Platform Settings

Runtime configuration via `PlatformSetting` (no secrets in DB). See `docs/platform-settings.md`.

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/settings/public` | Public (explicit `isPublic` + active only) |
| `GET` | `/api/v1/admin/settings` | Admin (`settings.read`) |
| `GET` | `/api/v1/admin/settings/:key` | Admin (`settings.read`) |
| `POST` | `/api/v1/admin/settings` | Admin (`settings.create`) |
| `PATCH` | `/api/v1/admin/settings/:key` | Admin (`settings.update`) |
| `PATCH` | `/api/v1/admin/settings/:key/status` | Admin (`settings.update`) |

## Security hardening

Production validation/auth hardening after B1–B24. See `docs/security-hardening.md`.

Highlights:

- Auth rate limiting on login/register
- Live account-status checks on shared candidate/employer routes
- ObjectId param validation, Mongo operator rejection, whitelist updates
- Helmet + CORS allowlists, body limits, production error redaction
- Private resume redaction for employers; owned media-only apply overrides

## API documentation (Swagger)

Interactive OpenAPI 3 docs (B26). See `docs/api-documentation.md`.

| Resource | Path |
|----------|------|
| Swagger UI | `/api/docs` |
| OpenAPI JSON | `/api/docs/openapi.json` |

Set `ENABLE_API_DOCS=true` (default in development). Use **Authorize** with a JWT from login.

### Typecheck

```bash
npm run typecheck
```

## Database

The API uses **MongoDB** via **Mongoose**.

- Connection is established at process startup, before the HTTP server listens.
- The URI is read only from `MONGODB_URI` through `src/config/env.ts`.
- Local development example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/workindia
```

- MongoDB Atlas (or any remote cluster) works by changing `MONGODB_URI` only — no application code changes.
- If the database connection fails, the process logs a clear error and **does not** start the HTTP server.
- Connection credentials are never logged.

Ensure a MongoDB instance is running locally before `npm run dev`, or point `MONGODB_URI` at an available cluster.

## Health endpoint

```http
GET /api/v1/health
```

```json
{
  "success": true,
  "message": "API is running",
  "data": {
    "service": "workindia-api",
    "database": "connected"
  }
}
```

## Project architecture

```
src/
├── config/         # Environment & database configuration
├── constants/      # Shared constants
├── controllers/    # HTTP request handlers
├── middlewares/    # Express middlewares (errors, 404)
├── models/         # Mongoose domain models (B3)
├── repositories/   # Data access layer (later steps)
├── routes/         # API route definitions
├── services/       # Business logic
├── types/          # Shared TypeScript types
├── utils/          # Helpers (responses, AppError)
├── validators/     # Request validation (later steps)
├── app.ts          # Express app setup
└── server.ts       # HTTP server entry point
```

Layering:

**Routes → Controllers → Services → Repositories → Models**

All public APIs are versioned under `/api/v1`.

## API response format

Success:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": []
}
```

## Roadmap

See [docs/backend-roadmap.md](docs/backend-roadmap.md) for the planned backend delivery sequence (B1–B28).

See [docs/database-schema.md](docs/database-schema.md) for the MongoDB domain schema.

## Testing (B27)

Integration, E2E, security, and OpenAPI contract tests run with Jest + supertest against an in-memory MongoDB (`workindia_test`). See [docs/api-testing.md](docs/api-testing.md).

```bash
npm test
npm run test:coverage
```

Do not point tests at the development `workindia` database. The suite starts its own memory server and clears collections between tests.

## Final audit (B28)

Production-readiness report: [docs/backend-final-audit.md](docs/backend-final-audit.md).

**Backend Phase Complete.**
