# Places and routes

The M3 `places-routes` scenario in `helpers/places-browser.mjs` covers the bounded desktop path through the shared lifecycle driver. It verifies real public-landmark origins, `coffee` text search, selected-ID full details, an available photo, and driving/walking routes for both participants. It compares explicit outcomes and visible per-person distance and duration. It leaves the meeting unpublished, performs no votes, and uses the existing exact event cleanup. Run it locally or in PPE with the fixed frontend `b960f605d4a6015f7d389cc8d1bf0bb528e8773e` and real Google credentials. See [the skill](../SKILL.md) and [PPE recipe](../ppe.md).

The recipes below describe broader entry points. Their presence does not mean M3 verifies them. In the fixed frontend, the detail panel's **View travel statistics** button has no click handler, so that button is outside M3 acceptance.

Search around the group's starting points, inspect a specific place, and compare travel times by car, transit, walking, or bike. Core desktop paths have been exercised with real Google services; see [recorded coverage](../verification-status.md). Unlisted entry points remain UNVERIFIED.

## Sub-features

- `places-nearby` searches a phrase inside the meeting area.
- `places-exact` selects one autocomplete suggestion rather than searching its name.
- `places-category-phone` covers category buttons and the phone search form.
- `places-details` opens a card or map marker and displays venue details and external links.
- `routes-modes-stats` compares travel modes, individual travel times, and statistics.
- `map-controls` changes map imagery and centers the meeting area.

## How to get to it (user POV)

- On `/meet/<id>`, desktop `Venues` or `?view=venue` opens the list; phone `Places` opens it in the meeting sheet.
- Desktop `Search venues` is a combobox. Enter runs a nearby search unless a specific suggestion is highlighted. The dropdown has `Search “<query>” near your group` and exact place suggestions. It also supports ArrowDown/ArrowUp, `Clear search`, and Escape.
- Desktop categories are `Bar`, `Gym`, `Cafe`, and `Things to do`. Phone uses the `Find a meeting spot` searchbox with `Search venues`, plus `All spots`, `Coffee`, `Restaurants`, and `Bars`.
- Click a venue card, press Enter or Space on the card, or click its Google marker. Searched markers use the venue name; shortlisted markers append `(Liked)` or `(Published)`.
- Details offer `Close venue details`, Escape, `Open in Google Maps`, and optional website/phone links. `Travel by Car`, `Travel by Transit`, `Travel by Walk`, and `Travel by Bike` appear in the unpublished venue list.
- Participant view `View travel time statistics` opens `Travel Time Stats`; `Close stats panel` closes it. The venue detail button `View travel statistics` has no click handler in the fixed frontend. Phone also displays `Travel times to selected venue`.
- Map buttons expose `Show satellite map`/`Show street map` and `Center map on meeting area`. The search circle is editable and draggable when no valid participant location exists; with locations it follows the group.

## Driving it with Playwright

Preconditions: an unpublished event with two UI-created, geocoded participants; a joined organizer/guest browser; real browser and server Google keys for Maps, Places, Geocoding, and Routes. Set `venueName` from an actual returned heading. Never invent a place ID.

- **Nearby search.** Wait for the actual search response and resulting heading.
  ```js
  await page.goto(meetingUrl + '?view=venue');
  const search = page.getByRole('combobox', { name: 'Search venues', exact: true });
  await search.fill('coffee');
  await page.getByRole('option', { name: /Search “coffee” near your group/ }).waitFor();
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/venues/search' && r.request().method() === 'POST');
  await search.press('Enter');
  assert((await response).ok());
  await page.getByRole('heading', { level: 2, name: /Venues.*coffee/ }).waitFor();
  await page.getByRole('heading', { level: 3, name: venueName, exact: true }).waitFor();
  ```
  Repeat by clicking the nearby-search dropdown option. A legitimate empty result must show `No venues found for "coffee"`; do not count this as venue-detail or route proof.
- **Exact place.** Enter a full venue name, wait for its real autocomplete option, and run `await page.getByRole('option', { name: addressName, exact: true }).click(); await page.getByRole('heading', { level: 3, name: venueName, exact: true }).waitFor();`. Prove it selected the intended address, not a similarly named place. Repeat using ArrowDown to highlight the observed exact option followed by Enter.
- **Clear and escape.** `await search.fill('discard query'); await page.getByRole('button', { name: 'Clear search', exact: true }).click(); assert.equal(await search.inputValue(), '');`. Repeat after typing with `await search.press('Escape'); assert.equal(await search.inputValue(), '');`; the suggestion list must close.
- **Categories and phone.** For each desktop category click its exact button and wait for the successful `/api/venues/search` response and matching result heading. On a phone context run the following, then separately repeat all four phone category buttons.
  ```js
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('searchbox', { name: 'Find a meeting spot', exact: true }).fill('coffee');
  const phoneSearch = page.waitForResponse(r => new URL(r.url()).pathname === '/api/venues/search' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Search venues', exact: true }).click();
  assert((await phoneSearch).ok());
  await page.getByRole('button', { name: 'Places', exact: true }).waitFor();
  await page.getByRole('heading', { level: 3, name: venueName, exact: true }).waitFor();
  ```
- **Details through the card.** Scope nested voting buttons to avoid selecting a different action.
  ```js
  const card = page.getByRole('button').filter({ has: page.getByRole('heading', { level: 3, name: venueName, exact: true }) });
  await card.click();
  await page.getByRole('heading', { level: 2, name: venueName, exact: true }).waitFor();
  assert.equal(await card.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Open in Google Maps', exact: true }).waitFor();
  ```
  Repeat card selection with `await card.focus(); await card.press('Enter');` and Space, and use an observed Google marker by its accessible venue name/title. Do not replace a missing marker handle with coordinate clicks; record that entry as unverified.
- **Travel modes and statistics.** With a selected venue, switch the mode and require returned routes plus displayed times.
  ```js
  const routesResponse = page.waitForResponse(r => /\/directions$/.test(new URL(r.url()).pathname) && new URL(r.url()).searchParams.get('travelMode') === 'walking');
  await page.getByRole('button', { name: 'Travel by Walk', exact: true }).click();
  assert((await routesResponse).ok());
  assert.equal(await page.getByRole('button', { name: 'Travel by Walk', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(new URL(page.url()).searchParams.get('travelMode'), 'walk');
  ```
  Repeat Car/driving, Transit/transit, and Bike/bicycling; confirm each participant's time. Verify the graph separately through `View travel time statistics` in Participants. The inactive venue-detail statistics button does not provide that proof.
- **Map and external links.** `await page.getByRole('button', { name: 'Show satellite map', exact: true }).click(); await page.getByRole('button', { name: 'Show street map', exact: true }).waitFor();` then restore street view. Click `Center map on meeting area` and capture the recentered map. For `Open in Google Maps`, capture the new page URL and assert its hostname is `www.google.com` and its `query_place_id` matches the observed selected venue. Inspect website and `tel:` links without placing a call.

## Gotchas

- Missing/invalid browser keys produce `Failed to Load Map` or `Map temporarily unavailable`. Record that limitation; UI shells do not prove Maps or routes work.
- Current search has distinct nearby and exact-place branches. A suggestion click must not be reported as a nearby search, unlike older recipes that treated both alike.
- Google may return no transit/bicycle route. Save the response and UI state, and mark that mode incomplete rather than assuming a defect or inventing times.
- Closing details clears the selection and routes. Re-select before comparing travel modes or publishing.
- Google map circle manipulation lacks app-owned semantic controls. Mark drag/resize unverified without a stable accessible provider control; do not use coordinates or call map objects.
