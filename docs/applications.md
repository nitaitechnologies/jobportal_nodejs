# Job Applications (B14)

Platform job applications for candidates and employer review.

## Status enum (B3)

```text
applied → viewed → shortlisted → interview → hired
                 ↘ rejected
candidate withdraw: applied | viewed | shortlisted → withdrawn
```

Terminal: `rejected`, `hired`, `withdrawn`.

## Candidate endpoints

JWT + role `candidate`. Ownership from JWT → Candidate.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/candidate/jobs/:jobId/apply` | Apply to a public platform job |
| `GET` | `/api/v1/candidate/applications` | List own applications (`page`, `limit`, `status`, `jobId`) |
| `GET` | `/api/v1/candidate/applications/:id` | Own application detail |
| `PATCH` | `/api/v1/candidate/applications/:id/withdraw` | Withdraw when allowed |

### Apply body (optional fields)

```json
{
  "coverLetter": "...",
  "answers": [{ "question": "...", "answer": "..." }],
  "resume": "optional-url-or-path"
}
```

Server sets `candidateId`, `jobId`, `employerId`, `companyId`, `status=applied`.
Resume defaults to the candidate profile resume when omitted.

### Apply rules

- Job must pass public visibility (`isJobPubliclyVisible`)
- Deadline / `expiresAt` must not be past
- `applicationMethod` must be `platform` (external/email rejected)
- Unique `{ candidateId, jobId }` — duplicate → `409`
- Increments `Job.applicationsCount` only on successful create
- Withdraw decrements count (not below 0)

## Employer endpoints

JWT + role `employer`. Ownership: Employer → Company → Job → Application.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/employer/applications` | List (`page`, `limit`, `status`, `jobId`) |
| `GET` | `/api/v1/employer/applications/:id` | Detail + applicant summary |
| `PATCH` | `/api/v1/employer/applications/:id/status` | `{ "status": "viewed" }` etc. |

Employers cannot set `applied` or `withdrawn`. Only whitelist transitions in `applicationStatus.ts`.

## Atomicity note

Local standalone MongoDB typically lacks replica-set transactions. Creation uses:

1. unique index insert
2. then `$inc` applicationsCount

Duplicate-key errors never increment the counter.

## Security

- Candidates only see/withdraw their own applications
- Employers only see applications for their jobs
- No client ownership field injection
- Employer responses omit password hashes and auth secrets
