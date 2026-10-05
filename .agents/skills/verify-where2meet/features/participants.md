# Participants

Organizers add people and their starting locations; guests join with their own name and address, control address privacy, edit themselves, and leave. The inline organizer location and guest-join paths have been exercised with real Google services. See [recorded coverage](../verification-status.md); other entries remain UNVERIFIED.

## Sub-features

- `participant-location` saves the organizer's starting point on creation or in the inline prompt.
- `participant-add` adds several people consecutively and offers random names.
- `participant-join` gives a fresh guest their own editable participant record.
- `participant-edit-privacy` edits names, addresses, and exact-address visibility.
- `participant-remove-leave` lets organizers remove others and guests leave.
- `participant-live` reflects membership changes in a second open browser.

## How to get to it (user POV)

- Landing `/` has optional `Where are you coming from?`, its address suggestions, and `Use my current location`.
- On `/meet/<id>`, desktop `Participants`, phone `People`, and `?view=participant` expose the people list. Phone `Expand meeting sheet` reveals more space; `Collapse meeting sheet` reduces it.
- A person missing their own address gets `Where are you coming from?` and `Save my location`; their card's `Add starting location` focuses this field.
- Organizer `Add Participant` and guest `Join Event` open the same form. It has `Name`, `Generate random name`, `Starting location`, `Use my current location`, and `Hide exact address`. Signed-in users with a saved address also see `Use Default Address`.
- Hover or keyboard-focus a person's card for `Edit <name>` or `Remove <name>`. A guest sees these only for themselves. The form offers `Save Changes`, `Cancel`, `Close`, and Escape; consecutive organizer additions expose `Done`.
- `Remove <name>` opens `Delete Participant` for someone else or `Leave Event` for the guest themselves. Confirm with `Delete` or `Leave`, or `Cancel`.

## Driving it with Playwright

Run the shared participant scenario after launching an isolated local instance with both real Google keys:

```sh
python3 .agents/skills/verify-where2meet/helpers/control.py drive \
  --run "$VERIFY_RUN" --scenario participants
```

For deployed backend acceptance, use `ppe.py verify --scenario participants` with the target, source checkout, corrected frontend checkout, run directory and private SSH configuration described in [the PPE recipe](../ppe.md). The driver checks public HTTP and SSE against private self reads and stored synthetic rows. `participants-state.json` records named observations, and the outer `result.json` also requires event deletion to pass. Default CI browser jobs continue to exercise the fixed M1 lifecycle without Google credentials; HTTP/provider boundary tests cover participant rejection and race cases in CI.

Preconditions: an unpublished UI-created event, real browser/server Google keys, organizer `page`, fresh `guestContext`/`guest`, and the event's real `meetingUrl`. Use real public addresses and record the selected Google suggestion. `addressName` means the exact accessible option name observed in the current suggestion list.

- **Open each list entry.** `await page.goto(meetingUrl + '?view=participant'); await page.getByRole('heading', { name: 'Participants', exact: true }).waitFor();`. Separately switch from `Venues` with the desktop `Participants` button. On phone use `await page.getByRole('button', { name: 'People', exact: true }).click(); await page.getByRole('heading', { name: 'Participants', exact: true }).waitFor();`. Reclicking the active desktop tab hides the sidebar.
- **Save the organizer's missing location.** The combobox accepts text, but saving requires an actual suggestion selection.
  ```js
  await page.getByRole('button', { name: 'Add starting location', exact: true }).click();
  await page.getByRole('combobox', { name: 'Where are you coming from?', exact: true }).fill('San Diego Central Library');
  await page.getByRole('listbox').getByRole('option', { name: addressName, exact: true }).click();
  await page.getByRole('button', { name: 'Save my location', exact: true }).click();
  await page.getByRole('button', { name: 'Save my location', exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Verification organizer', exact: true }).waitFor();
  ```
  Verify the saved address in the person's card and in a second loaded event. Repeat from the landing optional field as a distinct entry.
- **Validate then add.** The blank submit exposes field errors without adding a person.
  ```js
  await page.getByRole('button', { name: 'Add Participant', exact: true }).click();
  await page.getByRole('button', { name: 'Add Participant', exact: true }).click();
  await page.getByText('Name is required', { exact: true }).waitFor();
  await page.getByText('Address is required', { exact: true }).waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Verification friend');
  await page.getByRole('combobox', { name: 'Starting location', exact: true }).fill('Balboa Park San Diego');
  await page.getByRole('listbox').getByRole('option', { name: addressName, exact: true }).click();
  await page.getByRole('switch', { name: 'Hide exact address', exact: true }).click();
  assert.equal(await page.getByRole('switch', { name: 'Hide exact address', exact: true }).getAttribute('aria-checked'), 'true');
  await page.getByRole('button', { name: 'Add Participant', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Verification friend added. Add the next person, or tap Done.' }).waitFor();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByText('Approximate location', { exact: true }).waitFor();
  ```
- **Random/default/location entries.** In an open form run `await page.getByRole('button', { name: 'Generate random name', exact: true }).click(); assert((await page.getByLabel('Name', { exact: true }).inputValue()).length > 0);`. For `Use Default Address`, assert the combobox equals the address saved through account settings. `Use my current location` requires granted browser permission and an actual location; verify its resulting address and successful save. A denied-permission case should visibly report `Location access is blocked. Allow it in your browser settings, or type an address.`
- **Guest join.** Visit the shared URL in the fresh context, click `Join Event`, fill `Name` with `Verification guest`, select a real `Starting location` suggestion, then click `Add Participant`. Wait for `Edit Verification guest` and assert `Join Event` is absent. Reload the guest and organizer pages; both must show the guest. Also prove the organizer sees the new guest without reloading for `participant-live`.
- **Edit without reselecting the saved address.** Hover the name before the action because desktop controls reveal on hover.
  ```js
  await page.getByText('Verification friend', { exact: true }).hover();
  await page.getByRole('button', { name: 'Edit Verification friend', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Verification renamed');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Verification renamed', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Verification renamed', { exact: true }).waitFor();
  ```
  Separately change the address and select a new suggestion, then change privacy and verify both views display the new visibility. Test `Cancel`, `Close`, and Escape without persisting a draft.
- **Remove and leave.** Hover `Verification renamed`, click `Remove Verification renamed`, assert the `Delete Participant` heading, then click `Delete` and wait for the person's name to disappear. For the guest use `Remove Verification guest`, assert `Leave Event`, click `Leave`, and wait for `Join Event` to return. Reload both views to confirm removal.

## Gotchas

- Current organizer additions leave the form open; old recipes that expect it to close miss the new consecutive-add flow. Guests still exit the form after joining.
- Typing an address invalidates its previous selection. Editing only the name or privacy keeps an unchanged saved address valid, unlike earlier behavior.
- Form submission sends the address for server geocoding. Browser autocomplete success alone does not prove the server key works.
- Address privacy must be checked from another person's browser. A label saying `Approximate location` alone does not prove exact coordinates were withheld.
- Public fuzzy participant responses contain `address: null` and the persisted displaced point. The participant's own `/me` response supplies the original address to local editor state. An unchanged PATCH omits `address`; an organizer editing another hidden location may leave it blank to preserve it.
- The migration preserves the existing organizer permission to change another participant's location or privacy. Public address redaction does not revoke that permission. Imported coordinates keep their existing meaning; new displacement is generated only when the saved location or privacy changes.
- Published events disable joining/adding and hide edit/remove controls. Avoid deleting the organizer while testing ordinary participant removal.
