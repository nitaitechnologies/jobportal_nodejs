# Candidate Job Alerts (072–082)

In-app job alerts built on B12 search filters, B13 saved jobs, and B17 notifications.

Email / SMS / push are **out of scope** — same as B17.

## Feature map

| ID | Feature | Implementation |
|----|---------|----------------|
| 072 | Saved jobs | Existing B13 `/candidate/saved-jobs` |
| 073 | Saved searches | `/candidate/saved-searches` CRUD |
| 074 | Instant alerts | Saved search `frequency=instant` + publish hook |
| 075 | Daily alerts | `frequency=daily` + `npm run worker:alerts` |
| 076 | Weekly alerts | `frequency=weekly` + worker |
| 077 | New matching jobs | Alert settings `matchingJobs` + `JOB_MATCH` |
| 078 | Nearby jobs | `nearbyJobs` + candidate lat/lng + `JOB_NEARBY` |
| 079 | Salary alerts | `salaryAlerts` vs `expectedSalary` + `JOB_SALARY_MATCH` |
| 080 | Hot jobs | `featured`/`urgent` + `HOT_JOB` |
| 081 | Deadline/expiry | Saved-job scan + `JOB_DEADLINE` |
| 082 | Government / exam | Title/category heuristics + `GOVERNMENT_JOB` |

## Endpoints

JWT + role `candidate`.

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/v1/candidate/saved-searches` | List / create |
| `GET/PATCH/DELETE` | `/api/v1/candidate/saved-searches/:id` | Detail / update / delete |
| `GET/PATCH` | `/api/v1/candidate/saved-searches/alert-settings` | Global alert prefs |

### Saved search body

```json
{
  "name": "Remote Node jobs",
  "frequency": "instant",
  "filters": {
    "q": "node",
    "workMode": "remote",
    "salaryMin": 40000,
    "government": false
  }
}
```

`frequency`: `instant` | `daily` | `weekly` | `off`

### Alert settings

```json
{
  "matchingJobs": true,
  "matchScoreMin": 60,
  "nearbyJobs": true,
  "nearbyRadiusKm": 25,
  "salaryAlerts": true,
  "hotJobs": true,
  "deadlineAlerts": true,
  "deadlineDays": 3,
  "governmentJobs": true,
  "digestFrequency": "daily"
}
```

## Triggers

| Event | Types |
|-------|--------|
| Job published | Instant saved-search matches + preference alerts (match/nearby/salary/hot/gov) |
| Admin sets featured/urgent | `HOT_JOB` |
| `npm run worker:alerts` | Daily/weekly digests + deadline reminders |

Deliveries are deduped in `alert_deliveries` (`candidateId` + `jobId` + `type`).

## Worker

```bash
npm run worker:alerts
```

Schedule hourly via cron. Digests fire when ≥23h (daily) or ≥6.5d (weekly) since last notify.
