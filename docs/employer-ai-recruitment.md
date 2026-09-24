# Employer AI Recruitment Assistant + AI Interview (sheet 293–303)

ChatGPT-powered hiring helpers for employers. **Every AI response is labelled** with `aiGenerated`, `aiLabel: "AI-generated"`, `aiDisclaimer`, and `uiHint` so clients can show an amber badge.

Requires `OPENAI_API_KEY` and `ENABLE_AI_RECRUITMENT` (default on when a key is set). Flag: `features.aiRecruitmentEnabled` on employer `/me`.

## Endpoints

Auth: employer JWT. Base: `/api/v1/employer/ai`

| Method | Path | Sheet |
|--------|------|-------|
| `POST` | `/jd/improve` | 293 Create/improve JD |
| `POST` | `/skills/suggest` | 294 Suggest skills |
| `POST` | `/candidates/screen` | 295 Screen candidates |
| `POST` | `/profiles/summarize` | 296 Summarize profiles |
| `POST` | `/candidates/suggest` | 297 Suggest candidates |
| `POST` | `/interview/questions` | 298 / 301–302 Generate questions |
| `PUT` | `/interview/questions/save` | 303 Save questions on job |
| `GET` | `/interview/questions/:jobId` | 303 Load saved kit |
| `POST` | `/messages/selection` | 299 Selection message |
| `POST` | `/messages/rejection` | 300 Rejection message |

Pass `regenerate: true` + `previousQuestions` on `/interview/questions` to regenerate (303).

## Client UI

- Always show amber **AI-generated** badge when `aiGenerated` / `uiHint.showAiBadge`
- Show `uiHint.bannerText` and `aiDisclaimer` on result panels
- Let employers edit JD, messages, and questions before publishing / sending
