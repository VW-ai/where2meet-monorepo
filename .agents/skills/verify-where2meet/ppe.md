# Verify a backend change in Railway PPE

Use this recipe after deploying the candidate to the dedicated `ppe` environment. Deployments need the user's existing authorization. Verification does not deploy, merge, change CORS, import data, or manage Railway resources.

## Prepare the target

Read [the Railway setup](../../../server/docs/railway-ppe.md). Record the exact backend deployment, uploaded source revision and archive digest, fixed frontend revision, service IDs, and origins in a `where2meet-ppe-target-v1` manifest. Copy the shape from [the recorded target](../../../server/docs/ppe-target.json), then obtain fresh deployment metadata. Do not change the target while a run is active.

The verifier accepts only the recorded project and independent PPE environment. It checks the actual service instances, active backend deployment, domain mapping, CORS, and database/Redis references. A target that merely has `ppe` in its URL is insufficient. Replacing a deployment invalidates an active run. Start a fresh run with new evidence after a deployment changes.

PPE database checks use authenticated native SSH to the verified PostgreSQL service instance. Supply a registered private key through `PPE_SSH_KEY` and an established known-host file through `PPE_SSH_KNOWN_HOSTS`. Keep both outside the repository. The verifier requires host verification and uses fixed read-only projections. The accounts scenario additionally has a fixed transaction to remove its recorded synthetic account after its meetings are absent. It does not accept arbitrary SQL or open database ports, register keys, or accept new host keys. Remove a temporary verification key after the run and any cleanup retries complete.

Prerequisites are Python 3, Node LTS, npm, Git, Railway CLI with read access to the target, OpenSSH, and Google Chrome. Port ownership checks use `ss` on Linux and `lsof` on macOS. No local PostgreSQL or Redis server is needed. Use a clean frontend checkout and leave `http://127.0.0.1:4317` free. Its CORS origin must already be configured in PPE.

## Run and keep evidence

Run from the monorepo containing these verification helpers. Supply absolute paths for `PPE_TARGET`, `PPE_BACKEND`, `PPE_FRONTEND`, and `PPE_RUN`. The backend checkout must match the deployed source revision in the target; the helper checkout can be newer. Keep private SSH paths in the environment, never in the target JSON or evidence.

```sh
python3 .agents/skills/verify-where2meet/helpers/ppe.py verify \
  --target "$PPE_TARGET" --repo "$PPE_BACKEND" \
  --frontend-repo "$PPE_FRONTEND" --run "$PPE_RUN"
```

The verifier copies the fixed frontend without `.env` files, installs locked dependencies, disables mocks, and starts Next on the recorded loopback origin. Both browser API calls and Next's server proxy use the same PPE backend. It runs the shared browser lifecycle and remote boundary assertions, corroborates state with read-only database results, and stops its own local processes.

For participant changes, add `--scenario participants` and supply `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` through the process environment. The identified PPE backend must already have its own `GOOGLE_MAPS_API_KEY`. Inject the authorized Doppler key without writing its value into the target or evidence. The helper records presence only. It keeps the default no-location lifecycle available without Google credentials.

The participant scenario adds real autocomplete and geocoding, separate-browser joining, tokenless organizer additions, edits, public fuzzy-address redaction, private own-address reads, live membership updates, removal and leaving. It records created participant IDs before allowing their PATCH or DELETE requests. Only the UI may create test participants, inside the run's exact synthetic event. Use the corrected M2 frontend for this scenario. The original `05e6daa` pin remains the no-location compatibility baseline; it cannot correctly edit a newly redacted fuzzy address.

For accounts, add `--scenario accounts` and use the corrected M2 frontend. The driver creates one synthetic email account and two named organizer meetings through the UI. It checks anonymous creation followed by registration and claim, signed-in creation, reload, profile save and cancel, logout and login, retained organizer access, and a fresh device's public-only meeting view. No Google key is needed for these no-address actions. The request guard binds cookies to sessions issued to this run's account, restricts claims to its recorded meeting credentials, and rejects API redirects. The Next proxy must also reject downstream redirects; browser interception alone cannot prove that hop.

The driver reads the real browser cookie jar and selects only `session_token` for the exact frontend hostname and `/` path. Chrome sends Secure cookies to its trusted loopback origin, while Playwright's HTTP URL filter and API request context can omit them. Explicit verifier reads therefore attach that existing cookie only to the frontend proxy origin; meeting requests to Railway do not receive it. PPE requires the observed cookie to remain Secure. The local cookie transport fixture in the main skill checks this behavior without weakening cookie attributes.

Inspect the run's `evidence/result.json`, boundary results, state snapshots, network destinations, identity checks, and cleanup result. An assertion failure remains FAIL after successful cleanup. Keep failed attempts when a later fix passes. Do not publish raw browser storage, credentials, or query strings.

For an interrupted run, retry only its recorded synthetic-event cleanup:

```sh
python3 .agents/skills/verify-where2meet/helpers/ppe.py cleanup --run "$PPE_RUN"
```

Cleanup checks target identity and deletes only events recorded from this run's successful UI creation. The accounts scenario then checks the account's exact ID, email, creation receipt, identity and database dependencies before deleting that one synthetic account and its sessions. Any remaining account-to-event relationship prevents deletion. Its private journal supports a retry and stays on disk when cleanup is incomplete. It never selects events by title prefix, deletes a Railway service, or resets a database. If identity or ownership cannot be proved, retain the run and report the exact residual IDs. Do not mark cleanup complete while data remains.

## Add behavior at a domain boundary

Trace the affected public request to its owning domain and name the observable change before changing the test. Add the smallest assertion that would fail if that behavior regressed.

| Boundary | Example result to assert |
| --- | --- |
| HTTP to Meetings | Invalid input returns 400 without creating or changing an event. |
| Credentials to Meetings | Missing or cross-event credentials cannot edit the target; its stored state remains unchanged. |
| Meetings to persistence | A UI title edit survives reload and matches the stored row; deletion removes the event and its dependent rows. |
| Meetings to realtime | An authenticated stream receives the notice for a completed edit; the observable payload matches the contract. |
| Accounts to callers | A missing or invalid session stays unauthorized. Expired-session tests own their fixture because the read can delete an expired row. |
| Places to a provider | Keep provider failure and partial-result assertions at that provider boundary when the feature is implemented. Label fixtures separately from real Google evidence. |

Keep fast domain/HTTP tests in `server/tests/integration.test.ts` and browser-visible behavior in the shared driver. PPE-specific request and ownership assertions belong in the PPE driver. Run tool guard tests in CI without Railway credentials. A new endpoint needs its success and relevant rejection outcomes, not a test for each internal helper or a repository call-count assertion.

CI currently runs local compatibility and verifier guard tests. This recipe supplies remote evidence explicitly; it is not an automatic staging deployment or production promotion gate. A later release gate must bind its PASS artifact to the exact deployed commit and fail when evidence is absent.

## Interpret a result

A successful default run proves the listed M1 lifecycle against this PPE deployment through a local Next development server. The participant and accounts scenarios prove only the behavior recorded in their `result.json` and state observations. The accounts scenario exercises production Secure cookies through the actual loopback Next proxy. This does not establish hosted cross-site cookie behavior. None of these scenarios proves frontend production hosting, old-data import, or unimplemented operations. See [recorded coverage](verification-status.md).

Source provenance is setup-attested: the deployer records the clean Git archive and Railway image digest. The verifier compares that record and the source-revision variable with the control plane. It does not independently attest running binary contents. Pre/post deployment checks detect drift but do not atomically pin every HTTP request. Keep a single deployer and no automatic PPE rollout during verification; rerun if deployment identity changes.
