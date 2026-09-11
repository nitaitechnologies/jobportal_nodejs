# WorkIndia Database Schema

Domain model architecture for `workindia-node-api` (B3).

MongoDB collections are accessed through Mongoose models under `src/models/`.
Controlled enums live in `src/constants/enums.ts`.

## Relationship overview

```text
User
├── Candidate
│   ├── Application → Job
│   ├── SavedJob → Job
│   ├── Interview → Application / Job
│   └── Notification (via User)
├── Employer
│   ├── Company
│   │   ├── Job
│   │   │   ├── Application
│   │   │   ├── SavedJob
│   │   │   └── Interview
│   │   └── Subscription
│   └── Interview
└── AdminUser

Supporting
├── Category ← Job
├── Location ← Job (location snapshot + optional locationId)
├── CareerArticle
├── Report
├── PlatformSetting
└── AnalyticsEvent
```

High-volume relationships (applications, saved jobs, interviews, notifications,
analytics events) are **separate collections** — not embedded arrays on parent documents.

## Collections

### Core

| Collection | Model | Purpose |
|---|---|---|
| `users` | `User` | Platform identity (auth credentials, role, status) |
| `candidates` | `Candidate` | Candidate profile linked 1:1 to `User` |
| `employers` | `Employer` | Employer profile linked 1:1 to `User`, optional `Company` |
| `companies` | `Company` | Employer organization / careers brand |

### Jobs

| Collection | Model | Purpose |
|---|---|---|
| `jobs` | `Job` | Job listings with search-oriented fields |
| `categories` | `Category` | Hierarchical job categories (`parentId`) |
| `locations` | `Location` | Country → state → city → area tree |

### Application flow

| Collection | Model | Purpose |
|---|---|---|
| `applications` | `Application` | Candidate applications to jobs |
| `saved_jobs` | `SavedJob` | Candidate ↔ job bookmarks |
| `interviews` | `Interview` | Scheduled interviews for applications |

### Communication / content / safety

| Collection | Model | Purpose |
|---|---|---|
| `notifications` | `Notification` | In-app notifications for users |
| `career_articles` | `CareerArticle` | Career advice / blog content |
| `reports` | `Report` | Polymorphic safety reports |

### Monetization / admin / platform

| Collection | Model | Purpose |
|---|---|---|
| `subscriptions` | `Subscription` | Employer monetization plans |
| `admin_users` | `AdminUser` | Admin privileges linked to `User` |
| `platform_settings` | `PlatformSetting` | Key/value platform configuration |
| `analytics_events` | `AnalyticsEvent` | Append-only product analytics |

## Important fields & enums

### User
- `email` (unique, lowercase), `phone` (unique when non-empty), `passwordHash` (never plaintext)
- `role`: `candidate` | `employer` | `admin`
- `status`: `active` | `inactive` | `suspended` | `deleted`
- Soft delete via `deletedAt` + status

### Candidate
- `userId` → User (unique)
- Nested: `education`, `workExperience`, `certifications`, `languages`, `socialLinks`
- `employmentStatus`, `profileVisibility`, `profileCompletion`

### Employer / Company
- Employer: `userId` → User, `companyId` → Company
- Company: unique `slug`, `verificationStatus`, `companySize`, `socialLinks`

### Job
- Refs: `companyId`, `employerId`, `categoryId`
- `workMode`: onsite | hybrid | remote
- `employmentType`: full-time | part-time | contract | internship | temporary
- `status`: draft | pending | published | paused | closed | rejected | expired
- Denormalized `location` snapshot for list/filter performance
- Counters: `views`, `applicationsCount` (avoid embedding applications)

### Application
- Unique pair: `candidateId` + `jobId`
- `status`: applied | viewed | shortlisted | interview | rejected | hired | withdrawn
- Lifecycle dates: `appliedAt`, `viewedAt`, `shortlistedAt`, `rejectedAt`, `hiredAt`

### SavedJob
- Unique compound: `candidateId` + `jobId`

### Interview
- Refs: application, candidate, employer, company, job
- `type`: online | phone | onsite
- `status`: scheduled | confirmed | rescheduled | completed | cancelled | declined | no-show
- `type`: online | phone | onsite

### Notification
- `recipientId` → User
- `type`: APPLICATION_SUBMITTED | APPLICATION_STATUS_CHANGED | INTERVIEW_* | JOB_STATUS_CHANGED | SYSTEM
- `read` / `readAt`, `data` (safe Mixed payload)
- API exposes `isRead` mapped from `read`

### CareerArticle
- Unique `slug`, `status`: draft | published | archived
- `featuredImage`, string `category`, `tags[]`, `views`, SEO title/description
- Text index: `career_article_text_search`

### Report
- Polymorphic: `targetType` (`job|company|employer|candidate|user`) + `targetId`
- `status`: pending | reviewing | resolved | dismissed
- Controlled `reason` enum; unique active report per reporter+target
- `reviewedBy` / `reviewedAt` / `resolution`

### SubscriptionPlan
- Catalog of employer plans: slug, price (INR), billingCycle, durationDays, features, limits, status

### Subscription
- `status`: active | cancelled | expired | past_due | trial
- Snapshots: `plan` (slug), `planId`, `amount`, `features`, `limits`
- Payment gateway fields are placeholders only (no integration in B3/B20)

### AdminUser
- `role`: super_admin | admin | moderator | support
- `permissions[]` for fine-grained grants (enforced later)

### PlatformSetting
- Unique `key`, typed `value`, optional `isPublic`

### AnalyticsEvent
- Controlled `eventType` (job_view, job_search, application_submitted, …)
- Stores `ipHash` (not raw IP)

## Key indexes

| Model | Notable indexes |
|---|---|
| User | unique `email`; unique non-empty `phone`; `{ role, status }` |
| Candidate | unique `userId`; `skills`; `currentLocation` |
| Employer | unique `userId`; `companyId` |
| Company | unique `slug`; `{ verificationStatus, status }` |
| Job | unique `slug`; `{ companyId, status }`; `{ categoryId, status }`; `{ status, featured, createdAt }`; `{ workMode, employmentType, status }`; location + salary/experience; text index on title/skills/description |
| Category | unique `slug`; `{ parentId, sortOrder }` |
| Location | unique `slug`; unique `{ parentId, name }`; `{ parentId, type, status }` |
| Application | unique `{ candidateId, jobId }`; status + appliedAt by job/employer/candidate |
| SavedJob | unique `{ candidateId, jobId }` |
| Interview | candidate/employer + `scheduledAt`; `{ status, scheduledAt }` |
| Notification | `{ recipientId, read, createdAt }` |
| CareerArticle | unique `slug`; `{ status, publishedAt }` |
| Report | `{ status, createdAt }`; `{ targetType, targetId }` |
| Subscription | `{ companyId, status }`; `{ userId, status }` |
| AdminUser | unique `userId` |
| PlatformSetting | unique `key` |
| AnalyticsEvent | `{ eventType, createdAt }`; `{ entityType, entityId, createdAt }` |

## Data-flow notes

1. **Identity** — register/login will create `User`, then role-specific `Candidate` or `Employer` (+ optional `Company`).
2. **Hiring** — Employer posts `Job` → Candidate creates `Application` → Employer schedules `Interview` → notifications emitted.
3. **Discovery** — search/filter primarily hits `jobs` indexes; categories/locations support taxonomy navigation.
4. **Safety** — any actor may open a `Report` against a polymorphic target.
5. **Monetization** — `Subscription` attaches to company (and owning user) without embedding payment secrets.

## Soft delete policy

| Use soft delete / status | Prefer hard retention |
|---|---|
| User (`deletedAt` / status) | Applications (audit trail) |
| Job (`deletedAt` / status) | Interviews history |
| Company / Employer status | Analytics events (append-only) |

Do not cascade-delete historical hiring records.

## Out of scope (later steps)

- Seed data
- Auth / JWT / password hashing
- Repositories, services, controllers, CRUD APIs
- Payment gateway, file upload, Redis, queues
