# CI

Nine workflows. One gate.

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
- **A workflow runs only what is uniquely its own.** If a check is a subset of `verify.yml`, it does not get a second workflow. Surface workflows (desktop, site, shared-field, npm) are path-scoped and never build the CLI.
- **Siblings gate themselves.** Central, AIKit, Actuation, Factory, Workcell and Quaternal Logic each gate their own main. O:I checks out, builds or tests a sibling only in `cross-product.yml`, weekly. A red job there is a rotted pin or a moved seam; it is repaired in its own change.
- **Docs do not trigger the gate.** `docs/**`, `**.md`, the essay tree and the ProjectCentral field are ignored by `verify.yml`.
- **Release is not a gate.** `release.yml` builds from main after the gate passed; it does not test again.
- **CI cannot claim human acceptance, and fixtures are not provider proofs.** Nothing here sets a human or provider evidence grade; `oi prove factory` records those grades as unavailable unless a real owner receipt is supplied (see `docs/FACTORY-PROVING-FLOOR.md`).

Local preflight: `oi dev gate PRODUCT` builds an isolated candidate and runs the owner and Cradle consumer tests. It is a convenience before pushing, not a second requirement; CI is the record.

Consume: the next local session refreshes the accepted source and rebuilds or rebinds the executable it will actually use (`oi dev sync`, `oi dev build`, `oi dev install`). `suite/mainline.json` is the recorded cut an install was made from, a receipt; it is checked for structure in `verify.yml` and is not required to equal every sibling's live main (`verify-mainline-snapshot.py --live` remains a manual comparison).

Adding a check: put it in the job of `verify.yml` that already has its toolchain, or in `cross-product.yml` if it needs another repository. Do not add a workflow.
