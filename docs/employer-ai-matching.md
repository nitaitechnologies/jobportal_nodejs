# Employer AI Candidate Matching (sheet 243–248)

Rank and explain candidates against an owned job description.

Deterministic scores always run from the JD + candidate profile (skills, experience, salary, location, availability). Optional ChatGPT blurbs/explanations are labelled **AI-generated**.

## Endpoints

Auth: employer JWT.

| Method | Path | Sheet |
|--------|------|-------|
| `GET` | `/api/v1/employer/jobs/:id/matches` | 243–246, 248 |
| `GET` | `/api/v1/employer/jobs/:id/matches/:candidateId/explain` | 247 |

### Matches query

```
?limit=20&minScore=40&withAiInsights=true
```

Each row includes:

- `rank` (1 = best)
- `match.matchPercentage` / criterion scores
- `matchingSkills` / `missingSkills`
- `reasons` (why it matches)
- optional `aiBlurb` when `withAiInsights=true`

Also available via candidate database:

`GET /api/v1/employer/candidates?jobId=<ownedJobId>` — same scoring + sort by match % (243–248 basics).

## Client UI

- Show amber **AI-generated** badge when `aiGenerated` / `uiHint.showAiBadge`
- Display matching vs missing skills chips and rank when a JD is selected
