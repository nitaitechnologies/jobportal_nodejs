# Platform notifications + launch QA (sheets 472–492)

## Notifications System

| ID | Feature | Implementation |
|----|---------|----------------|
| 472 | Central push | `push.service.ts` + `DeviceToken` + `POST/DELETE /notifications/device-token`. Set `FCM_SERVER_KEY` for live FCM; otherwise log mode. |
| 473 | Email | `email.service.ts` (nodemailer). Set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`. Without SMTP → JSON log transport. |
| 474 | OTP | `otp.service.ts` — SMS log or email send; `CANDIDATE_OTP_DUMMY` for local. |
| 475 | Application notifications | Existing `application.service` → `notifySafely` (now also email/push fan-out). |
| 476 | Interview reminders | `worker:interview-reminders` + reminder types. |
| 477 | Matching notifications | Job alerts / matching / digests via `notifySafely`. |
| 478 | Boost notifications | `boost-notify` → `HOT_JOB` alerts. |
| 479 | Payment notifications | `PAYMENT_SUCCEEDED` / `PAYMENT_FAILED` / `PAYMENT_REFUND` on confirm/fail/refund. |

`notifySafely` / `createNotification` fan-out: **in-app → push → email**.

### Verify

```bash
npx ts-node scripts/verify-b27-notifications.ts
npx ts-node scripts/verify-b28-ai-payments.ts
npx ts-node scripts/verify-b29-backup-restore.ts
```

## QA & Launch

| ID | Item | How we cover it |
|----|------|-----------------|
| 480–482 | Candidate / Employer / Admin E2E | `tests/integration/e2e.platform.test.ts` |
| 483 | AI matching testing | `tests/integration/ai.matching.test.ts` + `verify-b28-ai-payments.ts` |
| 484 | Payment testing | `tests/integration/payments.wallet.test.ts` + verify-b28 |
| 485 | Notification testing | verify-b27 + domain integration tests |
| 486–488 | Permission / Security / Android | Existing security tests + mobile WebView smoke (Android marked Done) |
| 489 | iOS testing | See checklist below (Safari / iOS WebKit) |
| 490 | Web responsive | See checklist below |
| 491 | Production deployment | `render.yaml` + env checklist below |
| 492 | Backup/restore | `POST /admin/system/backups` + `POST .../backups/:name/restore?dryRun=true` |

### iOS checklist (489)

- [ ] Safari iOS 16+: login, job search, apply, chat, video resume picker
- [ ] PWA / Add to Home Screen (if enabled)
- [ ] Push permission prompt when `FCM` web push is configured
- [ ] Safe-area / notch layout on home + job detail

### Web responsive checklist (490)

- [ ] 375 / 768 / 1280 widths: home, jobs, company, employer dashboard, admin
- [ ] Touch targets ≥ 44px on primary CTAs
- [ ] No horizontal scroll on marketing pages

### Production deploy checklist (491)

- [ ] `NODE_ENV=production`, Atlas `MONGODB_URI`, strong `JWT_SECRET`
- [ ] `CLIENT_URL` / `CORS_ORIGINS` exact origins
- [ ] Workers cron: alerts, interview reminders, digests, renewals, backup
- [ ] Optional: `FCM_SERVER_KEY`, SMTP_*, `OPENAI_API_KEY`
- [ ] Post-deploy: `/api/v1/health`, candidate login, employer payment smoke

### Backup restore (492)

1. `POST /api/v1/admin/system/backups` (needs `mongodump`)
2. `POST /api/v1/admin/system/backups/:name/restore?dryRun=true` — always run dry-run first
3. Live restore only on staging with confirmation
