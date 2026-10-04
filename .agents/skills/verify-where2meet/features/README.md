# Where2Meet verification map

This directory maps the existing Where2Meet product behavior. Read this index before driving a feature. A recipe is not proof that its entry points work. See [recorded verification coverage](../verification-status.md) for each run's revision and scope.

The M1 replacement backend currently supports only no-location event creation/read/edit/delete, organizer name and identity, stored vote reads, session reads, and authenticated SSE. Other operations explicitly return 501. Run account-write and Google recipes against the old backend until their replacement modules exist. The fixed M1 frontend is `05e6daa`; historical M0 Google proof uses `d7a8bcd` and the old backend.

## Baseline preconditions

- Follow the parent skill's selected local or PPE recipe. Local runs own their database, Redis, browser profile, and ports. PPE runs use the explicitly identified remote resources and own only their local frontend, browser profile, and recorded synthetic events.
- Read `client_url` and `backend_url` from that run's `run.json`; never assume the ordinary development ports are available.
- Keep frontend and backend mocks off. The event lifecycle can run without Google credentials by leaving the organizer's optional address blank. Location, venue, route, and publication success need real browser and server Google credentials.
- These baseline recipes use no fixtures. A separately labeled provider diagnostic may substitute responses only at an existing external-provider boundary; its result must not be reported as real-provider proof.
- Create events, participants, and accounts through the UI. Use fresh browser contexts for separate people. Never put tokens into storage, call app stores, or seed successful responses through internal endpoints.

## Driving conventions

- Manual snippets assume an active Playwright `browser`, `context`, and `page`, the parsed `run`, and `import assert from 'node:assert/strict'`. Use `const base = run.client_url;` and an evidence directory from the current run.
- Use desktop width `1280` for desktop entries and phone width `390` for phone entries. Test both when a feature lists both. Hidden responsive duplicates are not interchangeable entry points.
- A locator's `waitFor()` means wait for a visible result. Capture failed waits with their screenshot and current ARIA snapshot; do not repair a failure with application state injection.
- Observe names returned by Google and use those exact names in `venueName` or `addressName`. Record which suggestion was selected. Provider results change; never assert an invented venue exists.
- If the tutorial appears, exercise `Next` through `Got it!` or dismiss with `Skip tutorial`; record which entry was used. Finish this before entering an address because dismissing it changes focus and can close autocomplete suggestions. Do not suppress it by editing browser storage.

## Proof and skip reporting

- Capture the action and result with an action log, screenshots, ARIA snapshots, and credential-free network metadata. Record feature ID, entry point, source revision, run identity, and prerequisites with each proof. Do not save unredacted browser traces.
- After mutations, reload or use a second user-facing view. A read-only backend GET may corroborate persistence; it cannot replace the UI action.
- Keep tokens, passwords, cookies, and raw session responses out of shareable evidence. Retain proof artifacts after cleanup.
- Mark each entry `VERIFIED`, `FAILED`, or `UNVERIFIED` with its evidence path or unmet prerequisite. Never mark a skipped entry verified through another entry.
- Only entries exercised in saved evidence are verified. Read the recorded coverage for exact entry points; no feature-wide PASS is implied.

## Features

| Feature | Entry coverage | Old backend proof | M1 backend proof |
| --- | --- | --- | --- |
| [Event lifecycle](./event-lifecycle.md) | Landing creation, presets, dashboard creation, edit, share, delete, tutorial, help | Basic lifecycle verified | Basic no-location lifecycle and token-only identity recovery verified; other entries unverified |
| [Participants](./participants.md) | Organizer location, add, guest join, edit, privacy, remove, leave, phone People | Inline organizer location and guest join verified | Organizer name and identity verified; location/join unavailable |
| [Places and routes](./places-routes.md) | Search, suggestions, cards, markers, modes, details, statistics | Map, text search, details, driving and walking verified | Search and routing unavailable |
| [Voting and publishing](./voting-publishing.md) | Vote, shortlist, live updates, publish, unpublish | Card voting, last-vote removal, publish and unpublish verified at d7a8bcd | Stored vote reads tested through HTTP; writes and publication unavailable |
| [Accounts and claims](./accounts-claims.md) | Register, sign in/out, dashboard, profile, claims | 15 checks pass with fixed frontend; anonymous organizer auto-claim fails | Imported session validity and expiry verified; account writes unavailable |

## Current source changes and hazards

- Earlier selectors must be rechecked. Current creation says `Create Meeting`, requires `Your name`, and accepts an optional location. `Occasion` replaces any older event-title landing locator.
- Current phone controls use `People`, `Places`, `Find a meeting spot`, and `Share with group`; desktop controls use `Participants`, `Venues`, and `Share event`.
- Organizer participant additions keep the form open for the next person. An unchanged saved address no longer needs to be selected again when editing a participant.
- Current desktop venue search separates `Search “…” near your group` from an exact Google place suggestion. These are distinct paths.
- Google/GitHub sign-in and Connected Accounts controls are commented out. Recovery and identity handlers route to missing backend endpoints with mocks off; a mock-mode success does not establish real auth support. The dashboard's cross-event liked-venue section is disabled.
