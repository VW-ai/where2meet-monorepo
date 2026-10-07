# CI verification

`Server CI` runs the complete PR suite and reports one terminal check, `CI required`. Its PR trigger has no path filter, so any file change in a same-repository PR runs the local jobs and then staging acceptance. The staging job deploys the tested merge revision. `CI required` accepts a PR only when that staging job succeeds. A failed, canceled, skipped, or missing staging result blocks a PR. Push, merge-group, and manual CI runs skip staging. The staging job alone receives `RAILWAY_STAGING`; the other PR jobs do not receive Railway credentials. Fork PRs cannot pass this staging gate.

The suite checks these boundaries:

| Check | What it proves |
| --- | --- |
| Server quality and build | Types, module ownership, lint, formatting, compilation, and the Railway Docker image build. |
| Server tests | HTTP behavior, persistence, and migrations against PostgreSQL 17 and 18. This covers both current database majors, not complete production runtime parity. |
| Client quality and build | Types, lint, tests, the production bundle, and the production-mode disposable staging frontend image. The ordinary bundle's mock configuration is separate from browser acceptance. |
| Candidate frontend | The proposed frontend exercises the event lifecycle and accounts in separate isolated runs against the compiled backend, with mocks off. |
| Fixed frontend | Frontend `05e6daa2245e31dfd142768b545b74cdb9a51476` works with the proposed compiled backend. Changing both sides cannot silently replace this contract. |
| Workflow and policy checks | Workflow syntax, embedded scripts, staging browser safety checks, and rejection of incomplete or inconsistent CI evidence. |
| Railway staging | The current PR test merge revision is deployed to the fixed staging backend and exercised by a disposable frontend container on the runner. This covers the no-location event lifecycle only. |

Browser acceptance covers the no-location event lifecycle and account registration, claims, session restoration, profile preferences and sign-in/out. The fixed frontend remains the event-lifecycle compatibility baseline; corrected account consumption runs on the candidate frontend. The account job also tests bounded PPE cleanup against its own local database and preserves an unrelated account. A separate Settings component test uses explicit transport faults to check cancelled saves and failed logout; it records `accounts-ui-races.json` and cannot replace real-backend evidence. Google behavior and unimplemented operations remain outside that proof. See [verification coverage](../.agents/skills/verify-where2meet/verification-status.md).

## Read a run

Read `CI required`, then inspect any failed dependency. Browser artifacts retain the observed backend and frontend commits, browser result, and cleanup result on both success and failure. Their names distinguish the frontend case, scenario and workflow attempt. The evidence gate rejects a result for a different scenario or source revision. Raw browser storage and `run.json` are not uploaded.

On pull requests, the backend checkout is GitHub's test merge commit. It differs from the proposal's head commit. Before upload and after acceptance, the staging policy queries the live PR and requires its head, base, and test merge revision to match the run. The evidence policy compares the actual tested commits with the expected backend and frontend commits. An older successful artifact cannot replace a current failed result. Staging jobs serialize against both PR and post-merge runs. A newer request cannot cancel a running job, but GitHub may replace an older pending job; rerun a PR whose staging job was canceled while waiting.

Run the complete `Server CI` workflow when repeating acceptance. A separately dispatched child workflow is diagnostic and does not replace the complete gate. Workflow lint also runs independently for workflow changes so malformed orchestration can still receive a diagnostic check.

## Required merge checks on `main`

`main` branch protection requires `CI required` from GitHub Actions, requires a PR to be up to date with `main`, and applies the rule to administrators. The staging acceptance workflow is still on the unmerged migration stack. PRs #17–#19 and #10 do not emit `CI required`, so they cannot merge into `main` under this rule until their branches are updated and the check runs. PRs #20–#37 have an earlier check with the same name; its success alone does not prove the staging acceptance added in this PR. Inspect the workflow run before merging any migration PR.

Once this workflow reaches `main`, verify that a same-repository PR runs the complete `Server CI` workflow and that a missing or failing `CI required` blocks merging. Do not accept individual child checks as substitutes.

GitHub documents why dependent required checks need `always()` and why path-filtered workflows can leave required checks pending in [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## Deployment boundaries

The staging CD workflow is also called by same-repository PR CI after local checks. Its existing post-merge path still accepts only a successful `Server CI` push for the current `main` commit. It checks Railway environment and data-resource ownership and requires the staging backend to have no path filter before uploading. This lets a PR that changes any file, or a rerun of the same revision, produce a new deployment. It observes the exact active deployment and tests a production-built frontend container on the CI runner against the staging backend. Its browser evidence proves the listed no-location event lifecycle and exact cleanup. A hosted frontend or Vercel preview is not used for this gate. See [the staging recipe](../server/docs/DEPLOYMENT.md).

Run the staging preflight before the first deployment and after Railway configuration changes. A green `CI required` result on a same-repository PR includes staging acceptance for the listed no-location lifecycle; individual local checks do not. Inspect the staging artifact for the exact deployment and cleanup evidence. Production CD remains manually controlled and does not yet consume staging evidence. Backend acceptance still follows the [PPE verification recipe](../.agents/skills/verify-where2meet/ppe.md); historical-data import needs its separate proof.
