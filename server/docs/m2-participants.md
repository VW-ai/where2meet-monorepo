# Participant lifecycle migration

Meetings now owns joining, organizer additions, participant edits, and removal. Places owns the Google geocoding boundary. HTTP translates the existing request and response shapes. The database schema and import format remain unchanged.

## Operations and ownership

| Request | Meeting operation | Observable result |
| --- | --- | --- |
| Anonymous participant POST | `join` | Returns the participant and a new participant token. |
| Organizer participant POST | `addParticipant` | Returns a participant without a token. A regular participant cannot use this mode. |
| Participant PATCH | `updateParticipant` | Self or organizer edits; omitted address retains the saved location. |
| Participant DELETE | `removeParticipant` | Self or organizer removal; the organizer cannot be removed. |
| Authenticated `/me` GET | `identify` | Returns only the caller's private address and existing identity fields. |

Published meetings reject participant writes. A credential from another meeting grants no authority. Supplied malformed authentication is rejected instead of falling back to anonymous joining. Removing a participant cascades their votes and nulls their account link's participant reference. It retains the global venue and account.

Location lookup happens before the write transaction. The transaction rechecks authorization, publication, target membership, and any saved location used to prepare the result. A conflicting location edit returns 409 instead of overwriting newer coordinates. Name-only edits preserve coordinates. Google failures cannot leave a partial participant record.

## Private and public locations

Public event reads, participant write responses, and participant broadcasts return `address: null` for a fuzzy location. `/me` retains the original address for the authenticated participant. The frontend loads that value into the local editor. It omits an unchanged address from PATCH, so an organizer can rename another hidden participant without resubmitting an unknown address.

New fuzzy locations use a private random displacement between half a mile and one mile. The effective point is persisted once. Reading, renaming, and importing do not displace it again. Imported coordinates retain their previous meaning, including the limitations of the old name-derived displacement. This change does not promise anonymity or rewrite old coordinates.

The organizer's existing ability to edit another participant's location and privacy remains. Public redaction does not revoke that permission. A stricter organizer privacy policy needs a separate product decision.

## Realtime and provider boundaries

Participant notices retain the frontend's flat `lat` and `lng` fields and include `fuzzyLocation`. Removal also publishes a canonical `vote:statistics` snapshot for existing consumers. Delivery remains best effort without replay or a total order across concurrent writers. An already-open stream can continue receiving public updates after its participant leaves, until disconnect or timeout. Reconnection and subsequent authenticated requests reject that deleted identity.

Geocoding validates Google's status, formatted address and coordinate bounds. No result returns 400 `ADDRESS_NOT_FOUND`; an unavailable provider returns 502 `EXTERNAL_SERVICE_ERROR`. Errors omit addresses and keys. `GOOGLE_MAPS_API_KEY` supplies the credential and `GEOCODE_TIMEOUT_MS` bounds the operation. Provider fixtures in tests are distinct from real Google browser evidence.

## Verification

Run `npm run verify` in `server` with owned loopback PostgreSQL and Redis URLs. The HTTP integration tests use real transactions and a local provider fixture. CI runs the backend suite on PostgreSQL 17 and 18 and retains the candidate and fixed `05e6daa` frontend no-location lifecycle.

Run the shared `participants` scenario using [the verification recipe](../../.agents/skills/verify-where2meet/features/participants.md), then repeat it against the identified Railway PPE deployment. This scenario needs the corrected frontend because the original pin assumes public fuzzy addresses remain readable. Record clean source revisions, provider configuration, database observations, browser actions and cleanup. Only a named PASS for that deployment counts as PPE evidence.

The PPE synthetic request budget is 500 requests per 15 minutes so multiple test browsers and corroborating reads can complete. The default application budget remains 100. The verifier records PPE's actual settings. This scenario does not validate production rate-limit behavior, production hosting, historical production data, accounts, routes, venue search, voting writes, or publication.

Migration PRs remain unmerged. Staging and production are unchanged.
