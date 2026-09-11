# Jobs (B11)

Core job CRUD and lifecycle for employers, plus public job listing/detail.

Advanced search/filter belongs to **B12**. Applications, saved jobs, and interviews are later steps.

## Ownership

```text
JWT userId → Employer → Company → Job
```

`employerId` and `companyId` are always set server-side from `req.employer`. Clients cannot inject ownership fields.

## Employer endpoints

Auth: JWT + role `employer` + active employer/company.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/employer/jobs` | Create draft job |
| `GET` | `/api/v1/employer/jobs` | List own jobs (`page`, `limit`, `status`) |
| `GET` | `/api/v1/employer/jobs/:id` | Own job detail |
| `PATCH` | `/api/v1/employer/jobs/:id` | Update editable fields |
| `DELETE` | `/api/v1/employer/jobs/:id` | Soft-delete (`deletedAt`) |
| `PATCH` | `/api/v1/employer/jobs/:id/publish` | Publish (draft/pending → published) |
| `PATCH` | `/api/v1/employer/jobs/:id/pause` | Pause published job |
| `PATCH` | `/api/v1/employer/jobs/:id/resume` | Resume paused job |
| `PATCH` | `/api/v1/employer/jobs/:id/close` | Close published/paused job |

### Create / update fields

Allowed (whitelisted):

- `title`, `description`, `responsibilities`, `requirements`, `skills`
- `categoryId`, `locationId`
- `workMode`, `employmentType`
- `experience` `{ min, max? }`, `salary` `{ min?, max?, period? }`
- `openings`, `education`, `genderPreference`, `benefits`
- `deadline`, `applicationMethod`

Forbidden (rejected if present):

- `employerId`, `companyId`, `status`, `slug`
- `views`, `applicationsCount`, `publishedAt`, `expiresAt`
- `featured`, `urgent`, `deletedAt`, timestamps

### Lifecycle

```text
draft ──publish──► published ──pause──► paused
                      │                   │
                      └──── close ────────┘──► closed
```

- New jobs start as `draft`.
- B11 has no admin moderation gate yet: `publish` moves `draft`/`pending` → `published` and sets `publishedAt` / `expiresAt` from `deadline`.
- Employers cannot set `rejected` or `expired`.
- Soft delete sets `deletedAt` (and closes live jobs) so future applications/saved jobs stay intact.

### Publish requirements

Before publish, the job must have:

- title, description
- active `categoryId`
- active `locationId` (snapshot filled into `location`)
- workMode, employmentType, experience, openings, applicationMethod
- future `deadline`

## Public endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/jobs` | Public (`page`, `limit`, `sort=latest`) |
| `GET` | `/api/v1/jobs/:slug` | Public |

Visibility: `status=published`, not soft-deleted, not past `expiresAt`, company publicly visible (active, not rejected).

Public responses omit private employer/user data and company contact fields. Viewing a public job detail increments `views` simply (`$inc`).

## Validation notes

- Enums match B3: `workMode` (`onsite`\|`hybrid`\|`remote`), `employmentType` (`full-time`, …), etc.
- Category/location must exist and be **active**.
- Company must be **active** and not verification-**rejected** to create/publish.
- Slugs are unique and stable on title updates.
