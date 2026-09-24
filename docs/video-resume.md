# Video resume (094–101)

Candidate short video resume (feature-flagged via `ENABLE_VIDEO_RESUME`).

## Status checklist

| ID | Feature | Implementation |
|----|---------|----------------|
| 094 | Record video from mobile | In-app `MediaRecorder` + mobile camera constraints + native `capture=user` fallback (`VideoMediaPicker`) |
| 095 | Upload video | `POST /candidate/profile/video-resume` |
| 096 | Preview / retake / delete | Preview player + Retake / Replace / Remove |
| 097 | Duration & file-size validation | Client `validateVideoFileAsync` + API `VIDEO_MAX_*` |
| 098 | Video compression | Client-side re-encode before upload when over max bytes (`lib/video-media/compress.ts`) |
| 099 | Privacy / visibility | Private `candidate_video_resume` media (owner + employer application download only) |
| 100 | Employer video viewing | Employer application video-resume download |
| 101 | Available for Work / Hire Me | Candidate `openToWork` (separate profile field; already shipped) |

## Limits

- Default **2 MB** / **40 s** (`VIDEO_MAX_BYTES`, `VIDEO_MAX_SECONDS`)
- Exposed on `/me` as `features.videoResumeEnabled`, `videoMaxBytes`, `videoMaxSeconds`

Compression runs in the browser (no server ffmpeg). Oversized clips are shrunk before upload; users see a **Compressing…** state.
