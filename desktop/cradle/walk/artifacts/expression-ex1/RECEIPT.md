# EX1 Expression application acceptance

**Scope:** O:I #306 EX1, from `origin/main` `267a688`. Contract published first
as `27338e2` in PR #310. This is bounded technical/native acceptance; it does not
close EX0–EX7 or assert human creative/sensory approval under #65.

## Implemented and observed

- One versioned Expression document and atomic typed request seam in the existing
  Rust kernel. Subject/reading/relation/Action metadata stays qualified by native
  owner and revision. No Agent/Wiki/Nara/source/authority store was added.
- Human controls and `oi desktop expression` reach the same native app instance,
  serialized by its existing kernel mutex. Unix socket mode was verified as 0600.
- In the real Tauri macOS app: Agent creates revision 1; native human Add Thing
  creates revision 2; rebuilt CLI reads that exact entity; Agent binds/focuses it,
  changes glyph and automates scale at revision 3; UI discloses EX1, the subject,
  disabled automated scale and manual-takeover control. The existing Global
  Expression Stage renders the composition (native screenshot in the task).
- Concurrent native walk: human types `HUMAN DRAFT` without committing; Agent
  advances x to 120 at revision 4; the human input retains its text; blur returns
  expected 3/current 4 conflict, and the canonical glyph remains EX1.
- Final rebuilt native app opens the exported Expression file, edits to revision
  5, projects the bound subject through GlobalFocus, saves through the real
  Central ordinary-file Action, retains the exact returned file revision, and
  refuses a stale file save. An invoked `central.day.lifecycle` returns the
  actual owner refusal: missing bounded native token, not fabricated permission.

Structured native receipts: [native-seam.json](native-seam.json),
[native-final.json](native-final.json). [native-expression.json](native-expression.json)
is the controlled Expression file used for native save/reopen. Absolute locations
inside receipts are historical execution locations, not new canonical refs.

## Executed gates

From the repository root:

```sh
CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --all-targets
OI_CENTRAL_CTRL_BIN=/Users/admin/.local/bin/ctrl CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --test expression -- --include-ignored
CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo clippy --manifest-path desktop/cradle/kernel/Cargo.toml --all-targets -- -D warnings
npm --prefix desktop/cradle run build
(cd desktop/cradle && node tests/expression-engine.mjs)
CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/desktop/cradle/src-tauri/target CARGO_INCREMENTAL=0 cargo build --manifest-path desktop/cradle/src-tauri/Cargo.toml --locked
CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/cli/target CARGO_INCREMENTAL=0 cargo build --manifest-path cli/Cargo.toml --bin oi --locked
git diff --check
```

Kernel floor: 39 passed, 49 owner-dependent tests ignored by the existing default
floor (14 suites); EX1 specifically: 9 passed, 0 ignored with actual Central.
Engine importer/exporter: 10 assertions passed, including stable entities and
correct automation retargeting after reorder. TypeScript, production web build,
native build, CLI build and kernel clippy passed. Existing Vite chunk-size and
mixed-import warnings remain. CI also runs the new engine integration check.

## Review findings repaired

Human draft text survives incoming revisions and stale commits require explicit
resolution. Manual takeover is explicit. Imported files cannot replace a live
draft, and a failed reopen cannot mark that draft saved. Central can report a
CAS refusal in a successful protocol envelope: only written/unchanged outcomes
with an exact owner revision mark a draft saved. The saved file basis is the
commit result, never an unrelated later reread. O:I-owned presentation IDs do
not replace bound native refs. Document budgets and integer revision limits
keep the wire valid for both Rust and TypeScript.

## Boundaries and coordination

EX0 was not found as a visible Codex task, PR or issue claim at intake; this task
stayed scoped to EX1. Engine vendoring/presets/Studio were preserved. EX1 adds
only `presentConfig`/`updateConfig` and stable scene/selection handoff to the
existing Stage/EngineSurface. EX0 consumers should retain those narrow methods.
EX2–EX5 can consume the published contract. Capture, embedding, publication,
audience filtering and live domain-state adapters remain with those units.
Windows Agent IPC is explicitly unavailable in this increment. The current human
entry is System → Visuals → Compose; fuller workspace integration belongs to EX0.

The older cradle-context-check script reports an absent
`docs/kernel-rebuild/UX-SPINE-RECONCILIATION.md` citation and assumes one primary
worktree. EX1 instead follows the current #306 map and the user's explicit
parallel-lane instruction. Its three Expression documents and current native
application/composability/Action/WorldPresentation sources were read on main.
AIKit task creation failed on disk capacity and also bases its worktree on the
calling checkout; the recorded EX1 lane was created explicitly from origin/main.
Only unused regenerable compiler caches were removed; other source lanes stayed
untouched. The failed empty AIKit branch is eligible for retirement with EX1.

## CI integration repair

The first full PR run passed desktop/kernel/native-shell checks and exposed
existing mainline drift from the prelocal.6 cut: three native-protocol revisions
lagged surfaces.json (AIKit, Workcell, Quaternal Logic), and bootstrap required
Central's current/historical revisions to differ. The projection now matches its
source; bootstrap checks source selection and historical standing even when
revisions coincide. No owner pin, install choice or historical asset was changed.

The real CLI test floor is run with the worktree catalogue explicitly selected
(isolated `OI_HOME`, unset `OI_CATALOG`), because the machine's
adopted catalogue names a different development cut. Both deterministic suite
validators pass. EX1 also verifies rejection at JavaScript's integer boundary,
including an atomic edit refused without changing the last representable draft.

The carried capability snapshot's manifest digest also predated the cut. Its
source manifest was recovered exactly at `d7d4090`; all consumed product IDs,
public names and checkout names match the current manifest and carried snapshot.
Only the manifest digest was reconciled; child matrices, their provenance hashes
and native routing remain untouched and pass the existing snapshot verifier. The
CLI's matching revision-inequality assertion now checks its real truth-basis
disclosure, preserving acceptance of the actual current-main descriptor.

The existing source-suite activation test also contained the old three owner
revisions. Its registrations now read the checked-in catalogue; the existing
real activation/CAS/rollback assertions pass without a duplicated release pin.
