# Interviews (B16)

Interview scheduling for employer-managed applications. Reuses the B3 `Interview` model.

Notifications, calendar sync, and video providers are **not** included (see B17+).

## Domain

```text
Candidate → Application → Interview → Job → Employer → Company
```

Server resolves `candidateId`, `employerId`, `companyId`, and `jobId` from the application. Clients must not set ownership fields.

## Schema fields (actual)

| Field | Notes |
|-------|--------|
| `type` | `online` \| `phone` \| `onsite` |
| `scheduledAt` | UTC `Date` |
| `duration` | minutes, 5–480 (default 30) |
| `location` | required when `type=onsite` |
| `meetingLink` | **https only**; required when `type=online` |
| `interviewer` | optional label |
| `notes` | optional |
| `status` | server-controlled |
| `cancellationReason` | set on cancel/decline |

## Status lifecycle

```text
scheduled  → confirmed | rescheduled | cancelled | declined | completed | no-show
confirmed  → rescheduled | completed | cancelled | no-show
rescheduled→ confirmed | completed | cancelled | declined | no-show
completed / cancelled / declined / no-show → terminal
```

`confirmed` and `declined` were added in B16 (backward-compatible enum extension).

Active statuses (block a second interview on the same application):

```text
scheduled | confirmed | rescheduled
```

## Application eligibility (B14-aligned)

Create only when application status is:

```text
shortlisted | interview
```

Creating an interview moves `shortlisted` → `interview`. Terminal application statuses cannot be interviewed.

## Employer endpoints

JWT + role `employer`. Ownership: Employer → Company → Application/Interview.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/employer/interviews` | Schedule interview |
| `GET` | `/api/v1/employer/interviews` | List (`page`, `limit`, `status`, `jobId`, `applicationId`) |
| `GET` | `/api/v1/employer/interviews/:id` | Detail |
| `PATCH` | `/api/v1/employer/interviews/:id` | Update schedule/details (active only) |
| `PATCH` | `/api/v1/employer/interviews/:id/reschedule` | New time → `rescheduled` |
| `PATCH` | `/api/v1/employer/interviews/:id/cancel` | Cancel (optional reason) |
| `PATCH` | `/api/v1/employer/interviews/:id/complete` | Mark completed |

### Create body

```json
{
  "applicationId": "...",
  "scheduledAt": "2026-10-05T11:00:00.000Z",
  "duration": 45,
  "type": "online",
  "meetingLink": "https://meet.example.com/abc",
  "location": "",
  "interviewer": "Hiring Manager",
  "notes": "First round"
}
```

Rejected on create: `candidateId`, `employerId`, `companyId`, `jobId`, `status`, past `scheduledAt`, unsafe URLs, duplicate active interview.

## Candidate endpoints

JWT + role `candidate`. Ownership from JWT → Candidate.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/candidate/interviews` | List (`page`, `limit`, `status`) |
| `GET` | `/api/v1/candidate/interviews/:id` | Detail |
| `PATCH` | `/api/v1/candidate/interviews/:id/confirm` | `scheduled`/`rescheduled` → `confirmed` |
| `PATCH` | `/api/v1/candidate/interviews/:id/decline` | Decline (optional reason) |

Candidate responses include job + company summaries. Employer auth secrets are never exposed.

## Sorting & pagination

Lists sort by `scheduledAt ASC`, then `createdAt DESC`. Pagination matches other modules: `{ page, limit, total, totalPages }`.

## Security

- IDOR blocked via companyId / candidateId filters
- Mass assignment blocked for ownership/status fields
- MongoDB operators rejected in bodies
- `meetingLink` must be `https:`
- Cancel/decline soft-status only (no hard delete)
