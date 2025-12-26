# Voting/SSE Architecture - Complete Implementation

## Overview

This document describes the refactored voting and SSE (Server-Sent Events) architecture that separates venue details from vote statistics, preventing data loss and ensuring reliable real-time updates.

---

## Architecture Principles

### 1. Separation of Concerns

**Before (Problematic):**

```typescript
// Mixed venue details with vote stats - prone to overwrites
likedVenueData: Record<string, Venue>; // Contains voteCount
userVotes: Record<string, boolean>;
```

**After (Robust):**

```typescript
// Separated stores - single responsibility
venueById: Record<string, Venue>; // Full venue details ONLY
voteStatsByVenueId: Record<
  venueId,
  {
    // Vote statistics ONLY
    voteCount: number;
    voterIds: string[];
    seq?: number; // Future: sequence number
  }
>;
myParticipantId: string | null; // Current user context
```

**Benefits:**

- ✅ Venue details never overwritten by incomplete SSE data
- ✅ Vote stats can update independently
- ✅ Clean rollback (stats only, not venue details)
- ✅ Easier to reason about data flow

---

## Key Components

### Store ([src/store/useMeetingStore.ts](../src/store/useMeetingStore.ts))

#### State Structure

```typescript
interface MeetingState {
  // Venue details (permanent, never overwritten by SSE)
  venueById: Record<string, Venue>;

  // Vote statistics (updated by votes and SSE)
  voteStatsByVenueId: Record<
    string,
    {
      voteCount: number;
      voterIds: string[];
      seq?: number;
    }
  >;

  // Current user context
  myParticipantId: string | null;

  // Backward compatibility (derived from above)
  savedVenues: string[]; // DO NOT SET - use getMyLikedVenueIds()
  likedVenueData: Record<string, Venue>; // DO NOT SET - use venueById
}
```

#### Actions

**setSearchedVenues** - Populates `venueById` with full details from search

```typescript
setSearchedVenues: (venues) => {
  const newVenueById = { ...state.venueById };
  venues.forEach((venue) => {
    newVenueById[venue.id] = venue; // Store full details
  });
  return { searchedVenues: venues, venueById: newVenueById };
};
```

**voteForVenue** - Optimistic update with clean rollback

```typescript
voteForVenue: async (venueId, venue) => {
  // 1. Save previous stats for rollback (NOT venue details)
  const previousStats = get().voteStatsByVenueId[venueId];

  // 2. Optimistic update
  set({
    venueById: { ...state.venueById, [venueId]: venue },      // Store details
    voteStatsByVenueId: {
      ...state.voteStatsByVenueId,
      [venueId]: { voteCount: X, voterIds: [..., participantId] }
    }
  });

  // 3. HTTP request
  try {
    await api.votes.castVote(...);
    await loadVoteStatistics(); // Reconcile with server
  } catch (error) {
    // 4. Rollback ONLY stats, NEVER touch venueById
    set({ voteStatsByVenueId: { ...previousStats } });
  }
}
```

**setVoteStatistics** - SSE handler, preserves venue details

```typescript
setVoteStatistics: (statistics) => {
  const newVenueById = { ...state.venueById };
  const newVoteStats = {};

  statistics.venues.forEach((venueStats) => {
    // CRITICAL: Only add to venueById if missing
    if (!newVenueById[venueStats.id]) {
      newVenueById[venueStats.id] = createMinimalVenue(venueStats);
    }

    // Always update vote stats (this is what SSE is for)
    newVoteStats[venueStats.id] = {
      voteCount: venueStats.voteCount,
      voterIds: venueStats.voters || [], // Defensive guard
    };
  });

  set({ venueById: newVenueById, voteStatsByVenueId: newVoteStats });
};
```

#### Derived Selectors (Single Source of Truth)

**DO NOT** access `savedVenues` or `likedVenueData` directly. Use these selectors:

```typescript
// Get venues current user voted for
getMyLikedVenueIds: () => string[]

// Get all venues with votes (sorted by count)
getAllVotedVenueIdsSorted: () => string[]

// Get venue with vote stats merged
getVenueWithStats: (venueId) => Venue & { voteCount: number }

// Get all voted venues as array
getAllVotedVenues: () => Venue[]
```

**Example Usage:**

```typescript
// ✅ CORRECT - Use selector
const myLikedIds = useMeetingStore((state) => state.getMyLikedVenueIds());

// ❌ WRONG - Direct access (deprecated)
const savedVenues = useMeetingStore((state) => state.savedVenues);
```

---

### SSE Handler ([src/lib/sse-handlers.ts](../src/lib/sse-handlers.ts))

#### handleVoteStatistics - Updated for Separation

```typescript
function handleVoteStatistics(data: VoteStatisticsPayload) {
  const { venueById, searchedVenues } = useMeetingStore.getState();

  const transformedVenues = data.venues.map((backendVenue) => {
    // CRITICAL: Prioritize venueById to preserve full details
    const fullVenue =
      venueById[backendVenue.venueId] || // Prefer full details
      searchedVenues.find((v) => v.id === backendVenue.venueId);

    // Defensive guard: Handle missing voterNames field
    const voterIds = backendVenue.voterNames ?? [];

    if (!fullVenue) {
      console.warn('[SSE] Missing venue details:', backendVenue.venueId);
      // Return minimal structure (hydration ready)
      return createMinimalVenue(backendVenue, voterIds);
    }

    // Return full venue details with vote stats
    return {
      id: backendVenue.venueId,
      name: fullVenue.name,
      address: fullVenue.address,
      // ... all other fields from fullVenue
      voteCount: backendVenue.voteCount,
      voters: voterIds,
    };
  });

  setVoteStatistics({ venues: transformedVenues, totalVotes });
}
```

**Key Improvements:**

1. ✅ Prioritizes `venueById` over `searchedVenues`
2. ✅ Defensive guard for missing `voterNames`
3. ✅ Logs warnings for missing venue data (hydration ready)
4. ✅ Never overwrites complete data with incomplete data

---

### SSE Connection Hook ([src/hooks/useEventStream.ts](../src/hooks/useEventStream.ts))

#### Snapshot Reconciliation on Reconnect

```typescript
interface UseEventStreamOptions {
  onConnect?: () => void; // NEW: Called on connection established
}

// In useEventStream hook:
if (eventType === 'connected') {
  console.log('[SSE] Connection established');
  onConnect?.(); // Trigger snapshot reconciliation
  return;
}

// Also trigger on initial connection:
const openTime = Date.now();
updateConnectionState('connected');
reconnectAttempts.current = 0;
onConnect?.(); // Load snapshot to reconcile state
```

#### Usage in MeetPage

```typescript
// src/app/meet/[id]/page.tsx
const { connectionState } = useEventStream(eventId, token, {
  onConnect: () => {
    console.log('[SSE] Loading vote statistics for reconciliation');
    loadVoteStatistics(); // Reconcile with server snapshot
  },
});
```

**Benefits:**

- ✅ Automatic reconciliation after network interruptions
- ✅ Prevents drift during SSE disconnections
- ✅ No lost votes during reconnect
- ✅ Works with browser sleep/wake

---

## Bugs Fixed

### 1. "Liked Venues Disappearing" Bug 🐛 → ✅

**Symptom:** Venues disappear from liked list after SSE update

**Root Cause:** SSE overwrites `likedVenueData` with incomplete payloads

**Fix:** Separated `venueById` (permanent) from `voteStatsByVenueId` (ephemeral)

**Verification:** Test A in `useMeetingStore.vote-architecture.test.ts`

---

### 2. "includes crash" Bug 🐛 → ✅

**Symptom:** `Cannot read properties of undefined (reading 'includes')`

**Root Cause:** Backend inconsistency - `voterNames` field sometimes undefined

**Fix:** Defensive guards: `const voterIds = backendVenue.voterNames ?? []`

**Verification:** Test B in `useMeetingStore.vote-architecture.test.ts`

---

### 3. Optimistic Rollback Bug 🐛 → ✅

**Symptom:** Venue details lost after failed vote

**Root Cause:** Rollback deletes entire `likedVenueData[venueId]` entry

**Fix:** Rollback only touches `voteStatsByVenueId`, never `venueById`

**Verification:** Test C in `useMeetingStore.vote-architecture.test.ts`

---

### 4. SSE Reconnection Drift Bug 🐛 → ✅

**Symptom:** Vote counts inconsistent after network interruption

**Root Cause:** No snapshot reconciliation after reconnect

**Fix:** `onConnect` callback triggers `loadVoteStatistics()` on reconnect

**Verification:** Manual Test 6 in QA Checklist

---

## Testing

### Automated Tests

**Location:** `src/store/__tests__/useMeetingStore.vote-architecture.test.ts`

**Run:**

```bash
npm test -- useMeetingStore.vote-architecture
```

**Coverage:**

- ✅ Test A: SSE doesn't overwrite venue details
- ✅ Test B: Missing voterIds doesn't crash
- ✅ Test C: Rollback preserves venue details
- ✅ Bonus: Derived selectors work

### Manual Testing

**Location:** `docs/VOTING_SSE_QA_CHECKLIST.md`

**Quick QA (5 min):**

1. Real-time vote sync
2. Reload consistency
3. Optimistic UI + rollback
4. Spam click protection
5. Missing venue data
6. Network interruption

**Extended QA (15 min):**

- Multiple events
- Organizer as participant
- Published event (voting disabled)
- Concurrent unvote

**Regression Testing (10 min):**

- Liked venues disappearing
- includes crash
- Rollback removes details

---

## Migration Guide

### For Component Developers

**Before:**

```typescript
// ❌ OLD - Direct access
const { savedVenues, likedVenueData } = useMeetingStore();
const hasVoted = savedVenues.includes(venueId);
const venue = likedVenueData[venueId];
```

**After:**

```typescript
// ✅ NEW - Use selectors
const { savedVenues, getVenueWithStats } = useMeetingStore();
const hasVoted = savedVenues.includes(venueId); // Backward compatible
const venueWithStats = getVenueWithStats(venueId); // Preferred
```

**For New Code:**

```typescript
// Use derived selectors for clean code
const myLikedIds = useMeetingStore((state) => state.getMyLikedVenueIds());
const allVoted = useMeetingStore((state) => state.getAllVotedVenues());
```

### For Store Mutations

**❌ NEVER DO THIS:**

```typescript
// Direct mutation of deprecated fields
set({ savedVenues: [...state.savedVenues, venueId] });
set({ likedVenueData: { ...state.likedVenueData, [id]: venue } });
```

**✅ ALWAYS DO THIS:**

```typescript
// Use actions that handle both stores
voteForVenue(venueId, venue); // Updates both venueById and voteStats
unvoteForVenue(venueId); // Updates both stores correctly
```

---

## Future Enhancements

### 1. Venue Hydration API

**Problem:** SSE only sends vote stats, not full venue details

**Solution:** Add hydration endpoint

```typescript
// GET /api/venues/:venueId
async function hydrateVenue(venueId: string) {
  const venue = await api.venues.get(venueId);
  useMeetingStore.setState((state) => ({
    venueById: { ...state.venueById, [venueId]: venue },
  }));
}

// In SSE handler:
if (!fullVenue) {
  console.warn('Missing venue, triggering hydration');
  hydrateVenue(backendVenue.venueId);
}
```

### 2. Sequence Numbers

**Problem:** Out-of-order SSE events not detected

**Solution:** Add `seq` field to vote stats

```typescript
interface VoteStats {
  voteCount: number;
  voterIds: string[];
  seq: number; // Server-assigned sequence number
}

// In setVoteStatistics:
if (currentStats.seq && newStats.seq <= currentStats.seq) {
  console.warn('Ignoring stale SSE event');
  return; // Reject out-of-order update
}
```

### 3. Server-Side Standardization

**Problem:** Backend sends `voterNames` but contains participant IDs

**Solution:** Rename to `voterIds` in API spec

```typescript
// Backend API response:
{
  venueId: string;
  voteCount: number;
  voterIds: string[]; // ✅ Renamed from voterNames
}

// Keep voterNames for backward compatibility:
{
  voterIds: string[];
  voterNames: string[]; // Deprecated, same as voterIds
}
```

---

## Performance Characteristics

### Memory Usage

- **venueById:** O(n) where n = unique venues searched/voted
- **voteStatsByVenueId:** O(m) where m = venues with votes
- **savedVenues:** O(k) where k = user's liked venues
- **Total:** Negligible for <1000 venues per event

### Network Traffic

- **Initial Load:** 1x GET `/api/events/:id/votes/statistics`
- **Per Vote:** 1x POST + 1x GET reconciliation
- **SSE Updates:** ~100 bytes per vote event
- **Reconnect:** 1x GET snapshot (full statistics)

### SSE Reconnection

- **Backoff:** Exponential (1s, 2s, 4s, 8s, 16s, 30s max)
- **Max Attempts:** 10
- **Snapshot Load:** Triggered on every reconnect
- **Impact:** Minimal (<100ms for 100 venues)

---

## Troubleshooting

### Issue: Liked venues not showing

**Check:**

1. `venueById[venueId]` exists?
2. `voteStatsByVenueId[venueId]` exists?
3. `myParticipantId` set correctly?
4. Console shows SSE connected?

**Debug:**

```typescript
console.log('venueById:', useMeetingStore.getState().venueById);
console.log('voteStats:', useMeetingStore.getState().voteStatsByVenueId);
console.log('myParticipantId:', useMeetingStore.getState().myParticipantId);
```

### Issue: Vote counts inconsistent

**Check:**

1. SSE connection status (connected?)
2. Console for SSE errors
3. Network tab for failed API calls
4. Snapshot reconciliation triggered?

**Fix:**

```typescript
// Manually trigger snapshot reconciliation
useMeetingStore.getState().loadVoteStatistics();
```

### Issue: SSE not reconnecting

**Check:**

1. Network tab → SSE request status
2. Browser console → reconnection logs
3. Max reconnect attempts exceeded?

**Fix:**

```typescript
// Reset reconnection attempts
const { disconnect, connect } = useEventStream.getState();
disconnect();
setTimeout(connect, 1000);
```

---

## References

- **Store Implementation:** [src/store/useMeetingStore.ts](../src/store/useMeetingStore.ts)
- **SSE Handlers:** [src/lib/sse-handlers.ts](../src/lib/sse-handlers.ts)
- **SSE Hook:** [src/hooks/useEventStream.ts](../src/hooks/useEventStream.ts)
- **Tests:** [src/store/**tests**/useMeetingStore.vote-architecture.test.ts](../src/store/__tests__/useMeetingStore.vote-architecture.test.ts)
- **QA Checklist:** [docs/VOTING_SSE_QA_CHECKLIST.md](./VOTING_SSE_QA_CHECKLIST.md)
