# Organizer Cannot Vote For Themselves

**Date**: 2025-12-21
**Milestone**: 5 (Voting System)
**Status**: In Progress (Resolution Implemented)
**Type**: Design Bug
**Severity**: High
**Resolution**: Option A+B Combined - Auto-create organizer participant at event creation

---

## Issue

The event organizer cannot vote for themselves. The voting system requires a `participantId` for every vote, but the organizer is NOT automatically a participant in the event they create.

## Current Behavior

1. Organizer creates event → receives `organizerToken`
2. Organizer wants to vote → must provide `participantId` in request body
3. Organizer has no `participantId` because they are not a participant
4. **Result**: Organizer can vote on behalf of OTHER participants, but cannot vote for themselves

## Root Cause

The data model separates "organizer" and "participant" completely:

```
Event
  └── organizerTokenHash (identifies organizer)
  └── participants[] (people who join with location)

Vote
  └── eventId
  └── participantId (REQUIRED - FK to Participant)
  └── venueId
```

The `Vote` table has a foreign key constraint to `Participant`, meaning every vote MUST be associated with a participant record. The organizer identity (via `organizerToken`) is not linked to any participant record.

## Affected Code

- [prisma/schema.prisma](../../prisma/schema.prisma) - Vote requires participantId FK
- [src/routes/votes.ts](../../src/routes/votes.ts) - castVote requires participantId in body
- [src/services/vote.ts](../../src/services/vote.ts) - verifies participant belongs to event

## Current Workaround

Organizer can manually add themselves as a participant:
1. POST `/api/events/:id/participants` with their own name/address
2. Use the returned `participantId` to vote

**Problems with workaround**:
- Extra step required
- Organizer must share their location (may be undesirable)
- Organizer must track both `organizerToken` and `participantId`
- Not intuitive UX

## Proposed Solutions

### Option A: Auto-create organizer as participant (Recommended)

When creating an event, automatically add the organizer as a participant.

**Changes required**:
1. Add optional `organizerName` and `organizerAddress` fields to create event schema
2. Auto-create participant record linked to organizer during event creation
3. Store reference to organizer's participantId in Event (or derive via token hash)

**Pros**:
- Seamless UX
- Organizer can vote immediately
- Single token for all operations

**Cons**:
- Requires organizer to provide location upfront
- Schema changes needed

### Option B: Make organizer location optional

Allow organizer to be a participant without providing a location.

**Changes required**:
1. Add `isOrganizer` flag to Participant model
2. Make `address`, `lat`, `lng` optional when `isOrganizer=true`
3. Organizer participant excluded from MEC calculation

**Pros**:
- Organizer can vote without revealing location
- More flexible

**Cons**:
- More complex participant model
- Edge cases for MEC calculation

### Option C: Separate organizer vote table

Create a separate mechanism for organizer votes that doesn't require participantId.

**Changes required**:
1. Add `organizerVotes` or modify Vote to allow null participantId for organizer
2. Track organizer votes separately in statistics

**Pros**:
- No participant model changes
- Clear separation of concerns

**Cons**:
- More complex vote aggregation
- Two voting mechanisms to maintain

---

## Recommendation

**Option A** is recommended for simplicity and user experience. During event creation:
- Require `organizerName`
- Make `organizerAddress` optional (organizer can choose not to share location)
- Auto-create a participant record with special handling for null location

This aligns with the product expectation that the organizer is a participant in the meeting.

---

## Test Cases Needed

1. Organizer creates event and can vote without additional steps
2. Organizer without location is excluded from MEC calculation
3. Organizer vote appears in vote statistics
4. Organizer can remove their own vote

---

## Resolution (2025-12-21)

**Chosen Solution**: Combination of Option A and B

When creating an event:
1. Auto-create organizer participant with `isOrganizer=true`
2. Organizer participant has no location (address, lat, lng are NULL)
3. Return `organizerParticipantId` in create event response
4. Organizer uses this ID for voting

**Additional Fixes**:
1. Changed vote routes to use participantId in URL path:
   - `POST /api/events/:id/participants/:participantId/votes`
   - `DELETE /api/events/:id/participants/:participantId/votes/:venueId`
2. Added `selfOnly` option to auth hook - organizer can only vote for themselves
3. MEC calculation excludes participants with null coordinates

**Files Changed**:
- `prisma/schema.prisma` - Add `isOrganizer` field, make location nullable
- `src/hooks/auth.ts` - Add `createVerifyParticipantAccess({ selfOnly })` factory
- `src/routes/votes.ts` - New URL pattern, use selfOnly hook
- `src/services/event.ts` - Create organizer participant on event creation
- `src/dto/event.dto.ts` - Add `organizerParticipantId` to response
- `META/ARCHITECTURE/API_SPECIFICATION.md` - Updated vote routes and auth matrix
- `META/ARCHITECTURE/DATABASE_SCHEMA.md` - Updated Participant and Event schema

---

## References

- [Vote routes](../../src/routes/votes.ts)
- [Vote service](../../src/services/vote.ts)
- [Prisma schema](../../prisma/schema.prisma)
- [PRODUCT.md](../CORE/PRODUCT.md) - Product requirements
- [Plan file](/.claude/plans/polished-soaring-wreath.md) - Implementation plan
