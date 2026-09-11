# WorkIndia Backend Roadmap

Planned development sequence for `workindia-node-api`. Each step builds on the previous one.

| Step | Title | Status |
|------|-------|--------|
| **B1** | Node.js + Express Foundation | Done |
| **B2** | MongoDB + Mongoose Foundation | Done |
| **B3** | Database Models / Domain Schema | Done |
| **B4** | Admin Authentication | Done |
| **B5** | Candidate Authentication | Done |
| **B6** | Employer Authentication | Done |
| **B7** | User + Candidate APIs | Done |
| **B8** | Employer + Company APIs | Done |
| **B9** | Category APIs | Done |
| **B10** | Location APIs | Done |
| **B11** | Job APIs | Done |
| **B12** | Job Search + Filtering | Done |
| **B13** | Saved Jobs | Done |
| **B14** | Applications | Done |
| **B15** | Candidate Profile | Done |
| **B16** | Interviews | Done |
| **B17** | Notifications | Done |
| **B18** | Career Advice | Done |
| **B19** | Reports + Safety | Done |
| **B20** | Subscriptions | Done |
| **B21** | Analytics | Done |
| **B22** | Admin Management | Done |
| **B23** | File Uploads | Done |
| **B24** | Settings + Configuration | Done |
| **B25** | Validation + Security Hardening | Done |
| **B26** | Swagger / OpenAPI | Done |
| **B27** | Complete API Testing | Done |
| **B28** | Backend Final Audit | Done |

## Notes

- **B1** establishes Express, TypeScript, CORS, Helmet, standardized responses, and the health check.
- **B2** introduces MongoDB connectivity via Mongoose; domain models begin in B3.
- **B3** defines the full marketplace domain schema and indexes (see `docs/database-schema.md`).
- **B4** adds admin authentication (JWT + bcrypt) for the React admin panel.
- **B5** adds candidate registration/login using the shared auth foundation.
- **B6** adds employer registration/login with initial Company creation.
- **B7** adds authenticated candidate profile GET/PATCH with profile-completion scoring.
- **B8** adds employer/company profile APIs and public company-by-slug lookup.
- **B9** adds public category hierarchy APIs and admin category CRUD.
- **B10** adds country → state → city → area location APIs (see `docs/location-schema.md`).
- **B11** adds employer job CRUD/lifecycle and public job list/detail (see `docs/jobs.md`).
- **B12** adds advanced public job search/filter/sort (see `docs/job-search.md`).
- **B13** adds candidate saved jobs (see `docs/saved-jobs.md`).
- **B14** adds job applications for candidates and employers (see `docs/applications.md`).
- **B15** hardens candidate profile completion and section management (see `docs/candidate-profile.md`).
- **B16** adds interview scheduling for employers and candidates (see `docs/interviews.md`).
- **B17** adds in-app notifications (see `docs/notifications.md`).
- **B18** adds career advice / article APIs (see `docs/career-advice.md`).
- **B19** adds reports & safety APIs (see `docs/reports-safety.md`).
- **B20** adds subscription plans/entitlements (see `docs/subscriptions.md`). No payment gateway.
- **B21** adds analytics event tracking + admin/employer analytics aggregations (see `docs/analytics.md`).
- **B22** adds admin management APIs for users, candidates, employers, companies, jobs, oversight, and audit logs (see `docs/admin-management.md`).
- **B23** adds provider-agnostic file upload/media management (see `docs/file-upload-media.md`).
- **B24** adds platform settings & configuration APIs (see `docs/platform-settings.md`).
- **B25** hardens validation, auth rate limits, ownership, CORS/Helmet, and error disclosure (see `docs/security-hardening.md`).
- **B26** adds OpenAPI 3 / Swagger UI at `/api/docs` (see `docs/api-documentation.md`).
- **B27** adds the Jest integration/E2E/security/contract suite (see `docs/api-testing.md`).
- **B28** is the production-readiness audit (see `docs/backend-final-audit.md`). **Backend phase complete.**
- Do not skip foundational steps; later modules depend on models and auth from earlier steps.
