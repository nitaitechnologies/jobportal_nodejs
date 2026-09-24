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
| `POST` | `/api/v1/candidate/jobs/:jobId/apply` | One-tap apply to a public platform job (empty body OK) |
| `GET` | `/api/v1/candidate/profile/resumes` | List selectable resumes for apply |
| `GET` | `/api/v1/candidate/applications` | Application history (`page`, `limit`, `status`, `jobId`) |
| `GET` | `/api/v1/candidate/applications/:id` | Own application detail (includes status timestamps) |
| `PATCH` | `/api/v1/candidate/applications/:id/withdraw` | Withdraw when allowed |
| `GET` | `/api/v1/candidate/invitations` | Recruiter invitations |
| `GET` | `/api/v1/candidate/invitations/:id` | Invitation detail |
| `PATCH` | `/api/v1/candidate/invitations/:id/accept` | Accept + one-tap apply |
| `PATCH` | `/api/v1/candidate/invitations/:id/decline` | Decline invitation |

### Apply body (optional fields)

```json
{
  "coverLetter": "...",
  "answers": [{ "question": "...", "answer": "..." }],
  "resume": "optional media:<id> or http(s) URL"
}
```

Server sets `candidateId`, `jobId`, `employerId`, `companyId`, `status=applied`.
Resume defaults to the candidate profile resume when omitted (reuse profile).
Response includes `application` + `confirmation` and creates an `APPLICATION_CONFIRMATION` notification.

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
| `GET` | `/api/v1/employer/applications` | Applicant list (`page`, `limit`, `status`, `jobId`, `q`) |
| `GET` | `/api/v1/employer/applications/stats` | Stage candidate counts (`jobId` optional) |
| `POST` | `/api/v1/employer/applications/bulk-status` | Bulk move `{ ids, status }` (max 50) |
| `GET` | `/api/v1/employer/applications/:id` | Detail + notes + statusHistory (auto `applied`→`viewed`) |
| `PATCH` | `/api/v1/employer/applications/:id/status` | Move stage `{ "status": "shortlisted" }` etc. |
| `POST` | `/api/v1/employer/applications/:id/notes` | Add internal note `{ text }` |
| `PATCH` | `/api/v1/employer/applications/:id/notes/:noteId` | Update note |
| `DELETE` | `/api/v1/employer/applications/:id/notes/:noteId` | Delete note |
| `POST` | `/api/v1/employer/invitations` | Invite candidate to a job |
| `GET` | `/api/v1/employer/invitations` | List invitations |
| `PATCH` | `/api/v1/employer/invitations/:id/cancel` | Cancel pending invitation |

Opening an application in `applied` status auto-transitions to `viewed`, appends `statusHistory`, and notifies the candidate (`RECRUITER_VIEWED_PROFILE`).
Status moves stamp `viewedAt` / `shortlistedAt` / `interviewAt` / `rejectedAt` / `hiredAt` and append history for the ATS timeline.
Viewing a candidate profile (`GET /employer/candidates/:id`) also emits `RECRUITER_VIEWED_PROFILE` (at most once per employer→candidate per 24h).

Employers cannot set `applied` or `withdrawn`. Only whitelist transitions in `applicationStatus.ts`.

## Notifications

| Event | Recipient | Type |
|-------|-----------|------|
| Candidate applies | Employer | `APPLICATION_SUBMITTED` |
| Candidate applies | Candidate | `APPLICATION_CONFIRMATION` |
| Employer opens application / candidate profile | Candidate | `RECRUITER_VIEWED_PROFILE` |
| Employer invites candidate | Candidate | `RECRUITER_INVITATION` |
| Employer changes application status | Candidate | `APPLICATION_STATUS_CHANGED` |

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
- Private `media:` resume refs are redacted for employers
