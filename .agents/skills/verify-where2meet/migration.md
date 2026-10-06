# Populated synthetic import rehearsal

This local profile extends the existing exporter and proof commands. For the separately owned Railway variant, follow [remote-import.md](remote-import.md). It uses the unchanged server importer and the real old HTTP API. It does not import historical or production data, change schema, run against Railway, or configure an existing PPE service. A source or unit-test result is not live acceptance; record the actual run separately.

Use Node 24 and the launch prerequisites in [SKILL.md](SKILL.md). Supply the authorized Google development key through the process environment. Both the old fixture and browser hydration require real Google responses. Keep the same key available when the candidate proof restarts its backend. Do not print it or put it in command arguments.

```sh
VERIFY_SKILL="/absolute/path/to/frozen-helper-checkout/.agents/skills/verify-where2meet"
LEGACY_REPO="/absolute/path/to/pinned-old-monorepo"
CANDIDATE_REPO="/absolute/path/to/clean-candidate-monorepo"
FRONTEND_REPO="/absolute/path/to/clean-fixed-frontend-monorepo"
LEGACY_RUN="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-legacy.XXXXXX")"
CANDIDATE_RUN="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-candidate.XXXXXX")"
FIXTURE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/where2meet-private-fixture.XXXXXX")"
PRIVATE_FIXTURE_DIR="$FIXTURE_PARENT/rows"

python3 "$VERIFY_SKILL/helpers/control.py" launch --repo "$LEGACY_REPO" --frontend-repo "$FRONTEND_REPO" --run "$LEGACY_RUN" --schema-mode push --backend-mode source
node "$VERIFY_SKILL/helpers/legacy-fixture.mjs" "$LEGACY_RUN" "$PRIVATE_FIXTURE_DIR" --profile populated-v1
python3 "$VERIFY_SKILL/helpers/control.py" cleanup --run "$LEGACY_RUN"

python3 "$VERIFY_SKILL/helpers/control.py" launch --repo "$CANDIDATE_REPO" --frontend-repo "$FRONTEND_REPO" --run "$CANDIDATE_RUN"
node "$VERIFY_SKILL/helpers/migration-proof.mjs" "$CANDIDATE_RUN" "$PRIVATE_FIXTURE_DIR" --profile populated-v1
```

Stop on any nonzero command and retain its evidence. Require the exporter and candidate result to report `PASS`, plus the owned cleanup result. The old revision is pinned to `5a158d8b2545b1c75628f1d36efb7b9cc0c76de9`. Both app sources must be clean; the fixed frontend is separately recorded by the launcher. Each populated report records SHA-256 identities for its import, controller and request-policy helpers and rejects changes during execution. Freeze those helpers before starting either command. The candidate may be a separate clean checkout from the helper checkout.

The private directory must be new, outside every Git checkout, owned by the current user and mode 0700. Its files are mode 0600. `rows.json`, `credentials.json`, `manifest.json`, and ownership receipts are private; never copy them into ordinary evidence, a PR, logs, or Railway variables. The manifest binds both content digests, source run/revision/fingerprint and exact row IDs. The graph audit reports the first failed model or field boundary without private values. The server importer remains responsible for its complete field schema. An exclusive source-run receipt prevents two exporters from using different bundle paths against the same database. Only an accepted empty source is eligible for automatic exporter cleanup; a failed precondition preserves existing state.

## What this profile proves

The exporter creates exactly two events, three participants, one shared Google Venue, three votes, one account, one email/password identity, two sessions and two account links. Event A has its organizer and guest votes and is published. Event B has one organizer vote and remains open. The same account claims both organizer participants. All success writes use the old HTTP API. The guest uses a synthetic public landmark; the Venue comes from a real search and details response. All three votes precede publication. The only deliberate database edit changes the second API-issued session's expiration to 2000-01-01.

The old publish route starts an unawaited provider upsert. `stop-backend` verifies the recorded process identity and group, stops that owned backend, and retains PostgreSQL for the final RepeatableRead snapshot. Shutdown does not prove promise settlement. The frozen snapshot must itself contain the entire required committed graph. Missing state fails export; the helper never repairs rows. The candidate verifies the cutoff receipt again before importing. Source cleanup can run between export and import.

The candidate must have empty business tables. The underlying importer supports populated targets, but this rehearsal deliberately requires a fresh target so complete table comparisons detect extra rows. A private consumer receipt and candidate receipt are written exclusively before the first import. A second writer is refused.

1. Import once and require the exact inserted counts for all eight models. Compare complete ID sets and every stored field, including hashes, nulls, decimals and timestamps.
2. Import the identical pack again before any auth or browser work. Require zero inserts, exact unchanged counts, and identical full rows. The CLI timeout is 120 seconds, above the importer's unchanged 60-second transaction deadline.
3. Check every original participant token in its own event and require cross-event 403. Check the old valid cookie and expired-cookie 401 without a replacement cookie. Authentication may delete only the manifest's known expired session. Log in with the old password, prove both dashboard links and repeat both claims with their original IDs, roles and timestamps, then log out the new session. All remaining fields must still match.
4. Restart only the owned candidate backend. Repeat complete rows, credentials, account links, publication and per-event vote counts before opening a browser. Do not reimport after the expired session is consumed.
5. Open both original links in separate fresh anonymous contexts. Check accessible and visible titles, participant names, the shared Venue, counts two and one, A's publication badge and disabled Join, and B's enabled Join. Do not inject credentials or click vote controls.
6. Record every successful detail response for the one shared Venue and drain relevant requests. Browser hydration refreshes its provider summary and `updatedAt`. The final row must match an observed response with the schema's decimal precision and relative photo path; ID and creation time remain exact and update time stays within the browser phase. Every other imported field remains exact, apart from the already-consumed expired session. Uncaught page errors or failed required event/vote/detail requests fail the run.

## Failure and cleanup

Once the candidate claims ownership, its `finally` closes browsers, disconnects Prisma, invokes normal owned runtime cleanup, then removes only the receipt-bound private directory. It retains `run.json`, `migration-owner.json`, screenshots, ARIA and safe result/check/cleanup evidence. A failed proof remains failed even when cleanup succeeds. Cleanup refuses changed receipts, unfamiliar files, symlinks, changed file ownership/modes, an active other owner or a competing cleanup. A runtime cleanup failure retains the private bundle.

After an interrupted process exits, use the recorded directories:

```sh
node "$VERIFY_SKILL/helpers/migration-proof.mjs" "$CANDIDATE_RUN" "$PRIVATE_FIXTURE_DIR" --cleanup-only
```

Recovery verifies the prior receipt and never imports. It writes `migration-recovery.json` without changing the failed original result. The candidate receipt precedes the private consumer claim, so recovery can finish that exclusive claim after an interrupted setup; it refuses a different consumer before stopping anything. A narrow Python child holds a nonblocking kernel lock while Node cleans up. The child exits on pipe EOF, including owner death, so an interrupted cleanup can acquire the retained lock file again without deleting another process's lock. A live owner or changed receipt is refused.

If ownership validation fails before a candidate is claimed, the proof records `migration-refused-<pid>.json` and reports caller cleanup required. This cannot overwrite another owner's proof. Run `control.py cleanup` on your candidate and retain the private bundle for inspection. Do not bypass an ownership refusal or delete a runtime while processes remain. Normal retry uses a fresh source fixture and candidate, not an automatic resume. The default exporter/proof and `--accounts` keep their existing caller-owned cleanup behavior.

The Node boundary tests cover graph errors, private bundle tampering, complete row sets, exact importer counts, session deletion, competing ownership, partial-export and failed-import cleanup, and the one-row provider projection. Python cutoff tests use mocked process boundaries; they do not start listeners. Live old-service export, candidate import/restart and both browser links remain a separate acceptance run.
