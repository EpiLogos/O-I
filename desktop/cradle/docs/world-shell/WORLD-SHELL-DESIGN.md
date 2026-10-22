# World shell design — one World, four projections, real panes, one rack

Owner-commissioned design contemplation, 8 October 2026, in conversation.
Companion to §4.2 (the measured Live 12 study, folded in from the retired `UI-UX-CONVERGENCE-STUDY.md`) and
`FUNCTIONAL-CROSSWALK.md` (the 126-target accounting). This document is the
design intent the shell convergence builds towards; every claim below is
grounded in code that exists today, referenced by path and line where it
matters.

It supersedes the conversational planning transcript's hierarchy framing and
integrates the owner's corrections: projections are not a hierarchy; panes
are real panes; Central is resolved by the shell's own grammar, not a
separate mode; documents and curated features become inhabitants of the rack;
the Jung atlas (`Work/Archetypal-Earth`) is a found, owned implementation —
the Earth projection's seed, not a missing input.

**Visual mockup:** [world-shell-mockup.html](world-shell-mockup.html) —
revision 5, the final pass. Earlier rounds are kept as `world-shell-mockup-r4.html` …
`-r1.html`, with their renders.

---

*History: the mockups hold the forms; the manual states the current ones.*

## Revision 5 — one transport, five meanings (8 October 2026)

**The rack:** Session and Arrangement view icons, then the mode icons: Live
(music, the shell's base mode, restored), Central, Factory, Expressions
and Technē. *(12 Oct 2026: Rev 5 titled the Central icon "Base · Central";
under the owner's five-mode ruling, CONTEMPLATION-DLW-INSTRUMENT.md:232-252,
the title is "Central" — the code still carries the old title, ticket T-LABELS.)*

**Every mode keeps the same transport slots in the same places.** Only their
meaning changes:

| Slot (Live) | Central (Rev 5 title "Base · Central", T-LABELS) | Factory | Expressions | Technē |
|---|---|---|---|---|
| Link · Tap | ground sync · stamp Now into the document | peers · ping agents | field sync · tap tempo | field carrier · back to Now |
| tempo ‹ › · signature | die face (‹ › turns it) · 4+2 | effort · budget | field tempo · 5:3 ratio | walk pace · stop n/8 |
| metronome · quantize | autosave · save timing | heartbeat · interrupt timing | pulse · scene quantize | presence · arrival |
| key / scale | packet token count | tokens in · out | ☿ resonance key | aperture · view as |
| ▶ ■ ● + | **Answer** (send the packet) · stop · dictate · append/replace | run · stop all · voice · steer | play scenes · stop · capture take · layer | walk · stop · record walk · extend |
| arm · re-enable · capture | agent write-arm · hand back · selection → packet | write arm · hand back · capture | Studio arm · re-enable · gestures → scene | instrument writes · hand back · view → scene |
| punch · loop · punch | day opened 08:30 · close routine · 21:00 | write window · routine | scene loop | occasion window |
| draw · keys · MIDI · kHz · CPU | highlight pen · keys · map · carrier · save state | point · keys · map · t/s · context | draw form · keys · map · fps · GPU | place tool · keys · map · carrier · projected % |

**What the Session and Arrangement icons show in each mode:**

| Mode | Session | Arrangement |
|---|---|---|
| Live | clips and scenes | the song over time |
| Base | the day as clips: Day, Flows, Beings, Things and Goals as tracks | today on one ruler |
| Factory | sessions and tasks | the run viewer |
| Expressions | scene rows | the scenes over time |
| Technē | the Journey | the Relation Field |

**Expressions follows Technē's example.** The pane holds only the living field.
The tool rail, toolbelt and Library move into the Studio (Device), as Tools
and the selected object's actions. The scene strip moves into Clip, beside
the sequence and bindings.

Renders:
- `world-shell-mockup.png`
- `-base-session`
- `-live`
- `-factory`
- `-factory-arrangement`
- `-expressions`
- `-expressions-scene`
- `-techne`
- `-techne-clip`

---

## Revision 4 — agent-shell standards recovered (8 October 2026)

These corrections apply on top of Revision 3.

- **Mode selector and panes are icons.** The arrangement selector is icons
  only. Panes are controlled by one icon (⊞) with a small menu: split beside,
  split below, four-fold, close. Panes form a split tree with no fixed count.
  Drag a tab onto a pane's centre to move it there, or onto its edge to snap
  it into a new split.
- **Instruments are not inside panes.** The detail row is **Clip | Device**,
  toggled from the status bar as in the agent shell, and each arrangement
  gives the pair its own meaning:

| | Clip — what is in focus | Device — what works on it |
|---|---|---|
| Base | Document: form, file, revision, bindings; highlights; notes; packet | Devices: Text · Highlight · Notes · Packet · Answer · the form device |
| Factory | Task log: the selected task's tool-run log | Agent chain: gateway → agent → skills → world → git |
| Expressions | Scene: sequence, durations, bindings | Studio: the engine's own controls |
| Technē | Clip: identity, place and time, disclosure, typed relations, bounded constellation, source | Instruments: the six Technē instruments. The one open on the focused pane is expanded with its own controls; the others are folded, and clicking one opens it on the focused pane |

- **The right side is the agent-shell dock again.** Context tiles sit above:
  the agent (Fizz, Epii or Anima), Packet, Trail, Field, Agents, Terminal,
  Results, Sky, NOWs. The 2×2 launcher below opens tiles and never feeds the
  centre. Views come into panes from the browser's Views category.
- Renders: `world-shell-mockup.png` (Base · Devices), `-base-clip`,
  `-factory` (Task log), `-factory-device`, `-expressions`, `-techne`
  (Instruments), `-techne-clip`, `-techne-quad`.

---

## Revision 3 — four arrangements, real bodies, instruments that are instruments (8 October 2026)

The owner's corrections to revision 2, and what the mockup now does about each.
Where this conflicts with Revision 2 below, this revision stands.

**Arrangements are composed differently, not one shell with a rack in every
mode.** The O:I #375 table is now the mockup's spine. Base, Factory,
Expressions and Technē each give the left, centre, right and detail regions
their own defaults; the encounter carries across, and each arrangement keeps
its own panes.

| | Left (browser + aperture slot) | Centre | Right (companion) | Detail |
|---|---|---|---|---|
| **Base** | Central: Days, Flows, Beings, Things, Goals; Files, Wiki; New (exactly Day · Flow · Beings · Things) | the documents themselves, paper-toned | the situated agent: Conversation · Activity · Context · Inspect | document devices |
| **Factory** | Sessions, Agents, Runs, Chats, Files, Knowledge | session grid · thread | result desk: Activity · Context · Inspect · Results | the agent chain: gateway → agent → skills → world → git |
| **Expressions** | the compact bounded graph, Scenes, Library | the living field: tool rail, toolbelt, scene strip, Library | Anima (Nara/oracle) | the Studio: the engine's own controls |
| **Technē** | sources to hand (open in instrument / add reference), Bodies, Locations, Earth places, Palaces, Journeys | the current lens, the six on the lens bar | Epii: Epii · Source · Proposals · Field | the instrument's own controls |

**Base is Central's ground.** The four document forms
(`desktop/cradle/documents`: `ql-daily-die.html`, `ql-flow.html`,
`oi-beings.html`, `oi-things.html`) are drawn as they are: the Day die's six
positions (4+2) with the open face; Flow's Dialogue · Flow · Journal with
declared participants (a person drawn solid, an agent dissolving into points);
Things and Beings with their bindings (world, subject, C1–C4 office, sources).
The highlight-context system is the forms' own selection tool, *Highlight ·
Note · To packet · Answer this*. Text editing and highlight context then
appear as document devices in the detail row: Text · Highlight · Notes ·
Packet · Answer · and a form device (Die faces · Participants · Bindings).
The packet is shown as exactly what the agent receives, and the companion's
Context tab shows the same packet.

**Panes have no headers, and there is no bar above them.** A view is an
aperture you pull in from the launcher or the browser. It opens as a tab on
the pane's auto-hidden left rail, and ⇧ splits. Each pane keeps its own
context: following the encounter, or pinned. The focused pane's context and
view controls live in the aperture slot under the browser, where Live keeps
the groove pool: Field · World · Subject · Occasion, the view's own controls
(scale, lens, document view), and the pane layout. The four concepts #375
asks to keep apart are now apart: arrangement selector (transport), Surface
tabs (pane rail), lens navigation (the Technē lens bar), view controls
(slot).

**Technē: the instrument is the instrument.** No separate "Technè rack"
composes an instrument out of devices, and none appears in other modes. In
Technē the detail row is the focused lens's own native control set, drawn as
one instrument frame with sections; those controls are what modify its
fundamental form. Every pane instrument works in every mode at full
capability (owner ruling, 13 October 2026, retiring the earlier plain-aperture
rule): in any arrangement the detail row's Device side follows the focused
pane's instrument, so a Places, Graph, Timeline or Expression pane in Central
or Factory carries that instrument's full native controls through its
devices' exposed parameters. The controls stay out of the pane body. The mode
supplies the material; the instruments stay whole.

**World / Places renders real bodies in one space.** Planets are lit by the
field's star, so they show phases, and each is procedurally generated from its
World's own parameters. Earth is your local root anchor, the Mūlādhāra
relation: it carries real geography and is never the default body for anyone
in a shared field. Other Worlds show their own built bodies: an arid world, an
archipelago, a ringed ice world. Relations between bodies are the connective
layer:
- anchor
- participate
- contribution, with its flow
- watch
- projection
- federate
- A2A, while a contact is open

Scales are System · Body · Region · Palace. In the Body scale your located
artefacts draw anchor lines to their real places on Earth; Stone Bay, for
example, anchors to Bollingen.

**Planet building is a first-class part of the World instrument.** Its native controls:
- **Body:** your body, or Earth; name; seed and reroll.
- **Landmass:** sea level, continents, relief, coast (smooth · fjord ·
  archipelago).
- **Climate:** warmth, moisture, ice caps.
- **Sky:** atmosphere, clouds, axial tilt.
- **Locations:** place · palace · portal · route; click the body to place one,
  name it (names are suggested from the seed), and see its list with anchors
  and portals.
- **Relations:** which relations between bodies are shown.

Earth's landmass controls are disabled ("Earth is given"); another World's
body is read-only.

**Fewer titles.** The window title is the subject and the day. Only the
companion has a header line. The Mercurius walk now appears only where it
does work: the Journey lens, the Journeys list, the palace loggia.

**Renders:**
- `world-shell-mockup.png`: Base, Day and Flow
- `-things`
- `-factory`
- `-expressions`
- `-techne-system`
- `-techne-federated`
- `-techne-body`
- `-techne-region`
- `-techne-earth`
- `-techne-m0`: the Project graph as form
- `-techne-quad`

Linkable states: `?mode=techne&lens=M4&scale=body&body=earth&ap=3`,
`?mode=base&doc=thing&layout=solo`.

**Honesty notes.** Planet bodies are a CPU stand-in (seeded value-noise
fbm, bilinear sampling) for the GPU globe engine. Earth's land comes from
coarse coastlines. Document text and source passages are written for the
mockup, as paraphrases with locators. The data is a fixture shaped like the
native contracts.

---

## Revision 2 — the mockup rebuilt to the owner's intents (8 October 2026)

The owner asked for the world mockup to be brought to the agent-shell
standard and to the intents worked out in conversation: your World is a
planet in a solar-system-like shared field; local and shared are one UX at
different apertures; the graph is the encounter engine; and Technē is
accounted for at the UX level as its six instruments. The mockup is meant
to be lifted by development agents, so it is written as a component reference
(its header lists the functions to lift).

**What it settles, in the mockup itself:**

- **Three orthogonal axes.** *Arrangement* (Base · Factory · Expressions 3:3 ·
  Technē — the transport's surface buttons; each keeps its own panes) ×
  *projection* (Earth · Timeline · Constellation · Expression — per pane) ×
  *device* (the rack). Switching any one keeps the encounter.
- **The spine is a bar** above the panes: Field › World › Subject ›
  Occasion, plus the mediation of the current encounter (search · graph
  traversal · direct · journey · palace · contact · return · placed).
  `encounter()` is the only transition; the Trail tile keeps every encounter
  and returns to it.
- **Aperture** (transport): World · Local · Shared · Federated. Search,
  Earth, Constellation and Timeline all admit the same; results beyond the
  aperture are counted and offered ("＋ 2 more beyond the aperture — widen").
- **View as** (where Live has key/scale): me · field · public. Your planet
  fogs everything not projected; the rack's Projection device shows the
  disclosure ladder; raising an audience always asks first.
- **Earth / Solar system is the World's body at five scales**: *Field* (Worlds as
  planets around the SharedField hub; a nested field ringed; a federated field
  at one remove; contributions travel as particles), *Orbit* (the homepage —
  your planet with agents, NOWs, recent Expressions and encounters, watched
  relations and project-world moons in near orbit; the cosmos layers M1 torus ·
  M2 sky · M3 clock around it), *Surface* (artefacts placed round the globe,
  clustered; walks drawn as routes; the agent's reading lines), *Place*
  (precision ring, the relation type per artefact, reference frame, scale
  bar), and *Palace* — a special location you enter: rooms composing
  native refs, a guided path, portals out, a private room that fogs for every
  audience, Epii explaining why each room exists.
- **Visiting another World** lands on its *projection*: tinted, fogged, only
  what it projected, its agent reachable (A2A contact → returned difference →
  admit as a claim attributed to its source).
- **Timeline holds the Relation Field and the Journey.** The Arrangement presentation is the Relation
  Field: authored history beside development (runs, revisions, the Day,
  machine NOWs, FieldNow) on one non-linear ruler with a declared break into
  today; lenses chronology · causal · recurrence · concurrency; clips drawn in
  their epistemic standing (fact · claim · inferred · hypothesis · disputed ·
  ghost), never upgraded by placement. The Scenes presentation *is* the
  Journey: Live's scene rows as walk stops (place · occasion · artefact ·
  Expression · narration · transition). ▶ walks it; ● records a new walk from
  your encounters.
- **Constellation holds the Project graph and the Canvas.** *Field*: the bounded local whole
  (depth, budget, ＋ expand, ghosts for unresolved links) as list · tree ·
  graph · **form** — the graph-expression of your World. *Canvas*: the
  artefact suite — drag is presentation, frames are presentation, a drawn
  relation is a proposal until promoted through the relation owner's Action.
- **Expression is the 3:3 reading** with its M0–M5 layers; the rack's cut switch
  crosses between Technē and Expressions (the Journey's crossing into a scene and
  back).
- **The rack follows the focused pane's instrument** (chains per Technē
  instrument and for 3:3), with the six instruments as chips. Every device has one parameter model
  with three presentations: compact face, expanded pool (header click), full pane
  (⤢).

**Transport functions** (Live control → World function): Link → field
carrier · Tap → back to Now · tempo → walk pace · signature → walk stop ·
metronome → FieldNow presence pulse · key/scale → View as · Follow → panes
follow the encounter · Now/Occasion/Walk → which clock drives the panes ·
Play → walk the Journey · Record → record a walk · Overdub → extend the
walk · loop brace → occasion window · draw → Place tool (presentation
placement) · Earth button → Home (your planet at orbit) · sample rate →
carrier and round-trip · CPU → share of your World projected.

**Renders:** `world-shell-mockup.png` (home, orbit) · `-field` (aperture
federated) · `-surface` · `-place` · `-palace` · `-quad` (Technē, all four
projections of one encounter) · `-factory` (concurrency + the Project graph) ·
`-scenes` (a walk at stop 7) · `-canvas` · `-visit` (Ariadne's projection +
A2A contact) · `-expressions` · `-viewas` (your World as the field sees it).
Linkable states: `?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`.

**Honesty notes.** The data is a fixture shaped like the native contracts
(Explore entries, typed relations with standing, Participant/Projection/
Contribution, FieldNow). The globe is a canvas stand-in for the Archetypal-
Earth engine; the sky values are illustrative, not provider output; source
passages are paraphrases with locators. Nothing here claims an owner that
does not exist yet.

---

## 1. The design law

**One World, four projections, real panes, one rack.**

- The **World** is the shared semantic field owned by native owners (kernel
  expressions/scenes/acts, wiki, graph, Factory work, QL cosmic composition,
  civil time). It is never rendered directly; it is always encountered
  through a projection.
- **Four primary projections** render the same World material:
  Earth/Solar-System (space), Timeline (time), Canvas/Constellation
  (relation), Expressions (form). Graph and agent/filesystem are implicit
  inspectors callable from any projection — never competing top-level modes.
- **Panes are real panes.** The center of the shell is a composition of
  panes from the existing surface engine, each holding a projection instance
  or a surface, each carrying its own rack. No UI is crammed into footers
  and headers to compensate for missing pane space.
- **One rack.** Devices — native parameter editors, documents, conversations,
  curated apps, mode plugins — attach to the rack of the pane whose
  encounter they operate on. The rack is the plugin system of the whole
  environment, generalised from Ableton's device chain.

The rack is not a hierarchy layer under the projections; the projections are
not features of a monolith. One material, many projections; one encounter,
many devices; nothing is copied into view-specific domain models.

## 2. The spine: the encounter machine that already exists

No second selection or navigation model is introduced. The shell's de-facto
tripartite state machine is the spine, and the design names it:

1. **Mode** — `ShellMode` (`audio | expressions | techne | settings`,
   `continuity/workspace.tsx:8`) over the cradle's `WorkspaceMode`
   (`base | factory | expressions | techne | epi-logos | settings`,
   `cradle workspace/mode.ts:18-19`), each mode carrying its own layout tree
   (`modeLayouts`), with the standing rule that a mode never closes surfaces.
2. **World context** — the workspace book's `WorldContext`
   (`world: central | epi-logos`, subject, reading, trail;
   `cradle workspace/store.ts:15-73`) plus project navigation and recent
   places. This is the encounter: what is selected, of which world, with
   what reading, and where you have been.
3. **Kernel epoch** — transport status and `accessEpoch`/`accessReady`
   generation bumping (`shell/workspace.tsx:59-117`), which retires stale
   callbacks and gates every read on the current connection.

Every projection instance and every device reads the encounter from this
spine; selection changes propagate as encounter transitions, not as
per-view state. The Atlas independently converged on the same shape — its
five-state machine (World · Focus · Manifestation · Thread · Deep,
`Archetypal-Earth/src/state/store.ts`) maps directly: World = projection
overview, Focus = selection (encounter.subject), Manifestation = an
Expression opened, Thread = the trail, Deep = full device edit. Its hash
router (`src/state/router.ts` — "every state is linkable and Back works")
is the model for linkable encounters in the shell.

### 2.1 The navigation spine in full — mode × world-context × kernel epoch

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2717-2815 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 2.2 The system's response laws

*Folded verbatim from `wayfinder/DLW-PLAN.md` L3019-3061 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

## 3. The four projections

### 3.1 Earth / Solar-System — space

The spatial projection, adopted from `Work/Archetypal-Earth` (found; owner's
own code, branch `main` @ `932b360`). What carries over as **projection
infrastructure**: the globe engine (`src/globe/` — three.js earth shader,
NASA Blue Marble + GIBS quadkey tile streaming, atmosphere, instanced
presence points with density texture), the camera rig (`src/globe/controls.ts`
— north-up inertial orbit, great-circle flights, anchor-zoom), the graph
engine (`src/graph/` — d3-force constellation, neighbourhood BFS with
liveness dimming, tie-basis edge styles, idle-when-clean rendering), the
non-linear time scale (`src/data/time.ts`, mirrored in GLSL), and the
image pipeline (`scripts/images.mjs`, `ImageRef` in `src/types/field.ts`).

What stays **corpus**: the Jung vault (`~/Documents/books/jung-archetypal-field`,
2,778 files, as-such → image → instance), the curation set (gazetteer,
archetypes, family-ties, Aion, Book of Symbols), and the ingest scripts.
`src/types/field.ts` is the single seam between the two — which is exactly
why adoption without the corpus is straightforward.

The World-projection contract generalises `Occurrence` (`field.ts:118-142`):
a projected occurrence carries `subject_ref` (the native identity), place
(lat/lon + precision), time (year/range + display), image ref, and basis.
Any World material that can answer those binds into Earth; material without
geography anchors to the declared world/home position and expands as a work
constellation (the transcript's recommendation, retained).

The solar system is the same projection's outward expansion: Earth's
engine already streams tiles and renders instanced bodies; the M2 planetary
field binds from the QL side (the dated-sky provider contract,
`providers/sky/kerykeion_snapshot.py` — ten bodies, nine voices, seven
centuries, Earth anchor — already carries the source-defined Sun→Sahasrāra
relation). The Atlas has no ephemeris code; none is invented here — the sky
arrives from its native owner.

### 3.2 Timeline — time

The temporal projection, in Ableton's own grammar and already substantially
in the shell: `SessionView` (track columns, clip slots, scenes, stop row,
mixer strip) and `ArrangementView` (integrated overview above the ruler —
the measured Live evidence — beat ruler, track lanes) with native variants
projecting the retained app (`NativeSessionContent`, `NativeSourceArrangement`).
Selection is `{track, scene, clip?}` (`SessionView.tsx:9`), and it is what
chooses clip-vs-device detail in the bottom area (`App.tsx:249`).

The design move: **Session and Arrangement are the two presentations of one
Timeline projection over any World material** — not audio-mode features.
This resolves the recorded fault of coupling them to audio mode
(§4.2, the folded Live 12 study). Tracks are lanes of World material:
Expressions scenes, historical events, Factory runs, agent activity,
conversations, civil days, celestial motion, M3 clock transformations.
Clips are the material in lanes; launching, recording, moving, trimming,
splitting are the crosswalk's session/arrangement family operating through
existing native owners. The integrated overview stays the single navigation
surface — no duplicate scrub bar (owner ruling, retained).

### 3.3 Canvas / Constellation — relation

The relational projection. Two engines serve it: the Atlas's d3-force
constellation (calm, liveness-aware, tie-basis styled) for corpus-shaped
constellations, and the knowledge Graph's existing canvas with its
`NavigationMinimap` (`navigationMinimapGeometry.ts` projects graph
world-points; `GraphCanvas.tsx` consumes it) for the wiki/subject graph.
Graph data remains owned by its native semantic system; the projection is a
surface over it. Unresolved links render as honest ghost nodes (crosswalk
lane-1:C1). The constellation is where Factory workflow, agent populations
and corpus relations are *seen*; the explicit graph inspector opens from any
projection on selection ("show this in the field's graph" — lane-1:C3).

### 3.4 Expressions — form

The expressive projection: the retained application mounted once, with the
deep cut changing disclosure (`panels/expressions.tsx:43-46`). Glyphs,
scenes, particles, cymatics, chakral structures, image transformations,
narrative sequences. An Expression is not a data category — any World
material may acquire an expressive projection (a Factory run's result, an
archetype's glyph, a corpus's composition). The Expressions projection is
where form is authored; the Timeline projection is where form is placed in
time; Earth is where it is situated.

### 3.5 Implicit projections

- **Graph** — the relation inspector, opened on selection from any
  projection. Already routed: the browser dispatches
  `oi:epi-open-knowledge` (`WorldBrowser.tsx:96-115`); knowledge bindings
  arrive through `surface_open` and the book.
- **Agent / filesystem** — operational inspection of Position, body,
  current work, project, messages, runs, files, returns. Surfaced as
  browser categories and contextual panels (the crosswalk's agency family),
  never as competing worlds.

### 3.6 Sound and temporality as one ontology — the statement

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2150-2174 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.7 The law that makes it one ontology

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2178-2199 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.8 The World track adapter pattern — the ontology's one extension point

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2203-2286 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.9 Standing — the epistemic chips and the never-upgrade law

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2577-2631 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.10 The take machinery — the performance-recording seed

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2635-2657 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.11 Constructing any new track type from the ontology — the builder's recipe

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2661-2704 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 3.12 The Expressions top-bar session (8 Oct 2026) — decisions and what was left

*Folded verbatim from `EXPRESSIONS-PORT-PLAN.md` L46-54 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

Built and verified at source, fixture and stubbed-DOM level; **not replayed in the live shell** (the native stack was down and was not restarted). Accounting: `EXPRESSIONS-PORT-STATUS.json` (`additions`, `defects`); no row changed status.

- **Bar layout.** Transport, Time Scale (drag the name, type, arrows), the arm and take dot, the tool rail (single letters at narrow widths), the Map (pin) toggle, an engine light, then an overflow menu for Scene choice, saved sequence, Save, position, times, take mode and Guide. A second row carries the controls strip. The stage toolbar lost its tool group. Reviewed at 700 px and 1920 px over fixture readings.
- **Live parameter channel.** Frame command `live` (`set`, `hold`, `release`): a transient override layer inside `frameData`, applied to a copy of the scene, never the document. About 20 Hz while dragging; one committed write on release; Escape restores; the take sampler reads the override. Proven: streamed value equals committed value (12 tests); against the real frame (production engine adapter) the clock stops under a streamed Time Scale 0, resumes on release, the document is byte-identical with no state announces, and a take recorded during a drag holds the ramp 1 to 3 rather than a staircase. Effective values are polled at 250 ms while a lane runs or a take records.
- **Arm, record, re-enable.** Arm + Play starts a take, Stop keeps it, append or replace is the overdub choice. Re-enable automation is a frame command (`automation resume`, reading `automationHeld`), runtime only, hidden until something is held. On an automated parameter a bar gesture holds the manual value in the frame; Device panels still use the existing reducer, which offsets a replacing lane (takeover law deferred to #580). The two paths differ on purpose until that is decided.
- **Pin mode and seed.** Map toggle with a Field | Follow | Bind chip and a Shared | Local scope (Alt-click flips one pin); a pin on every Device control and Browser row; Field pins project into the bar from the document's chosen controls, with no new store. Seed in priority order: Time Scale, Viscosity, Shape hold (rack macro over snapRigidity and densityTether, added on request, starts where the parameters already are), 3D (volumeEnabled and depthPerspective), Particle size (two handles, log track, shaded 0.2 to 1.4 band, hard bounds unchanged), Cymatic with Plate Size, Relational, Turbulence, Ink Opacity. Hiding a seed slot is a per-viewer browser setting.
- **Grid size decision.** The Cymatic "grid size" is `cymatics.plateSize`. `medium.gridRes` is the shared medium's grid; the resonator reads only `uResPlateSize` (simulationShaders.ts:758). Turning the Cymatic field on from the bar also sets the plate size to 300 (`CYMATIC_LOW_PLATE`, easy to change) in the same undo step, unless it is already lower, so the pattern reads clearly.
- **Rack.** Field-scoped chosen controls live in the bar and the rack lists object (Follow/Bind) pins only. A reorder of the visible rack controls is merged over the whole list so each hidden Field entry keeps its own slot (`wholeChosenOrder`). Unpinning a Field control is done from Pin mode or the bar.
- **Not done.** Metronome, tap tempo and quantise are omitted as agreed. Rounded material now round-trips through an `authoredMaterial` marker. The take start with chosen properties and the hold on a real lane were replayed against the real frame (production engine adapter). Not replayed: the shell route with a native-owner-backed document (opening a work there needs an owner recovery checkpoint).

## 4. Real panes

The pane engine already exists and is already hosted in the shell: the
cradle surface system — `TabGroupPane` / `SplitPane` / `LayoutState` with
`root`, `surfaces`, `closedStack`, `focusedGroupId`, `maximizedGroupId`,
`sidePane`, `detached`, `modeLayouts` (`surface/types.ts:86-172`); operations
open/close/split/tile/moveTab/cycleTab/togglePin/detach/redock
(`surface/engine.ts`); retained bodies kept mounted per pane
(`Workbench.tsx:460-463`); real second-window detach and redock
(`DetachedFrame.tsx` → `window_binding` / `window_redock`; admitted kinds
include `source, knowledge, file, encounter, browser, terminal, flow`).

The design promotes this engine from "one center panel among six" to **the
composer of the main area in every mode**:

- A **pane** = projection instance (or surface) + encounter slice + rack.
  The pane engine's body-kind system gains projection kinds
  (`projection.earth`, `projection.timeline`, `projection.constellation`,
  `projection.expressions`), so opening a projection is opening a pane, and
  two panes can hold two projections of the same subject side by side.
- **Hidden-inhabitant retention stays**: projections keep mounting while
  hidden (`App.tsx:124-134`), so returning to a pane restores its actual
  camera, selection and temporal state — the Atlas already proves this
  pattern (time-window snapshots across mode transitions,
  `controller.ts:418,845,882,959`).
- **Tabs are implicit in tracks and clips**, exactly as the owner said: in
  Ableton there is no tab strip over the main area — selecting a clip shows
  the Clip view, selecting a track shows the Device view, and the
  Clip|Device switch in the detail area is the only "tab". The shell already
  has this (`StatusBar.tsx:13` clip/device switch; `App.tsx:249`). The pane
  engine's tab groups remain for surface-bearing material (documents,
  terminals, sources) — not bolted onto projections.
- The five-region frame stays: TransportBar, left browser, main (panes),
  right dock, bottom detail, status. The bottom detail area is the
  **focused pane's rack view**; Deep edit expands it; pop-out moves a device
  to its own pane or window (the pane engine's detach, already real).

### 4.1 The set grammar — saved sets and per-mode defaults

*Folded verbatim from `wayfinder/DLW-PANES-PER-MODE.md` L859-928 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

##### 9.1 What a saved set contains
A set = **panes × instruments × devices × contexts**, concretely:
- the pane tree (`LayoutState.root: Pane | null` — TabGroupPane/SplitPane
  with tabs, pins, presentation, `surface/types.ts:162–176`),
- every surface binding the tree names (`surfaces: Record<SurfaceId,
  SurfaceBinding>` — each binding carries its kind and its instance data:
  doc path, projection `{kind, subject_ref?}`, engine `{expressionRef,
  revision}`, terminal cwd, presentation refs; types.ts:60–118),
- the focus/maximize/side/detached state, window bounds,
- the detail presentation per mode (the mockup's `S.dv` — clip|device),
- the dock tiles open (the agent shell's `openTiles`; the mockup's `S.tiles`
  per mode) and the dock width,
- the browser's open category (mockup `S.cats` per mode) and the companion
  tab (`S.ctab`),
- the encounter spine reference (field · world · subject · occasion — the
  workspace context, not copied into the set),
- the mode it belongs to, and (open question, §6) the Epi-Logos lens state.

##### 9.2 How defaults are defined per mode
The workspace **already keeps one layout per mode**:
`modeLayouts?: Partial<Record<WorkspaceMode, LayoutState>>`
(cradle `workspace/store.ts:42`) — "layout is the active mode's tree,
modeLayouts holds the others" (:179); `switchWorkspaceMode` saves the
from-mode's tree and restores the next's (:131–138). So the *default set*
per mode is: the mode's last-left layout, seeded the first time from the
mode's default. The mockup defines those seeds as plain data
(`S.modes` per mode: tree + panes; plus `S.dv`, `S.tiles`, `S.cats`,
`S.ctab` — world-shell-mockup.html:745–753, 1699). What the landed grammar
holds as data today: the browser categories, the detail pair, the centre
frames, the transport meanings (`modeGrammar.ts`); what is **not** yet
grammar data: the seed pane tree, the seed dock tiles, the seed detail
presentation, the seed browser category per mode.

##### 9.3 How saved sets relate to the existing layout persistence
The existing persistence IS a set store for one unnamed set per mode:
`saveWorkspace`/`DocumentStore` and the mode-book (`store.ts`) already
persist and restore trees, bindings (with hidden-retention), detach/redock
and per-mode regions. A **named user set** is therefore not a new engine:
it is a named, immutable copy of a `LayoutState` + the dock/detail/browser
scatter, recalled by writing it back through the engine. Constraints the
grammar must keep:
- recall re-reads owners — a restored binding re-subscribes; nothing renders
  from the set file (the honesty law: state is not law);
- recall restores instrument *instances* (kind + subject + presentation),
  never raw pixels — the binding grammar already carries what's needed
  (`projection {kind, subject_ref}`, `engine {expressionRef, revision}`);
- mode switching keeps working across recall (the mode-book writes the
  active mode's tree on leave; a recalled set becomes that mode's current
  tree);
- the closedStack and hidden retention survive a save/restore cycle or are
  honestly dropped (named, not silently).

##### 9.4 What needs building
1. **Seed defaults as grammar data** — per mode: seed tree, seed detail
   presentation, seed dock tiles, seed browser category (the mockup's
   `S.modes/dv/tiles/cats/ctab` promoted to `modeGrammar.ts`-style records,
   consumed by the frame).
2. **Set save/recall ops** — name, store, list (the browser's user-set
   place is open: a Sets-like category or the launcher's preset row — the
   agent-shell mockup already draws "Save current tiles as preset…" for
   tiles alone), recall through the engine.
3. **The dock/detail/browser scatter** join — today `openTiles` lives in
   AgentShellContext and the browser category in component state; a set must
   gather them (the mockup's per-mode `S.tiles/S.cats/S.dv` is the shape).
4. **Set-scope policy** — what a set deliberately excludes (encounter spine
   values, ephemeral readings, unrecovered drafts) and where that is
   disclosed on recall.

### 4.2 The Ableton-led shell and Expressions interaction study — the measured Live 12 basis, five regions, three levels of disclosure

*Folded verbatim from `UI-UX-CONVERGENCE-STUDY.md` L3-114 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

Standing: **agent-derived design revision, 8 October 2026**. The owner's latest direction fixes the experience requirements: compact chosen parameters/macros, deeper settings behind a toggle, expanded editing, the proper browser/pool structure, and outward homes for every internal Expressions feature. The model and placements proposed below remain design inferences. They do not close functional targets or admit the current crowded rack.

#### Finding

The current integration puts complete editing families beside each other without a deliberate path from discovery to performance to deep editing. Moving Force beside Glyph fixes an overflow fault; it does not establish the intended rack. The native app already has the missing idea: a chosen-property toolbelt. Its entries, order and Follow/Bind scope belong to the Expression and survive its native composition operation. That owner should supply the compact shell controls.

The next vertical slice is **choose a native property in the browser → add it to the Expression's chosen controls → tune it in the compact rack → open its deeper editor → save and return to the same work**. It must prove native identity, scope, acknowledgement and continuation as well as appearance.

#### What was observed

The native computer-use inventory found the owner's running Live application. It was in an audio-export Save dialog. The navigation overlay was dismissed; the Save operation was left open, without submitting, cancelling or changing its destination. Consequently this pass does **not** claim a new live replay of macro mapping, browser drag or device expansion.

The three existing captures were opened and studied directly:

| Evidence | Observed fact |
| --- | --- |
| `Work/O-I/docs/research/ableton-live-12.0.25/evidence/ui/live-session-real.png`, 1920 × 1200 | Category column plus browser results; a separate lower Groove Pool; track/scene matrix; mixer integrated with columns; bottom detail/status affordances. |
| `…/live-arrangement-real.png`, 1920 × 1200 | Overview integrated above the ruler; track lanes and adjacent headers; left browser/pool persists; compact Clip properties beside a large note editor. |
| `…/live-wavetable-device-panel.png`, 1806 × 1282 | A dense instrument face occupies a short horizontal device strip; remaining chain space is available for insertion. The filename is not proof of the instrument type: the pictured face has four lettered oscillator sections and a preset title. |
| `new-shell/evidence/native-device-chain-1920x1200.png`, CSS 1920 × 1200, DPR 2 | Actual retained Chakral body and bottom Clip/Device selector. The old stack sends Force/Rack below the visible detail area. Browser is a single stack of works and files. Recovery conflict and pending input are real. |
| `new-shell/evidence/native-device-chain-700x700-before.png`, CSS 700 × 700, DPR 2 | Real narrow-view crowding and truncated depth. This is failure evidence, not a responsive-layout pass. |

The measured dossier remains the visual basis: flat neutral chrome, 11–12 px type, hairline divisions, amber interaction, user colour as identity. These captures are research evidence only and are never application assets. Ableton observations are **interface-only source evidence**; no proprietary code, icons or presets are adopted.

The native AIKit knowledge route was attempted first. The parent's query returned no result after more than 19 minutes and was bounded by terminating only that exact read-only process. The child's distinct query returned no result after 3m23s. This study therefore uses the named governing sources and actual local implementation; it claims no recovered wiki decision.

#### The current faults are structural

| Current source | Fault | Required change |
| --- | --- | --- |
| `NativeWorldDetail.tsx` | Glyph, complete device editors and Rack are mounted unconditionally in Device view. | Compose the selected subject's actual chosen controls and admitted devices. Clip depth belongs in Clip view; configuration is requested explicitly. |
| `NativeRackEditor.tsx` | Mapping form, every mapping response, recall exclusions and variation authoring are always visible. Expand mostly changes graph size. | Compact macros first. Map/configuration reveals its tools; deep editing gets real space. |
| `WorldBrowser.tsx` | Works, reusable material and Central files stack into a single scrolling column. Selected material's role forms also expand in that list. | Category/result browser above a separately sized contextual pool. Listing, preview and adding to the selected destination are distinct actions. |
| `App.tsx` | Session/Arrangement controls explicitly switch the workspace to audio. | Separate the selected native work from its center presentation, so an Expression can be worked through Body, Session and Arrangement. Retain the existing panel registry and owner boundaries. |
| `editor.ts`, `hostEditor.ts` | Scene/selection/effective values are published; `Journey.shared.toolbelt` is absent. | Extend the retained app adapter for authoritative chosen controls and their existing operations. No shell-only pin store. |
| Internal `app.ts` | Source/layers/placement requests still activate the internal Objects Studio; Present is a CSS presentation flag. | These are migration bridges. Fullscreen needs actual shell behavior; outward editors need their own native acceptance. |

The horizontal-chain patch built successfully, but the owner has rejected the all-settings composition as the standard. Neither that build nor the earlier read-only bridge audit admits the UX.

#### A working hierarchy

Use the existing native nouns in the product: **Expression, Scene, Object, Composition**. The music analogy explains the arrangement; it does not rename owners or convert the Expression into an ALS file.

| Presentation relationship | Existing fact / contract | Proposed treatment |
| --- | --- | --- |
| Whole work / set | Native Expression holds title, composition and Scenes. | The open work remains the same Expression across views and instruments. An audio set retains its own document owner. |
| Section | Native Scene holds the complete field/composition, duration and transition. SC-1 already treats it as a ref-addressed clip. | Scene launch row in Session; master section strip in Arrangement; section content identity survives reorder/trim. |
| Object lane | `entity_ref` identifies a native subject; Scene membership creates occurrences. | Object columns/lanes project actual membership. Define absent and repeated occurrences before promising a persistent cross-Scene track. Shared field effects have their own scope. |
| State / sequence clip | Stable formation states, held content, transitions, source/layers and property tracks already exist inside a Scene. | Select/edit a state or sequence in Clip. Independent object launching requires an actual owner capability; whole-Scene launch remains atomic. |
| Arrangement | Scene order and summed durations; existing property tracks and interpolation. | Section strip first, object/state/envelope lanes beneath. SC-1…SC-7 supply operations, identities, receipts, timing and continuation. |
| Body | Retained M4 field and physical state. | Persistent native body. Center presentation changes do not create another engine, document or clock. |

`expressionTiming` supplies the authored sequence time. Parameter evaluation or scrubbing does not prove deterministic particle seeking. The civil/work-time bridge remains `techne:time-axis/v1` work; seconds, beats, simulation time and Day/NOW cannot be conflated.

#### Five-region composition

**Transport:** current work and Scene, relevant native transport/recording, contextual stage tools, scope and owning save standing. Session and Arrangement select a presentation of the current work. Expressions/Technē select their operating cut through the existing top-right icon strip. No second tab band.

**Browser above:** retain categories and results. Native works/files/registers, reusable material, objects, glyph/image/font sources, devices/effects/modulators, and properties are different categories over their actual owners. A device category is useful only when its insertion/capability is real. Search filters the selected category. Preview selection is separate from opening a work or changing its destination.

**Browser below:** the Groove Pool geometry becomes a contextual working area. In audio it retains its admitted audio purpose. In Expressions it can show the selected property's definition/pinning, a macro's mapping targets/ranges, a material's roles and destination, or the selected modulation monitor. A small selector changes that lower area's role; it never piles all of them into the browser list. Full parameter tuning can use this area without opening the whole object editor.

**Center:** Body, Session, Arrangement or one deep instrument/editor. Deep editing replaces the center presentation and returns to the same selection/view. Project/Graph, Canvas, Timeline, Journey, Places and Palace keep their plain names and native identities. Agent/context apertures remain native contributions, with the right dock available when requested.

**Bottom detail:** Clip and Device stay in the bottom status UX. Device presents chosen parameters and macros, with compact meaningful visuals. Clip presents state/sequence, timing and envelopes appropriate to the selected Scene/object. Each remembers its own height: a short performance rack and a larger clip editor are different working densities. The default is not a three-editor dump.

**Status:** current selected native subject, write/conflict standing, Clip/Device switch and contextual depth. Basis/revisions/milestones are available here or in tooltips, never mandatory prose over the body.

#### Three levels of disclosure

1. **Compact / perform:** only chosen pinned properties and actual macro controls, a small domain visual when meaningful, device enable when owned, and selection. Unconfigured macro racks are created deliberately; no permanent empty Rack card. Never silently truncate saved choices: use banks or scrolling at the shell presentation layer.
2. **Configure:** the selected device's settings toggle reveals full settings. Macro Map mode reveals assignment, ranges/law, exclusions and variation authoring. Browser-lower detail can carry mapping while the compact macro remains usable. Exact names, units, soft/hard limits and native capability matter here.
3. **Deep edit:** sequence/layers/source, rich spatial device, graph/canvas or personal instrument gets center/fullscreen space. The first expanded path must keep the same retained instance and draft. Popout is admitted only when that additional view can share the existing owner, with explicit binding lifetime, revision checks and no duplicate body/engine.

At roughly 700 px: one readable selected device/editor, category/results navigation that can collapse deliberately, contextual pool on demand, and keyboard access to chain traversal. No squeezing every parameter into narrower columns. At 1920 × 1200: retain dense horizontal device rhythm and a dominant center, with stable headers and no repeated save/debug bands.

#### Add a parameter to the Scene: the complete activity

1. Select the native Scene and Object, or choose Field scope. Show which captured destination will be affected.
2. Browse Properties, with registry groups, human labels, units and source-defined behavior. Previewing a property changes no parameter or document.
3. Choose **Follow selection**, **Bind this object**, or **Field**, using the existing toolbelt semantics. Pin adds/reorders chosen-control declarations through the existing DocumentStore and native `composition_set`; it does not retune the field as a side effect.
4. The acknowledged chosen control appears in the compact rack. A gesture captures its resolved target and revision. Changing selection during a gesture cannot send its value to a different object.
5. Optionally map a macro using the existing `Scene.parameterRacks` schema. Macro mappings respect their actual Field/entity scope and parameter definitions. A pinned direct control and a macro are different existing concepts.
6. Configure or open the deeper editor without losing the intended value, focus or captured target. Return to the same compact control.
7. Required native saving completes only on its owning operation's success. Save/reopen preserves chosen controls, order, scope, macro mappings and authored values. A recovery draft and an in-memory commit remain separately disclosed.

#### Boundary work to do first

The adapter should disclose the **existing** authoritative chosen-control list, stable entry IDs and scope, native subject/occurrence correspondence, definitions/capability and write standing. Follow selection resolves at gesture start; named bindings retain native refs, including an unavailable/off-Scene subject. Neither silently falls back to the first formation.

Pin/remove/order/Follow–Bind operations must reuse `saveWorkspace`/DocumentStore and the native composition grammar. `prepareCompositionEdit` translates named view entity IDs to `entity_ref`; `kernelDocumentToJourney` restores correspondence on reopen. The current editor protocol supplies basis/origin/epoch guards and typed writes; it must extend that owner rather than copy the toolbelt's document into shell storage.

One complete outward path then proves the design: chosen object property → compact control → full source/layers/placement editor → native save/reopen. Original internal capability remains available until its outward equivalent has passed. No import or descriptor is accepted as a working port.

#### Coverage and acceptance

[EXPRESSIONS-FEATURE-MAP.md](EXPRESSIONS-FEATURE-MAP.md) inventories the current internal features and outward destinations with source citations. [expressions-ui-actions.json](expressions-ui-actions.json) is a derived inventory of literal app actions, not a behavioral contract. It keeps command-level migration gaps visible; dynamic and conditional instruments still need their own replay.

The first vertical slice must exercise actual saved work, not fixtures: add/reorder/remove controls; Field/Follow/Bind; absent binding; gesture then selection change; macro map/recall; configure/deep return; save and fresh reopen; owner refusal and competing revision; keyboard and pointer paths; both viewport captures. Hidden/internal controls retire only with an external location and executed evidence. ALL internal features need that eventual outward path, including library/import/export, capture, cameras, automation, native instrument, text, Nara/conversation and deep instruments.

The real competing Chakral recovery draft is preserved. The old view's export and unsubmitted tint are recorded in `preserved-open-draft.json`. This research did not overwrite either side. Canonical file Save remains unaccepted. The candidate's former services terminated with exit 143; their ports now serve different binaries. The parent's separate preview is `http://127.0.0.1:8789/app/`. Its latest CurrentWorld and summary reads timed out under current machine conditions; earlier successful native reads are retained as historical evidence, not substituted for that failure.

All 126 target behaviors remain in scope. This study updates the UX direction and foundational receiving contract; it is not their acceptance.

#### Source basis

- Owner conversation, PROGRAMME rulings plus WORK ORDER 0 amendment; CONVERGENCE; five target sets; lane-7 STRUCTURE; lane-3 SC-1…SC-7.
- `Work/O-I/docs/research/ableton-live-12.0.25/ui/UI-EVIDENCE.md` and captures named above.
- Candidate `field-studies-journeys/src/workspacePreferences.ts`, `liveWorkspace.ts`, `beltPicker.ts`, `sharedSettings.ts`, `app.ts`, `kernelComposition.ts`, `kernelDocumentBridge.ts`, `hostEditor.ts`; actual shell App/WorldBrowser/NativeWorldDetail/NativeRackEditor and boundary `editor.ts`.
- Exact working-tree hashes and runtime observations: [ui-ux-research-basis.json](ui-ux-research-basis.json). Candidate HEAD is insufficient by itself because relevant work is uncommitted.

Acquisition remains Step A/B native working implementation first; Step D is only the missing shell projection/interaction join. No Step-C code was adopted during this study.

### 4.3 The browser is the mode's catalogue — the working definitions and the four folder kinds

*Folded verbatim from `wayfinder/DLW-PANES-PER-MODE.md` L16-65 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

- **pane-instrument** — the generating body a pane hosts. Every pane's
  content is an instrument *instance* of a *type*; types have multiple
  implementations. The atlas graph surface and the Obsidian-RE knowledge
  graph are two implementations of one Graph instrument type, as two reverbs
  are two implementations of Live's Reverb.
- **device** — an SDK-declared parameter component that docks **on racks
  (chains)**. Devices ride the selected material's chain; they are not pane
  bodies. Face aperture: `{reading, disabled, apply, captureCurrent}`
  (`DEVICE-PANEL-BRIEF.md`; `DLW-PLAN.md` §3.3).
- **plugin** — a family's admitted manifest package; the unit admitted at
  the neutral door (`worldShellFamilies.ts`; `DLW-PLAN.md` §3.3 writers law).
- **base instrument** — the mode's default: what a new pane opens with.
- **set** — a named arrangement of panes × instruments; default (per mode)
  + user-saved. §9 states the grammar.

The resolution the owner asked for, stated once and applied per mode below:
**the left sidebar is the browser, and the browser is the mode's catalogue of
available instruments/devices/content — exactly as Ableton's browser lists
devices by category.** Its folders are of four kinds, and every folder in
every mode is one of these:

| Folder kind | What its rows are | Selecting/clicking a row does |
|---|---|---|
| **content** | material instances (documents, sources, days, scenes, sessions, places…) | binds the mode's (or another mode's) pane-instrument to that material — opens/encounters it |
| **instrument-types** | the pane-instrument types available in this mode ("Views") | instantiates the instrument into the focused pane (⇧ splits first) |
| **devices** | device and rack plugins to insert (audio effects, skillsets, git…) | inserts onto the selected material's chain |
| **live-faces** | a running instance shown in place (compact face, not a list) | interacts with / recenters that instance |

Evidence keys used throughout: `WSD` = `new-shell/WORLD-SHELL-DESIGN.md`;
mockup citations name file + the drawn element (all in `new-shell/`);
code citations are `file:line` under
`Work/O-I/packages/live-shell/ui/src/` (shell) or `Work/O-I/desktop/cradle/src/`
(cradle) unless prefixed otherwise. Audit captures read live:
`/tmp/mode-audit3/{live,base,factory,expressions,techne}-1920.png` and
`/tmp/mode-audit5/base-sweep.png`.

The five-region frame is constant (WIDGET-GUIDE §2): Transport 64 px ·
Browser 400 px · Centre (panes) · dock/companion ≈300 px · Detail 300 px ·
Status 28 px. Panes carry no headers; views arrive as apertures from the
launcher or the browser; one ⊞ control splits (beside / below / four-fold /
close); tabs drag centre-to-move, edge-to-split (WSD Rev 4;
world-shell-mockup.html:443, 1619–1687). The landed pane engine is the
cradle surface system — `TabGroupPane` / `SplitPane` / `LayoutState`
(cradle `surface/types.ts:86–208`), operations in `surface/engine.ts`,
projection kinds `projection.earth|timeline|constellation|expressions`
(`surface/types.ts:34–38`), binding
`{kind, subject_ref?}` (types.ts:118 — absent `subject_ref` = the pane
follows the encounter; present = pinned).

### 4.4 Cross-mode consistency — the same laws in every mode

*Folded verbatim from `wayfinder/DLW-PANES-PER-MODE.md` L932-947 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

| Requirement | The law | Where it binds |
|---|---|---|
| Same chrome | Five regions, same toggles; panes headerless; one ⊞ pane control; drag centre/edge; ⇧ splits | WIDGET-GUIDE §2; WSD Rev 4; world-shell-mockup.html:443, 1619–1687 |
| Same transport | Every mode keeps the same slots in the same places; only meaning changes; a disabled control names what is planned (`waitingNote`) | Rev 5 table; `modeGrammar.ts:136–158, 476–478` |
| Same browser grammar | Category column + results + context pool; entries composed from family-declared surfaces; `cut`/`waiting` states; designed empty categories name their owner; preview ≠ open ≠ add | `modeGrammar.ts:64–95`; `ModeBrowser.tsx:280–303`; UI-UX study :61 |
| Same browser folder semantics | Folders are content / instrument-types / devices / live-faces (§0 table) — the same four kinds in every mode's catalogue | this document §0, applied §§1–5 |
| Same detail discipline | Clip \| Device pair toggled from the status bar; per-arrangement meanings are data; three disclosure levels (compact → configure → deep); deep edit returns to the same selection; fold/compact/configure states | Rev 4 table; `modeGrammar.ts:496–503`; NATIVE-EDITOR-STANDARD :33–39; WIDGET-GUIDE §1 states |
| Same lights law | A light is a reading; unknown state has no lamp; activator only where a real owner enable exists | WIDGET-GUIDE §1; DEVICE-PANEL-BRIEF rule 6 |
| Same empty/refusing law | Empty slot names its affordance; absence is disclosed, never faked; `waiting` names its owner | WIDGET-GUIDE §1; `ModeCentre.tsx` header law |
| Same tooltip law | `data-i="Name|Function text"` on every control; the status bar is the single explanation surface | WIDGET-GUIDE §1 (F2); `slotDataI` |
| Same pane grammar across modes | Pane kinds + bindings are mode-neutral (`projection.*`, subject pin); per-mode defaults are seeds, not different engines | `surface/types.ts:31–38, 118`; §9 |
| Same encounter spine | Mode switch = encounter transition over mode × WorldContext × epoch; the encounter carries across modes; pinned panes keep their subject | `modeGrammar.ts:16–24`; mockup follow/pin; types.ts:111–118 |
| Same family exposure | Each family: browser categories, rack devices, projection adapters, inspectors — four places, nowhere else | WSD §16; `worldShellFamilies.ts` |
| Quality identical, content per mode | The audit bars travel whole (stillness lawful, focus/fullscreen, colour journeys with meaning, metadata banned from stages); only the mode's nouns differ | DLW-PLAN §4.5 acceptance shape; CONVERGENCE craft bars |

## 5. The rack and its inhabitants

The device aperture is proven and generalises as-is. A face receives
`{reading, disabled, apply, captureCurrent}` plus `renderControl` and
`createCustody` for gesture-bearing devices
(`NativeDeviceEditors.tsx:420-425`); writes are same-basis, single-flight,
with retained drafts and explicit Apply/Discard/Retry
(`NativeDeviceInputCustody`, 47-85). Presentation states exist: chain strip
(`NativeDeviceStrip`), compact vs configure (`NativeRackEditor`
`is-compact`/`is-configuring`), Configure families
(controls/device/rack/scene, `NativeWorldDetail.tsx:158-178`), Deep edit
expand/collapse, and device enable toggles. Pop-out is the one gated
gap — supplied by the pane engine's detach rather than a new mechanism.

Inhabitants — the rack's residents — are of these kinds:

1. **Parameter devices** (native owners, landed pattern): morph, colour,
   force, field faces; the coming sound/modulation/rack families. Each has
   an explicit target/encounter and no parallel store.
2. **Document devices**: hosted HTML pages — `ql-flow.html`, the 4+2
   `ql-daily-die.html`, curated returns and future pages. The hosting
   path exists (`document/frame.ts` sandboxed opaque-origin iframe,
   bounded postMessage `oi:document-host-request/response/changed`,
   payload island `#ql-doc`, save router with named outcomes
   `saved | unchanged | stale | conflict | refused`). The design promotes
   the binding to a device face: body = the page, rack strip = identity +
   basis + save state, aperture = the encounter. Documents become rack
   citizens with lifecycle (dock / expand / pop-out) instead of special
   cases.
3. **Conversation devices**: Nara/agency encounters — canonical CAS stays
   in AIKit; the shell binds via `oi.nara-dialogue-binding/v1` over kernelOp
   (`nara/nativeDialogue.ts`); the surface is an `encounter` binding already
   hosted in panes and detachable windows. A conversation is also a clip in
   the Timeline projection (its transcript is temporal material).
4. **Instrument devices**: the Techne instruments over the encounter —
   torus, sky, clock/inscription, piano, symbolic transformations, corpus
   analysis. Registered faces, not new applications.
5. **Mode plugins**: a declared bundle — `{browser category entries, device
   faces, projection bindings, document kinds, optional center panel}` —
   registered through the doors that already exist (`shell/panels.ts` slots,
   `FIELD_FAMILIES`, `NativeTechneBrowser` instrument list, detached kinds,
   browser categories). A curated feature integrates by declaring an
   inhabitant manifest; the shell needs no surgery for a new app. The
   Factory and Central entry points stay reserved for their native owners'
   work, admitted through this same door.

Naming: the host module is already called `inhabitants.rs`
(`packages/live-shell/src/inhabitants.rs`, `ConfiguredWork`) — the design
keeps the word. An inhabitant is admitted; its faces register; the rack
holds them.

### 5.6 The pane-instrument kind system

*Folded verbatim from `wayfinder/DLW-PANES-ONTOLOGY.md` L25-346 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

#### 0. The one-paragraph statement

Every pane in the shell hosts an **instrument**: a pane-instrument is the
generating body that produces and maintains a pane's surface, and every pane
body is an instance of exactly one instrument **type** (Earth, Timeline,
Graph, Expression, Document, Sessions, Thread, Terminal, …). An instrument
type is a declared contract — mount/unmount, encounter subscription, retention
class, its device set, its browser categories, its render surface — and a type
may have several **implementations** (the atlas coloured graph and the
Obsidian-RE knowledge graph are both Graph), which coexist as selectable
alternatives exactly as Ableton offers several reverbs under one effect type.
**Devices** are the parameter-bearing kind: SDK-declared faces docked on the
rack that parameterise an encounter; a pane-instrument *exposes* devices (the
Earth instrument exposes the graph tools and time control) but is not one.
**Plugins** are the delivery kind: a family's or owner's admitted manifest
package that delivers instruments, devices, browser categories and faces
through the one neutral door (`inhabitants/manifest.ts`) — the core (the
uncarved block) knows only instrument types and the door, never a product.
A **set** is a named arrangement of panes × instruments × (devices, contexts):
each mode's default set is declared data (the mode grammar), user-saved sets
are retained `LayoutState` snapshots per workspace — the Ableton Live Set
analogy, made precise by the pane engine's own persistence law.

#### 1. The kind system, made precise

The owner asked: *"we got this distinction properly down btw?"* This section
is the answer. Four kinds, one superordinate; each defined, each distinguished
from its neighbours, each anchored in landed code or in the mockups.

##### 1.1 Pane-instrument — the superordinate kind

**Definition.** A pane-instrument is the generating body a pane hosts: the
thing that produces and maintains the pane's surface. A **pane** (the engine's
tab group leaf — `desktop/cradle/src/surface/types.ts:122-140` `TabGroupPane`,
`types.ts:142-148` `SplitPane`) is geometry + focus + a tab strip; it is *not*
content. What fills it is an **instrument instance**: one running body of one
instrument type, bound to one encounter slice. Two panes can hold two
instrument instances of two types over the same subject — the L1 seam proved
exactly this ("two panes can hold two projections of the same subject side by
side"; `types.ts:22-35` header; instance identity is kind + subject,
`types.ts:111-118` `binding.projection`).

**Every pane body is an instrument instance of an instrument type.** The four
projection kinds landed as pane body kinds (`types.ts:36-45`
`PROJECTION_PANE_KINDS`: `projection.earth` · `projection.timeline` ·
`projection.constellation` · `projection.expressions`) are the first four
instrument types given engine-level names. The ontology's move is to
generalise: the engine's *body kind* **is** the instrument type id, for every
body — documents, terminals, threads, sessions, the knowledge graph — not only
the four projections. Today those other bodies ride ad-hoc binding-kind
strings (`SurfaceBinding.kind`, `types.ts:69`; detached admitted kinds
"include `source, knowledge, file, encounter, browser, terminal, flow`",
`WORLD-SHELL-DESIGN.md:454-456`); the catalogue in §2 names them as types, and
gap G1 (§5) proposes unifying the spellings.

**The type contract.** What an instrument type declares. The projection seam
already carries the whole shape for projection kinds
(`desktop/cradle/src/surface/projectionModules.ts`); the ontology states it as
the general contract every type satisfies:

```ts
/* SKETCH — the instrument-type contract. The projection seam already
 * implements this for the four projection kinds (projectionModules.ts:119-153);
 * the ontology promotes that shape to every pane body kind. */
interface InstrumentTypeDeclaration {
  id: string;                       // the pane body kind ('projection.earth', 'graph.knowledge', 'doc', …)
  title: string;                    // human name ("Graph", "Terminal")
  family?: string;                  // the admitting family, when not core (§16 exposure law)

  // — lifecycle —
  create(ctx: InstrumentContext): InstrumentHandle | Promise<InstrumentHandle>;
  //  InstrumentContext = { kind, binding:{id,title,subject_ref?}, element, encounter }
  //  InstrumentHandle  = { unmount(): void; setVisible?(v: boolean): void }
  //  — verbatim the ProjectionModule contract (projectionModules.ts:119-141),
  //  including the hidden-inhabitant law: state MUST survive until unmount
  //  (projectionModules.ts:133-141); returning restores actual camera,
  //  selection and temporal state.

  // — encounter subscription —
  //  through the EncounterBridge (projectionModules.ts:83-99): the module
  //  reads mode × world × subject × occasion × accessEpoch, subscribes
  //  epoch-guarded, and propagates selection as EncounterTransitionIntent
  //  (subject | occasion | present) — never a second selection store
  //  (projectionModules.ts:72-81).

  // — retention —
  retention: 'retain-concealed' | 'release-concealed';
  //  the pane tier's three-tier law (Workbench.tsx:426, 451, 474): every kind
  //  retains concealed except declared cheap-list kinds ('sources','blank'
  //  today — CONCEAL_RELEASES, Workbench.tsx:474); each type declares its class.

  // — its device set —
  devices: readonly string[];       // face addresses `${family}:${face}` that
                                    // present when this type is focused
                                    // (the rack follows the focused pane's
                                    // instrument — manifest.ts:165-171 facesFor;
                                    // device "operatesOn" names surface kinds,
                                    // manifest.ts:26-28)

  // — its browser categories —
  browserCategories: readonly string[]; // where instances of this type are
                                    // listed/offered (mode grammar categories,
                                    // modeGrammar.ts:79-95,127-129; family
                                    // declarations, manifest.ts:49-54; the
                                    // mockup's per-mode `views` category IS the
                                    // instrument chooser — world mockup:1505)

  // — its render surface —
  surface: 'pane' | 'pane-or-window';   // detachable types admit pop-out
                                    // (engine.ts:681-693 detach/redock;
                                    // instrument types with windows declare it)
}
```

**Instance.** `type → implementation → instance (pane)`. An instance is one
running body: binding id + type + implementation + encounter slice + retained
state. The binding carries the instance's slice as plain serialisable
presentation state (`binding.projection.{kind, subject_ref?}`,
`types.ts:111-118`; absent `subject_ref` = the pane follows the encounter,
present = pinned).

##### 1.2 Device — the parameter-bearing kind

**Definition.** A device is a component docked on a rack/chain that
parameterises an encounter — the die, hygiene, morph, colour, gateway, world,
git. Devices are SDK-declared (`packages/live-shell/ui/src/inhabitants/sdk/define.ts:134-161`
`DeviceDeclaration`: id, title, mark, kind, mode scoping, presentations, note,
admission, dock, document/conversation body, `params` rows) and
agent-addressable: each parameter row is a typed address `{family,
device-instance, key, type, range/unit, writePath}` (`manifest.ts:38-47`
`ParamAddress`; `sdk/define.ts:57-129` — "A row without a writePath IS a
reading — that is the grammar, not a convention", `define.ts:18-20`), written
only through the custody/apply aperture and the writers law
(`sdk/define.ts:204-212`, `define.ts:396-407`; `NATIVE-EDITOR-STANDARD.md:43-56`
affordance table). Every face wears its mark from the icon cut — the one
readable place of the shell's icon language (`inhabitants/sdk/icons.ts`,
generated from `new-shell/icon-cut.html`; `modeGrammar.ts:11-12`), and a
device without its mark "is not a face of this shell" (`sdk/define.ts:140-142`).

**The relationship to pane-instruments, precisely.** A pane-instrument *may
expose* devices; a device never hosts a pane. Three composable relations:

1. **Exposition** — the instrument declares which faces present when it is
   focused: the Earth instrument exposes the atlas's own graph tools, mode
   switch and time control (`atlasFamilyManifest.ts:25-31`); the rack "follows
   the focused pane's instrument" (`manifest.ts:165-171` `facesFor`;
   `WORLD-SHELL-DESIGN.md:272-273`). The device's `operatesOn` names the
   encounter-surface kinds it works on (`manifest.ts:26-28`) — an instrument
   type id may appear there.
2. **Composition** — some devices are *bodies of* an instrument instance:
   document devices (the Day die, the Flow) and the conversation device have
   bodies that can fill a pane (`worldShellFamilies.ts:56-90`: `kind:
   'document'` / `kind: 'conversation'` with `dock: ['dock','expand',
   'pop-out']`). The ontology reads this as: the instrument types **Document**
   and **Conversation** (§2 T8, T13) have their canonical *instances* as rack
   faces, and any face instance may be docked, expanded (pane), or popped out
   (window) — three presentations of the same instance, one body, no duplicate
   (`sdk/define.ts:155-157`; `WORLD-SHELL-DESIGN.md:494-496` "Pop-out is the
   one gated gap — supplied by the pane engine's detach").
3. **Parameterisation** — devices address an instrument's behaviour through
   §14 parameter addresses and modulation (`WORLD-SHELL-DESIGN.md:772-799`;
   every modulated parameter shows its modulator). The atlas's graph tools
   (depth, dust, ties, spread, gravity, sky) are exactly this: device-shaped
   controls over the graph instrument's tool state
   (`projections/atlas/src/graph/tools.ts:7-17,19-29`).

The distinctions the owner drew hold: the **technē instrument** (the six of §2.5 in the lock) is a
pane-instrument (it fills the focused pane and carries its own native controls
— `WORLD-SHELL-DESIGN.md:143-148` Rev 3 "the instrument is the instrument");
its *controls* are devices on the detail row (the Technē device column,
`world-shell-mockup.html:1646-1649`). A device is never "inside" a pane as its
body; where a device body needs pane space it *becomes* an instrument instance
by docking into one (relation 2).

##### 1.3 Plugin — the delivery kind

**Definition.** A plugin is a family's or owner's admitted manifest package:
instruments + devices + browser categories + faces, delivered through the one
neutral door. Two landed spellings, one door:

- the **family manifest** (`manifest.ts:85-98` `InhabitantManifest`: browser,
  faces, params, projections, inspectors, time, telemetry — the §16 four
  surfaces, `manifest.ts:13-16`), admitted at the neutral registry
  (`manifest.ts:111-190`; re-admission, collisions and undeclared-face
  parameters refuse, `manifest.ts:123-153`);
- the **SDK declaration** (`sdk/define.ts:179-212` `FamilyDeclaration`: owner,
  product carving, browser ids, devices, paramsGrammar, transport bindings,
  projections, inspectors, time, telemetry, writers + writerAuthority) —
  validate-first admission (`define.ts:527-551`) and additive extensions
  (`define.ts:559-603`).

The §5.5 **mode plugin** ("a declared bundle — `{browser category entries,
device faces, projection bindings, document kinds, optional center panel}`",
`WORLD-SHELL-DESIGN.md:519-526`) is the plugin kind scoped to a mode: the SDK's
mode scoping realises it (`define.ts:143-149` `modes`/`formats` per device;
`define.ts:318-328` `facesForMode`). The **uncarved-block law** is the
plugin/instrument boundary: "the core knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture, parameters,
modulation routing, the time spine, and the admission door"
(`WORLD-SHELL-DESIGN.md:758-762`); the working test is the seventh product
admitting with no core change (`WORLD-SHELL-DESIGN.md:764-771`; executed at L2,
`DLW-PLAN.md:324-328`). In ontology terms: **the core knows instrument types
and the door; plugins deliver types' implementations, devices, and
categories.** Atlas-earth is the worked example — a family (not one of the six
products) admitting its own views and faces (`atlasFamilyManifest.ts:9-47`).

##### 1.4 Implementation vs type — the reverb insight, formalised

The owner's reverb point, made structural. Ableton's device chooser offers
several reverbs: one *effect type*, several *implementations*, each instance
one choice. The shell's graph already lives this:

```
instrument TYPE        implementations (coexisting, selectable)      instances (panes)
──────────────         ──────────────────────────────────────        ─────────────────
Graph              →   atlas constellation (d3-force, coloured)   →  pane A
                   →   Obsidian-RE knowledge graph (canvas+minimap)→ pane B
Earth              →   atlas globe port (three.js, SwiftShader)   →  pane
Timeline           →   world presentation (L4) / aion / live arr. →  panes
```

**What makes implementations interchangeable is the type contract** (§1.1):
both graphs satisfy *the same* obligations — nodes and links over an
encounter-bound reading, navigation (pan/zoom/focus), selection that
propagates as an encounter transition, honest ghosts for unresolved material,
its device set, its browser categories, retention class. §3 states the Graph
contract and shows both implementations meeting it, line by line.

The **admission grammar follows the type ladder**:

```
type                  (the pane body kind — engine-known)
  └─ implementation   (admitted per type through the door; ONE default, N alternates)
       └─ instance    (kind + subject binding — types.ts:111-118)
```

Landed today: the projection door admits **one module per kind** and refuses a
second ("kinds are not silently replaced", `projectionModules.ts:157-169`) —
correct as an admission discipline, but it collapses implementation into kind.
The ontology requires the door to mature one level: kind → *implementation
registry* (gap G2, §5), where a family admits an implementation under a type,
one implementation is the default (per mode, per set), and switching
implementations is a per-instance choice — Ableton's device chooser, not a
fork.

**Base instrument per mode.** Each mode's default pane-instrument — what a new
pane opens with in that mode — is grammar data. The mockup declares it
(`world-shell-mockup.html:1602` `newPaneTab()`: Base → Things document;
Factory → Terminal; Technē → the Project lens as form; Expressions → Graph as form;
Live → Session grid) and the per-mode Session|Arrangement presentations
(`world-shell-mockup.html:1707` `VIEWMAP`; typed in `modeGrammar.ts:122-124`
`session`/`arrangement`). Landed, the mode grammar holds the presentations and
categories but **no base-instrument declaration yet** — gap G6 (§5). The
landed per-mode layout *retention* exists (`workspace/store.ts:125-141`
`switchWorkspaceMode` saves the leaving mode's tree into `modeLayouts`,
`store.ts:42`), which is the mechanism a declared default set initialises.

##### 1.5 Set — the named arrangement

**Definition.** A set is a named arrangement of panes × instruments ×
(devices, contexts): *which* panes (the split tree), *which* instrument
instances fill them (bindings + subjects + implementations), *which* devices
stand on the focused chains (enablement, fold state), *which* contexts the
panes hold (follow/pin). Two registers:

- **Default set (per mode).** Declared by the mode grammar: the mode's browser
  categories, its Session/Arrangement presentations, its Clip|Device pair
  (`modeGrammar.ts:115-142` `SurfModeGrammar`) — with the mockup supplying the
  seed arrangement (Base: Day + Flow/Things panes; Factory: Sessions + Thread;
  Expressions: the field; Technē: the World at system scale; `world-shell-mockup.html:746-750`
  `S.modes`). The mockup's own header states the rule both registers obey:
  "Each arrangement keeps its own panes; the encounter carries across"
  (`world-shell-mockup.html:1596` data-i).
- **User set (per workspace).** The Ableton Live Set analogy made precise by
  the engine's persistence law. **What saves** is exactly a `LayoutState`
  (`types.ts:162-208`): the pane tree (`root`), every binding ever opened with
  its encounter slices (`surfaces`, including closed — the reopen-honestly
  stack `types.ts:167-171`), focus (`focusedGroupId`, `focusedTabId`),
  maximise mask, side pane, detached windows, per-mode side-region memory
  (`modeRegions`, `types.ts:206-207`) — plus, per retained tab, the body's own
  state (camera, selection, temporal position: the hidden-inhabitant law,
  `projectionModules.ts:133-141`; the hosted engine checkpoint ref,
  `types.ts:97-104`). **What does not save**: semantic state — subjects stay
  refs, never copies (`types.ts:12-13` "Presentation state only — it never
  becomes a semantic identity"); encounter state lives on the spine, so a set
  reopened under a moved encounter re-binds instead of lying. Landed
  mechanism: `modeLayouts` per workspace book (`store.ts:42`,
  `CradleFrame.tsx:427-428` reconciles surfaces across all layouts). Named,
  savable user sets are the remaining work (gap G4, §5).

##### 1.6 The five inhabitant kinds composed with the superordinate kind

`WORLD-SHELL-DESIGN.md:496-526` classifies the rack's residents five ways.
The pane-instrument kind is superordinate and perpendicular, not competing —
§5.5 classifies by *rack role and delivery*; the pane-instrument kind
classifies by *pane-body generation*. The composition:

| §5.5 inhabitant kind | Pane-instrument reading |
|---|---|
| 1. Parameter devices | Never pane bodies (§1.2 relation 1/3). Exposed *by* instruments; live on chains. |
| 2. Document devices | The **Document** instrument type's instances (T8): canonical face on the rack, dock/expand/pop-out into pane/window (`worldShellFamilies.ts:56-82`). |
| 3. Conversation devices | The **Conversation** instrument type's instances (T13): "the surface is an `encounter` binding already hosted in panes and detachable windows" (`WORLD-SHELL-DESIGN.md:511-515`). |
| 4. Instrument devices | The rack-face *projection* of instrument types: "the Techne instruments over the encounter… Registered faces, not new applications" (`WORLD-SHELL-DESIGN.md:516-518`). The type fills the pane; its face is the detail-row device (Technē device column, `world-shell-mockup.html:1646-1649`). |
| 5. Mode plugins | The delivery kind (§1.3): bundles that admit instrument types' implementations, devices, and browser categories per mode (`define.ts:143-149`, `define.ts:318-328`). |

No contradiction: a mode plugin *delivers* an instrument; an instrument *may
expose* devices; a document/conversation device *is* an instrument instance
with a rack face. One lattice, three vocabularies for three questions
(delivery? parameter? body?).

##### 1.7 What each kind is NOT (the one-table distinction)

| | Pane-instrument | Device | Plugin | Set |
|---|---|---|---|---|
| Fills a pane's body | **yes** (it *is* the body) | never (docks on the rack; may *become* a pane by docking, §1.2-2) | never (delivers things that do) | names an arrangement *of* panes |
| Bears parameters | may expose them | **yes** — its whole point (`ParamAddress`, `manifest.ts:38-47`) | declares them (`params` grammar) | retains their fold/enable state |
| Is admitted | as a type's implementation, through the door | as a face, through the door (`manifest.ts:115-155`) | **is** the admission unit (`InhabitantManifest`) | not admitted — saved |
| Has implementations | **yes** — the reverb insight (§1.4) | per-family faces; hot-swap within compatibility (DLW-PLAN §2 row "Hot-swap") | — | — |
| Is named/saved | — | presets (DLW-PLAN §2 "Preset") | — | **yes** — default + user sets (§1.5) |

### 5.7 The instrument-type catalogue

*Folded verbatim from `wayfinder/DLW-PANES-ONTOLOGY.md` L347-562 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

#### 2. The instrument-type catalogue

Every pane content in both mockups and the shell, as instrument types.
Method: the world mockup's aperture table `APS` + lens table `INST`
(`world-shell-mockup.html:803-824`), its Rev-5 additions (`docgrid`,
`musicsess`, `musicarr` — `world-shell-mockup.html:1701-1703,1707`), the
agent mockup's centre views and dock (`agent-shell-mockup.html:547,824`), and
the landed body kinds. Sixteen types. Each entry: contract sketch · landed
implementations (files) · mockup evidence · device set · standing.

**T1. Earth / World** (`projection.earth`; Technē "World / Places").
Contract: bodies, places, relations between bodies; scales
system·body·region·palace; encounter following (aim/fly on subject change).
Implementations: the atlas port — `projections/atlas/` (82 modules,
`DLW-PLAN.md:230-232`): `mount.ts:67-130` `mountAtlas`, `src/globe/engine`,
`src/app/controller`, provider registry `provider/corpusProvider.ts`; admitted
under kind `projection.earth` through the module door (`mount.ts:6-9` names
the §10.2 obligation). Mockup: `world` aperture, scales and relations legend
(`world-shell-mockup.html:811`, slot scale buttons `:1517-1519`, planet
building `WORLD-SHELL-DESIGN.md:169-182`); `WORLD-SHELL-DESIGN.md:355-371`
(§3.1). Devices: planet building (Body·Landmass·Climate·Sky·Locations·
Relations), the atlas faces (`atlasFamilyManifest.ts:25-31`: globe-engine,
graph-tools, mode-switch, time-control), QL sky as the dated layer
(`atlasFamilyManifest.ts:37-40`; `provider/skyProvider.ts`). Standing:
specified + implementation ported (admission as a shell pane still to prove —
`modeGrammar.ts:426-427` keeps the Bodies category `waiting`: "the atlas port
refused the merge" is the recorded state).

**T2. Timeline** (`projection.timeline`; Technē "Relation Field"; Base
"today on one ruler"; Live Arrangement). Contract: tracks, clips, ruler,
lenses (chronology·causal·recurrence·concurrency), epistemic standing chips;
Session and Arrangement are two presentations of one type
(`WORLD-SHELL-DESIGN.md:399-408`). Implementations: `projections/
worldTimelinePresentation.tsx` + `useWorldTemporalReading.ts` (the L4 World
cut; `DLW-PLAN.md:233-235`); seven World track adapters behind the neutral
shape (`src/timeline/worldTrackAdapter.ts…`, table at `DLW-PLAN.md:1823-1831`);
the atlas `aionTimeline.ts` epoch adapter; native session/arrangement content
adapters (`NativeSessionContent`, `NativeSourceArrangement`,
`WORLD-SHELL-DESIGN.md:394-396`). Mockup: `timeline` aperture with lens
segment (`world-shell-mockup.html:812`, `:1523`), `musicarr` (`:1704`),
`docgrid` Day·Session (`:1701`, `:1710-1711`). Devices: time-spine controls
(Now/Occasion/Transport — `WORLD-SHELL-DESIGN.md:577-597`; §5.4
`DLW-PLAN.md:1943-1997`), take machinery (DLW-PLAN §5.7). Standing:
specification landed (adapters + spine); pane-kind hosting landed; per-mode
Session/Arrangement compositions are the mode chapters' work.

**T3. Graph / Constellation** (`projection.constellation`; Technē
"Project / Wiki / Graph" field view). **Two implementations** — the
commission's case study; see §3 for the full contract and both
implementations. Mockup: `field` aperture with list·tree·graph·form views
(`world-shell-mockup.html:814`, `:1524`), the browser's compact bounded graph
(`:1494-1497`), the agent dock's `graph` tile (`agent-shell-mockup.html:824-851`).
Standing: both implementations exist; chooser + type contract are gaps G2/G3.

**T4. Expression** (`projection.expressions`; the 3:3 living field). Contract:
the retained M4 body mounted once, deep cut changes disclosure; stage-only in
the pane, tools in the Studio (`WORLD-SHELL-DESIGN.md:423-430,53-56`).
Implementations: the retained app via `PointCloudHost` iframe
(`DLW-PLAN.md:242-244`); `panels/expressions.tsx:43-46` deep cut; the hosted
engine checkpoint (`types.ts:97-104`). Mockup: `expression` aperture
(`world-shell-mockup.html:817`), Rev-5 stage-only body (`:1712`), Scene|Studio
detail pair (`:1642`). Devices: the Studio — the engine's own controls, the
wave-2 families (physics, medium, resonance, contacts, ink, depth, relational,
pointer, focus, morph, colour; entity and scene families —
`INSTRUMENTATION-CONTRACT.md:456-485`). Standing: largest port in flight (213
actions; `INSTRUMENTATION-CONTRACT.md:487-509`).

**T5. Canvas** (Technē "Canvas / Constellation"). Contract: arrange,
frame, relate artefacts; drag is presentation; drawn relations are proposals
until promoted (`WORLD-SHELL-DESIGN.md:265-267`). Implementations: **none
landed** (lane-1 targets A1–B4 all pending, `FUNCTIONAL-CROSSWALK.md:20-33`);
the minimap geometry already serves both graph and canvas
(`navigationMinimapGeometry.ts:14-15` "The affine origin differs between the
native graph… and Canvas"). Mockup: `canvas` aperture (`world-shell-mockup.html:815`),
`cvEdges` overlay (`:1612-1613`). Devices: frame/relation presentation
controls — unspecified beyond the mockup. Standing: OPEN (design-specified,
unbuilt).

**T6. Scenes / Journey** (Technē "Journey / Scenes"). Contract: walks as
ordered scene rows; ▶ walks, ● records (`WORLD-SHELL-DESIGN.md:257-260`).
Implementations: none as a pane (scene rows live inside the retained app and
the mockup); lane-3 E-targets and lane-5 T1–T13 pending. Mockup: `scenes`
aperture (`world-shell-mockup.html:813`), walk stepping (`:1274-1275` stepWalk,
`launchScene`). Devices: walk pace/stop/presence (transport slots, Technē
column `modeGrammar.ts:442-471`). Standing: OPEN.

**T7. Palace** (Technē "Palace / Integral Whole"). Contract: enter a
location; rooms composing native refs; guided path; portals; private room
fogs (`WORLD-SHELL-DESIGN.md:247-249`). Implementations: none landed
(lane-5 T14–T24 pending). Mockup: `palace` aperture + `palaceSVG`
(`world-shell-mockup.html:816`, `viewBody0` `:1264`), palace scale on the
World instrument (`:1517`). Standing: OPEN.

**T8. Document** (Base's four forms + files/sources). Contract: a hosted page
or native file over its CAS identity — form, file, revision, bindings,
highlights, notes, packet; the save router's named outcomes. Implementations:
the document hosting path (`document/frame.ts` sandboxed iframe, bounded
postMessage, save router `saved|unchanged|stale|conflict|refused`,
`WORLD-SHELL-DESIGN.md:501-510`); `DocumentDayDieFace`, `DocumentFlowFace`
(`worldShellFamilies.ts:56-82`); source surfaces in the cradle
(`desktop/cradle/src/surface/SourceSurface.tsx`, `SourceHistory.tsx`);
detached kinds `source, file, flow` (`WORLD-SHELL-DESIGN.md:454-456`).
Mockup: `day/flow/thing/being` apertures (`world-shell-mockup.html:818-821`),
the four paper forms (`:1268-1269` docView; DOCS `:701-717`), Document|Devices
detail (`:1642`, clipDetail `:1660-1662`). Devices: Text · Highlight · Notes ·
Packet · Answer · form devices (Die faces · Participants · Bindings) —
`WORLD-SHELL-DESIGN.md:124-131`; packet as "exactly what the agent receives"
(`:128-131`). Standing: most satisfied — this type is where the ontology is
already the landed practice.

**T9. Sessions (session grid)** (Factory Session; Base Day·Session; Live
Session). Contract: tracks are lanes, clips are material, scenes are rows;
launch/record/trim/split. Implementations: the agent shell's session grid
(`agent/` — 28 files, `DLW-PLAN.md:236-237`); Live's grid in the mockup only.
Mockup: `sessions` aperture (`world-shell-mockup.html:822`), `docgrid`/`musicsess`
(`:1701-1703,1710-1711`), the full session grammar
(`agent-shell-mockup.html` §3.3, WIDGET-GUIDE §3.3). Devices: per-track mixer
strip (mockup §3.4); transport slots (Factory column, `modeGrammar.ts:318-347`).
Standing: agent-shell landed; Live-craft and per-mode grids open (§4.1 chapter).

> **Re-pinned 12 Oct 2026 (P0-V2 item 23).** The mockup cites still resolve to the same code: `world-shell-mockup.html:822` (`sessions`), `:1701-1703` and `:1710-1711` (`docgrid`, `musicsess`, the view body). The `agent/` cite is stale. `DLW-PLAN.md:236-237` no longer carries it (those lines now hold M5-5 text); the `agent/` (28 files) row is at `DLW-PLAN.md:296`, a 10 Oct count. Today `packages/live-shell/ui/src/agent` holds 32 files and `desktop/cradle/src/agent` holds 44; the plan does not say which tree its 28 counted. "Live's grid in the mockup only" was not re-checked here.

**T10. Thread** (Factory centre; conversation log). Contract: one session's
conversation + tool events, nested as spawned. Implementations: the agent
shell thread view (`agent-shell-mockup.html` §3.6; `renderThread` `:706`).
Mockup: `thread` aperture (`world-shell-mockup.html:823`), thread view with
needles (`agent-shell-mockup.html` §3.6). Devices: effort/autonomy overrides
live on the agent device, not here. Standing: landed in the agent shell;
pending its mode-grammar composition.

**T11. Terminal**. Contract: the selected scope's shell, live; follows the
selected run. Implementations: the cradle's terminal body kind (binding
`terminal: {cwd, command}`, `types.ts:88-92`; admitted detached kind,
`WORLD-SHELL-DESIGN.md:454-456`). Mockup: `terminal` aperture
(`world-shell-mockup.html:824`), `viewBody0` terminal body (`:1271`), dock
tile (`:1625`), agent tile (`agent-shell-mockup.html:824-851` `term`). Devices:
none — a reading surface. Standing: landed as a body kind; trivially an
instrument type under G1.

**T12. Log / task log** (the Clip reading of Factory). Contract: the selected
task's tool-run log; Fold/Steers/Open-thread affordances. Implementations: the
agent shell's clip log (`agent-shell-mockup.html:811-821` `renderClip`); the
gateway frame monitor (`renderGw` `:769-786`). Mockup: Factory Task log detail
(`world-shell-mockup.html:1663-1665`), Task log|Agent chain pair (`:1642`).
Devices: none (readings). Standing: landed in agent shell; the "one log
surface per depth" question is the gateway view's (chrome, not instrument).

**T13. Conversation (Nara)**. Contract: the situated agent's surface; canonical
CAS in AIKit, shell binds via `oi.nara-dialogue-binding/v1`; transcript is
Timeline material. Implementations: `ConversationNaraFace.tsx` +
`worldShellFamilies.ts:83-90` (`nara-conversation` face, binding declared);
encounter surfaces hosted in panes/detached windows
(`WORLD-SHELL-DESIGN.md:511-515`). Mockup: `convo` tile + Base companion
Conversation (`world-shell-mockup.html:1623`, `:1548-1553`), Anima/Epii
companions (`:1534` CTABS). Devices: the companion's own Context tile shows
the packet (`:1553`). Standing: declared; hosting exists; face admission is
the L2 pattern to finish.

**T14. Browser** (the inspection instrument; the catalogue itself — §4.1).
Contract: categories over actual owners; category/results above, contextual
pool below; preview ≠ open ≠ add; the instrument/device chooser (the `views`
category). Implementations: `WorldBrowser.tsx` (dispatches
`oi:epi-open-knowledge`, `WORLD-SHELL-DESIGN.md:437-439`); the agent-shell
browser; `NativeTechneBrowser` instrument list (`WORLD-SHELL-DESIGN.md:522-524`);
landed `ModeBrowser` (`DLW-PLAN.md:169-172`). Mockup: browser two-column
geometry (agent `agent-shell-mockup.html:55-91` §browser; world `:92`,
bcols `:451`); BCATS per mode (`world-shell-mockup.html:1469-1473`); CATS
(`agent-shell-mockup.html:547`). Devices: hot-swap pool semantics (DLW-PLAN §2
"Browser" row). Standing: geometry + categories landed; the *chooser* gestures
(click → focused pane, ⇧-click → split, `world-shell-mockup.html:1505,1583-1584`)
are not yet grammar (G5).

**T15. The instrument rack (composite)**. The Device view as a type: the
focused pane's chain of device faces, with its own presentations
(compact/configure/deep — three disclosure levels, `UI-UX-CONVERGENCE-STUDY.md:71-77`).
Contract: chain strip; fold; enable light as a reading; expand to Deep;
pop-out rides detach. Implementations: `NativeDeviceStrip.tsx`,
`NativeRackEditor.tsx`, `NativeDeviceEditors.tsx`, `NativeWorldDetail.tsx`
(`WORLD-SHELL-DESIGN.md:482-494`); the SDK's `inhabitantRack.tsx`. Mockup: the
agent chain (gateway→agent→skills→world→git, `agent-shell-mockup.html:800-810`
`renderChain`); Technē Instruments column (`world-shell-mockup.html:1646-1649`);
Live's Drum Rack → Glue Compressor → Reverb (`:1759-1765`). Devices: it *is*
the device surface. Standing: landed pattern; per-mode chain composition is
the mode chapters' work.

**T16. Inspector tiles (the context dock)** — tentatively a type family, not
one type. The dock's tiles are miniature aperture instances of other types
(session list, frames, agents hive, files, web, graph, diff, ledger,
approvals, wiki, calendar — `agent-shell-mockup.html:824-851` `CTX`; world
`WID` `world-shell-mockup.html:1623-1625`) plus the pure-conversation tiles.
The ontology's reading: **a tile is an instance of an instrument type hosted
in the dock region at tile size** — the same instance law, smaller frame; the
pin affordance ("Stop following; keep this view", `agent-shell-mockup.html`
dock header) is the same follow/pin law as panes. Classification with §16
(inspectors are a family's fourth surface) holds: *inspectors* are the
family-declared contextual panels; *tiles* are the hosting geometry. Whether
every tile must be expressible as a full pane instance (drag a tile into the
centre = open the aperture) is **OPEN-QUESTION G7** (§5) — the mockups imply it
(the agent tile's terminal preview opens the terminal view) but no source
rules it.

**Chrome, explicitly not instruments** (the inventory's remainder): the
transport bar (one transport, five meanings — `modeGrammar.ts:149-158`),
status bar (28 px; the F2 explanation surface, WIDGET-GUIDE §1), the 2×2
launcher (chrome over the catalogue), pane tab rails and the ⊞ pane menu
(`world-shell-mockup.html:1615,1620` — pane-engine chrome), the aperture slot
(the focused pane's context + view controls — the groove-pool geometry,
`world-shell-mockup.html:1509-1531`; WIDGET-GUIDE §4.3), companion headers,
dialogs/toasts. None generates a pane body; all are frame.

**Count: 16 instrument types** (T1–T16), of which T1–T4, T8, T9–T11, T13, T15
have landed implementations; T5–T7 are design-specified only; T12/T14/T16 are
landed surfaces awaiting their formal type declaration (G1).

### 5.8 The graph instrument type contract

*Folded verbatim from `wayfinder/DLW-PANES-ONTOLOGY.md` L565-574 and L577-642 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

The owner's worked example, fully.

**Owner correction, 13 Oct 2026 (DEVICE-SEMANTICS-LOCK §8.1):** the two
graphs studied here are two instruments, not two implementations of one
Graph type. The atlas coloured graph is the 0 instrument's second view
(Earth and solar system ⇄ Graph); the Obsidian-RE knowledge graph is a
standalone instrument under `docs/cradle/WIKI-CONSTELLATION-SPEC.md`. The
contract below remains the template for a type with several
implementations; read "both implementations" as the two graphs' separate
obligations, each kept whole by its own instrument.

What *any* graph instrument must do — drawn jointly from both implementations'
existing obligations (neither may lose a behaviour the other proved):

```ts
/* SKETCH — the Graph type contract, composed from the two implementations' */
 /* own landed obligations. Cited obligation-by-obligation in §3.4/§3.5.    */
interface GraphInstrument extends InstrumentTypeDeclaration {   // §1.1
  id: 'graph';                          // one TYPE, two implementations:
                                        //   'atlas' (coloured constellation)
                                        //   'knowledge' (Obsidian-RE lineage)

  // — data —
  //  Nodes/links are a SECOND VIEW of owned material, never a store:
  //  atlas: "the graph is a second view of exactly the field the globe
  //  shows" (atlas graph/build.ts:1-2); knowledge: graph data "remains
  //  owned by its native semantic system; the projection is a surface
  //  over it" (WORLD-SHELL-DESIGN.md:415-417).

  // — navigation —
  //  camera {x,y,zoom}; pan/zoom/pinch; focus/travel to a ref; zoom bounds.
  //  atlas: d3-zoom + whole/local modes (graph/view.ts:2-4);
  //  knowledge: Camera + zoomAt + travel easing + keyboard pan/zoom
  //  (GraphCanvas.tsx:4,56,113-120) and camera handoff to a minimap
  //  (navigationMinimapGeometry.ts:16-25).

  // — selection & encounter binding —
  //  pick/hover with neighbourhood emphasis; selection propagates as an
  //  encounter transition (subject), never per-view state; the pane may
  //  pin a subject (binding.subject_ref, types.ts:111-118).
  //  atlas: GraphHandlers.onSelect/onEarth/onWhole (graph/view.ts:12-20);
  //  knowledge: onSelect/onOpen/onClear + unresolved-ghost honesty
  //  (GraphCanvas.tsx:10,67-69,80-81).

  // — honest ghosts —
  //  unresolved links render as ghosts, never invented nodes
  //  (lane-1:C1, FUNCTIONAL-CROSSWALK.md:34; atlas GHOST_VIS whisper,
  //  graph/view.ts:8; knowledge dashed hollow nodes, GraphCanvas.tsx:80).

  // — devices —
  //  its device set presents when focused (facesFor, manifest.ts:165-171):
  //  atlas: depth, dust, tie bases, spread, gravity, sky anchors, fit
  //  (graph/tools.ts:7-17) + the one-control Earth⇄Graph switch
  //  (graph/switch.ts:1-4);
  //  knowledge: labels (automatic/all/focus), arrows, emphasis, minimap
  //  toggle, context menu (GraphCanvas.tsx:10,147-154).

  // — disclosure —
  //  minimap/overview where the implementation carries one (knowledge:
  //  NavigationMinimap + shared projection geometry,
  //  navigationMinimapGeometry.ts:5-12; atlas: the atlas's own strip/focus
  //  labels, src/ui/).

  // — honesty & a11y —
  //  idle-when-clean rendering (atlas view.ts:4-5 "renders only when
  //  something changes… goes fully idle otherwise"; knowledge: one
  //  demand-driven rAF loop, GraphCanvas.tsx:11-12); every subject
  //  addressable (knowledge accessibility pages, GraphCanvas.tsx:146,155).

  // — retention —
  //  'retain-concealed': camera and selection survive conceal
  //  (projectionModules.ts:133-141; the Atlas's own time-window snapshots
  //  across mode transitions, WORLD-SHELL-DESIGN.md:466-469).
}
```

### 5.9 The template every instrument type follows

*Folded verbatim from `wayfinder/DLW-PANES-ONTOLOGY.md` L723-732 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

Every other type follows the same five moves: (1) write the type contract as
the union of its implementations' proved obligations; (2) name each
implementation's file-level owners; (3) give the type one browser row and the
implementations the chooser; (4) bind instances as kind+subject (+implementation
choice); (5) declare the device set and retention class in the manifest. §5's
gaps are what stands between here and there.

### 5.10 What the pane-instrument kind system resolves — the browser, default and user sets, the mode grammar

*Folded verbatim from `wayfinder/DLW-PANES-ONTOLOGY.md` L735-812 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

##### 4.1 The left-sidebar ambiguity

**Resolved: the browser per mode is the catalogue of the mode's available
instruments, devices and content.** Not a file list, not a nav tree — the
*chooser* over the ontology. The mockup's per-mode columns are the evidence,
mode by mode (`world-shell-mockup.html:1469-1473` `BCATS`):

- **Base**: Central — Days, Flows, Beings, Things, Goals (content categories);
  Project — Files, Wiki; **New** (the four forms = the Document type's
  factory row, `:1490`); **Views** (the instrument chooser, `:1505`).
- **Factory**: Work — Sessions, Agents, Runs, Chats; Ground — Files,
  Knowledge, **Views**.
- **Expressions**: Field — Graph, Scenes, Library; **Views**.
- **Technē**: To hand — Sources, Files; World — Bodies, Locations, Earth
  places, Palaces, Journeys; **Views**.

Every column is one of three things under the ontology: a **content category**
(instances of some type over owned material), a **type chooser** (Views: the
instrument catalogue — the mode's available instruments, from which a new pane
instance is pulled), or a **device category** (devices offered for insertion —
the study's law: "A device category is useful only when its insertion/
capability is real", `UI-UX-CONVERGENCE-STUDY.md:61`). The landed grammar
already types the categories as data with `cut`/`waiting` states and owning
families (`modeGrammar.ts:79-95`; base `:234-250`; factory `:303-312`; technē
`:419-436`) — the catalogue reading is what those categories were always
for. And the agent-shell browser shows the same tripartite reading for a mode
whose content is work: Library categories over owners (Agents, Agentsets,
Skillsets, Worlds, Context, Git, Models — `agent-shell-mockup.html:547`),
Places, Favorites.

The region *below* the browser resolves with it: the aperture slot is the
focused pane's own context + view controls (follow/pin, the view's scale/lens,
the pane layout — `world-shell-mockup.html:1509-1531`), in the groove-pool
geometry (`UI-UX-CONVERGENCE-STUDY.md:63`; WIDGET-GUIDE §4.3) — not a second
browser, and never a pile (`:63`: "a small selector changes that lower area's
role").

##### 4.2 Default sets + user sets as trivial consequences

Once panes host instrument instances and the mode grammar declares each mode's
presentations and categories, "default sets" is not a feature — it is the
mode's declared initial arrangement (§1.5): the mockup's `S.modes` seeds
(`world-shell-mockup.html:746-750`) + `newPaneTab()` (`:1602`) + `VIEWMAP`
(`:1707`) are the default sets in rehearsal. "Users save their own, per the
workspace" lands on the engine's existing persistence: a named user set *is*
a `LayoutState` snapshot under the workspace book (`modeLayouts`,
`store.ts:42,125-141`), with the honest-reopen law the engine already enforces
(closed-stack reopening, `types.ts:167-171`; restore point
`types.ts:234-238`, `engine.ts:642` `restoreLayout`). The Ableton analogy closes exactly: a Live Set saves
tracks·devices·arrangement·transport state; a DLW set saves
panes·instrument-instances·bindings·chain standing — and, like Live, *not*
the semantic material, which stays owned (the World is never copied into a
set; `types.ts:12-13`).

##### 4.3 The mode system as the grammar that names the defaults

The landed mode grammar (`modeGrammar.ts`) is the ontology's defaults
registry, already: per-mode Session|Arrangement presentation meanings
(`:122-124,171-172,224-225,…`), the Clip|Device detail pair (Rev 4,
`:125-129,173-176,226-229,296-299,358-361,410-413`), browser categories
(`:127-129`), centre compositions (`:130-133`), status identity (`:134-136`),
and the 28 transport slots' meanings per mode (Rev 5, `:136-138,149-158`,
full tables per mode). What the grammar does *not yet* declare — the base
instrument per mode and the mode's default pane arrangement — is gap G6. The
composition is exact: the grammar is "Rev 5's tables as typed data" (`:1-3`),
and the ontology supplies the nouns those tables were re-meaning.

##### 4.4 No contradiction with §5.5 — shown, not asserted

§1.6's table is the proof; the two sentences that matter: §5.5 asks "what kind
of rack resident is this?" and the pane-instrument kind asks "what generates
this pane's body?" — different questions, one lattice. The instrument device
kind (§5.5.4) and the pane-instrument superordinate kind meet without collision
in Technē: the *instrument* fills the pane; the *face* sits on the detail row;
both are the same type seen at two exposures — which is Rev 3/Rev 4's own
"the instrument is the instrument" ruling (`WORLD-SHELL-DESIGN.md:143-148,
88-89`) rendered as ontology.

## 6. Central mode, resolved

Central is not a fifth view and not a separate app; it is **one World
context** (`WorldContext.world: 'central'`) whose material projects through
the same four projections and inhabits the same rack:

- **Day / NOW history** → Timeline tracks (a day is a lane; returns,
  handoffs, clearings are clips on it). The day die and flow documents →
  document devices (`DayDieFace.tsx` already hosts `ql-daily-die.html` with
  `DayFormSession`; sandbox messages stage, never authorise). Day close /
  archive flows stay native owners, surfaced as browser entries.
- **Wiki / M0** → already a native Expression projection
  (`wikiNativeExpression.ts` — the wiki is an Expression/Scenes projection;
  registers read from the kernel navigator; no duplicate document store).
  Opens as Expressions material, Constellation for relations, document
  devices for pages.
- **Conversations** → encounter panes + Nara device + Timeline clips
  (§5.3).
- **Ground chooser / placement / receiving** → browser categories and dock
  cards over the native owners, not a parallel UI.

Nothing new is stored. Central mode is the shell with Central material
selected — the tripartite spine's world context, not a mode switch.

### 6.1 The Epi-Logos lens — the three registers, precisely

*Folded verbatim from `wayfinder/DLW-PLAN.md` L3117-3171 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 6.2 How the Epi-Logos lens relates to the five modes

*Folded verbatim from `wayfinder/DLW-PLAN.md` L3288-3336 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

## 7. Factory

Factory supplies World phenomena — Positions, occupants, current work,
attempts, communiques, artifacts, returns — and those project through all
four views and inspect through the implicit agent/files surfaces. No
bespoke Factory application is built. The OpenRig-derived behavioural
semantics (inhabitation, custody, current-work derivation, handover,
refocus) are already implemented in `factory/src/current_work.rs` and
`inhabitation.rs`; the joins to build are encounter-side: selected subject →
prepared context → commission → attributable artifact → Return, with the
Run's Expression production moved out of view lifetime (the recorded
`FactoryLive.tsx` producer-consumer fault — rendering may sleep; work
stays recoverable). Factory work appears as Timeline tracks (runs,
stages, messages), Constellation nodes (agent → task → sources → files →
results), Earth placements where situated, and Expressions where a run
acquires form. Agency review is an instrument family (crosswalk: native
agency/team/Factory work review), with Buzz (`/Applications/Buzz.app`
v0.5.20) as the resolved reference for queue/steer/interrupt/review
behaviour.

### 7.1 Agency enters the device grammar — five forms, the act as the unit, harness placement, agents in the work

*Folded verbatim from `AGENTIC-CONVERGENCE.md` L216-318 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

#### The move: agency enters the device grammar

The shell's existing law — capability is met at the region where its form
belongs, at the disclosure level its moment needs. Audio devices already
live this: a compact face on the chain (perform), a settings toggle
(configure), a deep editor in the center (deep edit). **An agent is the
same shape with work instead of signal as its medium.** Not a chat app
docked at the side; a member of the work, addressable at every region.

The user-colour identity rule carries: agents render with their own
identity colour everywhere they appear (browser card, device face,
working strip, thread membership) — the presence of agency is always
legible without a second chrome system.

#### Five forms of agency, met at five places

| Form | Region (existing) | Native shape |
| --- | --- | --- |
| **Discovery** | Browser above (categories/results) | Agents, Teams, Skills as browsable material with real owners (`agent-profile.roster` via kernel; skill catalogue with stewardship + compatibility, from the cradle's `SetupSuggestion` grammar). Audition = preview card; placement = **drag into a scope** (track header, Scene row, Object, master). Drag is membership, exactly as browser→track drag is instrumentation. |
| **Instrumental** | Device chain / bottom detail (third mode: **Agent**, beside Clip and Device) | The **Agent device face**: per-scope configured capability at the three disclosure levels. Compact: autonomy, knowledge-bound chips, admitted skills, budget, review gate, chosen delegated controls (macros). Configure: steering mode, model/runtime, memory injection bounds, escalation, governance refs. Deep edit: the act editor in the center. |
| **Conversational** | Center presentation: **Conversations** (beside Body / Session / Arrangement) | The Buzz member timeline bound to the current scope — humans and agents interleaved as peers, work products as native cards (diff, PR, approval, snapshot), steering in place (composer @relay, per-agent working strip, regenerate/steer affordances). The room is a projection of the work's scope, not a separate app. |
| **Procedural** | Browser below pool (new role: **Delegations**) + Status | The act lifecycle in Groove-Pool geometry: pending/steered/blocked/done rows with agent, scope, standing (basis/revision), steer/release/cancel. Status carries write standing and the act ledger (prompt-completed / interrupted / steered / rotated). |
| **Embodied / encounter** | World apertures (Journey, Palace, Places, Body) + right dock Console | An agent's `worldRef`/`character` gives it standing in the work's world presentations — agents are *encountered* where the work's world is shown, and observed live through the Console's observer stream (encrypted observer frames) and approval inbox. This is where the cradle's agents-in-a-world intent lands — see the preemption note below. |

#### The act is the unit of configuration

`CONTRACT.md` gives the mechanics; the cradle gives identity; the act is
the shell-native binding of both — an addressable, revisable document
(the "clip" of agency), not a settings screen:

```
ActSpec {
  agent_ref, profile_revision          // identity + the revision it was configured against
  scope: expression | scene:<id> | object:<ref> | composition
  autonomy: suggest | act_with_review | autonomous
  knowledge_bounds: reads:[ scene | registers:<names> | explicit refs ],
                    excludes:[ … ]     // read routing — what it may know
  write_routing:  layers:[ source|layers|placement|properties|transport|none ],
                  mode: proposal | draft | direct_with_receipt
                                                // write routing — what it may touch
  skills_admitted / skills_denied               // skillsets, per act
  review_gate: { diffs: bool, approvals: bool, escalation: agent_ref | human }
  steering: steer | queue | interrupt | owner-interrupt   // CONTRACT.md §3
  budget: { turns, wall_clock, cost }
  macros: [ { name, skill_ref, scope } ]        // chosen delegated controls — the toolbelt
}
```

- **Read routing and write routing** are the agency analogue of Live's
  Audio-To/Sends: knowledge bounds and projection details are *routing*,
  visible and editable at the device face, respected by the harness.
- **Macros are chosen controls**: a delegated action pinned to the face
  the way a property is pinned to the compact rack — same Follow/Bind
  scope semantics, same DocumentStore/composition path, same
  save/reopen continuation.
- **Disclosure states are the cradle's truthful vocabulary**
  (Selected / Projected / Brokered / Observed effective / Adapter-inferred
  / Unknown / Withheld / Pending reload) — never a generic green badge.
- Save/reopen preserves the ActSpec and its transcript; a recovery draft
  is separately disclosed. Steering, withholding, ack outcomes and
  budgets follow `CONTRACT.md` verbatim (steer-first, exact framing
  strings, owner gates).

#### Harness placement

The harness (buzz-acp-style ACP client, or the cradle's
`nativeAgentClient`) sits **behind** the Agent device the way a device's
DSP sits behind its face: one adapter family, discovery presets, custom
harnesses (Buzz's preset list is the existence proof: buzz-acp, grok,
goose adapters, claude-agent-acp, codex-acp, custom commands). The shell
never speaks a vendor protocol directly; the registry admits harnesses
the way it admits devices.

#### Preempting agents-in-a-world

The cradle's paradigm (agents as inhabitants of curated workspace worlds,
OpenClaw-inspired, developed but unsurfaced) is answered, not discarded:
**in this shell the world is the work.** An agent does not live in a
separate agent-land you visit; it holds scopes inside the open
Expression, and its `worldRef`/`character` surfaces through the world
presentations the work already has (Journey, Palace, Places, Body) plus
the live observer stream in the Console. Meeting an agent is meeting it
*in the work* — at the region where the form of agency you need lives.
The gateway becomes an adapter behind a device; the roster is Central's
accepted agent profiles through the kernel, never a hardcoded crowd.

#### Registry mapping (no frame changes)

- Browser above: `browser-section` panels for the Agents/Teams/Skills
  categories (existing slot).
- Browser below: the pool's role selector gains the **Delegations** role
  (presentation of the pool region, as the study already allows).
- Center: **Conversations** is a center *presentation* like
  Session/Arrangement — a selection of the current work's cut, not a
  panel.
- Bottom detail: third mode **Agent** beside Clip/Device; the agent face
  joins the `devices.*` panel family grammar (generic face component,
  descriptors from the owning adapter, values owned by the ActSpec
  document).
- Right dock: Console cards (Approvals, Observer, selected-act summary)
  as `right-dock` panels, available when requested.
- New PanelSlot values: none required. One-line additions only if the
  pool role selector needs a registry home.

## 8. Time

Two clocks, one typed bridge — the lane-6 two-clock doctrine stands. Civil
time (Day/NOW closure law) and work/performance time remain distinct
owners; the shell offers three deliberate temporal controls, linkable but
independent (the transcript's Now / Occasion / Instrument transport,
retained):

- **Now** — the situated civil field (the Atlas's shared bottom clock
  generalised; drives Earth and Timeline alike).
- **Occasion** — a selected or retained event's time (the K8 sky
  contract's retained-occasion behaviour: reopening an exact saved occasion
  keeps its snapshot and separately qualifies current admission).
- **Transport** — the Timeline projection's playhead over performable
  material (sequence clocks family; the M3 clock device exposes
  inscription/lens circles).

The Atlas's non-linear time scale (`src/data/time.ts`) is the Timeline
projection's deep-time answer — honest compression without fabricated
precision (crosswalk lane-2 T4/T5).

## 9. Mapping the existing actions

The 126 targets' eight operation families land as (projection, rack)
destinations rather than bespoke surfaces:

| Operation family | Lands as |
|---|---|
| Rich Glyph Sequence material | Expressions projection (clip/arrangement editing) + sequence devices |
| Sequence clocks and performance | Timeline transport + clock device; native evaluator observed separately from authored values |
| Independent force contributions | Field devices in the rack (force editor, morph, colour — landed pattern); shared Field edits stay shared |
| Device lifecycle and rack topology | The rack itself: insert/select/fold/move/duplicate/remove/activate, hot-swap, presets, macro mapping |
| Session launch and recorded Arrangement occurrences | Timeline projection over native Scene/Field membership; launch/record/move/trim/split |
| Source/Graph/constellation/editor Return | Implicit graph inspector + encounter return (subject_ref/anchor/revision retained; FieldEncounter/`selection_set`/`portal_open` already decided, O:I #592) |
| Native agency/team/Factory work review | Agency instrument devices + Timeline/Constellation/Earth projections of work; implicit agent/files inspection |
| Gesture state, async replies and lifecycle | The custody/apply aperture (landed): retained drafts, same-basis writes, Apply/Discard/Retry |

The retained app's full action inventory exists
(`expressions-ui-actions.json`, `router_actions` with
`external_migration: unaccepted`) — the mapping work is binding those
actions to the aperture and the Timeline grammar, not re-inventing them.
Destination counts from the crosswalk (Places 30, Expressions Clip/Arrangement
26, Timeline 25, Canvas 14, Journey 13, Palace 7, Graph 5, Journey/Palace 4)
distribute across these pairs; no target changes identity or acceptance.

## 10. Smallest seam set

The smallest set of architectural seams between today's code and this
design:

1. **Projection pane kinds** — extend the pane engine's body kinds with the
   four projections; promote the engine to compose the main area per mode
   (modeLayouts already exist). Hidden retention carries over.
2. **Projection module boundary** — each projection is a module with
   mount/unmount + encounter subscription (the Atlas's vanilla-TS
   controller mounts the way the retained app's controller does; no React
   rewrite of the Atlas).
3. **Encounter bridge** — encounter.subject/occasion/trail drive each
   projection's state machine; Atlas World·Focus·Manifestation·Thread·Deep
   ↔ spine mapping (§2). No second selection store.
4. **Inhabitant manifest** — generalise the registries (panels slots,
   FIELD_FAMILIES, browser categories, detached kinds) into one declared
   inhabitant manifest admitted through `inhabitants.rs`; document and
   conversation devices become face kinds with bodies.
5. **Timeline generalisation** — Session/Arrangement present any World
   track set; the set model (`useSet.ts`, `document.ts`) gains World
   track adapters (day tracks, run tracks, conversation clips).
6. **Occurrence binding contract** — the generalised `Occurrence`
   (subject_ref + place + time + image + basis) as the Earth projection's
   data seam; QL sky binds as the M2 layer; no separate map subsystem.
7. **Time spine** — Now/Occasion/Transport controls over the two-clock
   bridge; Atlas non-linear scale adopted for deep time.
8. **Pop-out** — device pop-out rides the pane engine's existing
   detach/redock; no new windowing mechanism.

## 11. Not-do laws

- No parallel World models, event stores, selection systems, graph stores,
  Factory/Expression state stores, agent registries, or filesystem models.
- No hierarchy implementation — projections are siblings; the World is not
  a node above them.
- No inspector, no false view tabs, no duplicate timeline scrub bar
  (measured-Live rulings stand).
- No cramming UI into footers and headers; missing surface is a pane, not
  a compression exercise.
- No claims beyond native owners: no audio playback or device editing
  before those owners land; Factory and Central entry points stay reserved
  for their native owners; the source-by-source licence gate governs all
  reference adoption (the Atlas is owned source — acquisition B; its NASA
  tiles and Wikimedia images are external *data* with their own terms,
  recorded, not code adoption).

### 11.1 Kernel rules for builders

*Folded verbatim from `wayfinder/DLW-VISION.md` L1127-1143 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

- **Derive first.** Read the map, the lock and the rulings. Call a thing Open
  only after the sources are exhausted (LAW:21).
- **The map wins.** New ratios and tables enter only by re-authoring the map.
  Renderers hold no local codon, 72 or tarot tables (LAW:19,61-64;
  INTEGRATED-1-2-3:654-655).
- **Bind, never recompute.** "Without renderer-local recomputation or fabricated
  availability" (LOCK:722). One profile tick, no widget-local clock.
- **Keep primed and unprimed apart; qualify every M4.** Epii ≠ Palace ≠ Aletheia
  (LOCK:400-406,510-517).
- **Never pair sixfolds, or the Logos cycle and modes, by count**
  (LOCK:55-85,766).
- **A coordinate existing is not it being ready.** Missing legs degrade visibly
  (INTEGRATED-1-2-3:424-432).
- **Protected stays protected.** Lived pattern → canon only through propose →
  review → accept → apply, dry-run by default (INTEGRATED-4-5-0:639-660).

## 12. Product families — the six carvings

Owner direction, 8 October 2026, extended in conversation from the
agent-shell mockup (`agent-shell-mockup.html`, tokens copied from the real
shell styles at `45e15ed8b`) and the port accounting
(`EXPRESSIONS-PORT-STATUS.json`): the six products — **central, actuation,
ai-kit, software-factory, workcell, quaternal-logic** (the full-suite
backing, `footprint.json`) — each contribute a **device family**, and that
is the cleanest way to expose their functionality across every view,
surface and lens.

A family is an inhabitant manifest (§5.5) with declared contents:

- `browser` — its left-browser categories and places;
- `faces` — its rack devices, each implementing the proven aperture;
- `params` — its typed parameter addresses (kind/key/value grammar, ranges,
  units, write path under the writeShared law);
- `projections` — optional adapters that project family material into the
  four views (Factory runs → Timeline tracks; QL sky → the Earth
  projection's outward expansion; Central ground material → Constellation
  overlays);
- `inspectors` — its implicit agent/file-grade contextual panels;
- `time` — which time strata it consumes and which temporal material it
  contributes (§14);
- `telemetry` — the observables it exposes as modulation sources.

The manifest is authored by the family's native owner — this is the
mechanism behind "Factory and Central entry points stay reserved for their
native owners": the shell's door is neutral, the keys are held by owners.
The seventh carving is already in flight: the Expressions family's port
ledger assigns each of 213 legacy actions an `outward_home` on neutral
surfaces and an exact `boundary_op` — the porting work is filling the
neutral frame with family material without changing the frame.

Family-by-family:

**Central — the clip-view craft of the ground itself.** In Live, clip view
holds the material craft (warp, gain, fades). Central's material is the
ground: files, folders, wiki, days, places, worktrees, branches. Its
devices: a ground/hygiene device (worktree census, branch audit, erroneous
worktree and stray-branch detection, seat occupancy — the field-health
behaviours as readings and tenders); an impact device (select a folder or
note → its Central-web neighbourhood, references, and the sessions touching
it); the document devices (§5.2); day/now operations (close, rollover,
archive recovery) as temporal controls bound to the civil-time stratum.
When the selected material is a Central subject, the detail area shows
Central's clip-view-grade editors — CAS identity, basis and the save
router's named outcomes (`saved | unchanged | stale | conflict | refused`)
are this world's warp markers: typed, honest, per-material.

**Actuation — tuning the engine that runs agents.** Harness/model device
(model, reasoning effort — the mockup's effort knob — custom agent loop);
the experiment device: a declarative run with telemetry capture
(`{subjects, loop, telemetry set, cadence, comparison basis}`), whose run
appears as a Timeline track, whose telemetry is observables (modulation
sources), whose results Return through Factory receiving. The clean seam:
Actuation tunes *how* agents run; AIKit supplies *what they can do*;
Factory organises *what work happens*. Three families, three aspects, kept
distinct where a monolithic "agent UI" would blur them.

**AIKit — skills as devices.** The mockup's proof: "Skills are this
session's plug-ins, held in a rack. Each chain is a skill; the light
admits or denies it. Macros drive several skills' settings at once."
Skill devices with admit/deny lights (the disclosure law made physical —
carried is not loaded, loaded is not used), skillset racks, macros
(Thoroughness, Test depth), knowledge-route devices, methodology loading
as enablement.

**Software Factory — work as World phenomena.** Run devices, attempt
review, artifact inspection, Return. Projection contributions put runs on
the Timeline, populations in the Constellation, situated work on Earth.
The mockup's hold/hand-back light ("you edited HeroShot physics while
Honey held it; Honey's hold is suspended") is custody made visible — a
device-level reading of the existing custody law.

**Workcell — where computation happens.** The seat device (claims,
occupancy, lanes, zones); the execution-target device (run in a VM or on a
remote machine) — "where does this run" as a parameter other families'
operations declare (a Factory run or an Actuation experiment names its
Workcell address); hygiene tenders (disk, build trees, orphaned processes)
as readings plus tending actions.

**Quaternal Logic — the cosmic.** Torus, sky/kerykeion, M3
clock/inscription/lens, deck work, chakra correspondences, the physical
music instrument matrices. Its projection contribution is the Earth
projection's outward expansion; the sky device is its compact face; and it
is the chronos provider (§14) — the clock and the sky are time *sources*,
not only devices.

## 13. The uncarved block — neutral core vs carved families

The shell core is the uncarved block: it knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture,
parameters, modulation routing, the time spine, and the admission door.
The core never says "Central" or "Factory"; products exist only as
admitted families. Carving = declaring a family = adding typed scope to a
neutral substrate.

Working test of neutrality: a seventh product should integrate with no
core change. If a core change is needed, either the family boundary or the
core concept is wrong — and the correction is proposed at the neutral
layer, never special-cased per product.

## 14. Modulation and specification

"Plugins/params introduce scope for modulation and specification" made
precise:

- **Parameter** = typed address with declared scope:
  `{family, device-instance, key, type, range/unit, write-path}`. The
  device change kinds are the seed grammar (`engine.{key}`, `morph.law`,
  `colour-setting{key:value}`); the family manifest generalises it.
- **Specification** = scope declaration — what an instance binds to:
  encounter, subject, pane, session. The aperture's target/basis is the
  existing mechanism. Tightening scope is specialisation.
- **Modulation** = a routing relation, source → target parameter, within
  declared scope, always through the custody/receipt law (modulation
  deepens writeShared, never bypasses it). Sources: time functions (§15),
  telemetry (Actuation), native engine observations (the crosswalk's
  "evaluator observed separately from authored values"), and other
  parameters via macros — the mockup's macros are the first modulators,
  and the rack-topology family's "macro range/curve/scope" is their
  contract.
- **Honesty law for modulation**: every modulated parameter shows its
  modulator (Live colours the modulated knob). Capability honesty applied
  to parameters — nothing moves without a visible cause.

The experiment case composes all of it: an Actuation experiment is
specification (scope: these agents, this loop) + telemetry (observables) +
modulation (cadence from cron, or M3 phase from chronos, addressing the
capture rate) + Factory receiving (results Return).

## 15. The time spine — locked at the top, bound from below

Time is locked at a higher level. Five strata, one spine; families bind
and may contribute material, never fork clocks:

1. **Chronos** — qualitative/cosmic time: kerykeion sky positions, the M3
   clock and inscription phases, Aion epochs, the planetary field.
   Provided by the QL family; exposed by the spine as read-only time
   functions any family may bind (an experiment cadenced by a transit; a
   day reading coloured by clock phase).
2. **Civil time** — the day/now closure law, owned by Central
   (`civil-time-policy.json`): days open and close, NOW clears, rollover.
   The spine exposes "the current day/NOW" as the default Now; day
   operations are Central-family devices.
3. **Cron** — scheduled/systematic time: automations, recurrences,
   telemetry cadences, sweep tenders. Families declare cadences as
   parameters; the spine (or a Workcell/Actuation executor) fires them;
   every firing lands as a Timeline clip — a cron run is temporal material
   like anything else. Cron is how "telemetry every N minutes" or "day
   close at 21:00" exist without any family building a scheduler.
4. **Transport** — performable time: the Timeline projection's playhead,
   sequence clocks, takes (record/replace/append — the port ledger is
   already full of take operations), loops and markers.
5. **Occasion** — retained time: a saved occasion keeps its snapshot and
   separately qualifies its current admission (the sky contract's
   behaviour). Standing in 1913's sky without lying about now is what
   makes historical exploration honest.

The §8 controls (Now / Occasion / Transport) are the user-facing face of
strata 2, 5 and 4; chronos and cron are the deeper platform strata. Time
as a modulation source closes the loop with §14: an LFO was always time —
this world's LFOs are transits, day phases, cron cadences and clock
phases, addressable from any family because the strata are locked at the
top.

### 15.6 The sample clock as the work-time stratum — the seven-row mapping table

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2290-2346 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 15.7 The five strata, as landed

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2350-2408 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

### 15.8 Units — NOW and DAY

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2412-2451 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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

## 16. Exposure — one family, four surfaces

Each family appears in exactly four places and nowhere else: the browser
(its categories), the rack (its devices on the selected material's chain),
the projections (its material via adapters), and the inspectors (its
implicit panels) — plus its time bindings and telemetry declarations. A
family needing a fifth place is a design smell: either the projection set
or the family boundary is wrong. This is the no-bespoke-UI law stated per
family, and it is how "QL-MEF and ta onta and all the rest become utterly
available" without any of them becoming an application.

## 17. The vertical proofs

1. **The Factory vertical** (retained from the transcript, still the right
   first proof): a real Factory agent performs a bounded piece of work on a
   real Jung/World object; the result is recovered through Earth, Timeline,
   Constellation, Expressions, the relevant devices, and agent/files
   inspection — identity, provenance, work and context continuous
   throughout; repeated with views closed, reopening, occupant change and a
   retained occasion.
2. **The Central vertical** (this design's addition): one real day is
   recovered through the Timeline (day track with return/handoff clips),
   the Day document device, a conversation clip + Nara device, and the
   wiki's Constellation — proving Central's resolution without a separate
   mode. Both verticals exercise the spine, the panes, the rack and the
   projections with nothing built twice.

## 18. The musical system — the layer beneath Revision 5's Live mode

**Owner ruling, 13 Oct 2026 (DEVICE-SEMANTICS-LOCK §0.2; QL-MEF Wayfinder
§0.4; DLW §9):** Live mode exposes one instrument — the M1 torus, the only
generator, shared with every Expression as one simulation — presented as a
rack widget, an expanded pool and the full torus in the centre; its keyboard
is the torus unwound (Jankó); scales follow Live's grammar; the Live corpus's
capacities are its chain devices, never a ported catalogue. Where this
section reads otherwise, the ruling stands.

Owner question, 8 October 2026: has the underlying musical system been
thought through — the instrument, the torus and clock projections onto the
Earth integration, and whether Expressions gains the full musical suite
integrated into its scenes and layers. Revisions 2 and 5 above already draw
the UX face (Live restored as the shell's base mode with one transport
wearing five meanings; the cosmos layers — M1 torus · M2 sky · M3 clock —
around your planet at orbit). This section records what stands beneath:
the owners, the law, the verified code, and the honest gap.

**The commissioned law** (QL-MEF #281 wayfinder; lane-6 SCOPE revision 2):
**M1 is the oscillator source** — owner D13; M2's pitch structures are
tuning/modulation over that source, never a second generator. Sound and
visible form are projections of one evolving state (the common-cause /
cymatics law) — never effects sharing a timestamp. Every physical or sonic
role is classified: a resonating body is not a moving emitter, a collision
trigger, an analyser, or a visual-only glyph (#281 §1.3).

**Verified foundations in the retained app (code, not plans):**

- **The C++ PCM and field owner** is real and disciplined: one managed
  native owner supplies PCM and identified field targets together over the
  host-authorised `ql-field-host` pipe adapter
  (`native-field/ql/instrument-session.mjs`; identity tuple
  event/subject/registry/geometry/material/model refs; exact cursors).
- **Playback honours the realtime boundary**: `native-audio.mjs` schedules
  bounded, ahead of the device clock, no graph queries in the callback;
  `controller.ts` carries `NativePlaybackPolicy` (block 8192, lead and
  lookahead 0.5 s) and `SCENE_SAMPLE_RATE=48000` taken from QL's
  `scene_field.rs` — the composed owner's device rate.
- **The M1 torus is on the stage** at QL's declared scale
  (`INSTRUMENT_PRESENTATION`: ±25/9 m → ±333 engine units, annotated as
  presentation, not source) with sky epochs (`NativeSky: 'none'|'now'||
  {epoch}`) and owner standing (manual/opening/following/held).
- **A real modal resonator exists**: `cymaticResonator.ts` — a
  continuously-driven damped resonator in the envelope domain, Chladni
  free plate (2D) and standing-wave cavity (3D); `entitySound.ts` gives
  per-entity voices with kernel-validated shapes (`expression_profile::sound`),
  `followCymatic` binding pitch to the cymatic/field frequency; scene
  causal trace and physical-form actuation are present.
- **The sky bus (M2's dated state) is landed QL-side** (the 29 September
  synth track's landed sky bus; still-open relations named there).

**The vendor references are defined, not executed.** The Sound Particles /
Shrapnel / Tetrad / Anukari recon (lane 6's converging input) exists as a
primary-reference catalogue and required research returns
(`M-PRIME-PHYSICAL-MUSIC-RESEARCH-ACCEPTANCE.md`: "It is not a report that
the vendor products … have been exercised"). What already sounds came from
the internal Chladni/material work and the QL owners. The references still
owe the performance and interaction vocabulary — emitters, collision
events, receivers, pickup placement — which is exactly the part that does
not exist yet anywhere.

**The realisation in this shell's grammar** — the DaVinci Resolve pattern
the owner names: an **integrated musical working mode, not another app**
(#281 §3.1), reusing the shell's own machinery. Revision 5's Live column
is that mode's transport face; beneath it:

- **M1** — the field/PCM owner docks as an **instrument device** in the
  rack (the played torus/field as a device face with the proven aperture);
  the stage stays the instrument's visible body. The old D-H hosting
  question (framed for a proprietary fork) is answered by this
  architecture: our own process, the pipe-transported owner — what remains
  is the realtime gate (measured latency, device recovery) in the Tauri
  shell.
- **M2** — the first **native modulation sources** of §14: the owner's
  audio/nodal readings (audio_octet, nodal_quartet) as observables
  addressing device parameters within declared scope; compiled relation
  plans before realtime execution; never a second oscillator (D13).
- **M3** — **score material in tracks and clips** (the Timeline
  projection's grammar): articulation and form sequences as clip material;
  body/form geometry stays the engine's visual body — one state through
  the shared owner. The port ledger's take machinery (record/replace/
  append) is the seed for performance recording. The form→body preparation
  pipeline (versioned prepared bodies, off-thread eigenstructure,
  crossfade/reinit policy) is #281's M3 packet — law today, not landed.
- **M4** — unchanged law: the Expressions application is the body; a
  declared world context, a personal Nara context and an explicitly shared
  context are distinct admissible occasions over the same source
  definitions (#281 §1.2) — in shell terms, per-context state over the
  encounter spine.
- **Track kinds** — audio and visual/physics tracks are track *adapters*
  on the Timeline projection (L4's World track adapters). The owner's
  framing is correct: with tracks and clips carrying expressions and
  scenes, audio and physics tracks are the simplest thing. The gate is not
  difficulty; it is the role-classification law and honesty: no sounding
  claim before the owner lands it in the shell.
- **Time** — the sample clock is the work-time stratum of the §15 spine:
  coherent sample-time for the active device, explicit mappings to
  transport, physical/control updates, M1 phase, M3 inscription, sky
  occurrence and civil Day/NOW (#281 §2.5 stands as law). Revision 2's
  transport mapping already carries the face of this: sample rate →
  carrier and round-trip.
- **What the shell does not do** — performance input (the six-row Jankó
  projection, polyphonic pointer/keyboard/MIDI through one operation
  path), the full realtime voice architecture, prepared-body versioning,
  composition/routing/export offices, and the vendor recon: these belong
  to #281's nine commissioned packets and their integrator. The shell
  prepares the host they dock into — admission as the QL family's
  instrument faces, track adapters, transport coupling, modulation
  routing, metering surfaces — and claims nothing sounding until the owner
  lands it.

### 18.1 The musical system's place — M1 source, M2 modulation-never-generation, M3 score material, M4 the body

*Folded verbatim from `wayfinder/DLW-PLAN.md` L2455-2573 when that file was retired. Section marks, ledger numbers and line cites inside this block are the source's own, as of the date it states.*

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
