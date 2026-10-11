> **SUPERSEDED — SUPERSEDED — folded into DLW-PLAN.md (§0–§3, §5–§9). Read DLW-PLAN.md only.**

# DLW — the Digital Logos Workspace: unified product-build plan (DRAFT p1)

**Standing:** compiled draft, lane `zcode:dlw-compile-p1`, dispatched by
orchestrator `zcode:world-shell-orchestrator`, 2026-10-10. This document is an
**extraction, not an authorship**: every claim cites its source (path, and line
where the source is stable). Where the sources are silent or ambiguous the text
says `OPEN-QUESTION (for the owner): …` and fills nothing from imagination.
Where two sources conflict, both are recorded verbatim with the conflict
marked. Consumer: a build model (Claude Opus) left alone to build the full app.

**Naming law for this document.** The build target is named **DLW — the
Digital Logos Workspace** here. Provenance of the name: it appears in the
compilation commission (orchestrator, 2026-10-10) as "the owner's declared
product identity", and the orchestrator confirms it is the owner's name going
forward; **the name does not appear in any ground document or in the master
planning session transcript** (grep over `Work/` + `Control/`, 2026-10-10:
zero hits for "Digital Logos Workspace"; "DLW" hits are package-lock hash
noise only). The ground's own names for the same artifact are: "the world
shell" / "the new shell" (`WORLD-SHELL-DESIGN.md` title: "World shell design —
one World, four projections, real panes, one rack"), the "O-I Shell Candidate"
app, and "the complete Epi-Logos working world" (owner words,
`ASTRA-BRIEF.md`). OPEN-QUESTION #1 (naming adoption) records this for the
owner. Until the owner adopts the name on the ground, "DLW" and "the world
shell" denote the same artifact here.

**Master planning source.** The owner's planning session of record is ZCode
session `sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2` ("Ableton Shell Handover
and AI Agent Planning"); its owner decisions are cited here as
`[session]` with the verbatim words. Its durable artifact of record is
`new-shell/WORLD-SHELL-DESIGN.md` — cite both wherever a decision stands.

**Governing precedence** (stated by the sources themselves): PROGRAMME.md
owner rulings "supersede older wording wherever the two differ"
(`PROGRAMME.md:14-15`); mockup revisions supersede earlier revisions
(`WORLD-SHELL-DESIGN.md:103-104` — "Where this conflicts with Revision 2
below, this revision stands"; Rev 5 is "the final pass", :17-19); the
DEVELOPMENT-TRACK (9 Oct) "supersedes the session's completion-shaped
framings" (`DEVELOPMENT-TRACK-2026-10-09.md:6-7`).

---

## 0. The product — what DLW is, in the sources' own words

DLW is **one desktop application: a Tauri/Rust host whose UI presents one
World through four projections, in five working modes plus the Epi-Logos
lens, across six product families, on one transport, one rack, one encounter
spine.** Every element of that sentence is sourced:

- **One working environment.** MAP.md destination: "The full system shape,
  landed: **one working environment** — the new shell — holding all six
  product families plus Expressions and the musical instrument as admitted
  inhabitants; the four projections over one World; the Archetypal-Earth code
  ported corpus-neutral as the Earth/Graph/Aion foundation; every device at
  the mockup's widget standard with real capabilities in the waiting component
  forms; native-actions adherence audited; capability matrices and the UX
  spine reconciled to the landed UI; both verticals passing"
  (`wayfinder/MAP.md:7-16`).

- **The design law.** "One World, four projections, real panes, one rack":
  the World is the shared semantic field owned by native owners, never
  rendered directly, always encountered through a projection; four primary
  projections (Earth/Solar-System · Timeline · Canvas/Constellation ·
  Expressions) render the same World material as siblings; the shell centre is
  a composition of real panes; devices of all kinds attach to one rack — "the
  plugin system of the whole environment, generalised from Ableton's device
  chain" (`WORLD-SHELL-DESIGN.md:299-323`, §1).

- **The endpoint, owner's words** (`Work/O-I/docs/research/ableton-live-12.0.25/ui/ASTRA-BRIEF.md`,
  "THE INTENTION", verbatim): "Bring the live Expressions application and the
  M0/M5 techne app into the Ableton shell as first-class inhabitants —
  structured so the rest of the Ableton reverse-engineering (audio engine,
  devices, the physical M1–M4 instrument) lands into the shell as it matures,
  and the Factory and Central modes follow as ready inhabitants. The endpoint
  is the complete Epi-Logos working world: the M0 knowledge/wiki/graph field;
  Epii Prime–QL with Anima and Aletheia's team capabilities; the full
  physical-musical instrument and Nara; the professional instruments
  (Project/Graph, Canvas, Timeline, Journey, Places, Palace — plain names, no
  M-prefixes); native conversations, context, Day/NOW temporality, Factory and
  machine work supporting all of it. A person and their agents investigate,
  compose, perform, edit, save, return and continue through the same native
  work." (Recorded as the owner-confirmed commission at
  `ProjectCentral/now/agents/implementation-commission-recorded-astra-lane-2026-10-07.json`.)

- **The programme's standing commission** (`PROGRAMME.md:56-61`, verbatim):
  owner-commissioned 2026-10-07, in conversation: ""Feature enrichment, UI and
  UX harmonisation, and clarification of data saving and navigation" across
  the Technè arrangement, by reverse-engineering genuine reference products
  for actual functionality parity."

- **The six products / six families** (`WORLD-SHELL-DESIGN.md:669-706`, §12;
  owner words `[session]`): "**central, actuation, ai-kit,
  software-factory, workcell, quaternal-logic** … each contribute a **device
  family**, and that is the cleanest way to expose their functionality across
  every view, surface and lens." Owner verbatim: "our 6 products want their
  given family of plugins/devices, this is the cleanest way to expose their
  functionalities across the various app views/surfaces/lenses… already the
  mockup plans for agent and skill based devices, but you could, say, hookup a
  workcell plugin for running in a VM or remote machine, or you could add an
  actuation one to have specific tuning of the harness or model (maybe you
  want to setup an experiment for a run with telemetry, or use a custom agent
  loop)." And: "QL-MEF and ta-onta and all the rest of that become utterly
  available, here for this plugin/addition ontology, again the uncarved block,
  we have a neutral basis, plugins/params introduce scope for modulation and
  specification."

- **Five working modes, one transport.** Revision 5: "The rack: Session and
  Arrangement view icons, then the mode icons: Live (music, the shell's base
  mode, restored), Base · Central, Factory, Expressions and Technē. Every mode
  keeps the same transport slots in the same places. Only their meaning
  changes" (`WORLD-SHELL-DESIGN.md:23-30`). Landed as typed data:
  `packages/live-shell/ui/src/shell/modeGrammar.ts` ("The mode grammar —
  WORLD-SHELL-DESIGN Revision 5's tables as typed data… One transport, five
  meanings").

- **The planning posture** (owner, `[session]` msg 68, verbatim sic): "we are
  plannign the full system shape and sccope, all leanes come off and back to
  this one no?" — realised as `wayfinder/MAP.md` ("the centre of gravity for
  shell work", `PROGRAMME.md:3-10`) and honoured by this draft.

- **The craft bar** (owner, `[session]` msg 72, verbatim sic): "make sure the
  mockup standards remain as 'guides', the whole 'binding' langauge can beocme
  a too-rigid beaureaucracy that misses teh obvsiou need for the real feature
  to fucntion and look MUCH BETTER than teh mockups." Widget law
  (`MAP.md:106-115`): "A device is done when it works honestly through its
  owner AND functions and looks better than the mockup drew it… falling short
  of the guide is the only failure."

---

## 1. The ground truth — what exists today (the build starts here)

### 1.1 Landed code (verified on disk, 2026-10-10, seat `worktrees/env-1/o-i`, branch `agent/o-i-20261007-1639`)

All under `/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/` unless noted:

| Exists | What it is | Source of record |
|---|---|---|
| `shell/modeGrammar.ts` | Rev 5 as data: five modes × transport slots, per-mode Session\|Arrangement presentations, Rev 4 Clip\|Device pairs, per-mode browser categories (`cut` vs `waiting`), centre compositions, status identities; cross-tested against `inhabitants/sdk/modes.ts` by `tests/mode-grammar.test.mjs` | `DEVELOPMENT-TRACK-2026-10-09.md:89-104` (commit `20da871dc`); file header |
| `shell/` frame pieces | `ModeBrowser/ModeCentre/ModeContextDock/ModeDetail/ModeModeRail/ModeTransportBar`, per-mode content composition commits (`5d1a1da27`, `22144b951`, SDK commits `ec2cac658`, `b3d15a776`, `fe61d0c58`, `b80286705`, `c05843ad3`) | git log at seat |
| `inhabitants/manifest.ts` + family manifests | InhabitantManifest schema (face kinds parameter\|document\|conversation\|instrument; admission admitted\|waiting; declared extensions onto owner-admitted bases; owner-authority + face-collision refusals). Six families declared: **central 7/0, actuation 5/0, ai-kit 5/0, software-factory 6/0, workcell 4/0, quaternal-logic 0/6 all waiting with named owners** (sky, torus, m3-clock, deck, chakra, m-prime-matrices) | L2 ticket resolution (`wayfinder/tickets/L2-rack-family-manifests.md`), commit `5bd6ff239` |
| `inhabitants/` Central devices | hygiene, impact, day/now, subject-detail — 14 numbered readings each with `boundary_op`; civil ops DECLARED-never-fired | L7 ticket resolution, commit `ba2db1b52` |
| `inhabitants/ql/` + `qlMusicalExtension.ts` | musical declaration half: strict reading model, REAL standing states, six-ref identity tuple, u64 cursors, 48 kHz receipt, embedded policy (block 8192, lead/lookahead 0.5 s); **M2 modulation sources with `generates: false` in the type (D13 as compile-time law)**; `quaternal-logic:musical-l9` instrument face admitted with honest absence | L9 ticket resolution, commit `d0901c9ec` |
| `timeline/timeSpine.ts` | The time spine: Now (reads civil field, never a wall clock) · Occasion (retained snapshot basis + separately-qualified current admission) · Transport (playhead, drives nothing) · Chronos (read-only binding surface, honestly empty until QL binds) · Cron (cadences as parameters; every firing lands as a Timeline clip). Pure, no timers | L4 ticket resolution (sequenced commit); file header |
| `timeline/` track adapters | `worldTrackAdapter.ts` (the found parent contract), `dayTrackAdapter`, `runTrackAdapter`, `conversationTrackAdapter`, `expressionsTrackAdapter`, `qlAudioTrackAdapter`, `qlPhysicsTrackAdapter`, `qlTrackRoles.ts` (miscast roles refuse by naming the law), `qlSampleClock.ts` (7-row `QL_CLOCK_MAPPINGS` sample-clock table; conversions without a declared row refuse; anchors measured, not computed), `registerWorldTrackAdapters.ts` | L4 + L9 ticket resolutions |
| `projections/atlas/` | The Archetypal-Earth port: **82 modules** — globe engine, camera rig, tiles, graph build/view/tools/switch, five-state machine + linkable router, aion model/view, non-linear time scale, image pipeline — moved verbatim, 28/28 C2 corpus-neutrality amendments, zero Jung bytes; second-provider test passes; corpus deep links pass end-to-end | L5 ticket resolution, commit `4b17be9a2` |
| `projections/encounterBridge.ts` + `surface/projectionModules.ts` + `projectionPane.tsx` | Encounter bridge (mode × WorldContext × accessEpoch, epoch-guarded, transitions through `book.setContext` as the one owner); ProjectionModule contract (one-module-per-kind admission door that refuses replacement); projection pane kinds in the surface engine; two panes/two projections of one subject | L1 ticket resolution, commit `0d69d5b2c` |
| `projections/worldTimelinePresentation.tsx/.css` + `useWorldTemporalReading.ts` | The World cut: era ruler + declared break into civil week strip, four lenses, epistemic-standing chips never upgraded by placement, now/occasion/transport cursors; poller over ONE `temporal_events_read` (day-bounded cache keys keep K1's horizon warm: ~10 s cold / ~13 ms warm live) | L4 ticket resolution |
| `agent/` (28 files) | The agent shell: session grid, arrangement needles, thread view, context dock, browser, device chain, transport, gateway control, run model, fidelity oracle hooks | `AGENT-SHELL-ACCEPTANCE.md` + V1 verdict ticket |
| Kernel fix (cradle) | Kernel read horizon: `temporal_events_read` was ~114 serial `oi` spawns/read; now one shared register reading + 8-worker fan-out + 2 s answer cache; measured 55 s → **cold 11.4 s / warm 1.4 ms live**, identity byte-equal | K1 ticket resolution, commit `92695a963` |
| Work/Central `9449881` | ctrl roster-read fix (validator learns `self_source`/`relational_logos` pins; 774/0 tests); **binary reinstall still pending (owner act)** | CE1 ticket resolution |

### 1.2 The suite products and crates (native owners — the shell binds, never reimplements)

- Six products of record: **central, actuation, ai-kit, software-factory,
  workcell, quaternal-logic** — accepted descriptor IDs in
  `suite/native-protocol.json` / `surfaces.json`
  (`KERNEL-STATE-FOUNDATION.md:24-26`). Seven-product neutrality is the law
  (`WORLD-SHELL-DESIGN.md:757-771`, §13).
- Live document crates (the Ableton RE "Thread B" ground):
  `Work/O-I/packages/{live-dynamics, live-set, live-engine, live-shell}` —
  `live-dynamics` (device DSP) and `live-set` (documents) are the interfaces
  the shell consumes, "accepted only by tests against Live-truth evidence"
  (`Work/O-I/docs/research/ableton-live-12.0.25/LANES.md:9-21`).
- The retained Expressions application:
  `desktop/cradle/expressions-app/field-studies-journeys/` — vendored
  source-of-record; "This directory IS the Expressions application"
  (`lane-7-app-structure/STRUCTURE.md:33-38`). Hosted once via
  `PointCloudHost` iframe; "the frame's URL must never change after boot".
- Cradle kernel: typed `KernelOp` in, receipts out, generation-qualified
  event log; dev walk-bridge (`kernel/src/bin/walk-bridge.rs`) — "the kernel
  is shell-agnostic by law" (`lane-6-ableton-shell/SCOPE.md:84-87`).
- Archetypal-Earth (`Work/Archetypal-Earth`, `main`): the found atlas —
  globe/graph/aion/sky; ported corpus-neutral already (L5); the Jung vault
  (2,778 files) re-attaches as one provider (`wayfinder/C2-CORPUS-SEAM.md`).
- The Live 12 device derivation corpus: **70 devices stipulated for full
  reconstruction (13 instruments, 46 audio effects, 11 MIDI effects)**, with
  per-device dossiers (param surface ✓, behavior doc, binary derivation,
  crate, golden-render gate) — ~50 rows documented in the coverage ledger,
  5 gates PASS (Glue Compressor, Echo, Reverb, Operator, Wavetable)
  (`Work/O-I/docs/research/ableton-live-12.0.25/devices/COVERAGE.md:1-52`,
  owner directive "full reconstruction… Nothing is out of scope until it is
  gated"). Measured Live captures (research evidence, never assets):
  `Work/O-I/docs/research/ableton-live-12.0.25/evidence/ui/live-session-real.png`,
  `live-arrangement-real.png`, `live-wavetable-device-panel.png`
  (`UI-UX-CONVERGENCE-STUDY.md:19-25`).
- 126-target register: all five target sets approved as full functional scope
  (`PROGRAMME.md:34-38`); **native acceptance passed: 0 of 126**
  (`ACCEPTANCE-CHECKPOINT.md:23-31`, `README.md`).
- Expressions port ledger: 213 rows with `outward_home` + `boundary_op` —
  136 ported, 24 partial, 4 not-ported, 20 owner-op-required, 11
  studio-only, 12 internal, 6 other-track; **all rows
  `pending-native-stack`** (L6-audited counts, `wayfinder/tickets/L6-native-actions-audit.md`;
  MAP Lanes table concurs). CONFLICT noted at §8 (OQ-22): older docs say
  "207 router actions".

### 1.3 What does NOT exist yet (named by the sources)

- **The new shell as a current native app.** "`~/Applications/O-I.app` is the
  LEGACY cradle (Oct 7 bake); `~/Applications/O-I Shell Candidate.app` is the
  new-shell Tauri candidate at source revision `99111821a` (Oct 8 — *before*
  the agent-shell implementation and everything landed today)… The new shell
  as a **current** native app does not exist yet: building it requires the
  release pipeline (suite CLI release basis → feature host → package), which
  is the native composition parent's serialized commission"
  (`DEVELOPMENT-TRACK-2026-10-09.md:41-51`). R1 (native run path in Tauri)
  was the unblocking lane.
- The rendered shell is **below the mockup spec** (the 9 Oct finding):
  "spacing cramped, typography degraded, icons rendering as raw glyph text,
  huge dead space, raw error JSON dumped into panels, tracks mostly '—'
  placeholders… every lane met the oracle and none met the mockup"
  (`DEVELOPMENT-TRACK-2026-10-09.md:26-33`). Craft lanes R3
  (`inhabitants-craft` done: 50 icon-cut marks, `--check` green;
  `agent-shell-craft` running) were the response.
- The two verticals (Factory + Central proof walks) remain OPEN (L8).
- The computer-use acceptance leg — machine-wide blocker resolved
  (`~/.zcode/cua-broker/relaunch-broker.sh` workaround,
  `DEVELOPMENT-TRACK-2026-10-09.md:19-21`); passes still to execute.
- Five fog items (`MAP.md:163-188`): projection-scale performance/clustering;
  visiting exercised end-to-end; QL-side procedural body-generation contract;
  pushed turn streaming; multi-machine physical acceptance.
- Lane-3's editor-core targets E01–E26 (0 landed into the shell as native
  admissions), and lanes 1/2/4/5's 100 targets likewise — the target sets are
  the work programme, none yet passed.

---

## 2. The ontology — Ableton's product grammar mapped onto DLW

The mapping is grounded in the measured Live 12 evidence
(`UI-UX-CONVERGENCE-STUDY.md`) and the design doc. Ground every UX decision in
this table.

| Ableton concept | DLW ontology | Where sourced |
|---|---|---|
| **Clip** — material in a lane | A clip is World material in a track: Expressions scenes, historical events, Factory runs/tasks, agent activity, conversations, civil days/returns/handoffs, celestial motion, M3 clock transformations; clips carry epistemic standing (fact · claim · inferred · hypothesis · disputed · ghost), never upgraded by placement | `WORLD-SHELL-DESIGN.md:400-408` (§3.2); `UX-SPINE-ALIGNMENT.md:80-90` (T5); Rev 2 Timeline rows (`WORLD-SHELL-DESIGN.md:255-258`) |
| **Track** | A lane of World material — the Timeline projection's columns; track adapters project family material (day/run/conversation/expressions/audio/physics adapters over ONE `temporal_events_read` / scene membership — no second store) | `WORLD-SHELL-DESIGN.md:401-403`; L4/L9 adapters (§1.1) |
| **Scene** (session row) | A batch/row launcher: Expressions scene rows (the native Scene is the atomic launch unit — "whole-Scene launch remains atomic", `UI-UX-CONVERGENCE-STUDY.md:51`); Factory scene rows fire a row of acts (`AGENTIC-CONVERGENCE.md:179`); journeys are walk-stops in scene-row form (Rev 2) | `WORLD-SHELL-DESIGN.md:255-257` |
| **Arrangement** | The time-ordered reading of the same material: the integrated overview above the ruler is the single navigation surface — **no duplicate scrub bar** (owner ruling, retained, `WORLD-SHELL-DESIGN.md:407-408`) | `UI-UX-CONVERGENCE-STUDY.md:36` + design §3.2 |
| **Session ⇄ Arrangement as two presentations of ONE Timeline projection** | Not audio-mode features; a presentation is not a mode switch (the recorded App.tsx fault, fixed in L1) | `WORLD-SHELL-DESIGN.md:399-401`; L1 resolution |
| **Device** | One whole device = one panel/one parameter model with three presentations (compact ≤4 controls; expanded pool; full/centre) of the SAME live parameters; honest visual derived from readings; activator light only where a real owner enable exists | `DEVICE-PANEL-BRIEF.md:6-21` (owner model — "do not drift from it") |
| **Rack / device chain** | THE plugin system of the whole environment: devices attach to the rack of the pane whose encounter they operate on; chain order per mode (agent chain: gateway → agent → skillset racks → world → git, `AGENTIC-CONVERGENCE.md` Rev 5); the rack follows the focused pane's material | `WORLD-SHELL-DESIGN.md:314-322` (§1); `MAP.md:145-147` |
| **Chain** | Per-material chain: inserted/selected/folded/moved/duplicated/removed/activated devices; hot-swap, presets, macro mapping (crosswalk "Device lifecycle and rack topology" family, `FUNCTIONAL-CROSSWALK.md:179-187`) | same |
| **Transport** | ONE transport wearing five meanings (Rev 5 table, §3 of this draft); Live restored as base mode | `WORLD-SHELL-DESIGN.md:23-42` |
| **Groove pool** | The browser-below contextual working area (property definition/pinning, macro mapping targets, modulation monitor, per-mode pool content) | `UI-UX-CONVERGENCE-STUDY.md:63-64` |
| **Browser** | Category/results browser above + contextual pool below; categories over actual owners; preview ≠ open ≠ add | `UI-UX-CONVERGENCE-STUDY.md:61-64` |
| **Clip view | Device view** | The bottom detail area = focused pane's rack view; Clip|Device toggle in the status bar is "the only tab"; per-arrangement meanings (Rev 4 table) | `WORLD-SHELL-DESIGN.md:80-98` (Rev 4); `UI-UX-CONVERGENCE-STUDY.md:67-69` |
| **Key/scale** | Per-mode re-meaning: packet token count (Base) · tokens in/out (Factory) · ☿ resonance key (Expressions) · aperture/view-as (Technē) | Rev 5 table |
| **Tempo / signature / metronome / quantize** | Per-mode re-meanings (die face 4+2; effort/budget; autosave/save-timing; heartbeat/interrupt timing; pulse/scene-quantize; walk pace/stop n/8; presence/arrival) | Rev 5 table |
| **Warp / clip-view craft** | Central's clip-view craft: CAS identity, basis, save-router named outcomes (`saved | unchanged | stale | conflict | refused`) are "this world's warp markers" | `WORLD-SHELL-DESIGN.md:706-717` (§12 Central); owner clip-view quote `[session]` |
| **Automation / modulation** | Typed parameter addresses `{family, device-instance, key, type, range/unit, write-path}`; scope declaration = specification; modulation = routing relation source→target through custody/receipt law; **every modulated parameter shows its modulator** (Live colours the modulated knob) | `WORLD-SHELL-DESIGN.md:772-799` (§14) |
| **Groove / swing** | (No source assigns a DLW meaning to Live's groove pool *content* beyond the geometry reuse; the pool geometry is reused per `UI-UX-CONVERGENCE-STUDY.md:63`) — OPEN-QUESTION #23 records the gap | — |
| **Follow actions** | Hand-off (Factory: "Then = hand-off follow action", `AGENTIC-CONVERGENCE.md:179`); journey transitions as authored per-edge objects (lane-5 T5) | cited rows |
| **Takes / comping** | Takes are transport material, never a clock; performance recording is the take machinery (seed for #281); takes live on Timeline lanes (fifth-places audit: the Takes tab is a design smell, home is the Timeline) | `WORLD-SHELL-DESIGN.md:822` (§15.4); `EXPRESSIONS-FOUR-SURFACES.md:24-25` (item 4) |
| **Freeze / render / export** | Render/export offices belong to #281's composition/interop packet; capture actions per `EXPRESSIONS-FEATURE-MAP.md:53` | `M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md:164` |

**The three disclosure levels** (binding on every device): compact/perform →
configure → deep edit; deep edit keeps the same retained instance, draft and
view; pop-out admits only an additional view of the same owner
(`UI-UX-CONVERGENCE-STUDY.md:71-77`; `NATIVE-EDITOR-STANDARD.md:33-39`).

**Exposure law (§16):** "Each family appears in exactly four places and
nowhere else: the browser (its categories), the rack (its devices), the
projections (its material via adapters), and the inspectors (its implicit
panels) — plus its time bindings and telemetry declarations. A family needing
a fifth place is a design smell" (`WORLD-SHELL-DESIGN.md:836-845`).

**Uncarved-block neutrality test (§13):** "a seventh product should integrate
with no core change. If a core change is needed, either the family boundary or
the core concept is wrong" (`WORLD-SHELL-DESIGN.md:757-771`). Executed twice:
a seventh product admits through the unchanged door (L2), and the atlas
registry admits a second provider with no core change (L5).

---

## 3. Mode chapters — one per mode, each with its FOCUS

The per-mode transport meanings (Rev 5, verbatim from
`WORLD-SHELL-DESIGN.md:29-42`) are the shared spine of all five chapters:

| Slot (Live) | Base · Central | Factory | Expressions | Technē |
|---|---|---|---|---|
| Link · Tap | ground sync · stamp Now into the document | peers · ping agents | field sync · tap tempo | field carrier · back to Now |
| tempo ‹ › · signature | die face (‹ › turns it) · 4+2 | effort · budget | field tempo · 5:3 ratio | walk pace · stop n/8 |
| metronome · quantize | autosave · save timing | heartbeat · interrupt timing | pulse · scene quantize | presence · arrival |
| key / scale | packet token count | tokens in · out | ☿ resonance key | aperture · view as |
| ▶ ■ ● + | **Answer** (send the packet) · stop · dictate · append/replace | run · stop all · voice · steer | play scenes · stop · capture take · layer | walk · stop · record walk · extend |
| arm · re-enable · capture | agent write-arm · hand back · selection → packet | write arm · hand back · capture | Studio arm · re-enable · gestures → scene | instrument writes · hand back · view → scene |
| punch · loop · punch | day opened 08:30 · close routine · 21:00 | write window · routine | scene loop | occasion window |
| draw · keys · MIDI · kHz · CPU | highlight pen · keys · map · carrier · save state | point · keys · map · t/s · context | draw form · keys · map · fps · GPU | place tool · keys · map · carrier · projected % |

Session/Arrangement icons per mode (`WORLD-SHELL-DESIGN.md:43-51`):

| Mode | Session | Arrangement |
|---|---|---|
| Live | clips and scenes | the song over time |
| Base | the day as clips: Day, Flows, Beings, Things and Goals as tracks | today on one ruler |
| Factory | sessions and tasks | the run viewer |
| Expressions | scene rows | the scenes over time |
| Technē | M3′ Journey | M2′ Relation Field |

Clip | Device detail per arrangement (Rev 4, `WORLD-SHELL-DESIGN.md:84-89`):

| | Clip — what is in focus | Device — what works on it |
|---|---|---|
| Base | Document: form, file, revision, bindings; highlights; notes; packet | Devices: Text · Highlight · Notes · Packet · Answer · the form device |
| Factory | Task log: the selected task's tool-run log | Agent chain: gateway → agent → skills → world → git |
| Expressions | Scene: sequence, durations, bindings | Studio: the engine's own controls |
| Technē | Clip: identity, place and time, disclosure, typed relations, bounded constellation, source | Instruments: the six (project/graph, canvas, timeline, journey, places, palace) — the open one expanded, others folded |

---

### 3.1 LIVE — the music mode (the shell's base mode, restored)

**FOCUS.** Live is the music working mode: the Ableton-grammar surface where
the physical music instrument (M1–M4, QL-MEF #281) works as a first-class
musical working mode — "an integrated musical working mode, not another app
(#281 §3.1), reusing the shell's own machinery" (`WORLD-SHELL-DESIGN.md:917-921`).
Rev 5 "restored" it as the base mode (`WORLD-SHELL-DESIGN.md:24-26`); the
landed grammar maps `live → the shell's audio cut (book mode 'base', the
music presentation)` (`shell/modeGrammar.ts:23-24`). Session shows clips and
scenes; Arrangement the song over time.

**Transport meanings.** Live's own: the row is the reference reading all
other modes re-mean (Rev 5 table, Live column = the Ableton originals).

**Browser.** The audio/browser grammar per the measured Live captures:
category column + results; lower Groove Pool retains "its admitted audio
purpose" (`UI-UX-CONVERGENCE-STUDY.md:63`).

**Centre.** Session (track columns, clip slots, scenes, stop row, mixer
strip) and Arrangement (integrated overview above the ruler — "the measured
Live evidence", beat ruler, track lanes) with native variants projecting the
retained app (`WORLD-SHELL-DESIGN.md:391-398`). Honesty law: **read-only
until the owners land** — "Live unchanged (read-only honesty)"
(`DEVELOPMENT-TRACK-2026-10-09.md:100`); "No audio playback or device-editing
claims before those owners land" (`MAP.md:121-122`).

**Clip | Device.** Audio clips/scenes vs the device chain; audio device faces
wait on the device-lane contract: "The current audio `/api/document` supplies
readable device names and parameter values but no proven stable write
identity/revision. Those readings remain read-only until the device lane's
actual editing/metadata contract lands" (`NATIVE-EDITOR-STANDARD.md:82`).

**Dock.** Context tiles (Rev 4): the agent (Fizz/Epii/Anima), Packet, Trail,
Field, Agents, Terminal, Results, Sky, NOWs; 2×2 launcher opens tiles, never
feeds the centre (`WORLD-SHELL-DESIGN.md:91-95`).

**Exists vs to build (exhaustive, sourced):**
- EXISTS: Session/Arrangement views as one Timeline projection (L1);
  mode-grammar Live column as data; measured Live captures as the visual
  basis; the live-set/live-dynamics crates as the document/DSP owners
  (5 device gates PASS, ~50/70 dossiers documented — §1.2); the musical
  declaration half (L9 inhabitants) with D13-in-the-type; sample-clock
  mapping table (7 rows); realtime gate measured fixture-side (47× headroom;
  round-trip median 0.0 / p95 0.1 / max 4.6 ms, n=53; late-delivery recovery
  10.8 ms — `wayfinder/tickets/L9-musical-family.md` resolution).
- TO BUILD: the Live-mode centre against the landed crates as they gate
  (consume, never rebuild — LANES.md contract 1); audio device faces when the
  device-editing contract lands; the realtime gate measured **in the Tauri
  shell** (WKWebView/Tauri device latency — L9 "still waiting", named);
  performance input stays #281's (the six-row Jankó projection, polyphonic
  pointer/keyboard/MIDI through one operation path — "strike deliberately not
  offered (#281 owns performance input)", L9 resolution).
- The D13 law binds every face: "M1 is the oscillator source; M2 modulates,
  never generates" (`lane-6-ableton-shell/SCOPE.md:55-59`, owner D13; L9 put
  `generates: false` in the type). Role-classification law (#281 §1.3): "a
  resonating body is not a moving emitter, a collision trigger, an analyser,
  or a visual-only glyph."

**Acceptance shape.** No sounding claim before the owner lands it in the
shell (`MAP.md:121-124`); the realtime gate measured in the shell is L9's
named acceptance; device gates run against the golden-render corpus
(COVERAGE.md method); UI acceptance by direct computer use
(`MAP.md:52-58`).

---

### 3.2 BASE · CENTRAL — the ground's craft (days, documents, central devices)

**FOCUS.** "Base is Central's ground" (`WORLD-SHELL-DESIGN.md:119`). Central
is **not a mode and not an app**: it is one World context
(`WorldContext.world: 'central'`) whose material projects through the same
four projections and inhabits the same rack — "Nothing new is stored. Central
mode is the shell with Central material selected — the tripartite spine's
world context, not a mode switch" (`WORLD-SHELL-DESIGN.md:533-556`, §6). The
owner's mapping, verbatim `[session]`: "whilst central would be closer to
what ableton has in its clip view, the nitty gritty fucntionalities of warping
etc, this can be where central is mapped and you can see exactly what folders
are being worked in, what impact across the central web, any erroneous
worktrees or branch creations etc."

**Transport meanings.** The Base · Central column of the Rev 5 table (ground
sync · stamp Now; die face 4+2; autosave/save timing; packet token count;
**Answer (send the packet)** · stop · dictate · append/replace; agent
write-arm · hand back · selection→packet; day opened 08:30 · close routine ·
21:00; highlight pen · keys · map · carrier · save state).

**Browser.** Rev 3: "Central: Days, Flows, Beings, Things, Goals; Files,
Wiki; New (exactly Day · Flow · Beings · Things)"
(`WORLD-SHELL-DESIGN.md:113-114`). Landed grammar: central browser categories
with `cut` vs `waiting` states (`shell/modeGrammar.ts:64-77`;
`inhabitants/centralBrowserCategories.ts`). Session presentation: "the day as
clips: Day, Flows, Beings, Things and Goals as tracks"; Arrangement: "today
on one ruler" (Rev 5 table).

**Centre.** "The documents themselves, paper-toned"
(`WORLD-SHELL-DESIGN.md:114`). The four document forms are drawn as they are:
the Day die's six positions (4+2) with the open face; Flow's Dialogue · Flow
· Journal with declared participants (a person drawn solid, an agent
dissolving into points); Things and Beings with their bindings (world,
subject, C1–C4 office, sources) — sources
`desktop/cradle/documents/{ql-daily-die.html, ql-flow.html, oi-beings.html,
oi-things.html}` (`WORLD-SHELL-DESIGN.md:119-131`). The highlight-context
system is the forms' own selection tool: *Highlight · Note · To packet ·
Answer this*.

**Clip | Device.** Clip = the Document (form, file, revision, bindings;
highlights; notes; packet). Device = Text · Highlight · Notes · Packet ·
Answer · the form device (Die faces · Participants · Bindings). "The packet
is shown as exactly what the agent receives, and the companion's Context tab
shows the same packet" (`WORLD-SHELL-DESIGN.md:128-131`). Central's
clip-view-grade editors when a Central subject is selected: CAS identity,
basis, save-router outcomes as "this world's warp markers"
(`WORLD-SHELL-DESIGN.md:706-717`).

**Dock.** "The situated agent: Conversation · Activity · Context · Inspect"
(Rev 3 table, `WORLD-SHELL-DESIGN.md:115`).

**The Central family devices (§12 + L7, landed):** the hygiene device
(worktree census, branch audit, erroneous-worktree and stray-branch
detection, seat occupancy — field-health behaviours as readings and tenders);
the impact device (select a folder or note → its Central-web neighbourhood,
references, and the sessions touching it); day/now devices (day document
devices through the existing save router; civil-time operations bound to the
time spine's civil stratum — DECLARED, never fired from a device: authenticated
owner mutations); the document devices (DayDie/Flow over the iframe +
payload-island + CAS save router with five named outcomes);
`DocumentDayDieFace`/`DocumentFlowFace`/`ConversationNaraFace` landed (L2).

**Central's four projections** (§6): Day/NOW history → Timeline tracks (a day
is a lane; returns, handoffs, clearings are clips); Wiki/M0 → already a
native Expression projection (`wikiNativeExpression.ts` — the wiki is an
Expression/Scenes projection; registers from the kernel navigator); 
Conversations → encounter panes + Nara device + Timeline clips; ground
chooser/placement/receiving → browser categories and dock cards over the
native owners.

**Exists vs to build.**
- EXISTS: L2 manifests + document/conversation device docks (16-step scripted
  walk showing all five save-router outcomes); L7 Central craft (14
  boundary_op-named readings; the 2026-10-08 day recovery walked end-to-end
  read-only: civil field at policy revision `…:69da4a44ad65b27f`, day record
  at CAS `:62055:c37a1b74ee2f9d0b`, 62,055 B, 39 returns at close + 39
  carry-forward refs); modeGrammar Base column; day track adapter (18 clips
  live-verified, L4).
- TO BUILD: App.tsx body wiring for Base arrangement dock ("the shell
  integrator's join", L7); Central vertical (L8: one real day recovered
  through the Timeline, the Day document device, a conversation clip + Nara
  device, and the wiki's Constellation — proving Central's resolution without
  a separate mode); computer-use acceptance; the batch thoughts Action
  (Central owner-side; the kernel's cold-read lever, `MAP.md:140`).

**Acceptance shape.** "Selecting a folder, note and day opens Central detail
craft by computer use; one day recovery walked end-to-end through devices; no
parallel stores" (L7 evidence/acceptance). The Central vertical is also UX
cutover gate 2 of `LEGACY-CRADLE-RETIREMENT.md` (`UX-SPINE-ALIGNMENT.md:136-137`).

---

### 3.3 FACTORY — the work programme (sessions, runs, the agent chain)

**FOCUS.** "Factory supplies World phenomena — Positions, occupants, current
work, attempts, communiques, artifacts, returns — and those project through
all four views and inspect through the implicit agent/files surfaces. No
bespoke Factory application is built" (`WORLD-SHELL-DESIGN.md:557-562`, §7).
Division of labour (owner words, `[session]` + `WORLD-SHELL-DESIGN.md:719-728`):
"Actuation tunes *how* agents run; AIKit supplies *what they can do*; Factory
organises *what work happens*. Three families, three aspects, kept distinct
where a monolithic 'agent UI' would blur them." Session = sessions and tasks;
Arrangement = the run viewer (Rev 5).

**Transport meanings.** Factory column: peers · ping agents; effort · budget;
heartbeat · interrupt timing; tokens in · out; **run · stop all · voice ·
steer**; write arm · hand back · capture; write window · routine; point ·
keys · map · t/s · context.

**Browser.** Rev 3: "Sessions, Agents, Runs, Chats, Files, Knowledge"
(`WORLD-SHELL-DESIGN.md:115`).

**Centre.** "Session grid · thread" (Rev 3). The agentic design (Rev 4):
threads open in the main space — double-clicking a task clip opens the
session's thread; every session listed left, subagents included and nested as
spawned, stepped rails; tool calls expand inline; a stalled thread ends in a
stall card: Retry, Hard stop, Steer, or tell the parent
(`AGENTIC-CONVERGENCE.md:60-74`). Arrangement needles: each thread has its
own needle at its last activity, live readout; "running tasks have no drawn
end, and queued tasks have no length" (`AGENTIC-CONVERGENCE.md:89-93`).

**Clip | Device.** Clip = task log (the selected task's tool-run log: chat
and tool calls, subagent calls indented; fold shows tools only; a steer line
at the foot; collapsible sections Task · Launch · Then (hand-off) ·
Overrides · Basis — `AGENTIC-CONVERGENCE.md:127-132`). Device = the agent
chain: **gateway → agent → skills → world → git**
(`AGENT-DEVICE-OWNERSHIP.md` — the verified per-device family map: gateway =
actuation; remote carrier = workcell (refused/composed, never live — owner
ruling); agency gateway = ai-kit; agent model/effort/budget = actuation;
autonomy/review-gate/write-mode/custody = software-factory; agent identity =
central roster (never a hardcoded crowd); skillset racks = ai-kit;
context-world = central + ai-kit split; write receipts/Return =
software-factory; git device = workcell).

**The act is the unit of configuration** — the ActSpec document
(`AGENTIC-CONVERGENCE.md:241-277`): `agent_ref + profile_revision; scope;
autonomy: suggest | act_with_review | autonomous; knowledge_bounds (reads);
write_routing (layers + proposal | draft | direct_with_receipt);
skills_admitted/denied; review_gate; steering (CONTRACT.md verbatim:
steer-first); budget {turns, wall_clock, cost}; macros as chosen delegated
controls`. Disclosure states are the cradle's truthful vocabulary (Selected /
Projected / Brokered / Observed effective / Adapter-inferred / Unknown /
Withheld / Pending reload) — "never a generic green badge".

**Agency's five forms at five places** (`AGENTIC-CONVERGENCE.md:230-239`):
Discovery (browser categories; drag = membership), Instrumental (device chain
+ bottom-detail Agent mode beside Clip and Device), Conversational (centre
presentation Conversations — the Buzz member timeline bound to the current
scope), Procedural (browser-below pool as Delegations + status), Embodied
(world apertures + right-dock Console). Buzz behaviours of record: queue /
steer / interrupt / diff-review / Return
(`/Users/admin/Central/Work/reverse-engineering/2026-10-07-buzz-grok-agent-messaging-re/buzz-messaging/CONTRACT.md`;
Buzz = `/Applications/Buzz.app` v0.5.20 — owner correction 2026-10-08,
`FUNCTIONAL-CROSSWALK.md:14`).

**Dock.** "Result desk: Activity · Context · Inspect · Results" (Rev 3).

**Exists vs to build.**
- EXISTS: the entire agent shell (28 files) live-verified against the real
  bridge — 18 observations/0 faults; red-when-cut proven; five families at
  the neutral door; §14 parameter addresses (28 rows, one-owner-per-row);
  admit lights as readings; zero fake rows (V1 verdict + F1–F4 fixes,
  commit `a120086e6`); `harness_agent_control` wired; agency_read/
  encounter_task_read/temporal_events_read as native sources; L2
  software-factory manifest (6/0); workcell manifest (4/0, seat reading =
  `workcell_status_read`).
- TO BUILD: the Factory receiving/advancement join ("the recorded
  queued-after-return gap… join unbuilt", `MAP.md:139`); the Run's Expression
  production moved out of view lifetime (the recorded `FactoryLive.tsx
  producer-consumer fault` — "rendering may sleep; work stays recoverable",
  `WORLD-SHELL-DESIGN.md:562-568`); the Factory vertical (L8a: a real
  Factory agent performs bounded work on a real Jung/World object, recovered
  through all four projections + devices + agent/files inspection, repeated
  with views closed, reopening, occupant change and a retained occasion);
  agency-review instrument family per the crosswalk; Actuation's experiment
  device (`{subjects, loop, telemetry set, cadence, comparison basis}` whose
  run is a Timeline track, telemetry = modulation observables, results Return
  through Factory receiving — `WORLD-SHELL-DESIGN.md:719-728`).

**Acceptance shape.** The agentic first vertical slice
(`AGENTIC-CONVERGENCE.md:321-333`): "select an agent in the browser → place
it on a Scene → the Agent device face appears → configure bounds/routing/
skills → delegate in Conversations → steer it mid-turn → its diff card
returns → approve through the review gate → the act lands with a receipt and
the Delegations row closes → save/reopen preserves the ActSpec and transcript
→ recovery draft disclosed… at both 1920×1200 and 700px densities… against
real saved work through the kernel adapter — no shell-only act store."

---

### 3.4 EXPRESSIONS — the expressions ontology

**FOCUS.** The expressive projection and the retained M4 body: "the retained
application mounted once, with the deep cut changing disclosure
(`panels/expressions.tsx:43-46`). Glyphs, scenes, particles, cymatics,
chakral structures, image transformations, narrative sequences. An Expression
is not a data category — any World material may acquire an expressive
projection" (`WORLD-SHELL-DESIGN.md:423-430`, §3.4). "Expressions follows
Technē's example. The pane holds only the living field. The tool rail,
toolbelt and Library move into the Studio (Device), as Tools and the selected
object's actions. The scene strip moves into Clip, beside the sequence and
bindings" (`WORLD-SHELL-DESIGN.md:52-56`, Rev 5). The full capability port:
"port the full capability, not a piecemeal subset"
(`EXPRESSIONS-PORT-PLAN.md:3-4`).

**The three-part ontology (sound tracks + temporality tracks + the M1–M4
musical system unified).** The owner's framing stands in the design: "audio
and visual/physics tracks are track *adapters* on the Timeline projection
(L4's World track adapters). The owner's framing is correct: with tracks and
clips carrying expressions and scenes, audio and physics tracks are the
simplest thing. The gate is not difficulty; it is the role-classification law
and honesty" (`WORLD-SHELL-DESIGN.md:945-950`, §18). Adapters landed:
`qlAudioTrackAdapter.ts`, `qlPhysicsTrackAdapter.ts`, `qlTrackRoles.ts`
(miscast roles refuse by naming the law). Temporality: `expressionTiming` (Σ
scene durations) is the only expression clock — "a global time base would be
a second clock" (lane-3 E01); the time spine's strata never conflate seconds,
beats, simulation time and Day/NOW (`UI-UX-CONVERGENCE-STUDY.md:55`; lane-2
T1/T6). The musical system beneath: §18 (folded into this chapter and §3.1):
M1 instrument device face; M2 first native modulation sources (never a second
oscillator, D13); M3 score material in tracks and clips (articulation/form
sequences as clip material; form→body preparation pipeline is #281's M3
packet — "law today, not landed"); M4 unchanged law (the Expressions
application IS the body; declared world / personal Nara / explicitly shared
contexts are distinct admissible occasions over the same source definitions,
#281 §1.2).

**Transport meanings.** Expressions column: field sync · tap tempo; field
tempo · 5:3 ratio; pulse · scene quantize; ☿ resonance key; **play scenes ·
stop · capture take · layer**; Studio arm · re-enable · gestures→scene;
scene loop; draw form · keys · map · fps · GPU.

**Browser.** The compact bounded graph, Scenes, Library (Rev 3); works/
material/objects/properties/devices categories over actual owners
(`EXPRESSIONS-FAMILY-SESSION-BRIEF.md:38`); preview selection is separate
from opening (`UI-UX-CONVERGENCE-STUDY.md:61`).

**Centre.** "The living field: tool rail, toolbelt, scene strip, Library"
(Rev 3) — in Rev 5 the pane holds only the living field (tools move into the
Studio device). Body, Session, Arrangement or one deep instrument/editor as
centre presentations (`UI-UX-CONVERGENCE-STUDY.md:65`).

**Clip | Device.** Clip = Scene (sequence, durations, bindings); Device =
the Studio (the engine's own controls). The eleven device families with fixed
keys: physics, pointer, relational, medium, contacts, morph, focus, colour,
ink, depth, resonance (`DEVICE-PANEL-BRIEF.md:17`). One whole panel = one
device (owner model); compact ≤4 controls; handles bound to real parameters
(≥2 per panel); coupling shown where real; labels/units from `NATIVE_BINDINGS`
never prettified; activator only with a real owner enable
(`DEVICE-PANEL-BRIEF.md:6-45`).

**Dock.** "Anima (Nara/oracle)" (Rev 3 table).

**Exists vs to build (exhaustive, sourced).**
- EXISTS: the retained app hosting law (one build, one route, handshake);
  `oi.native-editor/v1` receiving grammar connected, carrying the
  authoritative `Journey.shared.toolbelt` chosen-control list + native
  pin/order/Follow/Bind operations (`NATIVE-EDITOR-STANDARD.md:149`);
  `oi.native-time-window/v1` shared time window
  (`NATIVE-EDITOR-STANDARD.md:152-159`); compact chosen-control rack +
  categories/results browser + lower pool (owner-accepted study; separate
  owner acceptance 13/13 with real file Save/reopen — NOW record
  `chosen-controls-implementation-after-accepted-2026-10-08.json`);
  ref-based Scene editing, Session lanes, Arrangement overview (NOW record
  `native-scene-editing-and-expressionwide-2026-10-08.json`); the 61-kind
  parameter-address classifier (17 addressed / 44 structural,
  `EXPRESSIONS-PARAMETER-ADDRESSES.md`); family admission door + 22
  Expressions family ids (`EXPRESSIONS-FAMILY-SESSION-BRIEF.md:23-41`);
  seven compact/full instrument-editor pairs in `packages/instrument-editors`
  (58 checks, six-document restart pass — `INSTRUMENT-EDITORS.md`); the port
  ledger (213 rows; 45-row audit: 45/45 adhere — L6).
- TO BUILD (the ledger drives): every row's outward home + live replay (all
  `pending-native-stack`); the feature-map families' full outward paths
  (`EXPRESSIONS-FEATURE-MAP.md` — ~60 rows from New/Open through Nara
  dialogue to Physis); lane-3's E01–E26 editing-model targets into shell
  surfaces (the kernel already expresses most operations at scene
  granularity; the missing pieces are the editor surface, receipted undo,
  markers, typed transitions, nested-occurrence placement — lane-3 TARGET-SET
  "The honest mapping" table); the S1 second-selection-store fix and the
  R1/R2 multi-select ruling (`EXPRESSIONS-ENCOUNTER-SPINE.md` — owner ruling
  needed, OQ #4); the fifth-places remedies (Takes tab → Timeline lanes;
  one Scene-editor host; Configure›Devices hard-coded families removed —
  `EXPRESSIONS-FOUR-SURFACES.md`); takes as Timeline lanes (W5 adapter
  registered); the live replay of the transport/take family (blocked at the
  host→frame handshake — named for the retained-host lane, L6).

**Acceptance shape.** The complete activity
(`UI-UX-CONVERGENCE-STUDY.md:79-88`): select Scene/Object → browse properties
→ choose Follow/Bind/Field → acknowledged chosen control appears in compact
rack → gesture captures target+revision (selection change cannot retarget a
gesture) → optional macro → configure/deep without losing value → save
completes only on owning operation success → save/reopen preserves chosen
controls, order, scope, macro mappings, authored values → recovery draft
separately disclosed. "The first vertical slice must exercise actual saved
work, not fixtures" (`UI-UX-CONVERGENCE-STUDY.md:100-101`). Craft gates G1–G7
(lane-3): text by exception; stillness lawful; colour journey; glyph law;
render-verified composition; visual pass the primary gate; fullscreen/focus.

---

### 3.5 TECHNĒ — the six instruments' target sets

**FOCUS.** The deep mode: the six professional instruments — named plainly by
owner ruling D-F (2026-10-07): **project/graph, canvas, timeline, journey,
places, palace** — no M-prefixes; collectively "the techne mode" / "the deep
mode" (`PROGRAMME.md:97-108`; `lane-6-ableton-shell/SCOPE.md:243-247`). The
mode's law (§11a, `lane-7-app-structure/STRUCTURE.md:15-19`): the deep mode
"changes disclosure and available operation; subject identity and native
Action ownership are preserved" — the same retained application in the deep
cut ("instrument 0 IS the expressions app" — the owner's intuition, enacted
in code, `CONVERGENCE.md:81-100`). Rev 5: Technē's Session = the Journey;
Arrangement = the Relation Field. "The instrument is the instrument": no
separate Technē rack; the detail row is the focused lens's own native control
set (`WORLD-SHELL-DESIGN.md:143-149`, Rev 3).

**Transport meanings.** Technē column: field carrier · back to Now; walk pace
· stop n/8; presence · arrival; aperture · view as; **walk · stop · record
walk · extend**; instrument writes · hand back · view → scene; occasion
window; place tool · keys · map · carrier · projected %.

**Browser.** Rev 3: "sources to hand (open in instrument / add reference),
Bodies, Locations, Earth places, Palaces, Journeys"
(`WORLD-SHELL-DESIGN.md:116`).

**Centre.** "The current lens, [the six instruments] on the lens bar" (Rev 3);
landed as the Technē lens bar (`DEVELOPMENT-TRACK-2026-10-09.md:100`). The
four projections host the instruments (Rev 2): Timeline holds timeline
(M2′ Relation Field) + journey (scene rows as walk stops); Constellation
holds project/graph (bounded local whole: list · tree · graph · form) +
canvas (artefact suite; drag is presentation; a drawn relation is a proposal
until promoted through the relation owner's Action); Earth holds places at
five scales (Field · Orbit · Surface · Place · Palace — M5-palace as a
special location you enter); Expressions is the 3:3 reading with the
conjugate layers; the rack's cut switch crosses 4:2 ↔ 3:3
(`WORLD-SHELL-DESIGN.md:253-274`, Rev 2).

**Clip | Device.** Clip = identity, place and time, disclosure, typed
relations, bounded constellation, source. Device = the six instruments; "The
one open on the focused pane is expanded with its own controls; the others
are folded, and clicking one opens it on the focused pane" (Rev 4 table).

**Dock.** "Epii: Epii · Source · Proposals · Field" (Rev 3).

**The six target sets** (the owner deliverables; 126 targets total; each
entry carries what-it-does, reference behavior, landing seam,
UI-harmonisation note, verifiable acceptance shape — `PROGRAMME.md:181-186`):
- **project/graph + canvas** — lane 1, 21 targets (A1–A10 alignment/snap,
  shapes/stickies/text, connectors + routing + labels, side-binding
  integrity, minimap, zoom grammar, find/jump, presentation over frames,
  frame headings, embed/media; B1–B4 save schedule, `.canvas` interchange,
  frame export, honest drift on saved views; C1–C4 ghost nodes, graph
  minimap, canvas→graph hop, relation vocabulary on emphasis; D1–D3 the
  instrument rail, saved views carry subject basis, graph camera restore).
  Craft bar §0: text by exception; stillness lawful; one icon grammar;
  presentation vs semantics (`oi.research-scene/v1` or session-local — never
  a second store); native-owner law (`lane-1-canvas-graph/TARGET-SET.md`).
- **timeline** — lane 2, 25 targets (T1–T25): one time model across both
  halves; precision-honest placement; uncertainty presentation (circa,
  disputed, mythic); deep time without fabrication; relative time for
  undated work (no fake dates); **T6 the shared `techne:time-axis/v1`
  contract** (lane 2 owns, lane 4 consumes); two-row calendar axis;
  periodisation bands; nested events; cause/influence chains;
  standing-aware edges; honest aggregation; scale-window minimap;
  participant spans; named views; refused-write cards; session time window;
  working-set persistence; evidence-grounded opening; round-trips; colour
  journey with meaning + lawful stillness; focus mode/fullscreen;
  capability honesty as the instrument's voice
  (`lane-2-timeline/TARGET-SET.md`).
- **expressions editor core** — lane 3, 26 targets E01–E26 + the shared core
  SC-1…SC-7 (see §3.4 and §7; lane 5 consumes, never forks).
- **places** — lane 4, 30 targets (T1–T30): pitch/bearing/spin; fly-to
  choreography; north/tilt reset; honest offline basemap core; terrain
  opt-in; atmosphere/limb; provider disclosure; relation-typed overlays with
  on-map legend; regions as regions; precision/uncertainty grammar on the
  live globe; movement lanes → routes with stops; hierarchy edges;
  provenance on every pinned thing; time slider (consumes T6); playback
  window; historical-imagery honesty; click-to-create placemark bound to a
  wiki subject; placemarks as first-class saved objects; drag-to-refine;
  named map views; per-Scene layer visibility; search-and-fly-to;
  place→subject→timeline one identity; cross-instrument focus reopen; tour
  recording; journey binding (interface point, not a store); day/night
  terminator as disclosed provider reading; the ladder visible where you
  stand; stillness; one grammar with the mythic visibly distinct. MapLibre
  is the renderer — extend in place, no second globe
  (`lane-4-world-places/TARGET-SET.md`).
- **journey + palace** — lane 5, 24 targets (T1–T24): the deep journey
  surface; composition as routed proposal; reorder/pace (draft local, order
  native); one scene identity no shadow store; transitions authored per-edge;
  overlap-to-blend authoring; live edge truth; playback walks with
  inspectable path; journey presence (reload re-enters where the author
  stood); the formal crossing 4:2 ↔ 3:3; return restores the exact beat by
  ref equality; source/verso leg with explicit return; honest absence;
  palace composes the reading's real facets; free spatial composition is
  pure presentation; objects independently addressable; guided integral walk
  (method of loci); archaeology honesty; explicit Return as attributable
  proposal; semantic saving (kernel Expression the only store of record) +
  presentation saving; browser-local journey library standing; identity
  chain; palace bookmarks and named start
  (`lane-5-journey-palace/TARGET-SET.md`).

**Exists vs to build.** EXISTS: the retained app's lens system (six plain
names validated, `app.ts:940` via lane-7); the vendored Research Canvas /
Timeline / Psychogeographic map bodies; the orphaned pure models (`m0m5/`,
37 files — "unwired, not abandoned… the designated pure-model landing ground",
`STRUCTURE.md:64-72`) with lane-7's rehome plan P1–P7; the atlas port
(Earth/Graph/Aion). TO BUILD: all 126 targets' shell landings (0 passed);
the lane-7 structural moves (P1 boundary module; P2 rehome
`centre/ wiki-projection/ bodies/ instruments/<plain-name>/`; P3 retire the
orphaned rail/depth/lenses/session keeping the Action-receipt validation;
P4 wire models at lane seams; P5 `hostKind` in MODE_CURATION; P6 code naming
harmonisation at phase 4 — `STRUCTURE.md:150-200`); the time-axis contract
consumers; the cross-instrument identity round-trips (one-field identity
everywhere — CONVERGENCE cross-lane contract 5).

**Acceptance shape.** Per target: "the reference behavior it attains, the
landing seam in the cradle, the UI-harmonisation note, and a verifiable
acceptance shape… Data-saving and navigation targets are explicit entries"
(`PROGRAMME.md:181-186`); craft-quality bars never compliance checklists
(`PROGRAMME.md:19-25`); the audit's craft bars travel (stillness lawful,
fullscreen+focus, colour journeys with meaning, render-verified composition,
metadata banned from the stage — `CONVERGENCE.md:50-54`).

---

## 4. The Epi-Logos mode/lens — everything the sources say

**What exists in code (the cradle — live today):**
- `WorkspaceMode = "base" | "factory" | "expressions" | "techne" | "epi-logos" | "settings"`
  (`desktop/cradle/src/workspace/mode.ts:23`, quoted in
  `lane-7-app-structure/STRUCTURE.md:26` and `UX-SPINE-ALIGNMENT.md:17-19`).
- `WorldContext.world: 'central' | 'epi-logos'` — the world axis of the
  encounter spine (`WORLD-SHELL-DESIGN.md:334-337`; lane-7 §1).
- The E2 entrance, **landed 2026-09-18**: "Epi-Logos sixth entrance binds the
  world; context retains across arrangements; leaving is explicit… footer
  'Enter the Epi-Logos world' → binds world + opens the curated Epi surface;
  'Within Epi-Logos' chip with explicit Leave in every arrangement… the
  context (with return trail) lives in the workspace, not the mode —
  switching arrangements cannot lose it"
  (`Work/O-I/docs/experience/UI-FUNCTION-LANDING.md:41`).
- Retention through the portal park: "mode centres retained through a portal
  park (expressions/techne/epi-logos/system)" (`UI-FUNCTION-LANDING.md:77`).
- The mode-button semantics (owner commission 22 September 2026,
  `Work/O-I/docs/experience/EPI-LOGOS-AGENT-MODE.md`): "In both **Expressions**
  and **Technē**, the existing **Epi-Logos mode button** selects the
  source-owned **Prime–QL agent/body composition as the default option** for
  the mode's agent. The selected subject, source, scene and work remain
  themselves. The change is the operative intelligence available to engage
  them." S4′ is Anima, S5′ is Aletheia; Nara is M4/M4′; Epii is M5/M5′.
  Honest activation law: "Distinguish selected, resolved, delivered and
  actually invoked. A control being highlighted… does not establish
  activation… No silent fallback to a generic agent while displaying active
  Epi-Logos intelligence."
- The QL integration corpus (`Work/Quaternal-Logic/docs/integrations/epi-logos/`):
  `EPI-LOGOS-AGENT-ARCHITECTURE.md` (the `#0/1` containing Prime–QL body with
  explicit #0 and #1–#5 faculties), `EPI-CAPABILITY-MATRIX-FIELD-INDEX.md`
  (the 185-obligation field index; "One Earth/observer occasion through M1
  geometry, M2 resonance/material and M3 clocks/form, personally received at
  canonical M4.4.4.4 Personal Pratibimba, remains the commissioned whole"),
  the ta-onta / Vāk / AW0 locks, and the registered capability matrices
  (§6 of this draft).
- The wider identity: the owner's endpoint phrase "the complete Epi-Logos
  working world" (`ASTRA-BRIEF.md`), and the AIKit/agency/nara stack the
  shell binds ("canonical CAS stays in AIKit; the shell binds via
  `oi.nara-dialogue-binding/v1`", `WORLD-SHELL-DESIGN.md:512-515`).

**CONFLICT (recorded verbatim, marked):** the Rev 5 mode rail has **five**
mode icons — Live, Base·Central, Factory, Expressions, Technē
(`WORLD-SHELL-DESIGN.md:24-27`; `shell/modeGrammar.ts:30-31` `SURF_MODES`) —
and no Epi-Logos icon; the cradle has **six** WorkspaceModes including
`epi-logos`; the compilation commission says "plus the Epi-Logos lens". The
sources reconcile only partially: Epi-Logos is a **world context**
(`WorldContext.world`) and an **agent-composition default** (mode button in
Expressions/Technē), not a seventh shell mode in the Rev 5 rail. What the
Rev 5 rail's omission means for the new shell — whether the Epi-Logos world
binds through the encounter spine only, or regains a rail icon — is not
decided anywhere in the ground.

OPEN-QUESTION (for the owner) **#2 — Epi-Logos in the new shell's mode rail:**
is Epi-Logos (a) a world context + agent-composition lens riding the spine
(as the cradle's E2 and the Rev 5 rail imply), (b) a sixth mode icon to be
added to `SURF_MODES`, or (c) deferred entirely? The build model must not
invent an answer; the spine already supports the world axis either way.

OPEN-QUESTION (for the owner) **#3 — Epi-Logos lens elaboration:** the
master planning session's extracted chunks contain no Epi-Logos elaboration
(coordinator-confirmed); the elaboration that exists lives in
`EPI-LOGOS-AGENT-MODE.md`, `EPI-LOGOS-AGENT-ARCHITECTURE.md` (Actuation +
QL-MEF copies), `EPI-LOGOS-DEVELOPMENT-WAYFINDER.md`,
`EPI-LOGOS-SOURCE-OF-TRUTH.md` and the #201/#135/#220/#65 execution chain.
Whether the DLW build owes any Epi-Logos surface beyond the world-binding +
Nara/agency devices (e.g. the "curated Epi surface" the E2 entrance opens)
is unspecified in the shell sources.

**Folded as its own chapter here** per the commission; the driving-model
consequences (world context on the spine) are in §5.

---

## 5. The driving model — how the user drives the system

**The encounter spine (the only selection/navigation model).** "No second
selection or navigation model is introduced. The shell's de-facto tripartite
state machine is the spine": (1) **Mode** — `ShellMode` over the cradle's
`WorkspaceMode`, each mode carrying its own layout tree (`modeLayouts`), "a
mode never closes surfaces"; (2) **World context** — the workspace book's
`WorldContext` (`world: central | epi-logos`, subject, reading, trail) "plus
project navigation and recent places. This is the encounter: what is
selected, of which world, with what reading, and where you have been"; (3)
**Kernel epoch** — transport status and `accessEpoch`/`accessReady`
generation bumping, "which retires stale callbacks and gates every read on
the current connection" (`WORLD-SHELL-DESIGN.md:324-345`, §2). "Every
projection instance and every device reads the encounter from this spine;
selection changes propagate as encounter transitions, not as per-view state."
Landed: `projections/encounterBridge.ts` (epoch-guarded; transitions through
`book.setContext` as the one owner) — L1.

**The encounter bar and mediation (Rev 2).** "The spine is a bar above the
panes: Field › World › Subject › Occasion, plus the mediation of the current
encounter (search · graph traversal · direct · journey · palace · contact ·
return · placed). `encounter()` is the only transition; the Trail tile keeps
every encounter and returns to it"
(`WORLD-SHELL-DESIGN.md:227-231`). Glyph roster confirms the vocabulary:
"Encounter spine: Field, World, Subject, Occasion, aperture, view-as, trail,
packet, contact, return" (`[session]` msg 67).

**Aperture** (transport): World · Local · Shared · Federated. "Search, Earth,
Constellation and Timeline all admit the same; results beyond the aperture
are counted and offered ('＋ 2 more beyond the aperture — widen')"
(`WORLD-SHELL-DESIGN.md:232-234`). **View as**: me · field · public — "Your
planet fogs everything not projected; the rack's Projection device shows the
disclosure ladder; raising an audience always asks first"
(`WORLD-SHELL-DESIGN.md:235-237`).

**The three clocks (the user-facing temporal controls).** "The shell offers
three deliberate temporal controls, linkable but independent": **Now** — the
situated civil field (drives Earth and Timeline alike; reads the civil field,
never a wall clock); **Occasion** — "a selected or retained event's time (the
K8 sky contract's retained-occasion behaviour: reopening an exact saved
occasion keeps its snapshot and separately qualifies current admission)";
**Transport** — "the Timeline projection's playhead over performable
material" (`WORLD-SHELL-DESIGN.md:577-596`, §8; landed as
`timeline/timeSpine.ts`).

**The time strata (locked at the top, bound from below).** Owner words
(`[session]`, carried at `WORLD-SHELL-DESIGN.md:801-806`): "also consider the
cron and chronos level integration, as time is locked in at a higher level
(global time functions, kerykeion, day/now levels etc)." Five strata
(`WORLD-SHELL-DESIGN.md:800-834`, §15): 1. **Chronos** — qualitative/cosmic
time (kerykeion sky positions, M3 clock/inscription phases, Aion epochs) —
provided by QL, exposed read-only; 2. **Civil time** — the day/now closure
law, owned by Central; the spine exposes "the current day/NOW" as the default
Now; 3. **Cron** — scheduled/systematic time; families declare cadences as
parameters; every firing lands as a Timeline clip; 4. **Transport** —
performable time (playhead, takes, loops, markers); 5. **Occasion** —
retained time (snapshot basis + separately-qualified current admission). Plus
the **sample clock as the work-time stratum** (#281 §2.5 stands as law;
landed as `qlSampleClock.ts`: ONE mapping table, conversions without a row
refuse, anchors measured not computed). "Families bind, never fork clocks."
Two-clock doctrine (`lane-6-ableton-shell/SCOPE.md:151-177`): civil time
keeps NOW/DAY closure law; one work-time core; one typed bridge; lane-2's
`techne:time-axis/v1` is the bridge's content spec.

**The Atlas state machine maps onto the spine** (no second selection store):
"its five-state machine (World · Focus · Manifestation · Thread · Deep)
maps directly: World = projection overview, Focus = selection
(encounter.subject), Manifestation = an Expression opened, Thread = the
trail, Deep = full device edit. Its hash router… is the model for linkable
encounters" (`WORLD-SHELL-DESIGN.md:345-352`). Linkable states:
`?mode=techne&lens=M4&scale=body&body=earth&ap=3`,
`?mode=base&doc=thing&layout=solo` (Rev 3), 
`?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`
(Rev 2).

**Multi-select caveat (honest).** The spine's selection is today a
projection of one owner-side array with a one-at-a-time write path; two
"selected object" rules split (exactly-one vs first-id) and need an owner
ruling (`EXPRESSIONS-ENCOUNTER-SPINE.md:9-15, 120-158`). → OQ #4.

**Trail.** "The design's **trail** is not in the live shell" (audit finding,
`EXPRESSIONS-ENCOUNTER-SPINE.md:17`); the Trail tile is drawn in the mockups
and named in the spine — building it is part of the encounter work.

---

## 6. The capability matrices — where they live, their cells, what the build must update

The "Situate the concern" law: every lane that changes what a product can do
updates the affected matrix cells as part of landing — "matrices change a lot
to match the UI components directly and clearly — that is the point: they are
verification evidence, not afterthoughts" (`EXECUTION-PROMPT.md:148-158`;
`MAP.md:88-93`).

| Matrix | Where | Current cells / state |
|---|---|---|
| QL field index (Epi capability matrices) | `Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-CAPABILITY-MATRIX-FIELD-INDEX.md` + the registered family (`ProjectCentral/user/capability-matrix.{json,csv,md}`, `epi-m-capability-field*.json`, relational-field CSVs, deep coordinate matrices) | **185 runtime obligations unaccepted**; 14 packets / 26 subpackets; A0–A5/deep branches; registry checked by `scripts/check-capability-matrix-registry.py`; one entry `suite_catalogue: true` collated by O:I |
| O-I suite matrix | `Work/O-I/docs/CAPABILITY-MATRIX.md` | **166 capabilities** (75 partial / 75 landed / 15 claimed-only / 1 historical), receipt laws stated (timestamp-bound closures; implementation-language-is-acceptance; physical-acceptance-is-no-parking-reason; aggregate-counts-are-not-set-completeness; S-only scope) |
| New-shell browser taxonomy | `new-shell/BROWSER-TAXONOMY-DIFFERENTIAL.md` + `browser-taxonomy-matrix.json` | **68 cells** (17 Ableton folder types × 4 modes), EVIDENCE/INFERENCE tagged; two open questions recorded (OQ #24/#25) |
| 126-target acceptance register | `new-shell/README.md` + `ACCEPTANCE-CHECKPOINT.md` + `targets.json` | 126 identities bound to file/block SHA-256; five axes (implemented/exercised/passed/failed/blocked) **all pending, 0 passed** |
| Agent-device ownership map | `new-shell/AGENT-DEVICE-OWNERSHIP.md` | Per-device family + native source; corrected 29→28 parameter rows (F4) |
| Port ledger | `new-shell/EXPRESSIONS-PORT-STATUS.json` | 213 rows; statuses per §1.2; L6 audit gates re-runnable |
| Musical family | L9 ticket + `inhabitants/ql/` | D13-in-the-type; realtime gate measured fixture-side; shell-host gate open |

**What the build must update, per lane:** the crosswalk accounting for touched
targets (every lane's evidence/acceptance names this); the matrices' cells to
match landed UI components; the widget guide's improvement ledger
(`WIDGET-GUIDE.md` §8 — "the guide tracks the best landed state"); MAP.md's
Decisions-so-far and frontier. Verification loop: lane checks + computer-use
exercise + UX-spine conformance (§2 of design; no second selection model) +
matrix updates (`EXECUTION-PROMPT.md:145-158`).

---

## 7. The build order — phases from the sources

**Phase 0 — the prerequisite state (do first; nothing else accepts without it).**
1. **The native run path (R1)**: the supported way to run the NEW shell at
   HEAD inside the Tauri host from the seat — "Nothing else should be
   accepted in any other surface" (`DEVELOPMENT-TRACK-2026-10-09.md:76-85`).
   Coordinate with the native composition parent's serialized release
   pipeline (their "B package … still pending").
2. **Installed-state disambiguation (R2)** — owner-approved rename/mark of
   the legacy app and stale candidate (`DEVELOPMENT-TRACK-2026-10-09.md:58-66`,
   88-90). Owner nod pending → OQ #7.
3. **Owner bindings in the native run (R4)**: gateway attachment, roster
   (after the ctrl binary reinstall — owner act, OQ #19), workcell reading,
   skillsets; "the 'not admitted' wall turns into real admitted devices or
   precisely named real absences" (`DEVELOPMENT-TRACK-2026-10-09.md:118-122`).
4. **World-context disclosure + disclosure components (R5)**: the shell
   visibly states which world it runs in; "a screenshot must never again be
   mistakable for the product" (`DEVELOPMENT-TRACK-2026-10-09.md:123-127`).
5. **L4 + L9 sequenced commits** land behind the native composition parent's
   `timeline/` contract (staging lists on the tickets; their own two files
   land with THEIR lane's commit — L4/L9 resolutions).

**Acceptance of phase 0:** the native app boots at HEAD; every device either
admits through a real owner or names its absence; disclosure components
replace raw JSON dumps.

**Phase 1 — the widget-craft and verdict re-base (R3 + R6).**
- R3: every landed device to guide standard and beyond — 50 icon-cut marks
  programmatically extracted (`--check` green, zero invented SVGs); five
  named-outcome chips; honest dashed waiting cards; reading-row tables with
  boundary_op + standing + honoured-how; declared-unfireable tenders with
  receiptShape; shortfalls named (die-turn owner channel, per-position die
  counts, row composition) — `DEVELOPMENT-TRACK-2026-10-09.md:103-117`.
- R6: "re-run the acceptance in the native app with the craft bar included;
  the fidelity oracle gains craft assertions; the parent closes on native
  computer-use evidence only" (`DEVELOPMENT-TRACK-2026-10-09.md:128-131`).

**Acceptance:** computer-use pass on the live screen at both viewports;
L3 opens and closes (devices past the widget guides, improvements recorded
back into `WIDGET-GUIDE.md` §8).

**Phase 2 — the eight seams completed (the design's smallest seam set,
`WORLD-SHELL-DESIGN.md:622-651` + `UX-SPINE-ALIGNMENT.md` threads).**
T1 projection pane kinds (L1 landed; the main-area pane-tree promotion and
projection-pane detach are the named open successors, L1 resolution);
T2 module boundary (landed); T3 encounter bridge (landed); T4 inhabitant
manifest (landed; App.tsx body wiring is the integrator's join); T5 Timeline
generalisation (L4 sequenced — land it); T6 occurrence binding contract
(atlas side landed; QL sky adapter is the declared reserved seam
`ql-sky-earth-adapter` L2 declined to write); T7 time spine (landed; cron
executor = Workcell/Actuation runner); T8 device pop-out (rides detach).
Then T9+ family carvings per product (Central first, then Actuation, AIKit,
Factory, Workcell, QL) — `UX-SPINE-ALIGNMENT.md:39-121`.

**Acceptance:** "two panes hold two projections of one subject; hidden
retention restores camera/selection" (T1 gate); "a curated feature
integrates by manifest with zero shell surgery" (T4); "a day, a run and a
conversation all present as tracks with launch/record/move/trim/split
through their native owners" (T5); "a Jung occurrence, a Factory artifact
and a QL body all place on the same globe through one contract" (T6); "an
experiment cadenced by a transit and a day-close at 21:00 coexist without
forking clocks" (T7); seventh-product neutrality (T9+).

**Phase 3 — the two verticals (the system proofs).**
1. **The Factory vertical**: "a real Factory agent performs a bounded piece
   of work on a real Jung/World object; the result is recovered through
   Earth, Timeline, Constellation, Expressions, the relevant devices, and
   agent/files inspection — identity, provenance, work and context continuous
   throughout; repeated with views closed, reopening, occupant change and a
   retained occasion" (`WORLD-SHELL-DESIGN.md:849-856`, §17; prerequisite:
   the Factory receiving join, `MAP.md:139`).
2. **The Central vertical**: "one real day is recovered through the Timeline
   (day track with return/handoff clips), the Day document device, a
   conversation clip + Nara device, and the wiki's Constellation — proving
   Central's resolution without a separate mode" (`WORLD-SHELL-DESIGN.md:856-861`).
Both are UX-side cutover gates 1–2 of `LEGACY-CRADLE-RETIREMENT.md`.

**Acceptance:** computer-use walks with receipts; matrices + spine
conformance recorded (L8).

**Phase 4 — the target sets (the 126, staggered per CONVERGENCE's
recommendation, updated by landed reality).**
- Recommended order (`CONVERGENCE.md:106-111`): "lane 3 first (its editing
  core unblocks lane 5's RE passes and its A1-shaped save work strengthens
  every other lane), lanes 2 and 4 next (the time-axis contract is already
  proven at the wire level), lanes 1 and 5 following." Lane 3's kernel-first
  order inside the set: E20 (save expressibility) → E03 (ref addressing) →
  E15/E16 (receipted undo) → E08 → E12; E14 + the slip field carry the set's
  only kernel-side additions and "are flagged for owner eyes before phase 3
  starts" (lane-3 Sequencing note).
- The Live-mode work runs against the device corpus as it gates
  (COVERAGE.md ledger; golden renders; 70 devices stipulated).
- The Expressions port ledger drives to resolution: every row outward home +
  live replay; the nine partials' true gap is the kernel save_as/fork/create
  op + shell New control + admission policy (L6 Part B).
- Each phase's acceptance = the per-target acceptance shapes (verbatim in
  `FUNCTIONAL-CROSSWALK.json`, which "retains each original target's complete
  exact definition, acceptance passage, source hash and line range").

**Phase 5 — harmonisation, integration, retirement.**
Phase-4 harmonisation (the one Expressions-family visual/interaction
grammar; each instrument keeps its native controls — dual-reading §7) and
phase-5 integration through the env seats (`PROGRAMME.md:164-173`); lane-7's
P6 naming harmonisation in code rides phase 4 (`STRUCTURE.md:198-200`);
legacy cradle retirement executes on the owner's named day against the
cutover gates (`LEGACY-CRADLE-RETIREMENT.md:1-3`).

**Standing laws binding every phase** (verbatim sources): port law
(`MAP.md:96-101`); aperture law (`MAP.md:102-105`); widget law
(`MAP.md:106-115`); musical law (`MAP.md:116-120`); honesty boundaries
(`MAP.md:121-124`); licence gate (`PROGRAMME.md:43-49`); guardrails
(`PROGRAMME.md:187-199`); not-do laws (`WORLD-SHELL-DESIGN.md:652-667`,
`UX-SPINE-ALIGNMENT.md:139-150`). UI acceptance is by direct computer use
(owner ruling 9 Oct, `MAP.md:52-58`).

---

## 8. The OPEN-QUESTION ledger — every gap/conflict found, for the owner

Conflicts are recorded verbatim above and indexed here. The count: **27.**

1. **The name "DLW / Digital Logos Workspace"** appears in the compilation
   commission only — zero hits in `Work/`, `Control/`, or the master planning
   session. Adopt as the owner's name going forward (orchestrator
   direction), and have the owner confirm on the ground (naming is
   authored-human ground; a generated adoption stays generated until
   adopted — `propose-not-write.md`).
2. **Epi-Logos in the mode rail** — five-mode Rev 5 rail vs six-mode cradle
   enum vs "plus the Epi-Logos lens" (§4 conflict).
3. **The Epi-Logos lens elaboration** in the new shell (beyond world-binding
   + the mode button) — unspecified; the elaboration lives in the QL/O-I
   docs (§4).
4. **Multi-select ruling** (`EXPRESSIONS-ENCOUNTER-SPINE.md:155-158`,
   verbatim): "Decide whether the owner supports multi-select. If not, the
   app should stop writing more than one id (`app.ts:341`)… If it does, add
   one owner multi-select operation… Pick one rule for 'the selected object'
   and apply it in `chosenControls.ts` and `editorHost.ts` as well as in the
   shell." Until ruled: the rack shows no target while a Follow control
   drives the first object.
5. **Autonomy vocabulary** (`AGENTIC-CONVERGENCE.md:334-339`, open design
   question 1): "is `suggest / act_with_review / autonomous` the right
   ladder, or should it inherit the respond-gate's author-facing terms
   (owner-only / allowlist / anyone)?"
6. **Macro ↔ skill mapping** (same list, q2): "Do macros map to skills 1:1,
   or may a macro compose a skill chain?"
7. **Escalation address** (q3): "another agent (Buzz's owner_cache pattern)
   or always human?"
8. **Conversations rooms** (q4): "set-level and Scene-level rooms
   simultaneously (a room per scope) or one room at the selected scope with
   a scope switcher?"
9. **Budget units** (q5): "turns are the harness's native count; wall-clock
   and cost need the harness's ledger to be admitted as truth."
10. **Stop-twice rollback** (Rev 2 still-open, `AGENTIC-CONVERGENCE.md:212-214`):
    "whether Stop-twice may roll back writes that already have a receipt."
11. **Hold launch mode** (same): 'whether Hold launch mode ("think while I
    talk") is wanted.'
12. **Installed-state disambiguation (R2)** — owner nod for the rename/mark
    (`DEVELOPMENT-TRACK-2026-10-09.md:58-66`).
13. **ctrl binary reinstall** — the owner act that clears the shell's roster
    disclosure (CE1 carry-forward).
14. **Remote posture ruling** — remote carrier "stands at refused/composed,
    never live (owner ruling)" (`AGENT-SHELL-ACCEPTANCE.md:62`); the
    Workcell remote-posture ruling (composed vs live) is named open fog
    (`MAP.md:184-186`).
15. **Pushed turn streaming** — gateway convergence backlog item 1; threads
    poll today (`AGENT-SHELL-ACCEPTANCE.md:59`).
16. **Projection-scale performance and clustering** — "the one confirmed-open
    question… Needs its own research commission before any lane promises a
    number" (`MAP.md:169-176`).
17. **Visiting exercised end-to-end** — contracts exist, no live cross-machine
    visit flow run in the shell (`MAP.md:176-179`).
18. **QL-side procedural body-generation contract** — planet-building controls
    drawn (Rev 3), GPU globe engine named (§3.1); "the per-World seed→body
    contract on the QL side is the remaining specification"
    (`MAP.md:180-183`).
19. **Multi-machine physical acceptance** — Workcell #24/#26/#27 + Arrakis
    live smoke (`MAP.md:184-188`).
20. **Lane-3 kernel-side additions flagged for owner eyes** (lane-3 Sequencing
    note): E14 nesting budget behavior, the slip field in E06, and the
    dedicated `marker_set` Change kind in E12.
21. **Step-transition bound conflict** (`EXPRESSIONS-PARAMETER-ADDRESSES.md`
    note 3): registry hard minimum 0.02 s vs `hostEditor.ts` admitting
    0..3600 — "Reconcile one or the other."
22. **Port-ledger count discrepancy**: KERNEL-STATE-FOUNDATION says "207
    literal app router actions"; the ledger and L6 say **213 rows**. The L6
    audit's 213-row read is the current of record; 207 survives in older
    prose. (Recorded; reconcile at the ledger.)
23. **Groove (swing) has no assigned DLW meaning** — Live's groove *pool
    geometry* is reused (study §Browser below) but no source maps groove
    content (swing/timing feel) into the World grammar. Silent in sources.
24. **Browser-taxonomy Q1** (`BROWSER-TAXONOMY-DIFFERENTIAL.md:16-18`): "the
    request says '15 types x 4 modes = 60 cells', but its own list names
    **17** rows… the matrix has **68 cells**… The owner should confirm this."
25. **Browser-taxonomy Q2** (same, :19-22): the shells disagree about what a
    "mode" is (live shell 3 modes vs cradle 6 vs design's world-context
    resolution) — "Open question Q2."
26. **Licence contradictions vs research claims** (`ACCEPTANCE-CHECKPOINT.md:28-30`):
    "Actual pinned licences contradict two research claims: Twine 2.12.1 is
    GPL-3.0; TimelineJS3 3.9.13 is MPL-2.0. Both remain interface-only."
    Any adoption is an explicit owner decision per the licence gate.
27. **Cursor/Codex original captures unrecovered** (`FUNCTIONAL-CROSSWALK.md:236`
    — "preserve names and retrieve exact evidence"; V1's F5): the original
    independent verdicts' full fault lists are unrecoverable; three
    reconstructable defects were verified.

**Named-unowned baseline defects** (not questions but the build inherits
them): 15 cradle TS2550s; hosted-contributions drift (L1/L8); the
FactoryLive producer-consumer fault (§3.3); the S1 second selection store
(§3.4); the Time Scale authored/effective display fault
(`KERNEL-STATE-FOUNDATION.md:78`); the two pre-existing BASE test failures
(`AGENT-SHELL-ACCEPTANCE.md:92-94`).

---

## 9. Source coverage statement (what was found vs not)

Found and read (full or structural): PROGRAMME.md, CONVERGENCE.md,
WORLD-SHELL-DESIGN.md (all five revisions), UI-UX-CONVERGENCE-STUDY.md,
FUNCTIONAL-CROSSWALK.md (+ registers), INSTRUMENTATION-CONTRACT.md (head +
structure), NATIVE-EDITOR-STANDARD.md, INSTRUMENT-EDITORS.md,
AGENTIC-CONVERGENCE.md, AGENT-SHELL-ACCEPTANCE.md, DEVICE-PANEL-BRIEF.md,
KERNEL-STATE-FOUNDATION.md, STARTUP-CONTINUATION.md, NATIVE-COMPOSITION.md
(head + structure), SETTINGS-COVERAGE.md (head + the 50-descriptor census
shape), UX-SPINE-ALIGNMENT.md, LEGACY-CRADLE-RETIREMENT.md,
ACCEPTANCE-CHECKPOINT.md, README.md, NATIVE-ACTIONS-AUDIT-20261009.md,
AGENT-DEVICE-OWNERSHIP.md, EXPRESSIONS-{FEATURE-MAP, FOUR-SURFACES,
ENCOUNTER-SPINE, PARAMETER-ADDRESSES, FAMILY-SESSION-BRIEF, PORT-PLAN}.md,
icon-cut.html (tokens), all five lane TARGET-SET.md (full for lane 3 +
lane-6 SCOPE + lane-7 STRUCTURE; openings + craft bars for lanes 1/2/4/5),
wayfinder/{MAP, EXECUTION-PROMPT, DEVELOPMENT-TRACK, WIDGET-GUIDE, 
CONTEXT-PACK, C2-CORPUS-SEAM}.md + all 20 tickets, the project NOW register
(43 agent records) + day readings 2026-10-09, M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md
(full), EPI-CAPABILITY-MATRIX-FIELD-INDEX.md, EPI-LOGOS-AGENT-MODE.md,
UI-FUNCTION-LANDING.md (E2/R1 rows), ASTRA-BRIEF.md, shell-inputs/INDEX.md,
COVERAGE.md + LANES.md (Live 12 corpus), the master planning session
(three focused queries), the landed code (modeGrammar, inhabitants, timeline,
agent, projections trees; git log), Work/O-I packages inventory.

Not found / does not exist: any document named
`EXPERSSIONS-ENCOUNTER-SPINE.md` (the commission's spelling; the real file is
`EXPRESSIONS-ENCOUNTER-SPINE.md`, read); any ground use of "DLW"/"Digital
Logos Workspace" (OQ #1); an Epi-Logos elaboration in the master planning
session (OQ #3); a lane-6 Rev 3+ (SCOPE stands at revision 2); the
`live-dynamics` crate in the env-1 seat (it lives at `Work/O-I/packages/`).

Companion file: `wayfinder/SOURCES.md` — every file read with its
contribution.
