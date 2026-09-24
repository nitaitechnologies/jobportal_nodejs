# Candidate Company Profile (sheet 133–140)

Public company careers page for candidates.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 133 | Company name/logo | `name`, `logo`, `coverImage` on public company |
| 134 | About/location/industry | `description`, `headquarters`, `locations[]`, `industry` |
| 135 | Employee count | `companySize` enum bands (`1-10` … `1000+`) |
| 136 | Verified badge | `verificationStatus` + `verified` boolean |
| 137 | Photos/videos | `gallery[]` (`url`, `type`, `caption`, `sortOrder`) |
| 138 | Benefits | `benefits: string[]` on company |
| 139 | Open jobs | `openJobsCount` + `GET /companies/:slug/jobs` (+ `GET /jobs?companyId=`) |
| 140 | Reviews/ratings | `ratingAvg` / `ratingCount` + reviews APIs |

## Endpoints

### Public

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/companies/:slug` | Full public profile |
| `GET` | `/api/v1/companies/:slug/jobs` | Open published jobs |
| `GET` | `/api/v1/companies/:slug/reviews` | Published reviews (paginated) |

### Candidate (auth)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/companies/:slug/reviews` | Create or upsert own review |
| `PATCH` | `/api/v1/companies/reviews/:id` | Update own review |
| `DELETE` | `/api/v1/companies/reviews/:id` | Delete own review |

### Employer (auth)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` / `PATCH` | `/api/v1/employer/company` | Owned profile incl. `benefits`, `gallery`, `socialLinks` |
| `POST` / `DELETE` | `/api/v1/employer/company/gallery` | Upload / remove gallery photos |

See also [employer-company-profile.md](./employer-company-profile.md) (sheet 165–175).

Visibility: `status=active` and `verificationStatus != rejected`.

## Review body

```json
{ "rating": 5, "title": "Great culture", "body": "At least 10 characters…" }
```

One published review per candidate per company. Aggregates update `ratingAvg` / `ratingCount` on the company.
