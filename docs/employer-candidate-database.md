# Employer Candidate Database (sheet 228–242)

Searchable talent database for employers: filters, saved searches, profile/resume access, talent-pool folders, tags, future re-contact, and metered contact unlock.

Auth: JWT + role `employer` + active employer/company.

Base path: `/api/v1/employer/candidates`

## Search (228–234)

`GET /` — query params:

| Param | Notes |
|-------|--------|
| `q` | Name / headline / title / skills text |
| `skill`, `skills` | Exact skill match (`skills` comma-separated or repeated) |
| `location` | Substring on `currentLocation` |
| `lat`, `lng`, `radiusKm` | Distance filter (haversine); response may include `distanceKm` |
| `experienceMin`, `experienceMax` | Years |
| `education` | Regex on degree / field / institution |
| `expectedSalaryMin`, `expectedSalaryMax` | |
| `jobType`, `workMode` | Preferred types/modes |
| `availableBy` | ISO date — available by then |
| `noticePeriodMax` | Days |
| `language` | Language name |
| `isFresher` | `true` → 0 experience |
| `openToWork` | Available-for-work flag |
| `jobId` | Owned job — rank by match score |
| `page`, `limit` | Pagination |

Visibility: `profileVisibility` in `public` \| `employers_only`. Contact fields are redacted until unlock.

## Saved searches (235)

| Method | Path |
|--------|------|
| `GET` | `/saved-searches` |
| `POST` | `/saved-searches` `{ name, filters }` |
| `DELETE` | `/saved-searches/:id` |

## Profile + media (236–237)

| Method | Path |
|--------|------|
| `GET` | `/:id` optional `?jobId=` |
| `GET` | `/:id/resume/download` |
| `GET` | `/:id/video-resume/download` (feature-flagged) |

Cards include `hasResume` / `hasVideoResume`. Downloads stream private media refs.

## Talent pool: save, tags, folders (238–240)

| Method | Path |
|--------|------|
| `GET` | `/folders` |
| `POST` | `/folders` `{ name, description? }` |
| `PATCH` | `/folders/:id` |
| `DELETE` | `/folders/:id` |
| `GET` | `/saved?folderId=&tag=&page=&limit=` |
| `POST` | `/:id/save` `{ folderId?, tags?, notes? }` |
| `PATCH` | `/:id/save` |
| `DELETE` | `/:id/save` |
| `PATCH` | `/:id/tags` `{ tags }` |

Distinct from application pipeline shortlist.

## Future vacancy re-contact (241)

| Method | Path |
|--------|------|
| `GET` | `/recontacts` |
| `POST` | `/recontacts` `{ candidateId, remindAt, note?, jobId? }` |
| `DELETE` | `/recontacts/:id` |

Worker: `npm run worker:recontact-reminders` → notifies candidates (`RECONTACT_REMINDER`) when `remindAt` is due.

## Contact unlock (242)

`POST /:id/unlock-contact`

Requires plan feature `candidateContact` and remaining `contactUnlockLimit` credits for the billing period. Deducts 1 credit on first unlock per company↔candidate; returns `{ phone, email }`. Subsequent calls return the same contact without another debit.

Entitlements expose `limits.contactUnlockLimit` and `usage.contactUnlocksUsed`.
