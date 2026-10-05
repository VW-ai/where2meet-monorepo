# Places and routes migration

The replacement backend supports the existing public venue search and detail endpoints and authenticated meeting directions. The frontend can keep its current requests and drawable route fields. Voting writes, publication, and route statistics remain separate migration work.

Meetings authorizes the participant credential and reads the selected participant origins in one short database snapshot. Places resolves a trusted destination from Google or its validated cache. Routing receives coordinates and opaque origin IDs, with no event credentials or database access. No database transaction spans a Google request.

## HTTP behavior

| Operation | Contract |
| --- | --- |
| `POST /api/venues/search` | Retains center, radius, query and category inputs and the full venue envelope. Text results precede categories for duplicate IDs. Any failed subsearch fails the complete search and cancels remaining work. |
| `GET /api/venues/:id` | Returns full provider details after the shared summary has been saved. Imported summary coordinates are never destination authority. |
| `GET /api/venues/:id/photo` | Returns a checked, key-free Google image redirect with `Cache-Control: no-store`. Missing photos return 404; unavailable or unsafe provider responses return 502. Width is fixed at 400. |
| `GET /api/events/:id/venues/:venueId/directions` | Requires an event participant credential. Any participant can request another participant's route within that event. The account cookie does not grant this authority. |

Directions keeps successful `routes` followed by the existing null rows for participants without a location. It adds `outcomes`, with one `{participantId, status}` entry for every selected participant. Status is `found`, `no-location`, `no-route`, or `unavailable`. A located failure never becomes a null drawable route. An all-failed batch remains HTTP 200 with explicit failure outcomes; consumers must inspect them before claiming route success.

Stored fuzzy coordinates are used as-is. Routing does not geocode the original address again. New summary photos store an owned path; old photo strings are availability hints only and are never returned or fetched.

## Runtime configuration

Set `PUBLIC_API_ORIGIN=https://ppe-backend-ppe.up.railway.app` on the dedicated Railway PPE backend. Other deployments use their own public origin. A validated `RAILWAY_PUBLIC_DOMAIN` is the fallback; production fails startup without either. Local development can use the actual listening loopback port. Incoming Host headers do not control photo URLs.

Places lookups have a five-second total budget. A combined search has ten seconds and at most two concurrent subsearches. Routing has ten seconds and at most four concurrent requests, starting after destination resolution. Photo lookup and redirect share ten seconds. Transient failures receive at most three attempts; cache commands have a 500 ms bound. These are configured limits, not measured production latency.

Versioned caches validate every value and use exact request inputs. Search and routes retain one-hour TTLs; details retain one day. Corrupt or unavailable cache data is bypassed. Failed operations are not cached.

## Verification

`npm run verify` covers the HTTP boundaries with PostgreSQL, Redis and a local Google HTTP fixture. Cases include permissions before provider work, imported data poisoning, fuzzy origins, out-of-order routes with duplicate coordinates, malformed provider responses, mixed outcomes, cache isolation and failure, deadlines, and photo redirects. These fixtures do not prove live Google integration.

The [verification skill](../../.agents/skills/verify-where2meet/SKILL.md) defines local and dedicated-PPE acceptance with a fixed frontend, real Google services, two UI-created participants, displayed driving/walking values and exact synthetic cleanup. Record each deployed revision and result separately. Shared provider Venue cache rows may remain; synthetic cleanup does not mean the database is empty. No historical import or production cutover is performed by this slice.
