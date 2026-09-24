# Employer Company Profile (sheet 165–175)

Employer-owned company page + public careers surface.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 165 | Company name/logo | `name`, `logo` + `POST/DELETE /employer/company/logo` |
| 166 | About company | `description` |
| 167 | Industry | `industry` |
| 168 | Company size | `companySize` enum bands |
| 169 | Office location | `headquarters` + `locations[]` (city or `City, State`) |
| 170 | Website/social links | `website` + `socialLinks` (linkedin/twitter/facebook/instagram) |
| 171 | Photos/videos | `gallery[]` + `POST/DELETE /employer/company/gallery` |
| 172 | Benefits/perks | `benefits: string[]` |
| 173 | Open jobs | public `openJobsCount` + `/companies/:slug/jobs` |
| 174 | Company reviews/ratings | `ratingAvg` / `ratingCount` + reviews APIs |
| 175 | Verified badge | `verificationStatus` + public `verified` |

## Employer endpoints

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| `GET` | `/api/v1/employer/company` | employer | Owned profile |
| `PATCH` | `/api/v1/employer/company` | `company.update` | Update fields incl. benefits/gallery/social |
| `POST` / `DELETE` | `/api/v1/employer/company/logo` | `company.update` | Logo media |
| `POST` / `DELETE` | `/api/v1/employer/company/cover-image` | `company.update` | Cover media |
| `POST` | `/api/v1/employer/company/gallery` | `company.update` | Upload photo (multipart `file`, optional `caption`) |
| `DELETE` | `/api/v1/employer/company/gallery/:index` | `company.update` | Remove gallery item by index |

Gallery `url` accepts public media paths (`/api/v1/media/public/:id`) or absolute http(s) URLs.

PAN/GST + KYC documents (sheet **176–177**): see [employer-verification.md](./employer-verification.md).
