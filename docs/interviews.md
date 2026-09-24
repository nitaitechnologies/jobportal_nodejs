# Interviews (B16 + Candidate 124–132)

Interview scheduling for employer-managed applications. Candidate upcoming list, accept/decline, reschedule, location/meeting link, status, and 24h/1h reminders.

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
| `reminder24hSentAt` | set by reminder worker (130) |
| `reminder1hSentAt` | set by reminder worker (131) |

## Status lifecycle

```text
scheduled  → confirmed | rescheduled | cancelled | declined | completed | no-show
confirmed  → rescheduled | completed | cancelled | no-show
rescheduled→ confirmed | completed | cancelled | declined | no-show
completed / cancelled / declined / no-show → terminal
```

Active statuses (block a second interview on the same application):

```text
scheduled | confirmed | rescheduled
```

## Candidate features (sheet 124–132)

| ID | Feature | Implementation |
|----|---------|----------------|
| 124 | Upcoming interviews | `GET .../interviews?upcoming=true` + dashboard preview |
| 125 | Company/position/date/time | Mapped on every candidate interview payload |
| 126 | Location | `location` on detail/card (onsite) |
| 127 | Online meeting link | `meetingLink` https + Join CTA |
| 128 | Accept/decline | `PATCH .../confirm` + `PATCH .../decline` |
| 129 | Reschedule | `PATCH .../reschedule` (candidate proposes new time) |
| 130 | 24-hour reminder | `INTERVIEW_REMINDER_24H` via worker |
| 131 | 1-hour reminder | `INTERVIEW_REMINDER_1H` via worker |
| 132 | Interview status | Status enum + UI tabs/badges |

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

## Candidate endpoints

JWT + role `candidate`. Ownership from JWT → Candidate.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/candidate/interviews` | List (`page`, `limit`, `status`, `upcoming`) |
| `GET` | `/api/v1/candidate/interviews/:id` | Detail |
| `PATCH` | `/api/v1/candidate/interviews/:id/confirm` | Accept (`scheduled`/`rescheduled` → `confirmed`) |
| `PATCH` | `/api/v1/candidate/interviews/:id/decline` | Decline (optional reason) |
| `PATCH` | `/api/v1/candidate/interviews/:id/reschedule` | Propose new `scheduledAt` → `rescheduled` |

Candidate responses include job + company summaries. Employer auth secrets are never exposed.

### Candidate reschedule body

```json
{
  "scheduledAt": "2026-10-06T11:00:00.000Z",
  "duration": 45,
  "notes": "Prefer afternoon slot"
}
```

## Reminders (130–131)

```bash
npm run worker:interview-reminders
```

Cron every 15–60 minutes. For each active interview whose `scheduledAt` is ≈ now+24h or ≈ now+1h (±15m), sends in-app notification once (`reminder24hSentAt` / `reminder1hSentAt`). Reschedule clears those flags so reminders fire again for the new time.

## Sorting & pagination

Lists sort by `scheduledAt ASC`, then `createdAt DESC`. Pagination: `{ page, limit, total, totalPages }`.
