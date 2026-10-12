# Lane 2 findings — M2′ Relation/Timeline current state

Campaign: 2026-10-07-techne-instrument-re · lane 2 (timeline / historiography).
Method: read-only survey of the cradle (`Work/O-I/desktop/cradle/`), evidence
as `file:line` (lines from the files as read on 2026-10-07), every claim
carrying confidence and limitations. Guardrails held: no writes to any product
tree; this document is the only durable record.

## 0. Where M2′ actually lives (the survey's headline)

The instrument has **three bodies**, and knowing which is which explains most
of the current behaviour:

1. **The cradle's pure modules** — `desktop/cradle/src/techne/m0m5/timeline/`
   (`lanes.ts` 250 l, `relations.ts` 472 l, `scale.ts` 287 l, `standing.ts`
   93 l, `state.ts` 192 l), ported from QL-MEF (`contract.ts:2` records the
   2026-09-19 port from QL-MEF main @ dbff5cc). These hold the
   **epistemically honest** model: temporal facets with a 10-rung precision
   ladder (millennium→subsecond), standing classes, DAY/NOW/Session/Run
   continuity lanes, relation families, cause chains, cycles, phase bands.
   Confidence: high (all five files read in full).
2. **The vendored Research Canvas timeline** —
   `desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/
   src/timeline/` (19 files, 3,436 l; `TimelineLens.tsx` 975 l is the surface,
   `TimelineSurface.tsx` 388 l the composition boundary). This holds the
   **interaction-rich chronology**: pan/zoom/inertia camera, bounded window
   loading, collision card placement, sub-timelines, working set, walk,
   filters, archetypal lighting. Exported for the O:I host at
   `vendor/research-canvas/components.ts:10`.
3. **The mount** — `desktop/cradle/expressions-app/field-studies-journeys/
   src/researchInstruments.tsx` (697 l), instrument id `'m2'`, which reads one
   native reading, bridges it through
   `vendor/research-canvas/packages/desktop-api/src/techneBundle.ts` +
   `techneTransport.ts`, and mounts either the **Chronology** (vendored
   `TimelineSurface`) or the **Relation-field** projection
   (`field-studies-journeys/src/relationFieldView.tsx`, which consumes body 1's
   pure modules via `relationFieldView.tsx:22-27`). Confidence: high.

The cradle's `TechneCentre.tsx:1-2` states the placement law: "Technè
operates inside the hosted Expressions application. The cradle supplies owner
readings; it never replaces the field with another lens UI."

## 1. How a reading arrives (typed relations and temporal facts)

1. The hosted app asks the cradle for one scene reading:
   `researchInstruments.tsx:580-582` builds
   `{expression_ref, revision, scene_ref}` and calls `host.read(request)`,
   which routes to the cradle's `readWikiSceneTechne`
   (`TechneCentre.tsx:86`, `wikiReadingProvider.ts`).
2. The cradle reads **native Wiki temporal declarations**
   (`src/techne/temporalFacets.ts`): `readWikiTemporal` (l.11-43) accepts only
   objects carrying the `aikit.techne-facet/v1` contract with RFC3339 instants
   (l.23 enforces the format), per-object revision identity required (l.20),
   and frame participations read under their exact frame/participation basis
   (l.33-39). `sceneTemporalFacets` (l.53-92) resolves which of those facts
   belong to the open Scene's members and throws on any drift ("A dated
   source changed; refresh its live composition…", l.69-80). Provenance
   selectors are minted as `{unit:'other',kind:'techne-temporal-facet',
   value:facet_ref}` (l.88).
3. `researchInstrumentsData.ts:145-146` (`readingInstruments`) converts the
   reading with `bundleFromTechneReadings([reading])` and opens the
   **read-only** `createTechneTransport` (l.177).
4. The bridge's mapping table (`techneBundle.ts:13-69`) is explicit:
   - native refs used **verbatim**, never minted; relation `relType` kept
     verbatim, "never relabelled into the substrate vocabulary" (l.24-26);
   - `temporal[i]` with instant/interval → one anchor node with
     validFrom/validTo/precision **when the substrate enum can carry it
     (millennium|century|decade|year|month|day)**; "Finer-than-day precisions
     (hour|minute|second|subsecond) and absent precision coarsen to 'day' — an
     understatement that never claims more precision than the source warrants"
     (l.36-40);
   - continuity-only facets (day_ref/now_ref/session_ref/run_ref, no instant)
     → relationship subject→ref with `relType` = the facet kind verbatim, so
     occurrence and receipt stay distinct records (l.45-48);
   - spatial facets → Place nodes; disclosure → diagnostics (l.49-64);
   - provenance selectors and native actions are **deliberately not
     projected** (l.66-69).
5. Whole relations are then **replaced by their complete native binding
   readings** (`researchInstrumentsData.ts:162-176`): the bundle keeps only
   the native relations (dropping the bridge's pointer projections,
   l.165) and pushes each with `properties` carrying
   `native_relation_ref/revision, native_owner, standing, evidence,
   evidence_refs, provenance, uncertainty` (l.168-173).
6. The kernel's authored-relation anchor exists:
   `desktop/cradle/kernel/src/graph.rs:840` carries `"authored_relation"`, and
   the test fixture at `graph.rs:953` shows its shape
   (`{"source_ref","anchor":{"start_byte":4,"end_byte":9}}`). Confidence:
   high that the mechanism exists; **not verified end-to-end** into a timeline
   surface (see §7).

## 2. What the chronology (TimelineLens) does today

Evidence: `vendor/research-canvas/packages/canvas/src/timeline/` unless noted.

- **Year-based numeric axis**: `instant.ts:6-30` parses ISO instants (incl.
  signed six-digit years) into fractional proleptic-Gregorian years,
  astronomical numbering; ticks label `1 - rounded` as BCE (`ticks.ts:10-14`).
- **Five scale tiers** millennium→moment with min pixels/year and tick years
  (`scale.ts:14-20`); `MAX_PIXELS_PER_YEAR = 4000`, `MIN 0.02` (l.11-12).
- **Camera**: drag-pan, wheel/pinch zoom anchored under the cursor
  (`viewport.ts:43-60`), arrow-key held navigation with acceleration and tail
  deceleration (`TimelineLens.tsx:504-594`), vertical pan with bounds
  (`TimelineLens.tsx:491-498`, `timelineStore.ts:191-197`).
- **Bounded window loading**: initial window only, then debounced (120 ms)
  re-loads of `viewport ± 50% (min 32 y)` as the camera moves
  (`TimelineLens.tsx:143-225`); render-band culling with 320 px overscan
  (`TimelineLens.tsx:58, 249-256, 930-936`).
- **Cards + lanes**: collision-resolved placement above/below the axis,
  explicit lanes first then automatic slots, 16 px gaps, no merging
  (`projection.ts:95-136`); card widths clamped 180-520 px (l.175-177).
- **LOD**: millennium → markers, century → labels, else detail
  (`TimelineLens.tsx:241-245`).
- **Honest empty and absence**: non-temporal nodes are "not timeline items:
  their relation to history is available through a focused relation field,
  rather than through a fabricated temporal anchor" (`projection.ts:59-66`);
  empty state "No temporal nodes loaded" (`TimelineLens.tsx:830-834`);
  diagnostics panel for invalid anchors (`timelineStore.ts` diagnostics,
  `TimelineLens.tsx:800-811`).
- **Sub-timelines (frames)**: any temporal node frames a sub-timeline; Earth
  is the spatial zero-case; membership = frame node + directly related nodes
  clamped to the frame's own validFrom–validTo window (`frames.ts:16-99`);
  trans-temporal entities (Archetype/Dynamic/Work) **hover above, never nest**
  (`frames.ts:28-39, 102-116`); "Back to Earth" control
  (`TimelineLens.tsx:604-627`).
- **Working set**: click-accumulated stack of one node's real edges +
  neighbours, lazy via `expandNode` (`timelineStore.ts:29-41, 240-276`;
  `TimelineLens.tsx:372-381`).
- **Walk**: the dated events as a traversable sequence with LOCATED_AT place
  resolution and nested frames; "an unlocated stop still appears — the walk is
  never silently dropped" (`walk.ts:10-19, 48-110`).
- **Filters**: 11 categories with colours (`categories.ts:23-35`) derived from
  entityType/historicity/claimKind/evidenceStatus/temporalRole
  (`categories.ts:41-71`); relation-type and tag filter chips
  (`TimelineLens.tsx:679-750`); tag filters reload the view, relation-type
  filters are local (`TimelineLens.tsx:124-130`).
- **Relationship layer**: bezier arcs between placed cards, styled by a
  4-way vocabulary split — CONTESTS/OPPOSES red dashed; CAUSES/PRECEDES/
  INFLUENCES/SUPPORTS blue solid; SOURCED_FROM/QUALIFIES green dashed;
  default tan dashed (`TimelineRelationshipLayer.tsx:68-73`). No direction
  arrows; hidden at marker LOD (l.20).
- **Archetypal lighting**: INSTANTIATES(2)/ECHOES(0) + dominance ranking
  (`lighting.ts:12-18`), dimming unlit cards (`TimelineLens.tsx:848-859`).
  In the O-I mount the capability is honestly disclosed unavailable:
  `researchInstrumentsData.ts:186`.
- **Relation field (the M2′ non-chronological half)**:
  `relationFieldView.tsx` — six projections (relations/cause/echo/opposition/
  phase/activity) with per-mode availability and honest refusal reasons
  (l.37-39, 177-182); standing filter chips rendering the six-class legend
  (l.184-191); Dated/Undated member lanes computed from the WHOLE field so a
  member's lane never flips when projections change (l.41-53); phase bands
  (open-ended stays open, l.227-250) and transformation cycles; activity
  lanes reusing `lanes.ts` (l.113-117); footer "N dated members · M undated —
  nothing here invents a date." (l.194).
- **Cause chains**: `directedChains` walks the owner's own from→to directions
  with no chronology inferred (`relations.ts:292-329`); cycles likewise
  (l.331-371).

## 3. How timeline state saves today

- **What persists** lives in the Scene's research material,
  schema `oi.research-scene/v1` (`researchMaterial.ts:25-30`):
  - `timeline: Record<graphNodeId, {offsetY,width?,height?,lane?,
    layoutRevision?}>` — per-card layout (l.28);
  - `views.timeline` — the camera `{x:centerYear, y:0, zoom:pixelsPerYear}`
    (viewport action, l.40, 160; saved only by the explicit "Save timeline
    view" button, `researchInstruments.tsx:623`; restored on reopen,
    l.611-612).
- **Optimistic CAS**: `timeline-layout` requires
  `expectedRevision === previous?.layoutRevision ?? null`, then bumps
  `layoutRevision` by one (`researchMaterial.ts:161`). The lens layer queues
  per-node saves, tracks known revisions, and renders explicit
  conflict/pending-save errors with retry (`TimelineLens.tsx:430-464,
  795-799`).
- **Load-side join**: saved layouts are re-applied as `layoutOverride` when
  the view loads (`researchInstruments.tsx:592-593`).
- **What is explicitly refused**: card style — "Timeline style has no native
  Scene write mapping yet; layout was not changed"
  (`researchInstruments.tsx:596`; capability disclosed at
  `researchInstrumentsData.ts:185`).
- **What is NOT saved at all** (session-local only):
  the Chronology↔Relations projection switch (`researchInstruments.tsx:613-616`
  "session-local only, like the timeline camera" — note the camera *is* saved;
  only the switch is not); category/relation-type/tag filters; the working
  set; the open sub-timeline frame; walk selection. Filters and frame are
  plain component state (`TimelineLens.tsx:100-115`).
- **Bounds**: research material ≤ 256 KiB, ≤ 256 timeline records,
  offsetY ±40000, width/height 40-40000, lane ≤ 1024 chars,
  layoutRevision ≥ 1 integer (`researchMaterial.ts:83-84, 115`).
- **The bridge transport is read-only**: `techneTransport.ts` header — layout
  upserts are "ACCEPT-AND-HOLD … kept in memory on this transport instance
  only … never persist to any store" — but the O-I mount **overrides**
  `saveTimelineLayout` with the real native-material write
  (`researchInstruments.tsx:594-600`), so persistence in the mounted
  instrument goes through the Scene CAS, not the accept-and-hold path.
  Confidence: high.

## 4. Navigation in/out preserving subject identity today

- **Card → source**: `onOpenNode` / `onOpenCanvasNode` call
  `host.inspectSubject(ref, {node, relationField})`
  (`researchInstruments.tsx:631-633`) — the same native subject the Canvas
  opens; single click opens on Canvas (T11), shift-click deliberately stays on
  the timeline for working-set exploration (`TimelineSurface.tsx:198-219`).
  Full-document read is layered: the bounded projection opens immediately,
  the optional `loadNode` read replaces it when it returns
  (`TimelineLens.tsx:384-407`).
- **Relation selection co-reference**: the relation field routes selection
  through the SAME native selection path as Canvas —
  `host.select(sceneId, null, bindingRef)` — but **only for a relation
  carrying a native relation_ref**, never for a derived positional id
  (`relationFieldView.tsx:127-131`; mount at `researchInstruments.tsx:628`).
  Member open → `host.inspectSubject(ref)` (l.132-134).
- **The contract-level identity law** lives in the cradle:
  `session.ts:64-90` — one subject, one source-qualified selection, one
  reading basis, one agent-session ref across instruments;
  `openInInstrument` records a navigation hop and co-references the selection
  (l.140-159); `crossCutSession` (`contract.ts:918-941`) carries subject,
  selection basis, sources, occasion, Actions and Return target "untouched,
  which is the cross-cut identity law", refuses a drifted session, and
  refuses a crossing onto the cut already occupied.
- **Rail state is presentation**: `instrumentRail.ts:5-13` — tab switching
  "never closes surfaces, never starts or stops a session"; per-viewer
  localStorage, M0′ default.
- **The one-reading bridge law**: `m0m5/reading.ts:9-16` — "resolve once,
  lens many … switching lens never re-identifies the subject or re-opens the
  source"; the full contract reading is used whole when the provider's wire
  payload is one, refused at the seam otherwise (l.27-36).
- **Scope assertion**: `assertInstrumentReadingScope`
  (`researchInstrumentsData.ts:222-231`) refuses a reading not bound to the
  open construction ("A host-wide reading cannot lend dates or places to
  unrelated construction").

## 5. TD3 distinction check — does M2′ preserve the distinctions?

TD3 (`TECHNE-DUAL-READING.md:218-224`): "Prove the UI preserves distinctions
among chronology, cause/influence/echo/instantiation and evidence standing.
Archetypal or cultural relation does not become a fake historical date. Where
DAY/NOW/Run/Session are involved, occurrence, receipt and validity remain
distinguishable."

**Held today (evidence):**

- *No fabricated dates*: non-temporal nodes never become timeline items
  (`projection.ts:59-66`); undated members get an Undated lane, never a date
  (`relationFieldView.tsx:41-53, 194`); a facet ref naming no facet is
  "unresolved" and reported, never silently dated or dropped
  (`relations.ts:91-113`).
- *Relation types verbatim, unknown types never silently family-assigned*:
  `relations.ts:18-21, 223-245` ("an unrecognised relation type lands only in
  the relation field itself"); the bridge never relabels (`techneBundle.ts:
  24-26`).
- *Standing never upgrades*: the six-class conservative grammar
  (`standing.ts:15-25, 59-81`); verbatim standing always rides and is always
  what is displayed; legend rendered whenever relations show (l.83-92).
- *Occurrence vs receipt vs validity*: distinct kinds and lanes
  (`lanes.ts:16-17, 77`); continuity lanes DAY/NOW/Session/Run by precedence
  (`lanes.ts:80-89`); `state.ts:66-68` keeps the session's time window
  separate from zoom/pan ("those are presentation state, deliberately
  inexpressible in the contract").
- *Precision honesty (cradle model)*: every range is "the WIDEST HONEST range
  that precision allows — never a fabricated exact instant"
  (`scale.ts:5-11`); a no-precision instant stays a point.

**Broken or thin today (the named gaps):**

- **G1 — Two time models, and the mounted one is the weaker.** The chronology
  runs on year-resolution fraction-of-year floats (`instant.ts`) while the
  cradle model is epoch-ms with the full precision ladder and per-instant UTC
  offsets (`scale.ts:35-108`). The bridge **coarsens hour/minute/second/
  subsecond to "day"** (`techneBundle.ts:36-40`) — sub-day temporality is
  unreadable in the Chronology view (it survives only in the relation field's
  activity lanes). The two models never interoperate.
- **G2 — Precision and uncertainty are dead data in the layout.**
  `TimelineItem.precision` is carried (`projection.ts:15`) but nothing renders
  it (no hits in `TimelineNode.tsx`); a millennium-precision fact is drawn as
  a point at its boundary instant, contradicting `scale.ts`'s
  widen-to-precision law which the vendored lens never adopted.
  `TechneTemporalFacet.uncertainty` (`contract.ts:220`) and the substrate's
  uncertainty property ride verbatim but have **no visual expression** on
  cards, anchors or edges — no circa bands, no fuzzy bounds, no
  "reported/derived" hatching.
- **G3 — No evidence/standing annotation on the chronology.** The
  relationship layer styles by a fixed 4-way type split only
  (`TimelineRelationshipLayer.tsx:68-73`); the native relations' `standing`,
  `evidence`, `provenance`, `uncertainty` properties pushed at
  `researchInstrumentsData.ts:168-173` are never read by the layer. The
  card's evidenceStatus/claimKind categories exist (`categories.ts`) but in
  the O-I mount bridge nodes are entityType "Source" except places
  (`techneBundle.ts:19-23`), so the claim/interpretation/myth categories
  barely engage. Evidence standing is legible in the relation field, absent
  on the time axis.
- **G4 — No periodisation bands.** Reigns/dynasties/wars/eras as background
  context bands do not exist (the walk's archetype layers are the nearest
  analogue and are honestly empty in O-I, `researchInstrumentsData.ts:198`).
  The relation field's phase bands (`relationFieldView.tsx:227-250`) never
  appear on the chronology.
- **G5 — Cause chains are structural, not temporal.** `directedChains`
  (`relations.ts:300-324`) walks directions without time; nothing draws a
  causal chain **along the time axis**, and the chronology's edge layer is
  pairwise cosmetic. TD3's "cause/influence/echo/instantiation" distinction is
  preserved as data but has no time-legible rendering.
- **G6 — Single calendar.** One proleptic Gregorian axis, BCE/CE labels only
  (`ticks.ts:10-14`); no multiple calendars, regnal dating, or era naming
  (historiography-grade basics).
- **G7 — The DisclosureSession's time_window is never maintained.** The
  contract carries it (`contract.ts:443`) and `relationFieldState` accepts it
  (`state.ts:87-98`), but `session.ts` never sets it (no hits) — no
  instrument today declares the window it is read over.
- **G8 — The cradle's aggregation is unused.** `aggregate()`
  (`lanes.ts:196-231`) compresses many near-coincident facts into honest
  counts at broad zoom, but no view consumes it (no callers); the vendored
  lens instead relies on culling + collision displacement
  (`projection.ts:118-134`).
- **G9 — Filters, working set, frame and projection switch are not
  persisted** (§3) — a historian's curated view (filtered, framed, zoomed)
  evaporates with the session.
- **G10 — authored_relation anchors have no timeline surface.** The kernel
  carries `authored_relation` anchors with byte ranges
  (`kernel/src/graph.rs:840, 953`), but neither the bridge mapping
  (`techneBundle.ts:66-69`: "provenance selectors … no substrate slot") nor
  the timeline UI surfaces them — source-grounded evidence cannot be opened
  at its exact anchor from an event card.

## 6. Shared temporal semantics with lane 4 (interface point, not duplicated)

Lane 4 (World/Places) consumes dated events on a shared time axis. Today the
only shared seam is the ql.techne/v1 reading itself: `TechneTemporalFacet`
(`contract.ts:205-222`) with kind/precision/uncertainty/source_ref, and
`TechnePlaceFacet.valid_from/valid_to` (`contract.ts:254-255`). The
`TimelineWalk` place resolution (`walk.ts:24-33`) and the substrate's
LOCATED_AT vocabulary are the current event↔place join. The time-model
contract lane 4 will consume is specified in `TARGET-SET.md` (T-series there).

## 7. What stayed unverified (named)

- `readWikiSceneTechne` (`wikiReadingProvider.ts`) was located and its call
  path confirmed (`TechneCentre.tsx:86`) but not read line-by-line in this
  pass; the temporal facets path (`temporalFacets.ts`) was read in full.
- No live run: nothing here was exercised against a booted desktop; all
  evidence is static reading. Confidence in behavioural claims rests on the
  code paths read, not on a captured run.
- The authored_relation anchor path from kernel graph → wiki reading →
  timeline evidence display was verified only to the reading side
  (`temporalFacets.ts` provenance selectors), not through a live kernel call.
- The research-canvas substrate's own persistence (its repositories.ts /
  Rust substrate) was surveyed only where the O-I mount touches it; its
  Neo4j/SQLite behaviour is out of lane scope (the O-I transport replaces it).
- `TimelineNode.tsx` and `TimelineWalk.tsx`/`TimelineWorkingSet.tsx`/
  `TimelineRelationField.tsx`/`TimelineAxis.tsx` were read only in the
  parts cited (they are renderers over the stores already surveyed).
