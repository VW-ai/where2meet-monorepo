# M3 verifier design

The `places-routes` scenario uses `browser.mjs` for event creation, organizer identity, title edit, fresh shared view, and exact event cleanup. A new `places-browser.mjs` segment supplies organizer location, a fresh guest join, coffee search, selected-place details and photo, then driving and walking routes. It returns its explicit scope and writes progress evidence in `finally`.

| Shape | Cost and evidence |
| --- | --- |
| Shared lifecycle with one segment | Reuses the current local/PPE adapters and deletion checks. New code contains only M3 assertions and synthetic participant setup. |
| Copy `google-browser.mjs` into a standalone driver | Duplicates lifecycle, credential handling, cleanup, and result dispatch. Its vote/publication flow and direct database reads need removal or replacement. |

Choose the shared lifecycle. The original Google driver remains a separate broader scenario. No M3 success claim includes voting, publishing, route statistics, transit, cycling, or account writes.

PPE records returned search IDs before forwarding a successful response, then admits only those detail/photo paths. Directions requires the pending owned event, a recorded place, and exactly one driving/walking query. Search accepts only the real browser's bounded center, radius, and `coffee` query. Participant bodies keep the existing allowed keys and must address the recorded event. A successful guest response is recorded before the browser receives it.

The photo exception admits only an owned backend photo request and a validated 302 to `https://lh3.googleusercontent.com` without credentials, query, or fragment. Finite API reads reject other redirects before forwarding their responses. The exact owned SSE stream continues without buffering, then its observed status and content type must be 200 and `text/event-stream`. A redirect invalidates proof after observation. Evidence stores origins, paths, and key-presence booleans, never provider redirect URLs, credentials, or browser storage.

The segment requires successful search and details responses, two persisted public landmark origins, exhaustive found outcomes, and each person's returned distance and duration visible in both modes. A present photo must complete browser loading. A real-provider failure remains FAIL and writes the canonical result before cleanup. Shared provider Place IDs are reported separately from synthetic event/participant cleanup; the verifier never deletes or restores Venue rows.

Local Python and Node tests exercise guards, malformed observations, redirects, and failed evidence. They substitute only the boundary needed to test the verifier and do not claim Google or PPE proof. Root owns subsequent live-provider and dedicated-PPE runs. The fixed frontend remains `b960f605d4a6015f7d389cc8d1bf0bb528e8773e`.
