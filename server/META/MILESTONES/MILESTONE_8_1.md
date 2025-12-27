# Milestone 8.1: OAuth + Account Linking (Phase 2)

Enhancements on top of Milestone 8 (Phase 1): OAuth login + connected accounts + optional auto-linking.

---

## Goals

- Support “Sign in with Google/GitHub” while keeping cookie-session auth as the primary transport.
- Allow users to link/unlink OAuth identities from Settings (“Connected accounts”).
- Keep event flow unchanged; optionally improve UX by auto-linking newly created events when authenticated.

---

## Deliverables

### 8.1.1 OAuth Providers
- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Provider configuration in env + config validation

### 8.1.2 OAuth Routes
- [ ] `GET /api/auth/oauth/:provider/start`
  - [ ] Generate and persist `state` (and PKCE verifier if used)
  - [ ] Redirect to provider consent screen
- [ ] `GET /api/auth/oauth/:provider/callback`
  - [ ] Validate `state` (and PKCE)
  - [ ] Exchange code for provider tokens
  - [ ] Fetch provider profile (provider user id, email if available, avatar/name)
  - [ ] Create or link `UserIdentity`
  - [ ] Create session cookie and redirect back to frontend

### 8.1.3 Identity Linking/Unlinking Rules
- [ ] Linking:
  - [ ] If session exists during callback: link identity to current user
  - [ ] If no session: sign in by identity; create user if identity is new
- [ ] Unlinking:
  - [ ] Prevent removing the last remaining identity (account lockout)
  - [ ] Re-auth requirement (optional hardening): require recent login to unlink
- [ ] Conflicts:
  - [ ] If identity already belongs to another user: return 409 (or redirect to error page)

### 8.1.4 Optional: Auto-Link on Event Creation
- [ ] If session cookie present on `POST /api/events`, auto-create `UserEvent` for organizer.
- [ ] No behavioral changes for anonymous users.

---

## Service + Layer Placement (Repo Conventions)

- `src/routes/auth/oauth.ts`: start/callback HTTP routes (redirects + cookies)
- `src/services/oauth.ts`: orchestration + linking rules
- `src/lib/oauth/google.ts`: token exchange + profile fetch
- `src/lib/oauth/github.ts`: token exchange + profile fetch

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| OAuth start | GET oauth/start | 302 to provider with state |
| OAuth callback invalid state | GET oauth/callback | 400/401 |
| OAuth callback first-time user | callback | user created + session cookie |
| OAuth callback existing identity | callback | session created for existing user |
| Link while logged in | callback | identity attached to current user |
| Prevent unlink last identity | unlink | 409/400 |
| Auto-link event creation (optional) | POST /api/events w/ session | UserEvent created |

---

## Dependencies

- Milestone 8 complete (User models + sessions + claim/list)

---

## Exit Criteria

- [ ] Google and GitHub OAuth work end-to-end
- [ ] Identity linking/unlinking rules enforced (no account lockout)
- [ ] Optional auto-link behaves correctly and is fully tested (if implemented)
