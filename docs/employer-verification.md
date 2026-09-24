# Employer Company Verification (sheet 176–177) + Admin KYC review (391)

PAN/GST details + private KYC document upload. Admin approve/reject stays on existing company verification (178–179). Admin document inspection is sheet **391**.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 176 | PAN/GST verification | `Company.pan`, `Company.gstin` + `PATCH /employer/company/verification` |
| 177 | Company document upload | `Company.documents[]` + `POST /employer/company/verification/documents` |
| 178 | Admin verification | Existing `PATCH /admin/companies/:id/verification` (stamps doc statuses) |
| 179 | Verification status | `verificationStatus` + `verifiedBadge` |
| 180 | Verified badge | Public `verified` when status is `verified` |
| 391 | PAN/GST/document review | Admin company detail (`pan`/`gstin`/`documents`) + `GET /admin/companies/:id/documents/:type/download` |

## Employer endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/employer/company/verification` | Status, masked PAN/GST, document presence |
| `PATCH` | `/api/v1/employer/company/verification` | Save `pan` and/or `gstin` (sets status `pending`) |
| `POST` | `/api/v1/employer/company/verification/documents` | Multipart `file` + `type` (`pan`\|`gst`\|`incorporation`\|`other`) |

## Admin endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/companies/:id` | Full `pan` / `gstin` / `documents[]` (with `downloadUrl`) |
| `GET` | `/api/v1/admin/companies/:id/documents/:type/download` | Binary download of private KYC file |
| `PATCH` | `/api/v1/admin/companies/:id/verification` | Approve / reject / mark pending |

Document media uses private category `company_verification_doc` (PDF/JPEG/PNG/WebP, max 5MB).
Raw `media:` refs are not returned to the admin UI — use the controlled download endpoint.
