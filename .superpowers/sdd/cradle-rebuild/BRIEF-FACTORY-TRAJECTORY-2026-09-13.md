# BRIEF — Journey/Run/telemetry rows on the Factory surface; the stale build routes decided — 2026-09-13

Queue cell B (NEXT-SESSION-PROMPT-2026-09-12-2). The development-read kernel
route and surface exist (#255); this cell adds the Journey/Run/telemetry depth
as first-class panel rows and settles the stale `FactoryDiscover`/`Snapshot`
kernel routes with evidence.

## Survey (installed `factory 0.1.0` @ `f12b36c51126`, probed this session)

- `factory build discover` NO LONGER EXISTS: the CLI help lists only
  `build snapshot|refresh <state> <project-ref> <run-ref>`; the old route
  answers "expected <state> <project-ref> <run-ref>". → RETIRE
  `FactoryDiscover` (with `Client::bindings` and the `Binding` type).
- `factory build snapshot` IS LIVE under the new grammar
  `<state> <project-ref> <run-ref>` (no `--binding`). → RE-PIN as
  `FactoryBuildSnapshot {project, state_path, project_ref, run_ref}`,
  contract-verified (`factory.build-view/v1` +
  `factory.build-view-provider/v1`), payload verbatim. On the owner's own
  specimen the build provider ERRORS ("missing field `project`") — the walk
  renders the owner's refusal verbatim; honest unavailability is the build.
- The whole old binding-authority chain is stale with the same evidence:
  `factory action intent|invoke --binding` are gone (the installed grammar is
  `factory action list|invoke <state> <project-ref> <run-ref>`). The kernel
  ops `FactoryIntent`/`FactoryInvoke`, the client `intent/invoke/action`
  chain, and the `#[ignore]`d `factory_native` kernel test that exercises
  them RETIRE together; a future authority-chain re-pin belongs with an
  owner-published build provider, not this consumer cell.
- Development reads for the rows: `development journey <state> <journey-ref>`
  (`factory.journey-reading/v1`: frontier, status, revision, participants,
  runRefs, returns, recognitions, activityRefs…),
  `development run <state> <run-ref>` (`factory.run-reading/v1`: lifecycle,
  revision, executions, actions, runMap, evidence, thoughtRefs…),
  `development execution-telemetry <state> <telemetry-ref>` — the specimen
  carries no telemetry (the owner refuses `ExecutionTelemetryNotFound`),
  which the surface discloses verbatim.

## Change

- `desktop/cradle/kernel/src/factory.rs` — retire the dead chain; add
  `build_snapshot` (new grammar, schema-verified, verbatim).
- `desktop/cradle/kernel/src/lib.rs` — `FactoryBuildSnapshot` with the same
  project-disclosure gate and `OI_FACTORY_BIN`/suite-route binding as
  `FactoryDevelopmentRead`; the four stale ops and their arms removed.
- `desktop/cradle/kernel/tests/factory_native.rs` — removed (it exercised the
  retired chain and was already `#[ignore]`d).
- `desktop/cradle/src/kernel/types.ts` +
  `src/contributions/factory/development.ts` — typed op/client.
- `src/contributions/factory/FactoryDevelopmentSurface.tsx` — the project
  read renders its journey registry as rows; each journey row expands through
  the owner's journey read; the journey's runRefs render as run rows; each
  run row expands into the Trajectory presentation — chronological execution
  rows (executionRef/status/agency in owner order, expandable detail,
  verbatim fields) — plus an execution-telemetry read whose refusal renders
  verbatim; a build-snapshot row through the re-pinned route; nothing reads
  before the explicit act; the owner's refusals render in the owner's words.
- `desktop/cradle/walk/scenarios/factory-development.mjs` — extended.

## Walk contract (metrics)

1. The project read's journey registry renders as rows with the owner's
   journeyRef/frontier/status verbatim.
2. Expanding a journey renders `factory.journey-reading/v1` fields verbatim
   and its runRefs as run rows (count matches the owner's payload).
3. Expanding a run renders `factory.run-reading/v1` with the executions band
   in owner order — one chronological row per execution, expandable detail
   carrying the owner's own fields.
4. The execution-telemetry read renders the OWNER'S refusal verbatim
   (ExecutionTelemetryNotFound on the specimen) — honest unavailability.
5. The re-pinned build-snapshot route reaches the owner under the new grammar
   and renders the owner's provider refusal verbatim on the specimen.
6. Full regression floor green (all 20 suites on the final bundle).

## Standing

Branch `agent/oi-factory-trajectory`, cut from origin/main `7fe52680`
(#259). Claim: brief pushed + draft PR before the build commit.
