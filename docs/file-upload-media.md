# File Upload & Media Management (B23)

Provider-agnostic media foundation for WorkIndia. Domain fields keep storing string references; binary files live in a storage adapter.

## Architecture

```
Controller
  → MediaUploadService (domain ownership)
  → uploadMedia() / media.service
  → StorageAdapter interface
  → LocalStorageAdapter (STORAGE_PROVIDER=local)
```

Future S3/R2 adapters implement the same `StorageAdapter` without changing controllers.

## MediaFile model

Collection `media_files` stores metadata only (never file bytes):

- ownerUserId, ownerType, entityType, entityId
- category, visibility, mimeType, extension, size
- storageProvider, storageKey, status (`active` | `replaced` | `deleted`)

## Categories & limits

| Category | Types | Max size | Visibility |
|----------|-------|----------|------------|
| `candidate_avatar` | jpeg/png/webp | 2 MB | public |
| `candidate_resume` | pdf | 5 MB | **private** |
| `company_logo` | jpeg/png/webp | 2 MB | public |
| `company_cover` | jpeg/png/webp | 5 MB | public |
| `career_article_image` | jpeg/png/webp | 5 MB | public |

Blocked by default: `.exe`, `.sh`, `.js`, `.html`, `.svg`, `.php`, etc.

Validation uses magic-byte detection (not client MIME alone). Storage keys are server-generated UUIDs under `storage/uploads/<category>/<yyyy>/<mm>/`.

## Domain field mapping

Existing string fields are reused (no duplicate schema fields):

- `User.avatar` / `Candidate.profilePhoto` → public URL `/api/v1/media/public/<id>`
- `Candidate.resume` → private ref `media:<id>`
- `Company.logo` / `coverImage` → public URL
- `CareerArticle.featuredImage` → public URL

Legacy http(s) URL strings remain readable.

## Endpoints

### Candidate

| Method | Path |
|--------|------|
| POST | `/api/v1/candidate/profile/avatar` (multipart `file`) |
| DELETE | `/api/v1/candidate/profile/avatar` |
| POST | `/api/v1/candidate/profile/resume` |
| GET | `/api/v1/candidate/profile/resume` |
| GET | `/api/v1/candidate/profile/resume/download` |
| DELETE | `/api/v1/candidate/profile/resume` |

### Employer

| Method | Path |
|--------|------|
| POST/DELETE | `/api/v1/employer/company/logo` |
| POST/DELETE | `/api/v1/employer/company/cover-image` |

Ownership from JWT → Employer → Company only.

### Admin career advice

| Method | Path | Permission |
|--------|------|------------|
| POST/DELETE | `/api/v1/admin/career-advice/:id/image` | `articles.update` |

### Public stream

| Method | Path |
|--------|------|
| GET | `/api/v1/media/public/:id` |

Serves only `visibility=public` + `status=active` files. Resumes are never public.

## Replacement order

1. Validate file  
2. Store new object  
3. Create MediaFile + update domain field  
4. If DB fails → delete new object  
5. Mark previous MediaFile replaced and best-effort delete storage  

## Configuration

```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=./storage/uploads
UPLOAD_MAX_BYTES=5242880
```

Local uploads are gitignored. JSON body limit is 1mb; multipart limits are enforced by multer + per-category caps.

## Security

- No path traversal / absolute client keys
- No executable/SVG uploads
- No public resume URLs
- IDOR blocked (owner checks on download/delete)
- No storage credentials or absolute paths in API responses
- Multipart field name fixed to `file`

## Deferred

- AWS S3 / Cloudflare R2 adapters (interface ready)
- CDN, image resizing pipeline, antivirus, OCR/AI parsing
- Generic admin `/admin/files` upload endpoint
