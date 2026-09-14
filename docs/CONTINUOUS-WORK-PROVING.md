# Continuous-work proving — #220 / #201–#205

This is the maintained governance and acceptance campaign for the single connective implementation session. Missing owner operations are implementation work in that session, not tasks to relay to separate A–E chats. This campaign does not replace native product operations, start another runtime, edit the desktop, adopt private Control, or declare the whole feature usable.

## Run the current campaign

Use Python 3.11 or later, Git, and the native Rust toolchain needed by the product checkouts. Keep source, build and evidence directories separate. Start in a **clean checkout of this PR**; use a separate worktree rather than disrupting another coding lane.

The no-bindings command executes all three campaign entry points and writes all 28 pending cases. It deliberately exits **2**, not zero:

```sh
export PYTHONDONTWRITEBYTECODE=1
python3 -m unittest discover -s tests/continuous-work -p 'test_*.py' -v
python3 scripts/caw_campaign.py plan --output /tmp/caw-plan.json
python3 scripts/caw_local.py --output /tmp/caw-unbound
```

Every output path must be new. Exit **1** is an observed failure; **2** is incomplete required proof. `--case P26` selects execution, never narrows the parent's required feature. A green runner test is not a green feature verdict.

### Build the explicit candidate cut

`tests/continuous-work/sources/lock.json` is the maintained source cut. It explicitly distinguishes unmerged candidates from accepted main. Use clean disposable checkouts at those exact revisions; do not change another lane's working tree or the person's installed configuration.

Set these paths to those checkouts. Keep the normal Cargo target layout for the joined Rust test executable: its compiled `CARGO_BIN_EXE` points at the source-built AIKit session binary in that same checkout. Relocating only a binary does not relocate that build-time reference.

```sh
export OI="$PWD"
export CENTRAL="$(cd ../Central && pwd)"
export AIKIT="$(cd ../ai-kit && pwd)"
export FACTORY="$(cd ../Factory && pwd)"
export WORKCELL="$(cd ../Workcell && pwd)"
export ACTUATION="$(cd ../Actuation && pwd)"
export EVIDENCE="$(mktemp -d "${TMPDIR:-/tmp}/caw.XXXXXXXX")"
export PYTHONDONTWRITEBYTECODE=1

python3 - <<'PY'
import json, os, subprocess
cut=json.load(open('tests/continuous-work/sources/lock.json'))['controlled_native_cut']
for owner in ('central','aikit','factory','workcell','actuation'):
    root=os.environ[owner.upper()]
    head=subprocess.check_output(['git','-C',root,'rev-parse','HEAD'], text=True).strip()
    assert head==cut[owner], (owner, head, cut[owner])
    assert not subprocess.check_output(['git','-C',root,'status','--porcelain'], text=True), owner
PY

cargo test --locked --manifest-path "$OI/cli/Cargo.toml" --test continuous_work_governance --test suite_skillset
cargo build --locked --manifest-path "$OI/cli/Cargo.toml" --bin oi
cargo build --locked --manifest-path "$CENTRAL/ctrl/Cargo.toml" --bin ctrl
cargo build --locked --manifest-path "$AIKIT/Cargo.toml" -p aikit-cli --bins
cargo build --locked --manifest-path "$FACTORY/factory/Cargo.toml" --bin factory
cargo build --locked --manifest-path "$WORKCELL/Cargo.toml" -p epilogos-workcell-cli --bins
cargo build --locked --manifest-path "$ACTUATION/Cargo.toml" -p actuation-cli
cargo test --locked --manifest-path "$AIKIT/Cargo.toml" -p aikit-cli \
  --test caw_task_dispatch --no-run --message-format=json > "$EVIDENCE/task-build.jsonl"

export CAW_TASK_SUITE="$(python3 - "$EVIDENCE/task-build.jsonl" <<'PY'
import json, sys
rows=[json.loads(line) for line in open(sys.argv[1])]
paths=[r['executable'] for r in rows if r.get('reason')=='compiler-artifact'
       and r.get('target',{}).get('name')=='caw_task_dispatch' and r.get('executable')]
assert len(paths)==1
print(paths[0])
PY
)"

python3 scripts/caw_bind.py \
  --entry oi "$OI/cli/target/debug/oi" "$OI" \
  --entry central "$CENTRAL/target/debug/ctrl" "$CENTRAL" \
  --entry aikit "$AIKIT/target/debug/aikit" "$AIKIT" \
  --entry aikit-session-space "$AIKIT/target/debug/aikit-session-space" "$AIKIT" \
  --entry aikit-task-suite "$CAW_TASK_SUITE" "$AIKIT" \
  --entry workcell "$WORKCELL/target/debug/workcell" "$WORKCELL" \
  --entry workcell-control-service "$WORKCELL/target/debug/workcell-control-service" "$WORKCELL" \
  --entry workcell-write-boundary "$WORKCELL/target/debug/workcell-write-boundary" "$WORKCELL" \
  --entry actuation "$ACTUATION/target/debug/actuation" "$ACTUATION" \
  --entry factory "$FACTORY/target/debug/factory" "$FACTORY" \
  --output "$EVIDENCE/bindings.json"

python3 scripts/caw_local.py --bindings "$EVIDENCE/bindings.json" --output "$EVIDENCE/run"
# Expected exit 2 while essential implementation and live/human proof remain pending.
python3 scripts/caw_campaign.py export --evidence "$EVIDENCE/run" --output "$EVIDENCE/shareable.json"
```

Use supported unprivileged Linux for the positive Landlock task suite. Node and Python must be available for native Actuation and controlled protocol children. No commercial-model calls or personal credentials are required. Capture actual build logs as provenance; a declared executable/source association alone does not prove compilation. Native execution checks clean source and executable digests before and after operations.

The script attempts **profiles, native publication probes, and joined tasks independently**. Failure in one must not suppress the others. It checks captured artifacts, remaps actual command IDs and writes one complete parent report. There is no import operation for self-authored `passed` receipts.

## What the executable paths establish

The Rust governance test uses the existing SuiteSkillSet resolver and native guardian materialisation. Both ordinary coding/verifier roles resolve the suite-operator and receive its exact full governance bytes in both shipped harness trees. Removing membership, source or materialised body must fail. Local edits block uptake rather than being overwritten.

The cross-product profile campaign uses actual `oi init --personal-ground`, `ctrl` and AIKit adoption/set/apply in two fresh Worlds. It checks initial withholding, explicitly reviews the controlled revision through the native trust operation, reads the committed **current** generation, disconnects the Skill and reconnects it. Another context, an old generation, capsule bytes or an apply receipt alone do not establish delivered governance. This is controlled native D/C projection, not evidence a live model/harness loaded the Skill.

The Factory probe uses existing `development commission` and `commission-read` with the owner's genuine request fixture. State is absent initially; the producer creates it; separate native readback confirms the exact request. Omitting the producer in a second fresh World must fail. This remains **Commission publication only**, not execution, verification, self-hosting or completed work. The retained Factory pin is not a claim that concurrent Factory #223 attempt developments have been tested. The existing `validate_factory_proving.py` / `oi prove factory` floor retains its own bounded source cut.

### Real task, storage and hosted encounter

`scripts/caw_native_tasks.py` uses the existing CAW Recorder to execute AIKit's **actual source-built seven-case native task suite**. The suite invokes production Central/AIKit/Actuation/Workcell operations, not a shell substitute for those owners. The driver checks the exact test inventory, actual executed counts, no ignored cases and positive markers only emitted after native response assertions.

The path consumes recognised controlled Central policy, allocates the actual task NOW, validates source/cwd/write boundaries, checks actual Agency task authority, prepares native Workcell storage/service bindings, and launches the existing provider under Workcell's real stdio-preserving write boundary. A managed Workcell service runs the actual AIKit encounter owner. Native open/send/response exercises it; a healthy unrelated process cannot satisfy that owner relation.

The seven scenarios include permitted source/T writes and prohibited human/structural writes, exact selected context and actual cwd, wrong cwd and removed NOW, missing authority, actual storage attachment, storage-host restart without duplicate delivery, continued turns, release with historical response/Return preservation, absent or foreign material, forbidden removal of a requirement, and the falsely named healthy host process. Central and Workcell bearer tokens do not reach the controlled provider.

The second campaign invocation runs the exact hosted-encounter scenario in another disposable World with only the **actual Workcell control-service executable removed**. It must fail; successful constant JSON, an absent producer or a no-op test runner cannot satisfy the joined proof. All native binaries and their exact source cuts are rechecked afterward.

Only `P26/native-material-task-public-operation-chain` receives bounded **D/C** for this slice. A task directory is not a complete Candidate/worktree relation. A storage-host restart is not full body-loss recovery, environment continuity or remote relocation. A T artifact is not reviewed Central receiving/inclusion. The reply is controlled ACP, not a commercial model. The test does not confer independent verifier lineage.

## Binding acceptance remains complete

`cases.json` retains P01–P28 and every pre-existing obligation and grade. The four additive named refinements are required within every specified case:

- `candidate-worktree-now`: P13/P14/P18/P19/P26.
- `working-environment-continuity`: P14/P17/P21/P22.
- `assisted-commission`: P07/P08/P21/P22/P23.
- `candidate-comparison`: P13/P18/P21/P22/P23.

Their full requirements stay in the matrix, including dirty human checkout, separate Candidates and attempts, exact source/cwd/test/diff/NOW basis, required/preferred environment and supported fallback, intended Return destination, preserved commissioning intent/context/evidence/bounds, contradictory evidence and independent lineage. Recognition and Git integration remain separate revision-checked operations. Passing the small material obligation does not satisfy those refinements.

`joins.json` distinguishes the now-observed native slice from unfinished owner operations and later LOCAL PROOF. Add a production connection in its owner before testing it. New probes cite actual native contracts, use fresh controlled Worlds, read genuine results and require consequential disconnection. Do not weaken the parent to fit an available fixture or implement missing runtime semantics in the runner.

Catalogue-to-resident selection, gateway/recurrence dispatch, complete Factory attempts/verification/recovery, reviewed receiving/documents, Candidate refinements and remaining source/material recovery remain repository work where unfinished. Installed/human acceptance is not their replacement. Actuation changes stay in #58 and desktop implementation in #190's active Waves 6–8 thread.

## Evidence, privacy and later local work

Every campaign creates a private fresh directory, retains exact argv privately, exit/timing, source/executable bases and captured-output hashes. Timeouts retain uncertain effects and do not grant retry authority. Evidence is append-only. Export checks captured hashes and emits fingerprint metadata, not raw argv/output, source bytes or credentials. Review exports before sharing. These integrity records are not cryptographic attestations against a malicious operator.

Commands above do not install host hooks, migrate personal material, adopt private governance, contact commercial models or create physical second placement. Later installed proof uses authorised actual credentials, supported harnesses, owner-approved disposable canaries, reversible reviewed migration, real material/permissions and actual human assessment. Never omit/replay a producer in live personal work.

The supplied governance's draft standing is preserved. Use under this commission is not private adoption or Recognition. Original Day/Flow HTML and the archive protocol remain distinct pending fidelity inputs; indexed CT4b text is not original-byte proof.

## Executed standing and final verification

At O-I `8cdd368b83ecef7567ae3de6bc0cdaf0086b0cb3`, workflow **34551322509** passed the 52 mechanics tests and required native profile, Factory-publication and task/material observations. Its aggregate retains **28 pending cases**, exit **2**, and `whole_feature_verdict:null`. The joined run records 22 top-level native invocations; one of them executes the complete seven-case owner suite, and another proves removed-producer failure. Native child operations inside the suite are not misreported as only those 22 calls.

The consumed AIKit `19fc5a71d3c660a3eeb8b436755ea733032f6773` native workflow **34550497265** passed five native delivery, three native placement, seven task/material and 53 focused regressions. These are controlled native results, not all-platform green or full-feature acceptance. Consult normal owner CI separately; do not hide a red required owner gate behind the joined result.

Each later source change must record and run its own exact cut rather than inheriting these observations. Fresh non-implementer full-feature verification and applicable installed/provider/material/human acceptance remain necessary for the final usable end-to-end verdict. This campaign does not issue that verdict itself.
