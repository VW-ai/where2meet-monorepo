# Meetings

`types.ts` defines meeting and participant snapshots, operations, and domain notices. `store.ts` implements complete operations using the module's Prisma models. Authorization occurs inside write transactions. Event creation and its organizer insert commit together.

Vote reads query actual Vote rows and request venue summaries through Places. Notifications are attempted after commit; delivery failure does not reverse a successful mutation. HTTP owns the SSE wire representation.

Joining issues a participant credential. Organizer additions create tokenless participants. Organizers may edit any participant in their event; other participants may edit or remove only themselves. Participant mutations reject published events and organizer removal.

Geocoding runs outside write transactions. Mutations recheck authority, publication, target membership, and prepared location dependencies before committing. Unchanged complete locations and name-only edits do not call Google. Explicit address replacement repairs incomplete imported coordinates. Serializable retries do not repeat Google requests or resample approximate coordinates.

Public participant snapshots hide addresses when fuzzy mode is enabled. Self identity reads expose the authenticated participant's private original address separately. New fuzzy coordinates use a random spherical offset between half a mile and one mile. Reads and name edits preserve stored coordinates, including imported historical offsets. Imported offsets retain their original algorithm's privacy limitations.

Participant removal cascades votes and nulls the participant link in UserEvent. It publishes a removal notice and then a current vote snapshot. Notifications remain best effort and do not guarantee ordering across concurrent mutations. Existing HTTP vote reads remain authoritative. Already-open SSE streams remain connected until their normal timeout after a participant is removed; new requests and reconnections reject the deleted credential. Every broadcast contains only public projections.

Account claims verify the event and participant credential within a Serializable transaction, then derive role from the participant. Repeating a claim preserves its ID and creation time. A different valid token rebinds the same account-event link. A participant cannot be claimed by two accounts. Published events may be claimed. Claims leave participant credentials intact and emit no notice.

Dashboard reads return narrow summaries scoped to the authenticated account. They retain links whose participant was deleted and omit addresses, coordinates and credentials. Account sessions never replace participant authentication for meeting operations or streams. Vote writes and publishing remain unavailable.

Directions authorize and select participants in one RepeatableRead snapshot. Any authenticated participant may request another participant's route in the same event. Missing membership rejects before provider work. The transaction ends before Places resolves the trusted destination and Routing calculates routes. Only stored display coordinates leave Meetings, including fuzzy points. Concurrent location or credential changes do not revise an already-authorized read. Meetings retains all selected participant IDs and adds no-location outcomes.
