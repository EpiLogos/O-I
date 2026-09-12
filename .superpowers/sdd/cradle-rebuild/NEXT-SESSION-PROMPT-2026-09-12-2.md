# NEXT-SESSION PROMPT — continue the real work; decide the flow-placeholder collision (written 2026-09-12)

You are continuing the O:I desktop Cradle programme ([OI-CRADLE-REBUILD-WF],
issue #190, amended by docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md). The
standing owner ruling (absorbed 2026-09-12, still binding) is unchanged: the
design phases are DONE; "owner-gated" is not a stopping reason; re-survey the
INSTALLED binaries every cell; build the honest consumer surface now and
disclose absence — never defer.

## Read first (in order)

1. The tail of progress.md (this directory): the 2026-09-12 entries record
   three landed cells (#251 NOW-relations, #253 task basis, #255 Factory
   development reads), the machine facts and the named opens. The programme's
   floor is now 20 suites, 351 checks — keep it green.
2. The briefs BRIEF-NOW-RELATIONS / BRIEF-TASK-BASIS /
   BRIEF-FACTORY-DEVELOPMENT (all 2026-09-12) for the house cell style.
3. docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md §1–§7 if touching the panel
   planes, Flow or Factory surfaces.

## DECISION-1 (owner) — the empty flow placeholders vs the clean-worktree law

The situation, verified in code on 2026-09-12: Central's flow store for a
project register lives at `ProjectCentral/now/flows/` — INSIDE the project's
repository (`ctrl/src/projectcentral_flow.rs`: `DEFAULT_FLOW_DIR`).
The desktop's "New flow" / Start-writing route calls the owner's
`projectcentral.flow.create`, which writes a blank `YYYY-MM-DD-HHMM.md`
there. For the O-I project that is this very repository, so every flow the
desktop opens leaves an empty (or near-empty) untracked file dirtying the
worktree — and `oi dev install` installs "from clean exact current-main
source", recording `dirty` from `git status --porcelain` (cli/src/
rolling_dev.rs, suite_v2.rs). The desktop's own writing surface therefore
collides with the dev-install law on the repo the desktop is developed in.
The owner reports four placeholders today and committed three byte-exact as
custody; the working tree was clean again at dispatch time — re-survey
`git status`, the flows directory and the reflog first, and treat the
owner's custody commits as evidence, not as a verdict.

The decision is the owner's because it fixes where durable ground lives.
Present these options in one question, with the recommendation first:

1. (Recommended) **Deferred materialisation, desktop side + repo side.** The
   desktop's `createFlow` (Cradle.tsx) defers `projectcentral.flow.create`
   until the human's first content exists (a typed character or a pasted
   block) — an untyped flow tab claims no ground; AND the O-I repo declares
   `ProjectCentral/now/flows/` scratch in `.gitignore` (flows are the
   project's moving NOW field, not repo source; the owner's custody copies
   stay in history). Consequential tradeoff: a flow that is never typed
   leaves no trace at all — the Flows list shows it only from the owner's
   registry (`.central/flows.json`), which is a separate file the repo may
   or may not also ignore (ask in the same question if unclear).
2. **Commit-law: flows are repo content.** Keep immediate creation; blank
   files are legitimate and the repo tracks them. Then `oi dev install`'s
   cleanliness check must learn to ignore the flows directory (an
   O-I-side change to the porcelain filter), and every flow save is a repo
   commit — heaviest, but flows become first-class repo history.
3. **Central-side relocation.** The project flow store moves outside the
   worktree (a placement-policy location). This contradicts Central's own
   register design (ProjectCentral/now IS the project's NOW field) and
   needs a Central architecture change — only if the owner wants the
   field out of the repo entirely.

Until the owner answers, NOTHING in this cell blocks the rest of the queue:
the decision only shapes cell A's second half. Cell A's survey and desktop
half are safe under option 1 and reversible under the others.

## The queue (in order; one cell = one branch = one PR)

1. **Cell A — flow placeholder collision (the survey half now, the ruling's
   half when the owner answers).** Reproduce: open the real ground's O-I
   project, click New flow, watch `ProjectCentral/now/flows/` gain a blank
   file and `git status` go dirty. Then implement the owner's ruled option
   (or stage option 1's desktop half — deferred materialisation — as the
   default proposal while asking). Walk: New flow → type → the file appears
   exactly once with the typed content; New flow → close untyped → no file,
   no dirt, no orphan registry entry (or the ruled alternative's exact
   behavior); `oi dev install`'s cleanliness read is demonstrably clean
   after an untyped flow.
2. **Cell B — Journey/Run/telemetry depth on the Factory surface.** The
   development-read kernel route and surface exist (#255); add the journey/
   run/execution-telemetry reads as first-class panel rows (the wayfinder's
   Trajectory presentation: chronological rows, expandable detail, honest
   unavailability), and re-pin the stale `FactoryDiscover`/`Snapshot` kernel
   routes against the current build grammar (`factory build` now requires
   `<state> <project-ref> <run-ref>`), or retire them if the development
   family supersedes them — say which, with evidence.
3. **Cell C — the Inspect plane's NOW section, fed for real.** The section
   shipped honest-empty (#251); a task-bound session's record now carries
   the allocated NOW (cell #253's read route). Feed the section from the
   session's actual task record (owner-read), render the NOW relations in
   place, and walk it through the task-basis provisioning — this closes the
   named open from the 6C survey with a real ref, not a synthetic one.
4. **Cell D (if time remains) — remembered notes, read.** The destination
   files are plain owner ground; a small read surface through the
   `central.files`-family routes (the U3.3 named open), honest absence when
   nothing is remembered.

## The enforced loop (per cell — no exceptions)

BRIEF (≤60 lines, imperative, design citations) → BUILD (fresh worktree cut
from origin/main; never the primary checkout — it belongs to the owner's
site branch) → WALK (drive the running app; receipts are the acceptance) →
floor (ALL suites, currently 20, receipts regenerated and committed) →
RECEIPT (progress.md row) → push + PR → land on green checks (squash).
Claim before building: push the branch and open the draft PR first — a
parallel session may be live on this machine; disjoint lanes, serialized
landings.

## Machine facts (re-verify digests each session; re-survey beats memory)

- Bindings as of 2026-09-12 close: `ctrl 0.1.0` @ `59bb901c19a5` (sha256
  `2f03ec33…`) at ~/.cargo/bin; `aikit 0.1.0` @ `586b85eaf77c` (sha256
  `f7c8c245…`); `factory 0.1.0` @ `f12b36c51126` (~/.local/bin);
  Workcell `e4e40a91fe7e` — note the task chain needs the DEDICATED
  `workcell-write-boundary` binary from the Workcell release dir, not the
  workcell CLI; Actuation: the Rust binary at
  `/Users/admin/Central/Work/Actuation/target/release/actuation` (0.2.0) —
  the npm launcher symlink at ~/.npm-global/bin/actuation is DANGLING.
- Walk env pins (the floor command that worked, 20 suites green):
  `OI_CENTRAL_CTRL_BIN=~/.cargo/bin/ctrl OI_AIKIT_BIN=~/.cargo/bin/aikit
  OI_CAW_ACTUATION_BIN=<actuation path>
  OI_CAW_WORKCELL_BIN=<workcell-write-boundary path>
  OI_FACTORY_BIN=~/.local/bin/factory node walk/run.mjs <suites…>`.
  The OI_AIKIT_BIN pin is load-bearing: the installed `oi aikit` multicall
  resolves the REGISTERED composition binding, which drifted mid-session to
  an older ai-kit cut without the `flow` subcommand (and the installed oi's
  registered aikit-session-space path is missing). Re-registering the
  composition is an owner lane; until then every walk pins.
- Walk mechanics: results are authoritative in `walk/artifacts/<suite>.json`
  (never piped tails); a mid-run failure aborts the rest; fresh AIKit-home
  per scenario (isolation law); `channel("invoke.kernel_op", [op])` takes an
  args-array; kernel-routed refusals surface the owner's words through
  `lastOpError` (the #244 repair completed in #253).
- Machine laws learned the hard way: Workcell write-boundary preparation is
  Linux-Landlock only — macOS refuses with "no weaker fallback", so a task
  can never reach ready=true here (the echoed accepted dispatch waits for a
  boundary-capable host); `central.work.validate` refuses any task cwd that
  is an ANCESTOR of protected structural objects — use a scratch sibling,
  never the project root; the owner's receipt `revision` fields are OBJECTS
  (`{revision, byte_len}`) — never render them raw.
- Disk is tight (~13Gi free at dispatch): one scratch worktree at a time;
  prune your own merged scratch at session end; sitrep before touching
  anyone else's (oi-desktop, oi-wave6, oi-repair remain as reported).

## Owner lanes (not desktop cells; re-check before assuming)

ai-kit #274 participant enumeration (typed recipient/audience fields wait on
it); the echoed accepted expected_task dispatch on a Linux boundary host +
the serialized installed-candidate walk (owner present); re-registering the
composition's ai-kit bindings (the multicall drift above).

## Stop conditions

Run out of queue, not out of energy. A cell whose owner operation genuinely
does not exist on the installed cut still gets its consumer surface with the
honest unavailable/refusal states — that IS the build. Session end: ledger
rows for everything, NOW return via `projectcentral.now.return`, scratch
pruned, nothing loose at the Work root.
