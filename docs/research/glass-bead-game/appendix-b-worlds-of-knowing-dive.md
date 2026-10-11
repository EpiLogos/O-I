# Appendix B — The worlds of knowing: deep functional dive (Technē, Central, Factory, shared field)

**Provenance.** Research lane executed 2026-10-10 by a dedicated agent over
Archetypal-Earth, the Technē instrument code, Central's document forms and
contracts, Factory's designed surfaces, and the shared-field infrastructure.
Kept verbatim-in-substance as the functional inventory behind
[06-THE-PRAXIS.md](06-THE-PRAXIS.md). Status marks: **LANDED** (in code
today), **CHECKPOINTED** (mockup/owner-accepted design intent),
**PLANNED** (named packet, not started).

---

## 1. The knower's session in Technē — M0′ through M5′

### 1.1 The dual reading and the one-field law

Technē is not an app; it is a *reading* of one field of material. The
governing amendment (`docs/experience/TECHNE-DUAL-READING.md`, owner-ratified
2026-09-16) binds two readings over the same selected world/subject/source
field: **3:3 Expression** (living/material/experiential) and **4:2 Technē**
(deep/professional/research-authoring), arranged as six deep instruments:

| Instrument | Pairing | Office | Code today | Status |
|---|---|---|---|---|
| M0′ | Project · Wiki · Graph | the source-backed ground | `desktop/cradle/src/techne/instruments.ts` + `m0m5/project/` + `src/techne/wikiReading.ts` | LANDED (instrument rail + ground model) |
| M1′ | Canvas · Constellation | the composed surface | `m0m5/canvas/` + `src/knowledge/construction.ts` | LANDED |
| M2′ | Relation Field · Timeline | the relation field in time | `m0m5/timeline/` + `src/techne/temporalFacets.ts` | LANDED |
| M3′ | Journey · Expression Scenes | the traversal of scenes | `m0m5/journey/` (compose, beats, sequence, crossing, presence) | LANDED |
| M4′ | Places / World | the world's places | `m0m5/place/` | LANDED (model); planet-building UX CHECKPOINTED |
| M5′ | Palace · Integral whole | the integral whole | `m0m5/palace/` | LANDED (model) |

The rail is deliberately "static vocabulary; what each tab STANDS ON at
runtime is the selected subject's disclosed TechneReading (`techneReading.ts`)
— availability with stated reasons, never a hard-coded six." Expressions is
the conjugate 3:3 body, never a seventh tab. The **one-field identity law**:
a person changes *reading* without silently changing *what they are working
on* — subject_ref, whole/member/relation refs, native owner, source
revision, constellation identity, occasion ref, AgentSession, provenance all
preserved; a surface with no valid facet reports unavailability instead of
fabricating metadata. TD1–TD8 are the ratified proving programme.

### 1.2 What each M′ actually does

- **M0′** opens on the existing World: locate a subject through AIKit
  Search/Wiki/ProjectMap, move through LIST/TREE/GRAPH projections with one
  stable native ref (TD1). The Wiki reader/graph/filters/search live in
  `desktop/cradle/src/knowledge/`. The wiki is also a native Expression
  projection (`wikiNativeExpression.ts`). Constellations persist through the
  native owner (`construction.ts` — `aikit.constellation/v1`, saved
  constructions with revisions); the constellation spec's behavioural
  contract (backlinks as "the inverse reading of recorded source
  occurrences", ghost nodes for unresolved links, saved views restoring
  deliberate depth) is `docs/cradle/WIKI-CONSTELLATION-SPEC.md`.
- **M1′** takes the same subject into Canvas: "drag is presentation, frames
  are presentation, a drawn relation is a proposal until promoted through
  the relation owner's Action." The canvas `proposal.ts` and
  `journey/compose.ts` carry selections *verbatim* as routed proposals —
  "nothing is minted locally except the proposed scene ref."
- **M2′** reads typed relations in time while preserving "chronology,
  cause/influence/echo/instantiation and evidence standing. Archetypal or
  cultural relation does not become a fake historical date" (TD3).
  `m0m5/place/world.ts` enforces the same honesty spatially:
  OCCURRED_AT / LOCATED_IN / OPERATED_IN / TRAVELLED_TO / MYTH_LOCATED_AT
  "preserved verbatim and never interchangeable"; "an unlocated place is a
  honest state with its identity, never a defect to fill." The wider
  reference-frame depth (M1 harmonic → M2 planetary → M3 world-clock → M4
  EarthBody/Nara) is *consumed from producers, never recomputed in the
  renderer*, with unavailable producer depth reported with its reason.
- **M3′** composes a Journey from real refs and persists it through real
  Expression Scene identity (TD4: no Journey shadow scene store);
  `crossing.ts` mediates the 4:2 ↔ 3:3 cut.
- **M5′** composes several real subjects into a Palace whole and *Returns*:
  "the Return routes a NATIVE owner Action (e.g. `aikit.wiki.stage`); the
  adapter routes, the owner executes under its own authority — the Palace
  never mutates native state… a proposal the owner refuses routes to an
  explicit unrouted receipt and mutates NOTHING" (`m0m5/palace/return.ts`).
- **Agency (TD7):** Anima_i (3:3) and Aletheia_i/Technē_i (4:2) operate
  through ordinary Actuation + AIKit + O:I session infrastructure; "do not
  create twelve bespoke runtime Agents merely because twelve operative
  profiles are conceptually distinguishable."

## 2. Archetypal-Earth as the canonical form

`Work/Archetypal-Earth` is the owner's own deployed repo — "a globe for
moving through Jung's archetypes as they recur across place and time."
WORLD-SHELL-DESIGN §3.1 calls it "a found, owned implementation — the Earth
projection's seed, not a missing input."

### 2.1 What a user does in it (LANDED unless noted)

| Capability | Where |
|---|---|
| Land on the globe with one line and "Start at the Self"; the action flies the camera to the Self's node | `src/shell/landing.ts`, MODES-RFC §6 |
| Pan/zoom/rotate the three.js earth; NASA Blue Marble + GIBS quadtree tile streaming; one dark shader | `src/globe/{earth,tiles,tilemath,controls}.ts` |
| Occurrences as instanced glowing presences + a density texture the earth samples (regions of archetypal intensity glow) | `src/globe/presences.ts` |
| Scrub non-linear time: ancient spans compressed, 0–1960 expanded; nodes emerge with a ring, dissolve to a warm dot, pinpricks before their date — identical constants in TypeScript and GLSL | `src/data/time.ts` |
| Switch Earth ⇄ Graph (**G**): the same field as a calm d3-force constellation; neighbourhood BFS; outside the lens "the field recedes to a whisper that is still clickable"; liveness re-heat; idle-when-clean rendering | `src/graph/{view,build,forces}.ts` |
| Drill World → Focus → Manifestation → Thread → Deep; crumbs preserve the route; Back climbs it | `src/state/store.ts` |
| Every state linkable; Back works | `src/state/router.ts` (`#/a/self?w=cw12&k=dream`) |
| Filter slices by work/culture/era/kind — a filter, never a lens; excluded presences culled in-shader and unpickable | `src/shell/filter.ts` |
| Open an archetype and its families; follow a thread as a living path across the globe; inspect a presence without discarding the thread | `store.ts` (`trail`, `openedFrom`) |
| Read verbatim corpus quotations with cites — "cw12 ¶452 (pdf p350)" opens the actual passage at its source; generators place each quote and write the locator from the corpus's own markers; `npm run <lens>:check` re-verifies | `scripts/lib/cite.mjs` |
| Zoom out past the Moon into the sky: Sun, Moon and planets where they really are (JPL DE440 2015–2039), each linked to what Jung wrote of it; Aion's equinox ring | `src/sky/*`, `docs/SKY-SPEC.md` |

### 2.2 The lenses and what each DOES

`LensDef = { id, label, icon, group: 'read'|'practice', blurb, key }`; panel
lenses load by dynamic import on first open; a lens receives a
`LensContext` and "never touches another lens" (`src/shell/lens.ts`). All
eight are LANDED:

| Lens | Key | What the user does |
|---|---|---|
| Field | F | The globe and the graph: archetype → family → occurrence, focus, threads. Home. |
| Theory | T | How psychic energy moves (libido, compensation, enantiodromia, transcendent function); number-as-archetype with QL positions beside corpus quotations; the dynamical lens (14 Van Eenwyk concept cards paired with Jung passages). |
| Aion | A | Three historical readings on the same globe: Jung's *Aion* (Pisces arc, 45 events), *The Turn* (1914→1958 in five phases), *The Aquarius Horizon* (every dated forecast 1929→1958). J/S labels for Jung-claim vs scholarship; approximations labelled. |
| Red Book | R | Walks Liber Novus in folio order, every stop `subject: Jung`; facsimile plates load only from the local vault; the genesis view links each symbol-episode forward to the archetype it became. |
| Astrology | (practice) | Cast your birth chart in-page (astronomy-engine, MIT); the sky draws it from the Earth in Jung's keys; **walk planet by planet to the Sun and the Self**. Jung's own chart ships with its time uncertainty stated. |
| Dreams | (practice) | A private journal; each dream's text is matched against the field's own names for image families — "Jung's method as a function" (`src/practice/amplify.ts`): the family laid out as Jung laid images out — definition in his words, dated instances, dream/vision parallels, archetypes with tie basis. |
| Symbols | (practice) | One symbol through its history: word → family → dated instances → doctrine. |
| Coincidences | (practice) | A private synchronicity log drawn as your own series beside Jung on seriality. |
| (+) Deep field | `#/symbols/archetype/great-mother` | The Great Mother at maximum depth: 14 placed quotations, image-vs-archetype distinction, Neumann's structure and stages, **all 722 of Neumann's instances**, 49 image families, 654 field instances, 139 dreams/visions. One deep field exists; the pattern is general (`curation/depth/<id>.json`). |

### 2.3 The laws it proves

- **Lenses as plugins** loading on first use, code-split (entry chunk 766
  kB, graph+d3 101 kB fetched on first use) — measured.
- **Verbatim quotes with cites, machine-verified** — "A quotation that
  cannot be placed even so fails the build."
- **Every state linkable** — the router is named by WORLD-SHELL-DESIGN §2 as
  "the model for linkable encounters in the shell."
- **Personal data local** — `src/practice/store.ts` is the only code that
  reads or writes personal data (`aae.practice.v1.*`), with a
  `PracticeBackend` interface so "a later shared layer would be a second
  backend behind the same interface"; "no route ever carries a birth."
- **Honesty labels everywhere** — geoPrecision (`place|region|culture|none`),
  TieBasis (`jung|inferred|site`), approximate charts labelled, ephemeris
  bounds refused loudly.

### 2.4 What carries into the shell vs stays corpus

WORLD-SHELL-DESIGN §3.1 draws the line: **infrastructure** (adoption):
globe engine + tile streaming, camera rig (inertial north-up orbit,
great-circle flights), graph engine (d3-force constellation, BFS
neighbourhood, liveness dimming, tie-basis edge styles), non-linear time
scale, image pipeline. **Corpus** (stays): the Jung vault (2,778 files), the
curation set, ingest scripts. `src/types/field.ts` is "the single seam
between the two"; the generalised occurrence contract is
`{subject_ref, place+precision, time+display, image, basis}`.

## 3. Central — creating, exploring, sharing

### 3.1 Exploring — the field UX (UX1–UX10)

The essay site's interaction is transferred into native Base with
per-interaction acceptance: one locus coordinates page position, contents,
graph, explorer and address (UX1); main page vs tangent preview with
keep/replace/promote/return, dirty previews never discarded (UX2); click
selects, double-click opens, drag moves (UX3); graph and connections share
one neighbourhood (UX4); breadcrumb ancestry (UX5); fast search then deeper
full-text (UX6); Expressions indicated everywhere with a contextual Library
(UX7); emphasis modes (UX8); actual typography (UX9); explicit shared-state
actions with native refs, not DOM ordinals (UX10). The contract underneath
(`docs/cradle/CENTRAL-FIELD-CONTRACT.md`): the field is a hosted surface
contribution `oi.surface/field`; one pure `FieldEncounter` reducer
`fieldApply(state, op)` that *both human and agent call* ("No DOM or
screenshot dependence"); ops `select / open-main / open-preview / keep /
promote / back / set-emphasis / enter-constellation`; the active encounter
is a context contribution to the agent's prepared turn, stamped with the
generation it was prepared against. `CENTRAL-FIELD-UX-TRANSFER.md` records
walk scenarios FE/GE/RE/CO/CT with per-check labels, keyboard KB 22/22, unit
tests UT 52/52, typography TY 52/52.

### 3.2 Creating — the document forms

| Form | What the user does | Status |
|---|---|---|
| **Day die** `ql-daily-die.html` (4+2) | A situated six-office whole: positions `p0_quick_thoughts … p5_teleological_aim`, collections `capture, sessions, completed, media, notes, packet, contributions`; ‹ › turns the die face in the rev-5 transport mapping | LANDED (form; hosting via `DayFormSession`; sandbox messages "stage, never authorise") |
| **Flow** `ql-flow.html` | Dialogue · Flow · Journal with **declared participants** (`meta.participants`: initial, name, kind person\|agent, session ref; "the person set solid, an agent dissolving into points"); reply anchors, private notes/packets/media; `__OI_DOCUMENT_PAYLOAD_READ__` gives the host a read-only observation, no write route | LANDED (v0.2/v0.3; live surface `src/flow/`) |
| **Beings** `oi-beings.html` | "A presence and its world": masthead, mark, page Expression slot, sections, relations rail; bindings `{worldRef, subjectRef, categories:["C2"], expressionRef, sources}`; C-grammar (C0 source → C1 Form/C2 Entity/C3 Process/C4 Type → C5 presented expression); portable export ("Save HTML copy… this is not filtered publication") | LANDED (form); named obligations (edited-preview Save, safe filtered publication) explicit |
| **Things** `oi-things.html` | Same carrier for a topic/work/project/collection; creator/maintainer/publisher/collaborator relations stay distinct | LANDED (form) / publication PLANNED |

The Base browser's left list — **Days, Flows, Beings, Things, Goals; Files,
Wiki; New (exactly Day · Flow · Beings · Things)** — is the rev-3
arrangement (CHECKPOINTED); its constituents are the landed surfaces above.

### 3.3 The packet, Answer, highlight/note

- **Highlight → context** is a landed seam: `src/context/hostSelection.ts`
  reads DOM text selection as "an observation, never an offset into the
  backing HTML", retains ranges with `nodeRef/sourceRef/revision` selectors,
  draws them via the CSS Custom Highlight API, raises
  `oi:context-candidate` (⌘⇧2); ContextTray, PreparedContextView,
  SituationView, selection resolution in `src/context/`.
- The toolbelt naming *Highlight · Note · To packet · Answer this*, "the
  packet shown as exactly what the agent receives" — Rev 3 framing
  (CHECKPOINTED) over landed mechanics.
- **The packet as transport**: `src/encounter/session.ts` carries
  `AddressedPacket` through `send-group` with explicit recipients and
  receipts — LANDED; packet collections ride inside the ql-doc payloads.
- **Answer** (Base's transport ▶: "**Answer** (send the packet)") —
  CHECKPOINTED.
- **The situated companion** Conversation · Activity · Context · Inspect —
  constituents exist; arrangement slotting CHECKPOINTED.

### 3.4 The wiki and sharing

The wiki is never edited directly; knowledge travels as returns. In the
desktop the wiki is a native Expression projection plus constellations
(LANDED). **Sharing is projection, never copy**:
`shared-field/WORLD-PUBLICATION.md` — a deliberate `oi.central-wiki-selection/v1`
(owner names spaces/nodes/audience, read through Central's own
`central.wiki.read` Actions) → `oi.world-presentation/v1` → `oi.projection/v1`
→ hosted edition + SpaceTimeDB puts; sentinel tests prove private
`Central/Control` never enters a Projection — LANDED.
`WORLD-PRESENTATION.md` adds direct page authoring (READ→AUTHOR→PREVIEW→
ratified next revision; "working state is not public state";
"presentation refinement ≠ source-return proposal ≠ accepted native source
mutation") — LANDED contract.

## 4. Factory — the development praxis

**Landed today:** Factory surfaces in `desktop/cradle/src/contributions/factory/`
(FactoryCentre, FactoryDevelopmentSurface, desk/, FactoryLive.tsx,
FactoryHandoffSurface.tsx, FactoryAttemptHandoffDocument.tsx,
factory-review-snapshot.ts, FactoryNavigator), reading real owner data
(journeys with `commission.purpose`, the run map, workflow inspection,
attempts/legs, telemetry with Git basis, conversation journals).

**The designed praxis** (`docs/cradle/11-FACTORY.md`, owner-accepted
2026-09-23 — CHECKPOINTED with build order §10):

- **Commission**: a run's human sentence is the journey's `commission.purpose`;
  card titles are purposes, "never a `run:` ref."
- **Watch**: the Desk board (NEEDS YOU / ACTIVE / QUEUED / RECENT, unit
  segments shaded by leg standing, "never a percentage"); the Run page with
  **Map** (one lane per work unit, forks, convergence joins, gate bars,
  frontier outlined), **Trajectory** (the journal: Input/Model/Tools lane
  strip; CONTEXT/USER/ASSISTANT/THINK/TOOL rows with call+result joined by
  id; footer stats only where the harness supplies them — honesty F9/F10),
  **Live** (who is carrying it now, workcell and Git basis), **Handoff**
  (outcome, diff labelled committed/staged/working, verification with
  staleness, observations, remaining work, copyable continuation prompts,
  provenance).
- **Steer**: Tasks is the conversation; the composer is model-first with
  permission modes; conversations join runs via executions/attempts (no
  invented ancestry).
- **Custody**: the hold/hand-back light ("you edited HeroShot physics while
  Honey held it") is a device-level reading of the existing custody law; the
  underlying write-custody aperture (same-basis single-flight writes,
  retained drafts, Apply/Discard/Retry) is LANDED.
- **The agent chain device** `gateway → agent → skills → world → git` as the
  Factory detail row — CHECKPOINTED.
- **Results returning to world**: runs as Timeline tracks, agent→task→
  sources→files→results as Constellation nodes, situated work as Earth
  placements, a run's result acquiring Expression form — PLANNED ("the joins
  to build are encounter-side"), with the recorded `FactoryLive.tsx`
  producer-consumer fault named as the thing to repair. The **Factory
  vertical** (§17.1) is the designated first proof.

## 5. The shared field — each user as a world

### 5.1 What the infrastructure does today (LANDED)

- **Projections**: `oi.participant/v1`, `oi.projection/v1` (versioned
  envelope, withdrawal as new revision), `oi.projection-receipt/v1`
  ("explicitly grants no source mutation authority"),
  `oi.sparse-representation/v1`.
- **Shared-agency**: `oi.shared-field/v1` (recursively nestable),
  `oi.contribution/v1` ("an attributable difference returned by a
  Participant"; deliberately subsumes comment/reply/rating/metric as modes),
  `oi.encounter/v1` (an objective record of what a Participant was
  *presented with* — no belief asserted).
- **Contact law**: "discoverable ≠ contactable ≠ contacted ≠ reciprocal ≠
  trusted" (`contact.mjs`); Watch as separate private interest,
  caller-filtered views.
- **Hosted SpaceTimeDB authority floor**: first-creator ownership, role
  grants (observer/contact/contributor) with separate `contactable`,
  fail-closed expiry, publisher-bound immutable revisions, audience-filtered
  server-side visibility, adversarial live acceptance — with phase receipts.
- **A2A**: two-world live acceptance — "two independently grounded worlds
  meet, contribute, return, re-project."
- **FieldNow/FieldDay**: `oi.field-now/v1` (projected Workcell root/child
  NOW refs, presence/activity/contribution cursors, compare-and-swap
  revisions; "Central keeps the NOW; the hosted row is a projection of it").
- **Explore**: search-leaf → bounded local whole with provenance retained
  ("Rendering [relations] together does not transfer relation ownership").

### 5.2 How the game is played and displayed (CHECKPOINTED over landed underpinnings)

WORLD-SHELL-DESIGN Revisions 2–3 draw the shared field as UX over exactly
these contracts (its own honesty note: "The data is a fixture shaped like
the native contracts… Nothing here claims an owner that does not exist
yet"):

- **Five scales of the M4′ body**: *Field* (Worlds as planets around the
  SharedField hub; contributions travel as particles), *Orbit* (the homepage
  — your planet with agents, NOWs, recent Expressions, encounters, watched
  relations and project-world moons in near orbit), *Surface* (artefacts
  placed round the globe; **Stone Bay anchors to Bollingen**; walks drawn as
  routes), *Place* (precision ring, relation type per artefact, scale bar),
  *Palace* (M5′ entered as a location).
- **Body relations**: anchor · participate · contribution (with its flow) ·
  watch · projection · federate · A2A while a contact is open.
- **Planet building first-class in M4′**: Body/Landmass/Climate/Sky/
  Locations/Relations controls; "Earth's landmass controls are disabled
  ('Earth is given'); another World's body is read-only."
- **Visiting**: "Visiting another World lands on its *projection*: tinted,
  fogged, only what it projected, its agent reachable (A2A contact →
  returned difference → admit as a claim attributed to its source)." The
  attribution law is the Contribution/Receipt contracts — LANDED; the visit
  UX — CHECKPOINTED.
- **Skill displayed**: Journey walks (stops = place · occasion · artefact ·
  Expression · narration · transition; ▶ walks it, ● records a walk from
  your encounters); epistemic-standing clips on the Timeline ("fact · claim
  · inferred · hypothesis · disputed · ghost, **never upgraded by
  placement**"); Palace rooms composing native refs with "a private room
  that fogs for every audience"; apertures World·Local·Shared·Federated with
  beyond-aperture counts ("＋ 2 more beyond the aperture — widen"); **view-as
  me·field·public** with the disclosure ladder — "your planet fogs
  everything not projected; the rack's Projection device shows the
  disclosure ladder; raising an audience always asks first."
- **Presence**: metronome → "FieldNow presence pulse"; Link/Tap → "field
  carrier / back to Now"; the Technē transport column reads walk · stop ·
  record walk · extend.

## 6. A session in the world of knowing

*LANDED steps marked †; CHECKPOINTED/PLANNED in brackets.*

She opens on the Earth† — dark, one line, one action† — and takes it: the
camera flies to the Self's node† and the field is simply there, presences
glowing where Jung's archetypes touched the world†. She presses **M**: two
groups, ways of reading and ways of bringing her own material†. She filters
to dreams and Gnostic cultures† — the field dims to a whisper of what
remains†, the excluded unpickable in the shader† — and the filter rides the
link† when she copies it.

She opens a serpent presence and starts a thread†: the globe travels the
serpent's path from late-antiquity alchemy to a Zürich patient's dream, each
stop a verbatim quotation with its cite — *cw12 ¶452 (pdf p350)*† — and the
passage opens with the whole page behind it†. Scrubbing the clock†,
presences emerge with a ring and dissolve to warm dots†. She switches to the
Graph†: a calm constellation, neighbourhood lit, the rest receded-but-
clickable†, tie-basis visible in the edge styles†.

Now her own material. In Dreams she types last night's dream†; the
amplification engine† matches its images against the field's own names —
nothing typed by curators† — and lays the serpent family out as Jung would:
definition, dated instances, the dreams among them as parallels†. It stays
in this browser†; the page says so, and offers export and delete-all†. In
Astrology she casts her chart in-page† and the sky pulls back past the
Moon†: the planets stand where they really are†, and she walks her Mars
planet by planet toward the Sun and the Self†, each step read through the
corpus†. In Aion she opens the Pisces arc†; the equinox ring shows where
spring actually lies†, approximations labelled†.

[In the full shell this same evening continues through Technē's six
instruments — CHECKPOINTED arrangement, landed models beneath.] From the
Base ground† she has been reading in the field surface†, a tangent held in
preview without losing her main inquiry†. She selects three passages and
gathers a constellation† — the gathering is presentation; a drawn relation
stays a proposal until the relation owner's Action promotes it†. Technē
opens the instrument bar: M1′ Canvas composes the selection†; M2′ Relation
Field shows her datable sources beside an archetypal echo, the two never
conflated into a fake date†; M3′ composes the Journey as a routed proposal
carrying the refs verbatim†, and its scenes are real Expression scenes† —
▶ walks it, ● records the walk [CHECKPOINTED transport]. M4′ shows the
places with their relation types preserved verbatim† and her planet among
others [planet-building CHECKPOINTED]; M5′ composes the Palace†, and the
Return routes a native owner action — the owner accepts, and the ground
re-opens on the same selection†, the refused path provable and harmless†.

The agent has been with her throughout: her highlights became context
candidates†, the packet exactly what the companion received [framing
CHECKPOINTED], and **Answer** sends it [CHECKPOINTED]. In Factory she
commissions the repair her reading suggested: the Desk shows the purpose,
not a ref [designed]; the Map lays the work-unit lanes with their gate†
(reading real run data), Trajectory replays the agent's turns†, Handoff
returns the diff and the checks that tested it†. [The result then re-enters
her world as a Timeline clip, a constellation node, an Earth placement where
it was situated — PLANNED, the Factory vertical.]

Finally she visits. Another world hangs in the field as a planet† (the
relation floor beneath is landed: SharedField, Contribution, Encounter,
A2A, FieldNow†). She crosses the aperture and lands on its projection —
tinted, fogged, only what its owner projected [CHECKPOINTED] — and its
agent is reachable: a contact opens†, a difference is returned†, and she
admits it as a claim attributed to its source†, never as her own knowing.
On her own orbit† her placed artefacts anchor to real places — Stone Bay to
Bollingen [CHECKPOINTED] — her NOWs pulse in the FieldNow†, and her day,
which opened at 08:30 and must close at 21:00† (the civil law in the Central
ground), is waiting to be closed: what was learned returns to the wiki as a
proposal†, never a direct edit†. The day closes†; the field remains.
