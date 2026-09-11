# Career Advice (B18)

Public career articles and admin editorial APIs. Reuses the B3 `CareerArticle` model.

## Schema notes (actual)

| Field | Notes |
|-------|--------|
| `featuredImage` | URL metadata (uploads = B23) |
| `category` | Free-text label (not Category ObjectId) |
| `authorId` | Set from admin JWT user on create |
| `tags` | String array, case-insensitive unique |
| `status` | `draft` \| `published` \| `archived` |
| `views` | Server-incremented on public detail |
| `seoTitle` / `seoDescription` | Optional SEO metadata |

No `seoKeywords` field in the schema.

## Status lifecycle

```text
draft → published → draft (unpublish)
draft|published → archived
archived → draft (restore via unpublish path not used; archive restore = draft transition exists)
```

Public APIs expose **published** only.

## Public endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/career-advice` | List published (`page`, `limit`, `category`, `tag`, `q`, `sort`) |
| `GET` | `/api/v1/career-advice/:slug` | Published detail (+ view increment) |

### Sort whitelist

| Value | Behavior |
|-------|----------|
| `latest` (default) | `publishedAt DESC` |
| `oldest` | `publishedAt ASC` |
| `popular` | `views DESC` |

Search (`q`) uses MongoDB text index on title/excerpt/content/tags.

## Admin endpoints

JWT + admin + permission.

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/api/v1/admin/career-advice` | `articles.create` |
| `GET` | `/api/v1/admin/career-advice` | `articles.read` |
| `GET` | `/api/v1/admin/career-advice/:id` | `articles.read` |
| `PATCH` | `/api/v1/admin/career-advice/:id` | `articles.update` |
| `PATCH` | `/api/v1/admin/career-advice/:id/publish` | `articles.publish` |
| `PATCH` | `/api/v1/admin/career-advice/:id/unpublish` | `articles.publish` |
| `DELETE` | `/api/v1/admin/career-advice/:id` | `articles.delete` (archives) |

`super_admin` bypasses permission checks.

### Create body (whitelist)

```json
{
  "title": "How to Prepare for a Job Interview",
  "excerpt": "...",
  "content": "...",
  "featuredImage": "https://cdn.example.com/cover.jpg",
  "category": "Interview Tips",
  "tags": ["interview", "career"],
  "seoTitle": "...",
  "seoDescription": "..."
}
```

Rejected: `slug`, `authorId`, `status`, `views`, `publishedAt`, timestamps.

Slug is generated server-side and stays stable when the title is updated.

## Content safety

Content is lightly sanitized (script/iframe stripping, event-handler removal, dangerous URL schemes blocked). Markdown-friendly text is preserved.

## Security

- Draft/archived never public
- Mass assignment blocked
- MongoDB operators rejected
- Author resolved server-side
- Image URLs must be `http`/`https`
