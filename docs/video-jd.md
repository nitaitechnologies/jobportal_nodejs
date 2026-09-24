# Video JD (210–214)

Employer short video job description (feature-flagged via `ENABLE_VIDEO_JD`).

## Status checklist

| ID | Feature | Implementation |
|----|---------|----------------|
| 210 | Record / upload job video | `VideoMediaPicker` (record + file) → `POST /employer/jobs/:id/video-jd` |
| 211 | Explain job / workplace / requirements | Tip checklist on post-job Description step |
| 212 | Preview / replace / delete | Preview player + Retake / Replace / Remove |
| 213 | Duration & file-size limits | Client validation + API `VIDEO_MAX_*` (default 40s / 2 MB) |
| 214 | Admin moderation | Admin can view Video JD on job detail; `DELETE /admin/jobs/:id/video-jd` removes it without rejecting the listing |

## Employer endpoints

Auth: JWT + role `employer` + `ENABLE_VIDEO_JD`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/employer/jobs/:id/video-jd` | Upload / replace (`multipart`: `file`, `durationSeconds`) |
| `DELETE` | `/api/v1/employer/jobs/:id/video-jd` | Remove Video JD |

## Admin endpoints

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/api/v1/admin/jobs/:id` | `jobs.read` — detail includes `videoJd` even when public flag is off |
| `DELETE` | `/api/v1/admin/jobs/:id/video-jd` | `jobs.reject` or `jobs.update` — body `{ reason? }` |

## Limits

- Default **2 MB** / **40 s** (`VIDEO_MAX_BYTES`, `VIDEO_MAX_SECONDS`)
- Exposed on `/me` as `features.videoJdEnabled`, `videoMaxBytes`, `videoMaxSeconds`
- MIME: `video/mp4`, `video/webm` (`.mov` / `.m4v` accepted when magic is mp4)

Public job payloads omit `videoJd` when `ENABLE_VIDEO_JD` is off. Admin detail always includes it for moderation.
