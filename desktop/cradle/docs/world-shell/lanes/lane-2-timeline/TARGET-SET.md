# Lane 2 TARGET-SET — M2′ Relation/Timeline, genuine functionality parity

Campaign: 2026-10-07-techne-instrument-re · lane 2. The owner deliverable.
Targets name **craft-quality bars** (expression-audit law), never compliance
checklists: each entry says what a person can now *do or see*, the reference
behavior it attains, the seam in the cradle where it lands, the
UI-harmonisation note, and the verifiable acceptance shape.

Standing laws every target inherits (TECHNE-DUAL-READING §3, TD3; PROGRAMME.md
phases 4–5): subject identity is never re-minted across readings; a surface
with no temporal facet reports that fact and fabricates nothing; no second
timeline truth, no second store; native Actions are the only writes.

Evidence bases (RE-TARGETS.md): **TimelineJS3** @ `12a8019`, **vis-timeline**
@ `67b24bb`, **PeriodO** @ `51fe03a`, **Aeon Timeline 2 manual** (sha256
`02962fa4…`), **Histography / Chronas** captures 2026-10-07.

---

## A. The time model (the honest core)

### T1 — One time model across both halves of M2′
**What.** The chronology (vendored lens) and the relation field (cradle pure
modules) read one time model: epoch-ms instants carrying the full
precision ladder (millennium→subsecond) and each instant's own UTC offset.
The bridge stops coarsening hour/minute/second/subsecond to "day"
(FINDINGS G1).
**Reference.** vis-timeline runs a single Date-backed axis from milliseconds
to year×1000 (`TimeStep.js:404-470`); the cradle's `scale.ts` already owns
the wider honest ladder — the target is that the mounted instrument uses it.
**Seam.** `vendor/research-canvas/packages/desktop-api/src/techneBundle.ts`
(mapping table l.32-40) + `techneTransport.ts` + `canvas/src/timeline/
instant.ts` — the substrate item model gains a precision-carrying anchor
instead of a year float; `src/techne/m0m5/timeline/scale.ts` stays the
authority.
**UI-harmonisation.** No visual change by itself; sub-day facts become
placeable exactly where the relation field's activity lanes already show
them.
**Acceptance.** A reading with a `second`-precision facet renders at
sub-second zoom on the chronology with its true extent
(`scale.ts:100-108` widening), and `node --test` on the bridge proves
facet precision survives round-trip verbatim (no "day" substitution);
the existing precision honesty tests keep passing.

### T2 — Precision-honest placement and display
**What.** A low-precision fact renders as its honest band, never a point:
millennium → thousand-year band, day → its day (cradle `scale.ts` law),
plus Aeon's documented positioning defaults for display text (unspecified
month → beginning of year, etc.) and **inclusive end dates** rendered
`… – 2016` / `24:00:00` style (T4 merged here as the display convention).
**Reference.** Aeon manual pp. 39-41 ("Event Precision", "How imprecise
events are displayed", end-date inclusivity with `24:00:00`); cradle
`scale.ts:5-11, 100-131` already computes the bands — today nothing draws
them (G2).
**Seam.** `canvas/src/timeline/projection.ts` (`TimelineItem.precision`
already carried at l.15 — dead data), `TimelineNode.tsx` (band rendering),
`ticks.ts` (labels honour precision).
**UI-harmonisation.** Bands use the card's own family styling with a
distinct band fill; no new chrome; label text states precision verbatim
("12th c.", "1963").
**Acceptance.** Fixture reading with one millennium-, one year-, one
day-precision facet: screenshot shows three bands of visibly different
widths each labelled at its precision; band math verified by a pure
function test (band fromMs/toMs equal `expandInstant` output).

### T3 — Uncertainty presentation (circa, disputed, mythic)
**What.** `uncertainty` strings and standing become *visible temporality*:
a fact with `uncertainty: "circa"` or disputed standing renders a hatched/
soft-edged band or badge with the verbatim string on hover; standing
classes come from the existing grammar, never invented per-view.
**Reference.** PeriodO's twin law — the source's textual bound is
authoritative, the structured range only orders and visualises
(`data-model.md:46-62`); `standing.ts:15-25` never upgrades.
**Seam.** Reading already carries it (`contract.ts:220` facet
`uncertainty`; relations carry `standing` → properties at
`researchInstrumentsData.ts:168-173`); seams are `TimelineNode.tsx`
(badge/band), `TimelineRelationshipLayer.tsx` (edge class from standing),
`relationFieldView.tsx` (already renders standing chips — the chronology
catches up to it).
**UI-harmonisation.** One visual vocabulary across both M2′ projections:
the six standing classes and their colours are shared constants, not two
dialects.
**Acceptance.** Fixture with sourced / disputed / mythic / uncertain
facts: each renders its class (screenshot); the tooltip carries the
verbatim standing string; a pure test pins class selection to
`standingOf()` output (no second mapping).

### T4 — Deep time without fabrication
**What.** The axis extends beyond JS-Date range for old material
(palaeography, cosmology): year-number positioning (BigYear-style integers)
below −99999 and above +275759, with its own tick ladder (age 10⁶ y,
epoch 10⁷, era 10⁸, eon 10⁹).
**Reference.** TimelineJS3 `TLDate.js:459-489` (`BIG_DATE_SCALES`,
`HUMAN_SCALE_MIN_YEAR`) — one dataset spans human + cosmological time.
**Seam.** `canvas/src/timeline/instant.ts` (a bigint/integer year path
beside the Date path), `scale.ts`/`ticks.ts` (ladder extension), reading
side accepts wide `xsd:gYear`-style years (PeriodO l.58: "any number of
digits"; year 0000 = 1 BCE convention noted).
**UI-harmonisation.** Tier names surface in the existing tier readout
(`TimelineLens.tsx:598`) — "eon", "age" are tier labels, no new panels.
**Acceptance.** A fixture with −780000 and +4.5e9-year facts positions and
ticks correctly (pure test on the year path); human-scale fixtures
unchanged (regression: existing tick tests pass).

### T5 — Relative time for undated work (no fake dates)
**What.** A subject's undated but *ordered* material (phases, sessions,
archetypal sequences) can be read on a relative axis — Day 0 / Week 0 /
T+offset from a disclosed zero ref — instead of being excluded or
fabricated into calendar time.
**Reference.** Aeon manual pp. 41-42 (Regular / Weekly / Daily / Time
styles with a configurable zero date); dual-reading TD3: "archetypal or
cultural relation does not become a fake historical date".
**Seam.** `src/techne/m0m5/timeline/scale.ts` (a relative projection
beside the calendar one), `session.ts` (`DisclosureSession` gains the
zero-ref as part of the maintained time window, see S3); the relation
field's phase/activity modes consume it first.
**UI-harmonisation.** The projection switch is the existing Chronology /
Relations row; relative mode appears only when a reading discloses a
warranted zero ref, otherwise honestly absent.
**Acceptance.** Undated facets ordered by sequence render on a relative
axis labelled "Day 0…"; no calendar year appears anywhere in the view;
switching back restores the calendar axis byte-identically.

### T6 — The shared time-axis contract for lane 4 (M4′ World/Places)
**What.** One wire shape both M2′ and M4′ consume — dated events with
uncertainty and provenance on a shared time axis, plus period bands and
the session's time window. Not a new store: a published projection of the
reading the instruments already share.
**Reference.** Chronas: one year cursor drives the map's polity layer
(capture 2026-10-07); `ql.techne/v1` already carries every field needed.
**Shape (all existing contract fields, published as the seam):**
```
techne:time-axis/v1 (projection of a TechneReading — no new truth)
  subject_ref, reading_ref, snapshot_revision   (identity, verbatim)
  events[]: { facet_ref | derived_ref, kind,                 (contract.ts:205-222)
              instant | interval{from,to,precisions}, precision,
              uncertainty?, source_ref?, provenance_selector? (temporalFacets.ts:88) }
  relations[]: { relation_ref|derived, relation, from_ref, to_ref,
                 temporal_facet_ref?, standing?, source_ref? }   (contract.ts:145-158)
  bands[]:   { band_ref, label_verbatim, earliest, latest,       (PeriodO shape, T8)
               source_ref?, note?, editorial_note? }
  window:    { from, to } | null                                  (contract.ts:443)
```
**Seam.** Produced beside `relationFieldState` in
`src/techne/m0m5/timeline/` (pure, node-tested); consumed by the
chronology mount (`researchInstruments.tsx:606-636`) and exposed to the
M4′ surface through the hosted app's existing reading channel
(`host.read`, `TechneCentre.tsx:86`) — lane 4 records this interface
point; lane 2 owns the shape.
**UI-harmonisation.** Both instruments display the same window and the
same event extent; a cursor change in either is a session-window change
(S3), not a local secret.
**Acceptance.** Contract test: the projection validates against
`validateReading` inputs byte-deterministically (same reading → identical
projection, the techneBundle purity law); an integration fixture moves the
window and both projections agree on which events are in scope.

---

## B. Historiography structure

### T7 — Two-row calendar axis (minor/major labels)
**What.** The axis shows a major label row (year) over a minor row
(month/day/time) that adapts with zoom, with per-scale label formats.
**Reference.** vis-timeline `TimeStep.js` (minor/major `FORMAT` l.909+,
auto-scale ladder, custom format functions l.741-781).
**Seam.** `canvas/src/timeline/TimelineAxis.tsx` + `ticks.ts`
(single-row today); the cradle's `ticksForDomain` (`scale.ts:208-271`)
already computes the ladder — it becomes the tick provider.
**UI-harmonisation.** Axis styling follows the Expressions-family
typographic grammar; labels never animate or reflow between frames.
**Acceptance.** At year zoom the minor row reads months and the major row
years; at day zoom minor reads hours; tick sets equal
`ticksForDomain(...)` output (pure test) and the existing
civil-frame/offset behaviour is preserved (tests exist).

### T8 — Periodisation bands (reigns, dynasties, wars, eras)
**What.** Named time bands render behind the events — as axis stripes and
as full-height background lanes — sourced from the reading, with the
source's own label authoritative and earliest/latest used only to draw.
**Reference.** TimelineJS3 eras ("a span of time marked along the edge of
the time slider", `TimeEra.js:9-14`); vis background items
(`component/item/BackgroundItem.js`); PeriodO's period definition is the
data shape; Chronas' era-banded scrubber shows it at historiography
scale.
**Seam.** Reading: temporal facets `kind:"valid"` with labels already
arrive (phasesFromFacets, `relations.ts:389-403`); a `band` reading
surface follows T6's `bands[]`; rendering in the vendored lens's frame
layer (`TimelineSurface.tsx:280-329` archetype band layer becomes the
general band layer).
**UI-harmonisation.** Bands are quiet fills (the audit's stillness law):
never animated, never overlapping event cards, labelled once.
**Acceptance.** Fixture with three sourced bands renders stripes with
verbatim labels; an unsourced band renders with the "authored" standing
class; a band with no position is listed, never drawn (honest absence);
pure tests pin band geometry to the PeriodO-derived earliest/latest.

### T9 — Nested events with zoom-collapsing structure
**What.** A parent event (a war, a life, a project) holds child events;
zooming out collapses expanded parents into the parent span, zooming in
expands them; parent extent is computed from children.
**Reference.** Aeon manual pp. 49-53 (multi-level War→Battle→events;
auto-collapse on zoom-out; parent range from children; "Start of X"/"End
of X" preserves a top-down range).
**Seam.** The frame mechanism already does the interaction half
(`frames.ts:59-99`, "Open sub-timeline", "Back to Earth"); the target
adds hierarchy semantics to the reading model (parent_ref on facets or a
composition of relations) and auto-collapse driven by the tier
(`scale.ts`).
**UI-harmonisation.** The breadcrumb stays the frame crumb
(`TimelineLens.tsx:604-617`); expansion is a disclosure act, never
automatic re-layout of unrelated cards.
**Acceptance.** Fixture: war parent + three battles + nine events; at
millennium tier the parent renders as one band; zooming to decade
expands it (screenshot pair); a pure test proves parent fromMs/toMs equal
min(child)/max(child); moving the parent's date moves children (CAS
receipt asserts one native write).

### T10 — Cause and influence chains along the axis
**What.** A causal family chain (A —CAUSES→ B —CAUSES→ C) can be walked
*in time*: selecting a chain highlights its edges in sequence, shows each
hop's time offset, and follows it across the camera; undated hops carry
their absence honestly.
**Reference.** Aeon dependencies (manual pp. 46-48: offsets, move-one-
follows) for the interaction; cradle `directedChains` (`relations.ts:
300-329`) already computes chains without inventing chronology.
**Seam.** Relation field mode "cause" (`relationFieldView.tsx:37-39`)
gains the chain walk; the chronology's relationship layer
(`TimelineRelationshipLayer.tsx`) highlights chain members; offsets
computed from the temporal qualifications only when both hops are dated.
**UI-harmonisation.** The chain highlight is the standing-colour
vocabulary at full strength on a dimmed field — a colour journey with
meaning (audit floor #3), no pulsing.
**Acceptance.** Fixture chain with two dated and one undated hop: the
walk shows dated offsets and "no date disclosed" for the undated hop; no
edge is drawn between cards as causal unless its relation type is in the
cause family (`projectionForRelation`); click-to-follow moves the camera
once (no per-frame loads).

### T11 — Standing-aware relation edges on the chronology
**What.** Edges on the time axis are styled by the relation's own
standing (sourced/derived/authored/disputed/mythic/unknown) with
direction arrows and a visible legend; the native relation properties
already pushed to the substrate are actually read.
**Reference.** The cradle's own grammar (`standing.ts:83-92` legend) —
the chronology today styles by a fixed type split only (G3,
`TimelineRelationshipLayer.tsx:68-73`).
**Seam.** `TimelineRelationshipLayer.tsx` (class from
`properties.standing` via `standingOf`), plus `relations.ts` edge model
crossing the bridge unchanged.
**UI-harmonisation.** Same legend component as the relation field; the
legend renders whenever edges are shown, on both projections.
**Acceptance.** Fixture with a disputed and a sourced relation between
two dated cards: styles differ, legend lists both, tooltips carry the
verbatim standing; pure test pins edge class selection to `standingOf`.

### T12 — Honest aggregation at broad zoom
**What.** At millennium tier, near-coincident facts compress into honest
count clusters ("7 events, 1601–1650"); clicking a cluster zooms once to
its span; counts are derived, labelled as counts, never drawn as fake
events.
**Reference.** Histography's density histogram (every dot one event,
peaks surface representative events — capture 2026-10-07); vis
ClusterGenerator (`ClusterGenerator.js`) for the interaction; the cradle's
own unused `aggregate()` (`lanes.ts:196-231`) for the honest-count model.
**Seam.** `lanes.ts aggregate()` consumed by the mounted chronology at
tier boundaries; cluster click → `setView` (`timelineStore.ts:202-203`).
**UI-harmonisation.** Clusters render in the category colour of their
members at reduced saturation; the audit's restraint law: no wobble, no
count badge inflation.
**Acceptance.** Fixture with 40 events in one decade renders one cluster
marked 40 at millennium tier; expanding shows all 40 (screenshot pair);
a pure test pins bucket membership to `aggregate()` output; culling still
bounds render cost (existing overscan test style).

### T13 — Scale-window minimap
**What.** A slim strip over the whole reading domain shows where the
camera window sits; dragging moves the camera, resizing the window zooms —
the whole of time always one glance away.
**Reference.** Histography's bottom bar ("resize the bottom bar to view
any time period or era", capture 2026-10-07).
**Seam.** `TimelineSurface.tsx` (a pure view over `timeExtent` +
`viewState`, both already flowing through it); no new state — the strip
is a projection of the camera the surface already persists.
**UI-harmonisation.** One-line instrument chrome in the family grammar;
hidden at the widest tier when it would duplicate the axis.
**Acceptance.** Dragging the window pans (centre follows); shrinking it
zooms in proportionally; the strip's highlighted extent equals the
`timelineWindowForViewport` computation (pure test); keyboard-only
operation possible (arrow keys as today).

### T14 — Participant spans (lifespans, validity) behind events
**What.** Participants with validity (a person's birth/death, a place's
identity span, an institution's operation) render as thin spans behind
the event cards of their lane, so events read *against* the span of the
thing that lived them.
**Reference.** Aeon entity birth/death (manual pp. 67, 1720-1725); the
reading model already carries validity facets and place valid_from/to
(`contract.ts:254-255`).
**Seam.** `phasesFromFacets` (`relations.ts:389-403`) + place facets
crossing the bridge; rendering behind cards in the vendored lens's
frame layer (shared with T8 bands, participant-anchored).
**UI-harmonisation.** Participant spans are the quietest element: hairline
fills, label at first occurrence only.
**Acceptance.** Fixture person 1874–1951 with three dated events: the
span renders behind them and clamps honestly if the person's death is
undated (open-ended stays open, no invented end); pure test on span
geometry.

---

## C. Data saving (explicit targets)

### T15 — Named timeline views (the curated view persists)
**What.** "Save view" on M2′ persists a named view: camera, the active
projection (chronology/relations + relation mode), filters (category,
relation-type, tag), the open sub-timeline frame and the walk position.
Reopening restores the curated state; removing is one act.
**Reference.** The Canvas's own named views (frames + selection +
viewport, `researchMaterial.ts:24, 185-191`) — the timeline reaches
parity with its sibling instrument; Aeon bookmarks (manual p. 67) as the
genre reference.
**Seam.** `researchMaterial.ts` (`oi.research-scene/v1` gains a
`timelineViews` record set beside `namedViews`, same bounds discipline);
`researchInstruments.tsx` M2′ block (the save button exists at l.623 —
it persists only the camera today); `TimelineLens.tsx` filter state
flows into the saved record.
**UI-harmonisation.** Same "Views…" chooser pattern the Canvas studio
uses (`researchInstruments.tsx:435-437`) — one grammar across
instruments.
**Acceptance.** Save with filters + frame + relation mode → reload →
state restored exactly (test IDs: `timeline-filter-*`, `timeline-frame`,
projection toggle all assert their restored state); material validator
accepts and bounds the new record (≤32 views, ref-carrying fields
validated); removing a view never touches semantic records.

### T16 — Card style with a native mapping (the refused write lands)
**What.** Timeline card colour/style edits persist through a defined
native mapping (per-node presentation in the Scene's research material,
like Canvas card style), instead of today's post-hoc refusal
("Timeline style has no native Scene write mapping yet").
**Reference.** Canvas card-style actions (`researchMaterial.ts:37,
157`) — same treatment, same bounds.
**Seam.** `researchMaterial.ts` `timeline-layout` value gains the style
fields the validator already knows how to bound (colour grammar from
`card-style`); `researchInstruments.tsx:594-600` drops the style
refusal; the mount's load-side join re-applies style
(`researchInstruments.tsx:593`).
**UI-harmonisation.** The colour capability disclosure
(`styleCapability`, `researchInstrumentsData.ts:185`) flips to available
only when the mapping exists — capability honesty preserved either way.
**Acceptance.** Colour an event card → CAS receipt → reload → colour
persisted; `styleCapability.available === true`; a refusal (e.g. budget
exceeded) surfaces in the existing save-error slot with retry
(`TimelineLens.tsx:795-799`), never a silent drop.

### T17 — The session's time window is maintained and consumed
**What.** The DisclosureSession's `time_window` (in the contract since
TB0, never written — G7) is set by M2′ to the window the person is
actually reading, and consumed by `relationFieldState` and by M4′ (T6).
Leaving the instrument records the window; a co-referenced instrument
inherits it.
**Reference.** `state.ts:65-68`'s own law: the window is the session's,
never derived from zoom/pan — so the write is an explicit disclosure act
("Read over this window"), not a camera spy.
**Seam.** `session.ts` `DisclosureSessionGround` gains
`time_window` (validated by `validateSession`, `contract.ts:876-883`);
the M2′ toolbar's explicit set-window act; `relationFieldState(reading,
projection, selection, timeWindow)` already accepts it
(`state.ts:83-98`).
**UI-harmonisation.** One control, in the family grammar, labelled with
the window it will assert; absent until the person sets one (honest
null, `state.ts:66-68`).
**Acceptance.** Set window → `validateSession` passes with
`time_window` present → relation-field availability recomputes against
it (fixture: an event outside the window is reported out-of-scope, not
hidden); crossing instruments preserves the window byte-exact
(`crossCutSession` test extension).

### T18 — Working set and frame persistence (per subject, bounded)
**What.** The working-set stack and the open sub-timeline frame persist
with the subject's saved view (T15) as ref-carrying records — a
historian's open exploration survives the session.
**Reference.** The working-set model is already property-complete and
ref-keyed (`timelineStore.ts:29-41`); frames are ref-carrying today but
session-local (`TimelineLens.tsx:116` state).
**Seam.** `researchMaterial.ts` timelineViews record (T15) carries
`workingSetRefs[]`, `frameNodeId?` with the same ≤64-ref bound discipline
as `namedViews.selectedRefs`; the mount rehydrates through
`expandNode` (fresh reads, never stale copies).
**UI-harmonisation.** No new chrome — restoring is part of view
application, with the existing stack UI (`TimelineWorkingSet`).
**Acceptance.** Save view with 3 stacked nodes + frame → reload → stack
rehydrates by ref (fresh `expandNode` reads; a node whose source changed
re-reads at current revision, never renders a stale copy); bounds
enforced by the validator; removing the view removes nothing semantic.

---

## D. Navigation and identity (explicit targets)

### T19 — Evidence-grounded opening (event → source at its anchor)
**What.** An event card's evidence affordance opens the source at its
exact selector — the kernel's `authored_relation` anchor byte ranges
(`kernel/src/graph.rs:840, 953`) and the reading's provenance selectors
(`temporalFacets.ts:88`) reach the surface, so "show me why this is dated
1874" lands on the passage.
**Reference.** The reading's own selector grammar (`contract.ts:261-265`
`text_span`); the cradle's Reading lens opens material but not at an
offset (FINDINGS §1.6 — G10).
**Seam.** The bridge stops discarding provenance (`techneBundle.ts:66-69`
"no substrate slot" — the slot is T6's `provenance_selector`);
`TimelineNode.tsx` evidence affordance → `host.inspectSubject(ref,
{selector})` → the cradle's source reader scrolls to the anchor.
**UI-harmonisation.** The affordance is the evidence standing colour
itself — the evidence action looks like what it is (audit: metadata
lives in the binding record, surfaced on request, never painted on the
stage).
**Acceptance.** Fixture reading with a `text_span` selector: opening the
evidence shows the source scrolled/selected at start–end; a facet with
no selector shows the honest absence (control present only when a
selector exists); the subject_ref/revision ride unchanged (identity
law).

### T20 — Event → relation → source → subject round-trip
**What.** From an event: open its focused relation field (exists), select
a relation (co-references the native selection — exists for native refs,
`relationFieldView.tsx:127-131`), then open either endpoint at its
subject in the Studio — with the one gap closed: derived-id relations are
named as such and route to the reading's own endpoints, never a guessed
ref; and the return trip (subject → timeline) lands back on the same
event, camera kept.
**Reference.** One-field identity law (§3 of the dual reading): the whole
traversal preserves `subject_ref`, selection, source basis, reading_ref;
TD8 selection/ref continuity.
**Seam.** `researchInstruments.tsx:606-636` (state keeps
`selectedNodeId` + camera already); the mount's `stateFor` keyed by
subject (l.590) retains view state across instrument switches.
**UI-harmonisation.** No new controls; the existing open/close/retry
grammar (`contextError` retries, `TimelineLens.tsx:357-380`).
**Acceptance.** Scripted traversal event→relation→endpoint→back asserts
`subject_ref` byte-equal at every hop, `selection_ref` recorded in the
session's navigation hops, camera unchanged on return; a derived-id
relation click shows "derived (no native relation_ref disclosed)" and
does not emit a native selection (existing test extended).

### T21 — Cross-instrument carry to the globe (the lane-4 handoff)
**What.** Selecting an event (or setting the window, T17) while M4′ is
open moves the globe to that event's place and year; selecting a place in
M4′ focuses M2′ on its span. Both read T6's one projection; neither
copies data.
**Reference.** Chronas: the year cursor drives the map layer (capture
2026-10-07); TD5's `OCCURRED_AT/LOCATED_AT` vocabulary (`walk.ts:24-33`
already resolves place for events).
**Seam.** T6's `techne:time-axis/v1` + the session window (T17); the
hosted app's instrument bridge posts `{graphNodeId, window}` through the
existing host-command grammar (`hostedApp.ts` postMessage channel).
**UI-harmonisation.** Each instrument keeps its native controls (dual
reading §7 UI); the carry is a change of the shared session state, never
a duplicated cursor widget.
**Acceptance.** Integration fixture: select event with LOCATED_AT place
→ M4′ camera arrives at that place and year (one hop, one message);
select place in M4′ → M2′ frames that place's sub-timeline (existing
`setFrameForNode`); a place-less event carries the window only, with the
honest "no location disclosed" state.

### T22 — Identity-honest instrument handoff (the disclosure contract)
**What.** Every handoff in or out of M2′ (rail switch, cut crossing,
subject refresh) preserves the identity bundle — subject_ref, whole/relation
refs, source + revision basis, occasion ref, selection standing — and
M2′ reports its temporal facet truthfully ("No dates disclosed by this
source" already exists; the target pins the full bundle).
**Reference.** `crossCutSession` (`contract.ts:918-941`) and
`session.ts:140-159` already implement the law; the target closes the
gap between the contract and the mounted instrument's local state (which
today keys views per subject but discloses nothing about what survived).
**Seam.** `session.ts` + `researchInstruments.tsx` `stateFor(key)`
(l.286, already per-subject); a disclosure readout in the family's
status line ("subject X · reading basis rN · window W").
**UI-harmonisation.** The status line is the instrument's existing
message slot (`researchInstruments.tsx:238`) — one line, plain text.
**Acceptance.** Contract tests: crossing with a drifted session refuses
and leaves state untouched; a successful handoff's navigation hop
records from/to/selection_ref; the status line renders the exact
subject_ref and revision basis (plain-language law).

---

## E. Craft and harmonisation (the audit's floor, carried)

### T23 — A colour journey with meaning, and lawful stillness
**What.** The chronology's palette moves with standing and category only
— colour changes when *meaning* changes; no churn, no animation except
camera motion the person drives; the standing legend's colours are the
instrument's one colour journey.
**Reference.** Expression-audit "What good asks for instead" #2/#3
(stillness lawful; colour journey); the existing standing legend and
category swatches supply the vocabulary.
**Seam.** Shared colour constants module consumed by both M2′
projections and the legend (`standing.ts` legend + `categories.ts`
swatches unified).
**Acceptance.** Screenshot set across three subjects: identical facts
render identically; no animation exists in the timeline's CSS
(grep-verified); category colour appears only on category elements.

### T24 — Focus mode and fullscreen for the stage
**What.** M2′ gains the audit's floor: real fullscreen (the stage owns
the screen) and a focus mode that hides all chrome but the axis and
cards, keyed `F`, restoring on escape — the working set and walk panels
are revealable, not permanent furniture.
**Reference.** Expression audit reader-experience floor
(`requestFullscreen`, focus mode, key F).
**Seam.** `researchInstruments.tsx` M2′ block (the container and tools
portals exist); identical implementation to the expression.html floor so
the grammar is one grammar.
**Acceptance.** `F` toggles a chrome-hidden state (screenshot pair);
fullscreen requests and exits cleanly (API call verified in the
mount); state restores exactly on exit; keyboard map documented in the
control's title text.

### T25 — Capability honesty as the instrument's voice
**What.** Every absence keeps its honest sentence and gains its positive
twin: "No dates disclosed by this source" (exists), "no temporal facets
and no dated relations are disclosed — nothing is placed on a time axis,
and none is invented" (`relations.ts:277`), the unavailable-mode reasons,
the standing legend — all rendered from the same availability data, in
plain language, with zero fabricated placeholders.
**Reference.** The existing discipline is already the bar (`TimelineLens
empty state`, `projectionAvailability`, `styleCapability` refusal);
the target is one shared availability voice, not four dialects.
**Seam.** A shared availability/legend render helper consumed by the
chronology toolbar, the relation-field mode bar, and the M2′ status
line.
**Acceptance.** Fixture readings covering: no temporal facets (empty
state + reasons), temporal facets but no relations (timeline only,
relations modes disabled with reasons), relations but no dates
(relation field only, chronology honest-empty). Screenshot set; every
unavailable control carries its reason verbatim (aria-label/title
asserts).

---

## Coverage of the required inclusions

- **Lane-4 time-model contract:** T6 (shape, seam, acceptance) + T17/T21
  (window + carry).
- **Data-saving targets:** T15, T16, T17, T18 (plus the camera/layout
  persistence that already exists, retained as the baseline).
- **Navigation targets:** T19 (event→source at anchor), T20
  (event→relation→source→subject round-trip), T21 (cross-instrument carry),
  T22 (identity-honest handoff).

## Deliberately out of lane (recorded, not duplicated)

Video-editor timelines and the expressions editing core (lane 3's
target set); the globe itself and its layers (lane 4 consumes T6);
journey/palace composition (lane 5). M2′ targets stop at the shared
seams those lanes consume.

## What this target set does not claim

Aeon 3 behaviour, Histography/Chronas behaviour beyond the captured
viewports, and the kernel anchor path end-to-end remain unverified
(FINDINGS §7); each target's acceptance shape is written so phase-3 RE
passes can verify against the possessed references (clones + manual +
captures) without new possession.
