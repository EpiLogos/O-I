# T-FACTORY-VERTICAL — a Factory run recovered through the shell

**Source:** WORLD-SHELL-DESIGN §17.1 (the Factory vertical: "a real Factory agent
performs a bounded piece of work on a real Jung/World object; the result is
recovered through Earth, Timeline, Constellation, Expressions, the relevant
devices, and agent/files inspection — identity, provenance, work and context
continuous throughout; repeated with views closed, reopening, occupant change
and a retained occasion"); DLW-PLAN Phase 3 (the Factory vertical, prerequisite:
the Factory receiving join, `MAP.md` "Factory receiving/advancement");
LEGACY-CRADLE-RETIREMENT UX cutover gate 1. Pattern: T-CENTRAL-VERTICAL.

## Target

One selected Factory run is recovered through each projection on its own ref:
its subject in the Earth, its moment on the Timeline, its subject in the
Constellation, its Expression, its devices (the agent chain) and its files.
Every row names the run it was joined from. Where a projection cannot show the
run's result, the face names the owner seam (owner, op, remedy). No second store.

## Acceptance

- Scripted (channel: scripted node test over placeholder shape fixtures, with
  a real owner reader and a real capture cross-check): `tests/factory-vertical.test.mjs`,
  13 tests. The walk selects a run, then asserts one identity through the
  subject, Earth, Timeline, Constellation, Expression, devices and files; then
  repeats with views closed and reopened, an occupant change and a retained
  occasion; and checks that the identity check is live.
- Native (channel: computer use, Factory mode): NOT RUN. The computer-use leg
  is open (owner grant), and no live Factory agent was run for this ticket.

## Progress

### Audit (14 Oct; source reading, file:line)

**How a Factory run's result reaches the shell today.**

- The Factory centre: `native/Workbench.tsx:278` (`chooseFactory` →
  `publishCentreView('tasks')`), `:700` (`FactoryLiveProvider`), `:740` (the
  Factory tree's conversation node mounts `AgentShellCentre`). The agent tab is
  pinned (`agent/factoryCentre.ts`, `AGENT_SHELL_ID`).
- The agent tab's selection is an agency session track
  (`agent/useAgencySessions.ts`, `agent/agentRunModel.ts:291` `trackKey`).
  `agentRunModel.ts:296` states that `agency_read` discloses no parent linkage:
  a run is not joined to its session today.
- The task log: `shell/ModeDetail.tsx` `FactoryTaskLogDetail` (line 181). Its
  rows `attempt`, `workcell` are declared and waiting (about line 201: "attempts
  come from the Factory owner (op factory_attempt_read) — declared, waiting here").
  The device chain (`agent/AgentDeviceChain.tsx`, mounted at `App.tsx:539`
  through `AgentShellDeviceDetail`) is keyed on the session.
- The Desk's run store (cradle, read by the shell through `native/Workbench.tsx`):
  `contributions/factory/desk/deskStore.ts` `runEntry` (line 63), `openRunLive`
  (238), `useSelectedRun` (243), `selectRun` (245). `DeskReading.inhabitation`
  (line 41) holds the owner's raw inhabitation reading per source.

**The run and receipt shapes (owner declared).**

- Kernel `kernel/src/factory.rs`: `OwnerRequest` (196–362) with `AttemptReturn`
  (282), `Inhabitation` (305), `RunClose` (346); the owner dispatch (901).
- `factory.attempt-return-reading/v1` (`desk/runReturnReading.ts`,
  `readNativeRunReturn`): `attempt.record.readableReturn` with `returnRef`,
  `summary`, `artifactRefs`, `evidenceRefs`, `archiveRefs`.
- `factory.inhabitation-reading/v1` (`inhabitation/model.ts` 133–137): runs,
  positions, custody (`work_ref`), occupants (`participant.position_ref`,
  `body.agent_session_ref`, facets `present|absent`).
- `factory.attempt-reading/v1` (captured): `attempts[]` with `disposition`,
  `verifications`, `readableReturn` (fixture
  `desktop/cradle/tests/fixtures/factory-live-events.json`, specimen ground, 26 Sep).
- The run's Expression: `contributions/factory/run-expression.ts`
  `composeRunExpression` (84); the subject binding's `subject_ref` is the run
  ref, `native_owner: software-factory` (59); the live ref is
  `live/producer.ts:104` `liveExpressionRefFor(runRef)`.

**The run's subject (the World object it worked on).**

- The custody `work_ref` of the Position in custody: e.g. `central:wiki:root`
  or `github:…#n` in the captures. The join's subject is this ref.
- FINDING: `inhabitation/model.ts:451` (`runInhabitationView`) applies
  `refTail(entry.work_ref)`, so the desk's view keeps only the tail of the ref.
  The join reads the owner's raw row instead (`positionsOfRaw`). Scripted:
  `factory-vertical.test.mjs`, "REAL OWNER READER".

**Whether the result's identity reaches each projection.**

- Earth: NO. `projections/atlas/src` has no Factory reference. `Occurrence.subject_ref`
  exists (`projections/atlas/src/types/field.ts:189`), but no Factory ref is bound
  to it. The occurrence list is on `useAtlasHandle()?.model.occ`
  (`src/data/model.ts:35`).
- Timeline: NO for a run's own moment. `kernel/src/temporal_sources.rs` joins
  five streams (`read_field`, 867–893): central-now, central-now-thoughts,
  wiki-returns, kernel-event-log, aikit-history. Only aikit-history maps a
  `procedure` entry to a Run moment (`history_kind_to_event_kind`, 565), and only
  if the aikit evidence names the run as its subject. No stream reads the Factory
  owner (`grep -i factory temporal_sources.rs` finds only test fixtures, 970,
  1373). The Timeline's run track is real: `timeline/runTrackAdapter.ts`
  `isRunSubject` (29), registered at `timeline/registerWorldTrackAdapters.ts:57`.
- Constellation: only for a wiki node. The Constellation opens `wiki:node:` refs
  (the Central rule, `central/centralVertical.ts` `namedWikiSubjects`). A custody
  `central:wiki:root` names no node.
- Expressions: REACHED BY COMPOSITION, not by a stored read. The run's Expression is
  composed on the Desk's Run Live tab (`live/RunLiveExpression.tsx:40`, producer
  `liveExpressionRefFor`). The desk's own door `openRunLive` (`deskStore.ts:238`)
  is the one the join uses.
- Devices: NOT JOINED TODAY. The attempt's occupant names its agent session
  (`inhabitation/model.ts` `occupantView`, 421–428: `body.agent_session_ref`). No
  shell path used that facet; the agent tab selects by track only.
- Files and agent inspection: NO owner route for a Return's refs. The captured
  Return names `artifact:specimen/…` and `evidence:specimen/…`
  (`factory-live-events.json`). The shell's only file owner read is
  `central:path` (`files/client.ts` `readFile`); no artifact read is declared.
- Close grant: `factory.run.close` appears 0 times in
  `Control/user/native-action-authority.json` (verified, read-only). The close is
  refused before any owner call (`kernel/src/factory.rs` `RUN_CLOSE_ACTION` 1445,
  `grant_refusal` 1517). Not created, not edited, not closed by this ticket.

### What now works (the joins built)

- `packages/live-shell/ui/src/factory/factoryVertical.ts` (pure): the subject
  (raw custody `work_ref`, kind by ref grammar), the Earth row (placed only when an
  occurrence bears the subject ref; otherwise absent with its seam, or
  not-mounted), the Timeline row (the run's own event; otherwise absent with its
  seam), the Constellation row (`wiki:node:` refs the Return text or subject
  names; otherwise absent), the Expression row (the desk's Run Live door), the
  device rows (one per occupant, selected only when the agency reading lists the
  session), the file rows (`central:path` openable through the owner route;
  other refs named with their seam), and `identityBreaks`.
- `packages/live-shell/ui/src/factory/FactoryRunJoin.tsx` (React face): reads the
  Desk's selection (`useSelectedRun`, `reading.runs`), the owner's raw inhabitation
  row, the per-attempt Return (`readRunReturn`, `factory attempt return`), the
  atlas handle and the World cut. Each row opens through its owner's existing door:
  `world.selectOccasion` (the spine), `openConstellation` (oi:epi-open-knowledge),
  `openRunLive` (the desk), `setSelectedTrackId` (the agent shell), `readFile`
  (the owner's central:path route). The face draws nothing when no run is selected.
- Wiring: `shell/ModeDetail.tsx` `FactoryTaskLogDetail` gains an optional `join`
  prop and renders `FactoryRunJoinDetail` beneath the task log. `App.tsx:538`
  passes `join` (transport, World, agency tracks) only while the Factory detail is
  shown in clip mode, so no owner read runs while hidden.

### Owner seams, named on the face

- **Earth.** Owner: Archetypal-Earth atlas, `Occurrence.subject_ref`. Op: an
  occurrence bearing this Factory work ref. Remedy: the T6 occurrence binding
  contract binds the work ref to a corpus occurrence; the Factory owner declares
  no such binding today.
- **Timeline.** Owner: kernel `temporal_sources.rs`. Op: a Factory stream adapter
  reading `factory telemetry day` (`factory.telemetry-day/v1`) into one moment per
  run receipt. Remedy: the adapter maps the owner's receipt; it writes nothing.
- **Constellation.** Owner: Central wiki (the Constellation). Op: a `wiki:node:`
  ref the Return or the subject names. Remedy: the Return names a node; the Factory
  Return names none today.
- **Devices.** Owner: AIKit agency reading (`agency_read`). Op: the occupant's
  session listed in the agency reading. Remedy: the agency reading lists it, or the
  occupant names no session.
- **Files.** Owner: Factory artifact store (`factory attempt return`). Op: an
  artifact read for the `artifact:` and `evidence:` refs the Return names. Remedy:
  Factory declares an artifact read that returns the file or its `central:path` ref.
- **Run close.** Owner: `Control/user/native-action-authority.json`. Op: the
  `factory.run.close` grant. Remedy: the owner names the grant; this ticket does not
  create or edit it.
- **Desk view.** Owner: the Factory desk (`inhabitation/model.ts:451`). Op: keep the
  full `work_ref` in `runInhabitationView`'s custody. Remedy: the desk's view keeps
  the owner's ref; the join reads the raw row until then.
- **Attempt row.** The task log's `attempt` row still reads "declared, waiting"
  (`ModeDetail.tsx`); the join's return rows carry the attempt facts. Owner
  seam unchanged: `factory_attempt_read` (the row's own op name).

### Checks (14 Oct; each command run in the seat)

- `packages/live-shell/ui` `npx tsc --noEmit -p .`: before 0 errors (exit 0); after 0 errors (exit 0).
- `desktop/cradle` `npx tsc --noEmit`: before exit 0; after exit 0.
- `tests/factory-vertical.test.mjs` (`--test-timeout=60000`): 13 pass, 0 fail (new).
- Files that read the touched modules (`central-vertical`, `central-devices-rack`, `factory-expressions-pane`, `factory-timeline-pane`, `factory-instrument-panes`, `mode-surface-fidelity`, `pane-instrument`, `pane-instrument-app`, `hosted-summons`, `atlas-host`, `journey-walks`, `run-context-refusal-guard`): all pass except `native-composition-views`, whose two failing asserts are in `desktop/cradle/expressions-app/field-studies-journeys` (`store.change needs an edit function`, `dropFocusMode is not defined`), another builder's uncommitted zone (source reading, not this ticket's code).
- Full suite, one `node --test --test-timeout=60000` per file under `packages/live-shell/ui/tests`:
  - Before (clean HEAD `fdb16b186` extracted to scratch, node_modules linked): 1586 tests, 1540 pass, 46 fail, 32 files failing.
  - After (working tree, including the other builder's uncommitted edits in the same tree): 1707 tests, 1675 pass, 32 fail, 19 files failing.
  - The failing count did not rise. The 32 after-failures are the figure the ticket cites as pre-existing. Thirteen files that failed at HEAD pass now; the tree also carries the frame builder's uncommitted work, so this drop is not attributed to this change.
- Processes: every test process and runner I started has exited (checked by PID; one unrelated shell snapshot belongs to another session and was left alone).
