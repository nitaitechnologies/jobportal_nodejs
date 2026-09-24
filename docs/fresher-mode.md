# Candidate Fresher Mode (sheet 149–156)

Stable discovery for candidates with little or no experience. Empty matches return `200` with `jobs: []` — never `404`.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 149 | Fresher option | Profile `isFresher` (GET) + `PATCH` `{ isFresher: true }` clears work history |
| 150 | Fresher jobs | `GET /jobs?fresherMode=fresher` → `experienceMax=1` |
| 151 | Internships | `GET /jobs?fresherMode=internship` → `employmentType=internship` |
| 152 | No-experience jobs | `GET /jobs?fresherMode=no-experience` → `experienceMax=0` |
| 153 | Training jobs | `GET /jobs?fresherMode=training` → title/description trainee/training/apprentice |
| 154 | Entry-level jobs | `GET /jobs?fresherMode=entry-level` → `experienceMax=1` |
| 155 | Graduate jobs | `GET /jobs?fresherMode=graduate` → education regex (graduate/bachelor/…) |
| 156 | 10th/12th jobs | `GET /jobs?fresherMode=10th` or `12th` |

## Profile: fresher option

```http
PATCH /api/v1/candidate/profile
{ "isFresher": true }
```

- Clears `workExperience`, sets `totalExperience` to `0`, prefers `employmentStatus: looking`
- Profile response includes `profile.isFresher: boolean`
- Explicit `experience`/`education` fields still work for experienced candidates

## Job search: `fresherMode`

```http
GET /api/v1/jobs?fresherMode=fresher
GET /api/v1/jobs?fresherMode=internship&location=delhi
GET /api/v1/jobs?fresherMode=10th&sort=latest
```

Explicit `experienceMin` / `experienceMax` / `employmentType` / `education` override the preset defaults when sent.

Invalid `fresherMode` → `400` (strict enum). Unknown query keys → `400`.

## Client UX rules

- Empty lists are valid — show “No matching fresher jobs” with clear filters CTA
- Mode chips should not spam the user with errors
- Fresher profile toggle must not leave half-cleared experience rows
- Combine city/category filters freely with `fresherMode`
