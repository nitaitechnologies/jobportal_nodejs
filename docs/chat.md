# Candidate ↔ Employer Chat (Socket.IO)

Realtime messaging between candidates and employers, scoped to a job application.

## Features (sheet 113–123)

| ID | Feature | Implementation |
|----|---------|----------------|
| 113 | Text chat | REST history + Socket.IO live delivery |
| 114 | File/document sharing | `chat_attachment` media + message type `file` |
| 115 | Resume sharing | Message type `resume_share` from profile resume |
| 116 | Read/unread | `readBy`, conversation unread map, `chat:read` events |
| 117 | Push notifications | In-app `CHAT_*` notifications (+ live socket) |
| 118 | Interview discussion | Conversation `context: interview` + `interview_note` |
| 119 | Block/report | `UserBlock` + existing `/reports` |
| 120 | Contact privacy | Reveal after shortlist/interview |
| 121 | Direct HR call | `tel:` when contact revealed |
| 122 | WhatsApp contact | `wa.me` when contact revealed |
| 123 | Video calling if confirmed | External `meetingLink` when interview `confirmed` |

## Endpoints

Auth: candidate or employer JWT.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/candidate/chat` or `/employer/chat` | Inbox |
| `POST` | `.../chat/open` | `{ applicationId }` open/create thread |
| `GET` | `.../chat/:id` | Thread detail + contact channels |
| `GET` | `.../chat/:id/messages` | Paginated history |
| `POST` | `.../chat/:id/messages` | Send text / file / resume / interview note |
| `POST` | `.../chat/:id/read` | Mark read |
| `GET` | `.../chat/contact?applicationId=` | Privacy-gated contact CTAs |
| `POST` | `.../chat/block` | Block peer |
| `DELETE` | `.../chat/block/:userId` | Unblock |
| `GET` | `.../chat/blocked` | List blocks |

## WebSocket

- URL: same host, path `/socket.io`
- Auth: `auth: { token: <JWT> }`
- Events: `chat:join`, `chat:leave`, `chat:typing`, `chat:message`, `chat:read`, `chat:unread`

## Env

```
ENABLE_CHAT=true
```

`/me` → `features.chatEnabled`
