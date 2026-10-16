# Event lifecycle

Create a meeting, share its address with a guest, change its title or time, and delete it from the organizer's browser. Every entry starts UNVERIFIED until a saved run records its action and result.

## Sub-features

- `event-create` creates a meeting with an occasion, time, and organizer name; the organizer's location is optional.
- `event-presets` fills the occasion from a meeting-type chip.
- `event-edit` saves or cancels a title/date/time change.
- `event-share` copies the guest URL and opens it in a separate browser context.
- `event-delete` requires typed confirmation and makes the URL unavailable.
- `event-onboarding-help` covers the tutorial, FAQ, Contact, and home navigation.

## How to get to it (user POV)

- Open `/`; choose `Date night`, `Team meeting`, `Group dinner`, `Coffee catch-up`, `Weekend hangout`, or `Family outing`, or type an `Occasion`. Use `Pick a date and time`, `Your name`, then `Create Meeting`.
- From `/dashboard`, use `Create New Event` or the empty-state `Create Your First Event`. Both lead to `/`.
- Open `/meet/<id>` directly, through a shared URL, or through a dashboard event card. Desktop `Home` and phone `Where2meet home` return to `/`.
- As organizer, choose `Settings` then `Edit Event` or `Delete Event`. Modals also expose `Cancel`, `Close`, and Escape.
- Desktop `Share event` and phone `Share with group` open `Share Event`; use `Copy link`, then `Done`, `Close`, or Escape.
- New meeting onboarding exposes `Next`, `Got it!`, and `Skip tutorial`. Landing footer `FAQ` and `Contact` link to `/faq` and `/contact`, whose home links return to `/`.

## Driving it with Playwright

Preconditions: healthy isolated run, fresh desktop context, `base = run.client_url`, and no existing event used for destructive testing. Leave the optional address blank for the key-free lifecycle recipe. Keep `meetingUrl` and `eventId` from the browser's actual URL.

- **Create.** The picker initially selects today; choosing a time commits that selection. To test another date, select its visible calendar day first.
  ```js
  await page.goto(base);
  assert(await page.getByRole('button', { name: 'Create Meeting', exact: true }).isDisabled());
  await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill('Verification meeting');
  await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
  await page.getByRole('button', { name: '17:30', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification organizer');
  await page.getByRole('button', { name: 'Create Meeting', exact: true }).click();
  await page.waitForURL(/\/meet\/[^/?]+/);
  await page.locator('.cat-portal').waitFor({ state: 'detached' });
  const meetingUrl = page.url(); const eventId = new URL(meetingUrl).pathname.split('/').pop();
  await page.getByRole('heading', { name: 'Verification meeting', exact: true }).waitFor();
  ```
- **Preset and alternative creation entries.** On a new landing visit, run `await page.getByRole('button', { name: 'Date night', exact: true }).click(); assert.equal(await page.getByRole('textbox', { name: 'Occasion', exact: true }).inputValue(), 'Date night');`. Repeat for all six chips. After authenticating, click each applicable dashboard creation link and assert `new URL(page.url()).pathname === '/'` after `waitForURL(base + '/')`.
- **Edit and persist.** Dismiss any visible tutorial before opening Settings.
  ```js
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Event', exact: true }).click();
  await page.getByLabel('Event Title', { exact: true }).fill('Verification revised');
  await page.getByLabel('Date', { exact: true }).fill('2030-11-15');
  await page.getByLabel('Time', { exact: true }).fill('15:30');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Verification revised', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Verification revised', exact: true }).waitFor();
  ```
- **Cancel.** Reopen `Edit Event`, fill `Event Title` with `Discard this`, click `Cancel`, then reopen it and assert `assert.equal(await page.getByLabel('Event Title', { exact: true }).inputValue(), 'Verification revised');`. Repeat using `Close` and Escape as separate entries.
- **Share to a guest.** The second context must have no organizer storage.
  ```js
  await page.getByRole('button', { name: 'Share event', exact: true }).click();
  await page.getByRole('heading', { name: 'Share Event', exact: true }).waitFor();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await page.getByText('Link copied to clipboard!', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/meet/${eventId}`);
  const guestContext = await browser.newContext(); const guest = await guestContext.newPage();
  await guest.goto(new URL('/meet/' + eventId, base).href);
  await guest.getByRole('button', { name: 'Join Event', exact: true }).waitFor();
  assert.equal(await guest.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  ```
  Copy toast alone is not clipboard proof. If clipboard permissions are unsupported, mark copying unverified and record the browser limitation. Repeat the opener with phone `Share with group`.
- **Delete.** First cancel once and reopen the deletion prompt; the meeting must remain reachable. Then perform the destructive confirmation only for this run's meeting.
  ```js
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Delete Event', exact: true }).isDisabled());
  await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
  await page.waitForURL(base + '/');
  const missingPage = await guest.reload();
  assert.equal(missingPage.status(), 404);
  await guest.getByRole('heading', { name: '404', exact: true }).waitFor();
  const deleted = await context.request.get(run.backend_url + '/api/events/' + eventId);
  assert.equal(deleted.status(), 404);
  ```
- **Tutorial and help.** For each visible tutorial step, click `Next` until `Got it!`, then assert the dialog is hidden. Separately test `Skip tutorial`. Run `await page.goto(base); await page.getByRole('link', { name: 'FAQ', exact: true }).click(); await page.getByRole('heading', { name: 'FAQ', exact: true }).waitFor();`; repeat for `Contact`. Inspect its `mailto:` link without sending email.

## Gotchas

- The current landing requires `Your name`; old two-field recipes cannot submit. Creation animates a cat transition, so wait for the meeting URL and controls instead of a fixed delay.
- The tutorial starts after a delay and is inside an `aria-hidden` backdrop. Use visible `getByText('Skip tutorial', { exact: true })` to dismiss it, or register a Playwright locator handler for that button. An early Escape before the tutorial appears does not dismiss it.
- Modals have headings but no dialog role. Scope by their visible heading or exact field labels, not an invented dialog name.
- The edit form combines a UTC-derived date with local time. Record timezone and reopen both fields to detect a day shift.
- Calendar navigation and phone share are separate unverified entries unless exercised. The basic lifecycle does not prove Google Maps, location saves, voting, accounts, or live notifications.
