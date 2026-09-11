# Job Search & Filtering (B12)

Public job discovery on top of B11 visibility rules.

## Endpoint

```http
GET /api/v1/jobs
```

Public. Empty result sets return `200` with `jobs: []` (not `404`).

Detail remains:

```http
GET /api/v1/jobs/:slug
```

## Query parameters

| Param | Description |
|-------|-------------|
| `q` / `keyword` | Case-insensitive keyword (`q` preferred). Uses MongoDB text index on title, description, skills, requirements, responsibilities. Max 100 chars. |
| `categoryId` | Active category ObjectId |
| `category` | Active category slug |
| `locationId` | Active location ObjectId (includes descendant locations) |
| `location` | Active location slug or exact name (includes descendants) |
| `workMode` | `onsite` \| `hybrid` \| `remote` |
| `employmentType` | `full-time` \| `part-time` \| `contract` \| `internship` \| `temporary` |
| `experienceMin` / `experienceMax` | Overlap filter on job experience range (0–50, min ≤ max) |
| `salaryMin` / `salaryMax` | Overlap filter on job salary range (min ≤ max) |
| `featured` | `true` / `false` |
| `urgent` | `true` / `false` |
| `page` | ≥ 1 (default 1) |
| `limit` | 1–100 (default 20) |
| `sort` | See below (default `latest`) |

Unknown query keys are rejected. Enums and ObjectIds are validated; invalid values return `400`.

Inactive category/location filters return `400` (not silent empty matches).

## Sorting

| Value | Behavior |
|-------|----------|
| `latest` | `publishedAt` DESC, then `createdAt` DESC (default) |
| `relevance` | Text score when `q` present; otherwise same as `latest` |
| `salary_high` | `salaryMax` / `salaryMin` DESC |
| `salary_low` | `salaryMin` / `salaryMax` ASC |
| `experience_low` | `experienceMin` ASC |

Sort values are whitelisted — never passed through raw to MongoDB field names.

## Visibility

Only jobs that are:

- `status: published`
- not soft-deleted
- not past `expiresAt`
- belonging to a publicly visible company (active, verification not rejected)

## Location hierarchy

Filtering by a parent location (e.g. a state) includes jobs tagged with that location **or any active descendant** (city/area), using a bounded BFS (max 4 levels).

## Response shape

```json
{
  "success": true,
  "message": "Jobs fetched successfully",
  "data": {
    "jobs": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 1
    },
    "meta": {
      "sort": "latest",
      "q": null
    }
  }
}
```

Each job summary includes public `company`, `category`, and enriched `location` (`name`, `slug`, `type` plus snapshot fields). Private employer/company contacts are never exposed.

## Examples

```text
GET /api/v1/jobs?q=frontend developer
GET /api/v1/jobs?category=software-development&workMode=remote
GET /api/v1/jobs?locationId=...&experienceMin=2&experienceMax=5
GET /api/v1/jobs?salaryMin=500000&salaryMax=1000000&sort=salary_high
GET /api/v1/jobs?q=react&workMode=remote&employmentType=full-time&page=1&limit=20&sort=relevance
```

## Notes

- `featured` / `urgent` remain server-controlled; employers cannot set them via B11 APIs.
- No Elasticsearch/Redis in B12.
- Advanced recommendations / applications are later steps.
