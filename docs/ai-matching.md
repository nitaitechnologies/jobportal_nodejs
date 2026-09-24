# AI Job Matching & Career Coach (102–112)

ChatGPT-assisted matching and coaching for candidates. Deterministic scores (skills, experience, salary, location, availability) always run from the profile; AI blurbs/explanations/coach copy are **labelled AI-generated**.

## Feature flags (`/me` → `features`)

| Flag | Env |
|------|-----|
| `aiMatchingEnabled` | `OPENAI_API_KEY` + `ENABLE_AI_MATCHING` (default on when key set) |
| `aiCareerCoachEnabled` | `OPENAI_API_KEY` + `ENABLE_AI_CAREER_COACH` (default on when key set) |

Rate limit: `AI_COACH_RATE_LIMIT_*` (shared for matching + coach).

## Endpoints

| Method | Path | Sheet |
|--------|------|-------|
| `GET` | `/api/v1/candidate/ai/matches` | 102 + 103–106 + 108 |
| `GET` | `/api/v1/candidate/ai/matches/:jobId/explain` | 107 |
| `GET` | `/api/v1/candidate/ai/career-coach` | 109–112 |

Auth: candidate JWT. Disabled / no key → **404**.

### Matches query

```
?limit=20&minScore=40&withAiInsights=true
```

Each match row includes `matchPercentage`, `matchingSkills`, `missingSkills`, experience/salary/location/availability scores, `reasons`, and optional `aiBlurb` (AI-labelled).

### Career coach response fields

- `careerRecommendations` / `jobRecommendations` (110)
- `salaryGuidance` (111)
- `missingSkillSuggestions` (112)
- Always: `aiGenerated`, `aiLabel`, `aiDisclaimer`, `uiHint`

## Client UI

Show amber **AI-generated** badge whenever `aiGenerated` / `uiHint.showAiBadge` is true. Treat salary and skill advice as guidance only.
