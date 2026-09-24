# Employer Account & Recruiters (sheet 157–164)

Client-safe employer auth, verification, company profile, multi-recruiter teams, roles, sessions.

## Sheet mapping

| ID | Feature | Implementation |
|----|---------|----------------|
| 157 | Company/recruiter registration | `POST /employer/auth/register` (creates company + owner) |
| 158 | Mobile/email verification | `POST /employer/auth/otp/send` + `/otp/verify` |
| 159 | Company profile creation | Register + `PATCH /employer/company` |
| 160 | Multiple recruiters | `POST /employer/team/invite` + `POST /employer/auth/team/accept` |
| 161 | Owner/HR/Recruiter roles | `Employer.teamRole` |
| 162 | Role permissions | `requireEmployerPermission(...)` |
| 163 | Logout/session management | Session-backed JWT `jti` + `POST /logout` |
| 164 | Device/session restriction | `EMPLOYER_MAX_SESSIONS` (default 5); revoke oldest |

## Auth & verification

```http
POST /api/v1/employer/auth/register
POST /api/v1/employer/auth/login
POST /api/v1/employer/auth/logout
GET  /api/v1/employer/auth/me
POST /api/v1/employer/auth/otp/send   { "channel": "phone" | "email" }
POST /api/v1/employer/auth/otp/verify { "channel": "phone" | "email", "otp": "123456" }
GET  /api/v1/employer/auth/sessions
POST /api/v1/employer/auth/sessions/revoke-others
DELETE /api/v1/employer/auth/sessions/:id
```

Dummy OTP uses `CANDIDATE_OTP_DUMMY` (default `123456`) — same as candidates.

## Team

```http
GET    /api/v1/employer/team
POST   /api/v1/employer/team/invite          { email, teamRole: "hr"|"recruiter", name? }
DELETE /api/v1/employer/team/invites/:id
PATCH  /api/v1/employer/team/:id/role        { teamRole: "hr"|"recruiter" }  # owner
DELETE /api/v1/employer/team/:id             # owner, not self/owner
POST   /api/v1/employer/auth/team/accept     { token, name, phone, password }  # public
```

## Roles & permissions

| Role | Permissions |
|------|-------------|
| `owner` | team, billing, company, jobs, applications, candidates, invites |
| `hr` | company, jobs, applications, candidates, invites |
| `recruiter` | jobs, applications, candidates |

Clear **403** when role lacks permission: “Your role does not allow this action…”

## Client UX rules

- Register **409** for duplicate email/phone
- Invite **409** if already on team / pending invite
- OTP invalid → **401**; expired → **400** with “request a new OTP”
- Logout / revoke session → discard client token
- Max sessions → oldest revoked silently (no surprise 403 on login)
- Empty team lists return `200` with `members: []`
