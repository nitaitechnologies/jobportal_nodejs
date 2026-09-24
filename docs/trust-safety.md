# Candidate Trust & Safety (sheet 141–148)

Stable client-facing trust features. Warnings are advisory; blocks and reports have clear errors.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 141 | Verified company/job | `company.verified` + `verificationStatus` on job payloads; filter `GET /jobs?verified=true` |
| 142 | Report job/company | `POST /reports` (`targetType` job/company) |
| 143 | Block employer | `POST /candidate/safety/block-employer` (works without chat) |
| 144 | Suspicious-job warning | `job.safetyHints` on public job list/detail |
| 145 | Fraud/spam reporting | Report reasons `fraud`, `scam`, `spam` |
| 146 | Fake job scanner | Heuristic `safetyHints.suspectedFake` + codes |
| 147 | Candidate document verification | `POST /candidate/safety/verification/documents` |
| 148 | Candidate verified badge | `trust.verifiedBadge` on profile (`verified` status **or** phone verified) |

## Safety endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/v1/candidate/safety/block-employer` | Body: `employerId` \| `companyId` \| `userId`, optional `reason` |
| `POST` | `/api/v1/candidate/safety/unblock-employer` | Same body |
| `GET` | `/api/v1/candidate/safety/blocked-employers` | List |
| `GET` | `/api/v1/candidate/safety/verification` | Badge + documents status |
| `POST` | `/api/v1/candidate/safety/verification/documents` | `{ type, mediaUrl }` |

Blocked candidates cannot apply to that employer (403 with clear message). Chat block still works via chat routes.

## `safetyHints` shape

```ts
{
  level: 'none' | 'low' | 'medium' | 'high',
  codes: string[],
  messages: string[],
  suspectedFake: boolean
}
```

Clients should show a banner when `level !== 'none'` and always keep the generic “never pay to apply” tip.

## Client UX rules

- One badge source: `company.verified` / `trust.verifiedBadge`
- Report `409` → “You already reported this”
- Block `403` on apply → “You blocked this employer”
- Document submit → status `pending`; badge upgrades only when verified or phone verified
