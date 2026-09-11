# Saved Jobs (B13)

Candidate bookmarks for public jobs.

## Authentication

All endpoints require:

- JWT
- role `candidate`
- active candidate context (`req.candidate`)

`candidateId` is always derived from the JWT. Clients cannot supply ownership overrides.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/candidate/saved-jobs/:jobId` | Save a public job |
| `DELETE` | `/api/v1/candidate/saved-jobs/:jobId` | Unsave |
| `PATCH` | `/api/v1/candidate/saved-jobs/:jobId/toggle` | Toggle saved state |
| `GET` | `/api/v1/candidate/saved-jobs/:jobId` | Check `saved: true/false` |
| `GET` | `/api/v1/candidate/saved-jobs` | List own saved jobs (`page`, `limit`) |

## Save eligibility

Uses the same public visibility rules as B11/B12 (`isJobPubliclyVisible`):

- job `status` = `published`
- not soft-deleted
- not past `expiresAt`
- company publicly visible

Draft, closed, expired, rejected, paused, and other non-public jobs cannot be saved.

## Duplicate save

Unique index on `{ candidateId, jobId }` prevents duplicates.

Re-saving an already saved job returns `200` with `alreadySaved: true` (no second row).

## Unavailable jobs in the list

Saved rows are **kept** when a job later closes/expires.

List items include:

- `available: true|false`
- public job summary when the Job document still exists
- `job: null` only if the Job document is missing

Saved records are not auto-deleted when a job becomes unavailable.

## Ownership

Every query is scoped to:

```text
{ candidateId: authenticatedCandidateId, jobId }
```

Candidates cannot read or mutate another candidate’s saved jobs.

## Response examples

### Toggle save

```json
{ "success": true, "message": "Job saved successfully", "data": { "saved": true, "jobId": "..." } }
```

### Status

```json
{ "success": true, "message": "Saved job status fetched successfully", "data": { "saved": false, "jobId": "..." } }
```

### List

```json
{
  "success": true,
  "message": "Saved jobs fetched successfully",
  "data": {
    "savedJobs": [
      {
        "savedJobId": "...",
        "savedAt": "...",
        "available": true,
        "job": { "id": "...", "title": "...", "slug": "...", "company": {}, "category": {}, "location": {} }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```
