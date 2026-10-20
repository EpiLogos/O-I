# DLW — the Digital Logos Workspace: the unified product-build plan

> **Superseded on device semantics and owner facts (12 Oct 2026):** `DEVICE-SEMANTICS-LOCK.md` is the law, `PATH.md` the route, `EXECUTE.md` the execution prompt. The §10 OPEN-QUESTION ledger is retired: the lock and the settled facts (lock §0) answer it, and builders never stop on it. Detail sections stay background, conformed to the lock where they differ.

**Precedence (12 Oct 2026).** The vision of record is
[DLW-VISION.md](DLW-VISION.md): the DLW as the instrument of Epi-Logos,
compiled from the owner's contemplation and his five-mode ruling of the same
day ([CONTEMPLATION-DLW-INSTRUMENT.md](CONTEMPLATION-DLW-INSTRUMENT.md),
ruling at `CONT:232-252`). **This document stays the plan of record for
detail.** Where the two touch, the vision governs figure and framing; owner
rulings and settled law govern specification: the mode ruling, D13, §11a,
the two-clock doctrine and the 126 target identities (`MAP.md:200-201`).
The vision overrides none of them. The 12 Oct revisions in this document
apply DLW-VISION §5.1–5.2 and are marked *(12 Oct)*. In them, `CONT` is the
contemplation, `VIS` is DLW-VISION, `L-n` is a layer in VIS §1.2, `Ln` is a
row of the VIS §4 ledger, and the other short keys (`LOCK`, `MPW`, `TDR`,
`GRAM`, `DOCK`, `APPA`, `PRAX`, `REL`, `LIVE`, `UI/…`) resolve through
VIS's path-key list (`DLW-VISION.md:28-66`). Line cites into this plan
inside VIS (`PLAN:n`) name the pre-revision lines.

**Standing:** compiled unified plan, lane `zcode:dlw-compile-final`, dispatched by
orchestrator `zcode:world-shell-orchestrator`, 2026-10-10. It merges three
harvested part-drafts into one document:

- `DLW-PLAN-draft-p1.md` (the skeleton: product, ground truth, ontology,
  mode chapters, Epi-Logos, driving model, matrices, build order, the
  27-item OPEN-QUESTION ledger),
- `DLW-PLAN-p2-ableton.md` (Chapter A, the Live-mode measured reference and
  derivation corpus; Chapter B, the device ontology — folded here into §4.1
  and §3),
- `DLW-PLAN-p3-ontology.md` (Chapter C, the expressions ontology → §5;
  Chapter D, the driving model → §6; Chapter E, Epi-Logos → §7).

This document is an **extraction, not an authorship**: every claim cites its
source (path, and line where the source is stable). Where the sources are
silent or ambiguous the text says `OPEN-QUESTION (for the owner): …` and
fills nothing from imagination. Where two sources conflict, both are recorded
verbatim with the conflict marked. The unified OPEN-QUESTION ledger is §10.
Consumer: a build model (Claude Opus) left alone to build the full app.
Bridge prose added by this compile carries no specifications.

**Naming law for this document.** The product is named **DLW — the Digital
Logos Workspace** (owner ruling, 10 October 2026, carried by the compilation
commission): DLW is forward in all copy and structure here. Provenance is
recorded, not hidden: the name appears in the compilation commission as "the
owner's declared product identity", and **it does not appear in any ground
document or in the master planning session transcript** (grep over `Work/` +
`Control/`, 2026-10-10: zero hits **outside the plan family itself** — whose
files necessarily carry the name under examination; "DLW" hits
are package-lock hash noise only). Ledger §10 item 1 keeps the owner's
on-the-ground confirmation open. **The artifact of record for the design is
`new-shell/WORLD-SHELL-DESIGN.md` — "the World Shell": DLW is the product
name; the World Shell is the design's name.** The ground's own names for the
same artifact: "the world shell" / "the new shell" (WORLD-SHELL-DESIGN.md
title: "World shell design — one World, four projections, real panes, one
rack"), the "O-I Shell Candidate" app, and "the complete Epi-Logos working
world" (owner words, `ASTRA-BRIEF.md`). "DLW" and "the world shell" denote
the same artifact throughout.

**Epi-Logos naming law.** Epi-Logos is **a lens/world-context, not a mode**
(ruling D2 + amendment A5, 2026-09-18; the cradle's `WorkspaceMode`
`"epi-logos"` enum value is a refused seam — the mode switcher filters it
out). The three registers are distinguished in §7 per P3 Chapter E. What the
*new shell's* mode rail owes Epi-Logos is settled *(12 Oct)*: "Epi-Logos a
lens, not a mode (standing ruling D2/A5)" (`CONT:252`); ledger §10 item 2
closes as answer (a).

**Master planning source.** The owner's planning session of record is ZCode
session `sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2` ("Ableton Shell Handover
and AI Agent Planning"); its owner decisions are cited as `[session]` with
the verbatim words. Its durable artifact of record is
`new-shell/WORLD-SHELL-DESIGN.md` — cite both wherever a decision stands.

**Governing precedence** (stated by the sources themselves): PROGRAMME.md
owner rulings "supersede older wording wherever the two differ"
(`PROGRAMME.md:14-15`); mockup revisions supersede earlier revisions
(`WORLD-SHELL-DESIGN.md:103-104` — "Where this conflicts with Revision 2
below, this revision stands"; Rev 5 is "the final pass", :17-19); the
DEVELOPMENT-TRACK (9 Oct) "supersedes the session's completion-shaped
framings" (`DEVELOPMENT-TRACK-2026-10-09.md:6-7`). *(12 Oct)* The owner's
mode ruling (`CONT:232-252`) is a later owner ruling and governs earlier
wording where the two say different things at the same level (VIS Standing,
**Inferred** from the `PROGRAMME.md:14-15` precedent). DLW-VISION governs
figure and framing, never specification (preface above).

**Source keys.** Bracketed tags such as `[session-model §4]`, `[racks §1.7]`,
`[SDK]`, `[mockup:world]`, `[UI-EVIDENCE]`, `[CROSSWALK]`, `[WSD §14]`,
`[SCOPE rev2]` resolve in `DLW-PLAN-p2-ableton-SOURCES.md`; P3's code-path
abbreviations (`src/…` = the seat's
`packages/live-shell/ui/src/…`, `cradle/src/…` = the cradle's source tree)
resolve in `DLW-PLAN-p3-SOURCES.md`. P1's full source inventory is
`SOURCES.md`. All three companion files stand beside this one in
`wayfinder/`.

---

## 0. The product — what DLW is, in the sources' own words

**The figure** *(12 Oct; VIS §0 items 1–2)*. A DAW is "a total environment
for a medium"; the Glass Bead Game is "a total environment for meaning"
(`CONT:26-28`). "Hesse described the pattern. Live proved the pattern can
exist as software. The DLW is the instance" (`CONT:32`), aimed at the total
contents and values of a *world*: "Not a database, not a wiki, not a
chatbot, not a knowledge graph" (`CONT:30`). Live's proof is for a medium
(`CONT:194`); the study's finding that no coherent computational Game yet
exists (`AFTER:150-152`) is the bar the instance has to meet. Live's lesson
is that the power "is not in any single feature — it is in the integration,
the porousness, the shared clock" (`CONT:26`). The game the DLW exists to let
anyone play is Epi-Logos, its native game: "the corpus made playable… the
reflective turn — language operating on language — as a total environment"
(`CONT:14,198`). The corpus is the esoteric identity, the system the
exoteric, and the mode the projection of one over the other, "bimba over
pratibimba" (`CONT:18`); the day is the session in which the game is played
(`CONT:228`). Epi-Logos is "a philosophical project" by the owner's
clarification of 11 Oct, as the study records it (`GBG/README.md:23-24`;
`PRAX:50-51`). The sentence below gives the instance's anatomy; this
paragraph says what the anatomy is for.

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
  `Work/reverse-engineering/ProjectCentral/now/agents/implementation-commission-recorded-astra-lane-2026-10-07.json`
  — the programme register's full path; this plan's own directory has no
  `ProjectCentral`.)

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
  - **The mode set is owner-ruled law** *(12 Oct)*: "Five modes stand: Live
    stays as the base mode" (`CONT:234`). Mode set for the build: **Live
    (base) · Central · Factory · Expressions · Technē**, with Epi-Logos a
    lens, not a mode (`CONT:251-252`). Live is the reverse-engineering
    basis: Live's real deep dynamics as one unified technology (live-set,
    live-dynamics, live-engine, live-shell), "ported, not approximated"
    (`CONT:244-246`). Its destination is Expressions, where audio and video
    track layers live together on one timeline, "like davinci"
    (`CONT:236-241,247-250`); until then Live stays a distinct base mode "so
    the port stays clean and measurable" (`CONT:249-250`). The music/audio
    half is already grounded (`MPW:10`; `WORLD-SHELL-DESIGN.md:917-918`); the
    video half rests on the ruling alone (ledger item 51). The code's rail
    already matches the set (`SURF_MODES`, `shell/modeGrammar.ts:33`); the
    Revision 5 quote above keeps its "Base · Central" wording, which the
    ruling reads as "Central" (§4 head). One environment, never separate
    apps (`CONT:169`): material becomes material in another mode (§6.1).

- **The planning posture** (owner, `[session]` msg 68, verbatim sic): "we are
  plannign the full system shape and sccope, all leanes come off and back to
  this one no?" — realised as `wayfinder/MAP.md` ("the centre of gravity for
  shell work", `PROGRAMME.md:3-10`) and honoured by this plan.

- **The craft bar** (owner, `[session]` msg 72, verbatim sic — with two
  transcription deviations noted at the grill: the raw transcript reads
  "beaureucracy" and "MU)CH BETTER" where this rendering has "beaureaucracy"
  and "MUCH BETTER"): "make sure the
  mockup standards remain as 'guides', the whole 'binding' langauge can beocme
  a too-rigid beaureaucracy that misses teh obvsiou need for the real feature
  to fucntion and look MUCH BETTER than teh mockups." Widget law
  (`MAP.md:106-115`): "A device is done when it works honestly through its
  owner AND functions and looks better than the mockup drew it… falling short
  of the guide is the only failure."

**The measure** *(12 Oct; VIS §0 items 4–7)*. The craft bar measures the
device; these measure the work the devices serve. Each is the owner's
account, grounded in the kernel where VIS cites it; none is a UI label.

- **Editing is origin-return.** Technē's editing "is not just editing — it
  is working the material backward into its origin"; that working is
  compassion, "loving sensitivity to origins", with origin as Gebser's
  ever-present origin, "the origin not as a point in the past but as an
  ever-present source" (`CONT:84-88`). "The
  Archive is reversible. And the tracing is love" (`CONT:88`). The kernel
  grounds the return: M0 is "The Ever-Present Origin"; M4 Nara is where the
  individual self "awakens through compassionate sensitivity to origins";
  M5-5's synthesis is the 5→0 write-back, an-a-logos "completes the return",
  its etymological archaeology deposited "through review and Hen
  vault-write into M0's bimba node"; M4.5-1 names "pedagogical compassion"
  (live Bimba map, queried 12 Oct 2026; VIS §0 item 4, L-6). Provenance by
  ref and revision, with an exact return, is the material condition of the
  act, not the act (§4.5).
- **The meditation is a dialogical encounter.** "The meditation is not a
  pause. It is a dialogical encounter. The oracle speaks; you listen. The
  system meets you; you meet the system. This is the layer that keeps the
  symbols alive" (`CONT:98`). It is M4 Nara, foreground in the 3:3 reading
  (`LOCK:31`), on the chain M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′
  (`LOCK:96`). Nara's work is "not providing answers but midwifing
  recognition" (live Bimba map, M4 `q_4_individuation_threshold`).
- **The teaching is the encounter.** "The system teaches by being met. Epii
  is the face you meet. The teaching is the encounter" (`CONT:106`). Palace
  is the form the M5 pedagogy pole takes in Technē, "the explicit deep
  objectification of the otherwise ambient M5
  articulation/pedagogy/recognition pole" (`LOCK:358`). No help or Lessons
  panel stands in for it, and no device judges synthesis for the player
  (`PRAX:497-500`).
- **The modes are porous.** "Live is not five apps sharing a file format"
  (`CONT:169`): a Central reading becomes a Factory commission's source, a
  cymatic sweep in Expressions becomes a Journey phrase, a Technē Palace
  composition becomes a return to Central's wiki as a proposal (`CONT:167`;
  §6.1).
- **The work ends.** "Games end… The score remains. This is what keeps a
  total environment from becoming a totalising prison"; "An instrument that
  cannot imagine its end will defend it" (`CONT:159,161`). In the kernel an
  ending is a completion that hands the work back as ground — M5-5
  "perfects itself by perishing into ground… The cycle completes by
  starting" (live Bimba map, M5-5 `q_5_mobius_writeback_reopens`) — and a
  stage ends "when stage completion criteria are met, not on fixed time
  intervals" (`BMAP/M5/M5-5/M5-5.md:19`). The day closes; nothing larger
  than the day yet retires with record (VIS L9, **Open**).

---

## 1. The ground truth — what exists today (the build starts here)

### 1.1 Landed code (verified on disk at the fold, 2026-10-10 ~13:30 BST, HEAD `109ba5d5c`, seat `worktrees/env-1/o-i`, branch `agent/o-i-20261007-1639`; the tree holds 84 uncommitted changes at the recount)

**Seat now** *(12 Oct)*: `worktrees/env-1/o-i`, lane `dlw/build-20261012`, cut
from `main` `619a4548b`. The shell landed on O-I `main`: #635 (`169f55c6f`,
10 Oct), #637 (`d7e40b32b`) and the 11 Oct fold-in `0dfa7b5ea`, with the
11 Oct Live-mode device-face rounds (PATH §2, `PATH.md:30-34`; `git log
main`, 12 Oct). `agent/o-i-20261007-1639` is history; the heading above
records where the fold verified, not where to work.

All under `/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/` unless noted:

| Exists | What it is | Source of record |
|---|---|---|
| `shell/modeGrammar.ts` | Rev 5 as data: five modes × transport slots, per-mode Session\|Arrangement presentations, Rev 4 Clip\|Device pairs, per-mode browser categories (`cut` vs `waiting`), centre compositions, status identities; cross-tested against `inhabitants/sdk/modes.ts` by `tests/mode-grammar.test.mjs` | `DEVELOPMENT-TRACK-2026-10-09.md:89-104` (commit `20da871dc`); file header |
| `shell/` frame pieces | `ModeBrowser/ModeCentre/ModeContextDock/ModeDetail/ModeModeRail/ModeTransportBar`, per-mode content composition commits (`5d1a1da27`, `22144b951`, SDK commits `ec2cac658`, `b3d15a776`, `3b466340e`, `fe61d0c58`, `d1cee07f4`, `1dbbb7954`, `f20e4ee5a`, `b80286705`, `c05843ad3`); the cross-mode fidelity sweep `109ba5d5c` (19 of 24 defect-table rows closed; mode-grammar suite grew 9→14) | git log at seat |
| `inhabitants/manifest.ts` + family manifests | InhabitantManifest schema (face kinds parameter\|document\|conversation\|instrument; admission admitted\|waiting; declared extensions onto owner-admitted bases; owner-authority + face-collision refusals). Six families declared: **central 7/0, actuation 5/0, ai-kit 5/0, software-factory 6/0 per the L2 ticket's count — 5 faces on disk** (agent-custody, context-write-mode, ledger, approvals, run-device; the ticket's convention counts differently — both stated at the grill fold), **workcell 4/0, quaternal-logic 0/6 all waiting with named owners** (sky, torus, m3-clock, deck, chakra, m-prime-matrices) | L2 ticket resolution (`wayfinder/tickets/L2-rack-family-manifests.md`), commit `5bd6ff239` |
| `inhabitants/` Central devices | hygiene, impact, day/now, subject-detail — 14 numbered readings each with `boundary_op`; civil ops DECLARED-never-fired | L7 ticket resolution, commit `ba2db1b52` |
| `inhabitants/ql/` + `qlMusicalExtension.ts` | musical declaration half: strict reading model, REAL standing states, six-ref identity tuple, u64 cursors, 48 kHz receipt, embedded policy (block 8192, lead/lookahead 0.5 s); **M2 modulation sources with `generates: false` in the type (D13 as compile-time law)**; `quaternal-logic:musical-l9` instrument face admitted with honest absence | L9 ticket resolution, commit `d0901c9ec` |
| `timeline/timeSpine.ts` | The time spine: Now (reads civil field, never a wall clock) · Occasion (retained snapshot basis + separately-qualified current admission) · Transport (playhead, drives nothing) · Chronos (read-only binding surface, honestly empty until QL binds) · Cron (cadences as parameters; every firing lands as a Timeline clip). Pure, no timers | L4 ticket resolution (sequenced commit); file header |
| `timeline/` track adapters | `worldTrackAdapter.ts` (the found parent contract), `dayTrackAdapter`, `runTrackAdapter`, `conversationTrackAdapter`, `expressionsTrackAdapter`, `qlAudioTrackAdapter`, `qlPhysicsTrackAdapter`, `qlTrackRoles.ts` (miscast roles refuse by naming the law), `qlSampleClock.ts` (7-row `QL_CLOCK_MAPPINGS` sample-clock table; conversions without a declared row refuse; anchors measured, not computed), `registerWorldTrackAdapters.ts` | L4 + L9 ticket resolutions |
| `projections/atlas/` | The Archetypal-Earth port: **82 modules** — globe engine, camera rig, tiles, graph build/view/tools/switch, five-state machine + linkable router, aion model/view, non-linear time scale, image pipeline — moved verbatim, 28/28 C2 corpus-neutrality amendments, zero Jung bytes; second-provider test passes; corpus deep links pass end-to-end | L5 ticket resolution, commit `4b17be9a2` |
| `projections/encounterBridge.ts` + `surface/projectionModules.ts` + `projectionPane.tsx` | Encounter bridge (mode × WorldContext × accessEpoch, epoch-guarded, transitions through `book.setContext` as the one owner); ProjectionModule contract (one-module-per-kind admission door that refuses replacement); projection pane kinds in the surface engine; two panes/two projections of one subject | L1 ticket resolution, commit `0d69d5b2c` |
| `projections/worldTimelinePresentation.tsx/.css` + `useWorldTemporalReading.ts` | The World cut: era ruler + declared break into civil week strip, four lenses, epistemic-standing chips never upgraded by placement, now/occasion/transport cursors; poller over ONE `temporal_events_read` (day-bounded cache keys keep K1's horizon warm: ~10 s cold / ~13 ms warm live) | L4 ticket resolution |
| `agent/` (28 files) | The agent shell: session grid, arrangement needles, thread view, context dock, browser, device chain (made physically real — drag, drop, slide, refuse, `5b5b6a4ca` + `agentChainDrag.ts`), transport, gateway control, run model, fidelity oracle hooks | `AGENT-SHELL-ACCEPTANCE.md` + V1 verdict ticket; git log at seat |
| `shell/live/` Live craft (10 Oct) | Live's place and surface at the measured Live standard: live empty states, live detail presentation, status-bar touches, `tests/live-mode-place` (8/8) | commit `0f4bfdadf`; git log at seat |
| Kernel fix (cradle) | Kernel read horizon: `temporal_events_read` was ~114 serial `oi` spawns/read; now one shared register reading + 8-worker fan-out + 2 s answer cache; measured 55 s → **cold 11.4 s / warm 1.4 ms live**, identity byte-equal | K1 ticket resolution, commit `92695a963` |
| Work/Central `9449881` | ctrl roster-read fix (validator learns `self_source`/`relational_logos` pins; 774/0 tests); ~~binary reinstall still pending (owner act)~~ **reinstall done** *(12 Oct)*: the fix landed as `efef5c3`, and installed ctrl `7a45111` (11 Oct 16:30) contains it (ledger item 13, closed) | CE1 ticket resolution; `PATH.md:39-40`; `git merge-base --is-ancestor efef5c3 7a45111` in Work/Central, 12 Oct |

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
  crate, golden-render gate) — the coverage ledger holds **53 device rows
  above its residual line, ≈62 device slots when multi-slot rows are
  expanded** (the rows-vs-slots counting convention; recount at the grill
  fold, 2026-10-10), 5 gates PASS (Glue Compressor, Echo, Reverb, Operator,
  Wavetable)
  (`Work/O-I/docs/research/ableton-live-12.0.25/devices/COVERAGE.md:1-52`,
  owner directive "full reconstruction… Nothing is out of scope until it is
  gated"). Measured Live captures (research evidence, never assets):
  `Work/O-I/docs/research/ableton-live-12.0.25/evidence/ui/live-session-real.png`,
  `live-arrangement-real.png`, `live-wavetable-device-panel.png`
  (`UI-UX-CONVERGENCE-STUDY.md:19-25`). One correction governs every visual
  claim: **the file named `live-wavetable-device-panel.png` shows Operator**,
  not Wavetable — measured and corrected in the functional crosswalk; the
  filename is not evidence; the content is (P2 Chapter A header; [CROSSWALK]).
- 126-target register: all five target sets approved as full functional scope
  (`PROGRAMME.md:34-38`); **native acceptance passed: 0 of 126**
  (`ACCEPTANCE-CHECKPOINT.md:23-31`, `README.md`).
- Expressions port ledger: 213 rows with `outward_home` + `boundary_op` —
  136 ported, 24 partial, 4 not-ported, 20 owner-op-required, 11
  studio-only, 12 internal, 6 other-track; **all rows
  `pending-native-stack`** (L6-audited counts,
  `wayfinder/tickets/L6-native-actions-audit.md`; MAP Lanes table concurs).
  CONFLICT noted at §10 (item 22): older docs say "207 router actions".

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
  `agent-shell-craft` **done** — `b80286705`, then the 10-Oct craft commits
  `0f4bfdadf` Live and `5b5b6a4ca` chain drag, and the cross-mode fidelity
  sweep `109ba5d5c` closing 19 of 24 defect-table rows) were the response.
- The two verticals (Factory + Central proof walks) remain OPEN (L8).
- The computer-use acceptance leg — machine-wide blocker resolved
  (`~/.zcode/cua-broker/relaunch-broker.sh` workaround,
  `DEVELOPMENT-TRACK-2026-10-09.md:19-21`); passes still to execute.
- Five fog items (`MAP.md:165-189`): projection-scale performance/clustering;
  visiting exercised end-to-end; QL-side procedural body-generation contract;
  pushed turn streaming; multi-machine physical acceptance.
- Lane-3's editor-core targets E01–E26 (0 landed into the shell as native
  admissions), and lanes 1/2/4/5's 100 targets likewise — the target sets are
  the work programme, none yet passed.

---

## 2. The ontology — Ableton's product grammar mapped onto DLW (the unified mapping)

The mapping is grounded in the measured Live 12 evidence
(`UI-UX-CONVERGENCE-STUDY.md`), the design doc, and the derivation corpus
(P2 Chapter B §B1–B2). **This one table unifies P1 §2 and P2 §B2** — both
source tables are merged row by row; where both sources carry a row, both
cites stand. Ground every UX decision in this table. The device-ontology
chapter that owns the DLW side of it is §3.

| Ableton concept | DLW ontology | Where sourced | Function test (`CONT:38`) *(12 Oct)* |
|---|---|---| --- |
| **Clip** — material in a lane (warp/fades/gain/launch craft included) | A clip is World material in a track: Expressions scenes, historical events, Factory runs/tasks, agent activity, conversations, civil days/returns/handoffs, celestial motion, M3 clock transformations; clips carry epistemic standing (fact · claim · inferred · hypothesis · disputed · ghost), never upgraded by placement. Clip craft: live mode's clip properties + note editor (mockup); Central's clip-view craft: "CAS identity, basis and the save router's named outcomes (`saved \| unchanged \| stale \| conflict \| refused`) are this world's warp markers" | `WORLD-SHELL-DESIGN.md:400-408` (§3.2); `UX-SPINE-ALIGNMENT.md:80-90` (T5); Rev 2 Timeline rows (`WORLD-SHELL-DESIGN.md:255-258`); [mockup:world liveDetail clip view; WSD §12 Central]; owner: Central is like Live's clip view — "the nitty gritty functionalities of warping etc" [session] | **F** |
| **Track** | A lane of World material — the Timeline projection's columns; track adapters project family material (day/run/conversation/expressions/audio/physics adapters over ONE `temporal_events_read` / scene membership — no second store) | `WORLD-SHELL-DESIGN.md:401-403`; L4/L9 adapters (§1.1; §5) | **F** |
| **Scene** (session row) + session grid | A batch/row launcher: Expressions scene rows (the native Scene is the atomic launch unit — "whole-Scene launch remains atomic", `UI-UX-CONVERGENCE-STUDY.md:51`); Factory scene rows fire a row of acts (`AGENTIC-CONVERGENCE.md:179`); journeys are walk-stops in scene-row form (Rev 2). The session presentation of any World track set — the set model gains World track adapters (day tracks, run tracks, conversation clips); Rev-5 per-mode Session meanings are typed data | `WORLD-SHELL-DESIGN.md:255-257`; WSD §10 seam 5; L1 landed one-Timeline fix; [SDK modes.ts] | **F** in all five (day-as-clips, tasks, scene rows, journey stops; GRAM:178,231,301,363,415) |
| **Arrangement** | The time-ordered reading of the same material: the integrated overview above the ruler is the single navigation surface — **no duplicate scrub bar** (owner ruling, retained, `WORLD-SHELL-DESIGN.md:407-408`) | `UI-UX-CONVERGENCE-STUDY.md:36` + design §3.2 | **F** |
| **Session ⇄ Arrangement as two presentations of ONE Timeline projection** | Not audio-mode features; a presentation is not a mode switch (the recorded App.tsx fault, fixed in L1) | `WORLD-SHELL-DESIGN.md:399-401`; L1 resolution | **F** |
| **Device** | One whole device = one panel/one parameter model with three presentations (compact ≤4 controls; expanded pool; full/centre) of the SAME live parameters; honest visual derived from readings; activator light only where a real owner enable exists. The DLW device face is a face over the proven aperture `{reading, disabled, apply, captureCurrent}`, composed from the SDK kit (`FacePlate`, `ScalarParam`, `EnumParam`, `BoolParam`, `ReadingRow`, `Lamp`, `Disclosure`, `WaitingFace`); "A face receives … and never dispatches a write of its own" | `DEVICE-PANEL-BRIEF.md:6-21` (owner model — "do not drift from it"); [WSD §5 "The device aperture is proven and generalises as-is"; SDK §controls, step 4] | **F** |
| **Device chain (per track) / Rack — the chain itself** | THE plugin system of the whole environment: devices attach to the rack of the pane whose encounter they operate on — the inhabitant rack on the selected material's chain: chain strip, compact vs configure, deep-edit expand, enable toggles all exist as presentation states [WSD §5: `NativeDeviceStrip`, `NativeRackEditor` `is-compact`/`is-configuring`]; chain order per mode (agent chain: gateway → agent → skillset racks → world → git, read left-to-right as "through → who → how → where → lands" [mockup:agent dropz]); the rack follows the focused pane's material. The agent-shell chain is the landed instance | `WORLD-SHELL-DESIGN.md:314-322` (§1); `MAP.md:147-149`; `AGENTIC-CONVERGENCE.md` Rev 5 | **F** (a format per mode, `UI/inhabitants/sdk/modes.ts:303-316`) |
| **Rack (4 kinds: Instrument / Audio Effect / MIDI Effect / Drum)** | **Family rack component form** — chains as rows with admit lights + a macro bank. Drum Rack's pad grid has its own face (the mockup's 16-pad Drum Rack [mockup:world liveDetail]); Instrument/Audio/MIDI racks share the chain-row form | [mockup:agent `skillRack()`; owner quote "Each chain is a skill; the light admits or denies it"] | **F** |
| **Chain / branch** | Chain row in a rack, with its own enable (the light) and its own device list; per-material chain gestures: inserted/selected/folded/moved/duplicated/removed/activated devices; hot-swap, presets, macro mapping (crosswalk "Device lifecycle and rack topology" family, `FUNCTIONAL-CROSSWALK.md:179-187`); "Serial/parallel/shared contribution topology has real separate supported native instances". Branch zones + chain mixer = per-chain range + level/sends (measured, §3.1) — no DLW commitment names these yet: OPEN-QUESTION (ledger §10 item 19) on chain-selector semantics for non-audio families | same crosswalk family; [mockup:agent chains rows; racks §1.1–1.6] | **F**; selector beyond audio open (item 19) |
| **Macro** (8 visible, 16 max) | **The mockup's macros**: `Thorough` (Thoroughness) 62%, `Test depth` 40%, `Reach`, `Risk` on the skillset rack; `Fan-out/Depth/Hand-back` on the agentset rack; §14: "macros are the first modulators, and the rack-topology family's 'macro range/curve/scope' is their contract". Owner verbatim: "Macros drive several skills' settings at once" | [mockup:agent skillRack/agentsetRack; WSD §14; CROSSWALK device-lifecycle gestures] | **F** |
| **Macro snapshot / variation** | Preset store/recall + variation store/recall/exclusions — declared target gestures, acceptance = "macro target/range/curve/exclusions" readback; unset snapshot slots = −1/false is the measured storage shape | [CROSSWALK device-lifecycle family; racks §1.7] | **F** |
| **Preset (.adv/.adg)** | Family manifest declaration (the admission-time "preset" of a family's device surface) + runtime preset store/recall as a **write with its owner op**; document-level recall = lift device element + Id + allocated pointees | [SDK admitFamily/declareDeviceExtension; CROSSWALK; session-model §4 rule 6] | **F** |
| **Hot-swap** | **Compatible hot-swap** gesture; "refusal of unsupported swaps" is part of the detecting trial. Compatibility domain in Live is the signal-domain typing (`MidiToMidi`/`MidiToAudio`/`AudioToAudio`); DLW's typed equivalent is the chain's parameter/signal grammar — proposal, owner confirms: OPEN-QUESTION (ledger §10 item 18) | [CROSSWALK device-lifecycle; racks §1.1] | **F**; compatibility domain open (item 18) |
| **Device activator (`On`)** | **The activator light as a reading** — lit only where a real owner enable exists; hollow otherwise; `Lamp` states admit/deny/waiting/refusing/unknown. "A successful UI flag is never evidence of a native effect" | [DEVICE-PANEL-BRIEF rule 6; SDK Lamp; owner quote "the light admits or denies it"; MAP aperture law] | **F** |
| **Signal flow (typed chains, sends, returns, crossfader)** | **The transport as signal flow** — one transport wearing five meanings; per-family time bindings; telemetry as modulation sources; the chain's left-to-right reading. The two-clock doctrine governs: civil time keeps closure; the sample clock is the work-time stratum families bind, never fork | [WSD Rev 5; §15 time spine; mockup:agent chain order; SCOPE §5; WSD §15, §18] | **F** in the *signal* sense only; see the routing row below |
| **Transport** | ONE transport wearing five meanings (Rev 5 table, §4); Live restored as base mode | `WORLD-SHELL-DESIGN.md:23-42` | Per slot (VIS §2.2). **F:** Central punch/loop → day window (GRAM:282-285); Technē occasion window; Factory write window (GRAM:344-346); metronome → Factory heartbeat, Technē presence pulse. **P:** Expressions punch/loop all "loop the saved sequence" (GRAM:396-398); Central metronome = autosave; CPU = save state; key/scale = packet tokens or aperture (GRAM:264-292,449-478) |
| **Groove pool (the geometry)** | The browser-below contextual working area (property definition/pinning, macro mapping targets, modulation monitor, per-mode pool content); the pool's audio purpose retained; in Expressions it becomes the selected property's mapping/pinning area (role selector, never a pile) | `UI-UX-CONVERGENCE-STUDY.md:63-64` (§Browser below) | **P:** the aperture readouts sit in the groove pool's place (`UI/shell/ModeBrowser.tsx:121-140`) |
| **Groove / swing (the content)** | (No source assigns a DLW meaning to Live's groove pool *content* beyond the geometry reuse; the pool geometry is reused per `UI-UX-CONVERGENCE-STUDY.md:63`) — ledger §10 item 16 records the gap | — | — (no groove function, item 16) |
| **Browser (+ hot-swap pool)** | Category/results browser above + contextual pool below; categories over actual owners; preview ≠ open ≠ add; browser categories per family (four surfaces law: browser, rack, projections, inspectors — a fifth place is a design smell); "A device category is useful only when its insertion/capability is real" | `UI-UX-CONVERGENCE-STUDY.md:61-64`; `WORLD-SHELL-DESIGN.md:836-845` (§16) | **F** (the Archive register, `MECH:115-118`) |
| **Clip view \| Device view** | The bottom detail area = focused pane's rack view; the Clip\|Device pair is "toggled from the status bar as in the agent shell" (Rev 4) — the status bar's "Clip/Device switch" per the study; per-arrangement meanings (Rev 4 table, §4) | `WORLD-SHELL-DESIGN.md:80-98` (Rev 4); `UI-UX-CONVERGENCE-STUDY.md:67-69` | **F** |
| **Key/scale** | Per-mode re-meaning: packet token count (Base) · tokens in/out (Factory) · ☿ resonance key (Expressions) · aperture/view-as (Technē) | Rev 5 table | **P** for packet-token count and aperture (VIS §2.2); scale awareness itself is a Live-mode family (row below) |
| **Tempo / signature / metronome / quantize** | Per-mode re-meanings (die face 4+2; effort/budget; autosave/save-timing; heartbeat/interrupt timing; pulse/scene-quantize; walk pace/stop n/8; presence/arrival) | Rev 5 table | F/P per mode: metronome → Factory heartbeat and Technē presence pulse **F**; Central metronome → autosave **P** (VIS §2.2) |
| **Warp / clip-view craft** | Central's clip-view craft: CAS identity, basis, save-router named outcomes (`saved \| unchanged \| stale \| conflict \| refused`) are "this world's warp markers" | `WORLD-SHELL-DESIGN.md:706-717` (§12 Central); owner clip-view quote `[session]` | — **Tension**, three senses of "editing", unmerged: Live's warp engine (row below), Central's clip-view craft (this row; the owner's words, §4.2), Technē's origin-return (`CONT:82-84`; §4.5) (VIS L-6) |
| **Automation / modulation (incl. the measured matrices)** | Typed parameter addresses `{family, device-instance, key, type, range/unit, write-path}`; scope declaration = specification; modulation = routing relation source→target through custody/receipt law; **every modulated parameter shows its modulator** (Live colours the modulated knob). Measured precedent: Wavetable's 52×13 and Meld's 50×19 mod matrices — "the shell's device panel should expose the matrix … rather than a fixed velocity knob" | `WORLD-SHELL-DESIGN.md:772-799` (§14); [mod-matrix §Shell consequence] | **F**; the honesty law: every modulated parameter shows its modulator (`CONT:52`) |
| **Follow actions** | Hand-off (Factory: "Then = hand-off follow action", `AGENTIC-CONVERGENCE.md:179`); journey transitions as authored per-edge objects (lane-5 T5); the mockup's clip **Then** section: "hand off → Capture pass" — "Live's follow action, as hand-off" | cited rows; [mockup:agent renderClip Then; follow-action] | **F** (Factory "Then"; Technē per-edge transitions); a tooltip string only today (`UI/agent/agentFidelity.ts:103`) |
| **Takes / comping** | Takes are transport material, never a clock; performance recording is the take machinery (seed for #281); takes live on Timeline lanes (fifth-places audit: the Takes tab is a design smell, home is the Timeline) | `WORLD-SHELL-DESIGN.md:822` (§15.4); `EXPRESSIONS-FOUR-SURFACES.md:24-25` (item 4); §5.7 | **F** for takes ("never a clock and never a Timeline track", `UI/timeline/worldTrackAdapter.ts:33-34`); comping: see the comping row below |
| **Freeze / render / export** | Render/export offices belong to #281's composition/interop packet; capture actions per `EXPRESSIONS-FEATURE-MAP.md:53` | `M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md:164` | Export **F** (Expressions export built, `APPA:52-57`); freeze and flatten have no destination (list below) |
| **Loader integrity laws** | Live's loader rejections restated as DLW's rack-topology integrity laws (identity, resolution, no danglers, arity, lift-in equivalence — §3.4) | [session-model §4] | **F** |
| **126 targets** | The eight operation families, one of which **is** this ontology: "Device lifecycle and rack topology"; the acceptance register and its rules: §9 | [CROSSWALK; WSD §9] | — (a register, not a Live function) |
| **Routing — two senses** *(12 Oct)* (mixer, sends, returns) | *Signal routing* is the chain reading and its arity (the Signal-flow row; §3.4). *Authority routing* is the neutral door, the returns and attribution — the contemplation's sense: "Who has authority over what, what routes where, what returns to whom" (`CONT:64-70`). No source joins the two. Factory's track strip is authority routing (Watch, Solo, Arm, budget; `UI/agent/AgentSessionGrid.tsx:26-30`); agent return tracks A·Review / B·Wiki are designed (`AGENTIC-CONVERGENCE.md:181-185`); Live's mixer strip is inert (`UI/components/MixerStrip.tsx`); Expressions buses sit under #281 (`MPW:162`) | VIS L-4, §2.2 | Authority routing, not signal routing, wherever a mixer control is re-meant |
| **Arm slot** *(12 Oct)* | Expressions "Studio arm" is record-arm. In Central, Factory and Technē the slot is the write-authority gate (agent write-arm, write arm, instrument writes). The two meanings are an **intended re-meaning** (`GRAM:4-5`) | GRAM:209,279,341,393,465 | **F** in Expressions (record-arm); **P** in Central, Factory and Technē (the slot's place, re-meant as the write-authority gate) |
| **Tunings** *(12 Oct)* | Home: Live mode, the port. M2 pitch structures are tuning/modulation targets (D13, `MPW:32-34`). **Named gap:** no shell carrier | Browser "Tunings" (`LIVE/ui/UI-EVIDENCE.md:52`); "SET ScaleAndTuning" (`LIVE/devices/arpeggiator-derivation.md:120`) | **F** |
| **Scale awareness** *(12 Oct)* | Home: Live mode, the port. **Named gap:** no shell carrier (the re-meant key/scale slot above is a different thing) | `root_note`, `scale_name` (`LIVE/lom/LOM-INVENTORY.md:236`) | **F** |
| **Automation lanes and clip envelopes** *(12 Oct)* | Home: Live mode, the port. Live's arrangement is drawn without automation lanes (`UI/components/ArrangementView.tsx:49-148`). **Named gap:** not ported | `AutomationEnvelopes`, `AutomationLanes`, `ClipEnvelopeChooserViewState` in the set model (`LIVE/session-model.md:69,72`) | **F** |
| **Warp engines** *(12 Oct)* | Home: Live mode, the port. `--play` plays unwarped clips only (`packages/live-shell/src/play.rs:12-14`). **Named gap:** not ported | WarpMode enum, stretch and transposition measured (`LIVE/reconstruction-backlog.md:65`, D9) | **F** |
| **Comping / take lanes** *(12 Oct)* | Home: Live mode, the port; Expressions takes are the seed (`WORLD-SHELL-DESIGN.md:936-937`). **Named gap:** no comping anywhere | `TakeLanes/` in the track model (`LIVE/session-model.md:70`) | **F** |
| **Controller / key / MIDI mapping** *(12 Oct)* | Home: Live mode, the port. **Named gap:** not ported; MIDI/MPE input has no destination in any mode (list below) | 140 controller remote-script directories; `MidiMap` (`LIVE/lom/LOM-INVENTORY.md:16,304`) | **F** |
| **Sampling instruments** *(12 Oct)* | Home: Live mode, the port. **Named gap:** not ported | Simpler LOM surface (`LIVE/lom/LOM-INVENTORY.md:170`); Sampler in the browser (`LIVE/ui/UI-EVIDENCE.md:53,56`) | **F** |
| **Audio + video track layers on one timeline** *(12 Oct)* | Home: Expressions, owner-ruled (`CONT:247-250`) — Live's destination, the DaVinci shape. Track kinds enter as adapters on the Timeline projection (`WORLD-SHELL-DESIGN.md:945-951`; §5.2, §5.8). **Named gap:** no design or code names a video track; deferred ticket T-LIVE-INTO-EXPRESSIONS, owner-timed (ledger item 51) | `CONT:236-241,247-250`; `MPW:10`; `WORLD-SHELL-DESIGN.md:917-918` | **F** for audio (the DaVinci pattern); the video layer rests on the ruling alone |

**Reading the function column** *(12 Oct; VIS §2.2)*. The contemplation's
test: the mapping "is not decorative — it names the same structural
function" (`CONT:38`). **F**: the relocated control carries the same
structural function. **P**: it keeps only the slot's place, re-meant (the
transport law keeps places fixed, `WORLD-SHELL-DESIGN.md:23-41`). Live mode,
the port, holds every family first; the rows say where each family's
*function* also lands in the other modes. The rows marked *(12 Oct)* add the
function families the table was missing, with their home or a named gap.

**No destination in any mode** *(12 Oct; VIS §2.2, `DLW-VISION.md:821-825`)*: mixer volume, pan, sends and
crossfader outside Factory; scene tempo and signature; locators; freeze and
flatten; the waveform/warp editor outside Live mode; MIDI/MPE input (the
#281 Jankó packet); mode-wide undo. **Ruled destination, no home yet:** video
track layers (Expressions, ledger item 51). A builder who reaches one of
these returns `OPEN`; none is invented a home.

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

## 3. The device ontology — Ableton's product grammar committed as DLW's (P2 Chapter B)

*Cross-reference: the unified Ableton→DLW mapping table is §2; this chapter
defines the Ableton-side ontology from the corpus and binds the DLW side to
the writers law.*

### 3.0 The claim of this chapter (P2 §B0)

Ableton's ontology — device · rack · chain · macro · preset · hot-swap ·
activation · signal flow — is not an analogy the shell borrows; it is the
ontology the shell **already committed to**, in the owner's words and in
landed code. This chapter maps the two vocabularies 1:1 (the table in §2),
states each target gesture with its Live reference behavior and its DLW
acceptance shape (§3.2), and binds the whole to the writers law (§3.3). The
mapping is extraction: every Ableton-side claim cites the corpus; every
DLW-side claim cites the design, the SDK, the mockups, or the crosswalk.

### 3.1 Ableton's ontology, defined from the corpus (P2 §B1)

**Device.** The unit of function. Serialized as a root element with the uniform
parameter pattern (`Manual` value in device units + `MidiControllerRange` +
`AutomationTarget` + `ModulationTarget`) [session-model §6]; a list member of a
track's `Devices/`, each carrying an `Id` [session-model §4]; on/off is its `On`
parameter [session-model §6]. Devices are typed by signal domain through the chain
container they sit in: `MidiToMidiDeviceChain`, `MidiToAudioDeviceChain`,
`AudioToAudioDeviceChain` [racks §1.1].

**Chain.** The signal path: a track's device list is a typed `DeviceChain`; a rack
holds **branches** (chains) inside it. Every branch carries its name, selection, its
typed `DeviceChain`, its selector zone, and its **chain mixer** (`AudioBranchMixerDevice
= {Speaker, Volume, Panorama, SendInfos…}`) [racks §1.1–1.3, §2.2]. Track-level chain
containers: `AudioTrackDeviceChain`, `MidiTrackDeviceChain`, `GroupTrackDeviceChain`,
`SendTrackDeviceChain`, `MainTrackDeviceChain`, `MasterTrackDeviceChain`,
`PreHearTrackDeviceChain` [racks §1.1].

**Rack.** The container device: Instrument/Audio Effect/MIDI Effect/Drum Rack —
`InstrumentGroupDevice` / `AudioEffectGroupDevice` / `MidiEffectGroupDevice` /
`DrumGroupDevice`, all sharing one chassis [racks §1.1–1.2]:

- `Branches` (the chain list) + `ReturnBranches` (rack-internal return chains);
- `NumVisibleMacroControls` (default **8**, max **16**); `MacroControls.0–15` each a
  TimeableFloat with `MidiControllerRange 0..127`, plus per-index display names,
  annotations, colors, defaults, `ForceDisplayGenericValue`,
  `ExcludeMacroFromRandomization`, `ExcludeMacroFromSnapshots`;
- **Macro snapshots** (`MacroSnapshots/MacroSnapshot`: name, per-macro values with
  unset = −1 + `MacroHasValue=false`, recall/overwrite key MIDI) and the parallel
  **MacroVariations** store (randomization variations);
- `ChainSelector` (0..127 TimeableFloat) + `ChainSelectorRelativePosition`;
- `IsAutoSelectEnabled`, branch-visibility flags, splitter proportion.

**Chain-selector zones.** Each branch's zone is `[Min, Max]` active window with
`[CrossfadeMin, CrossfadeMax]` ramp inside it, integers 0..127; zones **tile the
selector axis with overlapping ramps** (verified multi-chain quote: Dry 8–120
crossfading 59–69; Force 0–59 ramping 0–8; chain 3: 69–127 ramping 120–127); the
default 2-chain case is both full-range with opposed ramps; **drum pad chains carry
zeroed ranges — pads select by note, not selector** [racks §1.5–1.6].

**Drum Rack pads.** Pad identity per chain: `{ReceivingNote, SendingNote,
ChokeGroup}`; the pad's sound is its branch's device list; pads nest racks [racks
§1.6].

**Macro.** A rack-level control (0..127) that drives several chain parameters at
once. **The mapping store is NOT the classic XML element** — 0 hits across all 963
factory racks, 24 factory sets, and an authored 12.0.25 rack; the store has moved to
the Flip live-model layer (`live.MacroMapping{macroIndex, rangeMin, rangeMax,
targetDevice, targetParameter}` per binary strings; `has_macro_mappings`). The exact
persisted spelling needs one load-probe [racks §1.7].

**Preset.** `.adv` (single device) / `.adg` (rack, `GroupDevicePreset` with
`BranchPresets`); a preset's device element lifts into a set as-is (+Id +allocated
pointees) — that lift IS preset recall at the document level [session-model §4 rule
6; racks §1.4]. 963 factory racks verified as structural evidence [racks E2].

**Hot-swap / activation.** The corpus documents activation (the `On` parameter;
bypass-reference renders are the calibration against it [backlog verify gate;
session-model §6]) and the browser category structure that carries swap sources
(§4.1 A2.3). The hot-swap *gesture* itself is UI behavior — the corpus does not derive
Live's hot-swap interaction mechanics; the crosswalk supplies the DLW acceptance
shape (§3.2).

**Signal flow.** MIDI→audio→return/send topology, all typed: track mixers carry
`Sends/TrackSendHolder*` (send count == return count, loader-enforced); rack return
chains route through `SendInfos` — "two different spellings of the same law" [racks
§2.1–2.2]; master carries `Tempo`, `TimeSignature`, `GlobalGrooveAmount`, `CrossFade`
(the crossfader position) + per-return pre/post flags [racks §2.3]; routing surfaces
per track observed inline in the session mixer (MIDI From / Audio To / Monitor
In-Auto-Off) [capture 1; UI-EVIDENCE].

**Session objects.** Scene (with per-scene tempo/signature + follow action), clip
slot (empty/clip-filled/stop-button), clip (bounds/loop/fades/warp/launch/groove/
follow), groove pool, locators, transport loop/punch/quantisation (§4.1 A2.4, A4).

### 3.2 The acceptance gestures (the device-lifecycle target family, verbatim) (P2 §B3)

The crosswalk's operation family "Device lifecycle and rack topology" is this
chapter's acceptance surface [CROSSWALK §Additional operation families]:

> **Anchors:** "installed entity/processor owner instances, scoped Field controls,
> source/rack/occurrence identities"
>
> **Gestures:** "insert/select/fold/move/duplicate/remove/activate; compatible
> hot-swap; preset store/recall; group rack; map macro range/curve/scope; variation
> store/recall/exclusions"
>
> **Shape:** "Serial/parallel/shared contribution topology has real separate
> supported native instances, useful graphical faces and expanded views"
>
> **Detecting trial:** "Native topology readback per operation and rich rack reload;
> macro target/range/curve/exclusions; refusal of unsupported swaps"

Gesture-by-gesture, with the Live reference each one attains:

| gesture | Live reference behavior (corpus) | DLW acceptance shape |
| --- | --- | --- |
| insert | Drag target everywhere; device lift-in from preset as-is (+Id +pointees) [session-model §4; UI-EVIDENCE] | browser → chain drop lands a declared device; the aperture captures current basis; receipt names the write |
| select | Selected-slot ring, device dropdown per track header [capture 1–2] | selection carries subject_ref; no second selection store [WSD §10 seam 3] |
| fold | `foldedRack`: "A device folded to its title, as in Live" [mockup:agent] | fold state per device; expanded view keeps the same instance |
| move | Chain reordering — the landed chain drag: `agentChainDrag.ts` card slide + insertion index among chain cards, `chainDropDecision` naming each refusal | move lands through the owner op; insertion index readback |
| duplicate | (Live edit semantics; corpus silent on the gesture itself — UI-level) | duplicate creates a new instance with its own §14 addresses; no shared mutable state |
| remove | Loader law: removal must clear `AutomationEnvelopes`, `SignalModulations`, clip `Envelopes` referencing the removed device — dangling references are rejected [session-model §4 rule 3] | remove receipts name what was cleared; nothing dangles |
| activate | Device `On` parameter; bypass-reference renders calibrate against it [session-model §6; backlog gate] | activator light only with a real owner enable; otherwise hollow [DEVICE-PANEL-BRIEF rule 6] |
| hot-swap | Compatibility = signal-domain typing of chains [racks §1.1] | "refusal of unsupported swaps" is part of the detecting trial [CROSSWALK] |
| preset store/recall | `.adv/.adg` containers; lift-in semantics [session-model §6; racks §1.4] | store/recall through owner ops; recall restores addresses + ranges + identity |
| group rack | `GroupDevicePreset` chassis: Branches + ReturnBranches + macros [racks §1.2] | group creates a rack device whose chains are the grouped devices; topology readback |
| map macro range/curve/scope | MacroControls.0–15 + MidiControllerRange 0..127; mapping store = Flip layer (persistence probe open) [racks §1.7] | macro mapping names target, range, curve, scope; readback exact |
| variation store/recall/exclusions | MacroSnapshots + MacroVariations + `ExcludeMacroFromRandomization/Snapshots` per macro index [racks §1.2, §1.7] | variation recall honors exclusions; unset slots stay unset (−1/false) |

### 3.3 The writers law (every write has its owner op; read-only until landed) (P2 §B4)

This is the aperture law made mechanical [MAP aperture law; SDK]:

- **Write-path grammar** — exactly three membered forms: `kernel:<op>` (a real op of
  the kernel's own union — 78 ops, drift-gated, generated from kernel types),
  `shell.<setter>` (armed by the shell: `ARMED_SHELL_SETTERS`, derived from the
  verified address table, or declared on the family's `writers` — and self-arming
  carries a `writerAuthority`), `<tool>:<command>` (a known native-owner tool:
  `workcell-cli`, `ctrl`, `aikit`, `oi`; the command stays with the tool's
  repository). "The law runs at admission, on the extension path, and again in the
  world gate."
- **A row without a writePath IS a reading** — "that is the grammar, not a
  convention" [SDK]. This is precisely Ableton's activation honesty translated:
  until the owner lands, a derived device face shows readings and hollow lights, and
  says so ("the tenders (prune, sweep) have no writer yet — declared, waiting"
  [worldShellFamilies central extension note]).
- **The face never writes**: "the face receives `{reading, disabled, apply,
  captureCurrent}` … and never dispatches a write of its own" — the custody law
  stays the owner's; drafts are retained, Enter commits, Escape cancels, an unknown
  state has no illuminated lamp [SDK step 4; editor standard].
- **One owning family per §14 row**; §14 uniqueness and ownership-map contradictions
  are gate checks [SDK; AGENT-DEVICE-OWNERSHIP].
- **Modulation honesty**: a row may declare `modulatedBy`; the gate checks the
  observable against admitted telemetry ("nothing moves without a visible cause")
  [SDK; WSD §14].
- **A successful UI flag is never evidence of a native effect** [MAP aperture law] —
  the detecting trials are executed behavior, per the completion law.

The family-side binding: a device belongs to its native owner's family; "No family
for it yet? Scaffold one — but the family author is the native owner or a lane
commissioned by one (the door is neutral; the keys are held by owners)" [SDK step 2;
WSD §12]. Six products, six families, four surfaces each [WSD §12, §16]; a seventh
product integrates with zero core change [WSD §13].

### 3.4 Live's loader laws restated as DLW's rack-topology integrity laws (P2 §B5)

The corpus's loader rejections are not trivia; they are the integrity laws a rack
implementation must enforce to deserve the word "rack". Restated for the builder
[sources in §4.1 A4]:

1. **Identity**: every chain member carries an identity. (DLW: instance refs;
   "Deep links address refs, never indices" [lane-3 E22; CROSSWALK].)
2. **Resolution**: every parameter address resolves to an allocated, admitted row —
   a dangling address is a rejection, not a warning. (DLW: §14 grammar + gate.)
3. **No danglers on removal**: removing a device clears every automation, envelope
   and modulation that referenced it. (DLW: the remove gesture's receipt names the
   cleanup; the detecting trial exercises it.)
4. **Arity**: sends match returns — topology arity is load-bearing, enforced at
   write time. (DLW: the rack gate should refuse a chain whose declared sends have
   no return counterpart.)
5. **Lift-in equivalence**: preset recall = the same device element, same identity
   discipline, re-addressed. (DLW: preset store/recall restores §14 rows + ranges
   + identity, verified by readback.)

### 3.5 What the mockups already drew (the component forms capabilities plug into) (P2 §B6)

Under the widget law — "the mockups are guides, never ceilings… A device is done when
it works honestly through its owner AND functions and looks better than the mockup
drew it" [MAP widget law], with the owner's own caution (a **cleaned
transcription** of msg 72 — the raw transcript's typos and trailing clause are
smoothed here; §0 carries the verbatim-sic text):

> "make sure the mockup standards remain as 'guides', the whole 'binding' language can
> become a too-rigid bureaucracy that misses the obvious need for the real feature to
> function and look MUCH BETTER than the mockups, which already hold to a good
> standard."

The waiting forms the device ontology plugs into [mockup:agent; mockup:world]:

- **Agent device face**: power light ("The agent on, or benched"), model line,
  visual diagram, knobs `Autonomy` (Suggest · Review · Auto — "lands with receipts"),
  `Effort`, `Budget`, `Input` toggle (steer/queue).
- **Skillset rack** (the rack form): chain rows with admit lights
  (port-widgets · capture-plan · diff-grammar · review-pr, one folded to outline
  state) + macro bank (Thorough 62% · Test depth 40% · Reach · Risk).
- **Agentset rack** (the group/Drum-Rack analogue): one chain per member, nested as
  spawned, each with its model; macros Fan-out · Depth · Hand-back.
- **Gateway device** (the signal-flow face): link diagram (shell ↔ harness, frames in
  flight, replay ring, heartbeat), Transport toggle (stdio · ws · remote), Approvals
  (ask · session · always), Stall-after knob; the Gateways rack lists every reachable
  gateway as chains with per-row standing ("ready / composed / refused — Each row
  states its standing, never assumed").
- **World device** (scope face): Reach ring (object → scene → expression → Central),
  Writes toggle (propose · draft · direct — "direct needs Write arm").
- **Git device** (the lands-here face): branch diagram against main, uncommitted-work
  pulse, Commit toggle (turn · task · man), Push (off · land), Land button.
- **Drop zone**: "Drop gateways, agents, skillsets, worlds or git here" — the chain
  insertion target, Live's "Drop Audio Effects Here" transposed.
- **Clip view** (the Clip|Device pair's other half): task/status, Launch (once ·
  hold · loop), **Then** (follow action as hand-off), Output style, Overrides;
  the world mockup's live clip view: start/end/loop/signature/groove + Notes.
- **The live-mode chain**: Drum Rack (16 pads) → Glue Compressor → Reverb →
  "Drop audio effects here" — the reference strip Chapter A's faces fill (§4.1).
- **The transport** (one, five meanings) and **Clip|Device** per-mode pairs — landed
  as typed data in `modeGrammar.ts` [DEVELOPMENT-TRACK].

### 3.6 Honest boundaries and named gaps for this chapter (P2 §B7)

1. **Hot-swap gesture mechanics** — Live's swap interaction is not derived by the
   corpus (browser structure is; the swap flow itself is UI behavior). The DLW
   acceptance rests on the crosswalk's detecting trial. OPEN-QUESTION (ledger §10
   item 18): confirm the compatibility domain = the chain's signal/parameter domain
   typing.
2. **Chain-selector semantics beyond audio** — zones/crossfades are measured for
   audio racks; whether non-audio DLW racks (skillsets, gateways) expose a selector
   at all is undesigned. OPEN-QUESTION (ledger §10 item 19).
3. **Macro mapping persistence** — the Flip-layer spelling is hypothesized from
   binary strings, not loader-confirmed [racks §1.7]. Until the one probe runs, DLW
   macro mappings should persist in DLW's own grammar (the crosswalk's
   `Scene.parameterRacks` schema for Expressions macros [UI-UX §Add a parameter]) and
   make no .als-compat claim.
4. **Family admission for the audio chain** (§4.1 A6.4's open question) — the
   ontology is landed; the owning family for live-mode audio faces is not (ledger
   §10 item 25).
5. **.als document compatibility** — `live-set` (M0) stands as a read/summary library
   [LANES §Current state]; whether DLW targets write-compatible .als emission is
   undecided. OPEN-QUESTION (ledger §10 item 20).
6. **Performance/voice architecture** — the shell prepares the host; performance
   claims belong to #281's nine packets; "claims nothing sounding until the owner
   lands it" [WSD §18].

### 3.7 The one-paragraph answer (P2 §B8)

Live teaches one ontology and one honesty. The ontology: devices on chains, chains in
racks, macros over chains, presets as liftable elements, activation as a light with a
truth behind it, signal flow typed end to end. The honesty: everything inline, no
modal lies, no dead controls, an unknown state shows no lamp, and — the part this
plan inherits wholesale — **a UI flag is never evidence of a native effect**. DLW has
already committed to both: the aperture and the writers law are landed code, the six
families are the carving, the mockups drew the component forms, and the RE corpus has
measured 70 device slots deeply enough to name what is gated (5), derived (~40 more),
negative (5 M4L), mechanism-only (2) and residual (~24, named). (Fold arithmetic
note: those categories sum to ~76 against the stipulated 70 — the residual is
measured against a different covered-base than the other categories; the ledger's
internal fuzz is carried as the count-conflict addendum beside ledger §10 item 22,
not reconciled here.) The builder's job is
to fill the neutral frame with family material without changing the frame — devices
admitted through manifests, macros as first modulators, presets and swaps as owner-op
writes, read-only lights until each owner lands — and to exceed the mockups while
never shipping a pixel of Ableton's.

---

## 4. The mode chapters — one per mode, each with its FOCUS

**Edit mark (grill fold):** the Rev 2 and Rev 4 tables quoted in this chapter
render the revisions' M′ instrument names in owner ruling D-F's plain names
throughout (project/graph, canvas, timeline, journey, places, palace); the
revisions' own text carried M0′–M5′, a reading the owner withdrew on 19 Oct
2026 (lock §0.1 item 3).

**The mode set — owner ruling, law** *(12 Oct; VIS §2.1, L1–L3)*. "Five
modes stand: Live stays as the base mode" (`CONT:234`). The set for the
build is **Live (base) · Central · Factory · Expressions · Technē**, with
Epi-Logos a lens, not a mode (`CONT:251-252`). Add, remove or merge no mode;
no Epi-Logos rail entry.

- **Live is the reverse-engineering basis** (`CONT:244-246`), and its
  destination is Expressions, with audio and video track layers on one
  timeline (`CONT:247-250`). The sequence is the ruling's: Live stays a
  distinct mode now so the port stays clean and measurable, and moves into
  Expressions later, when the owner times it (ledger item 51). The music/audio
  half of the destination is grounded in the sources: a composition
  environment "inside the existing Expressions application" (`MPW:10`), and
  "the DaVinci Resolve pattern the owner names: an integrated musical working
  mode, not another app" (`WORLD-SHELL-DESIGN.md:917-918`). No source names a
  video layer; the video half rests on the ruling alone. The clean-room
  engine's present standing, "separate, the audio base mode… not the
  Expressions sounding surface" (`APPA:217-224`), and "Expressions retains
  basically the same full native Live musical system" (`CONT:118`) are the
  two ends of that sequence, not a conflict.
- **"Base" names Live.** `WORLD-SHELL-DESIGN.md:24-26`, `REL:29-33` ("The
  DLW's base mode is music") and the ruling agree. "Central is the base. The
  other modes return to it" (`CONT:179`) names Central as the ground of
  return — "All return to Central" (`CONT:184`) — not the base mode.
- **Central is a mode** by the ruling (`CONT:251`). The design builds it as a
  world context over one book mode (`WORLD-SHELL-DESIGN.md:533-536`;
  `GRAM:20-21`), which a mode can be; that mechanism stands. What stays open
  is the leave act: leaving Central drops the world context (`APP:259`),
  against the cradle law that the world holds "until the person leaves it"
  (`STORE:54-56`). Ledger item 44: **partly settled** (mode ruled; leave act
  the owner's, ticket T-WORLDCTX).
- **Naming defect.** The code titles the Central mode `'Base · Central'`
  (`GRAM:228`; comment `GRAM:31-32`), as do `WORLD-SHELL-DESIGN.md:26,32` and
  the Rev 5 tables quoted below. Under the ruling the title is "Central"
  (ticket T-LABELS). Two ids carry the word and differ: the surf/shell id
  `base` is Central's (`GRAM:20,33`); the stored book mode `base` serves both
  Live and Central (`GRAM:19-20`; `UI/continuity/workspace.tsx:27`), so it is
  never renamed without a migration. The `GRAM:21` comment ("Central is a
  world context, not a separate mode") is corrected to the ruling in the same
  ticket.
- **Older shapes, read as history.** The installed cradle's strip holds "the
  four work modes only" (`MODE:139-142`), with Base for Central's ground; the
  new shell restored Live beside them. Rev 3/4's four arrangements — the
  Clip | Device table below, and Rev 3's per-mode rows — predate Live's
  restoration in Rev 5 and carry no Live row.
- **Modes against projections.** The five modes are not the design's four
  projections (Earth, Timeline, Constellation, Expressions); modes are a
  separate axis (`WORLD-SHELL-DESIGN.md:223-226,299-310`). How the modes bleed
  into one another is §6.1's porous-modes paragraph.

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
| Technē | the Journey | the Relation Field |

Clip | Device detail per arrangement (Rev 4, `WORLD-SHELL-DESIGN.md:84-89`):

| | Clip — what is in focus | Device — what works on it |
|---|---|---|
| Base | Document: form, file, revision, bindings; highlights; notes; packet | Devices: Text · Highlight · Notes · Packet · Answer · the form device |
| Factory | Task log: the selected task's tool-run log | Agent chain: gateway → agent → skills → world → git |
| Expressions | Scene: sequence, durations, bindings | Studio: the engine's own controls |
| Technē | Clip: identity, place and time, disclosure, typed relations, bounded constellation, source | Instruments: the six (project/graph, canvas, timeline, journey, places, palace) — the open one expanded, others folded |

### 4.1 LIVE — the base mode: the reverse-engineering basis, destined for Expressions' joined audio/video timeline (with the measured reference and the derivation corpus)

**FOCUS** *(revised 12 Oct)*. Live is the base mode and **the
reverse-engineering basis** (owner ruling, `CONT:234,244-246`): it holds
Live's real deep dynamics as one unified technology (live-set, live-dynamics,
live-engine, live-shell), "ported, not approximated"; "having the base mode
means we can get a clean reverse engineer basis to ensure we are
porting/using its real deep dynamics as a whole unified technology, building
from that only gets better" (`CONT:236-241`). The measured reference
(§4.1.a) and the derivation corpus are the port's basis: port only measured
dynamics (`LIVE/reconstruction-backlog.md`, D1–D18 at 12 Oct, :57-75), and every device count
says what it counts (rows, expanded slots or stipulated devices; ledger item
22's addendum). Live's lesson is the integration, the porousness and the
shared clock, not feature parity alone (`CONT:26`; VIS §1.1 **Tension**,
answered by the ruling's "as a whole unified technology").

**Destination** *(12 Oct)*. Live "ought be integrated cleanly, eventually,
into expressions where we've planned to have the video and audio track
layers together (like a video editor would, like davinci)" (`CONT:236-239`).
Until then it stays a distinct base mode "so the port stays clean and
measurable" (`CONT:249-250`). The move is deferred ticket T-LIVE-INTO-EXPRESSIONS,
owner-timed and claimable only when the Live port is measurable as a whole
(ledger item 51); nothing merges Live's rail entry meanwhile. The music/audio
half is grounded in the sources; the video half rests on the ruling (§4
head).

**The music working mode** (the design's account, unchanged): the
Ableton-grammar surface where the physical music instrument (M1–M4, QL-MEF
#281) works as a first-class musical working mode — "an integrated musical
working mode, not another app (#281 §3.1), reusing the shell's own
machinery" (`WORLD-SHELL-DESIGN.md:917-921`). Rev 5 "restored" it as the base
mode (`WORLD-SHELL-DESIGN.md:24-26`); the landed grammar maps `live → the
shell's audio cut (book mode 'base', the music presentation)`
(`shell/modeGrammar.ts:19`; the fold cited :23-24). Session shows clips and
scenes; Arrangement the song over time.

**Function families the port carries with no shell carrier yet** *(12 Oct;
§2 rows, VIS §2.2)*: tunings and scale awareness
(`LIVE/ui/UI-EVIDENCE.md:52`; `LIVE/lom/LOM-INVENTORY.md:236`;
`LIVE/devices/arpeggiator-derivation.md:120`); automation lanes and clip
envelopes (`LIVE/session-model.md:69,72`); warp engines
(`LIVE/reconstruction-backlog.md:65`, D9; `--play` skips warped clips,
`packages/live-shell/src/play.rs:12-14`); comping and take lanes
(`LIVE/session-model.md:70`); controller, key and MIDI mapping
(`LIVE/lom/LOM-INVENTORY.md:16,304`); sampling instruments
(`LIVE/lom/LOM-INVENTORY.md:170`; `LIVE/ui/UI-EVIDENCE.md:53,56`). Each is a
named gap whose home is this mode; the audio + video track layers are the
destination's gap (ledger item 51).

**The write seam** *(12 Oct; VIS L-4, L18)*. Live device faces are
registered (`UI/panels/index.ts:24-26`) and write over an HTTP seam, `POST
/api/document/device-param` (`packages/live-shell/src/main.rs:174-176`),
outside the writers law (§3.3; `LIVE/integration-map.md:271-282`). "One
neutral door" is not yet true for this family. The faces stay readings
until the seam has an owner operation; which family owns
the seam is ledger item 25.

**Transport meanings.** Live's own: the row is the reference reading all
other modes re-mean (Rev 5 table above; Live column = the Ableton originals).

**Browser.** The audio/browser grammar per the measured Live captures:
category column + results; lower Groove Pool retains "its admitted audio
purpose" (`UI-UX-CONVERGENCE-STUDY.md:63`).

**Centre.** Session (track columns, clip slots, scenes, stop row, mixer
strip) and Arrangement (integrated overview above the ruler — "the measured
Live evidence", beat ruler, track lanes) with native variants projecting the
retained app (`WORLD-SHELL-DESIGN.md:391-398`). Honesty law: **read-only
until the owners land** — "Live unchanged (read-only honesty)"
(`DEVELOPMENT-TRACK-2026-10-09.md:100`); "No audio/device-editing/performance
claims before those owners land" (`MAP.md:121-122`, MAP's wording).

**Clip | Device.** Audio clips/scenes vs the device chain; audio device faces
wait on the device-lane contract: "The current audio `/api/document` supplies
readable device names and parameter values but no proven stable write
identity/revision. Those readings remain read-only until the device lane's
actual editing/metadata contract lands" (`NATIVE-EDITOR-STANDARD.md:82`).

**Dock.** Context tiles (Rev 4): the agent (Fizz/Epii/Anima), Packet, Trail,
Field, Agents, Terminal, Results, Sky, NOWs; 2×2 launcher opens tiles, never
feeds the centre (`WORLD-SHELL-DESIGN.md:91-95`).

#### 4.1.a The measured reference — Live 12.0.25's product surface (P2 Chapter A, folded in)

**The source lock (what "Live" means in this plan) (A0).** Every claim about
Live is about one pinned build [README §Source lock]:

| surface | pin |
| --- | --- |
| App | Ableton Live 12 Suite **12.0.25 (2024-08-27_2627c43816)**, macOS universal Mach-O, owner-licensed, installed on this machine |
| Binary analyzed | `Live.arm64`, 120,396,864 bytes (fat x86_64+arm64) |
| Document format | `MajorVersion="5" MinorVersion="12.0_12049"`, SchemaChangeCount 12; creator strings 12.0.5d1–12.0.25 |
| Schema vocabulary | app bundle `App-Resources/Schema/*.txt` (356 AbletonSchema translator files; the racks lane's slice census: 173 files 8.1→12.0, the 50 `12.0_*` slices define Live 12's class vocabulary — slices are per-translator *deltas*, so absence there is not absence from the format) [session-model §1; racks §Evidence E1] |
| Analysis engine | Ghidra 12.1.4 + native decompiler, persistent project `~/tools/live-re/ghidra-proj2/LiveRE2.gpr` |

Guardrails that bind the shell build, verbatim in force [README §Guardrails]:
no redistribution of Live code, samples, presets or artwork; no license or DRM
circumvention; document behavior, rebuild from the documents; **decompiled material
stays out of product source**. The captures are research evidence and are **never
application assets** — "The shell NEVER ships these images — it rebuilds the layout
language from the measured facts" [UI-EVIDENCE header].

The RE corpus's scope is owner-directed and total [COVERAGE header]:

> "full reconstruction — every Live 12 Suite device (**13 instruments, 46 audio
> effects, 11 MIDI effects = 70 devices**), full feature parity across racks
> (Instrument/Audio/Drum/Effect + macros), clips (warp engines ×6, clip envelopes,
> follow actions, launch semantics), the session model (scenes, tempo, groove pool,
> mixer/sends), and the render pipeline. Target: clean-room Rust
> (`packages/live-dynamics` + `live-shell`) passing the same verify gate per device.
> Nothing is out of scope until it is gated."

**The method that produced the corpus — the builder must inherit its discipline (A1).**
Four evidence classes, cheap official surfaces first [README §Method; racks §Evidence]:

1. **Official surfaces** — the Schema directory (full document-model vocabulary), MIDI
   Remote Scripts, embedded Python (infrastructure only; the Live Object Model is
   compiled into the binary).
2. **Device archives** — `.adv`/`.adg`/`.als`/`.alc` are gzip XML: full parameter
   trees, ranges (`MidiControllerRange`), routing and device state read directly.
3. **Binary** — `rea` decompiles of the arm64 slice; claims graded **[D]** decompiled,
   **[B]** byte-decoded, **[H]** unverified hypothesis; a decompiled claim never stands
   alone.
4. **Behavioral capture (the DSP gate)** — golden renders through the real app, diffed
   spectrally. "No claim about *dynamics* without it."

The gate a rebuild must pass [backlog §The verify gate]:

- Reference: golden render (Live-exported audio, 44.1 kHz/16-bit observed) of the
  pinned test signal at pinned parameters, plus a bypass-reference render for staging
  calibration.
- Static transfer: per-step RMS gain map, error ≤ **0.5 dB per step**.
- Spectral: STFT (2048, 50% hop) log-magnitude difference ≤ **1.0 dB mean** over
  20 Hz–20 kHz, no band worse than **3.0 dB**.
- Time/envelope: release-tail envelope MAE ≤ **1.0 dB**.
- Determinism bound: Live renders are *not* byte-deterministic at 16-bit (dither;
  observed max |Δ| = 23 LSB, 4.1% of samples > 1 LSB on the 2026-10-07 pair); the gate
  compares behavioral curves, and **any claim finer than the dither floor is out of
  scope**.

Craft facts from the render lanes the builder should know (they are the difference
between a paper corpus and a measured one) [NOW: night-round-2, probes-round-2,
rounds-3-8; NEXT-SESSION]:

- One Live instance, serialized across parallel lanes through
  `harness/with_live_lock.sh` (mkdir mutex, PID-stamped, stale-steal); lanes SKIP when
  Live is not frontmost — "they never keystroke over you".
- Crafted sets are built by XML round-trip + gzip with `mtime=0` for reproducible
  bytes; every probe set is a **single-pin edit** against a known base set.
- Five loader rejections were survived to land the first MIDI clip (the "v4→v5
  generator lesson") — the loader's own error strings are behavioral documentation
  [session-model §4].
- Known real bugs hit and documented: `LRecordManager::OnCheckFreeDiskSpaceAndFileSizesTimer`
  SIGSEGV (export-killer, 5 hits) and the post-crash Wavetable modulator freeze
  (A6.4 below).

**The measured product surface (A2).**

*A2.1 Global layout language* [UI-EVIDENCE §Global layout]. 1920×1200 fullscreen.
Single dark chrome, no window decorations beyond the macOS bar. Overall background ≈
`#3f4348`; panels slightly darker (`#33363b`-ish); content surfaces `#43464c`.
Hairline separators slightly darker than surfaces; **NO drop shadows or gradients in
the chrome** — flatness and density are the language. Accent is amber/yellow
(`#ffbe00`-family): play button, scene highlight, arm state, selected-slot ring, clip
play triangles. Selection elsewhere: cool blue-cyan for track headers/slots
(`#7ec3e6`-family tints per track color); track colors are user-assigned (mint, teal,
blue, purple families observed). Type: 11–12px system sans throughout; numerals in
the same face; ALL-CAPS only for tiny section labels ("PITCH/TIME", "LAUNCH").

Five fixed regions [UI-EVIDENCE; both captures]:

1. **Top transport bar** (~64px)
2. **Left browser** (~430px arrangement / ~425px session)
3. **Center view** (dominant)
4. **Bottom detail panel** (~330px arrangement; mixer-integrated in session)
5. **Bottom status strip** (~28px)

Right side has **no permanent dock** — "Live uses none; our shell's right dock is an
original extension (documented in SHELL-BLUEPRINT.md, keep)". Observed exception,
recorded honestly: the third capture shows Live's first-run **Live 12 Lessons** panel
docked right — a transient onboarding surface, not a working-layout dock; the
UI-EVIDENCE statement stands for the working layout [capture 3; UI-EVIDENCE §Global
layout].

*A2.2 The transport bar, slot by slot (left→right)* [UI-EVIDENCE §Top transport bar;
capture 1]:

1. MIDI-arrangement capture + draw-mode toggles (two small square toggles, far left).
2. Link/Tap cluster; **tempo field** `131.00` (editable number); metronome cluster
   `||| 4/4`; global quantise menu (`1 Bar`); key/scale field `C · Major`.
3. **Position display** `1 . 1 . 1` (bars.beats.sixteenths); play/stop/record/loop
   cluster (round; record = filled circle right of play); punch-in/out, draw-mode,
   computer-MIDI-keyboard toggles.
4. Center-right: second position readout, loop brace toggle, `128 . 0 . 0` counter
   (arrangement loop length), small toggles.
5. Far right: draw pencil, mini-hand, `Key`/`MIDI` indicators, `44.1 kHz` sample-rate
   readout, CPU `%` meter, hamburger at the very edge. Set title centered
   top ("Untitled").

This slot list is exactly what the shell's Rev-5 transport inherits as the `live`
mode's row meanings [mockup:world TPM.live; SDK modes.ts `live` rows]: link-tap ·
tempo-signature · metronome-quantize · key-scale · transport (▶ ■ ● +) · arm-capture
(arm · re-enable · capture) · punch-loop · draw-keys (draw · keys · MIDI · kHz · CPU).

*A2.3 The browser and pool* [UI-EVIDENCE §Left browser; captures 1–3].
Sections stacked, each collapsible with disclosure triangles: **Collections**
(Favorites + user sidebars), **Library** (All, Sounds, Drums, Instruments, Audio
Effects, MIDI Effects, Modulators, Max for Live, Plug-Ins, Clips, Samples, Grooves,
Tunings, Templates), **Places** (user folders: Templates, warm, amp, …, Sampler;
Packs, Cloud, User Library, Current Project in the third capture). A category open
shows a flat searchable list ("Name" column header + filter box + `⧫ Edit` button) —
rows: device/instrument names with a small icon. Instruments list observed: Analog,
Collision, Drift, Drum Rack, DS Clap, DS Cymbal, DS FM, DS HH, DS Kick, DS Sampler, DS
Snare, DS Tom, Electric, External Instrument, Impulse, Instrument Rack, Meld, Operator,
Sampler, Simpler, Tension, Wavetable.

Bottom of browser: **Groove Pool** — column headers `Groove Name | Base | Quantize |
Timing | Random | Velocity`, empty-state "Drop Clips or Grooves Here", and `Global
Amount: 100%`. Document model of that pool: a groove **is a MIDI clip** (the extracted
timing grid) inlined into the set, with per-groove application amounts
`TimingAmount/RandomAmount/VelocityAmount` (0..100+) [racks §3.4].

*A2.4 Session view — the grid anatomy* [UI-EVIDENCE §Session view; capture 1]:

- **Track columns** left→right; each column top has a colored **track header strip**
  (name + activator); below it the clip-slot grid: one square slot per scene (empty
  slot = small dark square with a ▶ glyph on hover); the grid row aligns with the
  scene number on the master column.
- Capture 1 shows the real arrangement: tracks `2-Group`, `3 LABS`…`13 LABS`,
  `A Reverb`, `B Delay`, `Main`; scene rows 1–8; a selected slot ringed amber in 13
  LABS; track 4 LABS armed (red header state); group `2-Group` collapsing members.
- **Master column at right**: scene launch row (scene names + triangles), `Cue Out:
  1/2`, `Main Out: 1/2`, send Pre/Post toggle (`Post` lit), tempo field.
- **Bottom of each column = mixer strip**: routing surfaces inline per track —
  `MIDI From: All Ins / All Channels`, `Monitor: In | Auto | Off`, `Audio To:
  2-Group / Main` dropdown stacks — then Send A / Send B knobs (each ringed with the
  Arc/Live-loop icon), pan knob, volume fader with dB scale (−∞..+6), track-number
  button, arm (■), solo (S), activator, level meter strip. Fader track ≈ 60px wide.
- Session clip slot ≈ **68×26px**; slot grid row height ≈ 26px; scene master labels
  ≈ 26px [UI-EVIDENCE §Density].

Document model behind what you see [session-model §3; racks §3]: slots live per track
at `DeviceChain/<Main|Midi|Audio>Sequencer → ClipSlotList/ClipSlot`; three states
(empty `<Value/>`, clip-filled, `HasStop` stop-button flag); **scenes carry
per-scene tempo and time-signature with enable flags** (`IsTempoEnabled` makes scene
launch adopt `Tempo` — observed `Tempo=74` adopted on scene "Slow Rock"); send count
must equal the set's return-track count (loader-enforced); return tracks are plain
members of `Tracks`; session tempo lives at `MainTrack/DeviceChain/Mixer/Tempo/Manual`,
not at set level (loader-validated: setting a nonexistent `LiveSet/Tempo` silently did
nothing).

*A2.5 Arrangement view* [UI-EVIDENCE §Arrangement view; capture 2]:

- **Timeline ruler in beats** — capture 2 shows `1, 33, 65, …, 673` (32-beat display
  spacing ≈ 230px at default zoom) with a draggable **loop brace** above and `Set`
  loop markers; a second ruler in minutes:seconds at the bottom (`0:00…20:00`) with a
  `4/1` marker, `1.00x` groove/stretch indicator, `H`/`W` draw toggles.
- **Per-track lanes**: audio clips show real waveforms; MIDI clips show named blocks
  with note previews; **automation lanes in red/neutral per device parameter**; group
  lanes collapse children (`15-Group → Mixer`).
- **Track headers right-side** ("Live keeps headers adjacent to the mixer column"):
  device-chain dropdowns per track (e.g. `13 LABS: EQ Eight ▸ 1. Frequency ▸ Filter`;
  `14 ReCognIze: EQ Eight, S-Gain A`), routing (`Ext. In`, `All Channels`, `Monitor
  Auto/Off`), volume/pan fields (observed `-7.4 dB`, `-4.4 dB`), activator/solo/arm.
- **Bottom detail panel** (≈330px): left = **Clip panel** (Start/End/Loop/Position/
  Length/Swap?/Signature 4/4 · 4/4/Groove None/Launch sub-sections; Scale `C Major`;
  `Pitch & Time` with `Fit to Scale`, `Invert`, `Add Interval`, Stretch `>2 · 1/2`);
  right = **note editor / piano roll** (keyboard C5–C2 vertical, bars horizontal, blue
  note blocks, **velocity lane below** with `Velocity/Randomize 100/Ramp 100/127/
  Deviation 0`, scale-highlight toggle, `Focus` readout `LABS10`).
- This clip-view density is the craft surface the owner pointed at: warping, gain,
  fades — "the nitty gritty functionalities" live here.

*A2.6 The device panel (what a device face looks like in Live)* [capture 3; UI-UX §What
was observed; CROSSWALK]. Capture 3 (1806×1282, set `VD0_NEG`, tempo 120.00): "A dense
instrument face occupies a short horizontal device strip; remaining chain space is
available for insertion" [UI-UX §table]. The pictured face is **Operator** per the
crosswalk's measured correction ("four lettered oscillator sections and a preset
title") — despite the filename. What the capture teaches, as grammar (this is the
level the shell rebuilds):

- The device face is a **short horizontal strip** in the track's device chain; the
  chain continues with empty insertion space ending in a visible drop target —
  observed `Drop Audio Effects Here`; chain header `Live12DefaultM V2-1` with an
  activator light and fold controls.
- Controls are **knob-above-label / value-readout-below** rows in tiny type; section
  headers in small caps; dropdowns and toggle pairs inline (`Wave: Sin`,
  `12 | 24` dB, `Clean`, `In/Auto/Off`).
- Visible sections on the pictured face: four lettered oscillator-style rows, each
  `Coarse / Fin(e) / Fixed / Level` with dB readouts (`-∞ dB` floor to `0.0 dB`), plus
  a `Noise` row (`Phase 50% · Random 0%`) — the four operator shells A–D + noise of
  `operator-voice.md`'s shell model (`Operator.0`..`Operator.3`, each `Envelope`,
  `Tune`, `Volume`, `WaveForm`, `Phase`, `Feedback`, `VelScale`, `KeyScale`, `IsOn`)
  [operator-voice §Parameter table]; then `Envelope` (Attack 0.00 ms · Decay 1.00 s ·
  Release 400 ms · Time<Vel 0% · Sustain · Initial/Peak 0.0 dB), `Oscillator`
  (Wave: Sin · Feedback/Repeat Off · Key 50% · Phase 0% · Osc<Vel 0%), `LFO`
  (Shape: Sine · Rate 100.00 Hz · Amount +10% · sync toggles), `Filter` (12/24 ·
  Clean · Freq 2.0 kHz · Res 28%), `Pitch Env` (Spread · Amount 100% · Transpose) and
  a `Time / Tone / Volume` spread row (`0% · 70% · −18 dB`); a display area draws a
  blue envelope curve.
- Bottom status strip carries the time selection: `Start: 1.1.1 End: 129.1.1 Length:
  128.0.0 (Duration: 4:16)`.

*A2.7 Interaction facts (behavior parity)* [UI-EVIDENCE §Interaction facts]:

- Session↔Arrangement is **one key** (`Tab`); browser toggle = `Cmd+Alt+B` family;
  device/clip detail panels are toggles too.
- **Everything is inline-editable in place** (tempo, names, values) — no modal dialogs
  for editing; dialogs exist for destructive/global ops.
- **Drag targets everywhere** (browser → track, clip → slot, devices → chain).
- **Color = user semantic layer** (track identity); the chrome itself stays neutral so
  user colors pop.

*A2.8 What the shell adopts vs adapts (binding)* [UI-EVIDENCE §What the shell adopts]:

- **Adopt**: the five-region layout, session/arrangement duality, inline editing
  everywhere, drag-target ubiquity, color-as-user-layer over neutral chrome, density,
  hairline flatness, amber-accent language.
- **Adapt (original)**: exact pixel values re-derived at the shell's own breakpoints;
  the right dock added (the shell's extension surface); the shell's own glyphs.
- **Never ship**: the captured images, Ableton's icon art, or its preset content.

**The Live-mode REA's decision points (lane-6 SCOPE, revision 2) (A3).** The shell
contemplation that commissioned this corpus is `lane-6-ableton-shell/SCOPE.md`
revision 2 — revision 1 mapped the wrong layer (the technē deep instruments) onto Live
and was corrected the same day; the revision records the miss rather than hiding it.
Its decision points, as they stand [SCOPE rev2 §8; PROGRAMME rulings block]:

| id | question | state |
| --- | --- | --- |
| D-A | What "fork" means — extend licensed Live / clean-room rebuild / staged | **RESOLVED (PROGRAMME):** the build base is the **reengineered Ableton shell now under construction**; clean-room rebuild of the grammar is the path; `Work/O-I/packages/live-shell/`'s document-inspector API (`/api/summary?path=…`, port 8787) was, at ruling time, the only stable data-plane contract [PROGRAMME D-A] |
| D-B | The temporal bridge — the **two-clock doctrine**: civil time keeps NOW/DAY closure law; one work-time core (transport/sample clock: bars\|beats, tempo, quantisation, warp, automation); one typed bridge between them | stands [SCOPE §5; MAP decisions] |
| D-C | Shell plurality — the kernel stays the semantic bus; the shell is a front-end, never a second semantic owner; Surface Ledger gains LIVE dispositions | stands [SCOPE §7; MAP] |
| D-E | M0/M5 posture | **REVERSED (PROGRAMME):** the Expressions app **and** the M0/M5 deep-working app come into the shell as first-class inhabitants; native owners remain authoritative [PROGRAMME D-E] |
| D-F | Naming — the technē instruments carry no "M" prefix; plain names (project/graph, canvas, timeline, journey, places, palace); "the deep mode" | RULED (owner, 2026-10-07) [SCOPE D-F; PROGRAMME] |
| D-G | The M4 body — the live Expressions application **remains the M4 body**, genuinely integrated as the cymatics/physics embodiment surface | RULED (owner, 2026-10-07) [SCOPE D-G] |
| D-H | Where the M1–M3 backend runs | **DELEGATED** to the implementation lane as an engineering decision (native-first reuse of the existing C++ audio/modal body on its most mature compatible hosting path) [PROGRAMME D-H]; in the shell architecture the question is answered as "our own process, the pipe-transported owner" — what remains is the realtime gate [WSD §18] |

Target sets approved as the full functional scope (all five, **126 targets**,
identities and craft bars preserved) [PROGRAMME; CROSSWALK].

The correction that matters for this chapter: revision 1's mistake was mapping the
**deep-working instruments** onto Live. The corrected subject is the **physical music
instrument** (M1 oscillator source; M2 tuning/modulation over that source, never a
second generator — owner D13; M3 forms/articulation/score; M4 the Expressions body)
hosted in a Live-class shell, with Live's own grammar cited as already embodying the
one-field identity law: "Session/Arrangement/Clip/Device are different readings of the
same material with identity preserved across the switch" [SCOPE §1].

**What the RE corpus established — session and document model (the facts a builder codes against) (A4).**
All of the following is loader-validated or evidence-cited in the named documents.
Confidence marks are theirs.

*Container and set skeleton* [session-model §1–2]: gzip XML; `.als` set, `.adv`
device preset, `.adg` rack, `.alc` clip, `.agr` groove. `LiveSet` = NextPointeeId +
Tracks (ordered: MidiTrack | AudioTrack | GroupTrack; ReturnTrack is a plain `Tracks`
member — an earlier revision's `ReturnTracks/` child was a documentation error the
M0 document-engine test caught) + MainTrack (the master; **tempo lives here** at
`DeviceChain/Mixer/Tempo/Manual`) + PreHearTrack (cue) + Scenes + GroovePool +
Transport/Grid/Locators. Song time is **beats**; seconds = beats × 60 / tempo.

*Loader rules — each one rejected or accepted a real document* [session-model §4;
§7]. These are behavioral contracts, and they double as DLW's rack-integrity laws
(§3.4):

1. Every member of a device list carries an `Id` attribute — rejection: "Not all list
   members have Ids."
2. `AutomationTarget`/`ModulationTarget`/`Pointee` must reference **allocated** pointee
   Ids (`< NextPointeeId`) — rejection: "Invalid Pointee Id."
3. **No dangling references**: track `AutomationEnvelopes`, `SignalModulations` and
   clip `Envelopes` referencing removed devices' targets must be cleared — same
   rejection class.
4. Track send count must equal the set's return-track count — rejection: "(Track has
   more send knobs than set has return tracks.)"
5. 32-bit audio must be IEEE float; integer WAV only at 8/16/24 bit.
6. A device element can be lifted from its `.adv` preset into a set's `<Devices>`
   as-is, plus Id + allocated pointees — "the entire harness pipeline stands on this."
7. MIDI clips: `MidiNoteEvent` takes NO `Id`; `Notes/KeyTracks` IS the array (no inner
   wrapper); note fields `Time/Duration` (beats), `Velocity` (0..1), `OffVelocity`,
   `IsEnabled`; **the arrangement anchor is the clip element's `Time` attribute**
   (== CurrentStart; all 73 template arrangement clips carry it; session clips don't)
   — the FA4_TIME finding that unblocked multi-clip sets [follow-action; session-model
   §7].

*Parameter model* [session-model §6]: every device parameter serializes as
`Manual` (stored value in device units) + `MidiControllerRange` (control-surface
mapping range) + `AutomationTarget` + `ModulationTarget`. Closed forms pinned:
volume/send range endpoints are `10^(−70/20) = 0.0003162277571` (−70 dB) and
`10^(+6/20) = 1.99526238` (+6 dB), linear-gain domain; `Pan` ∈ [−1, 1] [racks §2.1].

*Clips* [session-model §5]: bounds and loop in beats; fades in samples; warp
parameter surface visible per algorithm (Beats/Texture/Complex Pro…); launch mode,
launch quantisation, legato, groove settings, velocity amount, follow action live
**per clip**.

*Transport* [racks §3.3]: `Transport` = {PhaseNudgeTempo, LoopOn, LoopStart,
LoopLength, LoopIsSongStart, CurrentTime, PunchIn, PunchOut, MetronomeTickDuration,
DrawMode} (beats); `Grid` = {FixedNumerator, FixedDenominator, GridIntervalPixel,
Ntoles, SnapToGrid, Fixed}; `GlobalQuantisation`/`AutoQuantisation` on the set.
Locators: {Time (beats), Name, Annotation, IsSongStart} [racks §3.5].

*Groove pool*: groove = inlined MIDI clip + amounts (A2.3) [racks §3.4].

*Racks* — see §3 (the full structural model is racks-session-model.md, 462 lines,
marked "verified") [COVERAGE racks row].

*Warp engines ×6* [COVERAGE warp row; NOW rounds-3-8; backlog D9]: modes 0–5
loadable and renderable; **mode 0 separates under tempo mismatch** (90/120 BPM: onset
+0.53 ms vs mode 5 marker-exact); transposition at 1:1 Tones is a true pitch shift
×2.000/×0.500 with duration 1:1 (+29/+57 ms grain tails), level within 1 dB, discrete
products ≤ −36 dB rel, no Nyquist folding at +12 [warp-probe; NOW warp-transposition].
Mode-0's absolute name is LOM-inferred, not confirmed (named thin spot).

*Follow actions* [follow-action]: element shape documented + loader-accepted
(`FollowTime` beats, template default 4 = one bar; the brief's guessed tags
`FollowActionMode`/`action_time` do not exist); anchoring resolved (A4 rule 7);
session-launch dynamics **BLOCKED for the export driver** (arrangement render is
FollowAction-invariant — a session-capture driver is the named missing tool).

**The device derivations, by device class (A5).** Scope ledger: **70 devices**
(13 instruments, 46 audio FX, 11 MIDI FX) [COVERAGE]. The `devices/` directory
holds **61 evidence documents** (62 files minus COVERAGE.md); the coverage
ledger's rows above its own residual line number **53 — ≈62 device slots when
multi-slot rows are expanded** (Chord/Pitch/Scale ×3, Velocity/Note Length ×2,
MPE/Envelope MIDI/Env Follower ×3, Legacy ×5; the rows-vs-slots convention —
an earlier draft's "≈46 device slots" matches neither figure, corrected at the
grill fold), with the ledger naming "*24 remaining slots: Max stubs
×3, External In/Audio, Tuner (no defaults) + corpus-material residuals*" [COVERAGE
final row]. Status vocabulary: a device is **gated** when its clean-room crate passes
the golden corpus; **derived** when its binary/behavior derivation exists;
**negative** when the corpus proves the device is not derivable from the binary (it
ships as Max for Live); **mechanism-only** when the mechanism is documented but the
DSP is a third party's.

*A5.1 Instruments (13 slots):*

| device | what the derivation established | DLW face it maps to | cite |
| --- | --- | --- | --- |
| **Operator** | **GATED** (`operator_voice_golden_gate`). Envelope topology: Attack→**DecayLevel**→SustainLevel→ReleaseLevel; decay exponential in amplitude τ=0.120 s per 1.0 s stored (τ mapping linear through origin — OP6); release dB-linear from note-off level, rate = (level+70)/time (175 dB/s from 0 dB). Level knobs = linear amplitude (−6.02 dB exact at 0.5). **Osc B–D are PM/FM modulator shells of A**, not second voices (RMS invariant −0.10 dB, h2 +34.5 dB, B Volume linear on the index; WaveForm 22 = user-wave sine null); Algorithm null at factory indices; velocity unrouted at the default patch (routing is the `MidiCtrl/VelDst` matrix). 23-row panel descriptor in `params.rs` served on `/api/device-descriptors`. Open: PM/FM sign + off-factory Algorithms, WaveForm labels 0..21, the ≈3 dB pinned-sustain voice shift (loudness compensation, mechanism open) | chain-plate instrument face; four shell rows (compact ≤4 controls per DEVICE-PANEL-BRIEF) + expanded envelope/LFO/filter sections; the pictured capture is its reference grammar | [operator-voice; backlog Operator row; NOW round-2-converged, rounds-3-8; capture 3] |
| **Wavetable** | **GATED** (rev 4+). Two wavetable oscs + sub + two SV filters + amp env + Env2/3 + LFO1/2 + unison. Frame census **CLOSED**: four frames sine\|triangle\|saw\|square at WavePosition {0, 1/3, 2/3, 1}, coherent linear amplitude mix (leave-one-out validated). Osc gain/sustain linear amplitude; Osc2 phase-coherent +6.02 dB sum. **Unison is a STEREO spread**: voices dealt alternately hard-L/hard-R by ascending detune (odd N's middle voice centred, equal-power split); spread = **±50¢ × Amount**; per-voice gain = **√(2/N) × solo** (odd-N centre 1/√N per channel) — the crate's VC2 special case was deleted on this evidence (commit d192e1414). Decay is an endpoint-pinned exponential warp: `v(u) = (e^(−ku) − e^(−k))/(1 − e^(−k))`, `k = 7.41·slope`, one fitted scalar, residual RMS 0.036 dB. **Modulation matrix 52 destinations × 13 sources** (next row) | instrument face with the wavetable display + the matrix exposed as §14 modulation rows (52×13), not a fixed velocity knob — the dossier's own shell consequence | [wavetable-voice rev1–4; mod-matrix; NOW probes-round-2, rounds-3-8] |
| **Wavetable/Operator mod matrix** | Matrix encoding decoded: 52 `ModulationConnectionsForInstrumentVector` blocks (one per destination) × 13 per-source amounts; source identities positional. **Behaviorally settled: source 0 = Key, 10 = Velocity** (D10 CLOSED POSITIVE: velocity→level exists as matrix route 10→Amp; default patch leaves it unrouted — matching Operator's wired-but-unrouted design). Amp row law: **additive `gain = 1 + Σ amountᵢ·sourceᵢ`** (amount ladder 0.2/0.5/1.0 → 0.8/0.5/0.0 to five decimals). **Machine-state caveat:** since a 2026-10-08 crash, modulator-family sources 8/9/12 read a frozen −1.0 constant on this machine (persists across clean boots; second destination proven; exact labels unattachable behaviorally; only lever left is a UI-authored set diff) — model nothing from the frozen state | the shell's modulation section: typed source→target rows with visible amounts; the "every modulated parameter shows its modulator" law [WSD §14] with this matrix as the measured precedent | [mod-matrix (full probe log incl. resolution); WSD §14] |
| **Sampler** | Zone/layer **storage model**: `AMultiSampleMap → AMultiSamplePart → AMultiSampleZoneModel` with three range types (**key / velocity / selector**, e.g. round-robin); `FMelodicSamplerData` carries the sample as a **URI, never audio**. **Sampler and Simpler are one engine** (`<MultiSampler>` vs `<OriginalSimpler IsSimpler=true>`). The per-sample playback DSP was NOT located (honest residual). No sample data extracted, ever (redistribution rule) | zone-editor face as readings + mapping ranges as parameters; sample slots reference material by ref | [sampler-derivation] |
| **Simpler** | Single-zone model; SubOsc laws; shared warper (with the clip warp engines); slicing | chain-plate instrument face; slice/zone display | [simpler-derivation; COVERAGE] |
| **Impulse** | devicekit; 8 slots; key centers C4–C5 | slot-bank face (8 slot rows) | [impulse-derivation; COVERAGE] |
| **Drum Rack** | Structural model verified: pad identity lives **per chain** — `DrumBranch/BranchInfo = {ReceivingNote, SendingNote, ChokeGroup}` (observed 92/60/0), identical in presets as `ZoneSettings`; a pad's sound is its branch's device list; factory pads **nest a full Instrument Rack per pad** (rack-in-rack); `ShowsZonesInsteadOfNoteNames` flag; pad chains carry zeroed selector ranges (pads select by note, not selector) | pad-grid face — the world mockup's live-mode Drum Rack draws exactly this: 4×4 pad grid + `Pads: 16` [mockup:world liveDetail] | [racks §1.6] |
| **Analog** | UltraAnalog (AAS family) topology + parameter laws; A-framework (like Sampler, DSP is anonymous A-framework code); menus + drive shapers decoded; render loop = corpus | chain-plate instrument face | [analog-derivation; COVERAGE] |
| **Electric** | AAS Lounge Lizard; 32-member parameter ledger | chain-plate instrument face | [electric-derivation; COVERAGE] |
| **Collision** | AAS; menus decoded, 2 pinned DSP laws | chain-plate instrument face | [collision-derivation; COVERAGE] |
| **Tension** | AStringStudio; full mp ledger (322) | chain-plate instrument face | [tension-derivation; COVERAGE] |
| **Meld** | **Mod matrix 50×19**, 16-voice Poly; parameter mapping laws | instrument face whose defining surface is the matrix — with Wavetable's, the measured precedent for §14 modulation | [meld-derivation; COVERAGE] |
| **Corpus** | AAS family; 38 params; materials = assets, untouched | instrument face (resonator material picker as readings over assets) | [corpus-derivation; COVERAGE] |
| **Drift** | devicekit; 32-voice; dispatch census; 90+ param surface in decompile | chain-plate instrument face | [drift-derivation; COVERAGE] |

*A5.2 Audio effects (46 slots).* **Gated (3):**

| device | established | DLW face | cite |
| --- | --- | --- | --- |
| **Glue Compressor** | Circuit model **fully closed, zero fitted scalars** (`glue-perblock §1–9` + absolute-threshold + per-block laws): feed-forward VCA, convex soft-knee, **Range = soft GR ceiling at stored dB**, Ratio reshapes knee/asymptote, ballistics-aware detector, additive makeup, output clip −0.50 dBFS. The form-exemplar for binary derivation | compact FX face — the world mockup's live chain draws it: `Threshold −12 dB · Ratio 4:1 · Attack 1 ms · Makeup 2 dB` [mockup:world liveDetail] | [glue-compressor; glue-perblock; glue-absolute-threshold; COVERAGE PASS] |
| **Echo** | Taps + **AmountDelay depth = cubic** (∝ Amount³, accumulates down the recirculating train — no ms-per-unit constant exists); leveler duck = steady 1:1-to-threshold (saturation REFUTED); **δ(thr) linear** (−0.189·thr − 4.613, resid 0.050 dB); **TimeLink semantics** (false honors own times; hop=min was the linked special case); pingpong L-first; mod section in-crate | compact FX face with delay/mod sections | [echo; NOW probes-round-echo, round-2-converged; COVERAGE PASS] |
| **Reverb** | IR model supported (comb-probe negative → parametric); **HF two-component tail + stereo decorrelation WIRED** (R4 worst 18.7% → 4.7%, R1 0.5%); RT60 ∝ DecayTime ±20% | compact FX face — mockup: `Decay 2.4 s · Dry/Wet 22%` | [reverb; NOW rounds-3-8; backlog Reverb row] |

**Derived — binary/behavior derivations exist, crates pending** (ledger rows; each
cited to its dossier):

| device | established (headline) | DLW face | cite |
| --- | --- | --- | --- |
| Compressor | 25 params; log2 closed-form; LUT = corpus; skeleton crate | compact FX face | [compressor-derivation] |
| Saturator | 17 params; chain + curve laws; type enum decoded | compact FX face | [saturator-derivation] |
| EQ Eight | 85 params; 8-band cascades; Butterworth pole-Q sets; adaptive Q | band-strip face (8 band cells) | [eq8-derivation] |
| Auto Filter | 30 params; 37 callbacks; cutoff-LUT law; own detector; engine LFO inside | filter face + mod section | [autofilter-derivation] |
| Delay | devicekit; mapping laws; crossfade curves | compact FX face | [delay-derivation] |
| Multiband Dynamics | 1/2/3-band; octaves domain; crossover laws | band-stack face | [multiband-dynamics-derivation] |
| Limiter | max-pyramid lookahead; ceiling law | compact FX face | [limiter-derivation] |
| Gate | hysteresis + dual detector | compact FX face | [gate-derivation] |
| Redux | 10 params; `steps = 2^(bits−1)`; softness law | compact FX face | [redux-derivation] |
| Overdrive | closed-form shaper `x − 4/27·x³`; PreserveDynamics = compressor | compact FX face | [overdrive-derivation] |
| Erosion | LCG noise + dual delay; **downsampler REFUTED** | compact FX face | [erosion-derivation] |
| Chorus-Ensemble | mode table decoded; cubic interpolation | compact FX face (mode enum) | [chorus-derivation] |
| Phaser-Flanger | 3 modes; TPT-SVF cascade closed form | compact FX face (mode enum) | [phaser-derivation] |
| Filter Delay | per-band; **NO cross-band feedback** (negative finding as spec) | 2-band delay face | [filter-delay-derivation] |
| Grain Delay | sin² window pairs; MINSTD; pitch walk | compact FX face | [graindelay-derivation] |
| Beat Repeat | **FIVE processors**; division tables; transient detector REFUTED | compact FX face + grid | [beatrepeat-derivation] |
| Channel EQ | SVF shelf algebra; gain-dependent corners | simple EQ face | [channeleq-derivation] |
| EQ Three | Butterworth crossovers; per-band gating | 3-band face | [eq3-derivation] |
| Drum Buss | drive law closed form; boom resonator laws | compact FX face | [drumbuss-derivation] |
| Pedal | Newton-Raphson Shockley diodes per type | compact FX face (type enum) | [pedal-derivation] |
| Dynamic Tube | bias law decoded; tube LUTs = corpus | compact FX face | [dynamictube-derivation] |
| Utility | 14 params; 9 calc bodies; BassMono TPT law; surface crate | compact utility face (gain/pan/width/mono) | [utility-derivation] |
| Looper | **full state machine**; fixed-point law | transport-button face (record/overdub/stop layers) | [looper-derivation] |
| Spectrum | FFT/window/block laws; **analysis-only** — readings, no writers | **ReadingRow face**: honest diagram, zero writers — the model case for read-only devices | [spectrum-derivation] |
| Vinyl Distortion | crackle resonators; pinch injection | compact FX face | [vinyldistortion-derivation] |
| Vocoder | geometric band law; formant tilt | band-matrix face | [vocoder-derivation] |
| Shifter | 3 engine families found; 6-mode names **unconfirmed** (named thin spot) | compact FX face | [shifter-derivation] |
| Resonators | 5 slots; L/R ping-pong; tuning LUT | 5-slot bank face | [resonators-derivation] |
| Hybrid Reverb | 54 params; devicekit; **tail is NOT the Reverb engine** (distinct derivation); IRs = assets | compact face + IR picker (assets by ref) | [hybridreverb-derivation] |
| Legacy ×5 (Chorus/Flanger/FreqShift/Phaser/Redux legacy) | one section each; **shared DSP library found** | legacy section in the browser (named as legacy) | [legacy-derivations] |

**Mechanism-only (2):** Amp and Cabinet — Softube bundle; mechanism documented
(partitioned FFT for Cabinet), **DSP not ours** [amp-derivation; cabinet-derivation;
COVERAGE]. OPEN-QUESTION (ledger §10 item 24): whether DLW's live mode carries these
two slots at all, given the DSP is third-party and the corpus deliberately does not
derive it.

*A5.3 MIDI effects (11 slots):*

| device | established | DLW face | cite |
| --- | --- | --- | --- |
| Arpeggiator | rate table **byte-decoded**; Fisher-Yates with LCG random | pattern face (rate/scale/gate rows) | [arpeggiator-derivation] |
| Chord / Pitch / Scale | storage model derived (one row each in the ledger) | note-transform faces | [chord-derivation] |
| Velocity / Note Length | length + release-velocity decay laws **closed** | compact transform faces | [velocity-noteecho-derivation] |
| Note Echo | **NEGATIVE: no compiled device — Max for Live** | browser entry attributed M4L; not derivable from the binary | [velocity-noteecho-derivation §3] |
| LFO | **NEGATIVE** (the Live 11+ MIDI LFO ships as `LFO.amxd`, M4L); the **engine LFO that IS in the binary fully derived**: `OLfoProcessor` — shapes, S&H, smoothing, attack fade, tempo-sync, retrigger phase law | the shell's native LFO/modulator device builds to the engine law, not the M4L patcher | [lfo-derivation] |
| MPE Control / Envelope MIDI / Envelope Follower | **NEGATIVE ×3** (M4L patchers); the **native MPE machinery fully derived**: `AMpeSettings` zone model (`/MpeSettings`; zone-type 0/1 = Lower/Upper zone; channel pickers), MpeSettingsDialog, and the four engine processors **MpeDecoder / MpeEncoder / MpeFilter / TuningSystemToMpe** | MPE settings as a settings face over the derived zone model; MPE is native infrastructure | [mpecontrol-derivation] |

*A5.4 Cross-device surfaces the corpus established:*

- **Racks ×4 + mixer/scenes** — the full structural model (§3 carries it):
  group-device chassis, branches, chain-selector zones with crossfade ramps, drum
  pads, macro bank + snapshots + variations, chain mixers, master/cue/crossfader.
  "963 factory racks verified" as structural evidence (E2: 963 `.adg` under Core
  Library/Racks) [racks §Evidence, §1–4]. Ledger rows still open: macro-mapping
  probe, TimeSignatureId encoding, crossfade curve law, `CrossFadeState` enum,
  crafted-rack corpus [racks §7].
- **Clip craft** — warp engines ×6 (A4), clip envelopes (model surface; behavior
  medium), follow actions (A4), fades (sample-domain lengths), groove pool.
- **Golden gate suite: 13/13 PASS** with archive wiring; 53 lib tests green; five
  devices gated in total (Glue, Echo, Reverb, Operator, Wavetable) [NOW rounds-3-8;
  NEXT-SESSION].

**The fold-in plan — how DLW's Live mode presents this (A6).**

*A6.1 Where Live mode sits in the shell.* Revision 5 restores **Live as the shell's
base mode** — one of five modes (live · base/Central · factory · expressions ·
technē), each keeping its own panes, the encounter carrying across [WSD Rev 5;
mockup:world MODES; SDK modes.ts]. "One transport, five meanings": the same 28
transport slots wear Live's meanings in live mode (the A2.2 slot list is the `live`
column of Rev 5's table, typed as data in `modeGrammar.ts` and cross-tested against
the SDK's declaration) [DEVELOPMENT-TRACK §SYSTEM SHAPE; SDK modes.ts
TRANSPORT_ROWS]. (The landed slot count is **28** — `TRANSPORT_SLOT_IDS` in
`modeGrammar.ts`; see §6.2. The stray 29 in earlier drafts originated as
`DLW-PLAN-p3-SOURCES.md:52`'s "29 slots × 5" — an error against the code it
describes — which this compile promoted into §6.2 and §12; recorded as a
corrected error, not a source conflict, at the fold 2026-10-10.)

The mode system is **landed code**: seat `20da871dc` — five modes × 28 transport
slots as typed data; per-mode Session|Arrangement presentations; Rev 4's Clip|Device
pairs through the one inhabitant rack; suites green (mode-grammar 9/9, composition
guard 29/29, agent 51/51, 90/90; tsc zero) [DEVELOPMENT-TRACK]. The Session/
Arrangement **one-Timeline fix** landed with L1 (projection pane kinds +
ProjectionModule contract + encounter bridge; integrated live battery 18 obs / 0
faults) [MAP lane table 9 Oct].

*A6.2 The audio cut: Session and Arrangement.* The world mockup's live mode is the
component form [mockup:world Rev-5 block]:

- **Session** (`musicsess`): track columns Drums `#e2a35e` (Kit 1 · Kit 2 · Fill ·
  Break), Bass `#d985a6` (Root · Walk · Octave), Keys `#7ec3e6` (Chords A · Chords B ·
  Stab), Pad `#8fd0a8` (Swell · Air), Voice `#c9a0dc` (Take 3 · Take 4) — 7 scene
  rows, playing slot marked, plus the **Main launch column** with scene triangles.
  Per-mode meaning [mockup:world VIEWTIP.live]: "Session — clips and scenes."
- **Arrangement** (`musicarr`): bar ruler, per-track lanes with colored clips, one
  playhead. "Arrangement — the song over time."
- **Clip | Device** detail pair for live mode (`DVN.live = ['Clip','Device']`):
  Clip view = clip properties (start `1.1.1` / end `2.1.1` / loop `on` / signature
  `4 / 4` / groove `none`) + Notes piano roll; Device view = the chain.
- **Browser** categories for live mode [mockup:world BCATS.live]: Collections →
  Sounds ♪ · Drums ◍ · Instruments ▦ · Audio effects ≈ · Samples ∿, plus Views;
  result lists carry the device names the corpus derived (909 Core Kit, Operator,
  Wavetable, Simpler, Sampler, Glue Compressor, Reverb, EQ Eight, Echo, Saturator).
- **The pool beneath the browser**: Live's Groove Pool geometry becomes the shell's
  contextual working area — "In audio it retains its admitted audio purpose"
  [UI-UX §Browser below].

Measured rulings the fold-in inherits [UI-UX §Five-region composition; §Three levels
of disclosure]: compact/perform shows only chosen parameters + actual macros;
Configure reveals full settings behind a toggle; Deep edit takes the center; at
~700px one readable device; at 1920×1200 the dense horizontal device rhythm with a
dominant center; "no second tab band"; the bottom detail remembers per-panel height
(Clip and Device each remember their own — UI-UX:67-69).

*A6.3 Device faces per derived family.* Every derived device lands as a **face**, not
a bespoke app. The face vocabulary is the Device SDK's [SDK §controls]: `FacePlate`
(power standing on/off/**unknown** — "an unknown state has no illuminated lamp"),
`ScalarParam` (knob/slider, pointer drag + arrow keys + typed entry, acknowledged base
vs retained draft), `EnumParam`, `BoolParam`, `ReadingRow`, `Lamp`
(admit/deny/waiting/refusing/unknown), `Disclosure`, `WaitingFace`. The device
**format** in live mode is `chain-plate` (`MODE_DEFAULT_FORMAT.live`); the other
declared formats — `die`, `scene-strip`, `run-viewer`, `instrument-face`, `tool-tile`
— serve the other modes [SDK modes.ts]. Three presentations of the same live
parameters, per the panel brief: compact rack widget (title, activator **only if a
real owner enable exists** — hollow light otherwise; small live diagram; ≤4 default
controls), expanded (the whole panel, browser column and pool), full (center/studio)
[DEVICE-PANEL-BRIEF].

The derivation→face mapping is column three of the A5 tables. Recurring rules:

- **Compact set ≤ 4** controls chosen as the performer's controls, justified in a
  comment [DEVICE-PANEL-BRIEF rule 8].
- **Honest visual**: every drawn element computed from the reading or a cited engine
  relation; "Never animate a plausible substitute" — Spectrum is the model case
  (readings, no writers) [DEVICE-PANEL-BRIEF rule 2; spectrum-derivation].
- **Activator honesty**: `enabled` returns a boolean only where a real owner enable
  exists; otherwise `undefined` (hollow light) [DEVICE-PANEL-BRIEF rule 6]. In Live
  terms this is the device `On` parameter [session-model §6].
- **Modulation surfaces**: Wavetable's 52×13 and Meld's 50×19 matrices are the
  measured precedent for §14's typed parameter addresses + `modulatedBy` observables;
  "The shell's device panel should expose the matrix … rather than a fixed velocity
  knob" is the dossier's own consequence [mod-matrix §Shell consequence; WSD §14].

*A6.4 Read-only until the audio owner lands — the honest boundaries.* The standing
honesty law [MAP §Standing laws; WSD §11]:

- "No audio/device-editing/performance claims before those owners land"; all 126
  targets pending until each target's stated behavior is exercised.
- The mode system's landed state says it plainly: per mode, "**Live unchanged
  (read-only honesty)**" [DEVELOPMENT-TRACK §SYSTEM SHAPE].

The candidate audio owner exists and is measured: the clean-room Rust crate
`packages/live-dynamics` (Glue, Echo, Reverb, Operator, Wavetable gated; 13/13 golden
gates; the shell already plays sets: `cargo run -p live-shell -- --play <set.als>`)
[NEXT-SESSION §State]. Until its owner op is admitted into a family manifest, every
derived device face renders as **readings + declared-waiting writers** — "a row
without a writePath IS a reading — that is the grammar, not a convention" [SDK].

Named machine-state caveats that bound what may be modeled now [mod-matrix;
NEXT-SESSION §6–7]: the frozen modulator sources 8/9/12 (model nothing from the
frozen state; labels await a UI-authored set diff or machine recovery); the shifted
velocity transfer (do not model the exact 10→Amp transfer from current engine state);
Shifter's unconfirmed mode names; Operator's off-factory Algorithms; warp mode-0's
absolute name.

OPEN-QUESTION (ledger §10 item 25): **which family admits the derived Live device
faces.** The six product carvings are central, actuation, ai-kit, software-factory,
workcell, quaternal-logic [WSD §12]; §18 assigns the musical system to
quaternal-logic (M1 as instrument device). The audio-effect chain the mockup draws in
live mode (Drum Rack → Glue Compressor → Reverb) has no named owning family yet.
Options: a QL extension, or the seventh-carving path (a new product admitted with
zero core change [WSD §13]) — the owner rules.

*A6.5 Never-ship and licence law (binding on every face).* No captured images, no
Ableton icon art, no preset content [UI-EVIDENCE; README guardrails]; model frames
are additive re-synthesis from measured spectra — "presets contain wavetables: do not
redistribute" [backlog Wavetable row]; sample audio never extracted
[sampler-derivation]; IRs and resonator materials are assets by reference
[hybridreverb; corpus]. The licence gate (adopt / clean-room / interface-only per
source) is binding for code adoption [PROGRAMME rulings].

**Named gaps — what the derivation corpus does NOT cover (A7):**

1. **The residual ~24 device slots** [COVERAGE final row]: Max stubs ×3, External
   Audio Effect/In, Tuner (no defaults), corpus-material residuals — plus the two
   mechanism-only Softube slots (Amp, Cabinet). Named, not derived.
2. **Macro-mapping persistence** — the classic `MacroControlMapping` XML does **not
   exist** in Live 12 documents (0 hits across 963 racks + 24 sets); the store has
   moved to the Flip live-model layer (`live.MacroMapping{macroIndex, rangeMin,
   rangeMax, targetDevice, targetParameter}` per binary strings). One load-probe
   against a Live-saved rack with a mapped macro pins the persisted spelling — "the
   highest-value single probe in this lane" [racks §1.7, §7.1].
3. **TimeSignatureId encoding** (observed only 201 = 4/4), **chain-selector crossfade
   curve law**, **`CrossFadeState` enum semantics**, **crafted-rack corpus** (no rack
   sets in the harness yet) [racks §7.2–7.5].
4. **FollowAction session dynamics** — blocked for the export driver; needs a
   session-capture driver (D18-continued) [follow-action; NEXT-SESSION §5].
5. **Warp-algorithm DSP per mode** — model surface documented; dynamics not
   behaviorally probed beyond modes 0/5 transposition + separation findings
   [session-model §8; warp-probe].
6. **Groove application mechanics** — `.agr` format + pool model known; application
   behavior partial [COVERAGE groove row].
7. **The LOM object graph** — compiled into the binary; enumeration pending the
   binary lane [session-model §8].
8. **Engine-state casualties** — the mod-source labels 8/9/12 and the exact velocity
   transfer (A6.4).
9. **The `live-12-re/devices/<slug>/DECODE.md` path of record is empty** — the
   landing register founds it as the interface for shell lanes ("empty today, the
   path of record" [shell-inputs INDEX]); the actual corpus lives in the O-I research
   tree. OPEN-QUESTION (ledger §10 item 26): whether the derivation dossiers should
   be published into `live-12-re/devices/` as DECODE contracts (the landing
   register's shape) or consumed where they are.

**Exists vs to build (exhaustive, sourced) for Live mode:**
- EXISTS: Session/Arrangement views as one Timeline projection (L1);
  mode-grammar Live column as data; measured Live captures as the visual
  basis; Live's place and surface at the measured Live standard (craft
  `0f4bfdadf`, 10 Oct — live empty states, live detail presentation,
  `live-mode-place` 8/8); the live-set/live-dynamics crates as the
  document/DSP owners
  (5 device gates PASS, ~50/70 dossiers documented — §1.2); the musical
  declaration half (L9 inhabitants) with D13-in-the-type; sample-clock
  mapping table (7 rows); realtime gate measured fixture-side (47× headroom;
  round-trip median 0.0 / p95 0.1 / max 4.6 ms, n=53; late-delivery recovery
  10.8 ms — `wayfinder/tickets/L9-musical-family.md` resolution).
- TO BUILD: the Live-mode centre's consumption of the landed crates as they
  gate (the craft place/surface has landed; crate-consuming behaviour has
  not — consume, never rebuild — LANES.md contract 1); audio device faces when the
  device-editing contract lands; the realtime gate measured **in the Tauri
  shell** (WKWebView/Tauri device latency — L9 "still waiting", named; ledger
  §10 item 30); performance input stays #281's (the six-row Jankó projection,
  polyphonic pointer/keyboard/MIDI through one operation path — "strike
  deliberately not offered (#281 owns performance input)", L9 resolution).
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

### 4.2 CENTRAL — the ground's craft (days, documents, central devices)

*(Retitled 12 Oct from "BASE · CENTRAL": under the owner's ruling "base"
names Live; the code's title `'Base · Central'` (`GRAM:228`) is a naming
defect, ticket T-LABELS — §4 head.)*

**FOCUS** *(revised 12 Oct)*. **Central is a mode** by the owner's ruling
(`CONT:251`), and **not an app**. In the contemplation it is "the ground —
the field where material lives, where a day composes, where the reading
keeps its thread" (`CONT:179`), the ground every mode returns to: "All
return to Central" (`CONT:184`). Its mechanism, which the ruling leaves
standing, is one World context (`WorldContext.world: 'central'`) whose
material projects through the same four projections and inhabits the same
rack — "Nothing new is stored. Central mode is the shell with Central
material selected — the tripartite spine's world context, not a mode
switch" (`WORLD-SHELL-DESIGN.md:533-556`, §6). The design's "not a mode
switch" describes that mechanism; it does not take Central out of the mode
set. The leave act stays open (ledger item 44, partly settled; T-WORLDCTX).
"Base is Central's ground" (`WORLD-SHELL-DESIGN.md:119`) is Rev 3's
wording, before Live's restoration. The owner's mapping, verbatim
`[session]`: "whilst central would be closer to what ableton has in its clip
view, the nitty gritty fucntionalities of warping etc, this can be where
central is mapped and you can see exactly what folders are being worked in,
what impact across the central web, any erroneous worktrees or branch
creations etc."

**Tension, kept unmerged** *(12 Oct; VIS L-6)*. These words liken Central
to Live's clip view and its warping. The contemplation places the editing
layer in Technē, as origin-return (`CONT:82-84`; §4.5), and the warp engine
itself is Live mode's port (§2, D9). Three senses of "editing"; none
contradicts the others, and this plan merges none of them.

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

### 4.3 FACTORY — the work programme (sessions, runs, the agent chain)

**FOCUS.** "Factory supplies World phenomena — Positions, occupants, current
work, attempts, communiques, artifacts, returns — and those project through
all four views and inspect through the implicit agent/files surfaces. No
bespoke Factory application is built" (`WORLD-SHELL-DESIGN.md:557-562`, §7).
 Division of labour (design prose — authored in the planning session's
assistant elaboration and written into `WORLD-SHELL-DESIGN.md:719-728`;
session-authored, owner-commissioned and accepted, **not the owner's verbatim
words**): "Actuation tunes *how* agents run; AIKit supplies *what they can
do*; Factory organises *what work happens*. Three families, three aspects,
kept distinct where a monolithic 'agent UI' would blur them." (The owner's
genuinely verbatim words on this seam are the workcell-plugin and
actuation-device examples, quoted in §0.) Session = sessions and tasks;
Arrangement = the run viewer (Rev 5).

**The mode in the contemplation** *(12 Oct)*: "The work — transformations in
motion, agents under custody, runs commissioned and watched and received";
"Factory is where work happens. Its outputs return to Central or feed
Expressions" (`CONT:180`). Two crossings are named, and neither is wired:

- **A reading becomes a commission's source** — the first of the owner's
  three crossings: "You are reading in Central and a tangent opens onto a
  Factory commission; the reading is now the commission's source"
  (`CONT:167`). The design carries it as commissions from a reading
  (`WORLD-SHELL-DESIGN.md:566-568`). The crossing is an explicit act that
  keeps the reading's ref; it never sends, discloses or launches by itself
  (`EXP/FACTORY-AGENCY.md:42,102`; VIS §2.4).
- **Factory outputs feed Expressions** (`CONT:180`) — planned
  (`APPB:254-259`), behind the red Factory receiving/advancement gate (PATH
  §3; TO BUILD below). The feed is not built ahead of that gate (VIS §5.3
  item 29).

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
  software-factory manifest (6/0 per the L2 ticket's count; 5 faces on disk —
  the ticket's convention counts differently, both stated at the grill fold);
  workcell manifest (4/0, seat reading =
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

### 4.4 EXPRESSIONS — the expressions mode (the retained application)

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
(`EXPRESSIONS-PORT-PLAN.md:3-4`). (The expressions *ontology* — tracks,
clock, musical system — is §5.)

**The mode, owner-ruled and kernel-bound** *(12 Oct; VIS §2.3, L-7, L-9)*.

- **What it is.** "The form — the sounding, the physical, the scene. Where
  things become sensible" (`CONT:181`): the 3:3 body (`TDR:35`).
- **Nara, foreground.** The chain is M4 Nara ↔ S4 Workcell ↔ S4′ Anima → M4′
  (`LOCK:96`), with Nara foreground in the 3:3 reading (`LOCK:31`); M4′ is
  "the general Expressions application body, with the operative M1–M2–M3
  backend" (`LOCK:388-397`), and by D-G the application "remains the M4
  body" (`PROG:110`). Here the meditation lives as the owner states it: "not
  a pause. It is a dialogical encounter. The oracle speaks; you listen. The
  system meets you; you meet the system" (`CONT:98`). The companion is Anima
  with the tab "Nara · oracle" (`DOCK:66`), matching "Anima_i = M_i × S4′,
  situated expressive operator for the 3:3 / Expression reading"
  (`LOCK:507-508`); the oracle is M4's own designation, "Oracle Interface
  Between Personal and Universal Domains" (live Bimba map, queried 12 Oct
  2026). Build rule (VIS L7): one `oi.nara-dialogue-binding/v1`, no second
  conversation store, no device that renders a verdict on synthesis, bodies
  handle-only; draw no pause. Where the Nara encounter's interface lives —
  rack, dock or day — is the owner's (VIS L7, C3).
- **Live's destination.** Live mode moves here, with audio and video track
  layers on one timeline (`CONT:247-250`), when the owner times it (ledger
  item 51). Track kinds enter as adapters on the Timeline projection (§5.2,
  §5.8); no design or code yet names a video track.
- **The medium, piece by piece** (`CONT:120-125` against the sources):
  glyph-projection scenes as the medium — glyph, text and role material in
  scenes is landed (`APPA:127-147`); naming it "the medium" is the owner's
  (`CONT:120,123`). The physics sim as a single instrument is owner-stated
  (`CONT:124`); the design docks "the field/PCM owner… as an instrument
  device… the stage stays the instrument's visible body"
  (`WORLD-SHELL-DESIGN.md:922-924`); whether the GPGPU field is that
  device's body is **Open** (ledger item 47). Landed: `GPGPUSimulator`
  (`APPA:151`); the cymatic resonator, 2D Chladni plate and 3D standing-wave
  cavity, "a damped modal resonator in the envelope domain" (`APPA:163-168`;
  `expressions-app/src/engine/cymaticResonator.ts:7-25`); `followCymatic`,
  a per-entity voice that "sounds the entity's cymatic/template frequency"
  (`APPA:174-176`; `UI/components/nativeEntityFace.sound.ts:12`).
- **Item 47 (L17).** **Tension, causal wording only:** "the cymatic patterns
  produce sound" (`CONT:124`) against excitation plus material "determine
  evolving state", with audio and visible displacement deriving "from that
  state" (`MPW:86-88`; §5.5). Entity voices are "never a second clock and
  never the native M2 PCM owner" (`expressions-app/field-studies-journeys/src/native-field/entitySound.ts:5-7`), wording that differs
  from D13 (`MPW:32-34`); their D13 standing is unruled. Keep the
  common-cause law, add no generator, and label entity voices
  "retained-app voices, relation to M1 unruled".
- **Composition direction.** "Technē composes → Expressions performs"
  (`CONT:116,127`) is read at the formal bridge the lock names, M3 Journey ↔
  Expression Scenes (`LOCK:457-466`), between two operating modes of one
  application (`LOCK:390-399`) — not a pipeline or a hierarchy. "The Palace
  in Technē becomes the performance in Expressions" (`CONT:127`) has no
  source: the Palace returns proposals (`APPB:72-76`; §4.5).
- **Three counts of "family", kept apart:** 6 products (§1.2); 7 admitted at
  the world gate (`APPA:239-240`); 22 Expressions device sub-families through
  `familyAdmission` (`APPA:242-243`). The contemplation's "22 declared
  families" (`CONT:60,141`) is the third.
- **A lens is not a device.** "A pane-instrument *may expose* devices; a
  device never hosts a pane" (`DLW-PANES-ONTOLOGY.md:164-197`). The
  contemplation lists lenses, agents and devices as one layer of
  transformations (`CONT:58-60`): one function, separate carriers.
- **On main.** The Expressions native transport
  (`UI/components/NativeTransportBar.tsx`), scene playback
  (`UI/components/nativeScenePlayback.ts`) and property takes — record,
  replace, append (`UI/components/NativeTakes.tsx`; `UI/native/frameTakes.ts`)
  — are on `main` via #635. APPA's rows that place them on an unmerged lane
  (`APPA:12,337`) are stale (VIS §5.2 item 23); "live replay not yet run" applies only
  to the Device SDK row (`APPA:343`).

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
T1/T6). The musical system beneath: §18 (folded into §5 and §4.1):
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
the Studio (the engine's own controls). The eleven fixed device keys
(`DEVICE-PANEL-BRIEF.md:17`): physics, pointer, relational, medium, contacts,
morph, focus, colour, ink, depth, resonance. ("Family" is reserved for the
six product families throughout this plan; these keys, the §3.1 chain
container classes and the product families are three distinct concepts.)
One whole panel = one
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
  needed, ledger §10 item 4); the fifth-places remedies (Takes tab → Timeline
  lanes; one Scene-editor host; Configure›Devices hard-coded families removed
  — `EXPRESSIONS-FOUR-SURFACES.md`); takes as Timeline lanes (W5 adapter
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

### 4.5 TECHNĒ — the six instruments' target sets

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

**Origin-return — the owner's correction** *(12 Oct; VIS §0 item 4, L-6)*.
Technē's editing "is not just editing — it is **working the material
backward into its origin**" (`CONT:84`). That working is compassion, "loving
sensitivity to origins", and the origin is Gebser's ever-present origin, "the
origin not as a point in the past but as an ever-present source"
(`CONT:86`). "Every lens,
every constellation, every journey, every palace is an act of tracing
material back to its source… The Archive is reversible. And the tracing is
love" (`CONT:88`). This corrects the study's "world of knowing"
(`PRAX:306-310`); read with `CONT:182,184`, Technē's knowing *is*
origin-return. Hesse holds the same movement: the meditation on each
symbol's "content, origin, and meaning" (`MECH:78`), and "forgetfulness of
origins" as the mark of decay (`DECAY:150-151`).

- **The kernel grounds the return** (live Bimba map, queried 12 Oct 2026,
  unless noted): M0 is "The Ever-Present Origin" (M0
  `c_1_primary_designation`). M5-5's synthesis is the 5→0 Möbius
  write-back — "As ἀνάλογος it completes the return"
  (`BMAP/M5/M5-5/M5-5.md:38`) — and its etymological archaeology deposits
  "through review and Hen vault-write into M0's bimba node", with M5-5
  `RETURNS_TO` M5-0, so the return passes through review to M5-0 and into
  M0. M5-5 `DEMONSTRATES_THROUGH_ETYMOLOGY` → M4.4.4, the Phenomenological
  Lens, "Reduction - excavating to constitutional origins": etymological
  archaeology at M5 and Nara's reduction to constitutional origins at M4 are
  one movement on the map. M4 Nara is where the individual self "awakens
  through compassionate sensitivity to origins" (M4 `c_0_core_nature`).
  Each Logos stage carries a Gebser structure (`BMAP/M5/M5-5/M5-5-0…5.md:24`);
  Nara's lens 0 is the "Gebser Lens" (M4.4.0). M4.5-1 names "pedagogical
  compassion" (`BMAP/M4/M4.5/M4.5-1.md:17`): the teaching carries the same
  care as the return. **Inferred** (VIS L-6): M5′ is "the SAME application
  in M5/M0 deep-working mode" (`LOCK:399-401`), the two poles the 5→0
  write-back joins; Technē is the mode that works them.
- **The provenance mechanics** — the material condition of the act, not the
  act; built under plain names, with no coined UI label for the act:
  - the cradle Trail with `returnTo` (`CRADLE/CradleFrame.tsx:1012-1026`) —
    built in the legacy cradle, **not carried** into the new shell (T-TRAIL;
    ledger item 28);
  - the Technē Clip "source" section — **declared-waiting**
    (`UI/shell/ModeDetail.tsx:254-263`);
  - the lane-5 "source/verso leg with explicit return… return restores the
    exact beat by ref equality" — **target** (lane-5 target set below);
  - page-anchored cites, backlinks and ghosts — **built in
    Archetypal-Earth** (`APPB:51-53`), not yet in the shell.
  Every derived thing names its source and can be walked back to it in one
  act; a return reaches the origin's owner as a proposal, never as a direct
  write (VIS §6 ORIGIN).
- **M5′ is the whole deep mode** (§11a): "the SAME application in M5/M0
  deep-working mode" (`LOCK:399-401`); the six lenses are narrower
  projections, and "M5′ is not reducible to a Palace screen"
  (`LOCK:406-410`). The chain is M5 Epii ↔ S5 QL-MEF ↔ S5′ Aletheia → M5′
  (`LOCK:97`). The dual reading, 4:2 Technē / 3:3 Expression (`LOCK:3,14-51`),
  lost its four-and-two half on 19 Oct 2026: Technē's instruments carry no M′
  numbers (lock §0.1 item 3). The contemplation's
  "TECHNE-DUAL-READING.md" resolves to `docs/experience/TECHNE-DUAL-READING.md`
  (`TDR:12-35`), cited with the lock.
- **Palace is the M5 pedagogy pole's form.** Palace is "teachable", "the
  explicit deep objectification of the otherwise ambient M5
  articulation/pedagogy/recognition pole" (`LOCK:356-358`). "The system
  teaches by being met… The teaching is the encounter" (`CONT:106`). The
  Palace returns attributable proposals; it is not performed (`APPB:72-76`).
  A separate teaching surface is the owner's (VIS L8).
- **Companion label** (ledger item 49): the dock names the Technē companion
  "Epii" (`DOCK:67`), its M5 subsystem; the Expressions companion is named by
  its S4′ operator, Anima. The lock's "Technē_i := Aletheia_i"
  (`LOCK:510-517`) went with the four-and-two reading (owner, 19 Oct 2026), so
  the label stands.

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
(the Relation Field) + journey (scene rows as walk stops); Constellation
holds project/graph (bounded local whole: list · tree · graph · form) +
canvas (artefact suite; drag is presentation; a drawn relation is a proposal
until promoted through the relation owner's Action); Earth holds places at
five scales (Field · Orbit · Surface · Place · Palace — M5-palace as a
special location you enter); Expressions is the 3:3 reading with its
layers; the rack's cut switch crosses between Technē and Expressions
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
  SC-1…SC-7 (see §4.4 and §9; lane 5 consumes, never forks).
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
  stood); the formal crossing between Technē and Expressions; return restores the exact beat by
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

## 5. The expressions ontology — sound and temporality as one ontology (P3 Chapter C)

### 5.0 The one-paragraph statement (C.0)

In the Digital Logos Workspace there is one material — the World, the shared
semantic field owned by native owners — and every sounding thing and every
temporal thing is **track material in the same neutral shape**: a family
projects its own reading into columns, tracks, clips and optional transport
takes through a World track adapter (`worldTrackAdapter.ts`), and the
Timeline "knows no family." The work-time stratum that all performable
material shares is the **sample clock**, bound read-only into a five-strata
time spine (chronos · civil · cron · transport · occasion) through one
declared mapping table in which **a conversion without a row refuses** — no
silent conversion between samples, seconds, transport units, M1 phase, M3
inscription, sky occasion and civil day ever happens by arithmetic alone.
The musical system is not a second ontology beside this one: M1 is the
oscillator **source** (owner D13), M2 declares **observables** whose type
carries `generates: false` and whose routes compile before realtime
execution, M3 supplies **form and score as clip material**, M4 is the
**body** the whole application already is — and every sonic or physical
entity carries its **role in the type** (resonator ≠ emitter ≠ collision
trigger ≠ analyser ≠ visual-only), its **epistemic standing verbatim**
(fact · claim · inferred · hypothesis · disputed · ghost — placement never
upgrades standing), and its **take machinery** named honestly as the
performance-recording seed, never claimed working. A track for sound and a
track for civil days are the same kind of thing at different carriers:
"Tracks are lanes of World material: Expressions scenes, historical events,
Factory runs, agent activity, conversations, civil days, celestial motion,
M3 clock transformations. Clips are the material in lanes" (`WORLD-SHELL-DESIGN.md` §3.2).

### 5.1 The law that makes it one ontology (C.1)

**The design law** (`WORLD-SHELL-DESIGN.md` §1): "One World, four
projections, real panes, one rack." The World "is never rendered directly;
it is always encountered through a projection." Nothing is "copied into
view-specific domain models"; the rack is "the plugin system of the whole
environment, generalised from Ableton's device chain."

**The timeline resolution** (§3.2): "The design move: **Session and
Arrangement are the two presentations of one Timeline projection over any
World material** — not audio-mode features." This resolves the recorded
fault of coupling them to audio mode (`UI-UX-CONVERGENCE-STUDY.md` line 36,
`App.tsx`: "Session/Arrangement controls explicitly switch the workspace to
audio" — fault; required change: "Separate the selected native work from its
center presentation").

**The seam** (§10 seam 5): "Timeline generalisation — Session/Arrangement
present any World track set; the set model (`useSet.ts`, `document.ts`)
gains World track adapters (day tracks, run tracks, conversation clips)."

**The owner's phrasing** (planning session, quoted by the orchestrator):
"a day is a track, returns and handoffs are clips, conversations are clips,
the wiki is already a native Expression projection"; audio and
visual/physics tracks "are track adapters."

### 5.2 The World track adapter pattern — the ontology's one extension point (C.2)

The landed contract (`src/timeline/worldTrackAdapter.ts`, header):
"a family projects its own reading into the Timeline projection's neutral
shape: columns (time blocks, e.g. scenes), tracks (lanes, e.g. objects or
automation), clips (spans placed in a column on a track), and optional
transport material. The Timeline renders this shape; it knows no family."

The four shapes, verbatim from the contract:

```ts
WorldTrackColumn  { id, name }
WorldTrack        { id, name, kind }            // kind chosen by the family
WorldTrackClip    { id, trackId, columnId, label,
                    span?: {start, end},        // column-local; units are the family's own
                    state?: string }            // the clip's standing
WorldTrackTake    { id, target, name }          // "Takes belong to the Transport stratum
                                                //  of the time spine. An adapter may expose
                                                //  them, but a take is never a clock and
                                                //  never a Timeline track."
WorldTrackSet     { columns, tracks, clips, transport? }
WorldTrackAdapter<T> { id, project(reading: T): WorldTrackSet }
```

The ontology's proof is the breadth of what already projects through it —
seven adapters, one shape:

| Adapter (registration id) | Family | Columns | Tracks | Clips | Source |
|---|---|---|---|---|---|
| `central-day-track` | Central civil | the civil days the reading covers; an **`undated` column stands FIRST** ("relative material is visible, never silently mixed into dated days") | `Central · day` (streams `central-now`, `wiki-returns`), `Machines · NOW` (`aikit-history`), `Kernel · event log` (`kernel-event-log`) | one **moment** per event at its day-local hour; standing `'fact'` as read | `src/timeline/dayTrackAdapter.ts` over the kernel's one temporal read |
| `factory-run-track-adapter` | Software Factory | civil days | one lane per run subject, **bounded to the twelve most active — honest overflow names the count, it never truncates silently** | the run's real events as moments; "a run with no events in the window draws no clips — its absence is disclosed by the presentation, not invented" | `src/timeline/runTrackAdapter.ts`; `isRunSubject()` admits `agent-session/`, `factory/`, `run:`, `run\d+` — "Conversation spaces are NOT runs" |
| `conversation-clips` | Central/agency conversations | civil days | one lane per conversation space (`session-space/` subjects), bounded to the **eight most recent with honest overflow** | the space's receipts — "a conversation's clip is its receipt trail"; "the canonical conversation stays in its owner; only its receipts are placed" | `src/timeline/conversationTrackAdapter.ts` |
| `expressions-tracks` | Expressions | **the scenes** | one row per entity of the presented scene, plus one automation track when any automation lane exists | **each sequence step as a glyph-state span: hold + transition**; `transport.takes` = the presented scene's property tracks | `src/timeline/expressionsTrackAdapter.ts` |
| `ql-audio-track-adapter` | Quaternal Logic (musical) | the composition passes | lanes carrying their **role in the type** (`ql-audio/resonator` …); spans are **exact u64 sample cursors** converted by the declared mapping | role + standing travel on the label; takes = the performance-recording seed | `src/timeline/qlAudioTrackAdapter.ts` |
| `ql-physics-track-adapter` | Quaternal Logic (musical) | the composition passes | lanes with role in the type **and a declared span unit** (`seconds \| m1-ticks \| engine-blocks`) disclosed on the track row | visual-only clips honestly labelled `· visual-only`, `state: 'visual-only'` | `src/timeline/qlPhysicsTrackAdapter.ts` |
| `atlas-aion-timeline` | Atlas (Earth/Aion) | deep-time epochs | the atlas family's epoch jump | — (epoch material) | `src/timeline/registerWorldTrackAdapters.ts` (lazy import of `../projections/atlas/aionTimeline`) |

**The two doors** (`src/timeline/registerWorldTrackAdapters.ts`), the
admission law of the ontology:

- `projectWorldTracks(declarationId, reading)` — **the FAMILY door**: "the
  id must be declared by an admitted family manifest (`projections[]`) and
  registered here… the shell admits material through owners' manifests,
  never by presence."
- `projectLaneWorldTracks(id, reading)` — **the lane door** for adapters a
  lane landed ahead of its family's manifest declaration: "the registration
  is the disclosure; the family door stays strict."

Landed honesty (reverified at the fold, 2026-10-10): the run adapter does
**not** ride the lane door — the software-factory manifest already declares
`'factory-run-track-adapter'` (`softwareFactoryFamilyManifest.ts:16`; the
registry comment reads "under the software-factory manifest's declared
projection id"), so the family door would admit it today. The two QL adapters
and the day/conversation adapters ride the **lane door**; their manifest
`projections[]` declarations "are the families' own move" (registration
comments; `LANE-RETURN.md` honesty list).
The atlas epoch jump is the one materialised **family-door** path. Two
further seam facts the door census must carry (grill fold): **the Expressions
family's own declaration is silently unwired** — its manifest declares
`'expressions-track-adapter'` (singular, `expressionsFamilyManifest.ts:29,65`)
while the registry registers `'expressions-tracks'` (plural,
`registerWorldTrackAdapters.ts:45`), so `projectWorldTracks('expressions-tracks', …)`
throws "not declared by any admitted family manifest" and the adapter is
reachable only as a registration today; and six manifest `projections[]` ids
have **no registry entry at all** (`actuation-temporal-needle`,
`aikit-session-track-adapter`, `central-roster-track-adapter`,
`workcell-seat-track-adapter`, `ql-sky-earth-adapter` — an explicitly reserved
seam — and `atlas-earth-projection`): "seven adapters, one shape" is true of
registrations, not of the whole door picture.

Laws every adapter inherits (from the files themselves):

1. **Nothing is copied** — each adapter projects "over the kernel's ONE
   temporal read (`temporal_events_read` — K1's bounded, cached read;
   nothing is copied into a second store)" (dayTrackAdapter header).
2. **No silent conversion** — units are declared per lane; cross-stratum
   mapping happens only through the declared table (§5.3).
3. **Standing travels verbatim** — "placement never upgrades it"
   (every adapter; §5.6).
4. **Honest absence** — designed empty states name their owner (mode
   grammar `state: 'waiting'`; undated column; disclosed overflow counts).
5. **Takes are transport material, never clocks** (contract line).
6. **Refusal names the law** — a miscast role or a wrong rate throws the
   classification or no-resampling law in the error text.
7. **Lazy import** — "a family's adapter module loads only when projected."
8. **Families never import the registry** — "the Timeline knows no family."

### 5.3 The sample clock as the work-time stratum — the seven-row mapping table (C.3)

`src/timeline/qlSampleClock.ts` encodes QL-MEF #281 §2.5 as executable law.
The commissioned law, quoted in the module header: "Use a coherent
sample-time domain for the active audio device/offline renderer and explicit
mappings to transport, physical/control updates, display frames, M1 phase,
M3 inscription/aperture state, astronomical occurrence and civil Day/NOW."

The seven named strata (`QlStratumKey`): `samples` · `seconds` ·
`transport` · `m1-phase` · `m3-inscription` · `sky-occurrence` ·
`civil-day`.

**The seven declared rows** (`QL_CLOCK_MAPPINGS` — the ontology's whole
cross-stratum grammar; the table is "exposed so a face can render it and a
reviewer can audit every conversion the stratum will ever perform"):

| # | From → To | Via | Carrier | Law (verbatim, compressed) |
|---|---|---|---|---|
| 1 | samples → seconds | declared-rate | `sampleRate 48000 Hz (QL scene_field.rs default_field)` | exact device-rate division; no resampling, no drift term |
| 2 | seconds → samples | declared-rate | same 48000 | floor to the integer sample boundary (the audio binding schedules on integer device samples — `native-audio.mjs #newOriginTime`) |
| 3 | samples → m1-phase | declared-rate | **a declared tick cadence** (`controller.ts CADENCES`: world 1 tick/s, user 12 ticks/s; "neither is fixed by the M1 contract") | samples/48000 × declared ticks-per-second; the cadence's own source string rides the result |
| 4 | samples → transport | declared-rate | a declared transport rate **supplied by the caller** | no implicit tempo: the Timeline's performable time base must be declared before samples map onto it |
| 5 | samples → civil-day | **anchor** | a **measured anchor** (`samples_elapsed` + the owner read's civil instant, from ONE acknowledgement) | the only sample↔civil joint is a measured anchor; instants map to days by the spine's own UTC-day law |
| 6 | civil-day → sky-occurrence | anchor | the sky epoch of the anchor (or "now") | a sky occasion retains its snapshot basis and separately qualifies current admission (the K8 behaviour) |
| 7 | m3-inscription → m1-phase | anchor | `ring_codon_advance` determinant events (M3 form → Vimarśā pose) | inscription state advances **per owner EVENT, not per rate** — no silent interpolation between events |

The three laws the table executes:

- **No silent conversion**: `mappingFor` throws
  `no declared mapping X → Y in QL_CLOCK_MAPPINGS; no silent conversion` —
  "that IS the no-silent-conversion law, made executable."
- **Anchors are measured, not computed**: "The only joint between the
  sample stratum and civil time is an anchor read off an owner receipt…
  Declared RATES carry conversions inside a stratum family; anchors carry
  conversions across strata" (`QlClockAnchor`: exact u64 `samples_elapsed`,
  `atUnixMs`, optional m1/m3/sky state, and a `source` string naming what
  measured it).
- **Declared cadences only**: `QL_TICK_CADENCES` = world (1 Hz, "M3/M4′
  world clock") and user (12 Hz, "PPS user-facing tick"); a mapping riding
  an undeclared cadence refuses because "the M1 contract fixes neither
  rate."

**Binding into the spine is read-only** (`bindToSpine`): the stratum
contributes one chronos function — `ql-work-clock`, reading
`samples_elapsed N @ 48000 Hz (generation G, standing S)` — and when no
owner stands it returns the spine's own honesty string: "no functions — the
QL field/PCM owner is not standing." "The spine binds READ-ONLY (§15.1
discipline): this stratum contributes one chronos function — the owner's
work-time cursor — and transport takes are material, never a clock."

Policy constants are ports, not choices: sample rate 48000 (QL
`scene_field.rs` `default_field` via `controller.ts` `SCENE_SAMPLE_RATE`),
block 8192, lead/lookahead 0.5 s (`EMBEDDED_NATIVE_PLAYBACK`).

Measured demonstration (L9 lane, `musical-family-l9-20261009/`
LANE-RETURN verification step 4): "245760 samples = 5.12 s; M1 tick12 6 on
the declared 12/s cadence; samples→civil instant through the measured
anchor → day 2026-10-09; sky occasion basis retained; inscription by event;
spine chronos reading the owner cursor; take seed named."

### 5.4 The time spine — the five strata the sample clock binds into (C.4)

`src/timeline/timeSpine.ts` lands `WORLD-SHELL-DESIGN.md` §15 ("The time
spine — locked at the top, bound from below"; owner's session phrasing:
"also consider the cron and chronos level integration, as time is locked in
at a higher level (global time functions, kerykeion, day/now levels etc.").

The five strata, with their landed behaviours. *(12 Oct, count fixed.)*
The count is **five**: `timeSpine.ts` defines five, and WSD §15's own list
names five, under a heading that reads "Four strata, one spine"
(`WORLD-SHELL-DESIGN.md:802-803`) — a defect in the design document, sent
to its keeper (VIS §5.2 item 22). Cite five everywhere.


1. **Chronos (§15.1)** — qualitative/cosmic time: "kerykeion sky positions,
   the M3 clock and inscription phases, Aion epochs, the planetary field.
   Provided by the QL family; exposed by the spine as read-only time
   functions any family may bind." The spine "holds the binding surface and
   no values; until a family binds, the stratum honestly reports no
   functions."
2. **Civil time (§15.2)** — "the day/now closure law, owned by Central
   (`civil-time-policy.json`)… The spine only READS a situated civil-field
   reading supplied by its caller (the kernel's temporal read). It never
   reads the wall clock to tell civil time, and no shell timer becomes a
   clock." Landed poller: `useWorldTemporalReading.ts` — one
   `temporal_events_read` per 90 s (K1-measured owner cost), window = the
   last seven civil days through tomorrow bounded at UTC midnights (keeping
   the kernel's 2 s answer cache warm; measured "~10 s cold, ~13 ms warm");
   **Now is derived from the reading's own newest civil instant**, never the
   wall clock — the wall clock only bounds the query window.
3. **Cron (§15.3)** — "families declare cadences as parameters; firings are
   real executions, and EVERY firing lands as a Timeline clip — a cron run
   is temporal material like anything else… The spine fires only what was
   declared, records only what actually fired, and fabricates no history"
   (`fireCadence` refuses undeclared ids; `cronClips()` maps firings to
   clips on the `cron` track). Landed example: the Timeline projection's own
   civil-field read is a declared, armed, fired cadence
   (`READ_CADENCE_ID 'central-temporal-read'`, `declaredBy: 'timeline
   projection (K1-measured owner cost: the temporal read walks every
   stream)'`).
4. **Transport (§15.4)** — "the Timeline projection's playhead over
   performable material. It moves over clips and drives nothing else. A
   transport take is material, never a clock."
5. **Occasion (§15.5)** — retained time (§5.6's basis/admission split; the
   K8 sky contract's behaviour; §15: "Standing in 1913's sky without lying
   about now is what makes historical exploration honest").

The §8 controls (Now / Occasion / Transport) "are the user-facing face of
strata 2, 5 and 4; chronos and cron are the deeper platform strata" (§6.3).
The closing of §15 binds time back to modulation: "Time as a modulation
source closes the loop with §14: an LFO was always time — this world's LFOs
are transits, day phases, cron cadences and clock phases, addressable from
any family because the strata are locked at the top."

**The two-clock doctrine** (lane-6 SCOPE, quoted in MAP.md Decisions):
"civil time keeps closure law; one work-time core (sample clock included);
one typed bridge." Lane-2's `techne:time-axis/v1` is the bridge's content
spec. And the #281 packet law: "Transport state never silently overwrites
civil Day or geometric clock state"
(`M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md` §9-C). "Families bind, never fork
clocks."

#### 5.4a Units — NOW and DAY *(12 Oct; VIS L-1, L4, L5)*

The contemplation: "The DLW's time spine is **a wider system of NOWS and
DAYS**… Every act in every mode is addressable in this time. This is why the
modes can bleed: they read from the same spine" (`CONT:44`).

- **The Day is the only unit that closes.** Day-close law: snapshot first,
  then derive the dated reading; "yesterday remains a reading"; a DAY is a
  civil-date reading, "never a scheduler's opinion"
  (`CTRL/agents/governance/field-and-now/day-close.md:5,7-14,22`). If a close
  cannot run honestly it "stops before it cleans" (`day-close.md:18`).
- **FieldNow and FieldDay are two contracts.** `oi.field-now/v1` and
  `oi.field-day/v1` (`OI/shared-field/field-now.mjs:303-360`): refs and
  native revisions only, compare-and-swap advances; FieldDay's aggregation
  interval is set by its own policy (`OI/shared-field/README.md:110-112`).
- **Two NOWs, kept apart.** The Central/Workcell NOW is a horizon of bounded
  work (`EXP/WORKCELL-NOW-TEMPORAL-FIELD.md:70-95`). FieldNow is a shared
  field's collective reading with a presence cursor (`field-now.mjs:2,45`),
  drawn as "the FieldNow presence pulse" (`GRAM:454`). The contemplation's
  "FieldNow pulse" (`CONT:44`) is the second. Two units, not rivals.
- **The day's hours sit in a three-sided record.** Design: 08:30 / close
  routine / 21:00 (`WORLD-SHELL-DESIGN.md:40`; `GRAM:282-285`), with 21:00 as
  a Cron cadence (`WORLD-SHELL-DESIGN.md:812-824`). Policy:
  `day_boundary_minutes: 0`, `automatic_day_rollover: true`
  (`CTRL/user/civil-time-policy.json`) — a date rule, not a working window.
  Practice: the owner's Nara flow opens on a 6am scheduled task
  (`NARA/CLAUDE.md:33`). 08:30/21:00 stay design text with a source tag; no
  shell device fires a close, which stays `central.day.lifecycle`. Who fires
  the close, and whether a cron-fired close fits the civil-date law, is
  ledger item 45.
- **Above the day: Open.** No WEEK, SEASON or YEAR unit exists in the
  system; the shell's only week is a presentation window
  (`UI/projections/useWorldTemporalReading.ts:107-114`). The owner closes
  longer units in practice, in Nara's container, outside the DLW — weekly
  and monthly quilts, a quarterly merge-back, "roughly twenty months to a
  deck" (VIS L-1). Create no week or season object and bind no QL cycle as
  one (VIS L4; the contemplation's open item 1, `CONT:206`).
- **Tension, reconcilable.** "Every act in every mode is addressable in this
  time" (`CONT:44`) stands beside "Do not create a universal event ontology"
  (`EXP/WORKCELL-NOW-TEMPORAL-FIELD.md:194-232`). Refs on the spine satisfy
  the first without the second: an act is addressable in time by its ref and
  revision, with no universal event store.

### 5.5 The musical system's place — M1 source, M2 modulation-never-generation, M3 score material, M4 the body (C.5)

`WORLD-SHELL-DESIGN.md` §18 records the whole settlement; the commissioned
law is QL-MEF #281 (`M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`). The owner's
decisions, verbatim:

- **D13** (`M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md:32`, wayfinder §0.2, in
  full): "**M1 is the oscillator source; M2 pitch structures are
  tuning/modulation targets over that source.** M1's Prakāśa/Spanda carrier
  and M2-1′'s MEF/Vimarśā reading are both essential. Vimarśā writes the
  shared `audio_octet[8]` and `nodal_quartet[4]`; this does not make M2 an
  independent oscillator source, and it does not permit M1′ to bypass the
  source-defined reading."
- **Music is a first-class working mode, not another app** (wayfinder §3.1;
  §18): "an **integrated musical working mode, not another app**
  (#281 §3.1), reusing the shell's own machinery. Revision 5's Live column
  is that mode's transport face."
- **Common cause** (wayfinder §0 failure table): "Sound and animation
  merely share a timestamp" is the failure; the replacement: "Tests
  demonstrate the intended common physical cause." §18: "Sound and visible
  form are projections of one evolving state (the common-cause / cymatics
  law) — never effects sharing a timestamp."

**M1 — the oscillator source, as an instrument device.** "The field/PCM
owner docks as an **instrument device** in the rack (the played torus/field
as a device face with the proven aperture); the stage stays the instrument's
visible body." The landed face (`src/inhabitants/qlInstrumentDevice.tsx` +
`src/inhabitants/ql/qlInstrumentReading.ts`) binds the owner's real states,
never invented ones:

- standing: `manual | opening | following | held | unavailable`
  (controller.ts `NativeStatus`, verbatim);
- the identity tuple every native field frame carries (native-audio.mjs
  `IDENTITY`): `event_ref, subject_ref, registry_revision, geometry_ref,
  material_ref, model_ref`;
- exact u64 cursors (`acknowledged` and `presented`: `generation` +
  `samples_elapsed`);
- the audio receipt, schema `ql.native-audio-receipt/v1`, **rate-locked at
  48000 — "a 44100 receipt refuses"** (no implicit resampling);
- the launch contract rendered verbatim when no owner stands
  (`QL_LAUNCH_CONTRACT`): owner `ql-field-host (+ ql-field-worker)`;
  launcher "the kernel's native-expression owner (… compose → spawn)";
  bindings both-or-neither; and the shell's named gaps ("the shell host
  supplies no `oi.native-expression/v1` channel…", "the retained GPU field
  … must be live before compose", "the Tauri webview's AudioContext device
  path is unmeasured").

**M2 — modulation sources with `generates: false` in the type**
(`src/inhabitants/ql/qlModulationSources.ts`): "the first **native
modulation sources** of §14: the owner's audio/nodal readings
(audio_octet, nodal_quartet) as observables addressing device parameters
within declared scope; compiled relation plans before realtime execution;
never a second oscillator (D13)." The type-level form of D13:

```ts
/** D13: this observes the M1-source's reading; it generates nothing. */
readonly generates: false
```

"a module that claimed to generate from a source would have to assert a
type that does not exist. The only operation a source exposes is a read."
The twelve declared observables: `ql:m2/audio-octet/0..7` (Hz, from the
shared `m2.vimarsha.reading.audio_octet_hz`) and `ql:m2/nodal-quartet/0..3`
(mode-index voices with m/n + frequency_hz). Routes (`sourceId → typed §14
parameter address`, amount/polarity, transfer linear|log, scope instrument
| body | context | presentation) **compile to an immutable plan BEFORE
realtime execution**; compilation "refuses unknown source ids, targets
outside the declared scope, target addresses without a write path,
non-finite amounts, duplicate source→target pairs" (plus log transfers with
non-positive amounts). `evaluate()` is pure and "every effect names its
source — nothing moves without a visible cause" (§14's honesty law). No
route writes: "a route never writes — it proposes an effective value the
owning device applies through its own custody/receipt law." Declared scope
today: `quaternal-logic` family addresses only; widenings "are the family
owner's later declaration — compile refuses them today" (ledger §10 item 33).
(Fold seam note: the QL family manifest's `telemetry` is still `null` —
"nothing observable is exposed yet — honestly null",
`quaternalLogicFamilyManifest.ts:91` — while `qlModulationSources.ts`
declares the twelve observables; §5.8's recipe step 9's telemetry
declaration is the family owner's pending update, per §8's own law that
manifests change to match landed UI.)

**M3 — form and score as clip material.** "**score material in tracks and
clips** (the Timeline projection's grammar): articulation and form
sequences as clip material; body/form geometry stays the engine's visual
body — one state through the shared owner. The port ledger's take machinery
(record/replace/append) is the seed for performance recording. The
form→body preparation pipeline (versioned prepared bodies, off-thread
eigenstructure, crossfade/reinit policy) is #281's M3 packet — law today,
not landed" (§18). The #281 law beneath it (wayfinder §2.3): "The M3/
physical packet must implement the defined conversion from form to physical
body. Resolve topology/connectivity, geometry and scale, material, boundary
conditions, excitation locations and observation locations. A point cloud
or glyph identifier alone is not a complete membrane/plate/string/cavity
model."

**M4 — the body, unchanged law.** "the Expressions application is the body;
a declared world context, a personal Nara context and an explicitly shared
context are distinct admissible occasions over the same source definitions
(#281 §1.2) — in shell terms, per-context state over the encounter spine"
(§18; L5 dual-reading lock §11a).

**The realtime boundary** (wayfinder §2.5, law for everything above):
"Presentation stutter cannot stall the audio callback; external sky or
agent latency cannot become note latency. The realtime boundary excludes
allocation, blocking locks, graph/network access and UI work… Never query
the whole Bimba graph from the audio callback" (§2.2). Landed measurement:
the L9 realtime-gate record measured ≈47× scheduling headroom fixture-side
and **refused to claim the real owner** — the kernel's compose returned
`native-expression.unavailable: ql-field-host is not installed…` with the
exact repair named; "the refusal is itself the gate datum."

**What the shell does not do** (§18, the honesty boundary this chapter
inherits): "performance input (the six-row Jankó projection, polyphonic
pointer/keyboard/MIDI through one operation path), the full realtime voice
architecture, prepared-body versioning, composition/routing/export offices,
and the vendor recon: these belong to #281's nine commissioned packets and
their integrator. The shell prepares the host they dock into — admission as
the QL family's instrument faces, track adapters, transport coupling,
modulation routing, metering surfaces — and claims nothing sounding until
the owner lands it."

### 5.6 Standing — the epistemic chips and the never-upgrade law (C.6)

**The chip set** (Revision 2 of `WORLD-SHELL-DESIGN.md`, verbatim): clips
are "drawn in their epistemic standing (fact · claim · inferred ·
hypothesis · disputed · ghost), never upgraded by placement."

The laws in the landed code:

- `timeSpine.ts eventStanding()`: "Events read from the kernel's temporal
  read are readings of record → 'fact'. The spine never upgrades standing
  by placement (Revision 2 law); a future source may supply
  claim/inferred/hypothesis/disputed/ghost and the presentation keeps it."
- The World-cut presentation renders standing on every clip as a
  `data-standing` attribute and in every hover title
  (`worldTimelinePresentation.tsx`; clips carry `state: clip.standing ??
  'fact'`).
- The audio adapter: "The role and the standing travel with the label:
  placement never upgrades standing, and the classification is visible."
- `ghost` is the honest unresolved link: crosswalk lane-1:C1 ("Unresolved-
  link ghost nodes, rendered"); Revision 2: "ghosts for unresolved links."
- Uncertainty has its own presentation family in the crosswalk: lane-2 T2
  "Precision-honest placement and display", T3 "Uncertainty presentation
  (circa, disputed, mythic)", T4 "Deep time without fabrication", T5
  "Relative time for undated work (no fake dates)" — all landed in shape as
  the undated column ("undated · relative order") and the honest-absence
  disclosures.
- **The occasion's basis/admission split is the temporal form of the same
  honesty** (`timeSpine.ts`): "a selected occasion RETAINS its snapshot
  basis (the event exactly as read: instant, summary, evidence) and
  separately qualifies its CURRENT admission — standing in a retained time
  is honest only while the qualification says the material is still
  admitted. Basis and qualification never merge." The K8 sky contract is
  the source law: `retained-occasion` "requires an existing exact
  snapshot… it never rewrites the snapshot or attests fresh current sky";
  retained admission "always sets `fresh_current_attested=false`"
  (`K8-SKY-CONTRACT.md`).

**State vocabularies, named apart** *(12 Oct; VIS L-2, L15)*. Five
vocabularies name different axes; none upgrades or translates another:

| Vocabulary | Members | Source |
|---|---|---|
| Epistemic standing | fact · claim · inferred · hypothesis · disputed · ghost | `WORLD-SHELL-DESIGN.md:253-260` (Rev 2) |
| Save outcomes | saved · unchanged · stale · conflict · refused | `WORLD-SHELL-DESIGN.md:714-717` |
| Lamp and disclosure states | the lights law; Selected / Projected / Brokered / Observed effective / Adapter-inferred / Unknown / Withheld / Pending reload | `WIDGET-GUIDE.md:46-51`; `AGENTIC-CONVERGENCE.md:271-273` |
| Kernel write-back | DryRun · PendingReview · Applied · Rejected (`CanonWriteBackState`), not mapped to the shell | `SEEDS/INTEGRATED-4-5-0-RECOGNITION-ARCHITECTURE.md:344,351-356` |
| The contemplation's material states | proposed · landed · refused · in-progress · ghost | `CONT:52` |

The contemplation's list sits beside the others as a fourth shell-facing
vocabulary (**Tension**: a different axis, not a rival chip set). Render only
standings a producer actually supplies; unknown shows as unknown (ledger
item 35). QL already produces some standings of its own, e.g.
"calculated-ephemeris-not-observed-sky"
(`UI/inhabitants/quaternalLogicFamilyManifest.ts:40-45`). **Defect:** the
Technē frame's standing list omits `hypothesis` (`UI/shell/ModeCentre.tsx:86-92`
lists fact, claim, inferred, disputed, ghost) against the six-member chip set
above; register and repair it in the Technē lane.

### 5.7 The take machinery — the performance-recording seed (C.7)

The recording story is **declared, not claimed working**, and the
declaration is itself part of the ontology:

- The adapter contract admits `transport?: {takes: WorldTrackTake[]}` with
  the law: "Takes belong to the Transport stratum of the time spine. An
  adapter may expose them, but a take is never a clock and never a Timeline
  track."
- The Expressions adapter exposes the presented scene's property tracks as
  takes (the record-local-chosen-properties family, crosswalk "Session
  launch and recorded Arrangement occurrences").
- The QL audio adapter exposes `QlPerformanceTake {id, target, operation:
  'record' | 'replace' | 'append'}`, named on render: "Take record · … ·
  **performance-recording seed (owner pending, #281)**" — "declared, never
  claimed working (the honest boundary: realtime recording belongs to
  #281's packets)".
- The full record law is #281 §2.5: "Record the full relevant performance:
  note lifetimes and expression, tuning/source revisions,
  modulation/automation, body/form/force sequence, context changes, seeds,
  transport mapping and state needed for continuation. Persist through
  existing Expression/Scene/Edition and native owner services, not a second
  project or score store… Checkpoint semantics must state which physical
  trajectories replay exactly and which resume from a documented numerical
  state/tolerance; never claim an exact GPU rewind from a visual screenshot."

### 5.8 Constructing any new track type from the ontology (the builder's recipe) (C.8)

Everything a builder needs is in the pattern the landed adapters share.
The recipe, extracted:

1. **Name the family reading.** Define `T` — the family's own shape, read
   from its owner (never a copy: the adapter projects, nothing is stored).
2. **Choose columns and their units.** Columns are time blocks in the
   family's own units (civil days for temporal material; scenes for the
   Expressions family; composition passes for the QL family; epochs for the
   atlas). Decide the undated/honest-absence behaviour up front.
3. **Define tracks (lanes) with a discriminating `kind`.** The kind is the
   family's namespace (`ql-audio/resonator`,
   `ql-physics/visual-only`, `day`, `conversation`, `cron`); the
   presentation groups lanes by kind (`groupOfTrackKind` — new kinds need
   their group named there, or they fall into "Central · civil field",
   which a new family should not allow silently).
4. **Place clips with spans in the family's declared unit.** Carry the clip's
   standing verbatim in `state` and its role/law in `label` where
   sonic/physical. Refuse malformed input by naming the law (empty spans,
   wrong rates, miscast roles).
5. **If the material sounds or moves physically, classify the role in the
   type** (`QlSonicRole` + `QL_ROLE_LAWS`) and admit only the roles whose
   operative product the track honestly hosts; refuse the analyser to both
   tracks (metering's concern).
6. **Map across strata only through `QL_CLOCK_MAPPINGS`.** Same-family
   conversions may be declared rates; cross-stratum joints are measured
   anchors; M3 state moves by event, never interpolation. A conversion
   without a row is a bug, not an extension: add a declared row or refuse.
   (Fold note: the landed table lives in the QL family's own module —
   `qlSampleClock.ts:64-93`, `Object.freeze`d — so where a non-QL family
   declares its rows, in its own module through the same shape or by
   extending the QL table, is genuinely undecided; the one-ontology claim
   and the QL-owned table are not yet reconciled. Open for the family
   owners; no answer invented here.)
7. **Expose takes as transport material only**, named honestly (seed
   language until the recording owner lands).
8. **Register through a door.** Lane door (registration is the disclosure)
   to land; family door (manifest `projections[]` declared by the family's
   owner) to be admitted. The manifest is "authored by the family's native
   owner" (§12) — the shell's door is neutral, the keys are held by owners.
9. **Declare the family's `time` bindings** (§12 family manifest:
   "which time strata it consumes and which temporal material it
   contributes") and **`telemetry`** ("the observables it exposes as
   modulation sources") — time in, time out, observables out; one manifest,
   four surfaces (§16: "A family needing a fifth place is a design smell").

---

## 6. The driving model — how the user drives the system (P1 §5 + P3 Chapter D, merged)

The driving model is the operator's manual: how a person selects, moves,
stands in time, searches, discloses, and returns. Everything below is
extracted from the design's named spine, the landed mode grammar, the
encounter bridge, and the mockups' recorded decisions.

### 6.1 The spine: mode × world-context × kernel epoch — the only selection/navigation

`WORLD-SHELL-DESIGN.md` §2: "No second selection or navigation model is
introduced. The shell's de-facto tripartite state machine is the spine, and
the design names it:"

1. **Mode** — the shell's `ShellMode` (`audio | base | factory |
   expressions | techne | settings` — six-valued at the landed line,
   corrected at the grill fold, `src/continuity/workspace.tsx:15`) over the
   cradle's
   `WorkspaceMode` (`base | factory | expressions | techne | epi-logos |
   settings`, `cradle/src/workspace/mode.ts:23`), "each mode carrying its
   own layout tree (`modeLayouts`), with the standing rule that **a mode
   never closes surfaces**." (The new shell's landed surf grammar is
   `SURF_MODES` = live · base · factory · expressions · techne,
   `shell/modeGrammar.ts:31-33`.)
2. **World context** — the workspace book's `WorldContext`
   (`world: central | epi-logos`, subject, reading, trail;
   `cradle/src/workspace/store.ts`): "This is the encounter: what is
   selected, of which world, with what reading, and where you have been" —
   "plus project navigation and recent places."
3. **Kernel epoch** — "transport status and `accessEpoch`/`accessReady`
   generation bumping, which retires stale callbacks and gates every read on
   the current connection" (`WORLD-SHELL-DESIGN.md:324-345`, §2).

"Every projection instance and every device reads the encounter from this
spine; selection changes propagate as encounter transitions, not as per-view
state." Landed: `projections/encounterBridge.ts` (epoch-guarded; transitions
through `book.setContext` as the one owner) — L1.

**The encounter address and the one transition** (landed contract,
`cradle/src/workspace/encounter.ts`): an `EncounterAddress` is
`{arrangement, projection, subject?, aperture, viewAs, occasion?}` where
arrangement ∈ base|factory|expressions|techne|epi-logos|settings,
projection ∈ earth|timeline|constellation|expressions, aperture ∈
world|local|shared|federated, viewAs ∈ me|field|public. `encounter()` is
"the only transition. Any axis may change; **the subject is kept unless
explicitly replaced — switching arrangement or projection never loses what
you were looking at.** The trail grows by one on every transition."

**The Atlas independently converged on the same shape** (no second selection
store): "its five-state machine (World · Focus · Manifestation · Thread ·
Deep) maps directly: World = projection overview, Focus = selection
(encounter.subject), Manifestation = an Expression opened, Thread = the
trail, Deep = full device edit. Its hash router… is the model for linkable
encounters" (`WORLD-SHELL-DESIGN.md:345-352`).

**Three spines, named apart** *(12 Oct; VIS §2.4, §6 WORDS)*. "Spine" names
three different things in the sources; keep them apart:

1. the **time spine** — the five strata of §5.4 (`timeSpine.ts`);
2. the **navigation spine** — mode × world-context × kernel epoch, this
   section (`WORLD-SHELL-DESIGN.md:324-345`);
3. the **encounter spine** — `encounter()` and the Trail
   (`cradle/src/workspace/encounter.ts:61-89`; §6.4).

**Three senses of "projection"**: the design's four projections (Earth,
Timeline, Constellation, Expressions; `WORLD-SHELL-DESIGN.md:299-310`);
shared-field projection, a World's material made visible to a field
(`WORLD-SHELL-DESIGN.md:237-239`); and glyph projection, the Expressions
medium (`CONT:120`). **Open:** whether mode × world × epoch (§2,
`WORLD-SHELL-DESIGN.md:326-345`) and Rev 2's arrangement × projection ×
device (`WORLD-SHELL-DESIGN.md:223-226`) are one axis set or two; no source
reconciles them.

**Porous modes** *(12 Oct; VIS §2.4)*. "This bleeding is the point. Live is
not five apps sharing a file format… They are one environment, read in modes
that slip into each other as the work demands" (`CONT:169`). The owner's
account is of material becoming material in another mode: a Central reading
becomes a Factory commission's source; a live cymatic sweep in Expressions
becomes a Journey phrase; a Technē Palace composition becomes a return to
Central's wiki as a proposal (`CONT:167`).

- **Carriers, Grounded:** commissions from a reading
  (`WORLD-SHELL-DESIGN.md:566-568`); Journey ↔ Expression Scenes
  (`LOCK:465`; `TDR:341,365`); the Palace Return as an attributable proposal
  (`APPB:72-76`). **Inferred:** each crossing is an act that keeps the
  material's origin ref — origin-return run forward.
- **Built mechanisms:** `chooseMode` is one transition; it sets world and
  mode, keeps the context and closes no surface (`APP:257-264`); Live and
  Expressions share the centre residence `world.expressions` (`APP:261`).
  The transport keeps its slots in place while meanings change.
  `BRIDGE.transition` writes subject and occasion as "Refs and titles only —
  never content" (`BRIDGE:74-96`); the one-field identity law preserves
  subject_ref, revision, constellation, ActionRefs and AgentSession
  (`TDR:77-96`). The cut switch crosses between Technē and Expressions.
- **The act's discipline:** "selection != disclosure; visible Action !=
  authorised invocation" (`TDR:324-329`). A crossing never sends, discloses
  or launches by itself (`EXP/FACTORY-AGENCY.md:42,102`).
- **Gaps:** none of the three crossings is wired
  (`WORLD-SHELL-DESIGN.md:566-568`; `GRAM:395,467`). No trail stop is
  written (`BRIDGE:48,74-96`); the Trail tile shows only the current subject
  (`DOCK:199-204`; ledger item 28). Leaving Central drops the world context
  (`APP:259`; ledger item 44). The one enacted drill-through (Expression →
  Technē → Central source) is in the legacy cradle
  (`CRADLE/CradleFrame.tsx:1012-1026`). Implicit shifts — `openCenterPanel`
  forces factory or expressions (`APP:327-338`) — follow no stated trigger
  rule. **Conflict, two trail shapes:** the store's `TrailStop {mode,
  surfaceRef, surfaceKind, label, position}` with `TRAIL_LIMIT = 24`
  (`STORE:61,68`) against the encounter's `{address, at}`, unbounded
  (`ENC:61-63,85`); the bridge carries the store shape (`BRIDGE:7,48`).

### 6.2 The transport: one transport, five meanings

Revision 5's law: "**Every mode keeps the same transport slots in the same
places.** Only their meaning changes." Landed as typed data in
`src/shell/modeGrammar.ts` — `TRANSPORT_SLOT_IDS` fixes **28** slots (link, tap,
tempo, signature, metro, quantize, key, root, scale, follow, position, play,
stop, record, overdub, arm, re-enable, capture, punch-in, loop, punch-out,
loop-length, draw, keys, key-map, midi-map, rate, cpu), and each of the five
surf modes (`live`, `base`, `factory`, `expressions`, `techne`) carries a
full `SlotMeaning {label, fn}` for every slot. The module header states the
mapping discipline: "the frame reads the grammar, the grammar holds no view
and no store"; a missing slot meaning "is a programming fault, named"
(`slotMeaning` throws).

The mode → spine mapping (modeGrammar header): "a mode switch is an
encounter transition over mode × WorldContext × accessEpoch, never a second
store": live → "the shell's audio cut (book mode `base`, the music
presentation)"; base → book mode `base` + `WorldContext.world = 'central'`
— "the design's §6 resolution: Central is a world context, not a separate
mode"; factory/expressions/techne → their book modes.

The five meanings of the headline slots (Revision 5 table, confirmed in the
grammar):

| Slot (Live) | Base · Central | Factory | Expressions | Technē |
|---|---|---|---|---|
| Link · Tap | ground sync · stamp Now into the document | peers · ping agents | field sync · tap tempo | field carrier · **back to Now** |
| tempo · signature | die face (‹ › turns it) · 4+2 | effort · budget | field tempo · 5:3 ratio | walk pace · stop n/8 |
| key / scale | packet token count | tokens in · out | ☿ resonance key | **aperture · view as** |
| ▶ ■ ● + | **Answer** (send the packet) · stop · dictate · append/replace | run · stop all · voice · steer | play scenes · stop · capture take · layer | walk · stop · record walk · extend |
| punch · loop | day opened 08:30 · close routine · 21:00 | write window · routine | scene loop | **occasion window** |
| draw · rate · cpu | highlight pen · carrier · save state | point · throughput · context | draw form · fps · GPU | place tool · carrier · projected % |

Each arrangement also re-means the two presentation icons (Revision 5,
second table in §4: what Session and Arrangement show per mode) and the
Clip | Device detail pair (Revision 4: Base → Document | Devices; Factory →
Task log | Agent chain; Expressions → Scene | Studio; Technē → Clip |
Instruments, the six Technē instruments).

The **honesty law for waiting controls** is in the grammar:
`waitingNote` per mode — e.g. Live: "The audio engine's transport is
read-only until its owner lands; the field holds its place."

### 6.3 The three temporal controls over the five strata

§8: "Two clocks, one typed bridge — the lane-6 two-clock doctrine stands…
the shell offers three deliberate temporal controls, linkable but
independent":

- **Now** — "the situated civil field (the Atlas's shared bottom clock
  generalised; drives Earth and Timeline alike)." Landed chip in the World
  cut with its disclosure verbatim: "The situated civil field: the
  reading's own newest instant and day. It drives Earth and Timeline alike
  — never the wall clock."
- **Occasion** — "a selected or retained event's time (the K8 sky
  contract's retained-occasion behaviour: reopening an exact saved occasion
  keeps its snapshot and separately qualifies current admission)." Landed
  chip: "Its basis is kept exactly as first read; current admission is a
  separate qualification," with the admission light
  (admitted / no-longer-in-the-reading / unqualified).
- **Transport** — "the Timeline projection's playhead over performable
  material (`WORLD-SHELL-DESIGN.md:577-596`, §8; landed as
  `timeline/timeSpine.ts`; sequence clocks family; the M3 clock device
  exposes inscription/lens circles)." Landed chip: "It moves over clips and
  drives nothing else — no shell timer is a clock."

In the world mockup the same three controls appear in Technē as the
Now/Occasion/Walk segment — "which clock drives the panes" (Revision 2
transport mapping: "Now/Occasion/Walk → which clock drives the panes") —
and every mode's transport `position` slot re-means to its own driving
clock (Live "bars . beats . sixteenths"; Base "the day's civil instant";
Expressions "seconds within the working scene"; Technē "the driving clock's
value"; Factory "task . turn . step").

The five strata beneath (chronos · civil · cron · transport · occasion) are
§5.4. **The time strata are locked at the top, bound from below** — owner
words (`[session]`, carried at `WORLD-SHELL-DESIGN.md:801-806`): "also
consider the cron and chronos level integration, as time is locked in at a
higher level (global time functions, kerykeion, day/now levels etc)."
The user-facing rule: the controls are the faces of strata 2, 5 and 4;
chronos and cron "are the deeper platform strata" — bound from below by
families, never forked.

### 6.4 The Trail — every encounter kept and returned to

Three landed registers of the same idea, at different scopes:

1. **The design** (Revision 2): "`encounter()` is the only transition; the
   Trail tile keeps every encounter and returns to it." The encounter
   bridge types it: `Trail = readonly TrailEntry[]`, "bounded by the
   caller's retention law, not by this module"; `encounter()` appends on
   **every** transition, including subject changes.
2. **The cradle's working trail** (`cradle/src/workspace/store.ts`):
   `WorldContext.trail: TrailStop[]` bounded at `TRAIL_LIMIT = 24`; a stop
   is `{mode, surfaceRef?, surfaceKind?, label, position?}` — "**Refs and
   positions only — never content, never an authority reading.**" The
   drill-through law, verbatim: "each drill-through records where it came
   from so 'return' lands on the same mode, surface and reading position."
   The **return is implemented** (`CradleFrame.tsx`): leave() pushes a stop
   on every cross-mode open (expression, examine, source, knowledge); back()
   "pop[s] the newest stop, stand[s] in its mode, hand[s] the place back to
   its surface" — restoring the exact reading position via `oi:epi-return`
   for Epi-Logos places. The world hops freely across the trail: "The world
   selected on entering Epi-Logos is untouched by these hops: examining in
   Technè is still within Epi-Logos."
3. **The shell-side gap, honestly recorded** (`EXPRESSIONS-ENCOUNTER-SPINE.md`
   finding 6): "Trail is not built. Nothing in the live shell reads or
   writes a trail" — the live-shell UI (the new shell's native content
   area) has no trail store yet; the design's Trail tile is unbuilt there.
   OPEN-QUESTION (ledger §10 item 28).

### 6.5 Search and the aperture — World · Local · Shared · Federated

Revision 2: "**Aperture** (transport): World · Local · Shared · Federated.
Search, Earth, Constellation and Timeline all admit the same; **results
beyond the aperture are counted and offered** ('＋ 2 more beyond the
aperture — widen')."

The mockup's exact definitions (`world-shell-mockup.html` `APERTURE`,
quoted verbatim):

- **World** — "Only your World: your planet and what it holds."
- **Local** — "Your local field: your World plus the project and agent
  worlds it contains — the local carrier."
- **Shared** — "The shared field: other participants' Worlds become visible
  — only what they have projected."
- **Federated** — "Federated fields too: fields your fields are joined to,
  at one more remove."

Admission is a typed predicate (`worldAdmitted(w, ap)`: own always; project
worlds at Local+; shared at Shared+; federated at Federated), the status bar
reads it back ("aperture shared · 4 panes"), and narrowing shows the fog
message: "Aperture **X** — other Worlds are outside it." **Landed/unbuilt
mark (grill fold, 2026-10-10): the admission law just stated is mockup-spec,
not shell behavior — `worldAdmitted(w, ap)` exists only in
`world-shell-mockup.html:509`; no cradle or shell src implements the
predicate, the beyond-aperture counting, or the fog rendering. The landed
cradle carries the `Aperture` *type* (`encounter.ts`) and nothing further of
this mechanism.** The landed contract does carry aperture as a first-class
axis of the encounter address
(`encounter.ts`; decodeable from `?ap=N`), and the aperture slot under the
browser is where "the focused pane's context and view controls live"
(Revision 3: "Field · World · Subject · Occasion, the view's own controls
(scale, lens, document view), and the pane layout").

### 6.6 View-as and the projection fog

Revision 2: "**View as** (where Live has key/scale): me · field · public.
Your planet fogs everything not projected; the rack's Projection device
shows the disclosure ladder; **raising an audience always asks first**."

Mechanics landed **in the mockup HTML fixture only** (mockup-spec, not shell
behavior — the visibility predicate and fog rendering have no cradle or shell
src implementation; grill fold 2026-10-10): view-as cycles me → field → public; the
visibility predicate is projection-thresholded (`visibleAs`: at `field` a
thing shows if its projection level ≥ 5, at `public` ≥ 6); the fog is
rendered honestly — dimmed overlays over unprojected regions, and fog
messages that name the state: "Your body as the **field** sees it — only
projected locations remain"; a visited World's body reads "read-only: you
see what X has projected"; the private palace room is "fog to every
audience" ("not projected" drawn inside the room). The Technē transport
slots carry the grammar (root = aperture, scale = view as, key = "aperture ·
view as — me · field · public — your World fogs everything not projected;
raising an audience always asks first").

The disclosure ladder's device-level form (§5/§12 + Revision 2): "the
rack's Projection device shows the disclosure ladder" — the same honesty in
device form: nothing is visible to an audience that was not projected, and
raising the audience is an explicit asked act, never a silent default.

### 6.7 Keyboard and pointer grammar

The grammar is per-mode and declared in the transport slots themselves:

- **keys** — Live: "play the set from the computer keyboard"; Base:
  "keys for the document's controls"; Factory: "number keys launch task
  rows; letters fire rack macros"; Expressions/Technē: "keys for the
  field's/lens's controls."
- **key-map** — "bind computer keys to controls" (Factory's example is a
  spoken phrase: "Fizz, retry").
- **midi-map** — "bind MIDI controls" / "bind a pad or spoken phrase to any
  control."
- The world mockup's global keys (landed in its keydown handler): **space
  toggles play; keys 1–4 switch arrangement** — with the guard "if
  e.target.tagName==='INPUT' return" (never hijack typing).
- The `data-i="Name|Function"` tooltip law carries the same grammar on
  hover — every control names itself and its function (WIDGET-GUIDE /
  agent-shell standard; the F2 law "Name|Function text" is implemented in
  `slotDataI`).
- Gesture-focus law (#281 §3.3): "Avoid accidental piano keystrokes while
  typing in an editor… Implement explicit gesture focus so editing text does
  not trigger notes." At ~700 px the study requires "keyboard access to
  chain traversal" (`UI-UX-CONVERGENCE-STUDY.md`).
- Pointer grammar: panes are split trees (drag a tab onto a pane's centre to
  move it, onto its edge to snap a new split — Revision 4); a view "opens as
  a tab on the pane's auto-hidden left rail, and ⇧ splits" (Revision 3);
  browser rows open beside or pop out (10-SIDEBARS A6); a mode's canvas law
  (owner, 2026-09-19, CradleFrame comment): "an open asked from the sidebar
  canvas lands THERE… never behind the mode's dedicated stage."

### 6.8 The system's response laws (eight)

1. **A mode never closes surfaces.** `cradle/src/workspace/mode.ts`
   header: "Switching modes never closes surfaces, never restarts an
   encounter session and never touches the window's one Expression stage:
   open work, splits, widths and the accompanying binding all ride
   through." Per-mode trees wait unmounted in `modeLayouts` ("A mode with
   no saved tree opens on its MODE_CURATION default").
2. **Panes retain.** "Hidden-inhabitant retention stays: projections keep
   mounting while hidden (`App.tsx:124-134`), so returning to a pane
   restores its actual camera, selection and temporal state" (§4); retained
   bodies stay mounted per pane (`Workbench.tsx:460-463`); the retention
   warm set keeps recently visited workspaces' trees alive
   (`store.ts` `lastVisitedAt` + `surface/retention.tsx`).
3. **Every transition is an encounter transition.** `encounter()` is the
   only transition; subject survives any axis change; the trail grows by
   one; the encounter is linkable (`decodeEncounter`; the mockup's
   `?mode=techne&lens=M4&scale=body&body=earth&ap=3`,
   `?mode=base&doc=thing&layout=solo` (Rev 3),
   `?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`
   (Rev 2)).
4. **Panes follow the encounter unless pinned** (Revision 3; the transport
   `follow` slot re-means per mode: "views follow the scene/day's Now/panes
   follow the encounter/arrangement scrolls with playback").
5. **Three levels of disclosure** (`UI-UX-CONVERGENCE-STUDY.md`): compact/
   perform → configure → deep edit; "Deep editing replaces the center
   presentation and returns to the same selection/view… The first expanded
   path must keep the same retained instance and draft."
6. **Custody on every write** (§5, landed): "writes are same-basis,
   single-flight, with retained drafts and explicit Apply/Discard/Retry";
   "Stale replies never commit to changed target, uncommitted human input
   retained" (crosswalk gesture-state family).
7. **Modulation honesty** (§14): "every modulated parameter shows its
   modulator (Live colours the modulated knob)… nothing moves without a
   visible cause."
8. **The designed empty state** (modeGrammar `state: 'waiting'` +
   `centre` compositions): an unreadable presentation renders "a DESIGNED
   surface, never a bare sentence in a void," and a waiting category "names
   its owner, never another mode's content."

**Multi-select caveat (honest).** The spine's selection is today a
projection of one owner-side array with a one-at-a-time write path; two
"selected object" rules split (exactly-one vs first-id) and need an owner
ruling (`EXPRESSIONS-ENCOUNTER-SPINE.md:9-15, 120-158`). → ledger §10
item 4.

### 6.9 The operator's walk (the end-to-end step list)

The whole product, driven from one seat (each step cites its law above):

1. **Arrive** — the shell boots into a mode with its saved pane tree;
   the encounter (subject, reading, trail) survives reload
   (response law 1–2; `WorldContext` persisted).
2. **Select** — the spine's selection: click material in a browser
   category or a pane; selection propagates as an encounter transition;
   every pane/device reads it (§6.1).
3. **Orient in time** — the three temporal controls: Now is where you
   stand; select an event to retain an Occasion (its basis is kept,
   admission qualified separately); press ▶ to move the Transport over
   performable clips (§6.3).
4. **Search** — the palette (⌘K, typed tabs) and browser categories filter
   the selected category; results answer at the current **aperture**;
   beyond-aperture hits are counted and offered — widen deliberately (§6.5).
5. **Disclose** — flip **View as** to see your World as field or public
   sees it; the fog shows exactly what is projected; raising an audience
   asks first (§6.6).
6. **Compose the view** — panes split (⇧, drag), each pane holds a
   projection of the same encounter; the focused pane's rack is the bottom
   detail; Clip|Device re-mean per arrangement (§6.2, §6.8).
7. **Act** — devices apply through the custody aperture (draft retained,
   same-basis write, Apply/Discard/Retry); modulated parameters show their
   modulators; writes land through declared owner operations with receipts
   (aperture law, MAP.md).
8. **Perform (music)** — in Live: play, record takes (record/replace/
   append — the seed machinery), the sample clock driving work-time with
   declared mappings only; in Expressions/Technē the same transport slots
   walk scenes and journeys (§5.5, §5.7, §6.2).
9. **Return** — every hop left a trail stop; back pops the newest and
   restores mode, surface and reading position; the Trail tile keeps every
   encounter (§6.4).
10. **Leave** — the mode stands where it stood; surfaces stay; nothing is
    closed by switching (response law 1); the day (civil stratum) is
    closed by its own owner's routine — never by the transport
    (`M-PRIME…WORK-PACKETS.md` §9-C: "Transport state never silently
    overwrites civil Day").

---

## 7. Epi-Logos — the lens / world-context, not a mode (P1 §4 + P3 Chapter E, merged)

**The ruling, forward:** Epi-Logos is **a lens/world-context, not a mode**
(owner ruling D2 + amendment A5, 2026-09-18; the cradle's `WorkspaceMode`
`"epi-logos"` enum value is a refused seam). The sources hold **three
distinct registers** that must never be conflated; what the *new shell*
owes each register is ledger §10 items 2–3. *(12 Oct)* Item 2 is closed by
the owner's ruling, "Epi-Logos a lens, not a mode (standing ruling D2/A5)"
(`CONT:252`), answer (a); item 3 is partly answered (§7.6).

### 7.1 The three registers, precisely (P3 E.1)

**Register 1 — the WorkspaceMode value.** `cradle/src/workspace/mode.ts:23`:

```ts
export type WorkspaceMode = "base" | "factory" | "expressions" | "techne" | "epi-logos" | "settings";
```

Its curation (`MODE_CURATION["epi-logos"]`), verbatim: label "Epi-Logos";
hint "**The authored world: the essay, Bimba, the Epii material, the
products**"; glyph `wiki`; left body `epi-places`; centreKind `epi-logos`;
panel planes `Chat, Activity, Agents, context`. The comment: "Nara/Anima is
the personal encounter, Epii the deep inquiry — the same companion
components, curated to this world."

But the mode switch **refuses it**: `TREE_MODES` filters epi-logos out, and
`switchWorkspaceMode` returns unchanged unless `TREE_MODES.includes(next)`.
The owner's ruling stands above it (mode.ts comment, verbatim): "Owner
ruling 2026-09-18: Epi-Logos is NOT a mode entry — it is a whole-app world
state (the workspace world context, `context.world`, displayed and toggled
in the workspace footer). Settings is the terminal system entry and switches
instantly like any other mode."

**Register 2 — the world context.** `cradle/src/workspace/store.ts`:

```ts
export type WorldRef = "central" | "epi-logos";
```

with the law in its comment, verbatim: "The selected world is independent
of the arrangement: entering Epi-Logos selects its world, and examining one
of its Expressions in Technè or opening its source in Base is **still
within Epi-Logos until the person leaves it**. `trail` is the route back."
Entering is one write (`enterEpiWorld` — it lives in
`CradleFrame.tsx:1902`, bound to the lens writer at :1912, not in
`store.ts` — and sets `context.world = "epi-logos"` through `setContext`;
`switchWorkspaceMode` (`store.ts:128-139`) also sets it if ever invoked with
the mode value — a branch the `TREE_MODES` guard returns before for
`'epi-logos'`);
leaving clears it. The comment at the write site: "context is the ONE owner
of 'which world am I in' — the footer and the lens both read the
publication derived from it below, so nothing can disagree with it."

**Register 3 — the lens.** `cradle/src/workspace/lens.ts`, header verbatim:

> "THE EPI-LOGOS LENS (10-SIDEBARS §3.1, ruling D2, amendment A5): a lens,
> not a mode. Its toggle lives at the end of the hidden window footer; while
> it is on, the head shows an 'Epi-Logos' chip with × to leave, the file
> trees show the corpus instead of the scope's files, context sources narrow
> to the corpus, and Nara joins the right panel's agent menu. It opens no
> surface and never changes the mode or the scope. Turning it off restores
> the trees exactly as they were."

`EPI_CORPUS_PROJECT = "epi"` — "The Work project whose file system is the
corpus root while the lens is on." The lens is published **from** the world
context (`publishLens(context?.world === "epi-logos")`), never held
elsewhere.

### 7.2 The owner's recorded decisions, verbatim (P3 E.2)

- **Ruling D2** (10-SIDEBARS §7, 22 Sep 2026): *"a mode in the footer, very
  minimal button … meant to just focus the corpus via the file system …
  rather than being locked to one page/surface."* The document's
  gloss: "It is a lens toggle (§3.1)."
- **Amendment A5** (23 Sep 2026): "Epi-Logos lives in the hidden window
  footer, not the mode bar."
- **10-SIDEBARS §3.1**, verbatim: "**Epi-Logos is a lens, not a mode**
  *(Ruling D2)*. The minimal toggle re-roots the file system on the
  Epi-Logos corpus while you stay in whatever mode you are in; nothing
  locks you to one page or surface. While it is on, the head shows an
  **Epi-Logos** chip beside the scope with × to leave, the file trees show
  the corpus, context sources narrow to the corpus (§3.7), and Nara joins
  the right panel's agent menu. Turning it off restores the trees exactly
  as they were."
- **The audit's replacement record** (10-SIDEBARS §6): "The Epi-Logos
  toggle opens a surface into a hidden tree in the full-page modes → **As a
  lens it re-roots the file trees instead (§3.1) and opens no surface**";
  footer toggle disposition: "**Keep**, minimal, in the hidden window
  footer (A5), as the lens toggle; it re-roots file trees instead of
  opening a surface."

### 7.3 What exists in code and records (P1 §4 corpus + P3 E.3, deduplicated)

- **The E2 entrance, landed 2026-09-18**: "Epi-Logos sixth entrance binds the
  world; context retains across arrangements; leaving is explicit… footer
  'Enter the Epi-Logos world' → binds world + opens the curated Epi surface;
  'Within Epi-Logos' chip with explicit Leave in every arrangement… the
  context (with return trail) lives in the workspace, not the mode —
  switching arrangements cannot lose it"
  (`Work/O-I/docs/experience/UI-FUNCTION-LANDING.md:41`).
- **Retention through the portal park**: "mode centres retained through a
  portal park (expressions/techne/epi-logos/system)"
  (`UI-FUNCTION-LANDING.md:77`).
- **The running app's own words**: footer toggle (`DesktopShell.tsx:409`):
  `aria-label="Epi-Logos lens"`; title when on: "**The Epi-Logos lens is
  on — turn it off**"; when off: "**Turn on the Epi-Logos lens: the file
  trees show the corpus**". Head chip (`LeftFrame.tsx:130-132`):
  `aria-label="Epi-Logos lens is on"`, visible whenever the lens is on
  "even with the footer hidden"; its close control:
  `aria-label="Leave the Epi-Logos lens"`. The avatar/utility menu
  (`field/Utility.tsx:79`): item "Epi-Logos", description "The Epi-Logos
  world: the essay, its Expressions and practices".
- **The agent-composition register (the mode-button semantics, owner
  commission 22 September 2026, `Work/O-I/docs/experience/EPI-LOGOS-AGENT-MODE.md`)**:
  "In both **Expressions** and **Technē**, the existing **Epi-Logos mode
  button** selects the source-owned **Prime–QL agent/body composition as
  the default option** for the mode's agent. The selected subject, source,
  scene and work remain themselves. The change is the operative
  intelligence available to engage them." S4′ is Anima, S5′ is Aletheia;
  Nara is M4/M4′; Epii is M5/M5′. Honest activation law: "Distinguish
  selected, resolved, delivered and actually invoked. A control being
  highlighted… does not establish activation… No silent fallback to a
  generic agent while displaying active Epi-Logos intelligence."
  The world's constituted agent persists across modes while
  `world === "epi-logos"`: "The Epi world keeps its constituted agent while
  the person moves between [modes]… Merely entering Expressions or Technē
  outside that world does not [reset the agent]" (`agentBody.ts`).
- **The QL integration corpus** (`Work/Quaternal-Logic/docs/integrations/epi-logos/`):
  `EPI-LOGOS-AGENT-ARCHITECTURE.md` (the `#0/1` containing Prime–QL body with
  explicit #0 and #1–#5 faculties), `EPI-CAPABILITY-MATRIX-FIELD-INDEX.md`
  (the 185-obligation field index; "One Earth/observer occasion through M1
  geometry, M2 resonance/material and M3 clocks/form, personally received at
  canonical M4.4.4.4 Personal Pratibimba, remains the commissioned whole"),
  the ta-onta / Vāk / AW0 locks, and the registered capability matrices
  (§8). The elaboration that exists lives here and in
  `EPI-LOGOS-DEVELOPMENT-WAYFINDER.md`, `EPI-LOGOS-SOURCE-OF-TRUTH.md` and
  the #201/#135/#220/#65 execution chain — the master planning session's
  extracted chunks contain none (coordinator-confirmed).
- **The wider identity**: the owner's endpoint phrase "the complete
  Epi-Logos working world" (`ASTRA-BRIEF.md`), and the AIKit/agency/nara
  stack the shell binds ("canonical CAS stays in AIKit; the shell binds via
  `oi.nara-dialogue-binding/v1`", `WORLD-SHELL-DESIGN.md:512-515`).

### 7.4 The surface: four families and the threshold (P3 E.4)

The centre surface (`cradle/src/epilogos/EpiLogosSurface.tsx`,
header verbatim): "a **deliberately authored threshold** into four distinct
receiving families, never a settings page and never a raw graph."

The four doorways (verbatim):

| Family | Title | Line |
|---|---|---|
| `essay` | The essay | "Return of Zero — a corpus held outside this app." |
| `bimba` | Bimba | "The philosophical map, read live wherever a source discloses it." |
| `epii` | Epii · the Antichrist material | "The M5-1 essay and its vault, held outside this app." |
| `products` | The products | "The S field — Central's own projects and their wikis." |

Three compositions: no place open → the threshold ("four doorways, each its
own live standing (available / partial / not connected)"); a family entered
→ "that family's entrances (or its unavailable reason)"; a place open →
"the reading view: canonical body, then — **kept structurally separate** —
visitor annotations and a **receiving-only** Nara panel."

The receiving discipline (`cradle/src/epilogos/sources.ts`, header): "one
per family, never merged. Each family… keeps its own standing, its own
entrances and its own reading model; nothing here builds a combined list or
a local graph. A family with no owner operation yet still has a registered
adapter — it just discloses `unavailable` **with the owner's own words** and
who supplies it." A reading carries `sourceRef` + `sourceRevision`
"carried verbatim, never invented when a producer does not supply one."
Essay and Epii are landed as `receiving-only` adapters. Reading position
per place is a per-viewer convenience in localStorage, "never sent
anywhere" (`places.ts`). The left navigator (four family sections,
↑/↓/Enter) and the surface share the open place through one external store
— "not a prop, not context."

Annotations are the visitor's own (`annotations.ts` via
`getEpiAnnotation/setEpiAnnotation/removeEpiAnnotation`) and are rendered
structurally apart from the canonical body.

### 7.5 How it relates to the five modes (P3 E.5)

The sources give four precise relations, and they are consistent:

1. **It is the ground a person stands in, not a sibling of the modes.**
   The world context rides *through* mode switches: "examining one of its
   Expressions in Technè or opening its source in Base is still within
   Epi-Logos until the person leaves it" (store.ts). It is closer to the
   spine's second register than to the first.
2. **The lens overlays any mode.** "while you stay in whatever mode you are
   in; nothing locks you to one page or surface" (10-SIDEBARS §3.1). The
   lens table renders one row: "Epi-Logos lens (any mode) | The corpus
   files only, laid over the current mode's slice."
3. **In the new shell's five-mode grammar it does not appear.**
   `src/shell/modeGrammar.ts` `SURF_MODES` = live · base · factory ·
   expressions · techne; `FrameMode` and the continuity store's `ShellMode`
   (`src/continuity/workspace.tsx:15`) carry no epi-logos. But the cradle's
   arrangement grammar does (`encounter.ts`: `Arrangement` includes
   'epi-logos'), and the surface registry admits an `epi-logos` surface
   kind (`FRAME_DISCLOSED_KINDS`). The two shells currently answer the
   question differently — ledger §10 item 2, closed 12 Oct by the ruling
   (answer (a)): the new shell's grammar is right to carry no epi-logos
   mode.
4. **Its material still projects through the four projections.** By §6's
   resolution pattern (Central "is one World context whose material
   projects through the same four projections and inhabits the same rack"),
   the Epi-Logos world's material — essay passages, Bimba readings, the
   products — has native Expression bindings (`expressionRef` on entrances
   and readings) and would summon into Expressions/Technè exactly as the
   drill-through law records (`CradleFrame.tsx`: leave-reading trail →
   enterMode → summonExpression; back → `oi:epi-return` restores the exact
   passage).

**What the sources do NOT say** (honest gaps): no source defines an
"Epi-Logos mode" for the DLW shell's mode rail; no source binds the
Epi-Logos world to a projection of its own; no source describes its
transport re-meaning; and nothing found states whether the world context
should appear in the new shell's `WorldContext` (which today types only
`'central' | 'epi-logos'` — the cradle type) or how the lens maps onto the
new shell's chrome. The commission's suggestion that the five modes might
stand *in* Epi-Logos as ground is supported only by the world-context law
above (register 2), not by any mode-grammar statement.

**Known vs open.** Known (all cited above): the three registers and their
owners; the D2/A5 rulings; the corpus re-rooting behaviour and its exact
restore; the four families and their receiving discipline; the threshold
surface's composition; Nara's conditional admission; the constituted
agent's persistence across the world; the drill-through + `oi:epi-return`
passage restoration; the surface kind's existence in the registry; and,
from 12 Oct, the ruling that Epi-Logos is a lens, not a mode (`CONT:252`).
Open: ledger §10 items 3 (partly answered), 27, 29.

### 7.6 The native game, the owner's register and the four kernel senses *(12 Oct; VIS §0 item 2, §1.1)*

- **The native game.** "Epi-Logos is not just the project's name. It is the
  *native game* — the game the DLW exists to let any player play"
  (`CONT:14`); "the corpus made playable… the reflective turn — language
  operating on language — as a total environment" (`CONT:198`). The station
  it names is "where language sees itself — the word upon the word"
  (`CONT:16`), which fits M5-5, "where logos examines logos itself"
  (`BMAP/M5/M5-5/M5-5.md:23`); that the project is "named for that turn" is
  the owner's naming, not a kernel statement.
- **The owner's register** (`CONT:18`): the corpus — "the essay, QL/MEF,
  Bimba, M/M′, Vāk, Ta-Onta, Nara, Epii, the Covenant" — is the **esoteric
  identity**; the system (the paradigm-neutral substrate, the six products,
  the DLW shell) is the **exoteric identity**; the mode is the projection of
  the one over the other, "bimba over pratibimba". Epi-Logos is "a
  philosophical project" (owner clarification of 11 Oct, as the study
  records it, `GBG/README.md:23-24`; `PRAX:50-51`).
- **Lens, not mode — the ruling beside D2's earlier wording.** D2 (22 Sep)
  spoke of "a mode in the footer, very minimal button… meant to just focus
  the corpus" (§7.2); the 12 Oct ruling reads "Epi-Logos a lens, not a mode
  (standing ruling D2/A5)" (`CONT:252`), naming D2/A5 itself as the standing
  ruling, as the cradle already enforces (`MODE:135-139`). That the later
  wording governs is **Inferred** from the `PROGRAMME.md:14-15` precedent.
  No Epi-Logos rail entry is built.
- **Partial carry-over in the new shell.** The Expressions panel passes the
  retained application an `epi-logos` lens when quaternal-logic is installed
  (`UI/panels/expressions.tsx:118,173-174`); WorldContext never takes
  `epi-logos` (`APP:259`). The lens's own new-shell chrome (footer toggle,
  head chip, corpus re-rooting) is ledger item 3, still open on that part.
- **Four kernel senses of "Epi-Logos", kept apart:** M5-1, Epii's argument
  (`BMAP/M5/M5-1/M5-1.md:14-18`); M5-5-4, stage 4 of the Logos cycle
  (`BMAP/M5/M5-5/M5-5-4.md:14`); MEF L5-5′, "Word beyond words"
  (`QL/docs/MEF-LENS-REGISTER.md:155-163`); M4.5-1, Core Epi-Logos Voice
  (`BMAP/M4/M4.5/M4.5-1.md:14`). Four objects; no mapping between them, or
  between the Logos cycle and the five modes, is built (`CONT:216`, "Do not
  force it").

---

## 8. The capability matrices — where they live, their cells, what the build must update

The "Situate the concern" law: every lane that changes what a product can do
updates the affected matrix cells as part of landing — "matrices change a lot
to match the UI components directly and clearly — that is the point: they are
verification evidence, not afterthoughts" (`EXECUTION-PROMPT.md:148-158`;
`MAP.md:88-93`).

| Matrix | Where | Current cells / state |
|---|---|---|
| QL field index (Epi capability matrices) | `Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-CAPABILITY-MATRIX-FIELD-INDEX.md` + the registered family (`ProjectCentral/user/capability-matrix.{json,csv,md}`, `epi-m-capability-field*.json`, relational-field CSVs, deep coordinate matrices) | **185 runtime obligations unaccepted**; 14 packets / 26 subpackets; A0–A5/deep branches; registry checked by `scripts/check-capability-matrix-registry.py`; one entry `suite_catalogue: true` collated by O:I |
| O-I suite matrix | `Work/O-I/docs/CAPABILITY-MATRIX.md` | **166 capabilities** (75 partial / 75 landed / 15 claimed-only / 1 historical), receipt laws stated (timestamp-bound closures; implementation-language-is-acceptance; physical-acceptance-is-no-parking-reason; aggregate-counts-are-not-set-completeness; S-only scope) |
| New-shell browser taxonomy | `new-shell/BROWSER-TAXONOMY-DIFFERENTIAL.md` + `browser-taxonomy-matrix.json` | **68 cells** (17 Ableton folder types × 4 modes), EVIDENCE/INFERENCE tagged; two open questions recorded (ledger items 32/34) |
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

**Proposed to the owner, not adopted** *(12 Oct; VIS §5.1 item 16)*: one row
that counts the leaving — "evidence of work and persons that left the
workstation and held — publications shipped, products landed elsewhere,
readers served by the site alone. The measure of the ladder is the
climbing-down" (`REL:179-184`). **Inferred:** it is the matrices' form of
the discipline of ending (`CONT:159-161`). No lane writes the row until the owner adopts it.

---

## 9. The build order — phases from the sources, with gates and the prerequisite chain

**The one progress law: the 126-target register is the only progress
statement.** All five target sets are approved as full functional scope
(`PROGRAMME.md:34-38`); **native acceptance passed: 0 of 126**
(`ACCEPTANCE-CHECKPOINT.md:23-31`, `README.md`; identities bound to
file/block SHA-256 in `targets.json`; five axes — implemented / exercised /
passed / failed / blocked — all pending). Never imply progress: a phase is
done when its gate's acceptance is executed evidence, and a target is passed
only in the register. UI acceptance is by direct computer use (owner ruling
9 Oct, `MAP.md:52-58`).

### 9.1 The prerequisite chain (explicit)

- **R1 (native run path in Tauri) precedes all acceptance** — nothing else
  is accepted in any other surface.
- **L4 + L9 sequenced commits** land behind the native composition parent's
  `timeline/` contract (staging lists on the tickets; their own two files
  land with THEIR lane's commit).
- **ctrl binary reinstall (owner act)** precedes R4's roster binding.
- **The Factory receiving/advancement join** (`MAP.md:139`) precedes the
  Factory vertical.
- **Lane 3 first** in the target sets (its editing core unblocks lane 5's
  RE passes and its A1-shaped save work strengthens every other lane);
  lanes 2 and 4 next (the `techne:time-axis/v1` contract is already proven
  at the wire level); lanes 1 and 5 follow (`CONVERGENCE.md:106-111`).
- Inside lane 3, kernel-first: E20 (save expressibility) → E03 (ref
  addressing) → E15/E16 (receipted undo) → E08 → E12; E14 + the slip field
  carry the set's only kernel-side additions and "are flagged for owner eyes
  before phase 3 starts" (lane-3 Sequencing note; ledger item 41).
- **The device corpus gates precede the Live-mode centre's device faces** —
  consume, never rebuild (LANES.md contract 1); audio device faces wait on
  the device-editing contract.
- **The port ledger rows** (all `pending-native-stack`) drive Expressions to
  resolution; the nine partials' true gap is the kernel save_as/fork/create
  op + shell New control + admission policy (L6 Part B).
- **R2 (installed-state disambiguation, owner nod)** precedes retirement
  bookkeeping; **legacy cradle retirement** executes only on the owner's
  named day against the cutover gates.

### 9.2 The phases, each with its gate and acceptance

**Phase 0 — the prerequisite state (do first; nothing else accepts without it).**
(Binding strength per §9.1, made explicit at the grill fold: only R1 is
universal — "precedes all acceptance"; R2 gates retirement bookkeeping only
(owner nod, ledger item 12); R4 waits on the ctrl reinstall (item 13). The
phase's parenthetical reads universal; the items bind as §9.1 states.)
1. **The native run path (R1)**: the supported way to run the NEW shell at
   HEAD inside the Tauri host from the seat — "Nothing else should be
   accepted in any other surface" (`DEVELOPMENT-TRACK-2026-10-09.md:76-85`).
   Coordinate with the native composition parent's serialized release
   pipeline (their "B package … still pending").
2. **Installed-state disambiguation (R2)** — owner-approved rename/mark of
   the legacy app and stale candidate (`DEVELOPMENT-TRACK-2026-10-09.md:58-66`,
   88-90). Owner nod pending → ledger item 12.
3. **Owner bindings in the native run (R4)**: gateway attachment, roster
   (after the ctrl binary reinstall — owner act, ledger item 13), workcell
   reading, skillsets; "the 'not admitted' wall turns into real admitted
   devices or precisely named real absences"
   (`DEVELOPMENT-TRACK-2026-10-09.md:118-122`).
4. **World-context disclosure + disclosure components (R5)**: the shell
   visibly states which world it runs in; "a screenshot must never again be
   mistakable for the product" (`DEVELOPMENT-TRACK-2026-10-09.md:123-127`).
5. **L4 + L9 sequenced commits** land behind the native composition parent's
   `timeline/` contract.

**Phase 0 gate / acceptance:** the native app boots at HEAD; every device
either admits through a real owner or names its absence; disclosure
components replace raw JSON dumps.

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

**Phase 1 gate / acceptance:** computer-use pass on the live screen at both
viewports; L3 opens and closes (devices past the widget guides, improvements
recorded back into `WIDGET-GUIDE.md` §8).

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

**Phase 2 gate / acceptance:** "two panes hold two projections of one
subject; hidden retention restores camera/selection" (T1 gate); "a curated
feature integrates by manifest with zero shell surgery" (T4); "a day, a run
and a conversation all present as tracks with launch/record/move/trim/split
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
   Central's resolution without a separate mode"
   (`WORLD-SHELL-DESIGN.md:856-861`).

Both are UX-side cutover gates 1–2 of `LEGACY-CRADLE-RETIREMENT.md`.

**Phase 3 gate / acceptance:** computer-use walks with receipts; matrices +
spine conformance recorded (L8).

**Phase 4 — the target sets (the 126, staggered per CONVERGENCE's
recommendation, updated by landed reality).**
- Recommended order: lane 3 → lanes 2 and 4 → lanes 1 and 5
  (`CONVERGENCE.md:106-111`; chain in §9.1). Lane 3's kernel-first order
  inside the set: E20 → E03 → E15/E16 → E08 → E12 (§9.1).
- The Live-mode work runs against the device corpus as it gates
  (COVERAGE.md ledger; golden renders; 70 devices stipulated).
- The Expressions port ledger drives to resolution: every row outward home +
  live replay; the nine partials' true gap is the kernel save_as/fork/create
  op + shell New control + admission policy (L6 Part B).
- Lane-7's structural moves ride here: P6 code naming harmonisation at
  phase 4 (`STRUCTURE.md:198-200`).
- Each target's acceptance = the per-target acceptance shapes (verbatim in
  `FUNCTIONAL-CROSSWALK.json`, which "retains each original target's complete
  exact definition, acceptance passage, source hash and line range");
  progress only in the register (§9 header law).

**Phase 4 gate / acceptance:** the register's five axes per target;
craft-quality bars never compliance checklists (`PROGRAMME.md:19-25`).

**Phase 5 — harmonisation, integration, retirement.**
Phase-4 harmonisation (the one Expressions-family visual/interaction
grammar; each instrument keeps its native controls — dual-reading §7) and
phase-5 integration through the env seats (`PROGRAMME.md:164-173`);
legacy cradle retirement executes on the owner's named day against the
cutover gates (`LEGACY-CRADLE-RETIREMENT.md:1-3`).

**Phase 5 gate / acceptance:** the cutover gates; the legacy cradle retired
on the owner's day only.

**Standing laws binding every phase** (verbatim sources): port law
(`MAP.md:96-101`); aperture law (`MAP.md:102-105`); widget law
(`MAP.md:106-115`); musical law (`MAP.md:116-120`); honesty boundaries
(`MAP.md:121-124`); licence gate (`PROGRAMME.md:43-49`); guardrails
(`PROGRAMME.md:187-199`); not-do laws (`WORLD-SHELL-DESIGN.md:652-667`,
`UX-SPINE-ALIGNMENT.md:139-150`). (See §11 for the builder's one page.)

---

## 10. The unified OPEN-QUESTION ledger — for the owner

Every gap/conflict from the three inputs, deduplicated. **Input accounting:
P1 carried 27 items; P2 carried 8 `OPEN-QUESTION` markers (6 distinct
questions — the hot-swap-domain and chain-selector questions are each stated
twice in P2); P3 carried 13 collected items (C-1…C-4, D-9…D-12, E-1…E-5).
46 distinct input items → 42 unified items below** (P3 D-10 = P1 #4; P3 E-1
and E-5 merge into item 2; P3 E-2 merges into item 3). No question was
dropped; no answer was invented. Conflicts are recorded as conflicts, not
resolved silently.

**Vision alignment, 12 Oct 2026** (DLW-VISION §4, §5.1 item 14): item 2 is
**closed** by the owner's ruling (answer (a)); item 13 is **closed** (the
owner act is done); items 1 and 3 are **partly answered**; nine rows from
the VIS §4 ledger are added as items 43–51 (Group F), ruled rows written as
law and open rows as recorded questions. The contemplation's own open items
C1–C9 are cross-referenced in Group F. This ledger stays the one list of
open questions; VIS §4 is its reading, not a second list. **51 items**;
open after 12 Oct: 46 (items 2, 13, 43, 48 and 50 are settled; 44 is partly
settled and stays open on its leave act).

### Group A — Identity / naming (1)

1. **The name "DLW / Digital Logos Workspace".** The name appears in the
   compilation commission only — zero hits outside the plan family itself
   in `Work/`, `Control/`, or the master planning session (the grep claim
   rescoped at the grill fold; §0 carries the full provenance). The
   orchestrator directs DLW forward; naming is authored-human ground, so the
   owner's confirmation on the ground remains open
   (`propose-not-write.md`). *A ruling decides:* the name adopted on the
   ground (or another name), after which all copy, code identifiers and
   registers align.
   **Partly answered (12 Oct; VIS L20):** the owner's own contemplation
   names the product "the DLW" throughout (`CONT:1,14,196`) and never
   expands it. Write "DLW"; do not expand it in UI. The expansion "Digital
   Logos Workspace" on the ground stays open.

### Group B — Ontology conflicts (source-vs-source, recorded verbatim, not smoothed) (5)

22. **Port-ledger count discrepancy** (`KERNEL-STATE-FOUNDATION.md`):
    "207 literal app router actions" vs the ledger's and L6's **213 rows**.
    The L6 audit's 213-row read is the current of record; 207 survives in
    older prose. *A ruling decides:* the reconciled count, recorded at the
    ledger.
    **Addendum (grill fold, 2026-10-10) — the same internal-fuzz pattern
    recurs in the Live device coverage ledger; recorded as a count
    conflict, not settled:** COVERAGE.md holds 53 device rows ≈62 expanded
    slots; the plan's earlier "≈46 device slots" matches neither; the
    §3.7 partition (gated 5 + derived ~40 + negative 5 + mechanism-only 2
    + residual ~24) sums to ~76 against the stipulated 70. *A ruling
    decides:* the counting convention (rows vs expanded slots vs
    stipulated devices) the build reports against. (GRILL-1 finding 4;
    see §13's grill record.)
31. **Step-transition bound conflict** (`EXPRESSIONS-PARAMETER-ADDRESSES.md`
    note 3): registry hard minimum 0.02 s vs `hostEditor.ts` admitting
    0..3600 — "Reconcile one or the other." *A ruling decides:* which bound
    is law.
32. **Browser-taxonomy Q1** (`BROWSER-TAXONOMY-DIFFERENTIAL.md:16-18`):
    "the request says '15 types x 4 modes = 60 cells', but its own list names
    **17** rows… the matrix has **68 cells**… The owner should confirm
    this." *A ruling decides:* the confirmed cell count.
34. **Browser-taxonomy Q2** (same, :19-22): the shells disagree about what a
    "mode" is (live shell 3 modes vs cradle 6 vs design's world-context
    resolution) — "Open question Q2." *A ruling decides:* the mode
    vocabulary the taxonomy is written against.
39. **Licence contradictions vs research claims**
    (`ACCEPTANCE-CHECKPOINT.md:28-30`): "Actual pinned licences contradict
    two research claims: Twine 2.12.1 is GPL-3.0; TimelineJS3 3.9.13 is
    MPL-2.0. Both remain interface-only." *A ruling decides:* any adoption,
    per the licence gate (adopt / clean-room / interface-only).

### Group C — Owner-ruled semantics (design meaning the owner must rule) (24)

2. **Epi-Logos in the new shell's mode rail** (P1 #2 + P3 E-1/E-5): the
   Rev 5 rail has **five** mode icons — Live, Base·Central, Factory,
   Expressions, Technē (`WORLD-SHELL-DESIGN.md:24-27`;
   `shell/modeGrammar.ts:31-33` `SURF_MODES`) — and no Epi-Logos icon; the
   cradle has **six** WorkspaceModes including the refused `epi-logos` seam;
   the compilation commission says "plus the Epi-Logos lens". The cradle
   answered "world context + lens, never a sidebar mode" (ruling
   2026-09-18); the new shell's grammar is silent; whether the five modes
   stand *in* Epi-Logos as ground is supported only by the world-context law
   (§7.5), not by any mode-grammar statement. *A ruling decides:* (a) world
   context + lens riding the spine (as the cradle's E2 and the Rev 5 rail
   imply), (b) a sixth surf mode added to `SURF_MODES`, or (c) deferral.
   The build model must not invent an answer; the spine already supports the
   world axis either way. **Vocabulary clash folded here (grill):** ruling
   D2 says "Epi-Logos is NOT a mode entry", while the agent-composition
   commission (22 Sep, quoted §7.3) speaks of "the existing **Epi-Logos mode
   button**" — whether the Technē/Expressions rail carries an Epi-Logos
   "mode button" (and what form it takes, given the Rev 5 rail's five
   icons) is part of this same ruling's surface.
   **CLOSED 12 Oct — answer (a), by owner ruling:** "Mode set for the
   build: Live (base) · Central · Factory · Expressions · Technē, with
   Epi-Logos a lens, not a mode (standing ruling D2/A5)" (`CONT:251-252`).
   No sixth surf mode. The mode-button vocabulary reads as the lens's
   agent-composition default, not a rail entry (§7.6); its chrome is item
   3.
3. **The Epi-Logos lens carry-over and elaboration in the new shell**
   (P1 #3 + P3 E-2): the master planning session holds no Epi-Logos
   elaboration; the elaboration lives in `EPI-LOGOS-AGENT-MODE.md`,
   `EPI-LOGOS-AGENT-ARCHITECTURE.md`, `EPI-LOGOS-DEVELOPMENT-WAYFINDER.md`,
   `EPI-LOGOS-SOURCE-OF-TRUTH.md` and the #201/#135/#220/#65 chain. Does
   the lens itself carry into the new shell (a footer toggle + head chip
   re-rooting the browser on the `epi` corpus), and does "context sources
   narrow to the corpus" map onto the aperture slot? Does the DLW build owe
   any Epi-Logos surface beyond the world-binding + Nara/agency devices
   (e.g. the "curated Epi surface" the E2 entrance opens)? *A ruling
   decides:* the lens's new-shell chrome and any elaborated surface.
   **Partly answered (12 Oct):** that it is a lens is ruled (`CONT:252`);
   the new shell already carries a partial carry-over, the `epi-logos` lens
   passed to the retained Expressions application
   (`UI/panels/expressions.tsx:118,173-174`). The lens's chrome and any
   elaborated surface stay open (§7.6).
4. **Multi-select** (`EXPRESSIONS-ENCOUNTER-SPINE.md:155-158` + P3 D-10,
   verbatim): "Decide whether the owner supports multi-select. If not, the
   app should stop writing more than one id (`app.ts:341`)… If it does, add
   one owner multi-select operation… Pick one rule for 'the selected object'
   and apply it in `chosenControls.ts` and `editorHost.ts` as well as in the
   shell." R1 ("exactly one, otherwise none") vs R2 ("the first id") split.
   Until ruled: the rack shows no target while a Follow control drives the
   first object. *A ruling decides:* the rule and the operation.
5. **Autonomy vocabulary** (`AGENTIC-CONVERGENCE.md:334-339`, open design
   question 1): "is `suggest / act_with_review / autonomous` the right
   ladder, or should it inherit the respond-gate's author-facing terms
   (owner-only / allowlist / anyone)?" *A ruling decides:* the ladder.
6. **Macro ↔ skill mapping** (same list, q2): "Do macros map to skills 1:1,
   or may a macro compose a skill chain?" *A ruling decides:* the mapping
   grammar.
7. **Escalation address** (q3): "another agent (Buzz's owner_cache pattern)
   or always human?" *A ruling decides:* the escalation target.
8. **Conversations rooms** (q4): "set-level and Scene-level rooms
   simultaneously (a room per scope) or one room at the selected scope with
   a scope switcher?" *A ruling decides:* the room model.
9. **Budget units** (q5): "turns are the harness's native count; wall-clock
   and cost need the harness's ledger to be admitted as truth." *A ruling
   decides:* the admitted unit sources.
10. **Stop-twice rollback** (Rev 2 still-open, `AGENTIC-CONVERGENCE.md:212-214`):
    "whether Stop-twice may roll back writes that already have a receipt."
    *A ruling decides:* rollback semantics.
11. **Hold launch mode** (same): 'whether Hold launch mode ("think while I
    talk") is wanted.' *A ruling decides:* the launch modes.
14. **Remote posture ruling** — remote carrier "stands at refused/composed,
    never live (owner ruling)" (`AGENT-SHELL-ACCEPTANCE.md:62`); the
    Workcell remote-posture ruling (composed vs live) is named open fog
    (`MAP.md:186-187`). *A ruling decides:* the posture.
16. **Groove (swing) has no assigned DLW meaning** — Live's groove *pool
    geometry* is reused (`UI-UX-CONVERGENCE-STUDY.md:63`) but no source maps
    groove *content* (swing/timing feel) into the World grammar; the
    derivation corpus's groove application behavior is partial (§4.1 A7.6).
    Silent in sources. *A ruling decides:* whether groove content is
    admitted, and as what.
18. **Hot-swap compatibility domain** (P2, stated twice — §B2 table and
    §B7.1): Live's compatibility domain is the chains' signal-domain typing;
    DLW's typed equivalent is proposed as the chain's parameter/signal
    grammar — proposal, owner confirms. The swap gesture's interaction
    mechanics are not derived (browser structure is). *A ruling decides:*
    the compatibility domain.
19. **Chain-selector semantics beyond audio** (P2, stated twice — §B2 table
    and §B7.2): zones/crossfades are measured for audio racks; whether
    non-audio DLW racks (skillsets, gateways) expose a selector at all is
    undesigned. *A ruling decides:* selector exposure per family.
20. **.als document compatibility** (P2 §B7.5): `live-set` (M0) stands as a
    read/summary library; whether DLW targets write-compatible .als emission
    is undecided. *A ruling decides:* write-compat in or out of scope.
24. **Amp / Cabinet (mechanism-only) slots** (P2 §A5.2): mechanism
    documented (Softube bundle), DSP not ours; whether DLW's live mode
    carries these two slots at all is unruled. *A ruling decides:* carry
    (readings-only), omit, or attribute.
26. **DECODE publication of the derivation dossiers** (P2 §A7.9): whether
    the dossiers should be published into `live-12-re/devices/` as DECODE
    contracts (the landing register's shape — that tree is empty on disk)
    or consumed where they are. *A ruling decides:* the dossier home.
27. **The Epi-Logos four families as a family manifest** (P3 E-3): should
    essay/bimba/epii/products appear as a family manifest (§12's
    seventh-carving pattern: browser categories, faces, projections, time
    bindings), with the receiving adapters as its declared surfaces? *A
    ruling decides:* the carving.
28. **The Trail tile in the new shell** (P3 D-9): the design and the cradle
    trail are landed, but "nothing in the live shell reads or writes a
    trail" (EXPRESSIONS-ENCOUNTER-SPINE finding 6). Where does the shell's
    Trail tile live (Revision 2 places it in the right dock: "Context tiles
    sit above: the agent…, Packet, **Trail**, Field, Agents, Terminal,
    Results, Sky, NOWs"), and what is its retention bound? *A ruling
    decides:* placement and bound.
33. **The modulation scope widening** (P3 C-2): `QL_MODULATION_SCOPE` is
    today quaternal-logic addresses only — which families' parameter
    addresses become routable targets, by whose declaration? *A ruling
    decides:* the widening path (compile refuses them today).
35. **Standing vocabulary beyond `'fact'`** (P3 C-4): the spine carries one
    standing producer today — which owner sources will supply
    claim/inferred/hypothesis/disputed/ghost, and is `state` the right
    carrier for the full chip set? *A ruling decides:* the producers and
    carrier.
37. **The canonical linkable-encounter query grammar** (P3 D-12): the
    cradle `decodeEncounter` uses `?arr&projection&subject&ap&as&occasion`;
    the mockups use `?mode&lens&scale&body&ap` /
    `?arr&scale&subject&ap&as&visit&walk`. One canonical query grammar for
    the shell is undecided. *A ruling decides:* the grammar.
38. **The `groupOfTrackKind` fallback** (P3 C-3): it sends unknown track
    kinds to "Central · civil field" — a new family could be silently
    mislabelled. Should the fallback refuse instead? *A ruling decides:*
    refuse or keep.
41. **Lane-3 kernel-side additions flagged for owner eyes** (lane-3
    Sequencing note): E14 nesting budget behavior, the slip field in E06,
    and the dedicated `marker_set` Change kind in E12. *A ruling decides:*
    each addition before phase 3 starts.

### Group D — Missing owners / owner operations (7)

12. **Installed-state disambiguation (R2)** — the owner nod for the
    rename/mark of the legacy app and stale candidate
    (`DEVELOPMENT-TRACK-2026-10-09.md:58-66`). *The owner act decides;*
    phase 0 waits on it.
13. ~~**ctrl binary reinstall** — the owner act that clears the shell's roster
    disclosure (CE1 carry-forward; the fix landed in Work/Central `9449881`,
    774/0 tests, but the binary is not reinstalled). *The owner act decides.*~~
    **CLOSED 12 Oct — done.** Installed ctrl `7a45111` (11 Oct 16:30)
    contains the roster fix `efef5c3`, the landed form of `9449881`
    (`PATH.md:39-40`; `git merge-base --is-ancestor efef5c3 7a45111` in
    Work/Central, 12 Oct). PATH's gate "ctrl roster fix installed" is green.
23. **QL-side procedural body-generation contract** — planet-building
    controls drawn (Rev 3), GPU globe engine named; "the per-World seed→body
    contract on the QL side is the remaining specification"
    (`MAP.md:182-185`). *The QL owner supplies the contract.*
25. **Which family admits the derived Live device faces** (P2 §A6.4): the
    six product carvings are central, actuation, ai-kit, software-factory,
    workcell, quaternal-logic; §18 assigns the musical system to
    quaternal-logic (M1 as instrument device) — but the audio-effect chain
    the mockup draws in live mode (Drum Rack → Glue Compressor → Reverb) has
    no named owning family. Options: a QL extension, or the seventh-carving
    path (a new product admitted with zero core change [WSD §13]). *The
    owner rules;* until then every derived face renders readings +
    declared-waiting writers.
29. **The essay / epii producing owners** (P3 E-4): both families are
    receiving-only in the cradle — what are their producing owners, and when
    do their live adapters land? *The owners decide.*
30. **The shell-side host channel and the Tauri realtime gate** (P3 D-11;
    the named gaps of §18 / `QL_LAUNCH_CONTRACT`): the shell host supplies
    no `oi.native-expression/v1` channel; the Tauri webview's AudioContext
    device path is unmeasured — owned by #281's packets and the host-side
    channel owner; the driving model's performance step depends on them. *The
    #281 integrator + host owner land them.*
36. **Manifest `projections[]` declarations for the landed adapters**
    (P3 C-1; re-asked **per family** at the grill fold — the run family's
    answer is already given: the software-factory manifest declares
    `'factory-run-track-adapter'`, so the family door admits the run
    adapter today): (a) the day and conversation adapters (Central) and
    the two QL adapters ride the lane door — when do their families'
    owners declare `projections[]`? (b) the Expressions family's declared
    id (`'expressions-track-adapter'`, singular) does not match its
    registered id (`'expressions-tracks'`, plural) — an id decision is
    needed before the family door can admit it (§5.2). *The family owners
    declare, per family.*

### Group E — Environment-unverified (5)

15. **Pushed turn streaming** — gateway convergence backlog item 1; threads
    poll today (`AGENT-SHELL-ACCEPTANCE.md:59`). Unverified/unbuilt in the
    environment.
17. **Projection-scale performance and clustering** — "the one
    confirmed-open question… Needs its own research commission before any
    lane promises a number" (`MAP.md:171-177`).
21. **Visiting exercised end-to-end** — contracts exist, no live
    cross-machine visit flow run in the shell (`MAP.md:178-181`).
40. **Multi-machine physical acceptance** — Workcell #24/#26/#27 + Arrakis
    live smoke (`MAP.md:188-189`).
42. **Cursor/Codex original captures unrecovered**
    (`FUNCTIONAL-CROSSWALK.md:236` — "preserve names and retrieve exact
    evidence"; V1's F5): the original independent verdicts' full fault lists
    are unrecoverable; three reconstructable defects were verified.

### Group F — Vision alignment (12 Oct 2026; VIS §4 rows L1, L2, L5, L16, L17, L19, L21, L22, L23) (9)

Ruled rows are written as law; open rows as recorded questions. Each item
names its VIS §4 row; the row carries the full evidence.

43. **The mode set; where the Live musical system lives** (L1).
    **SETTLED — owner ruling, law:** "Mode set for the build: **Live (base)
    · Central · Factory · Expressions · Technē**, with Epi-Logos a lens, not
    a mode (standing ruling D2/A5)" (`CONT:251-252`). Live is the
    reverse-engineering basis, ported not approximated (`CONT:244-246`); its
    destination is Expressions with audio and video track layers
    (`CONT:247-250`). The music/audio half is tied to `MPW:10` and
    `WORLD-SHELL-DESIGN.md:917-918`; the video layer rests on the ruling
    alone. D-G (Expressions inside the shell, `PROG:110-112`) and the ruling
    (Live's music system moving into the Expressions mode) sit at different
    levels; both stand (§4 head). *Build:* the five-mode grammar is law; copy
    says "Live mode"; Live stays distinct until T-LIVE-INTO-EXPRESSIONS (item 51).
44. **Central: a mode, or the world context riding every mode** (L2).
    **PARTLY SETTLED.** Settled: Central is a mode (`CONT:251`); its
    world-context mechanism stands (`GRAM:20-21`;
    `WORLD-SHELL-DESIGN.md:533-536`). Open: the leave act — leaving Central
    drops the world context (`APP:259`) against the cradle law that the world
    holds "until the person leaves it" (`STORE:54-56`). *Build:* `GRAM:20-21`'s
    mapping stands; title the mode "Central" (T-LABELS). *A ruling decides:*
    the leave act and the Central mode's initial world (T-WORLDCTX).
45. **The day's hours, and who fires the close** (L5). Three sides
    (§5.4a): design 08:30/21:00, policy `day_boundary_minutes: 0`, practice
    the 6am Nara flow. The mockup: "Closing a day is the owner's act — never
    an agent['s]" (`WS/world-shell-mockup-r1.html:798`); the session floor
    tells agents to "close the day you were standing in"
    (`FLOOR:297-298`). *Build:* 08:30/21:00 stay design text with a source
    tag; no shell device fires a close, which stays `central.day.lifecycle`
    (`UI/inhabitants/centralDayNowModel.ts:55-105`). *A ruling decides:* who
    fires the close, and whether a cron-fired close fits the civil-date law.
46. **Hesse's two schools against the dual-reading pair** (L16). The pair
    stood as Technē 4:2 / Expression 3:3 (`LOCK:3`); its four-and-two half is
    withdrawn (owner, 19 Oct 2026). Assigning Hesse's schools to the two modes
    is a reading (VIS L-5). *Build:* to the two modes. *A ruling
    decides:* whether the schools reading is adopted at all.
47. **Does the plate sound; entity voices and D13; is the physics sim the
    M1 instrument device** (L17). **Tension**, causal wording only, and
    unruled body (§4.4 "Item 47"; §5.5). *Build:* keep the common-cause law,
    add no generator, label entity voices "retained-app voices, relation to
    M1 unruled"; send the wording repair to the QL owner. *The owner rules,
    with the QL owner (#281).*
48. **Technē instrument names** (L19). **SETTLED — law:** the deep
    instruments go by their plain names, "project/graph, canvas, timeline,
    journey, places, palace" (D-F, `PROG:97-108`); the code rename is
    deferred (`PROG:104-105`), and `GRAM:415-416` still carries M′ labels.
    *Build:* the UI shows plain names (T-LABELS); since 19 Oct 2026 the
    instruments carry no M′ address at all (lock §0.1 item 3).
49. **Technē companion label: Epii or Aletheia** (L21). **SETTLED:** the
    dock says "Epii" (`DOCK:67`, M5); the lock's "Technē_i := Aletheia_i"
    (`LOCK:510-517`) went with the four-and-two reading (owner, 19 Oct 2026);
    the Expressions companion is named by its S4′ operator, Anima (`LOCK:507`;
    §4.5). *Build:* keep the label.
50. **Review at M5-4, or M5-4 as the six agents** (L22). **SETTLED —
    both**, by the live Bimba map (queried 12 Oct 2026; the map wins,
    `LAW:19`): M5-4 holds the "S4/S5 review" role, the six agents as internal
    components, and the M5-4′ "Agentic Control Room" affordance (VIS L-4).
    *Build:* no DLW surface claims the M5-4 or M5-4′ address until a ticket
    binds it; the address is provenance only (`PROG:97-101`).
51. **When Live moves into Expressions; the audio + video track design**
    (L23). Direction ruled (`CONT:247-250`). No design or code names a video
    track; track kinds enter as adapters on the Timeline projection
    (`WORLD-SHELL-DESIGN.md:945-951`; §5.2, §5.8). *Build:* T-LIVE-INTO-EXPRESSIONS is
    deferred and owner-timed, claimable only when the Live port is
    measurable as a whole; nothing merges Live's rail entry meanwhile. *The
    owner times it;* the track design is Open.

**The contemplation's open items, cross-referenced** (`CONT:202-222`). They
are not added as items: each is the VIS §4 row and plan item named here.

| CONT item | VIS row | This ledger / this plan |
|---|---|---|
| C1 Units above the day | L4 (OWNER) | §5.4a "Above the day: Open"; no week or season object |
| C2 Technē → Expressions composition | L6 (PARTLY) | §4.4 "Composition direction"; lane-5 target; T-CROSS proposed |
| C3 Nara's DLW interface | L7 (PARTLY) | §4.4 "Nara, foreground"; interface the owner's |
| C4 A teaching surface | L8 (PARTLY) | item 29; §4.5 "Palace is the M5 pedagogy pole's form" |
| C5 Ending above the day | L9 (OWNER) | §0 "The work ends"; retire nothing larger than a family |
| C6 Logos cycle ↔ modes | L10 (OWNER if wanted) | §7.6 "Four kernel senses"; no mapping built |
| C7 The performance | L11 (PARTLY / OWNER) | items 25, 30 |
| C8 Origin-return as a working surface | L12 (PARTLY) | item 28; §4.5 "Origin-return" |
| C9 How a non-owner plays | L13 (OWNER) | items 3, 21, 27 |

**Named-unowned baseline defects** (not questions but the build inherits
them): 15 cradle TS2550s; hosted-contributions drift (L1/L8); the
FactoryLive producer-consumer fault (§4.3); the S1 second selection store
(§4.4); the Time Scale authored/effective display fault
(`KERNEL-STATE-FOUNDATION.md:78`); the two pre-existing BASE test failures
(`AGENT-SHELL-ACCEPTANCE.md:92-94`).

---

## 11. How to build from this plan — the laws that bind the builder

One page. Read it before the first change; re-read it before every claim of
done.

**The laws (each binding, each cited):**

- **Extraction law (this document's own).** Every claim cites its source.
  Where the sources are silent, the gap is an OPEN-QUESTION (§10) — fill
  nothing from imagination, invent no specification, resolve no conflict
  silently. The worst tendency is to silently drop or invent specification
  details; don't.
- **Port law** (`MAP.md:96-101`): port the capability through its native
  owner — the shell binds, never reimplements.
- **Aperture law** (`MAP.md:102-105`): "a successful UI flag is never
  evidence of a native effect." Every write has its owner op (the writers
  law, §3.3); a row without a writePath IS a reading.
- **Widget law** (`MAP.md:106-115`) + **WIDGET-GUIDE.md**: the mockups are
  guides, never ceilings; a device is done when it works honestly through
  its owner AND functions and looks better than the mockup drew it; the
  guide tracks the best landed state (record improvements into its §8
  ledger).
- **Musical law** (`MAP.md:116-120`): no sounding claim before the owner
  lands it in the shell; M1 is the source, M2 modulates, never generates
  (D13); the realtime boundary is law (§5.5).
- **Honesty boundaries** (`MAP.md:121-124`): read-only honesty until each
  owner lands; "Live unchanged (read-only honesty)"; designed empty states
  name their owner; never imply progress — the 126-target register
  (`ACCEPTANCE-CHECKPOINT.md` + `targets.json`, **0 of 126 passed**) is the
  only progress statement.
- **Never-ship / licence law** (§4.1 A6.5): no captured Live images, no
  Ableton icon art, no preset content, no decompiled material in product
  source; licence gate adopt / clean-room / interface-only per source
  (`PROGRAMME.md:43-49`).
- **Not-do laws** (`WORLD-SHELL-DESIGN.md:652-667`;
  `UX-SPINE-ALIGNMENT.md:139-150`): no second selection/navigation model, no
  second store, no second clock; a family needing a fifth place is a design
  smell (§16).
- **Acceptance is by direct computer use** (owner ruling 9 Oct,
  `MAP.md:52-58`) against real saved work, not fixtures
  (`UI-UX-CONVERGENCE-STUDY.md:100-101`).
- **The vision's builder carry** *(12 Oct; VIS §6)*: every brief built from
  `BRIEF-BUILDER.md` and `BRIEF-REVIEWER.md` embeds the DLW BUILDER CARRY
  block verbatim (`DLW-VISION.md:1379-1469`), and a reviewer refutes a
  done-claim against it. It is carried by reference here, not copied, so
  there is one text. Its heads: WHAT, KEY, FIGURE, GAME, MODES (five,
  owner-ruled; title the Central mode "Central"), LIVE (the
  reverse-engineering basis; destination Expressions, owner-timed), CROSS
  (crossings are explicit acts that keep the origin ref), NARA, EPII, ORIGIN
  (every derived thing walks back to its source in one act; a return is a
  proposal to the origin's owner; no coined UI label), HONESTY, MUSIC, TIME
  (no device fires a close; no week or season), RECORD, EXTEND, FIELD,
  ENDING, COORDS, WORDS ("base" means Live mode; never rename the stored
  book mode `base` without a migration), STOP (a §10 item still open, or a
  VIS §4 row still PARTLY or OWNER: return `OPEN` with the id).

**The suites and crates that must stay green** (the seat now *(12 Oct)*:
`/Users/admin/Central/worktrees/env-1/o-i`, lane `dlw/build-20261012` off
`main`, §1.1 "Seat now"; the figures below were run on the earlier branch
`agent/o-i-20261007-1639`, which is history):

- live-shell/ui — **re-run at the grill fold, HEAD `109ba5d5c`, 2026-10-10**:
  mode-grammar 14/14 (grown by the cross-mode fidelity sweep; the
  DEVELOPMENT-TRACK figure at its writing was 9/9), composition guard 29/29,
  agent 51/51 (the nine agent-shell suites; the later `agent-chain-drag`
  suite adds 16 more, green), inhabitants 10/10 (not in the
  DEVELOPMENT-TRACK list), mode-surface-fidelity 12/12, live-mode-place 8/8,
  `tsc --noEmit` zero. (DEVELOPMENT-TRACK's "90/90" was its own 9-Oct run
  composition — superseded counts; the current figures above are the ones
  to hold.)
- `packages/live-dynamics`: golden gate suite 13/13 PASS with archive
  wiring; 53 lib tests green (§4.1 A5.4).
- Work/Central ctrl validator: 774/0 tests (commit `9449881`).
- Corpus neutrality: 28/28 C2 amendments, zero Jung bytes in the atlas port
  (L5).
- Any lane's own checks + the fidelity oracle with craft assertions (R6).

**Where the evidence lives:**

- This plan's companions: `DLW-PLAN-p2-ableton-SOURCES.md`,
  `DLW-PLAN-p3-SOURCES.md`, `SOURCES.md` (every file read, with its
  contribution).
- The design: `new-shell/WORLD-SHELL-DESIGN.md` (all five revisions; Rev 5
  is final). The measured Live basis: `UI-UX-CONVERGENCE-STUDY.md` + the
  three captures (research evidence, never assets).
- The orchestration map: `wayfinder/MAP.md`; the honest state:
  `DEVELOPMENT-TRACK-2026-10-09.md`; the widget standard:
  `WIDGET-GUIDE.md`; the phase/verify loop: `EXECUTION-PROMPT.md`.
- The RE corpus: `Work/O-I/docs/research/ableton-live-12.0.25/` (README
  source lock, session-model, COVERAGE, per-device dossiers, UI-EVIDENCE,
  racks-session-model, mod-matrix, follow-action, warp-probe, NEXT-SESSION).
- The 126-target register: `new-shell/README.md` +
  `ACCEPTANCE-CHECKPOINT.md` + `targets.json`; the crosswalk with verbatim
  acceptance shapes: `FUNCTIONAL-CROSSWALK.md` + `FUNCTIONAL-CROSSWALK.json`.
- Landed-code tickets (L1–L9, K1, CE1, V1 and the craft lanes): `wayfinder/tickets/` in the origin mirror `desktop/cradle/docs/world-shell/`; the DLW build's tickets (P0-*, T-*) live in `wayfinder/tickets/` beside this plan
  (PATH §2). Matrices: §8's table.
- The owner's planning session of record: `sess_ac3200ca-b5e7-410e-81ff-4fa5a4c512e2`
  (`[session]` cites); the project NOW register
  (`Work/reverse-engineering/ProjectCentral/now/` — the programme register
  of record; this plan's own directory has no `ProjectCentral`).

**The order of work** is §9; the phase gates and the prerequisite chain are
explicit there; the per-mode "Exists vs to build" lists (§4) and the port
ledger drive the detail. When a needed decision is an OPEN-QUESTION, build
the honest waiting shape (readings, hollow lights, named owners) and stop —
never an invented answer.

---

## 12. Source coverage statement

**Found and read** (per P1 §9, still the coverage of record for the corpus
it names): PROGRAMME.md, CONVERGENCE.md, WORLD-SHELL-DESIGN.md (all five
revisions), UI-UX-CONVERGENCE-STUDY.md, FUNCTIONAL-CROSSWALK.md (+
registers), INSTRUMENTATION-CONTRACT.md (head + structure),
NATIVE-EDITOR-STANDARD.md, INSTRUMENT-EDITORS.md, AGENTIC-CONVERGENCE.md,
AGENT-SHELL-ACCEPTANCE.md, DEVICE-PANEL-BRIEF.md,
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
(43 agent records) + day readings 2026-10-09,
M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md (full),
EPI-CAPABILITY-MATRIX-FIELD-INDEX.md, EPI-LOGOS-AGENT-MODE.md,
UI-FUNCTION-LANDING.md (E2/R1 rows), ASTRA-BRIEF.md, shell-inputs/INDEX.md,
COVERAGE.md + LANES.md (Live 12 corpus), the master planning session
(three focused queries — P3's own SOURCES records "two focused queries" for
its pass; the coverage records disagree by one, noted at the grill fold,
not smoothed), the landed code (modeGrammar, inhabitants,
timeline, agent, projections trees; git log), Work/O-I packages inventory.
P2 added: the full Live 12 RE evidence tree (README source lock,
session-model, racks-session-model, COVERAGE, 61 device evidence documents,
UI-EVIDENCE + three captures read as images, follow-action, warp-probe,
mod-matrix, NEXT-SESSION, LANES, integration-map, reconstruction-backlog),
the live-dynamics NOW records, the shell-inputs INDEX + LANDING-REGISTER,
the device SDK and modes/controls sources, both mockups' device blocks.
P3 added: the M-Prime commissioned law (WAYFINDER, WORK-PACKETS,
RESEARCH-ACCEPTANCE), the K8-SKY-CONTRACT, 10-SIDEBARS, the cradle's
workspace/epilogos source trees, the L9 evidence bundle
(ROLE-CLASSIFICATION, LANE-RETURN), and the mockup's aperture/view-as/
keyboard records. Full inventories with contributions:
`DLW-PLAN-p2-ableton-SOURCES.md`, `DLW-PLAN-p3-SOURCES.md`, `SOURCES.md`.

**Not found / does not exist** (recorded for honesty): any document named
`EXPERSSIONS-ENCOUNTER-SPINE.md` (the commission's spelling; the real file
is `EXPRESSIONS-ENCOUNTER-SPINE.md`, read); any ground use of "DLW"/"Digital
Logos Workspace" (ledger item 1); an Epi-Logos elaboration in the master
planning session (ledger item 3); a lane-6 Rev 3+ (SCOPE stands at revision
2); the `live-dynamics` crate in the env-1 seat (it lives at
`Work/O-I/packages/`); `/Users/admin/Central/Work/reverse-engineering/live-12-re/`
and its `devices/` tree (the INDEX's "empty today, the path of record" is
the accurate state — ledger item 26); the new shell's `new-shell/src/inhabitants/…`
(the SDK lives in the seat at `packages/live-shell/ui/src/inhabitants/sdk/`);
any shell-side trail implementation (ledger item 28); the producing owners
for the `essay`/`epii` receiving families (ledger item 29).

**Compile reconciliation notes (flagged, not smoothed):**

- The unified mapping table (§2) merges P1 §2 and P2 §B2; no row's content
  was dropped — overlapping rows carry both sources' content and both cites.
- The driving model (§6) merges P1 §5 and P3 Chapter D; the five time
  strata appear once (in §5.4, the deeper treatment) with the user-facing
  controls in §6.3 — P1's shorter strata summary is subsumed, every owner
  quote and stratum behaviour retained.
- The Epi-Logos chapter (§7) merges P1 §4 and P3 Chapter E; P3's
  three-register distinction is the ruling structure; P1's cradle-existence
  bullets (E2 entrance, portal park, mode-button/agent-composition
  register, QL integration corpus, wider identity) are retained in §7.3.
- The Live mode chapter (§4.1) carries P2 Chapter A verbatim in structure;
  P1's Live-mode "Exists vs to build" and acceptance close the chapter.
- Slot-count note — **RESOLVED BY COUNT at the grill fold (2026-10-10): the
  landed grammar fixes 28** (`TRANSPORT_SLOT_IDS`, §6.2; 28 at every commit
  that touched the file — the mode-system commit message itself says "all
  28 transport slots", and DEVELOPMENT-TRACK:91 says "five modes × 28
  transport slots"; the plan's own §6.2 enumeration names exactly 28). The
  phantom 29 was P3-SOURCES line 52's "29 slots × 5" — an error against the
  code it describes — promoted by this compile into §6.2 and then, in the
  note this replaces, wrongly ruled "the landed current of record". This
  was a checkable fact, not a source conflict; it is recorded as a
  corrected error. 28 everywhere.

---

## 13. Grill record (the fold, 2026-10-10)

This document was adversarially grilled before the build model receives it,
and the findings were folded by lane `zcode:dlw-fold`, dispatched by
orchestrator `zcode:world-shell-orchestrator`, 2026-10-10. The grill reports
stand beside this plan as read-only inputs of record:

- `wayfinder/DLW-PLAN-GRILL-1.md` — §0–§4 under the grill
  (`zcode:dlw-grill-1`). **13 findings — DROPPED 1 · INVENTED 3 · AMBIGUOUS
  4 · CONTRADICTORY 1 · MISALIGNED 4.**
- `wayfinder/DLW-PLAN-GRILL-2.md` — §5–§12 under the grill
  (`zcode:dlw-grill-2`). **14 findings — CONTRADICTORY 2 · DROPPED 5 ·
  AMBIGUOUS 6 · MISALIGNED 1 · INVENTED 0** (the phantom 29 carried inside
  G2-1 as its contradictory resolution).

**What was folded (this change set):** the 28-slot record restored
everywhere, with the 29's provenance (P3-SOURCES:52, promoted by the
compile) recorded as a corrected error and §12's note resolved-to-28; the
invented "the only tab" phrase replaced with the sourced phrasing (WSD:80-98
+ UI-UX:67-69); §1.1/§1.3 refreshed to HEAD `109ba5d5c` (the craft commits
`0f4bfdadf`/`5b5b6a4ca`/`109ba5d5c` and the SDK lineage through
`1dbbb7954`; craft lanes done; the 84-uncommitted tree recounted); the
coverage arithmetic restated (53 rows ≈62 expanded slots; the partition's
~76-vs-70 fuzz carried as the addendum beside ledger item 22, not settled);
the owner-words triple relabelled as session-authored design prose and the
two msg-72 transcription deviations noted; the Expressions-family
declaration/registry id mismatch and the run adapter's already-declared
family door recorded in §5.2, with ledger item 36 re-asked per family; the
elided D13 clause restored in full (wayfinder :32); the aperture admission
predicate marked mockup-spec (§6.5–6.6); §11's suite counts re-run at HEAD
(mode-grammar 14/14, agent 51/51 + chain-drag 16, inhabitants 10/10,
composition guard 29/29, mode-surface-fidelity 12/12, live-mode-place 8/8,
tsc zero); the software-factory 6/0-ticket-vs-5-on-disk count stated both
ways; the mode-button vocabulary clash folded into ledger item 2; and the
grills' minor citation and wording fixes applied (per-panel height, the
Rev-2/4 plain-names edit mark, the commission-record and NOW-register
paths, the naming-grep rescope, the eleven fixed device keys, MAP:121-122's
exact wording, the ShellMode six-value union, the `enterEpiWorld`
location, the Phase 0 binding note, the QL telemetry-null seam, the
declared-but-unregistered projection ids, the mapping-table ownership
note, the query-count discrepancy).

**What the grills confirmed held** (their survivor lists, summarised
verbatim-faithful): §0's THE INTENTION quote verbatim complete against
`ASTRA-BRIEF.md`; the Rev 5 rack, transport-meanings and Session|Arrangement
tables verbatim faithful (checked row by row against WSD:32-51); the Rev 4
Clip|Device pairs and dock, the Rev 3 browser/centre/dock rows, and the Rev 2
Technē projection placement (subject only to the D-F plain-names
harmonisation, now edit-marked); §5.3's seven-row clock table exact
row-for-row against the landed `QL_CLOCK_MAPPINGS`; §5.2's adapter contract
and seven-adapter census real; `generates: false` truly in the type with the
twelve observables; §5.4's spine claims, §6.2's five-meanings table and
§7's three registers exact; §8's seven matrices real with real counts; §9
Phase 0 matching standing reality; §10's 42-item ledger clean (numbering,
arithmetic, cross-references — item 36's staleness the one defect found,
now corrected); §11's laws and §12's "not found" honesty list checking out.
The plan's spine survived both hostile reads; what failed was bookkeeping,
and the bookkeeping is what this fold repaired.
