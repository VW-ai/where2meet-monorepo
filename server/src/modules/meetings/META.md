# Meetings

`types.ts` defines meeting and participant snapshots, operations, and domain notices. `store.ts` implements complete operations using the module's Prisma models. Authorization occurs inside write transactions. Event creation and its organizer insert commit together.

Vote reads query actual Vote rows and request venue summaries through Places. Notifications are attempted after commit; delivery failure does not reverse a successful mutation. HTTP owns the SSE wire representation.

Participant joining, location changes, vote writes, publishing, and account claims remain unavailable in M1.
