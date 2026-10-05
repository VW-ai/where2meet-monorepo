# Email accounts and meeting claims

Accounts owns registration, login, sessions and profile changes. Meetings owns the relationship between an account and an event. Both modules expose complete operations; the HTTP adapter validates request bodies and returns the existing JSON shapes. No schema change, gateway or call to the old service is required.

## Identity and session compatibility

Registration creates the user, email identity and session atomically. Email is normalized after syntax validation. Password hashing uses bcrypt at cost 12, and login compares existing bcrypt hashes without rewriting them. Import preserves original IDs, password hashes and session hashes.

Each login creates an independent seven-day session. Only the hash is stored. Session reads do not renew expiry, and expired sessions return 401. Logout revokes only the presented session and clears its cookie. An absent or already revoked session can be logged out again. A storage failure must not produce a false success.

Cookies retain `HttpOnly`, `SameSite=Lax`, `Path=/` and the seven-day maximum age. Production adds `Secure`. The Next proxy preserves that contract and rejects downstream redirects. Registration and login return `{user}`; profile reads and updates return the user directly. Validation and session error messages may differ from legacy wording, while statuses and error codes retain their contract.

Profile patches update only supplied supported fields. Nullable profile fields can be cleared through HTTP. Profile updates do not change email, passwords, identity records or participant locations. Password recovery and external identities remain unsupported.

## Claim and dashboard compatibility

`POST /api/users/me/events/claim` requires an account session and a valid participant token for the named event. Its 201 response contains `{success, userEvent}`. The role comes from the participant, never the request body. A repeated claim preserves the relationship ID and creation time. An explicit claim with a different valid token can rebind that account's event membership and change its role. Another account cannot take an already linked participant.

Published events remain claimable. Claiming does not mutate the event, participant or credential, and emits no meeting SSE notice. Removing a participant detaches the account link; deleting an event removes its links. Claims recheck authority inside the existing bounded serializable transaction.

`GET /api/users/me/events` returns `{events}` with relationship metadata and a narrow event summary. It omits participant addresses, credentials and votes. Account membership makes an event visible on the dashboard; account cookies do not grant meeting edit or SSE authority. A new device can see the organizer card yet open the public meeting view.

The frontend discovers both organizer and participant credentials, preserves them after a successful claim, and derives pending work from the current account's server memberships. Automatic discovery skips existing memberships, including detached links. Explicit rebinding remains an HTTP operation. Automatic claiming has a ten-second total deadline; failure leaves login successful and the pending event available for retry. Generation checks prevent delayed account work from overwriting a later sign-in.

## Verification

Server HTTP tests use real PostgreSQL and assert response shapes, persistence, session isolation, claims and conflicts at module boundaries. Client tests exercise credential retention and delayed account transitions. The accounts browser scenario covers registration, claims, reload, preferences, logout/login and separate-device limits. CI requires its own scenario result in addition to the existing fixed-frontend lifecycle.

The synthetic migration proof's `--accounts` option logs in with a password issued by the old server before and after restarting the new backend. It checks exact import and retry, original session expiry and repeat claim identity. This is separate from historical production-data migration.

Use the [verification skill](../../.agents/skills/verify-where2meet/SKILL.md) for local runs and its [PPE account scenario](../../.agents/skills/verify-where2meet/ppe.md) for the deployed candidate. A passing local run does not establish PPE or production acceptance. Preserve failed attempts and identify the tested revisions.
