# NEXT-SESSION PROMPT — run the real tasks on autopilot (written 2026-09-12)

You are continuing the O:I desktop Cradle programme ([OI-CRADLE-REBUILD-WF],
issue #190, amended by docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md). The
owner has ruled out deferral. Execute the queue below cell by cell, all the
way through landing, until the queue is empty or genuinely blocked on an
owner operation that does not exist on the installed cut — and even then,
build the honest consumer surface instead of waiting.

## The owner ruling (binding, absorbed 2026-09-12)

The design phases are DONE. "Owner-gated" is not a stopping reason by itself.
Three failure patterns are named in progress.md and are forbidden: reading the
honest-unavailable law as permission to defer instead of build-now-and-
disclose; trusting a stale gate survey (re-survey the INSTALLED binaries every
cell); reading "design-in-context with the owner" as "don't build" (the
designs are settled — build and render the owner's answers verbatim).

## Read first (in order)

1. The tail of progress.md (this directory) — the 2026-09-12 entries record
   the ruling, the three landed cells, the walk mechanics and the incidents.
2. docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md §1–§7 (the experience, the
   panel planes, human Return, the 6A–6F cuts).
3. The briefs BRIEF-U3.3-REMEMBER / BRIEF-START-WRITING-REGISTER /
   BRIEF-CONTEMPLATE-SURFACE for the house cell style (≤60 lines, imperative).

## The queue (in order; one cell = one branch = one PR)

1. **NOW-relations on the Inspect plane.** `central.now.read` is LIVE on the
   installed ctrl (NowRecord carries participant_refs / source_refs /
   continuation_refs); there is NO list-by-participant op, and that is fine:
   NOWs are reachable through owner records that name a now_ref (receiving
   rows may carry now_ref / day_ref as owner-side annotations). Collect the
   now_refs the desktop already holds, read each through the owner, render
   the real relations beside their records (Inspect plane / beside the
   document), root register via the explicit-null convention, honest
   "no NOW records reached this surface" states elsewhere. Walk: seed a
   return carrying now_ref through the owner; prove the plane reads the NOW
   by ref and renders its relations verbatim; prove absence stays honest.
2. **Task allocation + typed composer fields.** Re-survey the installed
   ai-kit (`aikit 0.1.0` @ `586b85eaf77c`) — central_task.rs /
   encounter_task.rs and `aikit.encounter-task/v1` are new; check what a
   caller can enumerate and what `ready=true` requires (an allocated Central
   task). Survey Central's task ops on the installed ctrl (`central.work.*`,
   `central.now.lifecycle`, `central.now.read`). Then build: a task-
   allocation surface against whatever is published, and replace the
   addressed composer's operator-typed recipient/basis/audience fields with
   typed owner-fed ones wherever the owner actually discloses them — typed
   fields stay as fallback, never removed while the owner still validates
   them. Walk: allocate a task through the owner, compose an addressed turn
   whose expected_task echoes it, prove a fabricated task is refused.
3. **6D Factory/material — survey, then the first consumer cell.** One fresh
   survey of the INSTALLED factory and workcell CLIs (published operations
   only, never issue text). Build the first consumer surface for whatever is
   published (Journey/Run/unit reads, Workcell placement reads), honest
   states for the rest. This is where the old U4.3 "Journey line" lives now
   (Factory owns developmental Journey/Run; Actuation owns activity;
   Workcell owns placement — resolve the native chain, never the old label).
4. **If time remains:** the Day die-face root-register buffer refresh route
   (check whether #240's owner-routed re-reads closed it; if not, it is a
   small kernel+renderer cell).

## The enforced loop (per cell — no exceptions)

BRIEF (≤60 lines, imperative, design citations) → BUILD (fresh worktree cut
from origin/main; never the primary checkout — it belongs to the owner's
site branch) → WALK (drive the running app; receipts are the acceptance) →
floor (ALL suites, currently 17, receipts regenerated and committed) →
RECEIPT (progress.md row) → push + PR → land on green checks (squash).

Claim before building: push the branch and open the draft PR first — a
parallel session may be live on this machine; disjoint lanes, serialized
landings.

## Machine facts (re-verify digests each session; walk mechanics earned)

- Bindings: `ctrl 0.1.0` @ `9debcf4f0bf9` (sha256 `573495a4…`) and
  `aikit 0.1.0` @ `586b85eaf77c` (sha256 `f7c8c245…`) at ~/.cargo/bin;
  Actuation: the Rust binary `/Users/admin/Central/Work/Actuation/target/
  release/actuation` (`actuation 0.2.0`) — the npm launcher symlink at
  ~/.npm-global/bin/actuation is DANGLING; export
  `OI_CAW_ACTUATION_BIN=<that path>` for the addressed suites
  (select-send, send-group-reconnect, first-vertical, agency-planes,
  agency-a2a).
- Walks run from `desktop/cradle`: `node walk/run.mjs <suites…>`; results are
  authoritative in `walk/artifacts/<suite>.json`, never in piped tails; a
  mid-run failure aborts the rest; fresh AIKit-home per scenario env (the
  isolation law — NEVER let a walk binary touch the ambient `~/.aikit`);
  the kernel's `central.*` route runs `oi aikit/…` through OI_BIN.
- Watch: one intermittent bridge fault answers without an outcome; the walk
  now reports the real transport error (lastOpError repair, #244). If it
  recurs, dig from the bridge's /op path with the named error.
- Disk is tight (~16Gi free): one scratch worktree at a time; prune your own
  merged scratch at session end; sitrep before touching anyone else's.

## Stop conditions

Run out of queue, not out of energy. A cell whose owner operation genuinely
does not exist on the installed cut still gets its consumer surface with the
honest unavailable/refusal states — that IS the build. Session end: ledger
rows for everything, NOW return via `projectcentral.now.return`, scratch
pruned, nothing loose at the Work root.
