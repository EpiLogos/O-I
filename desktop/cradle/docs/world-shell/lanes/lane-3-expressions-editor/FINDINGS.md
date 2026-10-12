# Lane 3 findings — the 3:3 Expressions editor today

Scope: the expressions instrument as it stands in the cradle
(`Work/O-I/desktop/cradle/expressions-app/`, the vendored source of record)
plus the cradle-side bindings that carry its documents
(`desktop/cradle/src/`). Method: static reading with file:line evidence; no
runs against live kernels. Confidence is stated per finding; limitations are
named at the end. Read-only on every product tree; all RE scratch lives
outside product trees (`/tmp/techne-lane3-re/`).

## 1. What the editor is

The default application entry is the journey editor
(`expressions-app/index.html` → `field-studies-journeys/src/`). One document
(`oi.journey` v1) holds an ordered list of Scenes; each Scene is a living
particle field with entities, text, engine settings, automation and a camera.
It is not a mock: the store, undo, draft recovery and kernel saves are real
(§4–§6). The renderer is the vendored engine (`expressions-app/src/engine/`),
carried into the design system by
`Work/O-I/scripts/vendor-expressions-engine.mjs`
(→ `packages/oi-design-system/expressions-engine/`, PROVENANCE-gated).

Evidence: `expressions-app/README.md:1-10` ("This directory IS the Expressions
application"; owner ruling 2026-09-19); `field-studies-journeys/src/model.ts:60`
(`export interface Journey {…schema:'oi.journey';version:1;…}`).

## 2. The document model (oi.journey v1, and the kernel's oi.expression/v1)

**App model** (`field-studies-journeys/src/model.ts`):

- `Journey` — id, name, description, loop, `scenes:Scene[]`, `savedScenes`
  (per-scene snapshot copies), optional `shared` settings (`model.ts:60`).
- `Scene` — id, name, character, `duration:number`, `transition:number`,
  `view` (2d/3d, yaw/pitch/zoom/pan), `field` (background, palette, material,
  `params:Record<string,number>` — ~40 live numeric parameters,
  `DEFAULT_PARAMS` `model.ts:66-73`), `entities:Entity[]`, `text:TextLayer[]`,
  `composition` (blueprint, layout, plane, travelling focus), `morph` clock,
  `automation:AutomationLane[]`, optional `propertyTracks`
  (`model.ts:46-59`).
- `Entity` — kind `'formation'|'pin'`, position/size/rotation, shape
  (`'text'|'ring'|'disc'|'square'|'triangle'|'yantra'|'cymatic'`), tint,
  force (attract/repel/vortex), station (0–6), optional
  `sequence` (per-entity step chain), optional layers/image/ascii sources,
  optional role slot (`model.ts:21-34`).
- `SequenceStep` — per-step text/shape/layers/objectState, `hold`,
  `transition`, optional position override (`model.ts:19`).

**Kernel document** (`desktop/cradle/src/expression/types.ts:36`):
`ExpressionDocument` — schema `oi.expression/v1`, `expression_ref`,
`revision:number`, `title`, `scenes` (scene_ref, title, entity_refs, optional
rich `presentation` `oi.journey-scene/v1`, `body` carrier, `triggers`),
`entities` (entity_ref, title, `parameters:Record<string,Parameter>`,
`subject:SubjectBinding`), `relations`, `selection`, `provenance`,
`representations`, `refinements`, `reuse`, `profiles`. Rich Scene material
travels whole through the scene presentation envelope; scalar parameters
carry the addressable subset (the app maps 19 keys — 7 textual + 12
numeric, `kernelExpressions.ts:134-136`; verified this session).

**Scene/address budgets** (first-hand):

| Bound | Value | Where |
|---|---|---|
| Scenes per journey | 1–64 | `model.ts:160`; kernel `expression.rs:914` (`"scenes":64`) |
| Entities per scene (authoring) | 32 | `model.ts:170` (`entities.length>32` refuses) |
| Text layers per scene | 16 | `model.ts:170` |
| Automation lanes per scene | 64 | `model.ts:170` |
| Sequence steps per entity | 32 | `model.ts:175`; `formationAuthoring.ts:8` |
| Kernel document members | 2048 entities / 2048 relations | `kernel/expression.rs:15` (`DOCUMENT_MEMBERS`), also `kernelDocumentBridge.ts:215` |
| Renderer window per page | 64 formations / 64 pins | cradle engine `src/engine/fieldModel.ts:41-42`; disclosed by kernel `expression.rs:914` |
| Legacy PCD renderer budget | 10 formations / 8 pins | `Work/Point-Cloud-Demo/src/engine/fieldModel.ts:37-38` |

The 10/8 ceiling still binds the PCD tree and the audit recorded it as PCD #6;
the cradle's vendored engine has already raised it to 64/64, and
`kernelDocumentBridge.ts:191` (`PAGE_ENTITY_LIMIT=32`) plus the disclosure
pages (`pagesFor`, `kernelDocumentBridge.ts:192-201`) split over-budget
native Scenes into pages rather than refusing them. Confidence: high (read
this session).

## 3. What editing operations exist today

All in `field-studies-journeys/src/app.ts` unless noted.

- **Tools**: `select|interact|pin|formation|text|orbit` (`model.ts:16`); rail
  switching (`app.ts:292`).
- **Entity transform**: pointer drag (drag state machine covers
  `entity|radius|camera|text`, `app.ts:113`); arrow-key nudge of selection,
  shift ×10 (`app.ts:749`); rotate/refit via state sizing
  (`stateSizing.ts` refit* helpers, imported `app.ts:9`).
- **Scene addressing**: `setScene(index:number)` — **index-addressed, not
  id-addressed** (`app.ts:300`); playhead input walks cumulative durations to
  derive an index (`app.ts:710`); choose-scene by DOM `data-index`
  (`app.ts:574`); arrow Left/Right switch scenes (`app.ts:749`).
- **Journey playback**: scene play + journey play flags; the auto-advance
  clock accumulates `sceneElapsed` and advances via `savedSceneIndices`
  order (`app.ts:844`); transition crossfade canvas with the engine's easing
  (`actTransition`, `app.ts:75-82`).
- **Scene workflow** (`sceneWorkflow.ts`): save named snapshot into
  `savedScenes` (`saveScene` :12), duplicate-into-next (`nextSceneFrom` :16),
  restore snapshot (`restoreScene` :22), Draft/Saved/Edited-since-save state
  (`sceneSaveState` :8), numeric diff walk between snapshot and working
  (`sceneParameterChanges` :27).
- **Formation states**: append a state to an unlocked formation's sequence
  (`formationAuthoring.ts:6-18`, ≤32 states); fold a scene's object state
  into an earlier formation's sequence ("fold-state", `app.ts:634`).
- **Layouts**: `arrange()` — line/column/ring/spiral/grid/align-/distribute-/
  laminate on a chosen plane (`timeline.ts:24-33`); focus-route reorder of
  formations (`reorderFocus`, `timeline.ts:37-41`).
- **Automation**: LFO/one-shot groups with typed targets, blends
  (replace/add/multiply), waves incl. morph drive (`model.ts:43`;
  `automationEditor.ts:8-9`; groups in `automationLinks.ts`).
- **Property tracks**: keyframe tracks bound to whitelisted paths
  (`field.params.*`, `entity.position/scale/tintWeight/force/sequence.*`,
  `propertyTracks.ts:4`), up to 2048 tracks × 72000 points (`:5`);
  **linear interpolation only** (`valueAt`, `propertyTracks.ts:6`); takes
  recorded live with punch windows and merged by `mergeTake` (`:9`);
  journey-level timing = sum of scene durations (`expressionTiming`, `:10`).
- **Capture**: PNG/video capture incl. live recorder
  (`capture.ts` LiveRecorder, imported `app.ts:44`).
- **Snap**: a single `camera.snap` toggle plus `guidesVisible`
  (`app.ts:527`, `:525`; guides SVG `drawGuides` `app.ts:810`). No snap-point
  model, no candidate ranking, no next/previous-snap navigation.

**What is missing against a real scene editor** (each maps to a target in
`TARGET-SET.md`): the only journey-timeline surface is a thumbnail scene
strip plus a bare `<input type=range>` playhead (`renderTimeline`,
`app.ts:221` — no time-proportional track); adjacent scene reorder and
delete exist but are button-driven and app-local (`reorderScene`
`app.ts:468`, `move-scene-left/right` `app.ts:617`, `delete-scene`
`app.ts:616` with confirm+undo) — no free drag reorder, no cut/split, no
trim/ripple/roll/slip/slide semantics; no typed transitions (one
number, `transition`, and one hard-coded crossfade style); no curve editor
(linear-only tracks); no markers; no in/out loop regions (except the
scene-level `propertyTakeRange`); no bins beyond the Library; no
id-addressed scene operations; undo is opaque full-document snapshots with
no labels and no kernel receipts; no user-visible preview-quality tiers
(service-throttled only, `app.ts:120`).

## 4. How documents save today (the actual seams)

Four layers, bottom-up:

1. **Session state + drafts (renderer-local).** `recovery.ts`: IndexedDB
   database `oi.expression-recovery` (stores `drafts`, `nativeWorking`;
   `recovery.ts:12-25`) with a localStorage fallback for opaque origins
   (`:26-51`). `writeDraft`/`readDraft` go through the **native recovery
   owner** when hosted (`recovery.ts:52-55`) — never a silent browser-copy
   fallback after a native failure (`kernelExpressions.ts:71-81`).
2. **Autosave debounce.** `flushDraft` (`app.ts:140-167`): debounced 350 ms
   (`app.ts:144,172`), writes the validated journey to the draft owner;
   additionally backs the draft up into browser localStorage *library*
   (`saveToLibrary`) at most once per 5 s (`app.ts:159`). Storage failure is
   surfaced, not swallowed (`app.ts:163-167`).
3. **Standalone library.** `store.ts:2` `STORAGE_KEY=
   'oi.field-studies.journey-library.v1'`; `saveToLibrary` re-validates every
   retained entry and keeps unreadable/newer documents verbatim
   (`store.ts:29-35`) — no atomicity: it is one `localStorage.setItem` of the
   whole JSON array (`store.ts:34`).
4. **The kernel (authority).** The hosted frame reaches the kernel through
   the cradle relay `relayKernelChannel`
   (`desktop/cradle/src/expressions/hostedApp.ts:238`) over the pinned
   envelope (`{v:1,kind,req}`, `kernelExpressions.ts:6-19`). The frame's
   operation whitelist: `profile_define, profile_inspect, list, inspect,
   create, edit, open, open_file, save_as, save, export, fork, index, close`
   (`hostedApp.ts:219`) — note `propose`/`review`/`restore` are NOT framed.
   Save = diff the edited document against the kernel's current document
   (`documentToChanges`, `kernelExpressions.ts:152-232`), then `edit` with
   `expected_revision`; a `revision_conflict` reply is surfaced, never
   force-written (`saveKernelExpression`, `kernelExpressions.ts:238-249`).
   Differences this cut cannot express are **named refusals** (retitle,
   scene removal, parameter removal, automation edits, subject edits —
   `kernelExpressions.ts:156-204`).

**The gap that matters:** the kernel's own Change grammar is far richer than
what the app's diff expresses. The kernel accepts (cradle type
`expression/types.ts:39-72`): `rename`, `scene_rename`, `scene_remove`,
`scene_reorder`, `scene_create/compose/material_set/material_clear`,
`entity_add/remove`, `parameter_set/automate/manual`, `subject_bind/unbind`,
`relation_bind/remove`, `representation_bind`, `focus`, `relation_focus`,
blueprint bind/transform/release, `scene_body_set/clear`,
`scene_trigger_attach/detach`, `profile_adopt/release`, `collections_set`,
`reuse_set/clear`. The kernel also carries document-level ops the frame
never calls: `fork`, `propose`, `review`, `restore`, `save`/`save_as` with
`expected_file_revision` (`types.ts:73-98`). The editor-side cost: operations
the kernel could receipt exactly (a reorder, a rename, a scene removal) are
either unavailable in the UI or refused as "not expressible in this cut".
Undo is app-local full-document clones (`store.ts:7-18`), so **kernel-side
act history and renderer undo are two unrelated mechanisms**.

## 5. Navigation and subject identity today

- **Occurrence bindings are the identity spine.** Opening a kernel document
  converts it into a working journey view while recording, per scene,
  `OccurrenceBinding {expression_ref, scene_ref, entity_ref, view_entity_id,
  subject}` (`kernelDocumentBridge.ts:116,247`). View ids are reversible
  labels, never native ids; collisions are refused, not merged (`:134-151`).
- **Writes preserve construction identity.** `kernelViewToChanges`
  (`:259-289`) refuses when the entity list of a scene changed ("Use native
  membership/Scene operations to change the construction; hide is not
  delete") and proposes parameter edits keyed by the *native* entity_ref.
- **Wiki→Expression projection** (`desktop/cradle/src/techne/wikiExpression.ts`):
  a register's wiki projects deterministically into an `oi.expression/v1`
  document whose every entity carries an exact `subject_ref` binding with
  `sources`/`readings` revision refs (`wikiExpression.ts:383-399,424-461`);
  relations exist only where the kernel's relations read returned them
  (`:486-514`); one projection state, many apertures
  (`wikiProjectionStore.ts:1-30`).
- **Relations from the field**: constellation relations record through the
  owner (`aikit.constellation.apply`), receipts kept separate from
  expression saves (`desktop/cradle/src/techne/sceneConstellationRelation.ts:2-19`);
  the frame's `techne-constellation` channel returns a receipt whose
  expression state may be `pending`
  (`kernelExpressions.ts:302-304`).
- **Deep links**: `?expression=<id>` hosted deep link and the app's own
  `?journey`/`?scene` idiom (`expressions-app/README.md:74-78`);
  `jumpToScene(sceneRef)` resolves a native scene_ref through the view's
  bindings and then `setScene(index)` (`app.ts:1055`).

What is missing: the bindings exist but the editor gives almost no
navigation affordance on top of them — no "reveal source/subject" jump from
an entity occurrence, no back-references ("where is this subject on
stage"), and addressing inside the app remains index-based (§3), so deep
links re-derive positions instead of addressing scenes directly.

## 6. Known engine defects (PCD #6, from the expression audit) — status

From `campaign-evidence/2026-10-07-expression-audit/FINDINGS.md`:

| Defect (audit) | First-hand status in the cradle this session |
|---|---|
| Authoring ceiling ≤10 formations / ≤8 pins | **Raised in the cradle engine**: `src/engine/fieldModel.ts:41-42` = 64/64; PCD still 10/8 (`Work/Point-Cloud-Demo/src/engine/fieldModel.ts:37-38`). App-level bound now 32 entities/scene (`model.ts:170`) and page budget 32 (`kernelDocumentBridge.ts:191`). |
| `setScene` takes index, not id | **Confirmed** in the app: `app.ts:300`. Site wrapper passes sceneId to a sceneMap-aware host call (`site/src/expression/ExpressionApp.tsx:193`), but the app's own address and its `__FIELD_STUDIES__.setScene` disclosure are index-typed (`app.ts:963`). |
| Auto-advance clock | **Confirmed**: scene-elapsed accumulator advances scenes on a per-scene `duration` (`app.ts:844`); no transport model (no loop regions, no global time base) beyond it. |
| Striped text rendering | **Not independently reproduced this lane.** Carried as audit-recorded (the audit rendered the live corpus and looked). Confidence in the defect: medium-high (audit evidence), origin not re-verified. |
| frequency<1 silent rejection | **Not independently reproduced this lane.** The cradle's cymatic path derives modes from `frequencyHz/baseFrequency` with a floor of 2 on the mode target (`src/engine/cymatics.ts:8-9`); where a sub-1 template frequency is silently refused was not located. Carried as audit-recorded; unverified here. |

## 7. The audit's craft floor is a direct input

`campaign-evidence/2026-10-07-expression-audit/FINDINGS.md` §"What good asks
for instead" (text by exception; stillness lawful; a colour journey; glyph
law; render-verified composition; the critic's visual pass as primary gate;
restore the symbolic basis) and §"Reader experience" (fullscreen
`requestFullscreen`, focus mode, scene list into the field rail) are carried
into `TARGET-SET.md` as gating acceptance shapes — target sets name
craft-quality bars, never compliance checklists (PROGRAMME.md:19-25).

## What stayed unverified (named)

- No live kernel or desktop-host run in this lane: every claim about save
  and receipts is static reading of code, high confidence for shapes,
  unverified end-to-end behavior.
- `striped text rendering` and `frequency<1` defects: audit-recorded, not
  reproduced here (§6).
- The DaVinci Resolve Reference Manual is publicly served
  (documents.blackmagicdesign.com, DaVinci_Resolve_19_Reference_Manual.pdf,
  185,768,574 bytes, HTTP-verified accessible) but was **not downloaded or
  read** in this lane; no Resolve-specific behavior claim below rests on it.
- Undo/act-history behavior of the running kernel (act store eviction,
  receipt contents) is unread beyond `expression_act_store.rs` structure.
- Engine render behavior under the raised 64/64 budget (frame cost) is
  unmeasured.
