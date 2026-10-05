# Accounts and claims

An email account keeps meetings on a dashboard and stores a name, default address, and privacy preference. Claiming links participant access to the account. See [recorded coverage](../verification-status.md) for executed paths and failures. Password recovery and external identities have no real backend support.

## Sub-features

- `account-register-login` registers, signs in, restores a session, and signs out.
- `account-protected-dashboard` redirects anonymous visitors and opens a user's event cards.
- `account-settings` saves name/default address/privacy preferences and cancels drafts.
- `account-claim` claims meetings created or joined anonymously in the same browser.
- `account-recovery-limits` records unsupported recovery and identity paths without treating mocks as proof.

## How to get to it (user POV)

- Landing `Account` opens `/auth/signin`; `Sign up` links to `/auth/signup`. Both forms link back to the other and show a home logo link.
- Direct `/dashboard` and `/dashboard/settings` require a session. The signed-in landing `Account` menu exposes `Dashboard`, `Settings`, and `Sign Out`.
- Dashboard header `Settings` opens preferences; its event cards open `/meet/<id>`. `Create New Event` and `Create Your First Event` return to the landing form.
- Dashboard and Settings header `Sign Out` end the session. Settings has `Dashboard`, `Cancel`, and `Save Changes`.
- Settings exposes `Email`, `Name`, the `Enter your default address` combobox, `Use my current location`, and `Use fuzzy location by default`. Joining later exposes `Use Default Address`.
- Signup/signin attempts to claim stored organizer and participant credentials. It waits up to ten seconds before opening the dashboard; failure does not undo login. A remaining `Unclaimed Events Found` banner offers `Claim All <n> Event(s)`. Creating while signed in separately attempts an automatic claim. Successful claims retain meeting credentials.
- Sign-in `Forgot password?` opens `/auth/forgot-password`; a reset link opens `/auth/reset-password?token=…`. `/auth/oauth-mock` exists as a mock screen but is not a production entry point. Google/GitHub buttons and Connected Accounts UI are currently hidden.

## Driving it with Playwright

Preconditions: isolated PostgreSQL, frontend/backend mocks off, a fresh browser context, and a unique disposable email such as `verify-${Date.now()}@example.test`. Keep the chosen `email` and `password` out of published logs. Create one anonymous event through [Event lifecycle](./event-lifecycle.md) before signup to test claims.

- **Protected route and account entry.** `await page.goto(base + '/dashboard'); await page.waitForURL(base + '/auth/signin'); await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();`. Repeat direct `/dashboard/settings`. Separately open `/`, click `Account`, and wait for the same sign-in heading.
- **Register and claim.** Install the response wait before registration, then require the card immediately after navigation. Reload separately to prove persistence.
  ```js
  await page.goto(base + '/auth/signup');
  await page.getByLabel('Name (optional)', { exact: true }).fill('Verification account');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  const claimed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/users/me/events/claim' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  await page.waitForURL(base + '/dashboard');
  assert((await claimed).ok());
  const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Verification meeting', exact: true }) });
  await card.waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'My Events', exact: true }).waitFor();
  await card.waitFor();
  ```
  Open the card in the creating browser and require the organizer `Settings` button after reload. A read-only `/me` and an authenticated SSE connection corroborate retained access. Repeat after anonymous guest joining in another fresh context to cover participant claims. Do not transfer a token between browsers. To prove signed-in creation, create another meeting through the dashboard's creation link, return to the dashboard, and require its card.
- **Validation.** In a fresh signup context submit mismatched passwords and require `Passwords do not match`; use a seven-character password and require `Password must be at least 8 characters`. Browser form validation may stop submission first; record the actual result. No account should appear as logged in.
- **Sign out and sign back in.** Verify session restoration with a reload, then exercise signout.
  ```js
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForURL(base + '/auth/signin');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(base + '/dashboard');
  await page.reload();
  await page.getByRole('heading', { name: 'My Events', exact: true }).waitFor();
  ```
  Repeat signout from Settings and from landing `Account` > `Sign Out`; the landing menu returns to `/`. A separate fresh context must still redirect to sign-in.
- **Preferences.** Name and privacy can be tested without Google. Address selection needs the real autocomplete provider.
  ```js
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Verification renamed account');
  await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).check();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Settings saved successfully!', { exact: true }).waitFor();
  await page.reload();
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Verification renamed account');
  assert(await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).isChecked());
  assert(await page.getByLabel('Email', { exact: true }).isDisabled());
  ```
  For addresses use `page.getByPlaceholder('Enter your default address', { exact: true })`, select the observed `option`, save, reload, and require the address value. Separately use `Use my current location`. After editing a draft, click `Cancel` and reopen Settings to prove saved values remain.
- **Manual claim banner.** If `Unclaimed Events Found` remains after automatic claiming, click `page.getByRole('button', { name: /^Claim All \d+ Events?$/ })`, wait for real claim responses, then reload and open the resulting event card. If automatic claiming leaves no banner, record the manual entry as unverified rather than manufacturing a token.
- **Recovery limitation.** From sign-in click `Forgot password?`, fill `Email`, click `Send Reset Link`, and capture its response/status and visible error. With mocks off, the current backend does not implement `/api/auth/recovery/request` or `/api/auth/recovery/reset`; do not assert `Check your email` or a successful reset. A direct reset URL without a valid token is only a missing-token/error test.

## Gotchas

- Current OAuth buttons and Connected Accounts controls are commented out. Identity listing/unlink and password recovery have mock handlers but no real Fastify endpoints. Mock-only success cannot count as account recovery or provider authentication proof.
- Pending claims derive from the signed-in account's server memberships. A retained token is not automatically pending. Automatic discovery skips an existing membership, including a link detached after participant removal. Rebinding with another valid token is a separate explicit API behavior, covered by HTTP tests.
- A claim timeout leaves a valid account session intact. Verify that later manual retry works and that switching accounts prevents delayed claims or list/profile responses from overwriting the new account's UI. A disappearing banner alone does not prove persistence.
- The default-address label currently lacks a matching input ID; use its exact placeholder. Saving a blank address sends an omitted value, so clearing may retain the saved address. Report the actual reloaded value.
- The participant form currently initializes its privacy switch to false for a new person even if the account prefers fuzzy location. Verify this end-to-end; a saved checkbox does not prove the preference is applied.
- Event cards and claims do not prove cross-device organizer access. Test opening a claimed card from a second freshly signed-in context before claiming that behavior.
