# Where2Meet verification map

This directory is the maintained source for verifying what a Where2Meet user can do in the web client. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Start the stack with `scripts/up.sh` from the repo root and wait for the `where2meet ready` line.
- Run `scripts/doctor.sh` and require exit 0 before any journey.
- The database starts empty after `up.sh`. Every journey creates the rows it needs.
- Blog pages come from Markdown in `client/src/content/posts/`, so they need no database rows.
- Join-and-vote needs a Maps key that can call the Places API from the server. See its gotchas.

## Driving conventions

- Run each journey with `node .claude/skills/verify-where2meet/scripts/drive.mjs <flow>`. Add `--phone` for the 390 px phone layout.
- Locate elements by ARIA role and accessible name. The flows show the exact names.
- Desktop is 1280 x 900. Phone is 390 x 844 with touch, which renders the v2 phone layout.
- Each journey uses fresh browser contexts with the organizer tutorial marked as seen.

## Proof and skip reporting

- A screenshot and an ARIA snapshot from `drive.mjs`, plus `result.json`.
- For a journey that writes data, a `scripts/sql.sh` row that shows the write.
- Report a failed journey with its `failure.png` and the error line `drive.mjs` printed.
- Do not report a journey as verified through a different entry point.

## Features

- [Create an event](./create-event.md) covers the desktop form, the phone form, the event page and the invite link.
- [Join and vote](./join-and-vote.md) covers a guest joining from the invite link and voting for a venue.
- [Blog post](./blog-post.md) covers a city guide post with its place cards and call to action.
- [City page](./city-page.md) covers a city hub with its area links and post list.
