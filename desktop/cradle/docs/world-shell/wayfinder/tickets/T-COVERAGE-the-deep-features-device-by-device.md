# T-COVERAGE — the six products' deep features, device by device

Measured 21 Oct 2026 against O-I `main` `7937e2a59`, by two read-only passes. Each pass worked through every capability record of the
suite's product catalogue (`suite/product-capabilities.json`, 138 capabilities; Quaternal Logic's own matrix now holds 54) and asked
three questions:
- Does a catalogue design carry this capability?
- Does the manual say so?
- Does a shell binding reach the owner?

The rows, with file:line evidence, are in `../../evidence/coverage-20261021/` (`central-workcell-actuation.json`,
`aikit-factory-ql.json`).

The build copies no UI and invents none. A design in the catalogue is the device. The build wires it to its owner and places it where
the manual says. A capability with no design waits for the design lane (part 2 below). Until then it stands where its home will be,
named and dark, as §16.16 says of a part that nothing carries yet.

| Product | Covered (wiring owed) | No design | Design, no owner route | Manual silent | Backstage |
|---|---|---|---|---|---|
| Central | 12 | 14 | 4 | 1 | 1 |
| Workcell | 1 | 14 | 3 | 0 | 5 |
| Actuation | 1 | 2 | 8 | 0 | 4 |
| AIKit | 19 | 11 | 0 | 0 | 2 |
| Software Factory | 5 | 10 | 0 | 0 | 3 |
| Quaternal Logic (18 in the catalogue) | 4 | 7 | 1 | 0 | 6 |
| Quaternal Logic (36 newer, a lighter pass) | 19 | 13 | 0 | 0 | 3 |
| **All** | **61** | **71** | **16** | **1** | **24** |

"Covered" counts designs that carry a capability whether or not a binding reaches its owner yet. Most are partly bound.

## 1. For the build: wiring, routes and owner operations

### 1.1 The one route that unblocks most of Central

The kernel's `invoke_action` routes every `central.*` action, but it never carries the person's authority (`kernel/src/flow.rs:405-416`).
One route that carries it unblocks these, all of whose Central operations already exist:
- NOWs › Close: `central.now.lifecycle`;
- the Day's Rollover, close routine, Prompt, Runs at and the move records: `central.day.settings.write`, `move.record`, `rollover`,
  `close-carry`;
- Approvals › Approve: `projectcentral.source.return_accept`;
- Messages › Accept: `agent-profile.accept`, with `agent-profile.express`, `save` and `remove`, and `central.agent-set.propose` and
  `save`.

**Build, 21 Oct:** landed (`6c6492604`): action.rs PERSON_ACTS carries the host's token for the person's own presses through
`invoke_action`. NOWs' Close, the Day's writes, Approve and Messages' Make, Accept and Discard write through it (`16db9826c`,
`b912483a5`, `ed21cfc09`, `bfe605406`). Approve's `projectcentral.source.return_accept` joined the owner's human grant at the
owner's word (Control `3c45ba016`).

### 1.2 Kernel routes to commands that already exist

| Owner | Commands | What they fill |
|---|---|---|
| Actuation | `agency`, `realised`, `stream`, `activity`, `usage` | The Agent's Run and Identity pages; the Ledger's tokens and spend. |
| Actuation | `actuation-research comparison.*` | The Experiment, all of whose statements are refused today (`agent/devices/mainTrackBindings.ts:225`). |
| Actuation | — (`correlate` was removed in 0.2.1, but the kernel still calls it) | Remove the call. |
| Workcell | `workcell connections show\|connect\|machine`, `seat join`, `seat release`, `material` | Remote carrier, Settings › Machines, Seat Join and Release, and the Workcell rack's world (`material_read` exists but nothing calls it). |
| AIKit | `gateway who\|send\|delegate\|team\|serve\|setup` | Messages, and the Agency gateway's writes. |
| AIKit | `capture`, `inbox`, `promote` | Capture skill. |
| AIKit | `trust record`, `praxis method run\|prove`, `set package export`, `wiki-shape *` | The Skillset rack's trust and package acts; the Canvas Form page. |
| Software Factory | `attempt decision`, `custody assign\|update` | Takes that stand; the Agent's Custody writes. |
| Quaternal Logic | `kernel m1` | M′ matrices. |
| Quaternal Logic | `techne reading`, `mef lenses`, `context-frame list`, `service capabilities`, `vak locate\|context`, `kernel apply`, `kernel ledger`, `stage state\|evaluate\|bind\|unbind\|retire` | The Lens, Search's `vak:` kind, the M′ matrices' Kernel page, the instruments' racks and the Torus's Stage. |
| Quaternal Logic | `scene compose\|world` | The Chakra's and Sitting's centres. |
| Quaternal Logic | `ql_m3_generate`, asked from `m3_reception` | The M3 clock's Law and Generation. |
| Hermes | a frame-ring read | The Frames monitor. |
| Workcell | services (hosting), `collect`, `secret scan\|projections\|revoke-projection`, `machine add\|remove`, `connect`, `connections disconnect` | The Decision helper's hosting; Runs' outputs; Settings' Credentials and Machines. |
| AIKit | `work continuity closeout verify`; a native binding for RoutineAuthoringSource; route standing in `model_catalogue` | The Day's close-out; Settings' Automations (enable, reprove, create) and model routes. |
| AIKit | `source`, `collate`, `adopt`, `procedure`, `bypass`, `unused`, `explain`, `history`, `work continuity pressure\|commands\|closeout verify`, `knowledge frame`, `knowledge forget` | The Skillset rack's Sources, Adopt and Procedures; the member's Why and History; Impact's Meaning; the Agent's Context; the Knowledge route's Forget. |
| Central | `control.skills.inspect\|retire\|restore`; `projectcentral.inspect`, `init`, `adopt`, `migrate` (preview and apply); `projectcentral.self.*`; `central.remember` | The member's Retire and Restore; the workspace's Ground and Self; Remember. Through `invoke_action`, and the writes need §1.1's route. |
| Workcell | `doctor`, `discover`, `plan`, `instances list\|usage`, `recover`, `reconcile --desired`, `release`, `sandboxes reconcile` | The workcell's Services, Release and resources; the Remote carrier's Offers and Plan; Ground hygiene's Material page. |
| Actuation | `authority issue\|revoke` | Grants on Custody. |
| Software Factory | `factory development pads`, `pads-write`, `pads-run`, `pads-record`, `pads-due` | Prompt pads (§19.22): every pad write and Run now. |
| Software Factory | a read of the project-development ledger (bounded intent, success criteria, PraxisCondition); the cognitive view (Run Thought); StructuralFidelityEvidence; `development mutate` for ContinueCommission; the attempt `retry` | The Intent panel, Review's criteria, the Thought page, the Ledger's Worked under line, the Run device's Structure reading, and the Run map's Continue and Retry. |

**Build, 21 Oct:** routed (`1dc4b6821`, `a28843087`): Actuation's agency, realised, stream, activity and usage, and the research
comparisons held, assess, mask and review (the dead `correlate` call removed); Workcell's connections, machine and connect, and the
seat's join and release; AIKit's gateway send, delegate and team, capture, inbox, promote, trust record, praxis method run and prove,
set package export and wiki-shape; Factory's attempt decision and custody; QL's kernel m1 and scene compose and world. The M3 clock's
law and generation are QL's own `ql.m3-state/v1` (QL-MEF `ec79681`), passed verbatim by m3_reception, which now takes `set-matrix`.
The Frames monitor reads AIKit's own gateway journal (`aikit gateway replay`, EpiLogos/ai-kit#540): Hermes's ring belongs to Hermes's
own TUI process, and AIKit's coexistence law forbids reading a foreign gateway's state. Not routed: `actuation-research
comparison.run` (it runs models). The rest of the table is builder E's, in order (Factory's pads, Workcell, QL, AIKit, Actuation).

### 1.3 Refusals that are now stale (the owner answers; only the binding is behind)

| Binding | It refuses | What answers now |
|---|---|---|
| `central/devices/dayBinding.ts:44-48` | the Day's moves | `central.day.settings.read`, `central.day.moves.read` |
| `central/devices/groundDevices.ts:6` | the git census | `central.git.census`, through `invoke_action` |
| `central/devices/pageBindings.ts:210` | Beings and Things ties | the kernel page op, which Clip view already uses |
| `agent/devices/taskBindings.ts:211` | attempt-review's Stands | `factory_owner AttemptReceiving` (`factory.rs:373`), which the take lanes already use |
| Scope | world relations | `central.world-relations.save`, `central.world.effective-sources` |
| Wiki widget | its links (empty today) | `central.wiki.read` |
| Search | "Your world" | `control.search` |
| page takes | page history | `central.temporal.source-history` |
| Diff widget | anything but O-I (it reads one fixed repository, `widgets/railDevices.tsx:100`) | — fix to follow the selected seat |

**Build, 21 Oct:** bound by builder A (`ca84f65ce`); the Workspace's Accept, Ensure and Relate, and the Self page's shapes,
followed in `bfe605406`.

### 1.3b Shell models the new designs need

`centralHygieneModel.ts`: the finding kinds Ground hygiene now draws (root-part-missing, root-mixed, scaffold-missing,
source-unrecognised, binding-drift, binding-lost, sandbox-orphan, sandbox-unproven) with classifiers, and the tenders init-root,
reproject-scaffold, recognise-source, reconcile-binding, release-orphans. The design's sample writes these by hand today.

### 1.4 Designs with no binding yet

- `workcell:workcell`, `ai-kit:messages`, `actuation:voice`, `widgets:terminal`, `ai-kit:capture-skill`, `ai-kit:knowledge-route`;
- `techne:canvas`, `techne:journey`, `techne:light`, `techne:palace`, `techne:timeline`;
- `knowledge-graph:graph`, because the family publishes scope, filters and display faces instead;
- `expressions:field` (`components/devices/ExpressionsDeviceView.tsx:122`);
- `quaternal-logic:binding`, `quaternal-logic:m-prime-matrices`;
- `dlw:session-grid` and `dlw:arrangement-ruler`, because the shell draws its own views (`frame/tracks/SessionGrid.tsx`,
  `ArrangementRuler.tsx`). The design is the standard, and the shell's view must match it.

About forty more are partly bound; each row in the evidence names what is missing.

**Build, 21 Oct:** bound: `workcell:workcell` and `ai-kit:messages` (`0321415ea`); `actuation:voice`, `widgets:terminal` and
`ai-kit:knowledge-route` (`ed21cfc09`); Technē's five and `knowledge-graph:graph` (`a84bea1b2`, `18f57d4e0`); `expressions:field`,
`quaternal-logic:binding` and `quaternal-logic:m-prime-matrices` (`4a96463bf`). Open: `ai-kit:capture-skill` (builder B2);
`dlw:session-grid` and `dlw:arrangement-ruler` (builder A).

### 1.5 Owner operations that do not exist (build them in the owning product, as part of the same development)

| Owner | What is missing |
|---|---|
| Workcell | placement; reachability and Lag; commit, push and land for Git / landing; moving a session to another machine; leases and checkpoints (`MaterialLeaseProvider`, `MaterialCheckpoint` are internal only). |
| Central | a mutation class for actions that reconcile derived state only (`projectcentral.source.read`, `source.returns`, `source.return_read`, `source.transfer.resolve`, `change.horizon` are `locally-mutating` because they reconcile the Source Change Horizon in `.central`): since `a4c97faa9` the kernel takes Central's class as its word, so each of them retires the whole read model, and the shell asks `source.read` on every document save and every Flow instance read; `personal.notify` installed, keeping its requests and deliveries as a read the kernel can route (Notifications); listing and withdrawing presence consents (`nara_presence` publishes; nothing lists or withdraws); `personal.show` installed (only the library registers it); an open and reveal that resolve a page's file (`work.open` and `work.reveal` resolve a Work directory only); applying Control proposals (library-only today; apply refuses without a human-authority route); an Agentset Join field; listings of worlds, subjects and places for Beings and Things; commenting on a source return; `personal.notify` and `personal.show`, which are not installed. |
| Actuation | a store read that hands a session's records to the routed reads (`agency`, `realised`, `stream`, `activity` and `usage` each project one record they are handed, and nothing the shell holds is one: the Ledger's tokens and spend and the Agent's run pages wait on it); a list of grants (`AuthorityStore::read` reads one ref); continuity (`continuityDelta` is library-only); the heartbeat cadence; per-task Launch, Retry and Stop; session Telemetry and Solo; a writer for spend. |
| Software Factory | Scope's reach and write enforcement (WO-SF2); the custody record's autonomy, gate and escalate fields; the First, Quorum and Weighted joins; an owner for a task's success criterion; a pad's link to the AIKit Routine that carries its schedule; unit decisions in Approvals (`factory attempt decision`); composing a new Commission (`factory.commission-request/v1`). |
| AIKit | the agent-to-agent ingress rule; the Knowledge route's Read budget and Search first; an owner read of Living Knowledge's impact for a set of readings (the Affected page); a read of the last turn's bounded blocks (Context); a read of a Flow's last thought (`flow changed-since` needs `--thought <file>`); a CLI leaf for the reflection law's verdict (Meaning). |
| Quaternal Logic | **Built 21 Oct:** the External Context Frame CLI (EpiLogos/QL-MEF#344), the scene centres' names, mantras, yantras, tattvas and decans (#345), `ql wiki living-plan` (#346), the ledger's children by reference (#347). **The library holds none of these, so nothing is built:** the M3 clock's Run and Rate (M3State advances only by an explicit AdvanceClock or SpandaAdvance; the display clock's rate is fixed when the field is built), the Deck's Move and Turn (QL shuffles once and draws in sequence), the WikiFrame refraction candidate counts (the engine never fills them), a centre's petal count. Earlier list: a CLI for the External Context Frame reading (`read_external_context_frame` is library-only); a CLI for `plan_living_wiki_refraction` (the graph's Aperture); WikiFrame refraction candidate counts (the Lens's proposals); a rule naming when a rack part is "verified"; a kernel address for a matrix cell; portal traversal; the Deck's Move and Turn; a tuning owner for Exact-ratio; the Decision helper's When and Deadline; the M′ Situation matrix; the M3 clock's Run and Rate. |

### 1.6 What the build waits on the owner for (21 Oct)

Each needs the owner's word before it is built; the build keeps the device's refusal exact meanwhile.

| Question | Where it stands |
|---|---|
| Who may change a custody record's autonomy, review gate and escalate-to after assignment? | Factory sets them at `custody assign` (EpiLogos/Factory#288); `update` admits only the holding occupant, and Factory names no person authority for custody. |
| Where do a task's typed success-condition words live, given "the words stay in the source they come from"? | Review's criteria stand absent. |
| What do a group's First, Quorum and Weighted joins do? | The manual names them ("stand dark, because no owner combines returns that way yet") without semantics; Central keeps the Join field (EpiLogos/Central#291) and nothing combines returns by it. |
| Should a notification that asks for a callback be delivered without it? | macOS's notification provider supports no callback, so Central keeps such a request as refused, with its open target (EpiLogos/Central#288). |
| Git / landing's commit, push and land from the desk; moving a session to another machine. | Not routed: they act on repositories and machines. |
| A mutation class for Central actions that reconcile derived state only. | See §1.5's Central row: since `a4c97faa9` each such read retires the read model. |
| Publishing SharedField's presence-consent kinds to maincloud. | Not needed after all: the kinds are client-side (`2f9a664cd`); the hosted server module is unchanged. |
| A tie from an AIKit session space to the Central agent set it runs. | The Agentset rack's Join cannot say which set to save without it (owner-side, AIKit or Central). |
| Planetary hours. | Scale mapping's hour ruler: no owner computes them. |
| A WikiSubjectSource over the cradle's wiki register, composing the presented frame's WikiRefractionTarget; an owner for the Frame page's sixfold mapping (the material's six positions). | The Lens's reading and frame reading stay absent: QL reads a target and a mapping its caller supplies, and nothing supplies them. |
| The QL map holds both spellings for M4's positions (#4-0…5 and #4.0…5) and for M4.5's children (#4.5-0…5 named, #4.5.0…5 unnamed). | The shell keeps the nesting threshold's spelling; the map's refresh is QL's, never the build's. |

## 2. For the design lane: what to design before the build reaches it

Each package lands as catalogue designs and manual entries on `main`, the way every device does. Where an existing device can hold a
capability, it lands as a page, an act or a view of that device.

| Package | Capabilities | Home |
|---|---|---|
| D1 The world a run stands in | Workcell's local-world, services, observation, release, exposure, checkpoints, instance-registry and collection; discovery and planning | Pages in `workcell:workcell`'s Full (World, Services, Exposure with Open, Release); offers and planning failures as the Remote carrier's Standing; collection in Factory's Results tile. |
|  | **Landed 21 Oct:** World, Services, Exposure and Release pages on `workcell:workcell` (§19.23), with the resources in Working here; Offers and Plan on the Remote carrier's Standing page (§19.18). Collection landed 21 Oct as Outputs on Runs (`workcell collect`). | |
| D2 Ground and machines | Central's root, machine declaration, reconciliation and recovery, authored-ground and reproject; Workcell's reconciliation and sandbox clean-up | A Machine device (declared beside observed; plan, apply, verify; a Recover page) beside Ground hygiene; findings with tenders on Ground hygiene. |
|  | **Landed 21 Oct:** `central:machine` (§18.7; every operation reachable through `invoke_action`); Ground and Material pages of findings and tenders on Ground hygiene (§18.5). | |
| D3 Factory's developmental work | run-map, journey-continuity, build-evidence, intent-return, bounded-intent, structural-ground, cognitive-reading, run-thought, praxis-condition; Recognition and Commission | A Run map device (units, dependencies, barriers, lifecycle, Recognition); a Journey view and a Review page behind Stands on `software-factory:attempt-review`; an Intent panel in Factory's Clip view; a Thought filter on the Thread. |
|  | **Landed 21 Oct:** `software-factory:run-map` (§19.25), the Journey view and the Review page on Runs, the Intent panel, the Thought page, Worked under on the Ledger, and Structure on the Run device. | |
| D4 Prompt pads | AIKit routines; Factory's pad bank; praxis-fitness | `software-factory:prompt-pads`: §19.22 is written, but no design exists. |
|  | **Landed 21 Oct:** `software-factory:prompt-pads`, §19.22 rewritten to it. | |
| D5 Practice upkeep | AIKit discovery, adoption, procedures, explain and familiarity; Central skills retire and restore; living-knowledge, reflection, continuity | Sources, Adopt and Procedure pages on the Skillset rack; Why and History on the member device, with Retire and Restore; an Affected page on the Knowledge route; a Meaning page on Impact; a Context page on the Agent. |
|  | **Landed 21 Oct:** Sources, Adopt and Procedures pages and an Unused filter on the Skillset rack (§19.7); Why and History, with Retire and Restore, on the member (§19.8); Affected on the Knowledge route (§19.9); Meaning on Impact (§18.6); Context on the Agent (§19.4). Close-out verify landed 21 Oct in the Day's Close section (§18.2). | |
| D6 Worlds and pages | work-entry (Open, Reveal), remembered-note, projectcentral-lifecycle, development-field-source, flow-cognition, flow-changed-since, personal-surface, guided ground authoring | Open and Reveal in the track and clip menus (§10.9); Remember as a fifth selection act; the adopt-or-migrate preview on a folder drop; a Self page in a world's track settings; Contemplate and Changed since on `central:flow-document`. |
|  | **Landed 21 Oct:** Open and Reveal in §10.9; Remember as the fifth passage act (Central's Clip view); Ground (adopt or migrate on a folder drop) and Self (the world's self-description, which also carries guided ground authoring) pages on `central:workspace`; Thought (Preflight, Contemplate, Changed since) on `central:flow-document`; the browser's top level as the personal surface (§18.1). The Selection act and the five passage acts landed 21 Oct on `central:document` (§17.8). | |
| D7 Authority and continuity | Actuation metagency (grants) and continuity | A Grants page on the Agent's Custody; a Changed since line on Identity. |
|  | **Landed 21 Oct:** a Grants page on Custody, carried by the Agent; Changed since on Identity (§19.4). | |
| D8 Quaternal Logic in Technē | external-frame, service-readings, wiki-refraction, techne-reading; vak-source and vak-context; living-wiki; kernel-operators; the M-registry ledger; stage; Nara's activity and occasions; meta-recognition | A Lens effect on a Technē reading's chain (§17.1 names lens effects but specifies none); a `vak:` kind in Search; an Aperture page on the graph; a Cell group on the M′ matrices; the racks of the instruments of the map with their dark parts (§16.16); a Stage page on the Torus; consent for a shared sky (§24.6). |
|  | **Landed 21 Oct:** `techne:lens` (§17.11, Lens and Frame pages over one QL Technē reading); a `vak:` kind in Search with the neighbourhood at depth 0–2 (§18.4); an Aperture page on the graph (§17.3); a Kernel page on the M′ matrices (§22.6); `quaternal-logic:map-rack` (§22.9, §16.16), carried as a Rack page by the Torus, the Sky and the M3 clock, with dark parts named; a Stage page on the Torus (§21.2); a Share page on the Sky for presence consent (§22.1, §24.6). Still open: Nara's activity (its home, the practice world's track in §24.1, has no device) and the replay half of occasions; meta-recognition is QL-MEF's own wiki and stays backstage. | |
| D9 Settings | Central's system (declared, effective, active, staged); harness install, credentials, profiles, routines, secret projections | The Settings window (`settings/*.tsx`) is outside the catalogue and the manual. Write its entry, and catalogue its pages. |
|  | **Landed 21 Oct:** `settings:window` (§10.10), one device with the window's pages (Harnesses and models, the owner settings, Profiles, Credentials as references only, Machines and services, Automations, Appearance, Products and updates, System's four axes) and Review. It carries what the shell's Settings draws today; per-row scope overrides are folded into the page's Applies to. | |
| D10 Attention and hosting | Notifications; Workcell model hosting | Needs-you in Messages and Approvals, plus a Notifications monitor; a hosted model's health beside the Decision helper's Provider. |
|  | **Landed 21 Oct:** `widgets:notifications` (§23.9), a monitor of what owners raise for attention, beside Messages and Approvals; hosting and kept-by on the Decision helper's Provider page (§19.20). Before building an owner for notifications, read the models that exist: `shared-field/activity.mjs` (`notificationFromActivity`) and `packages/oi-pi/contrib/lib/attention.ts`. | |

### 2.1 What the build found the designs still need (21 Oct)

The builders bind the designs as they stand; where a design or the manual is wrong or short, they leave it and say so here. Each line
names the file and the change.

| Design or section | What it needs |
|---|---|
| `central__ground-hygiene.tsx` (:61-62, :111) | `git\.census` in PAGES.checkouts.ops, and `central\.git\.` kept off the Ground page's ops. Its hand-written Ground and Material findings can come from the model (`groundFindings`, `materialFindings`), as its checkout findings already do. |
| `widgets__wiki.tsx` | The `external` link state drawn as its own kind, not "does not resolve". |
| `workcell__workcell.tsx` | Worker.mode and Worker.track optional, drawn as none: today they render "undefined", so Working here stays absent although the claims name actors. `laneOf` should prefer the chosen project. |
| `techne__palace.tsx` | Pages for Palaces/Enter, Compose, Integral whole and Portals; a `scene` room kind; the guide text read from an owner `guide` key (it hard-codes "free mnemonic composition"); locus stepping; bookmark Rename and Delete. |
| `techne__light.tsx` | Folded says "0 sensors" with no reading (it should draw "—"); the widget's text overflows. |
| `knowledge-graph__graph.tsx` | A `fit` act for the surface's own Fit. |
| `actuation__harness-model.tsx` | FullWithStage builds its stage with `recordingFromThread` (a recording made up from thread rows at fixed steps). It should read the binding's `stage` key, which the binding already fills, and say "No run event names this session yet." without one; declare `stage` and give it a fixture recording. |
| Central's Day (`central__day*.tsx`) | A control for `openTomorrow`. |
| `scope.tsx` | The Reads rows want the include/exclude toggles (`r:<id>`) that Context & world had. |
| `widgets__terminal.tsx` | The screen, the shells and the grid draw from the design's own SHELLS constant, not from its keys. |
| `ai-kit__knowledge-route.tsx` | The Sources request is lens-level, but Central's AgentProfile carries source refs (of 39 real profiles, 21 carry none; the rest `central:source:…` or `file://`). |
| `clip__central` and §18.1 | No place for the Flow device's Thought page, which §18.1 puts under Clip view ▸ Contemplate. |
| `central__beings.tsx`, `central__things.tsx` | The manual names no such device: a Being or Thing page is the Document's Full (§17.8), its ties the Clip panel (§18.1). The designs duplicate both and nothing places them. |
| `central__workspace.tsx` | Its Track page draws the window's workspace book (Remember, Keep, Launch); the manual's Track page holds Name, World, Kind, Folder, Place and Workspace. |
| `expressions__field.tsx` | The DIAL helper, Toggles and Radios spread no `st(p, key)`, so a disabled dial cannot draw its reason; the widget meter multiplies an absent level into `--level:NaN` (it should draw unread). |
| `quaternal-logic__m-prime-matrices.tsx` | Its comment calls m1.lens12, m1.context_frame and m1.basis M1 engine config; §22.6 Transport says the Reading follows the key, root and scale. A key for Apply over m3_reception's existing `apply-matrix {family}` would let Apply act now. |
| §20.3 and §22.8 | §20.3's Body chain (Physics, Resonance, Torus) and §22.8 (Binding "sits in the Studio's body chain") disagree; the shell's STUDIO_SECTIONS does not hold Binding. The build put the M′ matrices on techne:m1–m4 by the semantics table's M′ provenance (§22.6 "the rack of its instrument"). |
| `actuation__frames-monitor.tsx` (:86, :311, :416) | Draw `st(p,'frames').disabled` instead of the fixed "No reading of the frames.", so AIKit's refusal shows; stop defaulting a missing `dir` to 'in' (an undirected frame draws as Received); draw `ring` when `ringCap` is absent (the journal declares no cap). |
| `ai-kit__messages.tsx` | The conversation rows want a drag carrying their Communique ref onto a track; the drop names the work and asks for a reason, setting `delegate` to {communique, work, reason} (the binding writes it). Its header says groups come from `aikit gateway team`: they come from Central's `central.agent-set.list`. |
| `skills.tsx` | A package directory field for Export (`aikit set package export` needs an absolute --out). |
| `workcell__seat.tsx` | Whether `actor` (Yours vs Held) is the desk's actor, now that Join claims as it. |
| `software-factory__agent-custody.tsx` | Autonomy, gate and escalate are not fields of Factory's custody record (custody assign|update carry Position, work, reason, state and hand-off Position); see §1.5. |
| `settings__window.tsx` | Places for what the Settings window does today and the design does not draw: per-setting Undo; the Details panel (axes, reconciliation, reading basis, default); the help aside; unavailable owners with their reason; the owner-plan and acknowledgement JSON; Open Expressions; Machines' expected operations when adding a machine; preparing a new schedule; harness install and reveal notes; the dependent column choices; ↑/↓/Enter through search results; a back control naming the return. The port waits on `dlw/settings-window-port` until these exist. |
| `central__workspace.tsx` (:674) | The Name TextField should spread its standing, so a refused rename shows before it is pressed. |
| `widgets__notifications.tsx` | A line saying why requests are absent. |
| `dlw__session-grid.tsx` | Whether the design or the shell's established behaviour wins for the group roll-up (the shell always rolls up; the design only when folded) and the rails (the shell draws them full height). Still to bring the shell to: the clip cell's second line (mode, follow, takes) at 52px, the running clip's progress (no reading), the ruler's loop region, overview strip and scale label. |
| Timeline's Save view (`techne__timeline.tsx`) | A name for the saved view: the frame's save-view takes one. |
| `quaternal-logic:map-rack` | A face: a `rack` liveSemantic requires routesTo, and M4′'s rack routes nothing. |
| The four environ faces (§25.6) and their places | Drawn by the build in the catalogue's faces kit and parked for adoption on `dlw/environ-faces-proposal` (`871182e98`): the Gateway's river, the NOWs' seasons, the Seat's succession and Ground hygiene's erosion, each from the real state its binding reads (static by rule, its reason when there is none), and each design's Full with its environ as a 120 px band at the pane's foot (`actuation__gateway`, `widgets__nows`, `workcell__seat`, `central__ground-hygiene`). Whether a face also belongs on a tile is the design's call. |
| `actuation__torus` (Damping, Strike, Voices) | QL's scene holds a decay per second and a strike depth in metres (declared policy), not a Q factor and a percentage; no owner holds a polyphony. The design's `stage.procedures` ("the files you keep"): no owner lists the person's own procedures; the frame holds one example. |
| Approvals, a unit decision | Show the question with its own options (Factory's "Resume bounded work" / "Cancel bounded work"); today the detail reads "<unit> asks to run" and puts the question in the Command block. |
| The Ledger's receipts | Keyed by a ref: source returns carry no number. |
| `widgets__diff.tsx` | A `repo` key naming which world's repository the Diff shows (it follows the selected seat or world since `9f8a5932a`; the design draws only branch and HEAD). |
| The Sky's Share page (`quaternal-logic__sky.tsx`) | Withdraw is drawn disabled in the design's own words and has no key: a per-consent-row key lets it bind to nara_presence's withdraw. |
| `quaternal-logic__chakra.tsx` | Colour by QL's `element_ref` or tattva name: QL names the tattva ("Prithvi Tattva"), and Ājñā and Sahasrāra carry none, while the design keys on 'Earth' and draws 'Beyond'. Draw QL's yantra text: QL holds no petal count. QL's mantra is a phrase ("LAM - earth element activation"), not the design's sample syllable. |
| The map rack's chains | QL holds more than six children in places (M2-5 has nine bodies, M3-1 eight trigrams); the design's chains draw six and its fixtures cut at six. |

## 3. Manual corrections made with this ticket

| Section | Correction |
|---|---|
| §19.24 Making an agent | Central's creation chain: your words go to `agent-profile.express`, Central writes a proposal, and Accept keeps it. Groups go through `central.agent-set.propose`. |
| §19.5 Experiment | Condition joins the variables; Levels 1–3; Repeats 1–32. |
| §19.9 Knowledge route | No Web source: the sources are wiki, project knowledge and code. |
| §19.10 Agency gateway | Entry and Coexist are added. |
| §19.11 Capture skill | Form, Proposal, Held for, Resembles, Accept, Release and Remove replace Fit and Lands as. |
| §19.14 Approvals | Wait is 1 min–24 h, default 5 min. |
| §23.2 Files | Its owner is Central, with AIKit. |
| §19.2 Gateway | Its writes go through the harness's own control; Submit has no key in the design and is removed. |

## 4. Freshness

- `suite/product-capabilities.json` is behind the products. Its pinned JSON hashes still match, but every product CSV is newer.
  - Central's CSV drops `flow` and adds `agent-expression-source` and `ordinary-file-creation`. The installed ctrl adds the Day's moves,
    settings, rollover and close-carry.
  - Quaternal Logic has 54 capabilities.
  - No record names Factory's Prompt pads, AIKit's `decide`, or AIKit's `gateway who|send|team`.
- Regenerate the catalogue before the next pass.
