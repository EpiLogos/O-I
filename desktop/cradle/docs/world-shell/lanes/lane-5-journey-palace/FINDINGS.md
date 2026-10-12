# Lane 5 findings — M3′ Journey/Scenes + M5′ Palace/Integral Whole, current state

**Scope:** the journey and palace instruments in the O-I cradle
(`Work/O-I/desktop/cradle/`), as they stand 2026-10-07. Every claim carries
file:line evidence; confidence and limitations are stated. Read-only study;
nothing here writes any product tree.

## 0. The one-paragraph picture

There are **two journey floors and one palace floor, mostly unwired to each
other**. (a) `src/techne/m0m5/journey/` — the 4:2-deep model floor (beats
derived from a reading's Expression scene refs, routed composition/reorder
proposals, the formal 4:2↔3:3 crossing law, presence persistence, the Vāk/C′
traversal, structured agency state) — is **consumed by nothing except its own
test file** (`tests/techne-m0m5.test.mjs`). (b) The hosted Expressions app
(`expressions-app/field-studies-journeys/`) is the **actual journey editor**
— its `native.ts:1` says so — with its own `oi.journey` v1 authoring schema,
a kernel bridge to the one real store (`oi.expression/v1`), a scene strip
with drag reorder, and a crossfade-only journey playback. (c) The palace has
a mounted region-composition surface (`palaceInstrument.tsx`) that correctly
persists regions as real kernel Scenes, while the deeper palace floors —
session state, integral reading regions, recall walk, Return leg, agency
state — are again test-only. The journey/palace law ("journey composes over
real scene refs, no shadow store") is *satisfied where it is implemented*,
but the deep 4:2 journey instrument does not exist as a surface at all, and
the palace surface implements only the composition half of TD6 (no guided
integral walk, no Recognition/Return UI).

## 1. Where the journey instrument lives

### 1.1 The deep-model floor (`src/techne/m0m5/journey/`, 8 files)

- **Beats** (`beats.ts:91-114`): one beat per scene-bearing Expression
  binding of a `TechneReading`, scene refs **carried verbatim** ("never
  re-keyed, never shortened — the Expression substrate `oi.expression/v1`
  stays the only persistence", beats.ts:3-7). Zero scene refs → honest
  `unavailableReason` from the reading's own disclosure (beats.ts:108-113).
  The beat frame composes temporal (occurrence/day only), spatial and
  provenance facets from the same reading (beats.ts:71-86).
- **Composition** (`compose.ts:81-129`): a scene-create **proposal** routed
  to the Expression owner (`oi.expression.edit`, compose.ts:41), proposed
  scene ref minted in the substrate's own `${expressionRef}:scene:${slug}`
  grammar (compose.ts:93), collision with a disclosed scene refused
  (compose.ts:95-97), CT materiality enforced per Vāk lock §4
  (compose.ts:133-158). Nothing persists (compose.ts:28).
- **Reorder** (`sequence.ts`): local `SequenceDraft` (order + per-scene pace,
  sequence.ts:40-49); `composeProposal` (sequence.ts:110-142) refuses drafts
  that invent or drop scene refs and routes `oi.expression.edit` with
  `{expression_ref, revision, scene_order}`. **Pacing never enters the
  proposal** — "the Expression substrate's Change union has no pacing change,
  so a pace draft stays local" (sequence.ts:12-15).
- **Crossing** (`crossing.ts:86-99`): the formal 4:2↔3:3 bridge — entering a
  scene appends the scene ref to the selection's own `focus_refs`
  (crossing.ts:58-63), refuses crossing onto the occupied cut
  (crossing.ts:45-52), asserts subject/reading/selection/agent-session
  untouched (crossing.ts:90-97); return restores the exact beat by scene_ref
  equality, never index (crossing.ts:75-78, 105-108).
- **Presence** (`presence.ts`): the surface's one persisted presentation
  store — position (reading basis + expression + scene ref) plus composition
  draft, in localStorage under `oi-cradle.techne-journey.presence.v1`
  (presence.ts:49), strict validate-then-accept per entry (presence.ts:58-83),
  basis standing `current`/`field-advanced`/`stale` (presence.ts:149-152).
- **Vāk traversal** (`vak.ts`): CS0–CS5 passages transcribed from QL-MEF
  `cprime_oikonomia.rs` (vak.ts:62-69); CFP thread forms change the step
  *structure* (chord/chained/fused/drone), scenes at unvisited positions drop
  out **disclosed** as `unvisited`, never silently (vak.ts:209-269); CFP5
  refused inside a single traversal (vak.ts:174-176).
- **Agency** (`agent.ts:87-169`): pure JSON-safe state for Technē_3 —
  sequence, current scene, source basis, disclosed ActionRefs, C′ reading,
  governance (`propose-await-human-acceptance` under human-engaged,
  agent.ts:155-167). The instrument itself writes nothing (agent.ts:163-166).

**Mount status: none of these files has a consumer outside
`tests/techne-m0m5.test.mjs`** (grep over cradle src + hosted app src,
2026-10-07: only self-imports and the test). Confidence high (grep verified
across `/src` and `expressions-app/field-studies-journeys/src`; re-verified
by the lane-5 continuation pass, 2026-10-07). Sharper still: the test itself
imports only `beats`, `compose` and `crossing` (`tests/techne-m0m5.test.mjs:9-11`)
— `presence.ts`, `sequence.ts`, `vak.ts`, `agent.ts` and `proving-reading.ts`
have no consumer anywhere, not even the test.

### 1.2 The real journey editor (`expressions-app/field-studies-journeys/`)

The hosted Expressions application *is* the native journey editor
(`expressions-app/src/native.ts:1`: "Default application: the native journey
editor"). Its document model:

- **Authoring schema `oi.journey` v1** (`src/model.ts:60`):
  `{schema, version, id, name, description, loop, scenes: Scene[], savedScenes?, shared?, updatedAt}`.
  A `Scene` (`model.ts:46-59`) carries engine settings, field
  (background/palette/material/params), entities (≤32, `model.ts:170`) with
  per-entity sequences, text layers, automation lanes, composition (layout,
  plane, travelling focus), morph clock, `duration` (1–3600 s) and
  `transition` (0–30 s) — the **per-scene entry-transition seconds**.
- **Authoring limits**: 1–64 scenes per journey (`model.ts:160`), draft/saved
  duality via `savedScenes` keyed by working-scene id
  (`sceneWorkflow.ts:4-26`): save/restore/next, save state
  `Draft|Saved|Edited since save` (`sceneWorkflow.ts:8-11`).

### 1.3 How journey state persists today — the real seam

- **The kernel Expression document (`oi.expression/v1`) is the only semantic
  store.** `kernelDocumentBridge.ts:209-255` (`kernelDocumentToJourney`)
  converts the bounded native document into the working `oi.journey` view and
  keeps an explicit `bindings` map: view scene id ↔ native `scene_ref`, per
  scene `member_refs`, disclosure pages, occurrences, body and triggers
  (kernelDocumentBridge.ts:247). Scene *material* rides natively inside each
  Scene's `presentation` envelope
  `{schema:'oi.journey-scene/v1', scene, saved}` — written by the
  `scene_material_set` change (`kernelComposition.ts:19,118`) and read back
  (`kernelDocumentBridge.ts:174-187`, refusing mismatched name/material).
  Whole-expression presentation (description, loop, shared toolbelt) rides as
  `{schema:'oi.journey-properties/v1'}` (`kernelComposition.ts:21-33`).
- **Authoring work returns to the SAME Expression** as one kernel `edit`
  request, CAS-gated on `expected_revision` (`kernelComposition.ts:145-147`);
  new scenes/entities mint refs in the substrate's own grammar via
  `localRef()` (`kernelComposition.ts:35-43`); replay/rebase keeps engine
  view ids stable (`kernelComposition.ts:171-185`); a `revision_conflict`
  reply is refused loudly and the draft preserved
  (`kernelComposition.ts:156`).
- **So: real scene identity, no shadow semantic store, where the native path
  is taken.** The kernel's Change union carries `scene_create`, `scene_rename`,
  `scene_remove`, `scene_reorder`, `scene_compose`, `entity_add`,
  `scene_material_set`, `focus`, `scene_body_set`, `scene_trigger_attach`
  (`src/expression/types.ts:40-64`; kernel
  `kernel/src/expression.rs:549-690`).
- **Shadow stores that DO exist (browser-level, presentation-side):**
  - localStorage library `oi.field-studies.journey-library.v1`
    (`store.ts:2,20-35`) — every opened journey is also saved to the browser
    library on `applyJourney` (`app.ts:444`: `saveToLibrary(store.document)`);
    documents authored fresh in the app (never opened from the kernel) live
    **only here** — a browser-local shadow of journey documents. Validation
    is strict and unknown entries are retained byte-for-value (store.ts:30-35).
  - Session state under `SESSION_KEY` (`app.ts:137`) — position, playing
    state, camera, transport — presentation continuity.
  - Journey *presence* (the deep floor's `presence.ts`) is a third,
    unwired presentation store of the same kind.

### 1.4 Journey navigation and playback today

- The **M3′ lens is the app's own scene strip**: `activateInstrument`
  (`app.ts:1001-1023`) — `lens==='journey'` opens `timelineOpen=true`;
  `lens==='palace'` opens the palace studio section + instrument; canvas/
  timeline/place mount through the research-instruments adapter; the lens
  chooser is "presentation only" (`lensStudio.ts:39-55`).
- **Scene strip** (`app.ts:221` `renderTimeline`): thumbnail buttons with
  save-state dots, expression-time playhead, per-scene name/duration/
  transition inputs, Save/Save&next/Restore, move-left/right and delete.
  **Drag reorder exists** (`app.ts:766-768` dragstart/dragover/drop →
  `reorderScene`, `app.ts:468`).
- **Playback** (`play-journey`, `app.ts:576`; loop `app.ts:844`): walks
  **saved scenes only** (`savedSceneIndices`, `sceneWorkflow.ts:26`), dwell =
  the scene's `duration`, advancing via `setScene(i, automatic=true)`.
- **Transitions are a single mechanism: a canvas crossfade.** `setScene`
  captures the current engine canvas into a `transition-canvas` overlay and
  fades its opacity over the scene's `transition` seconds
  (`app.ts:301`, fade loop `app.ts:845`, capture for video `app.ts:459`).
  The fade applies the engine's easing vocabulary (`smoothstep|linear|
  kineticSnap|whip`, `expressions-app/src/engine/types.ts:89`,
  `applyEasing` `expressions-app/src/engine/fieldModel.ts:313`), but the
  journey transition pins it: `setScene` hardcodes
  `transitionEasing='linear'` (`app.ts:301-302`) — the crossfade is
  linear-only in practice, and no surface exposes a per-transition easing
  choice. **Preview engine only**
  (`engine.capabilities.kind==='preview'`, `app.ts:301`). The app's own UX
  contract names the ceiling: "The preview's page dissolve is not a physical
  transition law" (`docs/UX_CONTRACT.md`, "Remaining production UX work"),
  and "Scene duration in this shell is total scene occupancy, including its
  entry transition" (same file).
- **Crossing to a scene in the living expression**: the app *is* the living
  expression — a scene "entry" is `setScene`. What exists formally is the
  **source/verso portal**: a Scene's declarative trigger
  (`occasion:'activate'`, `target.kind:'portal'`) is resolved from the native
  Scene on click (`src/expressions/scenePortal.ts:11-33`), opened as a
  surface in preview/overlay placement, with an explicit "Return to scene"
  (`src/expressions/SceneSourcePortal.tsx:8`). Portal placements vocabulary:
  `preview|overlay|beside|full|detached|re_dock`
  (`kernelDocumentBridge.ts:41-42`). But the deep-floor crossing
  (`crossing.ts`) — session-preserving 4:2↔3:3 travel with the scene focus on
  the selection — is not what the mounted app performs.
- **Journey↔host navigation**: host commands over the kernel channel
  (`open-expression`, `lens`; `src/expressions/hostedApp.ts:440-462,546-554`);
  the app announces honest position state back (`oi-app-state`, incl.
  `journeyPlaying`, `hostedApp.ts:498-514`).

## 2. Where the palace instrument lives

### 2.1 The substrate law (kernel + composition floor)

- `src/techne/m0m5/palace/composition.ts` (23 KB) is the **composition
  floor**: elements are the reading's `expressions[]` **verbatim**
  (composition.ts:122-124); arrangement (rooms/loci — fixed 3×2 rooms × 4
  loci, composition.ts:87-90) is local presentation state persisting nowhere
  (composition.ts:9-13); **a durable region is a real Scene of the Palace's
  own Expression** carrying **exactly one** contained Expression through its
  own body (`scene_body_set`, carrier `expression_ref`, composition.ts:19-37,
  355-369); opening is a declarative Portal trigger
  (`scene_trigger_attach`, composition.ts:371-381); the guided path is the
  Palace's own scene order (`scene_reorder`, composition.ts:385-401);
  **explicit removal only** (`removedRegionNames` is the only path to
  `scene_remove`, composition.ts:39,334-338); plans are diffed against a live
  snapshot first, so **replay emits nothing** (composition.ts:41-44, readback
  `discoverRegions` 451-456); every proposal carries the CAS revision
  (composition.ts:47-49, `composeRegions` 409-422).
- The one-member law is kernel-proven, not folklore: an Entity's
  `subject_bind` **refuses** a subject_ref starting `expression:`
  ("Subject must remain native", `kernel/src/expression.rs:1195-1196`), and
  `kernel/tests/palace_composition_native.rs` proves the refusal, the
  region-body + portal round trip, guided-path reorder with replay
  idempotence, and stale-basis refusal (`revision_conflict`).
- **The mounted surface** (`field-studies-journeys/src/palaceInstrument.tsx`,
  installed from `activateInstrument` at `app.ts:1018-1019`, mounted inside
  the Studio's "Palace" section): region list editor (create/rename-by-title/
  explicit remove/reorder), eligible native Expression list ("Open" = the
  summon path = **independent addressability**; "Add to region"/"Add as new
  region" with the one-member refusal text, palaceInstrument.tsx:98-111),
  Save = `planRegions` → one kernel `edit` CAS-gated, then readback-verified
  (palaceInstrument.tsx:142-157).
- **What the kernel holds**: region Scenes, their bodies, triggers and order
  — genuine `oi.expression/v1` state, reopened by `discoverRegions`
  (composition.ts:451-456).

### 2.2 The unwired palace floors

- **`palace-state.ts`** — session-scoped presentation store: `bound` flag,
  regions, placements, bookmarks (`palace-state.ts:73-84`); keyed by
  `subject_ref\0reading_ref` (palace-state.ts:35-37); **in-memory Map only —
  app-restart recovery is a recorded join, not implemented**
  (palace-state.ts:8-13).
- **`regions.ts`** — the integral architecture: regions M0′→M5′
  (ground/canvas/relation/journey/world/expression/sources/agency) derived
  from the reading's real facets (regions.ts:78-214), method-of-loci
  placements (regions.ts:230-266), architecture honesty
  (`regionArchaeology`, regions.ts:281-291). Test-only.
- **`recall.ts`** — the mnemonic walk: spatial-order recall with wrap
  (recall.ts:27-60). Test-only.
- **`return.ts`** — the Return leg: routed governed-write Action (e.g.
  `aikit.wiki.stage`, return.ts:51-53), shaped input carrying composed refs +
  region intent (return.ts:62-108), explicit unrouted receipt on refusal
  (return.ts:11-13), re-open of M0′ on the same session (return.ts:128-139).
  Test-only.
- **`agent-state.ts`** — structured Technē_5/Epii state incl. unresolved
  evidence named, never smoothed (agent-state.ts:53-103). Test-only.

**Consequence:** TD6's second half — "one recognised result can return as
attributable Wiki/source proposal" and the guided integral walk over real
subjects of *all* M′ families — has a complete, tested data floor and **no
surface**. The mounted palace composes Expressions only; the reading-grounded
integral regions (ground/canvas/relation/journey/world/sources) are not
mounted anywhere.

## 3. The one-field identity law, current status (TD4/TD6)

- **TD4 (journey→scene→source→journey)**: composition over real scene
  identity is real *inside the hosted app* (kernel scene_refs; §1.3). The
  formal crossing (subject/selection/session preserved, scene focus on
  `focus_refs`) exists as tested law but is not the app's navigation path;
  the app navigates by host commands and its own scene index. The
  source/verso leg exists via declarative portals with explicit return.
  Journey-presence restore ("reload and re-enter") exists in the deep floor
  only.
- **TD6 (palace integral + Return)**: composition/presentation split is
  genuinely implemented (arrangement is local, regions are native Scenes,
  objects stay independently addressable via Portal "Open"). The recognised
  result returning as an attributable proposal (`return.ts`) and the
  reading-wide integral walk (`regions.ts` + `recall.ts`) are unwired.
- **One-field honesty in the readings**: the reading provider binds the
  register's standing kernel Expression as `expressions[0]` and discloses
  `oi.expression.edit` so "Journey composes real scenes INTO the register's
  Expression" — and honestly refuses with a reason when no document stands
  (`src/techne/wikiReadingProvider.ts:23-31`).

## 4. Named gaps (the craft bar, not a compliance list)

1. **The M3′ deep instrument does not exist as a surface.** No surface shows
   a reading-derived beat sequence; no surface performs the formal crossing;
   journey presence is never restored; Technē_3 proposals are never routed
   from any UI. The app's journey is Expressions-native only — it cannot
   compose a journey *from a subject's reading* (the C3 spine step
   "compose a Journey from real refs" is served only by fixtures).
2. **Transitions are one crossfade, preview-only, with four reused easings.**
   No per-transition authoring (curve, mode, sync), no transition preview on
   the strip, no at-end/sync switch semantics, no visualisation of the
   transition during playback (compare Godot's per-edge `xfade_time`,
   `xfade_curve`, `switch_mode`, and its editor drawing the live fade ratio
   on the edge — evidence in RE-TARGETS.md).
3. **No journey-level pacing persists natively.** Pace stays local by law
   (`sequence.ts:12-15`); in the app, duration/transition do persist inside
   scene material, but there is no journey-level timing surface beyond the
   strip inputs.
4. **Palace arrangement (rooms/loci) and bookmarks are session-scoped and
   never persist**; the mounted palace has no loci arrangement at all — it is
   a linear region list.
5. **The integral whole is Expressions-only on the surface.** The
   M0′→M5′-wide integral composition from the reading (ground members,
   constellation, temporal facets, places, sources) exists as data
   (`regions.ts`) with no mounted composition, no recall walk, no
   archaeology display.
6. **No Return surface.** `palaceReturnRoute` (governed-write, attributable)
   and the explicit unrouted receipt are unwired; the palace's Save is an
   Expression edit, not a Recognition/Return to ground.
7. **Browser-local shadow library.** `oi.field-studies.journey-library.v1`
   holds full journey documents outside the kernel; fine for scratch work,
   but the app's own boot can open from it, so two "sources of journeys"
   coexist at the browser level (the kernel remains the only semantic store;
   the shadow is durable presentation/local work — worth an explicit
   standing decision, not silent coexistence).
8. **Craft floors from the expression audit apply here too** (audit
   FINDINGS.md §"What good asks for instead"): no stillness law, no colour
   journey law, text-by-exception — none of these are enforced or even
   expressible in the journey/palace surfaces today; the scene strip shows
   no per-scene colour/stillness reading. Target sets must name the bar, not
   re-create the 2026-10 churn floor.

## 5. What stayed unverified

- The hosted app's build in `dist/` was not exercised at runtime (static
  reading only); playback/transition behavior is read from code + the app's
  own UX contract, not run.
- `docs/UX_CONTRACT.md`'s claims about production-engine behavior are
  quoted, not tested.
- The research-instruments adapter (`researchInstruments.tsx`) mounts
  M1′/M2′/M4′; its exact journey-boundary behavior (what it does to
  `journeyPlaying`) was read only at the `activateInstrument` call sites.
- The Vāk floor's CS passages were not re-diffed against the QL-MEF Rust
  source in this pass (vak.ts asserts tests pin them).
- Whether any lane-3 deliverable landed was re-checked at write time —
  `lane-3-expressions-editor/` was still empty; all lane-3-dependent targets
  below are recorded as dependencies, not duplications.
