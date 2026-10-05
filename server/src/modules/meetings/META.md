# Meetings

`types.ts` defines meeting and participant snapshots, operations, and domain notices. `store.ts` implements complete operations using the module's Prisma models. Authorization occurs inside write transactions. Event creation and its organizer insert commit together.

Vote reads query actual Vote rows and request venue summaries through Places. Notifications are attempted after commit; delivery failure does not reverse a successful mutation. HTTP owns the SSE wire representation.

Joining issues a participant credential. Organizer additions create tokenless participants. Organizers may edit any participant in their event; other participants may edit or remove only themselves. Participant mutations reject published events and organizer removal.

Geocoding runs outside write transactions. Mutations recheck authority, publication, target membership, and prepared location dependencies before committing. Unchanged complete locations and name-only edits do not call Google. Explicit address replacement repairs incomplete imported coordinates. Serializable retries do not repeat Google requests or resample approximate coordinates.

Public participant snapshots hide addresses when fuzzy mode is enabled. Self identity reads expose the authenticated participant's private original address separately. New fuzzy coordinates use a random spherical offset between half a mile and one mile. Reads and name edits preserve stored coordinates, including imported historical offsets. Imported offsets retain their original algorithm's privacy limitations.

Participant removal cascades votes and nulls the participant link in UserEvent. It publishes a removal notice and then a current vote snapshot. Notifications remain best effort and do not guarantee ordering across concurrent mutations. Existing HTTP vote reads remain authoritative. Already-open SSE streams remain connected until their normal timeout after a participant is removed; new requests and reconnections reject the deleted credential. Every broadcast contains only public projections.

Vote writes, publishing, and account claims remain unavailable.
