# NEXT-SESSION PROMPT — continue the real work; clarify the flow/Day logic (written 2026-09-12; owner correction absorbed same day)

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

## OWNER CORRECTION (absorbed 2026-09-12, supersedes the three-option decision formerly here)

The owner examined the flow-placeholder issue and ruled on the PREMISE, not
the folder: **the `ProjectCentral/now/flows/` placeholders are themselves
the fault — an agent preempted flow files with an assumed structure no
design ever chose. Flows live inside the user's Day, and the HTML forms of
both carriers already exist.** The clarifying of the LOGICS is the work;
shuffling semantics around an erroneous folder is not.

The authored ground already holds the corrected shape — cite it, do not
re-derive it:

> "0/1 `ql-dialogue-flow_1.html` — Flow and Dialogue are views of the same
> document entries; Journal is supported inside this same file." — wayfinder §2.
> "4+2 `ql-daily-die_2.html` — When used as a Day, consume Central's
> source/temporal reading; opening a tab does not create another Day." — §2.
> "Flow opens an entry as a full writing page; Dialogue reads the same entry
> set conversationally … Do not maintain independent editable source copies
> per view." — §3.2.

The blank `.md`-per-flow store (`ctrl/src/projectcentral_flow.rs`
`DEFAULT_FLOW_DIR`, registry `.central/flows.json`) and the desktop's
"New flow" route onto it were built PAST that ground. The dev-install
collision (blank files dirtying the worktree `oi dev install` requires
clean) is a SYMPTOM of the wrong premise, not the problem to re-home — the
former gitignore/commit-law/relocation options are WITHDRAWN.

## The queue (in order; one cell = one branch = one PR)

1. **Cell A — clarify the flow/Day logics, then land the first half.** Write
   the clarified position as a one-page proposal to the owner (this is
   design meaning — propose, never write it into the owner's ground): what
   a Flow IS (a view over entries of the Day/0/1 document carrier), how
   Start writing / New flow must resolve (into the human's Day through the
   owner's document operations — the die when it is a Day, the 0/1 entries
   for Flow/Dialogue; opening a tab never mints another Day), what
   `now/flows/` and `.central/flows.json` then are (residue: named for
   cleanup/migration once the position is ratified, custody copies in
   history stay), and what the kernel's typed flow ops should address
   instead. While the proposal awaits ratification, the one reversible
   desktop half is safe to build NOW: New flow / Start writing must stop
   minting blank `now/flows/` placeholder files (the collision the owner
   actually hit) — defer any ground write until real content or a ratified
   carrier resolution exists, and let the walk prove the worktree stays
   clean. Do NOT migrate, ignore, or delete the existing folder before the
   owner ratifies the position.
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
