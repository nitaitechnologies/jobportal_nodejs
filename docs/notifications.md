# Notifications (B17)

In-app notification storage, retrieval, and read-state management.

Email, SMS, push, and WebSockets are **not** included.

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
APPLICATION_STATUS_CHANGED
INTERVIEW_SCHEDULED
INTERVIEW_RESCHEDULED
INTERVIEW_CANCELLED
INTERVIEW_CONFIRMED
INTERVIEW_DECLINED
JOB_STATUS_CHANGED
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
| Employer changes application status | Candidate | `APPLICATION_STATUS_CHANGED` |
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
