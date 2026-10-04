# Gates — the definition of landed

One instrument answers "is this tip landable": the gates in
`gates/manifest.json`, run by `gates/run.mjs`, receipted under
`gates/receipts/`. Every gate is **derived from a GitHub Actions workflow**
with provenance recorded on the entry — CI and the local runner execute the
same commands, so a green landing receipt means no CI surprise on the covered
surface.

## The law

1. **Land continuously.** A branch lives hours, not days. Convergence work
   shrinks to near-zero when integration is constant; it compounds when work
   batches.
2. **A tip is landed** when `main` contains it and the landing-tier receipt is
   green **at that exact tip**. Installs, snapshots and physical acceptance
   are separate concerns — they never gate a landing.
3. **Never discover from remote CI what you can prove locally.** The pre-push
   guard refuses a push toward `main` whose tip has no green landing receipt.
4. **Honest receipts.** `ci-only` gates are never executed locally; every
   receipt names them as deferred, so green never overclaims.
5. **Escape hatches are named, rare, and recorded.** `git push --no-verify`
   or `git config central.gates off` — when used, say so in the handoff and
   why.

## Usage

```bash
node gates/run.mjs landing            # the landing tier (~minutes, serialised)
node gates/run.mjs walks              # long acceptance walks (shell/walk surfaces)
node gates/run.mjs status             # convergence pressure of every worktree
node gates/run.mjs landing --only cradle-tsc,rust-format-cli
node gates/run.mjs landing --skip site-contracts --keep-going --json
```

- Failures log to `gates/receipts/logs/<run>/<gate>.log`.
- Receipts: `gates/receipts/latest-landing.json` (and timestamped copies),
  schema `oi.gate-run/v1` — head sha, dirty flag, per-gate exit/duration,
  and the `deferred_to_ci` list.
- `status` simulates each worktree's merge into `origin/main` (`git
  merge-tree`) and names conflicting files **while you work** — convergence
  pressure you can see before it becomes a merge war.

## Tiers

- **landing** — the correctness floor, minutes, serialised: source-marker
  guard, rust format/clippy/kernel tests/hosted contracts, suite-data
  collation, tsc, the full node suite, conformance, appearance battery,
  the browser contracts that have caught real regressions, the production
  build, and the site/publication contract tests. **Required before push.**
- **walks** — the acceptance walks and wide browser batteries. Required when
  the change touches shell, walk scenarios, or spans surfaces; their
  receipts are committed evidence.
- **ci-only** — owner-checkout builds, embedded/native suites, live
  SpaceTimeDB, evidence packaging, release targets. CI's job; never faked
  locally.

## Relationship to CI

The workflows under `.github/workflows/` remain the authority for
`ci-only` surfaces. For the landing tier, this manifest is the source: when
a workflow's command changes, change the gate here in the same commit (the
provenance field makes drift reviewable). A gate that CI no longer runs, or
a CI step no gate covers, is a recording error — fix the recording, not the
expectation.

## Adding or changing a gate

1. Change the command in the workflow first, or in the same commit.
2. Update `gates/manifest.json` — command, provenance, tier.
3. Tier by cost and locality: does it need runners, pinned owner checkouts,
   other machines, or live services? Then it is `ci-only`.
4. If a gate cannot pass locally for environmental reasons, it belongs in
   `ci-only` **with the reason on the entry** — never weakened, never
   silently skipped.

## Genuine native FIELD test input

The regular kernel suite requires `OI_NATIVE_DENSE_FIELD_SOURCE_ARTIFACT`.
The hosted full-kernel workflows run the common
`.github/actions/native-dense-field-source` prerequisite before their original
commands. It builds the actual C/C++ worker and runs the maintained QL FieldHost
producer, preserving all 65000 original samples and its later-basis assertions.
The source, worker, execution log and original artifact are retained together.

For an existing exact QL producer checkout, the same preparation is:

```bash
python3 gates/prepare-native-dense-field-source.py \
  --ql-source /path/to/QL-MEF \
  --expected-revision <exact-owner-commit> \
  --output-base /path/to/task-evidence
```

Use the emitted artifact path as `OI_NATIVE_DENSE_FIELD_SOURCE_ARTIFACT` for
the unchanged kernel tests or landing runner. The script requires the actual
native compiler toolchain and json-c development library; it never supplies
a substitute JSON fixture. It qualifies codec input only. A producer leaf
passing does not qualify the complete QL suite, a selected World/Scene,
private authority, liveness, installed rendering or two-human experience.
The action records its exact producer pin and its qualification scope; the
production browser adapter provenance and native operation owners stay separate.

Preparation reuses the maintained native acceptance process-custody helper.
Each actual command has a finite budget and a receipt saved before launch;
partial logs and exact owned-group retirement remain available on failure.
Unobserved retirement refuses prerequisite success. These controls run in the
hosted job; they do not inspect or signal unrelated application processes.
