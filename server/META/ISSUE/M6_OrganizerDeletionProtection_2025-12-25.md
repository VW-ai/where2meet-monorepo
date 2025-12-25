# Prevent Deletion of Organizer Participant

**Date**: 2025-12-25
**Milestone**: 6 (Results & Publishing)
**Status**: Open
**Type**: Bug Fix
**Severity**: Medium
**GitHub Issue**: #19

---

## Issue

The auto-created organizer participant (`isOrganizer: true`) can be deleted like any other participant. This would break event integrity.

## Current Behavior

1. Event is created → organizer participant auto-created with `isOrganizer: true`
2. Organizer calls `DELETE /api/events/:id/participants/:organizerPid`
3. Request succeeds (200)
4. Organizer participant is deleted

**Result**: Event is left in inconsistent state. Organizer cannot vote, their participant record is gone.

## Root Cause

The `deleteParticipant()` method in ParticipantService has no check for `isOrganizer` flag:

```typescript
async deleteParticipant(eventId: string, participantId: string): Promise<void> {
  await this.ensureEventModifiable(eventId);

  // Check participant exists and belongs to event
  const exists = await this.participantRepo.belongsToEvent(participantId, eventId);
  if (!exists) {
    throw new ParticipantNotFoundError(participantId);
  }

  await this.participantRepo.delete(participantId);
  // NO CHECK FOR isOrganizer!
}
```

## Proposed Solution

Add validation in `ParticipantService.deleteParticipant()` to reject deletion of organizer participants.

### Code Change

```typescript
async deleteParticipant(eventId: string, participantId: string): Promise<void> {
  await this.ensureEventModifiable(eventId);

  // Fetch participant to check isOrganizer
  const participant = await this.participantRepo.findById(participantId);
  if (!participant || participant.eventId !== eventId) {
    throw new ParticipantNotFoundError(participantId);
  }

  // NEW: Prevent organizer deletion
  if (participant.isOrganizer) {
    throw new ForbiddenError("Cannot delete the organizer participant");
  }

  await this.participantRepo.delete(participantId);
  logger.info({ eventId, participantId }, "Participant deleted");
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/services/participant.ts` | Add `isOrganizer` check in `deleteParticipant()` |
| `tests/participants.test.ts` | Add test: "should reject deletion of organizer participant" |

---

## Expected Behavior

- `DELETE /api/events/:id/participants/:organizerPid` returns 403 Forbidden
- Error response:
  ```json
  {
    "error": {
      "code": "FORBIDDEN",
      "message": "Cannot delete the organizer participant"
    }
  }
  ```

---

## Test Cases Needed

1. Delete organizer participant → 403 Forbidden
2. Delete regular participant → 200 OK (existing behavior unchanged)
3. Organizer trying to delete themselves via participantToken → 403 Forbidden

---

## References

- [Participant service](../../src/services/participant.ts)
- [Participant routes](../../src/routes/participants.ts)
- Related issue: [M5_OrganizerCannotVote](./M5_OrganizerCannotVote_2025-12-21.md)
