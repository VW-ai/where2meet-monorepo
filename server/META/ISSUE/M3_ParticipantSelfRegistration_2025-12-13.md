# Issue: Participant Self-Registration and Token-Based Self-Management

- **Detected on:** 2025-12-13
- **Milestone:** 3 (Maps + Participant Module)
- **Owner:** TBD
- **Priority:** High

## Summary

Current implementation requires `organizerToken` for all participant operations (add, update, delete). This limits the user experience since participants cannot self-register or manage their own entries.

**Desired workflow:**
1. Organizer creates event, gets `organizerToken`
2. Organizer shares event link with friends
3. Participant visits link, enters name + address, joins event
4. Participant receives `participantToken` to manage their own entry
5. Participant can update/delete themselves using their token

## Proposed Solution

### 1. Schema Changes (Prisma)

Add `tokenHash` field to Participant model:

```prisma
model Participant {
  // ... existing fields ...
  tokenHash  String?  @map("token_hash") @db.VarChar(64)  // SHA-256 hash
}
```

**Design decisions:**
- SHA-256 hash (not bcrypt) since tokens are high-entropy random values
- Nullable to support organizer-created participants without self-management
- Consistent with security best practice of not storing secrets in plaintext

### 2. Unified Endpoint (Optional Auth)

Instead of a separate `/join` endpoint, upgrade existing endpoint:

```
POST /api/events/:id/participants
Authorization: Bearer {organizerToken}  (OPTIONAL)
```

**Behavior:**
- **No auth header:** Self-registration → returns `participantToken`
- **With organizerToken:** Organizer adds → no `participantToken`

**Request (same for both modes):**
```json
{
  "name": "Alice",
  "address": "123 Main St, San Francisco, CA",
  "fuzzyLocation": false
}
```

**Response (201) - No auth (self-join):**
```json
{
  "id": "uuid",
  "name": "Alice",
  "address": "123 Main St, San Francisco, CA",
  "location": { "lat": 37.7749, "lng": -122.4194 },
  "color": "coral",
  "fuzzyLocation": false,
  "participantToken": "pt_abc123...64chars"
}
```

**Response (201) - With organizerToken:**
```json
{
  "id": "uuid",
  "name": "Alice",
  "address": "123 Main St, San Francisco, CA",
  "location": { "lat": 37.7749, "lng": -122.4194 },
  "color": "coral",
  "fuzzyLocation": false
}
```

**Key behaviors:**
- Generate and return `participantToken` only when no auth provided
- Store SHA-256 hash in database
- Reject if event is published
- Apply rate limiting only for unauthenticated requests

### 3. Dual-Token Authentication

Update existing PATCH/DELETE endpoints to accept either token:

| Token Type | Scope |
|------------|-------|
| `organizerToken` | Full access to any participant |
| `participantToken` | Access only to matching participant |

**Auth flow:**
1. Extract Bearer token from Authorization header
2. Try verifying as organizerToken → if valid, full access
3. Try verifying as participantToken → if valid, self-only access
4. Neither valid → 403 Forbidden

### 4. Security Considerations

| Measure | Value | Rationale |
|---------|-------|-----------|
| Rate limit (per IP) | 10 joins/hour | Prevent spam from single source |
| Rate limit (per event) | 50 joins/hour | Prevent event flooding |
| Participant cap | 50 per event | Limit event size |
| Token entropy | 64 hex chars (256 bits) | Prevent enumeration |

### 5. Endpoint Auth Matrix

| Endpoint | No Auth | participantToken | organizerToken |
|----------|---------|------------------|----------------|
| POST /events/:id/participants | Self-join (returns token) | - | Create any (no token) |
| PATCH /events/:id/participants/:pid | - | Update self | Update any |
| DELETE /events/:id/participants/:pid | - | Delete self | Delete any |

## Implementation Tasks

- [x] Create Prisma migration to add `tokenHash` column
- [x] Create token hash/verify utility functions
- [x] Create `verifyParticipantAccess` auth hook (dual-token)
- [x] Update POST /participants to support optional auth
- [x] Update PATCH endpoint to use new auth hook
- [x] Update DELETE endpoint to use new auth hook
- [ ] Add rate limiting for unauthenticated POST requests
- [x] Write integration tests for dual-token scenarios
- [x] Update API_SPECIFICATION.md documentation
- [x] Update MILESTONE_3.md documentation
- [x] Update PROGRESS.md with completion

## Open Questions

1. **Token recovery:** If participant loses token, should they re-join as new participant or have recovery mechanism?
   - **Recommendation:** Re-join as new (keeps system simple)

2. **Organizer-created participants:** Should they receive tokens?
   - **Recommendation:** No token initially; add claiming mechanism later if needed

3. **Event-level toggle:** Should organizers be able to disable self-registration?
   - **Recommendation:** Defer to future milestone

## References

- Architecture design by architecture-advisor agent (2025-12-13)
- Related: Milestone 3 participant routes implementation
