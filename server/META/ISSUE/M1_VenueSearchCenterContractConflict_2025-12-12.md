# Issue: Venue search center contract conflict

- **Detected on:** 2025-12-12
- **Milestone:** 1 (Foundation)
- **Owner:** TBD

## Summary
`META/ARCHITECTURE/FUNCTIONAL_MODULES.md` states that the backend must derive the venue-search center from `eventId` and never accept client-provided coordinates (lines 251-303). `META/ARCHITECTURE/API_SPECIFICATION.md` contradicts this by requiring the client to POST a `center { lat, lng }` directly to `/api/venues/search` (lines 274-318). These mutually exclusive contracts lock us out of shipping a consistent Venue module because we cannot implement both at once.

## Impact
- Implementation for `/api/venues/search` cannot start—engineers do not know whether to expect `eventId` or `center`/`radius` from the client.
- Future SDK or frontend typings generated from the API spec will diverge from the backend security guidance, causing breaking integration changes later.
- If left unresolved, Milestone 2 stories around venue search will churn, as reviewers will flag whichever path we pick as violating one of the documents.

## Proposed Resolution
1. Decide on the authoritative flow:
   - **Option A (recommended):** Keep the backend-derived MEC center for fairness/integrity. Update `API_SPECIFICATION.md` so `/api/venues/search` accepts `{ eventId, searchRadius, query?, categories? }` and explicitly states that the server ignores any user-provided center coordinates.
   - **Option B:** Allow clients to submit `{ center, radius }`, and relax the security guidance in `FUNCTIONAL_MODULES.md` accordingly (document how tampering is mitigated if this path is chosen).
2. Once the decision is made, update both docs in the same PR and regenerate any API references or SDK contracts tied to the old shape.
3. Call out the finalized contract in Milestone 2 planning so engineers have a concrete acceptance criterion.

## Next Steps
- Schedule a quick architecture sync to choose Option A or B.
- Track the doc update as part of the Milestone 2 backlog so it is resolved before backend work on venue search begins.
