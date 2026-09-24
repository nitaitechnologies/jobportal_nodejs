# Employer Dashboard (sheet 182–191)

Overview widgets for hiring activity.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 182–187 | Job / application / interview / hire counts | Dashboard stats + pipeline from list APIs |
| 188 | Unread messages | `GET /employer/chat/unread-count` + `UnreadMessagesCard` |
| 189 | Job performance | `JobPerformance` widget |
| 190 | Recruitment analytics | `GET /employer/analytics?preset=last_30_days` + `RecruitmentAnalyticsCard` |
| 191 | Payment/plan status | Entitlements + subscription → `PlanStatusCard` |

## Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/employer/chat/unread-count` | `{ unreadCount }` |
| `GET` | `/api/v1/employer/analytics` | Period KPIs + series |
| `GET` | `/api/v1/employer/subscription/entitlements` | Plan status, limits, usage |
| `GET` | `/api/v1/employer/subscription` | Current paid subscription (or null) |
