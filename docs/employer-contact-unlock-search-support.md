# Contact unlock, premium search & support

Sheet **366–377** (Employer).

## Contact unlock (366–370)

| Endpoint | Notes |
|----------|--------|
| `POST /employer/candidates/:id/unlock-contact` | Plan unlock (0 credits) or wallet debit (1). Respects `allowEmployerContact`. |
| `GET /employer/candidates/unlocks` | Unlock history for the company. |

Privacy on Candidate: `allowEmployerContact`, `resumeVisibleToEmployers`, `profileVisibility`.

## Premium search (371–372)

- Free / no `advancedCandidateSearch`: keyword, skill, location, experience only; result cap = `freeSearchResultLimit` (default 25).
- Paid: full filters, geo, salary, education, job match, saved searches.

## Support (374, 377)

| Endpoint | Notes |
|----------|--------|
| `POST /support/tickets` | Public raise ticket (optional auth). Categories include `technical-issue`. |
| `GET /support/tickets/my` | Authenticated ticket list. |

Technical issues also create a `Report` with `targetType: platform` when logged in.
