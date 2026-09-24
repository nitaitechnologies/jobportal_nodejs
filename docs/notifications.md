# Notifications (B17 + Platform 472–479)

In-app notification storage, retrieval, and read-state management.

**Channels (472–473):** every `createNotification` / `notifySafely` also fans out to:

1. **Push** — `push.service` + registered `DeviceToken` (`POST /notifications/device-token`). Needs `FCM_SERVER_KEY` for live FCM; otherwise log mode.
2. **Email** — `email.service` (nodemailer). Needs `SMTP_*`; otherwise JSON log transport.

OTP (474) uses the same email path for email OTPs and logs SMS until `SMS_PROVIDER_API_KEY` is set.

See `docs/platform-notifications-qa.md` for QA scripts and launch checklists.

## Model (B3)

| Field | Notes |
|-------|--------|
| `recipientId` | User who owns the notification |
| `type` | Centralized enum (below) |
| `title` / `message` | Server-generated copy |
| `data` | Safe navigation IDs only |
| `read` | DB field (API exposes `isRead`) |
| `readAt` | Set when marked read |
| `createdAt` | Newest-first list sort |

## Types

```text
APPLICATION_SUBMITTED
APPLICATION_CONFIRMATION
APPLICATION_STATUS_CHANGED
RECRUITER_VIEWED_PROFILE
RECRUITER_INVITATION
INTERVIEW_SCHEDULED
INTERVIEW_RESCHEDULED
INTERVIEW_CANCELLED
INTERVIEW_CONFIRMED
INTERVIEW_DECLINED
JOB_STATUS_CHANGED
REPORT_STATUS_CHANGED
JOB_ALERT_INSTANT
JOB_ALERT_DAILY
JOB_ALERT_WEEKLY
JOB_MATCH
JOB_NEARBY
JOB_SALARY_MATCH
HOT_JOB
JOB_DEADLINE
GOVERNMENT_JOB
SYSTEM
```

## Endpoints

JWT required. Roles: `candidate` | `employer`.

Ownership: `req.auth.userId` → `Notification.recipientId`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/notifications` | List (`page`, `limit`, `isRead`, `type`) |
| `GET` | `/api/v1/notifications/unread-count` | Unread count |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all unread as read |
| `GET` | `/api/v1/notifications/:id` | Detail |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark read (idempotent) |
| `PATCH` | `/api/v1/notifications/:id/unread` | Mark unread |
| `DELETE` | `/api/v1/notifications/:id` | Delete |

There is **no** public create endpoint. Only internal services call `createNotification` / `notifySafely`.

## Event triggers

| Event | Recipient | Type |
|-------|-----------|------|
| Candidate applies | Employer | `APPLICATION_SUBMITTED` |
| Candidate applies | Candidate | `APPLICATION_CONFIRMATION` |
| Employer changes application status | Candidate | `APPLICATION_STATUS_CHANGED` |
| Employer opens application (auto-view) or candidate profile | Candidate | `RECRUITER_VIEWED_PROFILE` |
| Employer invites candidate to a job | Candidate | `RECRUITER_INVITATION` |
| Job matches saved search (instant) | Candidate | `JOB_ALERT_INSTANT` |
| Daily / weekly digests | Candidate | `JOB_ALERT_DAILY` / `JOB_ALERT_WEEKLY` |
| Profile match / nearby / salary / hot / gov | Candidate | `JOB_MATCH` / `JOB_NEARBY` / `JOB_SALARY_MATCH` / `HOT_JOB` / `GOVERNMENT_JOB` |
| Saved-job deadline approaching | Candidate | `JOB_DEADLINE` |
| Interview scheduled | Candidate | `INTERVIEW_SCHEDULED` |
| Interview rescheduled | Candidate | `INTERVIEW_RESCHEDULED` |
| Interview cancelled (employer) | Candidate | `INTERVIEW_CANCELLED` |
| Candidate confirms | Employer | `INTERVIEW_CONFIRMED` |
| Candidate declines | Employer | `INTERVIEW_DECLINED` |

Notification failures are logged and do **not** roll back the core business action.

## Security

- IDOR blocked via `recipientId` filter
- Clients cannot set `recipientId`, `type`, `title`, `message`, `read`, or `readAt`
- MongoDB operators rejected in query validation
- Sensitive keys stripped from `data`
