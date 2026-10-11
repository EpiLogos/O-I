> **SUPERSEDED — SUPERSEDED — folded into DLW-PLAN.md (§5 expressions ontology, §6 driving model, §7 Epi-Logos). Read DLW-PLAN.md only.**

# DLW plan — lane p3: the expressions ontology, the driving model, the Epi-Logos mode/lens

Lane `zcode:dlw-ontology-p3`, dispatched by orchestrator `zcode:world-shell-orchestrator`, 2026-10-10.
Standing: **extraction, not authorship.** Every claim below cites its source
(document and section, or code path). Where the sources are silent the text
says so and the gap becomes `OPEN-QUESTION (for the owner)`. The owner's
recorded decisions are quoted verbatim where they rule. This chapter is a
plan input, not an acceptance record: "proposed destinations are distinct
from executed native evidence" (`FUNCTIONAL-CROSSWALK.md` header law).

Chapters:

- **Chapter C — The expressions ontology** (sound + temporality as one ontology)
- **Chapter D — The driving model** (how the user drives the whole system)
- **Chapter E — The Epi-Logos mode/lens** (everything the sources hold)

Companion: [DLW-PLAN-p3-SOURCES.md](DLW-PLAN-p3-SOURCES.md) — the full
source inventory with what each source contributed.

Code paths: `src/…` abbreviates
`/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/…`
(the landed seat, branch `agent/o-i-20261007-1639`); `cradle/src/…`
abbreviates `/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/src/…`.

---

# Chapter C — The expressions ontology (sound and temporality as one ontology)

## C.0 The one-paragraph statement

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

## C.1 The law that makes it one ontology

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

## C.2 The World track adapter pattern — the ontology's one extension point

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

The ontology's proof is the breadth of what already projects through it
— six adapters over four families, one shape:

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

Landed honesty: the two QL adapters and the day/run/conversation adapters
ride the **lane door**; their manifest `projections[]` declarations "are the
families' own move" (registration comments; `LANE-RETURN.md` honesty list).
The atlas epoch jump is the one materialised **family-door** path.

Laws every adapter inherits (from the files themselves):

1. **Nothing is copied** — each adapter projects "over the kernel's ONE
   temporal read (`temporal_events_read` — K1's bounded, cached read;
   nothing is copied into a second store)" (dayTrackAdapter header).
2. **No silent conversion** — units are declared per lane; cross-stratum
   mapping happens only through the declared table (§C.3).
3. **Standing travels verbatim** — "placement never upgrades it"
   (every adapter; §C.6).
4. **Honest absence** — designed empty states name their owner (mode
   grammar `state: 'waiting'`; undated column; disclosed overflow counts).
5. **Takes are transport material, never clocks** (contract line).
6. **Refusal names the law** — a miscast role or a wrong rate throws the
   classification or no-resampling law in the error text.
7. **Lazy import** — "a family's adapter module loads only when projected."
8. **Families never import the registry** — "the Timeline knows no family."

## C.3 The sample clock as the work-time stratum — the seven-row mapping table

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

## C.4 The time spine — the five strata the sample clock binds into

`src/timeline/timeSpine.ts` lands `WORLD-SHELL-DESIGN.md` §15 ("The time
spine — locked at the top, bound from below"; owner's session phrasing:
"time locked at a higher level — consider the cron and chronos level
integration… global time functions, kerykeion, day/now levels etc.").

The five strata, with their landed behaviours:

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
5. **Occasion (§15.5)** — retained time (§C.6's basis/admission split; the
   K8 sky contract's behaviour; §15: "Standing in 1913's sky without lying
   about now is what makes historical exploration honest").

The §8 controls (Now / Occasion / Transport) "are the user-facing face of
strata 2, 5 and 4; chronos and cron are the deeper platform strata." The
closing of §15 binds time back to modulation: "Time as a modulation source
closes the loop with §14: an LFO was always time — this world's LFOs are
transits, day phases, cron cadences and clock phases, addressable from any
family because the strata are locked at the top."

**The two-clock doctrine** (lane-6 SCOPE, quoted in MAP.md Decisions):
"civil time keeps closure law; one work-time core (sample clock included);
one typed bridge." And the #281 packet law: "Transport state never silently
overwrites civil Day or geometric clock state" (`M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md` §9-C).

## C.5 The musical system's place — M1 source, M2 modulation-never-generation, M3 score material, M4 the body

`WORLD-SHELL-DESIGN.md` §18 records the whole settlement; the commissioned
law is QL-MEF #281 (`M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md`). The owner's
decisions, verbatim:

- **D13** (wayfinder §0.2): "**M1 is the oscillator source; M2 pitch
  structures are tuning/modulation targets over that source.** M1's
  Prakāśa/Spanda carrier and M2-1′'s MEF/Vimarśā reading are both
  essential. Vimarśā writes the shared `audio_octet[8]` and
  `nodal_quartet[4]`; this does not make M2 an independent oscillator
  source."
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
owner's later declaration — compile refuses them today."

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

## C.6 Standing — the epistemic chips and the never-upgrade law

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

## C.7 The taken machinery — the performance-recording seed

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

## C.8 Constructing any new track type from the ontology (the builder's recipe)

Everything a builder needs is in the pattern the six landed adapters share.
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

# Chapter D — The driving model

The driving model is the operator's manual: how a person selects, moves,
stands in time, searches, discloses, and returns. Everything below is
extracted from the design's named spine, the landed mode grammar, the
encounter bridge, and the mockups' recorded decisions.

## D.1 The spine: mode × world-context × kernel epoch — the only selection/navigation

`WORLD-SHELL-DESIGN.md` §2: "No second selection or navigation model is
introduced. The shell's de-facto tripartite state machine is the spine, and
the design names it:"

1. **Mode** — the shell's `ShellMode` (`audio | expressions | techne |
   settings`, `src/continuity/workspace.tsx:15`) over the cradle's
   `WorkspaceMode` (`base | factory | expressions | techne | epi-logos |
   settings`, `cradle/src/workspace/mode.ts:23`), "each mode carrying its
   own layout tree (`modeLayouts`), with the standing rule that **a mode
   never closes surfaces**."
2. **World context** — the workspace book's `WorldContext`
   (`world: central | epi-logos`, subject, reading, trail;
   `cradle/src/workspace/store.ts`): "This is the encounter: what is
   selected, of which world, with what reading, and where you have been."
3. **Kernel epoch** — "transport status and `accessEpoch`/`accessReady`
   generation bumping, which retires stale callbacks and gates every read
   on the current connection."

"Every projection instance and every device reads the encounter from this
spine; selection changes propagate as encounter transitions, not as
per-view state." The Atlas independently converged on the same shape — its
five-state machine (World · Focus · Manifestation · Thread · Deep) "maps
directly," and its hash-router law ("every state is linkable and Back
works") "is the model for linkable encounters in the shell."

**The encounter address and the one transition** (landed contract,
`cradle/src/workspace/encounter.ts`): an `EncounterAddress` is
`{arrangement, projection, subject?, aperture, viewAs, occasion?}` where
arrangement ∈ base|factory|expressions|techne|epi-logos|settings,
projection ∈ earth|timeline|constellation|expressions, aperture ∈
world|local|shared|federated, viewAs ∈ me|field|public. `encounter()` is
"the only transition. Any axis may change; **the subject is kept unless
explicitly replaced — switching arrangement or projection never loses what
you were looking at.** The trail grows by one on every transition."

**The encounter bar** (Revision 2): the spine renders as "a bar above the
panes: **Field › World › Subject › Occasion**, plus the mediation of the
current encounter (search · graph traversal · direct · journey · palace ·
contact · return · placed). `encounter()` is the only transition; the
Trail tile keeps every encounter and returns to it."

**The three orthogonal axes** (Revision 2, the owner's framing): "*Arrangement* … × *projection* (Earth · Timeline · Constellation · Expression — per pane) × *device* (the rack). Switching any one keeps the encounter." And the owner's correction integrated at the top of the design: "projections are not a hierarchy; panes are real panes."

## D.2 The transport: one transport, five meanings

Revision 5's law: "**Every mode keeps the same transport slots in the same
places.** Only their meaning changes." Landed as typed data in
`src/shell/modeGrammar.ts` — `TRANSPORT_SLOT_IDS` fixes 29 slots (link, tap,
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
second table: what Session and Arrangement show per mode) and the Clip |
Device detail pair (Revision 4: Base → Document | Devices; Factory → Task
log | Agent chain; Expressions → Scene | Studio; Technē → Clip |
Instruments "the six M0′–M5′").

The **honesty law for waiting controls** is in the grammar:
`waitingNote` per mode — e.g. Live: "The audio engine's transport is
read-only until its owner lands; the field holds its place."

## D.3 The three temporal controls over the five strata

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
  material (sequence clocks family; the M3 clock device exposes
  inscription/lens circles)." Landed chip: "It moves over clips and drives
  nothing else — no shell timer is a clock."

In the world mockup the same three controls appear in Technē as the
Now/Occasion/Walk segment — "which clock drives the panes" (Revision 2
transport mapping: "Now/Occasion/Walk → which clock drives the panes") —
and every mode's transport `position` slot re-means to its own driving
clock (Live "bars . beats . sixteenths"; Base "the day's civil instant";
Expressions "seconds within the working scene"; Technē "the driving clock's
value"; Factory "task . turn . step").

The five strata beneath (chronos · civil · cron · transport · occasion) are
§C.4. The user-facing rule: the controls are the faces of strata 2, 5 and 4;
chronos and cron "are the deeper platform strata" — bound from below by
families, never forked.

## D.4 The Trail — every encounter kept and returned to

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
   `OPEN-QUESTION (for the owner)` — D-9 below.

## D.5 Search and the aperture — World · Local · Shared · Federated

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
message: "Aperture **X** — other Worlds are outside it." The landed
contract carries aperture as a first-class axis of the encounter address
(`encounter.ts`; decodeable from `?ap=N`), and the aperture slot under the
browser is where "the focused pane's context and view controls live"
(Revision 3: "Field · World · Subject · Occasion, the view's own controls
(scale, lens, document view), and the pane layout").

## D.6 View-as and the projection fog

Revision 2: "**View as** (where Live has key/scale): me · field · public.
Your planet fogs everything not projected; the rack's Projection device
shows the disclosure ladder; **raising an audience always asks first**."

Landed mechanics in the mockup: view-as cycles me → field → public; the
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

## D.7 Keyboard and pointer grammar

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

## D.8 The system's response laws

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
   `?arr=techne&scale=surface&subject=stone1950&ap=3&as=field&visit=ariadne&walk=6`).
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

## D.9 The operator's walk (the end-to-end step list)

The whole product, driven from one seat (each step cites its law above):

1. **Arrive** — the shell boots into a mode with its saved pane tree;
   the encounter (subject, reading, trail) survives reload
   (response law 1–2; `WorldContext` persisted).
2. **Select** — the spine's selection: click material in a browser
   category or a pane; selection propagates as an encounter transition;
   every pane/device reads it (D.1).
3. **Orient in time** — the three temporal controls: Now is where you
   stand; select an event to retain an Occasion (its basis is kept,
   admission qualified separately); press ▶ to move the Transport over
   performable clips (D.3).
4. **Search** — the palette (⌘K, typed tabs) and browser categories filter
   the selected category; results answer at the current **aperture**;
   beyond-aperture hits are counted and offered — widen deliberately (D.5).
5. **Disclose** — flip **View as** to see your World as field or public
   sees it; the fog shows exactly what is projected; raising an audience
   asks first (D.6).
6. **Compose the view** — panes split (⇧, drag), each pane holds a
   projection of the same encounter; the focused pane's rack is the bottom
   detail; Clip|Device re-mean per arrangement (D.2, D.8).
7. **Act** — devices apply through the custody aperture (draft retained,
   same-basis write, Apply/Discard/Retry); modulated parameters show their
   modulators; writes land through declared owner operations with receipts
   (aperture law, MAP.md).
8. **Perform (music)** — in Live: play, record takes (record/replace/
   append — the seed machinery), the sample clock driving work-time with
   declared mappings only; in Expressions/Technē the same transport slots
   walk scenes and journeys (C.5, C.7, D.2).
9. **Return** — every hop left a trail stop; back pops the newest and
   restores mode, surface and reading position; the Trail tile keeps every
   encounter (D.4).
10. **Leave** — the mode stands where it stood; surfaces stay; nothing is
    closed by switching (response law 1); the day (civil stratum) is
    closed by its own owner's routine — never by the transport
    (`M-PRIME…WORK-PACKETS.md` §9-C: "Transport state never silently
    overwrites civil Day").

`OPEN-QUESTION (for the owner)` — items the driving model leaves open,
collected:

- **D-9 Trail tile in the new shell**: the design and the cradle trail are
  landed, but "nothing in the live shell reads or writes a trail"
  (EXPRESSIONS-ENCOUNTER-SPINE finding 6). Where does the shell's Trail
  tile live (Revision 2 places it in the right dock: "Context tiles sit
  above: the agent…, Packet, **Trail**, Field, Agents, Terminal, Results,
  Sky, NOWs"), and what is its retention bound?
- **D-10 Multi-select rule**: R1 ("exactly one, otherwise none") vs R2
  ("the first id") split for "the selected object" — "Needs an owner
  ruling" (EXPRESSIONS-ENCOUNTER-SPINE "Proposed owner rulings").
- **D-11 The shell-side host channel and the Tauri realtime gate** (the
  named gaps of §18/`QL_LAUNCH_CONTRACT`) — owned by #281's packets and the
  host-side channel owner; listed here because the driving model's
  performance step depends on them.
- **D-12 Linkable-encounter surface grammar**: the cradle
  `decodeEncounter` uses `?arr&projection&subject&ap&as&occasion`; the
  mockups use `?mode&lens&scale&body&ap` / `?arr&scale&subject&ap&as&visit&walk`.
  One canonical query grammar for the shell is undecided in the sources.

---

# Chapter E — The Epi-Logos mode/lens

**Finding stated first** (and confirming the orchestrator's naming note):
the phrase "Epi-Logos mode" as a *sixth shell mode of the DLW* does not
appear in the planning transcript; what the sources hold is a **workspace
mode value kept defined but refused by the mode switcher**, a **whole-app
world state** (`context.world`), and a **lens** — three distinct registers
that the sources keep deliberately apart. Everything found is below,
verbatim where it rules.

## E.1 The three registers, precisely

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
Entering is one write (`enterEpiWorld` sets `context.world = "epi-logos"`;
`switchWorkspaceMode` also sets it if ever invoked with the mode value);
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

## E.2 The owner's recorded decisions, verbatim

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

## E.3 The records verbatim (the running app's own words)

- Footer toggle (`DesktopShell.tsx:409`): `aria-label="Epi-Logos lens"`;
  title when on: "**The Epi-Logos lens is on — turn it off**"; when off:
  "**Turn on the Epi-Logos lens: the file trees show the corpus**".
- Head chip (`LeftFrame.tsx:130-132`): `aria-label="Epi-Logos lens is on"`,
  visible whenever the lens is on "even with the footer hidden"; its close
  control: `aria-label="Leave the Epi-Logos lens"`.
- The avatar/utility menu (`field/Utility.tsx:79`): item "Epi-Logos",
  description "The Epi-Logos world: the essay, its Expressions and
  practices".
- The lens's effect on agency (`agentBody.ts`): "The Epi world keeps its
  constituted agent while the person moves between [modes]… Merely entering
  Expressions or Technē outside that world does not [reset the agent]" —
  the world's agent persists across `epi-logos | expressions | techne |
  base` while `world === "epi-logos"`.
- Nara's admission: "Nara appears there [the identity menu] while the
  Epi-Logos lens is on" (10-SIDEBARS §4.2 area; §3.1 above).

## E.4 What it shows: the four families and the threshold

The mode's centre surface (`cradle/src/epilogos/EpiLogosSurface.tsx`,
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

## E.5 How it relates to the five modes

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
   question differently — see the OPEN-QUESTION below.
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
"Epi-Logos mode" for the DLW shell's mode rail; no source binds the Epi-Logos
world to a projection of its own; no source describes its transport
re-meaning; and nothing found states whether the world context should
appear in the new shell's `WorldContext` (which today types only
`'central' | 'epi-logos'` — the cradle type) or how the lens maps onto the
new shell's chrome. The commission's suggestion that the five modes might
stand *in* Epi-Logos as ground is supported only by the world-context law
above (register 2), not by any mode-grammar statement.

## E.6 Known vs OPEN-QUESTION

**Known** (all cited above): the three registers and their owners; the
D2/A5 rulings; the corpus re-rooting behaviour and its exact restore; the
four families and their receiving discipline; the threshold surface's
composition; Nara's conditional admission; the constituted agent's
persistence across the world; the drill-through + `oi:epi-return` passage
restoration; the surface kind's existence in the registry.

**OPEN-QUESTION (for the owner):**

- **E-1** — In the DLW shell, is Epi-Logos (a) a sixth surf mode alongside
  live · base · factory · expressions · techne, (b) the world context only
  (the cradle settlement, carried forward), or (c) the lens only? The
  cradle answered "world context + lens, never a sidebar mode" (ruling
  2026-09-18); the new shell's grammar is silent.
- **E-2** — Does the lens itself carry into the new shell (a footer
  toggle + head chip re-rooting the browser on the `epi` corpus), and if so,
  does "context sources narrow to the corpus" map onto the aperture slot?
- **E-3** — Should the Epi-Logos world's four families appear as a family
  manifest (§12's seventh-carving pattern: browser categories, faces,
  projections, time bindings), with the receiving adapters as its declared
  surfaces?
- **E-4** — The essay and Epii families are receiving-only in the cradle:
  what are their producing owners, and when do their live adapters land?
- **E-5** — The commission asked whether Epi-Logos mode is "above" the five
  modes or "the ground they stand in": the sources answer for the *world
  context* (the ground — store.ts law) and for the *lens* (an overlay on
  any mode), but the planning transcript names neither; is the owner's
  intent for the DLW exactly the cradle settlement, or a promoted sixth
  mode?

---

# Collected OPEN-QUESTIONs (for the owner)

From Chapter C:

- **C-1** — Manifest `projections[]` declarations for the landed adapters
  (QL audio/physics, day/run/conversation): the QL and Central family
  owners' move; until declared, the family door refuses them and they ride
  the lane door. Who declares, and when?
- **C-2** — The modulation scope widening (`QL_MODULATION_SCOPE`: today
  quaternal-logic addresses only) — which families' parameter addresses
  become routable targets, by whose declaration?
- **C-3** — The presentation's `groupOfTrackKind` fallback sends unknown
  track kinds to "Central · civil field" — a new family could be silently
  mislabelled. Should the fallback refuse instead?
- **C-4** — Standing vocabulary beyond `'fact'`: the spine carries one
  standing producer today. Which owner sources will supply
  claim/inferred/hypothesis/disputed/ghost, and is `state` the right
  carrier for the full chip set?

From Chapter D: D-9 (Trail tile), D-10 (multi-select rule), D-11 (host
channel + Tauri realtime gate), D-12 (canonical linkable-encounter query
grammar).

From Chapter E: E-1 … E-5.

# What the grill agents should attack

1. **The "one ontology" claim.** Is anything in Chapter C actually a second
   ontology in disguise — e.g. the atlas epoch material's shapes
   (`Occurrence`: subject_ref + place + time + image + basis) vs the track
   shapes? Are there hidden conversions (day-local hours, scene-local
   seconds, family spans) that bypass `QL_CLOCK_MAPPINGS`?
2. **The never-upgrade law under pressure.** The presentation renders
   `state: standing ?? 'fact'` — does any code path *default* material
   into fact that is not a reading of record? Does the label-suffix
   approach (role + standing on the label string) survive i18n,
   accessibility and honest rendering of all six chips?
3. **D13's enforcement.** `generates: false` is a literal on declarations —
   but does anything stop a route whose *target* is an oscillator-audio
   parameter (i.e. modulation that effectively generates)? The declared
   scope (quaternal-logic only) is the current guard; grill the widening
   path (C-2).
4. **The Trail's three registers.** The cradle trail (bounded 24, refs
   only), the encounter bridge trail (unbounded, addresses), and the
   missing shell trail — do they compose without a second selection store
   (the design's own not-do law)? What happens to trail positions when a
   surface is closed or a mode tree is reset?
5. **One transport, five meanings.** 29 slots × 5 modes = 145 meanings —
   are all 145 present in `MODE_GRAMMAR` (the module throws on a missing
   slot, so a test exists)? Do any two modes give one slot contradictory
   *physical* controls (e.g. `loop` as close-routine vs occasion window)
   that would confuse muscle memory? Is that wanted?
6. **Aperture/View-as as contract vs mockup.** The aperture predicate and
   view-as thresholds live only in the mockup today (`worldAdmitted`,
   `visibleAs`); the encounter contract carries the enums but no
   admission law. Where does the admission law land in the shell, and who
   owns "raising an audience always asks first"?
7. **Chapter E's mode/context/lens triad.** Grill whether register 1 (the
   refused WorkspaceMode) is dead code to retire or a live seam the owner
   intends to promote (E-1); and whether the four families' receiving-only
   adapters mislead (they render a threshold that *looks* like content).
8. **Extraction fidelity.** Any claim in these chapters without a citation,
   or any quotation that does not match its source, is a finding — the
   prime directive is extraction, not authorship.
