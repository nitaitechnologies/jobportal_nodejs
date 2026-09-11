# WorkIndia Demo Seed Data

This seed data is for **development / demo / staging environments only**.

**Do not run destructive reset commands against production databases.**

## First-time setup

```bash
npm install
cp .env.example .env   # set MONGODB_URI + JWT_SECRET
# ensure MongoDB is running locally
npm run seed
npm run seed:verify
```

## Daily development

```bash
npm run seed
```

Idempotent upsert — safe to re-run. Does not wipe non-demo data.

## Verification

```bash
npm run seed:verify
```

Read-only integrity audit. Exits non-zero on failure. Never mutates the database.

## Reset (destructive, demo-only)

```bash
npm run seed:reset
npm run seed:reset && npm run seed   # cleanest full refresh
```

`seed:reset` removes **only** identifiable demo/seed documents (`@workindia.demo` users and related rows, known catalog slugs, `seedMode: demo` metadata). It never calls `deleteMany({})` on whole collections.

Confirmation: the npm script sets `SEED_ALLOW_RESET=1`. Running the reset entrypoint without that flag fails.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run seed` | Upsert deterministic demo dataset |
| `npm run seed:verify` | Read-only integrity audit |
| `npm run seed:reset` | Remove identifiable demo documents |

The seeder **never** runs automatically on server start.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEED_MODE` | `demo` | Seed mode label |
| `SEED_DEMO_PASSWORD` | `12345678` | Shared password for all `@workindia.demo` accounts (**dev-only**) |
| `SEED_ALLOW_RESET` | unset | Must be `1` for destructive reset (`npm run seed:reset` sets this) |
| `SEED_CONFIRM_TARGET` | unset | Set to `demo` only if MongoDB host looks production-like but is intentionally a non-prod demo DB |
| `MONGODB_URI` | from `.env` | Existing backend MongoDB connection |

Never commit real production credentials or secrets.

## Environment safety

Allowed `NODE_ENV` values: `development`, `staging`, `test`.

Refused:

- `NODE_ENV=production` (seed, reset, and verify)
- Any other `NODE_ENV` not in the allowlist
- Destructive reset without `SEED_ALLOW_RESET=1`
- MongoDB hosts that look production-like (`prod` / `production` in hostname) unless `SEED_CONFIRM_TARGET=demo`

Error messages never print database credentials, passwords, JWTs, or full connection strings.

## Deterministic behaviour

- Fixed PRNG seeds for stable variety across runs
- Stable persona + numbered emails under `@workindia.demo`
- Stable slugs for categories, locations, companies, jobs, plans, articles
- Upserts on unique keys — re-running `npm run seed` does not create uncontrolled duplicates
- Dates use deterministic offsets from **system time at seed run**
- Demo media under `storage/uploads/demo/**` written idempotently

## Approximate dataset size

| Domain | Demo count |
| --- | ---: |
| Demo users | 57 |
| Admins | 5 |
| Candidates | 40 |
| Employers / Companies | 12 / 12 |
| Seed categories | 62 |
| Seed locations | 73 |
| Jobs | 140 (~84 published) |
| Saved jobs | 110 |
| Applications | ~227 |
| Interviews | 45 |
| Notifications | 200 |
| Career articles | 20 (~18 published) |
| Reports | 20 |
| Plans / Subscriptions | 4 / 12 |
| Analytics events | 550 |
| Demo media files | ~30 |

## Demo accounts (development-only)

Password: `SEED_DEMO_PASSWORD` (default `12345678`). **Never printed by seeder logs.** Hashed with the same `hashPassword` utility as the API before insert.

| Persona | Email |
| --- | --- |
| Super admin | `superadmin@workindia.demo` |
| Admin | `admin@workindia.demo` |
| Moderator / Support | `moderator@workindia.demo` / `support@workindia.demo` |
| Candidate complete | `candidate.complete@workindia.demo` |
| Candidate incomplete | `candidate.incomplete@workindia.demo` |
| Candidate active | `candidate.active@workindia.demo` |
| Employer active | `employer.active@workindia.demo` |
| Employer new (drafts) | `employer.new@workindia.demo` |
| Employer paid | `employer.paid@workindia.demo` |

Account definitions live in `src/seed/data/personas.ts` (single source of truth).

## Relationship guarantees

- Candidate → user / saved jobs / applications / interviews / notifications / reports / private resume media
- Employer → user / company / jobs / applications / interviews / subscription / analytics
- Interview → matching application + candidate + employer + company + job
- Subscription features/limits match assigned plan snapshot
- No duplicate emails, company/job/category/location slugs, saved pairs, or application pairs within demo data

## Media behaviour

- Resumes: private `media:<id>` refs + PDF files under `demo/candidate_resume/`
- Avatars / logos / article covers: public `/api/v1/media/public/<id>` + PNG under `demo/`
- Placeholder images are minimal valid PNGs (URL-resolvable)
- Private resumes are never exposed on the public media route

## Empty-state strategy

Preserved intentionally: incomplete candidate (0 saved / 0 apps), quiet employer (0 jobs), some published jobs with 0 applications, draft/archive articles excluded from public lists.

## Pagination / search readiness

- Lists are large enough for multi-page UI (jobs, applications, notifications, career advice, candidates, employers)
- Keyword `q=` works for titles (Developer, React, Laravel, …)
- City filtering uses `?location=CityName` (not free-text `q=` for city names)

## `seed:verify` checks

Counts, unique indexes, ownership, orphan refs, interview/application consistency, subscription↔plan links, report targets, media on-disk presence, resume privacy, persona presence, scale thresholds, empty-state preservation.

## Frontend / Admin readiness

Seeded API responses are suitable for Next.js and React Admin lists, filters, dashboards, charts, and detail pages without frontend hard-coded mocks. Prefer `seed:reset && seed` when a shared local MongoDB still has older non-demo fixtures.

## Schema limitations

- No schema changes for seeding convenience
- Demo images are placeholders (not photographic brand assets)
- Payment/invoice transactions are not seeded (not part of the backend domain)
- Category `jobCount` may remain 0 until API recalculation paths run

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Configuration / Environment error | Ensure `NODE_ENV` is `development`, `staging`, or `test` |
| Reset refused without allow | Use `npm run seed:reset` (sets `SEED_ALLOW_RESET=1`) |
| Production-like Mongo host blocked | Use a local/dev URI, or set `SEED_CONFIRM_TARGET=demo` only for intentional demo DBs |
| Integrity failure | Run `npm run seed:verify` and inspect the failing check |
| City search via `q=` empty | Use `?location=CityName` |
| Media 404 | Re-run `npm run seed` to rewrite `demo/**` files |
