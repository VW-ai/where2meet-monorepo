# Voting/SSE Architecture - Manual QA Checklist

## Quick QA (5 minutes) - Critical Path Testing

### Test 1: Real-time Vote Sync

**Scenario:** Verify SSE synchronization between participants

1. Open two browser windows side-by-side
2. Window A: Join as Participant A
3. Window B: Join as Participant B (same event)
4. Participant A: Vote for a venue
5. **Verify:** Participant B sees count update immediately (via SSE)
6. Participant B: Vote for same venue
7. **Verify:** Participant A sees count increase to 2
8. **Pass Criteria:** Both users see consistent counts in real-time

### Test 2: Reload Consistency

**Scenario:** Verify persistence after page refresh

1. Continue from Test 1 (both participants have voted)
2. Participant B: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. **Verify:** Vote counts remain consistent after reload
4. **Verify:** Liked venues section shows correct venues
5. **Pass Criteria:** No vote counts lost, no duplicate venues

### Test 3: Optimistic UI + Rollback

**Scenario:** Verify optimistic updates and error handling

1. Participant A: Open DevTools Network tab
2. Participant A: Throttle network to "Slow 3G"
3. Participant A: Vote for a new venue
4. **Verify:** Heart fills immediately (optimistic update)
5. **Verify:** Count increments immediately
6. **Wait:** For vote to complete
7. **Verify:** Count stays consistent (no revert on success)
8. **Bonus:** Use Network tab to block the vote API call → verify rollback works

### Test 4: Spam Click Protection

**Scenario:** Verify no race conditions or negative counts

1. Participant A: Rapidly click vote button 10 times (spam)
2. **Verify:** No negative counts
3. **Verify:** No flickering between voted/not voted states
4. **Verify:** Final count is correct (not 10x)
5. **Pass Criteria:** Single vote registered, UI stable

### Test 5: Missing Venue Data (Hydration Ready)

**Scenario:** Verify graceful handling of incomplete SSE data

1. Participant A: Vote for venue not in current search results
2. **Verify:** No crashes or errors in console
3. **Verify:** Console shows "Missing venue details for: ..." (hydration ready)
4. **Optional:** Check that venue appears with minimal info
5. **Pass Criteria:** No crashes, graceful degradation

### Test 6: Network Interruption + Reconnect

**Scenario:** Verify SSE reconnection and snapshot reconciliation

1. Participant A: Open DevTools Network tab
2. Participant A: Vote for a venue (count = 1)
3. Participant A: Go offline (DevTools → Network → Offline checkbox)
4. **Wait:** 5 seconds (SSE disconnects)
5. Participant B: Vote for same venue (count should be 2)
6. Participant A: Go online again
7. **Verify:** SSE reconnects automatically
8. **Verify:** Console shows "Connection established - loading vote statistics snapshot"
9. **Verify:** Participant A sees count = 2 (reconciled via snapshot)
10. **Pass Criteria:** No drift, counts match across all clients

---

## Extended QA (15 minutes) - Edge Cases

### Test 7: Multiple Events

**Scenario:** Verify liked venues across different events

1. Create Event 1, vote for Venue A
2. Create Event 2, vote for Venue B
3. Navigate to Dashboard
4. **Verify:** Liked Venues section shows both A and B
5. **Verify:** Count shows "2 liked venues"
6. **Pass Criteria:** Venues don't leak between events

### Test 8: Organizer as Participant

**Scenario:** Verify organizer can vote on their own event

1. Create an event as organizer
2. Add yourself as a participant (with location)
3. Vote for a venue
4. **Verify:** Vote count increments
5. **Verify:** Heart fills in
6. **Verify:** Other participants see organizer's vote
7. **Pass Criteria:** Organizer votes work like participant votes

### Test 9: Published Event (Voting Disabled)

**Scenario:** Verify voting disabled after publish

1. Organizer: Publish event with a venue
2. Participant: Try to vote
3. **Verify:** Vote buttons are disabled (gray)
4. **Verify:** Hover shows "Voting disabled after publish"
5. **Pass Criteria:** Cannot vote after publish

### Test 10: Concurrent Unvote

**Scenario:** Verify unvote handling

1. Participant A: Vote for venue (count = 1)
2. Participant A: Immediately unvote (spam click)
3. **Verify:** Count returns to 0
4. **Verify:** Heart becomes unfilled
5. Participant B: Vote for same venue
6. **Verify:** Participant A sees count = 1 (not 0)
7. **Pass Criteria:** Unvote works reliably

---

## Regression Testing (10 minutes) - Bug Prevention

### Regression Test 1: "Liked Venues Disappearing" Bug

**Fixed by:** Separated `venueById` from `voteStatsByVenueId`

1. Participant A: Search for "cafe" → vote for "Starbucks"
2. Participant A: Search for "restaurant" (different results)
3. Participant B: Vote for "Starbucks" (triggers SSE to Participant A)
4. Participant A: Check liked venues filter
5. **Verify:** "Starbucks" is STILL in liked venues (even though not in current search)
6. **Pass Criteria:** Liked venues persist across searches

### Regression Test 2: "includes crash"

**Fixed by:** Defensive guards for `voterNames`/`voterIds`

1. Open Console (F12)
2. Vote for multiple venues
3. **Verify:** No errors mentioning "Cannot read properties of undefined (reading 'includes')"
4. **Verify:** No crashes when SSE arrives
5. **Pass Criteria:** No runtime errors in console

### Regression Test 3: Rollback Removes Venue Details

**Fixed by:** Optimistic rollback only affects stats, not `venueById`

1. Participant A: Throttle network to Slow 3G
2. Participant A: Vote for a new venue
3. Participant A: Immediately go offline (before vote completes)
4. **Verify:** Vote reverts (optimistic rollback)
5. Participant A: Go back online
6. Participant A: Search again → find the same venue
7. **Verify:** Venue STILL has full details (photo, rating, address)
8. **Pass Criteria:** Venue details not lost during rollback

---

## Performance Testing (Optional)

### Test P1: Large Event (50+ venues)

1. Create event with 10 participants
2. Search and vote for 50+ venues
3. **Verify:** UI remains responsive
4. **Verify:** No lag when scrolling venue list
5. **Verify:** SSE updates arrive quickly

### Test P2: SSE Heartbeat

1. Keep event open for 5+ minutes
2. **Verify:** Console shows periodic heartbeat logs
3. **Verify:** No disconnections
4. **Pass Criteria:** Stable long-lived connection

---

## Accessibility Testing (Optional)

### Test A1: Keyboard Navigation

1. Tab through venue cards
2. Press Enter on vote button
3. **Verify:** Vote registers
4. **Verify:** Screen reader announces state change

### Test A2: ARIA Labels

1. Inspect vote button with DevTools
2. **Verify:** `aria-label` is descriptive
3. **Verify:** `aria-pressed` reflects vote state
4. **Verify:** `aria-busy` shows loading state

---

## Known Limitations (Expected Behavior)

### L1: Venue Details from SSE Only

- **Behavior:** If you join event late, venues voted by others may show as "Unknown Venue"
- **Reason:** SSE doesn't send full venue details, only vote stats
- **Future Fix:** Implement venue hydration (GET /api/venues/:id)

### L2: Snapshot Load on Every Reconnect

- **Behavior:** SSE reconnection triggers full snapshot load (all votes)
- **Reason:** Ensures no drift after network issues
- **Impact:** Minor API load, negligible for <100 venues

### L3: No Sequence Numbers (Yet)

- **Behavior:** Out-of-order SSE events handled but not detected
- **Future Fix:** Add `seq` field to detect and reject stale events

---

## Test Results Template

```
Date: ___________
Tester: ___________
Build: ___________

Quick QA (5 min):
- [ ] Test 1: Real-time Vote Sync
- [ ] Test 2: Reload Consistency
- [ ] Test 3: Optimistic UI + Rollback
- [ ] Test 4: Spam Click Protection
- [ ] Test 5: Missing Venue Data
- [ ] Test 6: Network Interruption + Reconnect

Extended QA (15 min):
- [ ] Test 7: Multiple Events
- [ ] Test 8: Organizer as Participant
- [ ] Test 9: Published Event
- [ ] Test 10: Concurrent Unvote

Regression Testing (10 min):
- [ ] Regression 1: Liked Venues Disappearing
- [ ] Regression 2: includes crash
- [ ] Regression 3: Rollback Removes Details

Notes:
_______________________________________
_______________________________________
_______________________________________
```

---

## Automated Test Coverage

**Unit Tests:** `src/store/__tests__/useMeetingStore.vote-architecture.test.ts`

- ✅ Test A: SSE doesn't overwrite venue details
- ✅ Test B: Missing voterIds doesn't crash
- ✅ Test C: Rollback preserves venue details
- ✅ Bonus: Derived selectors work correctly

**Run Tests:**

```bash
npm test -- useMeetingStore.vote-architecture
```

**Expected Output:** All 4 tests pass ✓
