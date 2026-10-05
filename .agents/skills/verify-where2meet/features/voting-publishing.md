# Voting and publishing

Participants shortlist venues with votes, see other people's votes, and the organizer publishes a final meeting place or reopens voting. See [recorded coverage](../verification-status.md) for M4's bounded local and Railway PPE acceptance, plus the historical frontend results. Unlisted entry points remain UNVERIFIED.

The M4 `voting-publication` scenario passes all 16 observations in local run `2026-10-05-m4-google-e` and PPE run `2026-10-05-m4-ppe-a`. Both use backend `99bebef771d3ae2af8ce7e553d9dd8cb05cb4b55`, fixed frontend `b960f605d4a6015f7d389cc8d1bf0bb528e8773e`, and verifier `871171727105a6a1055419b57757879314f2cc5b`. PPE deployment is `62c6348f-9bb7-4224-bbe5-18ae7071489a`. The client and schema are unchanged.

[The bounded driver](../helpers/voting-browser.mjs) continues the completed real Google M3 setup. Verified entries include organizer card and guest detail-heart votes, both removal cases, empty live shortlists and reload persistence, automatic voting during publication, the published-heart DELETE allowance and POST 409 rollback, published reload, anonymous disabled joining, and live reopening followed by a persisted guest vote. A second publication preserves both existing vote IDs without another vote request, then reopens again. Exact HTTP bodies, public reads, stored membership, complete SSE snapshots, and the untouched observer corroborate these UI actions. Final UI deletion leaves no event, participant, or vote rows. Shared Venue cache rows and Redis diagnostic sequence keys are outside that cleanup.

Local A-D remain failed verifier attempts, with their evidence and cleanup retained. Phone layouts, the ordinary detail counter as its own entry, no-selection and cancellation variants, concurrent snapshot ordering/reconnect recovery, historical import, and production frontend serving remain outside M4 acceptance. Local and PPE PASS do not establish completed CI or enforced required checks.

## Sub-features

- `vote-card` adds or removes a vote on a venue card.
- `vote-detail` uses the detail vote counter and the detail heart.
- `vote-shortlist-live` persists the group shortlist and updates another open participant.
- `publish-final` finalizes a selected venue and disables joining, editing people, and ordinary vote buttons.
- `publish-reopen` unpublishes the meeting and restores editable controls.

## How to get to it (user POV)

- Find a venue via [Places and routes](./places-routes.md), then use card `Vote for venue`/`Remove vote`.
- Open that venue's detail panel. The counter uses the same vote labels; the separate heart uses `Save venue`/`Remove from saved`.
- `Expand liked venues filter` opens `Liked Venues`; `Collapse liked venues filter` restores search results. Accessible filter names include a count when nonempty. Shortlisted venues also have `(Liked)` map markers.
- Organizer desktop or phone `Settings` exposes `Publish Event`; the modal offers `Publish Event`, `Cancel`, `Close`, and Escape. Select a venue first, using a card or marker.
- Once published, `Settings` exposes `Unpublish Event`. Guests with no prior membership see `Event Published` and a disabled `Join Event`.
- Dashboard event cards show a `Published` badge. The dashboard does not currently show a cross-event liked-venue list.

## Driving it with Playwright

Preconditions: unpublished event with organizer `page`, a separately joined `guest`, and a Google-verified `venueName` visible on a result card in both browsers. Keep the guest open to prove live changes without reloading. Scope all vote actions because cards and details can expose duplicate labels.

- **Vote on a card.** Compare the rendered count with the baseline count.
  ```js
  const card = page.getByRole('button').filter({ has: page.getByRole('heading', { level: 3, name: venueName, exact: true }) });
  const before = Number(await card.getByRole('button', { name: 'Vote for venue', exact: true }).innerText());
  await card.getByRole('button', { name: 'Vote for venue', exact: true }).click();
  await card.getByRole('button', { name: 'Remove vote', exact: true }).waitFor();
  await card.locator('button[aria-label="Remove vote"][aria-busy="false"]').waitFor();
  assert.equal(await card.getByRole('button', { name: 'Remove vote', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(Number(await card.getByRole('button', { name: 'Remove vote', exact: true }).innerText()), before + 1);
  ```
  Wait for its `aria-busy` to return `false` and corroborate with the guest's card count before reloading. A transient optimistic count is insufficient proof.
- **Remove and restore.** Click that card's `Remove vote`, wait for `Vote for venue`, and assert its count returns to `before`. Vote again, reload, open `Expand liked venues filter` by `/^Expand liked venues filter/`, then wait for the `Liked Venues` heading and the saved venue heading.
- **Detail entries.** Click the venue card and scope to its complementary panel.
  ```js
  await card.click();
  const details = page.getByRole('complementary', { name: venueName, exact: true });
  await details.getByRole('button', { name: 'Remove from saved', exact: true }).click();
  await details.getByRole('button', { name: 'Save venue', exact: true }).waitFor();
  await details.getByRole('button', { name: 'Save venue', exact: true }).click();
  await details.getByRole('button', { name: 'Remove from saved', exact: true }).waitFor();
  ```
  If a rating is present, the panel also renders a separate `Remove vote` counter. Exercise it independently and verify the other heart and card update. The counter is absent for unrated venues, so report that unmet prerequisite.
- **No-selection and cancellation.** Close details to clear the selection; open `Settings` then `Publish Event`. Assert the modal's `Publish Event` button is disabled and `No venue selected. Select a venue before publishing to include a location.` is visible. Click `Cancel`; repeat cancellation using `Close` and Escape.
- **Publish a selected venue.** Select it again and leave the detail panel open.
  ```js
  await card.click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Publish Event', exact: true }).click();
  const published = page.waitForResponse(r => /\/publish$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publish Event', exact: true }).click();
  assert((await published).ok());
  await page.getByRole('heading', { name: 'Event Published!', exact: true }).waitFor();
  await guest.getByRole('heading', { name: 'Liked Venues', exact: true }).waitFor();
  await guest.getByRole('button', { name: 'Voting disabled after publish', exact: true }).first().waitFor();
  assert(await guest.getByRole('button', { name: 'Voting disabled after publish', exact: true }).first().isDisabled());
  ```
  Capture the selected venue's `Published` badge, reload both browsers, and require the same published state. In a third fresh context open the URL, wait for the `Event Published` heading, then assert `Join Event` is disabled. The success text saying participants were notified requires proof from the existing guest, not an assumption of email delivery.
- **Reopen.** The organizer uses Settings again.
  ```js
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const unpublished = page.waitForResponse(r => /\/publish$/.test(new URL(r.url()).pathname) && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Unpublish Event', exact: true }).click();
  assert((await unpublished).ok());
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Publish Event', exact: true }).waitFor();
  ```
  Before reloading the guest, verify its vote and participant controls become editable through the live update. Then reload it to prove persistence.

## Gotchas

- Publishing verifies the selected place through Google. Real backend credentials remain required even if the card was already visible.
- Publishing may first add the organizer's vote. Measure the actual final counts rather than assuming publishing has no voting side effect.
- The detail `Save venue`/`Remove from saved` heart remains actionable after publication. M4 verifies DELETE 200 and removal, followed by POST 409 and visible rollback with unchanged publication. Disabled ordinary vote buttons do not imply that all voting actions are locked.
- Published mode forces the shortlist filter open and disables its toggle. A selected venue and a voted venue are different states.
- The Published badge is inside the selected card's heading, so its exact accessible name becomes `venueName + 'Published'`. Wait for the loaded event before checking publication locks and for the browser's own vote response before accepting an empty reloaded shortlist.
- The publish success modal closes after two seconds. Capture durable published badges and the second browser as well as the transient success heading.
