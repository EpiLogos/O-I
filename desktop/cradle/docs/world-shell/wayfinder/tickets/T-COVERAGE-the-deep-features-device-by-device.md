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
| Quaternal Logic | `scene compose\|world` | The Chakra's and Sitting's centres. |
| Quaternal Logic | `ql_m3_generate`, asked from `m3_reception` | The M3 clock's Law and Generation. |
| Hermes | a frame-ring read | The Frames monitor. |
| AIKit | `source`, `collate`, `adopt`, `procedure`, `bypass`, `unused`, `explain`, `history`, `work continuity pressure\|commands\|closeout verify`, `knowledge frame`, `knowledge forget` | The Skillset rack's Sources, Adopt and Procedures; the member's Why and History; Impact's Meaning; the Agent's Context; the Knowledge route's Forget. |
| Central | `control.skills.inspect\|retire\|restore`; `projectcentral.inspect`, `init`, `adopt`, `migrate` (preview and apply); `projectcentral.self.*`; `central.remember` | The member's Retire and Restore; the workspace's Ground and Self; Remember. Through `invoke_action`, and the writes need §1.1's route. |
| Workcell | `doctor`, `discover`, `plan`, `instances list\|usage`, `recover`, `reconcile --desired`, `release`, `sandboxes reconcile` | The workcell's Services, Release and resources; the Remote carrier's Offers and Plan; Ground hygiene's Material page. |
| Actuation | `authority issue\|revoke` | Grants on Custody. |
| Software Factory | `factory development pads`, `pads-write`, `pads-run`, `pads-record`, `pads-due` | Prompt pads (§19.22): every pad write and Run now. |
| Software Factory | a read of the project-development ledger (bounded intent, success criteria, PraxisCondition); the cognitive view (Run Thought); StructuralFidelityEvidence; `development mutate` for ContinueCommission; the attempt `retry` | The Intent panel, Review's criteria, the Thought page, the Ledger's Worked under line, the Run device's Structure reading, and the Run map's Continue and Retry. |

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

### 1.5 Owner operations that do not exist (build them in the owning product, as part of the same development)

| Owner | What is missing |
|---|---|
| Workcell | placement; reachability and Lag; commit, push and land for Git / landing; moving a session to another machine; leases and checkpoints (`MaterialLeaseProvider`, `MaterialCheckpoint` are internal only). |
| Central | `personal.show` installed (only the library registers it); an open and reveal that resolve a page's file (`work.open` and `work.reveal` resolve a Work directory only); applying Control proposals (library-only today; apply refuses without a human-authority route); an Agentset Join field; listings of worlds, subjects and places for Beings and Things; commenting on a source return; `personal.notify` and `personal.show`, which are not installed. |
| Actuation | a list of grants (`AuthorityStore::read` reads one ref); continuity (`continuityDelta` is library-only); the heartbeat cadence; per-task Launch, Retry and Stop; session Telemetry and Solo; a writer for spend. |
| Software Factory | Scope's reach and write enforcement (WO-SF2); the custody record's autonomy, gate and escalate fields; the First, Quorum and Weighted joins; an owner for a task's success criterion; a pad's link to the AIKit Routine that carries its schedule; unit decisions in Approvals (`factory attempt decision`); composing a new Commission (`factory.commission-request/v1`). |
| AIKit | the agent-to-agent ingress rule; the Knowledge route's Read budget and Search first; an owner read of Living Knowledge's impact for a set of readings (the Affected page); a read of the last turn's bounded blocks (Context); a read of a Flow's last thought (`flow changed-since` needs `--thought <file>`); a CLI leaf for the reflection law's verdict (Meaning). |
| Quaternal Logic | portal traversal; the Deck's Move and Turn; a tuning owner for Exact-ratio; the Decision helper's When and Deadline; the M′ Situation matrix; the M3 clock's Run and Rate. |

## 2. For the design lane: what to design before the build reaches it

Each package lands as catalogue designs and manual entries on `main`, the way every device does. Where an existing device can hold a
capability, it lands as a page, an act or a view of that device.

| Package | Capabilities | Home |
|---|---|---|
| D1 The world a run stands in | Workcell's local-world, services, observation, release, exposure, checkpoints, instance-registry and collection; discovery and planning | Pages in `workcell:workcell`'s Full (World, Services, Exposure with Open, Release); offers and planning failures as the Remote carrier's Standing; collection in Factory's Results tile. |
|  | **Landed 21 Oct:** World, Services, Exposure and Release pages on `workcell:workcell` (§19.23), with the resources in Working here; Offers and Plan on the Remote carrier's Standing page (§19.18). Still open: collection in Factory's Results tile. | |
| D2 Ground and machines | Central's root, machine declaration, reconciliation and recovery, authored-ground and reproject; Workcell's reconciliation and sandbox clean-up | A Machine device (declared beside observed; plan, apply, verify; a Recover page) beside Ground hygiene; findings with tenders on Ground hygiene. |
|  | **Landed 21 Oct:** `central:machine` (§18.7; every operation reachable through `invoke_action`); Ground and Material pages of findings and tenders on Ground hygiene (§18.5). | |
| D3 Factory's developmental work | run-map, journey-continuity, build-evidence, intent-return, bounded-intent, structural-ground, cognitive-reading, run-thought, praxis-condition; Recognition and Commission | A Run map device (units, dependencies, barriers, lifecycle, Recognition); a Journey view and a Review page behind Stands on `software-factory:attempt-review`; an Intent panel in Factory's Clip view; a Thought filter on the Thread. |
|  | **Landed 21 Oct:** `software-factory:run-map` (§19.25), the Journey view and the Review page on Runs, the Intent panel, the Thought page, Worked under on the Ledger, and Structure on the Run device. | |
| D4 Prompt pads | AIKit routines; Factory's pad bank; praxis-fitness | `software-factory:prompt-pads`: §19.22 is written, but no design exists. |
|  | **Landed 21 Oct:** `software-factory:prompt-pads`, §19.22 rewritten to it. | |
| D5 Practice upkeep | AIKit discovery, adoption, procedures, explain and familiarity; Central skills retire and restore; living-knowledge, reflection, continuity | Sources, Adopt and Procedure pages on the Skillset rack; Why and History on the member device, with Retire and Restore; an Affected page on the Knowledge route; a Meaning page on Impact; a Context page on the Agent. |
|  | **Landed 21 Oct:** Sources, Adopt and Procedures pages and an Unused filter on the Skillset rack (§19.7); Why and History, with Retire and Restore, on the member (§19.8); Affected on the Knowledge route (§19.9); Meaning on Impact (§18.6); Context on the Agent (§19.4). Still open: close-out verify beside the Day close (`day.tsx`, the pages lane). | |
| D6 Worlds and pages | work-entry (Open, Reveal), remembered-note, projectcentral-lifecycle, development-field-source, flow-cognition, flow-changed-since, personal-surface, guided ground authoring | Open and Reveal in the track and clip menus (§10.9); Remember as a fifth selection act; the adopt-or-migrate preview on a folder drop; a Self page in a world's track settings; Contemplate and Changed since on `central:flow-document`. |
|  | **Landed 21 Oct:** Open and Reveal in §10.9; Remember as the fifth passage act (Central's Clip view); Ground (adopt or migrate on a folder drop) and Self (the world's self-description, which also carries guided ground authoring) pages on `central:workspace`; Thought (Preflight, Contemplate, Changed since) on `central:flow-document`; the browser's top level as the personal surface (§18.1). Still open: a Selection act control and the passage acts on `central:document`, which §17.8 already names. | |
| D7 Authority and continuity | Actuation metagency (grants) and continuity | A Grants page on the Agent's Custody; a Changed since line on Identity. |
|  | **Landed 21 Oct:** a Grants page on Custody, carried by the Agent; Changed since on Identity (§19.4). | |
| D8 Quaternal Logic in Technē | external-frame, service-readings, wiki-refraction, techne-reading; vak-source and vak-context; living-wiki; kernel-operators; the M-registry ledger; stage; Nara's activity and occasions; meta-recognition | A Lens effect on a Technē reading's chain (§17.1 names lens effects but specifies none); a `vak:` kind in Search; an Aperture page on the graph; a Cell group on the M′ matrices; the racks of the instruments of the map with their dark parts (§16.16); a Stage page on the Torus; consent for a shared sky (§24.6). |
| D9 Settings | Central's system (declared, effective, active, staged); harness install, credentials, profiles, routines, secret projections | The Settings window (`settings/*.tsx`) is outside the catalogue and the manual. Write its entry, and catalogue its pages. |
| D10 Attention and hosting | Notifications; Workcell model hosting | Needs-you in Messages and Approvals, plus a Notifications monitor; a hosted model's health beside the Decision helper's Provider. |

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
