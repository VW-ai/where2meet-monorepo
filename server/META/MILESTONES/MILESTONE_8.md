# Milestone 8: User Management System (Phase 1)

User accounts layered on top of the existing event/participant token model.

This milestone introduces (Phase 1):
- **User auth** for account features (dashboard/settings) via **HttpOnly cookie sessions**
- **Claiming** existing anonymous event participation into a user account
- **No changes** to existing event/SSE authorization (still `Authorization: Bearer {participantToken}`)

Out of scope (deferred to Milestone 8.1):
- OAuth login (Google/GitHub) + account linking
- Optional auto-link on event creation when logged in

---

## Goals

- Preserve the current “no account required” event flow.
- Add a first-class user account system for dashboards, preferences, and future personalization.
- Keep security boundaries clear:
  - **Event scope** auth = participant token (Bearer header)
  - **Account scope** auth = session cookie

---

## Deliverables

### 8.1 Data Models (Prisma + Migration)
- [ ] `User` table (profile + preferences)
- [ ] `UserIdentity` table (provider: `email|google|github`, unique `(provider, providerId)`)
- [ ] `UserSession` table (opaque session token, **store hash only**, expiry)
- [ ] `PasswordResetToken` table (opaque reset token, **store hash only**, expiry, single-use)
- [ ] `UserEvent` table (link `userId` ↔ `eventId` with `participantId` + `role`)
- [ ] Constraints & indexes:
  - [ ] `User.email` unique (case-insensitive strategy documented)
  - [ ] `UserIdentity(provider, providerId)` unique
  - [ ] `UserSession.tokenHash` unique + index `expiresAt`
  - [ ] `PasswordResetToken.tokenHash` unique + index `expiresAt`
  - [ ] `UserEvent(userId, eventId)` unique

### 8.2 Account Auth (Email/Password) — Cookie Session
- [ ] `POST /api/auth/register` (create user + email identity + session cookie)
- [ ] `POST /api/auth/login` (validate password + set session cookie)
- [ ] `POST /api/auth/logout` (revoke session + clear cookie)
- [ ] `GET /api/auth/session` (validate cookie session + return current user)
- [ ] Password hashing: bcrypt cost factor 12+
- [ ] Session expiry: 7 days (configurable)

### 8.3 Password Recovery
- [ ] `POST /api/auth/recovery/request`
  - [ ] Always returns `{ success: true }` (anti-enumeration)
  - [ ] If email exists: create reset token (1 hour expiry) and send email (mock in dev)
- [ ] `POST /api/auth/recovery/reset`
  - [ ] Validate token (exists + not expired)
  - [ ] Update password hash for the `email` identity
  - [ ] Invalidate **all** user sessions (security)
  - [ ] Delete reset token (single-use)

### 8.4 User Profile Endpoints
- [ ] `GET /api/users/me` (requires session cookie)
- [ ] `PATCH /api/users/me` (requires session cookie)
- [ ] Allowed updates: `name`, `avatarUrl`, `defaultAddress`, `defaultPlaceId`, `defaultFuzzyLocation`
- [ ] Forbidden updates: `email`, `emailVerified`, `createdAt`, IDs

### 8.5 User Dashboard: Event Linking + Listing
- [ ] `POST /api/users/me/events/claim`
  - [ ] Input: `{ eventId, participantToken }`
  - [ ] Verify participantToken belongs to event (reuse existing participant token verification)
  - [ ] Determine role from `Participant.isOrganizer`
  - [ ] Upsert `UserEvent` (idempotent)
- [ ] `GET /api/users/me/events`
  - [ ] Return events the user is linked to (no sensitive tokens in response)

### 8.6 Security & Privacy Requirements
- [ ] Cookie session:
  - [ ] `HttpOnly`, `Path=/`
  - [ ] `Secure` in production
  - [ ] `SameSite=Lax` by default; document cross-site deployment implications
- [ ] CSRF: document expected posture (SameSite + optional CSRF token for unsafe methods if cross-site)
- [ ] Never log secrets (passwords, session tokens, OAuth codes/tokens); follow existing Pino `redact` patterns.
- [ ] Rate limiting (per-endpoint policies for auth flows) aligned with Milestone 7 hardening.

---

## Service + Layer Placement (Repo Conventions)

- `src/routes/auth/*.ts`: HTTP handlers (cookies, redirects, response codes)
- `src/services/auth.ts`: register/login/session business logic
- `src/services/passwordRecovery.ts`: token issuance/reset + session invalidation
- `src/services/user.ts`: profile read/update rules
- `src/services/userEvents.ts`: claim + list events
- `src/repositories/{user,userIdentity,session,passwordReset,userEvent}.ts`: DB primitives
- `src/utils/{cookies,hashing,tokens}.ts`: pure helpers (cookie options, hashing helpers)

---

## API Contracts (Draft)

### Register / Login / Session
- `POST /api/auth/register` → `{ user }` + `Set-Cookie: session_token=...`
- `POST /api/auth/login` → `{ user }` + `Set-Cookie: session_token=...`
- `GET /api/auth/session` → `{ user }` (401 if not authenticated)
- `POST /api/auth/logout` → `{ success: true }` + clears cookie

### Claim Event
- `POST /api/users/me/events/claim`
  - Body: `{ "eventId": "evt_...", "participantToken": "pt_..." }`
  - Response: `{ "success": true, "userEvent": { ... } }`

All errors use the existing API error envelope:
```json
{ "error": { "code": "SOME_CODE", "message": "Human readable" } }
```

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Register | POST register | 201 + session cookie |
| Login invalid | POST login | 401 INVALID_CREDENTIALS |
| Session missing | GET session | 401 UNAUTHORIZED |
| Password reset request (unknown email) | POST recovery/request | 200 success (no leak) |
| Password reset | POST recovery/reset | 200 + sessions invalidated |
| Claim event with valid participantToken | POST claim | 200 + UserEvent created |
| Claim event idempotent | POST claim twice | 200 + no duplicates |
| List user events | GET /users/me/events | 200 only linked events |

---

## Dependencies

- Milestones 1–7 complete (Fastify base, DB, Redis, SSE, error handling patterns)

---

## Exit Criteria

- [ ] Prisma migration applied and models enforced with proper constraints
- [ ] Email/password auth works end-to-end with HttpOnly cookie sessions
- [ ] Password recovery implemented with anti-enumeration and session invalidation
- [ ] User profile endpoints implemented with strict allowlist updates
- [ ] Claim + list user events implemented; no sensitive tokens ever returned
- [ ] Integration tests cover core auth + claim flows
