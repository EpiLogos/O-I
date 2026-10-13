# DLW device semantics lock — Live's ontology is the DLW's

**Standing:** 12 Oct 2026, the conductor (`claude-code:dlw-conductor`),
written directly from the ground — the owner's specimen (`../icon-cut.html`,
typed in `packages/live-shell/ui/src/inhabitants/sdk/modes.ts`), the world
mockup (`../world-shell-mockup.html`, Revision 5 with 2–4 recorded in
`../WORLD-SHELL-DESIGN.md`), the agent mockups, the device SDK and family
manifests as built, the Expressions device brief, the capability matrices
(via `npm run devices:gaps`), the Ableton RE corpus, and the Glass Bead Game
study (`docs/research/glass-bead-game/05-DLW-RELATION.md` §2). Where
DLW-PLAN, DLW-VISION, WIDGET-GUIDE or the tickets disagree with this file on
device semantics, this file stands; they are conformed to it.

Mockup values (names, hours, counts, sample data) are illustrative. Their
**structure and semantics** are the intent.

---

## 0. The law

1. **Every designed element occupies a Live semantic and keeps its
   invariant.** Set, Track, Clip, Scene, Device, Rack, Chain, Macro,
   Browser, Detail, Transport, Mixer/Return, Automation/Modulation,
   Groove, Capture, Link, Map, Info. An element that does not keep the
   invariant may not claim the semantic.
2. **The grammar is held fixed; the meaning moves per mode.** Same slots,
   same views, same chain, same browser — five meanings (Rev 5). That is the
   Glass Bead Game's one language over every discipline, made literal: Live
   is the organ; the modes are the disciplines played on it (05 §1).
3. **Live mode is the measured basis.** Its devices are ported from the RE
   corpus, not approximated; every other mode's reading of a semantic is
   checked against Live mode's real behaviour. Live later joins Expressions'
   audio+video timeline (owner ruling, `CONTEMPLATION-DLW-INSTRUMENT.md`
   232–252); until then it stays the clean basis.
4. **Owners write; faces read.** A device's write rows carry a write path
   (`kernel:` / `shell.` / `<tool>:`); a row without one is a reading
   (`DEVICE-SDK.md`, the writers law). Nothing moves without a visible cause
   (§14 modulation honesty).
5. **The gate makes it unavoidable** (§5 below). Law a gate cannot check is
   aspiration (`skills/m-prime-development/FOUNDING.md`).

**Settled by the owner — never reopened, never asked (12 Oct 2026):**
five modes, Live the base mode and measured basis, later joined into
Expressions' audio+video timeline; Epi-Logos is a lens, not a mode; Nara
belongs to the Epi-Logos lens, overlaid on the astrology components ported
from Archetypal-Earth; the physics/cymatic simulation IS the sounding
instrument; the day is an automated closure and an instrument/device — no
hours are set; development is unified — every repo a change needs is
changed in the same work, no per-repo owner tickets; a player plays by
downloading the app, making things and projecting them to the shared field;
Technē instruments already act on Expressions; agent-chain order is
Factory's (Ta-Onta). Anything else the code and corpus can answer is
derived, not asked.

### 0.1 Every instrument in every mode (owner ruling, 13 Oct 2026)

Relayed from the DLW documentation session; it supersedes the plain-aperture
rule wherever this file, WSD, WIDGET-GUIDE, DLW-PANES-PER-MODE or the mockup
stated it.

1. **Every pane instrument works in every mode at full capability.**
   Nothing is Technē-only. The detail row's Device side follows the
   **focused pane's instrument** in any mode: a Places, Graph, Timeline or
   Expression pane in Central or Factory gets that instrument's full native
   controls through its devices' exposed parameters. The controls stay out
   of the pane body. A pane that holds no instrument keeps its mode's Device
   side (§2). The mode supplies the material; the instruments stay whole.
2. **Each mode's material reads through the world (planet) grammar.**
   Central: your planet is Central; projects are places on its surface; the
   day's work and its meaningful points are walks on the planet; context and
   files are ephemeral objects in orbit. Factory: a NOW is a planet (a task
   becomes a world); agents are activity around it; subagents are nested
   orbits. Expressions: within every mode as well — the graph projection
   (the 0 instrument) is as apt for Central and Factory as for Expressions
   (projecting context, wayfinder mapping). Live shares the same grammar.
3. **Technē's 0 instrument is the Earth and solar system together with its
   graph view** — the ported atlas's Earth ⇄ Graph. This replaces §2.5's
   earlier reading (M0′ = Project/Wiki/Graph, M4′ = World/Places). The other
   five instruments work the underlying information differently, to develop
   that 0-layer world; their restatement follows the vision spec being
   rewritten in this shape (O-I PR #655, `docs/dlw/`), and until it lands
   §2.5's names for M1′–M5′ stand.
4. **Three forms, three times.** Worlds, expressions and graphs (M5 / M4 /
   M0) can each be live, moved into creative composition, and recorded and
   played back (and so shared).

---

## 1. The ontology — Live semantic → DLW meaning → the Game

| Live semantic | Live's invariant (what makes it that thing) | DLW meaning (all modes) | Glass Bead Game |
|---|---|---|---|
| **Set** | One document holding tracks, scenes, devices, tempo map; one save | The open World context — the material the modes read; one encounter spine (mode × world-context × kernel epoch) | The game as a whole |
| **Session view** | Tracks × scenes grid of launchable clip slots; non-linear | The material in states, launchable: per mode its own grid (§2) | Material in states — symbols admitted, contested, proposed |
| **Arrangement view** | One linear timeline of clips per track, on one ruler | The same material over time, one ruler; the time spine (civil / work / sky strata) | The time spine — the festival course |
| **Track** | A lane of one kind of material; owns a device chain; routes to master/returns | A native stream of one kind (Day, Flow, Session, Expression, …) — never a copy, a projection of the owner's stream | A discipline's voice |
| **Clip / slot** | Launchable material with state (stopped, playing, queued, recording); lives in one track | A native object at a revision with legible state — an Expression's **scene**, an event, a task, an entry (§9.1) | A bead — a symbol with its state |
| **Scene** (Live's row) | A row launching one clip per track together | A **stop**: it stands one or more clips at once — a walk stop, a moment across Expressions (§9.1–9.2). In the DLW the word "scene" means an Expression's scene, a clip | A move of the game — the theme stated across voices |
| **Launch quantize / follow action** | When a launch lands; what follows a clip | When a save/steer/scene lands; what follows (routine, next stop) | The prescribed course |
| **Device — instrument** | Generates signal from input events | Generates: the agent that answers, the physics sim that sounds, the instrument that forms | The fixed instrument sounding |
| **Device — audio/MIDI effect** | Transforms what passes through; keeps the stream | Transforms the material in focus without replacing it (text, highlight, scope, formation) | Transformations — variation, counterpoint |
| **Rack + chains** | Parallel chains under one device; chain selector; zones | A device holding parallel peers (skillset rack's skills, an agentset's agents, Drum Rack's pads) | The Commissions' admitted set of stops |
| **Macro** | One knob mapped to many parameters, with ranges | A chosen control: the ≤4 compact controls of a rack widget; ActSpec's delegated controls (Follow/Bind) | The player's chosen register |
| **Device chain** | Left-to-right serial processing on a track | The work's path: document devices; gateway → agent → skills → world → git; the Studio's sections | The game's sequence of moves |
| **Browser** | Categories + places + search + preview; drag onto a track = admit | Per-mode categories over native owners; dragging into the chain = admission through the neutral door | The Archive — reversible, examined symbols |
| **Groove pool slot** | Under the browser: shared timing templates | The aperture slot: Field · World · Subject · Occasion + the view's controls (Rev 3) | The aperture onto the game |
| **Detail: Clip \| Device** | Bottom pane: the clip's own editor, or the track's device chain | Clip = what is in focus; Device = what works on it (per mode, Rev 4) | The symbol and its working |
| **Transport (28 slots)** | Link, tap, tempo, signature, metronome, quantize, key/scale, follow, position, play/stop/record/overdub, arm, re-enable, capture, punch/loop, draw, keys, MIDI map, rate, CPU | One bar, five meanings — `modes.ts` `SDK_MODE_DECLARATIONS` (verbatim Rev 5), drift-gated by `tests/mode-grammar.test.mjs` | One symbolic language over every discipline |
| **Mixer · sends/returns · routing** | Levels; sends feed shared return tracks; I/O routing | Routing authority: proposals route to owners (the Return), the neutral door, attribution; a refused proposal mutates nothing | Routing authority — the Commissions, the Order |
| **Automation / clip envelopes** | A parameter's value over time, drawn and re-enabled | A parameter's recorded course over the spine (re-enable = hand back to the recorded/owned value) | Theme development over time |
| **Modulation** | A source moving a parameter, shown on the parameter | §14 typed source → parameter routing; `modulatedBy` on a row; "every modulated parameter shows its modulator" | Meditation's guard — no hidden authority (05 §3) |
| **Capture / takes** | Keep what was just played; take lanes for comping | Keep the act as material: capture take, view → scene, selection → packet, worked example | The score — games written down |
| **Link** | Tempo shared with peers | Shared carrier: ground across machines, peers, field sync, SharedField | The Order — players in one time |
| **MIDI / key map** | Bind controls to inputs | Bind phrases/keys to any control | The player's hands |
| **Info view** | Hover shows what a control does | The `data-i` hover law; status bar reading | The teaching layer, in place |
| **Max for Live / SDK** | Build new devices that live in the same chain | The Device SDK + neutral door + seventh-product law | The annual competition — the licensed channel for new symbols |
| **Packs / templates** | Shareable sets of devices and material | Family manifests; Day/Flow/Things/Beings document forms | The canon |
| **Status / CPU** | Engine load, sample rate | Carrier, rate (t/s, fps), load (context %, GPU, projected %) per mode | — |

---

## 2. Per mode — the whole device world of each mode

Each table is the mockup's own placement (`world-shell-mockup.html`: VIEWMAP,
VIEWTIP, DVN, BCATS, CTABS/WID, deviceDetail/formDevice/liveDetail, TPM;
`modes.ts`). **Built** names code; **designed** names the mockup only.

### 2.1 Live — the measured basis

| Semantic | Element | State |
|---|---|---|
| Session / Arrangement | clips and scenes / the song over time | built (`shell/modeGrammar.ts`; Live surfaces) |
| Tracks · clips | Drums, Bass, Keys, Pad, Voice (mockup sample set) over the real `.als` (`live-set`) | built: set read/write over the `.als` |
| Browser | Sounds · Drums · Instruments · Audio effects · Samples · Views | designed (mockup `BCATS.live`) |
| Instruments | Operator, Wavetable, Drift; Drum Rack (`kit`) as rack | built faces: `panels/devices-pro/operator`, `wavetable`; `devices-b2/drift`, `kit` |
| Audio effects | Glue Compressor, Reverb, Echo, Auto Filter, Saturator, Auto Pan, Drum Buss, Chorus-Ensemble, EQ Eight, Multiband Dynamics, Utility, Delay, Hybrid Reverb; Compressor, Overdrive, Redux, Gate, Erosion, Limiter, Filter Delay, Beat Repeat, Channel EQ, EQ Three, Grain Delay, Phaser-Flanger (generic `DevicePanel` over `live-dynamics` parameter tables) | built faces; DSP gated per device in `live-dynamics` |
| Detail | Clip (piano roll) \| Device (Drum Rack → Glue → Reverb) | designed (`liveDetail`); device faces built |
| Transport | the real Live meanings (Link, tap, tempo, …, CPU) | built (`modeGrammar.ts`) |
| Destination | joins Expressions' audio+video timeline | owner-timed (`tickets/T-LIVE-INTO-EXPRESSIONS-joined-timeline.md`) |

### 2.2 Central — the ground

| Semantic | Element | State |
|---|---|---|
| Session | the day as clips: **Day, Flows, Beings, Things, Goals as tracks**; documents and entries as clips | designed (`docgrid`) |
| Arrangement | today on one ruler: entries, runs, NOWs, returns | designed (`tl-today`) |
| Browser | Central: Days · Flows · Beings · Things · Goals; Project: Files · Wiki; New · Views | built in part (`inhabitants/centralBrowserCategories.ts`) |
| Clip detail | Document: form, file, revision, bindings; highlights; notes; packet | designed |
| Device chain (document devices — effects on the open document) | **Text** · **Highlight** · **Notes** · **Packet** · **Answer** (instrument: the situated agent generates the new entry) · the form device: **Die** (Day) · **Participants** (Flow) · **Bindings** (Things/Beings) | built: `day-die`, `flow-document` (document faces), `ground-hygiene`, `impact`, `context-world`, `agent-identity` (`worldShellFamilies.ts`, `centralFamilyManifest.ts`); Text/Highlight/Notes/Packet/Answer designed |
| The Day | **an instrument/device**: the Day die (4+2 faces, ‹ › turns it — the tempo slot); the day's bounds and its **automated closure** come from the Central owner (punch-in · Routine loop · punch-out read the owner's day; nothing hard-coded) | die built (`DocumentDayDieFace.tsx`, `centralDayNowModel.ts`); closure is the owner's automation |
| Companion | the situated agent (Fizz in the mockup): Conversation · Activity · Context · Inspect | built in part (`nara-conversation`, agent dock) |
| Transport | ground · stamp · die face · 4+2 · autosave · save timing · packet Σ · **Answer** · dictate · append · write-arm · hand back · to packet · day bounds · routine · highlight · keys · map · carrier · save state | built (`modeGrammar.ts`) |

### 2.3 Factory — the work

| Semantic | Element | State |
|---|---|---|
| Session | **tracks are sessions, clips are tasks** | built in part (agent shell session grid) |
| Arrangement | the run viewer: one live needle per thread | built (agent shell) |
| Browser | Work: Sessions · Agents · Runs · Chats; Ground: Files · Knowledge · Views; Library: Agents · Agentsets · Skillsets · Worlds | built (`AgentShellBrowser.tsx`) |
| Clip detail | Task log: the selected task's tool-run log | built (agent shell) |
| Device chain | **Gateway** (input routing: hermes transport, approvals) → **Agent** (instrument: generates; autonomy, effort) → **Skillset rack** (rack: skills as parallel chains, admit lights) → **World** (effect: reach, writes prop/draft/dir) → **Git** (output routing: commit/push) — chain order owned by Factory (Ta-Onta) | built: `agentDeviceCatalogue.ts`, agent families; missing owner ops built inside the unified development |
| Rack of agents | **Agentset** = a rack whose chains are agents (parallel) | designed (agent mockup CATS) |
| Companion | the result desk: Activity · Context · Inspect · Results | built in part |
| Transport | peers · ping · effort · budget · heartbeat · interrupt timing · tokens · task.turn.step · **Run** · stop all · voice · **steer** (overdub) · write arm · hand back · capture worked example · plan✓ · routine · deploy · point · keys · map · t/s · context % | built (`modeGrammar.ts`) |

### 2.4 Expressions — the form, sounding

| Semantic | Element | State |
|---|---|---|
| Session | **Expressions as tracks, their scenes as clips** in slots; rows are stops (§9) | built in part (today drawn inverted — §9.5) |
| Arrangement | the Expression's scenes over time | designed |
| Browser | Field: Graph · Scenes · Library · Views | designed |
| Clip detail | **the selected scene (a clip)**: sequence editor (entity lanes × steps), durations, bindings, both sides — visual and audio — in sync (§9.3–9.4) | designed |
| Device = **Studio** | the engine's own controls, as sections: Tools · Selected · Formation · Material · Motion · **Body 3:3** (M1 + M2 + M3, M0, M5 toggles) · **Nara · M4** · Capture | designed (mockup Studio) |
| The instrument | **the physics simulation is the sounding instrument** (instrument semantic): the GPGPU particle field with the cymatic resonator (2D plate, 3D cavity) sounds; M1 generates, M2 modulates (resonance key) | engine built in expressions-app; shell face: `nativeFieldFace.physics` |
| Field devices (one whole device per app panel; three presentations of the same live parameters: **rack widget** in the bottom space the person adds · **expanded** in the browser's lower pool · **full** Studio) | physics · pointer · relational · medium · contacts · morph · focus · colour · ink · depth · resonance | built: nine `components/nativeFieldFace.<key>.ts` + morph/colour native faces; rack widget's ≤4 compact controls = macros |
| Companion | **Anima** — Nara · oracle (the Epi-Logos lens's presence in the form): Anima · Subject · Ta-Onta · Context | designed |
| Transport | field sync · tap · field tempo · 5:3 ratio · pulse · scene quantize · ☿ resonance key · scene.bar.beat · **play scenes** · stop · capture take · layer · Studio arm · re-enable · gestures → scene · scene loop · draw form · keys · map · fps · GPU | built (`modeGrammar.ts`) |
| Destination | gains the audio+video timeline when Live joins | owner-timed |

### 2.5 Technē — the knowing, origin-return

| Semantic | Element | State |
|---|---|---|
| Session | **M3′ Journey**: a walk as scene rows (stops = scenes) | designed (`lens-M3`) |
| Arrangement | **M2′ Relation Field** over time | designed (`lens-M2`) |
| Browser | To hand: Sources · Files; World: Bodies · Locations · Earth places · Palaces · Journeys · Views | designed |
| Clip detail | the encounter: identity, place and time, disclosure, typed relations, bounded constellation, source (ref + revision) | designed |
| Device = **the six instruments** (each an instrument, drawn as one instrument frame with sections; the focused lens expanded, the others folded; in every mode the Device side follows the focused pane's instrument — §0.1) | **M0′** the Earth and solar system ⇄ Graph (§0.1.3; formerly Project/Wiki/Graph: depth, budget, view, kinds, ghosts, source) · **M1′** Canvas/Constellation (tools, snap, layout, relation type, standing, promote) · **M2′** Relation Field/Timeline (projection, strata, standing floor, deep time, window) · **M3′** Journey/Scenes (stops, pace, transition, loop) · **M4′** World/Places (planet builder: body, landmass, climate, sky, locations, relations; scales system · body · region · palace) · **M5′** Palace (rooms, path, guide, portals) | designed (mockup INST + deviceDetail); QL instrument faces built (`qlInstrumentDevice.tsx`, QL family: sky, torus, m3-clock, deck, chakra, m-prime-matrices) |
| Acting on Expressions | instruments already act on Expressions (some); view → scene capture; journey stops carry Expression scenes | built in part |
| Sky / astrology | the Archetypal-Earth astrology components (ported) with **Nara overlaid** — the Epi-Logos lens | AE port built (atlas modules); Nara overlay designed (`DLW-SKY-NARA-INTEGRATION.md`) |
| Companion | **Epii**: Epii · Source · Proposals · Field | designed |
| Transport | field carrier · back to Now · walk pace · stop n/8 · presence · arrival · aperture · view as · Now/Occasion/Walk · **walk** · stop · **record a walk** · extend · instrument writes · hand back to Epii · view → scene · occasion window · place tool · keys · map · carrier · projected % | built (`modeGrammar.ts`) |

---

## 3. What spans the modes

| Element | Semantic | Note |
|---|---|---|
| Mode rail (five icons) + Session/Arrangement icons | Live's view selector, generalised | Epi-Logos is a lens, never a rail entry |
| Panes (split tree, tabs on an auto-hidden rail) | **device type with several devices** (Live: several reverbs under one effect type) | every pane hosts an **instrument type** (Earth, Timeline, Graph, Expression, Document, Sessions, Thread, Terminal, …); a type has several implementations; default sets per mode, users save their own (`DLW-PANES-ONTOLOGY.md` §0, owner's words) — see §8.1 |
| Right dock (companion + tiles: agent, Packet, Trail, Field, Agents, Terminal, Results, Sky, NOWs) | **stretched**: Live's Info/Help views + the agent-shell standard | the agent-shell mockup is the standard (owner ruling 8 Oct) |
| Aperture (World · Local · Shared · Federated) + view-as | the key/scale slot in Technē; elsewhere the aperture slot | — |
| Trail (every encounter kept) | undo history + the encounter spine | one spine, no second selection model |
| Status bar (run context, owner readback, hover info) | Live's status bar + Info view | P0-R5/R6 |
| Shared field (Link 3, projection, upload) | Link | a player projects what they made into the field |
| Epi-Logos lens (Nara over the sky; the corpus as the native game) | a lens on every mode, not a device and not a mode | — |

---

## 4. Misfits and gaps — each with its fix (no questions)

1. **Devices do not declare a Live semantic.** `InhabitantFaceKind`
   (`parameter | document | conversation | instrument`, `manifest.ts:31`)
   is the rack's resident taxonomy (WSD §5), and `DEVICE_FORMATS`
   (`chain-plate | die | scene-strip | run-viewer | instrument-face |
   tool-tile`, `modes.ts`) is presentation. Neither names instrument /
   audio-effect / MIDI-effect / rack / chain / macro / clip / track / scene.
   **Fix:** add `liveSemantic` to the face declaration and gate it (§5).
2. **Twenty-five suite capabilities have no family scope** (`devices:gaps`:
   `(no family scope)`). **Fix — homes by semantic:** search aperture →
   Browser search (all modes); session observatory → Factory arrangement
   (run viewer); flow loop → Central Flow track + document devices; agent
   creation chain → Factory browser New (create a track); rooted world
   navigator → Browser places; CAS source editing → Central Text device;
   CurrentWorld reading → status bar run context; living wiki → Technē M0′
   + Central Wiki category; recursive worlds / world-relative knowledge →
   Technē M4′ bodies + Graph; agentset primitive → Factory Agentset rack;
   participant addressing → Flow Participants device; activity and
   attention → Factory Activity tile; workcell placement intent → Factory
   World device; versioned-world faculty → Arrangement (every mode) +
   re-enable; desktop agency encounter → companion dock; cradle frame
   grammar / kernel / verification / embodiment / surface host → the shell
   itself (no device). Each lands as a family declaration in the owning
   family.
3. **Mixer, sends and returns exist only in Live mode.** In the other modes
   the routing semantic is carried by the Return (proposal → owner), the
   neutral door and attribution. **Fix:** declare the Return as the
   send/return semantic (`routing` row on the World and Git devices; Central
   Answer's append/replace); no mixer is drawn outside Live.
4. **Automation lanes exist only in Live mode.** Elsewhere a parameter's
   course over time is the §14 modulation and the owner's revision history.
   **Fix:** re-enable (hand back) is the automation-re-enable semantic in
   every mode; the Arrangement shows revision clips, not drawn envelopes.
5. **Macros are named twice under other words.** Rack-widget compact
   controls (≤4, `DEVICE-PANEL-BRIEF.md` rule 8) and ActSpec delegated
   controls (`AGENTIC-CONVERGENCE.md`). **Fix:** both are `macro`; the gate
   checks a macro maps declared rows of its own device.
6. **The Central title still reads "Base · Central"** (`inhabitants/sdk/modes.ts:159`,
   `shell/modeGrammar.ts:228`). **Fix:** title "Central" (T-LABELS).
7. **Day hours are hard-coded in text** (mockup sample "08:30 / 21:00";
   copied into `modes.ts:175` and `shell/modeGrammar.ts:282` — "day opened 08:30 · close routine ·
   21:00", WIDGET-GUIDE §4.1, PATH, DLW-PLAN). **Fix:** the punch row reads
   the day's bounds and automated closure from the Central owner; the
   meaning text says "day opened · close routine · day closes".
8. **Expressions Studio sections are not yet devices in the chain.** The
   Field devices are built; the Studio's Tools / Selected / Formation /
   Material / Motion / Body 3:3 / Nara · M4 / Capture are designed only.
   **Fix:** Studio = the Expressions device chain; each section is a device
   (Body 3:3 and Nara · M4 are instrument/modulation devices on the
   physics instrument).
9. **The Technē instruments are drawn as one frame per lens in the mockup
   and as separate QL faces in code** (sky, torus, m3-clock, deck, chakra,
   m-prime-matrices). **Fix:** the six M′ instruments are the instruments;
   QL faces are devices inside the instrument whose lens they serve (sky →
   M4′/M2′, torus → M1 body, m3-clock → M2′/M3′).
10. **The right dock stretches Live** (§3). Kept, bounded: no fifth
    surface. (Panes are not a stretch: they are instrument types, §8.1.)

---

## 5. Making it unavoidable — gate rules

Added to `inhabitants/sdk/validate.ts` with the vocabulary in `modes.ts`
(same commit as the law, per FOUNDING):

1. **`liveSemantic` is required** on every face declaration, from the closed
   vocabulary of §1 (`device-instrument`, `device-audio-fx`,
   `device-midi-fx`, `rack`, `macro`, `clip`, `track`, `scene`, `browser`,
   `detail-clip`, `transport-slot`, `return`, `link`, `info`, …). Unknown or
   missing → refused at admission, fault named.
2. **Mode legality.** A semantic must be legal in each mode the face claims
   (table from §2; e.g. a Technē device-chain face must be
   `device-instrument`; a Central chain face is a document device —
   `device-audio-fx` on the document, or `device-instrument` for Answer).
3. **Invariants.**
   - `device-instrument` declares the owner op that generates (write path);
   - `device-audio-fx` / `device-midi-fx` declares the material it transforms
     and keeps the stream (no replacing write without a receipt);
   - `rack` declares its chains (≥1) and its chain selector;
   - `macro` maps ≥1 declared row of its own device, with ranges;
   - `clip` binds native material by ref + revision with a state;
   - `track` names its native stream (no copied store);
   - `scene` names the clips it launches together.
4. **Presentation follows semantic.** The format stays (`chain-plate`, `die`,
   …) but must be compatible: `die` only for the Day instrument; `run-viewer`
   only for `track`/`arrangement` in Factory; `instrument-face` only for
   `device-instrument`.
5. **Live-basis cross-check.** A semantic that has a Live-mode exemplar
   carries a pointer to it (device dossier or `.als` behaviour in
   `Work/reverse-engineering/ableton-live-12.0.25/`), so the DLW reading can be checked
   against the measured original.
6. **The registry is generated.** `devices:validate --json` emits the
   world's semantic registry (every face: family, modes, semantic, format,
   write paths); a test locks it, so a semantic change is a reviewed diff.

---

## 6. Conformance — the plans

The plans are conformed to this file before any build resumes:
DLW-PLAN, DLW-VISION, WIDGET-GUIDE, PATH, MAP and the tickets drop what this
file shows to be invented or already settled (owner questions, invented
tickets, hard-coded day hours, Nara framed outside the Epi-Logos lens, the
physics sim's sounding treated as open, per-repo owner tickets). The list
is made against this file and applied in one pass.

---

## 7. Archetypal-Earth — the instrument pattern and the time grammar (12 Oct 2026)

Archetypal-Earth (`Work/Archetypal-Earth`, HEAD `35f76aa`) is not only the
globe the shell ports: it is a finished instance of the instrument the DLW
builds, and its threads and walks are the basis for the Timeline (M2′), the
Journey (M3′) and how both eventuate in a full Expression.

### 7.1 The instrument pattern (AE `ProjectCentral/docs/MODES-RFC.md` §2–4)

| AE | Live semantic | DLW |
|---|---|---|
| The shell: one title, one menu, one lens-controls slot, one panel host; owns all chrome | the instrument frame | the Technē instrument frame (one frame, sections) |
| A **lens** = plugin `{mount, enter(route), leave}`; hands the shell its few controls; never touches another lens | device in the instrument's chain | a device inside the instrument; its controls go to Detail → Device |
| Field (globe + graph), Theory (+ Dynamics), Aion, Red Book | devices of M0′/M4′ (field), M2′ (Aion), M3′ (Red Book, dynamics routes) | as listed |
| Astrology (natal sky beside Jung's, walked planet by planet) | device on the sky scale | the **Epi-Logos lens's Nara overlay** on the ported sky |
| Dreams, Symbols, Coincidences (practice, private) | devices, private storage | practice devices, personal store, never in a link |
| **Filters** (works, cultures, era, kinds) — one mask, never a mode | browser filter / aperture | the aperture + browser filter; never a new mode |
| Graph = a second rendering of the field; Sky = a scale of the globe | view switch / zoom scale | Earth ⇄ Graph projection; System · Body · Region · Palace scales |
| **One shared time control** — non-linear scale, era names, subject density trace, one play; "while a thread's walk stands, the one transport button serves it; the clock's own play yields" (`src/ui/time-control.ts:33`) | transport + arrangement overview | **one transport, five meanings** — in Technē, Play = walk |

### 7.2 The time grammar (AE `src/types/history.ts`, `aion/`, `data/thread.ts`, `globe/chronology.ts`)

| AE | Live semantic | M2′ Timeline (Arrangement) |
|---|---|---|
| **Reading** — one author's view of time; later readings `extends` and never rewrite | a track group / layer above | a reading is a layer of tracks; extensions stack as layers, never overwrite |
| **Epoch** — nested half-open spans; the narrowest supplies the atmosphere (palette, polarity, spectrum) | arrangement sections (locators), nested | nested sections on the ruler; the narrowest colours what plays inside it |
| **Event** — year, place, passages, the families and occurrences it gathers | arrangement clip | a clip at its year and place, carrying its passages and gathered material |
| **Thread** — ordered event ids; the **whole-reading walk** derived chronologically, never stored | a follow-action chain through clips | a walk track: an ordered path the transport plays |
| **Field thread** — a subject's located occurrences by year, thinned to one per time bucket, the rest kept as `also`; arcs between moved places | clip with its take lane / stack | a walk whose stops carry their bucket-mates (nothing dropped) |
| **Chronology path** — the subject's places in date order, drawn along the cursor | the playhead's trace | Earth follows the playhead (Follow slot) |
| **Standing stop** — tunes the clock to its year and the globe to its place | follow + position | the stop is the transport position and the encounter |
| Density trace of the subject on the scrubber | arrangement overview | the ruler's overview |

### 7.3 How a timeline eventuates in the full Expression

**Thread (M2′, a walk track on the ruler) → walked (M3′ Journey: its stops
as rows — Technē's Session) → each stop launches the Expression scene(s) it
carries (a walk goes through a sequence of Expressions or through the scenes
within one Expression — §9.2)
(the mockup's `WALK[].ex`) → captured (Technē transport: record a walk;
view → scene) → the Expression's scene sequence (Expressions Session scene
rows, Arrangement "the scenes over time") → sounded and formed by the
physics instrument.** One transport serves every step: in Technē Play walks,
in Expressions Play plays the scenes; position and Follow carry the standing
stop across.

### 7.4 What the shell has, and the fixes

1. **The port is stale.** `packages/live-shell/ui/src/projections/atlas/src`
   holds 66 modules; AE now holds 119 — 53 never ported (incl. `aion/walk.ts`,
   `globe/chronology.ts`, `dynamics/*`, `redbook/*`, `lenses/*`,
   `shell/*`, `astro/*`, `sky/{wheel,zodiac,orbits,cards,camera,compose}.ts`)
   and 51 of the shared modules differ; AE has 68 commits since the port.
   **Fix (T-AE-REPORT):** re-port verbatim at AE HEAD (the port law: copy
   first, adapt hosts after), pin the AE commit in the port, and add a drift
   check that names every module that differs from the pinned AE commit.
2. **The Timeline contract has no sections and no walks.** `WorldTrackSet`
   (`timeline/worldTrackAdapter.ts`) carries columns, tracks, clips, takes;
   `aionTimeline.ts` folds epochs into flat columns, makes events one-year
   clips and copies threads as clip tracks — the walk (order, stepping,
   `also`, place, clock tuning) is lost. **Fix (T-TIMELINE-WALKS):** extend
   the contract with nested sections and walks (ordered stops: clip ref,
   year, place, `also`, the Expression scene it carries), re-project Aion
   (readings as layers, epochs as sections, events as clips, threads and the
   whole-reading walk as walks), and project AE's field threads and Red Book
   and dynamics routes through the same walk shape.
3. **The Journey "waits for the journey owner"** (`shell/modeGrammar.ts:442`).
   The owner is the ported AE walk modules. **Fix (with T-TIMELINE-WALKS):**
   Technē's Session (M3′) reads the walks; Play walks them (pace, stop n/N,
   arrival quantize, Follow) as the mockup's transport already specifies.

---

## 8. Clarifications (owner, 12 Oct 2026)

### 8.1 Instrument types, several implementations — and the two graphs are two instruments

Every pane hosts an instrument **type**; a type may have several
**implementations**, selectable like Live's several reverbs
(`DLW-PANES-ONTOLOGY.md` §0, the owner's words). Settings live in the
workspace's sets, never in browser storage, for every type with more than
one implementation.

The two graphs are **not** one type (owner correction, 13 Oct 2026; this
replaces the earlier reading of them as two implementations under one Graph
parameter model):

- the **Archetypal-Earth / atlas coloured graph** is the second view of the
  **0 instrument** — the Earth and solar system ⇄ Graph (§0.1.3;
  `packages/live-shell/ui/src/projections/atlas/src/graph/`, the switch on
  key G). Its own settings are its own: four forces, the dust (occurrences),
  the tie bases (jung · inferred · site), the node tiers
  (`Work/Archetypal-Earth/src/graph/settings.ts`), moved from browser
  storage into the workspace's sets. There is no separately planned Graph
  instrument; it is folded into the 0 instrument.
- the **knowledge graph** (the wiki constellation, Obsidian-RE-derived;
  `desktop/cradle/src/knowledge/GraphCanvas.tsx`,
  `docs/cradle/WIKI-CONSTELLATION-SPEC.md` §4–5) is its **own standalone
  instrument**, which any pane in any mode can hold (§0.1.1). Its controls
  are its spec's: depth, budget, view (list · tree · graph · form), kinds,
  ghosts, standing floor, relation types, the shared filter.

§0.1.2's "the graph projection (the 0 instrument)" names the world's graph
view; the knowledge graph stays distinct from it.

### 8.2 Palaces are curated systems within a corpus or project

A **Palace** (M5′) is a curated system over one corpus or project.
Archetypal-Earth's modes are the worked foundation: Aion (a reading — epochs,
events, threads), the Red Book (a folio walk), Theory with Dynamics (concepts
and their routes), Astrology over the Sky (a walk planet by planet), all
standing on the Field. Read as a palace: its **rooms** are its curated
sections (epochs, folios, chapters, concepts, planets); its **path** is its
walks (M3′); its **objects** open at their revision and are owned by the
corpus, never by the room; its **portals** lead to other palaces and places;
private rooms hold the practice material (dreams, coincidences); its Return
proposes to the owner. Live: a palace is a curated Set — tracks, sections,
scenes and walks assembled for one body of material.

### 8.3 What plays at a stop

The Expression a walk's stop carries is the media of that moment — images,
video, live renders with sound (the physics instrument sounding). A walk is
therefore a sequence of Expressions, or of scenes within one Expression,
over the ruler (§9.2): the Timeline's thread, walked, is what the
Expressions play (§7.3).

### 8.4 Port the code, not the shortcuts

Archetypal-Earth stands alone, so in places it handles data more loosely than
O:I allows: data fetched from `public/data/*.json`, settings in browser
storage, modes as flags on one state. That is fine for the app; it is not
the DLW's. The port copies AE's code verbatim and adapts at the host seam:
material comes through the corpus provider seam (C2) and native owners with
refs and revisions; projects and corpora through ProjectCentral; settings and
default sets through the workspace; modes through the shell's one spine. Each
such adaptation is recorded beside the pinned AE commit (T-AE-REPORT).

---

## 9. Tracks, clips, stops — one ontology, and Live's clip editing in every mode (owner, 12 Oct 2026)

### 9.1 The rule, and the word "scene"

**Expressions are to scenes as Live's tracks are to clips.** An Expression is
a track; its scenes are its clips. So in the DLW **"scene" always means an
Expression's scene — a clip.** Live's own "scene" (the row that launches one
clip per track together) is called a **stop** here: a stop stands one or more
clips at once. Every mode reads the same three levels:

| Mode | Track | Clip | Stop (Live's scene row) | Takes (lanes under a clip) |
|---|---|---|---|---|
| Live | audio / MIDI / group / return | audio / MIDI clip | scene | take lanes, comping |
| Expressions | **an Expression** | **a scene** | a moment across several Expressions | captured takes of a scene |
| Technē (M2′ ruler / M3′ Journey) | a native stream: a reading's thread, a subject's occurrences, a journey, runs, revisions, sky | an event, occurrence or revision at its time and place | a **walk stop**: it stands its event and launches the Expression scene(s) it carries | readings that extend a reading (layers, never rewrites) |
| Factory | a session | a task | a launched batch (Play: "every queued one") | **attempts** (attempt 1 failed · attempt 2 …); comping = choosing the attempt that lands (review) |
| Central | a stream: Day · Flows · Beings · Things · Goals | an entry or document | the day's face (the die) standing its entries | revisions (draft · saved · edited since save) |

### 9.2 A walk

A walk is an ordered sequence of stops, and it takes one of two shapes —
both Live mechanics:

- **through a sequence of Expressions** — each stop launches a scene on a
  different Expression (a track change at each stop): Live's **scene follow
  actions**, row to row;
- **through the scenes within one Expression** — the stops step down one
  track's clips: Live's **clip follow actions**, clip to clip in a track.

A walk may mix them. Launch quantize is the walk's arrival; pace is its
tempo; Follow keeps the view on the standing stop. **Record a walk** is
Live's Session → Arrangement recording: the walk, played, is laid out on the
ruler as clips on Expression tracks. This replaces "a walk is a sequence of
Expressions" in §7.3 and §8.3: a walk goes through a sequence of Expressions
**or** through scenes within an Expression.

### 9.3 Two sides of one track and one clip — sight and sound

An Expression (track) and each of its scenes (clips) has two sides, one
state:

- **visual** — the form: glyph projection, the field, images, video, live
  render;
- **audio** — the sound: the physics instrument sounding (M1 generates, M2
  modulates), entity voices, `followCymatic`.

Sound and form are projections of one state (the musical law: common cause),
so the two sides stay locked: edit one and the other follows. Live's own
parallel is a video clip on an audio track — the picture in the video window,
its sound in the track — and the joined audio+video timeline Live becomes in
Expressions later (owner ruling). In the Arrangement each Expression track
shows both lanes, picture over sound; the Clip detail shows both sides of
the selected scene in sync.

### 9.4 Live's clip editing, carried into every mode

Live's Clip view is the richest editor in the product. Each part has a home
in every mode's Clip detail:

| Live Clip view | Expressions — a scene | Technē — an event | Factory — a task | Central — an entry |
|---|---|---|---|---|
| Clip box: name, colour, signature, groove | scene name, colour; signature = the field ratio (5:3) | name; standing (fact · claim · inferred · hypothesis) as colour and dash | task name; state | entry title; form |
| Launch box: mode, quantize, legato, follow actions | scene launch quantize; follow = the next scene of the walk | arrival; follow = the walk's next stop | Run; quantize = when stop/steer lands (next tool); follow = the next queued task, the routine loop | — (entries are read, not launched) |
| Start / end / loop markers, loop brace | scene in / out; scene loop | the event's span; the occasion window (Technē's loop brace) | the write window (plan ✓ … deploy) | the selection / highlight range |
| **Note editor** (piano roll: rows × notes; velocity, chance; draw; fold; scale awareness) | the **sequence editor**: entity lanes × sequence steps (a step's hold + transition = a note's length + glide); fold to used entities; scale = the ☿ resonance key | the material an event gathers (its occurrences and passages), by time | the tool-run log: tool calls as notes on the task's time | the document itself, edited by the document devices |
| **Sample editor** (waveform; warp markers, warp mode; transpose, gain, reverse) | the audio side of the scene: what the plate sounds, pitch riding the plate, voice gains | warp = the non-linear deep-time scale (material time mapped onto ruler time — AE's time scale) | — | — |
| **Clip envelopes** (automation and modulation inside the clip) | Field-device parameters over the scene (physics, resonance, colour, …), each lane showing its modulator (§14) | — | effort / budget over the task | — |
| Take lanes, comping, consolidate | capture takes; comp the take that stands; consolidate = save the scene | readings as layers | attempts; comp = review and land the attempt | revisions; consolidate = save |
| Draw mode, keys, MIDI map | draw form (the Studio's form tool), keys, map | place tool | point (mark a tile for the armed agent) | highlight pen |

### 9.5 What the shell has, and the fix

`timeline/expressionsTrackAdapter.ts` projects **scenes as columns, entities
as tracks and sequence steps as clips** — that is the inside of one scene,
the sequence editor (§9.4, note editor row), drawn at the track level.
**Fix (T-EXPRESSION-TRACKS):** at the Timeline level, Expressions are tracks
and scenes are their clips, each track with its visual and audio lanes; the
entity × step projection moves into the Scene's Clip detail as the sequence
editor; stops are rows; takes are a scene's captured takes.
