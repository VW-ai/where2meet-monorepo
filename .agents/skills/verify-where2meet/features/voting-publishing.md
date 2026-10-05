# Voting and publishing

Participants shortlist venues with votes, see other people's votes, and the organizer publishes a final meeting place or reopens voting. See [recorded coverage](../verification-status.md) for the original failures and the compatible frontend's passing last-vote and unpublish checks. Unlisted entry points remain UNVERIFIED.

The M4 `voting-publication` scenario uses [the bounded driver](../helpers/voting-browser.mjs) with fixed frontend `b960f605d4a6015f7d389cc8d1bf0bb528e8773e`. It continues the completed M3 setup and adds card and guest-heart votes, both removal cases, empty live shortlists, auto-vote publication, the published-heart DELETE allowance and POST rollback, persisted publication, anonymous join lock and live reopening followed by a persisted guest vote. A second publication starts with both participants already voted and must preserve both vote IDs without another vote request. It requires exact HTTP bodies, public reads, stored membership and complete SSE snapshots. Source coverage does not mark these paths verified against the M4 backend. Phone layouts, the ordinary detail counter as its own entry, and cancellation variants remain outside this scenario.

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
  Capture the selected venue's `Published` badge, reload both browsers, and require the same published state. In a third fresh context open the URL and assert `Event Published` plus disabled `Join Event`. The success text saying participants were notified requires proof from the existing guest, not an assumption of email delivery.
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
- The current detail `Save venue`/`Remove from saved` heart lacks the ordinary vote button's published disable guard. Treat this as an explicit hazard: record the response and persisted effect of any attempted mutation. The DELETE path has no published-state guard in the inspected source, so do not assume rejection or call all voting locked based only on disabled card buttons.
- Published mode forces the shortlist filter open and disables its toggle. A selected venue and a voted venue are different states.
- The publish success modal closes after two seconds. Capture durable published badges and the second browser as well as the transient success heading.
