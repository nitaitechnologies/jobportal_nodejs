# Candidate Profile (B7 + B15)

Authenticated candidate self-service profile. B15 extends B7 — it does **not** replace `GET/PATCH /api/v1/candidate/profile`.

## Core endpoints (B7)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/candidate/profile` | Own profile + completion |
| `PATCH` | `/api/v1/candidate/profile` | Whitelisted field update |

## B15 endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/candidate/profile/completion` | Section completion breakdown |
| `POST` | `/api/v1/candidate/profile/skills` | Add skill (`{ "skill": "React" }`) |
| `DELETE` | `/api/v1/candidate/profile/skills/:skill` | Remove skill (case-insensitive) |
| `POST` | `/api/v1/candidate/profile/education` | Add education |
| `PATCH` | `/api/v1/candidate/profile/education/:educationId` | Update education |
| `DELETE` | `/api/v1/candidate/profile/education/:educationId` | Remove education |
| `POST` | `/api/v1/candidate/profile/experience` | Add work experience |
| `PATCH` | `/api/v1/candidate/profile/experience/:experienceId` | Update experience |
| `DELETE` | `/api/v1/candidate/profile/experience/:experienceId` | Remove experience |
| `POST` | `/api/v1/candidate/profile/certifications` | Add certification |
| `PATCH` | `/api/v1/candidate/profile/certifications/:certificationId` | Update |
| `DELETE` | `/api/v1/candidate/profile/certifications/:certificationId` | Remove |
| `GET` | `/api/v1/candidate/profile/resume` | Resume metadata (`resume` URL string) |
| `DELETE` | `/api/v1/candidate/profile/resume` | Clear resume metadata |

Auth: JWT + role `candidate`. Ownership always from JWT → Candidate.

## Response shape

```json
{
  "user": { "id", "name", "email", "phone", "role", "avatar" },
  "candidate": { "...profile fields...", "profileCompletion": 75 },
  "profile": { "...same as candidate..." },
  "completion": {
    "percentage": 75,
    "completedSections": ["basic_information", "skills"],
    "missingSections": ["resume"],
    "missingFields": ["resume"]
  }
}
```

Never returns `passwordHash` or auth internals.

## Completion weights (100%)

| Section | Weight | Complete when |
|---------|--------|----------------|
| `basic_information` | 15 | name + phone + (avatar or profilePhoto) |
| `professional_summary` | 10 | headline + bio |
| `skills` | 15 | ≥1 skill |
| `work_experience` | 15 | ≥1 experience **or** fresher path (no experience + education present + student/looking/unemployed/0 years) |
| `education` | 15 | ≥1 education entry |
| `resume` | 15 | non-empty resume URL |
| `job_preferences` | 10 | preferredLocations + employmentStatus |
| `additional_information` | 5 | certifications **or** languages **or** portfolio **or** social link |

Client cannot set `profileCompletion`.

## Rules

- Forbidden on PATCH: email, role, passwordHash, status, profileCompletion, ids, timestamps, verification flags
- Skills: case-insensitive unique, max 50
- URLs: `http`/`https` only (portfolio, social, resume, credentialUrl)
- Education: `startYear ≤ endYear`
- Experience: `startDate ≤ endDate` unless `isCurrent`
- Updating `workExperience` recalculates `totalExperience` (non-overlapping years)
- Resume is metadata string only — binary upload is B23
- `preferredLocations` remain string labels (schema); preferences like work modes are not separate Candidate fields in B3

## Application minimums

`meetsCandidateApplicationMinimums()` (for future gating) requires identity + (headline or skills). B14 does **not** require 100% completion to apply.
