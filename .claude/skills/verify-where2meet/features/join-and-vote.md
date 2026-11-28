# Join and vote

A friend opens the invite link, joins with a name and a starting address, searches for venues near the group, and votes for one.

## Sub-features

- `join-invite` opens `/m/<code>` and shows the invitation dialog.
- `join-form` adds the guest with a name, an address from autocomplete, and a travel mode.
- `vote-search` lists venues for a category such as `Cafe`.
- `vote-cast` records a vote, and the button changes to `Remove vote`.

## How to get to it (user POV)

- Open the invite link an organizer shared.
- Choose `Join this plan` in the invitation dialog.
- Choose a category in the event banner, or type in combobox `Search venues`.

## Driving it with drive.mjs

Preconditions:

- Doctor exits 0 and prints `ok    maps`.
- The Maps key can call the Places Nearby Search API from the server.

- **Run.** Run `node .claude/skills/verify-where2meet/scripts/drive.mjs join-and-vote`. The flow creates an event in one browser context and reads its invite link.
- **Join.** A second context opens the invite link, chooses `Join this plan` in the dialog, then `Not now`. It fills textbox `Your name` with `Verifier Guest`, types `Times Square, New York` in combobox `Where are you coming from?`, picks the first option, and chooses `Join plan`. `joined.png` shows the guest in the participant list.
- **Vote.** The guest chooses the banner button `Cafe` and then the first `Vote for venue`. The button changes to `Remove vote`. `vote.png` shows it.
- **Proof.** Run `.claude/skills/verify-where2meet/scripts/sql.sh "select p.name, v.venue_id from vote v join participant p on p.id = v.participant_id order by v.created_at desc limit 1"`. The row names `Verifier Guest`.

## Gotchas

- The Doppler key `GOOGLE_MAPS_WEB_API_KEY` works for address autocomplete in the browser, but Google answers `REQUEST_DENIED` when the server calls Places Nearby Search with it. The production server key is not in Doppler `where2meet-ios/prd`. With that key, the join step passes and the vote step fails with the Google message in the Venues panel. Report that failure, and check the join with `select name, formatted_address from participant order by created_at desc limit 2`.
- The organizer has no starting address in this flow, so only the guest's address places the search area.
- The API logs `Cache read error: Cache unavailable` from the Places cache. The search runs without the cache.
