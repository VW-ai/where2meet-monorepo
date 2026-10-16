# Recorded verification coverage

Original frontend and backend: `8f8535a17109b6e71f2106361d6685a5641d980e`.
Compatible frontend: `d7a8bcd9238b9e20260f091c41e3de5e822da2ac`. Its server tree is unchanged from the original. This is a verified candidate for the listed paths, not approval to migrate or deploy.

All browser runs used disposable local PostgreSQL and Redis, fresh Chrome contexts, mocks off, and synthetic application data. The Google flow used Doppler project `where2meet`, config `dev`, secret name `GOOGLE_MAP`. No production database was used.

| Run | Observed result | Evidence files |
| --- | --- | --- |
| Original Google flow, 2026-10-03 | FAIL. Last-vote removal left the guest at 1; unpublish left the guest locked. | `2026-10-03-google-e/evidence/google-result.json` |
| Compatible Google flow, 2026-10-04 | PASS. Map, autocomplete and geocoding, two participants, search/details, two driving routes, two walking routes, add/remove final vote, publish/reload/unpublish. Existing guest updates without reload. | `2026-10-04-m0-sync/evidence/google-result.json`, `google-actions.json`, `google-sse-messages.json`, `google-08-reopened-guest.png` |
| Compatible no-location lifecycle | PASS. Create, organizer name, cached organizer controls after reload, title edit, anonymous view, delete. | `2026-10-04-m0-sync/evidence/result.json` |
| Original account flow, 2026-10-04 | FAIL overall. 14 of 16 checks pass; two product failures remain asserted. No terminal script error in the final run. | `2026-10-04-m0-accounts-e/evidence/accounts-result.json` |

Evidence is retained locally under `/Users/waynewang/Documents/ChatGPT/where2meet/verification-evidence/`. Runtime directories were cleaned. Raw browser traces, credentials and evidence databases are not checked in. Rerun the shipped helpers to reproduce the assertions.

## Account results

Passed protected-route redirects, anonymous creation, cached organizer controls after reload, registration with a server session, signed-in creation with a persisted organizer claim, dashboard reload, name and fuzzy preference persistence, canceling unsaved settings, logout with session invalidation, signing in again, separate-browser anonymity, separate-browser sign-in and claimed dashboard card, opening that card, and no uncaught browser errors.

The two failures remain acceptance failures:

- `/me` returns `participantId`; the page reads `id` and observes no participant ID. Existing local credentials still restore the organizer controls. Evidence: `accounts-me-identity-observation.json`.
- Registering after anonymous organizer creation does not claim that event. No successful claim request was observed, and the database has no account link. Creating while signed in uses a separate claim path and passes. Evidence: `accounts-anonymous-claim-state.json`, `accounts-signed-in-creation-state.json`.

A separate signed-in browser lists the organizer card but opens the event with guest controls. Account claims currently do not restore participant Bearer credentials on another browser. This is a recorded limit, not a tested permission upgrade. Evidence: `accounts-separate-event-access.json`.

Cookie metadata and database checks record attributes, original expiration timestamps, identity providers, IDs and hash presence. They do not retain passwords, Cookie values, or hash values. This is not an old-data import or expired-session migration proof.

Earlier account runs a-d contain a response-envelope mistake and navigation-related response-body capture failures in the draft driver. They are preserved as failed attempts. The final driver verifies the UI and corroborates state with read-only requests sharing the browser session.

## Automated checks

The initial five regression tests reported `Tests 3 failed | 2 passed (5)`. After the fix, eight SSE tests and all 59 client tests passed. TypeScript checking passed. ESLint had zero errors and 54 existing console warnings. The production bundle built with the repository CI configuration; that mock-enabled build is separate from the real-backend browser proof.

The fix accepts empty vote snapshots, reads canonical voterIds, and applies nested event fields including null publication values. Real messages captured in the Google run match these formats. Voting rules did not change.

Still unverified: other recipe variants, participant claims, phone layouts, privacy, transit/cycling, exact-place entry, default addresses and applying account location preferences, map/statistics controls, detail-heart publication guards, historical-data import, production serving and deployment. Stream chunk parsing, concurrent snapshot freshness and recovery after a lost best-effort broadcast remain separate work. Do not mark these passed from this baseline.
