# Continuous-work proving — #220 / #201–#205

This lane supplies maintained governance and executable acceptance machinery. It does not gate product lanes A–D, replace their native operations, edit the desktop implementation, adopt private Control, or declare the whole feature usable.

## Run the current campaign

Use Python 3.11 or later, Git, and the native Rust toolchain needed by the product checkouts. Keep the checkout and evidence directories separate. Start in a **clean checkout of this PR**; use a separate worktree rather than disrupting another coding lane.

The no-bindings command is useful immediately. It executes both campaign entry points and writes all 28 pending cases; it deliberately exits **2**, not zero:

```sh
export PYTHONDONTWRITEBYTECODE=1
python3 -m unittest discover -s tests/continuous-work -p 'test_*.py' -v
python3 scripts/caw_campaign.py plan --output /tmp/caw-plan.json
python3 scripts/caw_local.py --output /tmp/caw-unbound
```

Every output path must be new. Exit **1** is an observed failure; **2** is an incomplete required proof. A subset such as `--case P13` changes what is executed, never what parent #201 requires. A green machinery test is not a green feature verdict.

### Native binary campaign

The maintained source cut is `tests/continuous-work/sources/lock.json`. The following commands use existing clean owner checkouts, not the user's installed Control. Set these paths to the intended checkouts and inspect their revisions against the lock before building. Do not check out revisions in another lane's active worktree.

```sh
export OI="$PWD"
export CENTRAL="$(cd ../Central && pwd)"
export AIKIT="$(cd ../ai-kit && pwd)"
export FACTORY="$(cd ../Factory && pwd)"
export EVIDENCE="$(mktemp -d "${TMPDIR:-/tmp}/caw.XXXXXXXX")"
export PYTHONDONTWRITEBYTECODE=1

python3 - <<'PY'
import json, os, subprocess
cut=json.load(open('tests/continuous-work/sources/lock.json'))['controlled_native_cut']
for owner in ('central','aikit','factory'):
    root=os.environ[owner.upper()]
    head=subprocess.check_output(['git','-C',root,'rev-parse','HEAD'], text=True).strip()
    assert head==cut[owner], (owner, head, cut[owner])
    assert not subprocess.check_output(['git','-C',root,'status','--porcelain'], text=True), owner
PY

cargo test --locked --manifest-path "$OI/cli/Cargo.toml" --test continuous_work_governance --test suite_skillset
cargo build --locked --manifest-path "$OI/cli/Cargo.toml" --bin oi
cargo build --locked --manifest-path "$CENTRAL/ctrl/Cargo.toml" --bin ctrl
cargo build --locked --manifest-path "$AIKIT/Cargo.toml" --bin aikit
cargo build --locked --manifest-path "$FACTORY/factory/Cargo.toml" --bin factory

python3 scripts/caw_bind.py \
  --entry oi "$OI/cli/target/debug/oi" "$OI" \
  --entry central "$CENTRAL/target/debug/ctrl" "$CENTRAL" \
  --entry aikit "$AIKIT/target/debug/aikit" "$AIKIT" \
  --entry factory "$FACTORY/target/debug/factory" "$FACTORY" \
  --output "$EVIDENCE/bindings.json"

python3 scripts/caw_local.py --bindings "$EVIDENCE/bindings.json" --output "$EVIDENCE/run"
# Expected: 2 while essential joins and live/human proof remain pending.
python3 scripts/caw_campaign.py export --evidence "$EVIDENCE/run" --output "$EVIDENCE/shareable.json"
```

With `CARGO_TARGET_DIR` or a non-default build layout, bind the actual regular executable paths instead. The binding records both executable hashes and clean source revisions. A declared association does not itself prove a binary's provenance: retain the actual build logs, as the workflow does. Native execution rechecks both before and after every operation. No executable-name PATH fallback is used; the controlled O:I subprocess PATH contains only explicit native-owner bindings and system tools.

`caw_local.py` attempts the profile and Factory campaigns independently. A profile failure cannot suppress an available Factory probe. It verifies their captured artifacts, remaps actual command IDs, and writes a single all-parent report. It has no command for importing a self-authored `passed` receipt.

## What the implemented probes actually establish

The Rust test uses the existing SuiteSkillSet resolver and native guardian materialisation. Both ordinary coding/verifier roles must resolve the required suite-operator and receive its exact full governance bytes in both shipped harness trees. Removing membership, source or the materialised body must fail. Local edits are preserved and block uptake rather than being overwritten.

The cross-product profile campaign uses actual `oi init --personal-ground`, `ctrl`, and AIKit's native adoption/set/apply path. In two separate fresh Worlds it applies coding and verifier PoolPatches, reads the committed **current** generation, disconnects the Skill, and reconnects it. All phases use one explicitly bound native context per role. An old generation, another context, a capsule-store copy or an apply receipt alone cannot establish delivery. This is controlled native D/C projection evidence, not evidence that a live coding model or verifier harness actually loaded the Skill.

The Factory probe uses the existing native `development commission` and `commission-read` operations with the owner's genuine commission request fixture. The state must be absent initially; the producer must create it; a separate native readback must return the exact request. In a second fresh World the producer is omitted and the connection must fail. This proves **Commission publication only**, not a worker's execution, a passed verification, self-hosting, or a completed task.

The existing `scripts/validate_factory_proving.py` / `oi prove factory` floor is retained, including its own bounded source cut. Do not relabel its older receipts as current CAW execution.

## Extending a join without replacing the runtime

`tests/continuous-work/cases.json` contains the full P01–P28 obligation/grade ledger. `joins.json` names exact required owner operations and separate LOCAL PROOF cases. `native-probes.json` is an explicit native argv plan, not an alternative operation runtime. New recipes must refer to an existing parent obligation, cite the published owner contract/source, declare an actual producer and public readback, start in a fresh controlled World, and name the producer removed by the disconnection canary. A producer's own success JSON is not public readback.

As an owner publishes an operation, inspect its actual CLI/API contract and fixtures, add the appropriate command plan and consequential failure test, and update the source/contract cut together. Test failures are not grounds to weaken the parent's obligations. Revisions are deliberately explicit: selecting the latest binary accidentally is not consolidation.

Native recipes are bounded to D/C. Provider, installed-material and human grades are not minted from a directory name or a JSON assertion. P/M/H require the actual owner operations and real observation conditions; fresh independent full-path verification remains mandatory. Missing operations remain pending with their native owner, even when this infrastructure passes. Do not manufacture an execution shim to fill a missing join.

## Evidence, privacy and local work

Each campaign creates a new private directory, captures exact native argv privately, process exit/timing, executable/source hashes and stdout/stderr fingerprints. Timeouts are failures with uncertain effects, not retry permission. Evidence is append-only. Export rechecks raw output hashes and emits fingerprint-only metadata; no raw output, argv, personal source or credentials are included. Review the export before publishing it. These are local integrity records, not cryptographic attestations against a malicious operator.

The commands above do **not** install host hooks, use provider credentials, launch real harnesses, migrate personal material or create a second deployment. Their automation currently stops at the specific unjoined owner operations, not at a general local-testing wait. The later installed campaign needs actual authorised credentials, two supported harnesses, owner-approved disposable root/Project canaries, published placement/time policy, native Workcell lifecycle operations, reviewed reversible migration and real human assessment. `joins.json` retains those cases separately. Never run a producer-omission canary against live personal work.

The governance's supplied draft standing is preserved in the maintained Skill. Operational use under this commission is not private governance adoption or human Recognition. Original HTML/template bytes and the archive protocol remain distinct pending fidelity inputs; the recovered CT4b field map is indexed source text, not original-byte proof.

## Verification and coordination

`.github/workflows/continuous-work-proving.yml` runs mechanics, the actual native Rust tests and the exact-owner binary campaign. Its required bounded observations must succeed and detect disconnection; the summary still states **P01–P28 PENDING**. Missing binaries never turn a required native observation into a successful skip.

Source ownership for this lane is the suite-operator Skill, additive proving scripts/tests, source ledger and this workflow/runbook. Desktop #190, shared session/composition code and private Control remain outside these edits. Feature closure additionally requires a fresh non-implementer to run the complete usable story and consequential failure/recovery path at all required evidence grades. Nothing here self-issues that verdict.
