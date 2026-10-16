# Where2Meet verification map

This directory is the maintained map for Where2Meet's browser behavior, based on `8f8535a` with the compatible SSE consumer at `d7a8bcd`. Read this index before driving a feature. A recipe is not proof that its entry points work. See [recorded verification coverage](../verification-status.md) for each run's revision and scope.

## Baseline preconditions

- Follow the parent skill's launch and doctor instructions. Use only its disposable source copy, PostgreSQL database, Redis instance, browser profile, and owned ports.
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

| Feature | Entry coverage | Recorded proof status |
| --- | --- | --- |
| [Event lifecycle](./event-lifecycle.md) | Landing creation, presets, dashboard creation, edit, share, delete, tutorial, help | PARTIAL: basic lifecycle verified; other entries unverified |
| [Participants](./participants.md) | Organizer location, add, guest join, edit, privacy, remove, leave, phone People | PARTIAL: inline organizer location and guest join verified |
| [Places and routes](./places-routes.md) | Desktop and phone search, categories, suggestions, cards, markers, travel modes, details, statistics | PARTIAL: map, text search, details, driving and walking verified |
| [Voting and publishing](./voting-publishing.md) | Card vote, detail vote/save, shortlist, live updates, publish, unpublish | PARTIAL: card voting, last-vote removal, publish and unpublish verified at d7a8bcd; other entries unverified |
| [Accounts and claims](./accounts-claims.md) | Register, sign in/out, protected dashboard, profile, default address, claims, recovery limits | PARTIAL: 14 selected checks pass; /me consumption and anonymous organizer auto-claim fail; other entries unverified |

## Current source changes and hazards

- Earlier selectors must be rechecked. Current creation says `Create Meeting`, requires `Your name`, and accepts an optional location. `Occasion` replaces any older event-title landing locator.
- Current phone controls use `People`, `Places`, `Find a meeting spot`, and `Share with group`; desktop controls use `Participants`, `Venues`, and `Share event`.
- Organizer participant additions keep the form open for the next person. An unchanged saved address no longer needs to be selected again when editing a participant.
- Current desktop venue search separates `Search “…” near your group` from an exact Google place suggestion. These are distinct paths.
- Google/GitHub sign-in and Connected Accounts controls are commented out. Recovery and identity handlers route to missing backend endpoints with mocks off; a mock-mode success does not establish real auth support. The dashboard's cross-event liked-venue section is disabled.
