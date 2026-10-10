# CI

One gate. The block below lists the principal workflows; additional
path-scoped surface and evidence workflows run under the same rules.

```text
verify.yml            the only pull-request gate; also runs on push to main
desktop.yml           desktop surface, path-scoped (kernel crate, cradle build, Tauri check)
site.yml              site build; deploys to Pages on push to main
shared-field.yml      shared-field contracts and the live SpaceTimeDB acceptance
npm-distribution.yml  npm package install proof, path-scoped to packages/oi-cli
release.yml           attested artifacts from main (oi binary, npm package, desktop bundle)
cross-product.yml     weekly + on demand: every check that builds/tests a sibling repo
npm-publish.yml       manual publish
branch-hygiene.yml    weekly branch lifecycle report
```

Rules:

- **One gate, once.** A change is gated by `verify.yml` on its pull request. Nothing else re-runs the CLI format/lint/test on the same bytes. The push-to-main run of `verify.yml` exists to catch merge skew, not to re-prove the PR.
- **A workflow runs only what is uniquely its own.** If a check is a subset of `verify.yml`, it does not get a second workflow. Surface workflows (desktop, site, shared-field, npm) are path-scoped and never build the CLI. The collection source-identity checks fold this way: the consumer and production-Library regressions run in `desktop.yml`, and the pinned-Central native source/CAS/restart proof in `cross-product.yml` — there is no separate collection workflow.
- **Siblings gate themselves.** Central, AIKit, Actuation, Factory, Workcell and Quaternal Logic each gate their own main. O:I checks out, builds or tests a sibling only in `cross-product.yml`, weekly. A red job there is a rotted pin or a moved seam; it is repaired in its own change.
- **Docs do not trigger the gate.** `docs/**`, `**.md`, the essay tree and the ProjectCentral field are ignored by `verify.yml`.
- **Release is not a gate.** `release.yml` builds from main after the gate passed; it does not test again.
- **CI cannot claim human acceptance, and fixtures are not provider proofs.** Nothing here sets a human or provider evidence grade; `oi prove factory` records those grades as unavailable unless a real owner receipt is supplied (see `docs/FACTORY-PROVING-FLOOR.md`).

Local preflight: `oi dev gate PRODUCT` builds an isolated candidate and runs the owner and Cradle consumer tests. It is a convenience before pushing, not a second requirement; CI is the record.

For a task spanning repertoire composition, native collaboration and Factory
delivery, `cross-product.yml` accepts `focused-development=true` with exact
40-character `ai-kit-revision` and `factory-revision` inputs, and an explicit
`workcell-revision` when material execution is part of the selected proof.
The focused job confirms every selected checked-out revision before executing the owners' repertoire,
projection, generation, existing TUI application, handoff, team and delivery regressions. It also exercises
peer retention against Pi 0.84.4's actual session implementation. Its artifact
contains the requested and observed commits, Git trees, lockfile and binary
hashes, run/attempt identity and test logs. Native build stamps are pinned to the
requested cuts and checked against the compiled binaries' reported versions;
`build-versions.json` preserves that readback beside `source-build-cut.json`.
A restored binary with a mismatched stamp fails the required job.
Rust filters must report nonzero passed tests for every selected owner target;
an empty filter is not verification evidence. A selected Workcell cut builds
its actual native guardian binary and tests finite server grants, durable
execution/restart, owner and guardian crashes, process retirement, and bounded
native HTTP. Three separate-process CLI cases exercise the actual native grant,
one material effect, exact replay, immutable-material refusal, host lease and
restart after canonical release before compatibility-receipt publication. The
focused job requires all three cases to execute. Factory's delivery, native owner and dispatch gates include the
source-bound no-delivery recovery. Explicit live-provider cases remain separate
from these native deterministic checks.
Ordinary scheduled and manual suite
runs keep their existing jobs; focused dispatch selects only this job.

```sh
gh workflow run cross-product.yml --repo EpiLogos/O-I --ref TASK_BRANCH \
  -f focused-development=true -f ai-kit-revision=AIKIT_COMMIT \
  -f factory-revision=FACTORY_COMMIT -f workcell-revision=WORKCELL_COMMIT
```

Dispatch and artifact presence are not readiness. Factory rereads the selected
hosted run and required checks against the exact candidate revision and Git
tree, alongside independent review and native publication readback. The
focused job records deterministic owner execution; provider inference and
physical Workcell acceptance require their own observed owner evidence. The
optional Workcell source selection participates in Factory's full cross-owner
fingerprint only when present; a two-owner fingerprint cannot attest to it.
The actual Task/material receipt must also identify the Workcell executable
used by the live operation. A settled failed hosted result can retain an
immutable source/build witness for a bounded repair, including a missing binary
when compilation failed. It is not successful verification or readiness.

Consume: the next local session refreshes the accepted source and rebuilds or rebinds the executable it will actually use (`oi dev sync`, `oi dev build`, `oi dev install`). `suite/mainline.json` is the recorded cut an install was made from, a receipt; it is checked for structure in `verify.yml` and is not required to equal every sibling's live main (`verify-mainline-snapshot.py --live` remains a manual comparison).

Adding a check: put it in the job of `verify.yml` that already has its toolchain, or in `cross-product.yml` if it needs another repository. Do not add a workflow.
