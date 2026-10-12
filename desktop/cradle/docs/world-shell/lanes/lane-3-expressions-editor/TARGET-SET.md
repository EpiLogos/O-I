# Lane 3 target set — the expressions editing model

**Standing:** owner deliverable of the Technè instruments parity programme
(`../PROGRAMME.md`), lane 3 (the 3:3 Expressions editor). Commission: "3
already works for expressions but in general expressions editing wants to
attain to the quality of a real video/scene editing tool." Lane 5
(journey/palace) consumes this set as a recorded dependency; the closing
section names the shared core interface it consumes.

**Scope:** the **editing model** — how a journey is addressed, cut, timed,
keyframed, saved, undone and navigated. Not the render engine: the cradle's
engine is its own (`expressions-app/src/engine/`, vendored of record) and
stays so. Shell questions (Ableton etc.) are another lane's subject.

**Inputs this set stands on:**

- `../lane-3-expressions-editor/FINDINGS.md` — current state, file:line
  evidence, verified this session (corrections applied where thin).
- `../lane-3-expressions-editor/RE-TARGETS.md` — possession record; study
  basis: Kdenlive timeline2, Blender VSE, Olive, libopenshot, Shotcut/MLT
  source checkouts in `/tmp/techne-lane3-re/` (read-only, scratch outside
  product trees); DaVinci Resolve = documentation-only possession (not
  installed; manual freely published, not downloaded — limitation recorded).
- `../../2026-10-07-expression-audit/FINDINGS.md` — the craft floor
  (§"What good asks for instead") and the reader-experience floor
  (§"Reader experience"), carried below as **craft gates**; plus the named
  engine defects (PCD #6 and friends — status per FINDINGS §6).
- `../../2026-10-07-obsidian-re/recreation-backlog.md` — A1 save-schedule
  precedent (T2) and the D-1 write-atomicity decision point.

**The one architectural law every entry honors:** a mutation of standing
document state lands as kernel operations with receipts — no second
semantic store, no second write path (PROGRAMME.md guardrails). The kernel
already has the hard part: durable, atomic, replayable act records
(`oi.expression-act/v1`; `kernel/src/expression_act_store.rs:1-33` —
temp+fsync+rename, compare-and-set revisions, archive-never-delete). The
editor's job is to **use** it, not to fork it.

## The honest mapping (editing model → oi.expression/v1)

Worked out from FINDINGS evidence; every target below phrases its landing
against these rows.

| Editing-model concept | What oi.expression/v1 / oi.journey already holds | Evidence |
|---|---|---|
| Master sequence (timeline) | The Expression document's `scenes[]`, journey-level presentation `oi.journey-properties/v1` (description, loop, shared) | `kernelDocumentBridge.ts:114,251` |
| Time base | Σ of scene `duration` (1–3600 s each) — no independent global time object | `propertyTracks.ts:10` (`expressionTiming`) |
| Clip / strip | A `Scene`: content identity = `scene_ref` (kernel) with app view label `Scene.id`; timeline facts today = array order + `duration` + `transition` (0–30 s); everything else is content travelling whole through `scene_material_set` (`oi.journey-scene/v1` envelope) | `kernelExpressions.ts:133-136`; `model.ts:158-160` |
| Media / source | `SubjectBinding` per entity (`subject_ref`, `sources`, `readings`) — scene members are occurrences of native subjects, never copies | `kernelDocumentBridge.ts:116,247`; `wikiExpression.ts:383-399` |
| Keyframe channels | `propertyTracks` per Scene: `{bind, entityId, points[]}`, whitelisted address paths, 2048 tracks × 72000 points, **linear interpolation only** | `propertyTracks.ts:3-6` |
| Automation | Kernel `parameter_automate` (LFO) on entity parameters; app-side `AutomationLane` groups | `expression/types.ts:60`; `model.ts:43` |
| Transition | `Scene.transition` (seconds) + one hard-coded crossfade with chain-easing set | `app.ts:76-82` (`actTransition`) |
| Edit command / undo unit | Kernel `Change[]` under `edit {expected_revision}` → revision reply; durable act receipts (`oi.expression-act/v1`) exist beneath it | `expression/types.ts:39-72`; `expression_act_store.rs:1-33` |
| Nesting | Kernel reuse register (`reuse_set`/`reuse_clear`, budgets disclosed) — data-only today, no editor surface | `expression/types.ts:69-70`; `expression.rs:910` |
| Markers | **Nothing yet** — named honestly; needs a journey-presentation field (target E12 names the choice) | — |
| Bins / organisation | Kernel `collections_set` change — exists, no UI | `expression/types.ts:70` |
| Selection / playhead state | Document `selection {scene_ref, entity_ref}` + kernel `focus` change | `expression/types.ts:36,57` |

Consequence of rows 4, 8 and 12: **most "video-editor" operations are
already kernel-expressible at scene granularity** — reorder, remove,
create, retime (duration/transition ride the presentation envelope), focus.
What is missing is (a) the editor surface that performs them as cuts and
trims, (b) undo that consumes kernel receipts, (c) the few genuinely new
kernel surfaces (markers; typed transitions as presentation, if kept
outside the envelope; nested-occurrence placement over reuse). Targets
name which of the three they are.

## Craft gates (binding on every entry)

From the audit floor; these are quality bars, not a checklist
(PROGRAMME.md:19-25). A target's acceptance evidence is **not complete**
without its rendered look.

- **G1 Text by exception** — authoring tools make it easy to leave the
  stage bare; metadata (citations, paths, routing) has no authoring path
  onto the stage at all.
- **G2 Stillness lawful** — nothing in the editing model forces change;
  a still scene is a first-class citizen (targets E04/E13 make it
  literal).
- **G3 Colour journey** — backgrounds/palettes are reachable as
  keyframed, sequenceable material (channel model covers them).
- **G4 Glyph law** — the shape/source carriers (`ascii`, `image`,
  `yantra`, geometry) are as reachable as text in every authoring
  surface this set touches.
- **G5 Render-verified composition** — claims about what the stage shows
  are verified by screenshot box-math against the render, never
  self-reported JSON.
- **G6 The visual pass is the primary gate** — each entry's acceptance
  names its screenshot(s); the linter stays plumbing.
- **G7 Fullscreen and focus** — the reading surfaces this editing model
  feeds gain real fullscreen (`requestFullscreen`) and a chromeless
  focus mode (target E23).

## Targets

Twenty-six entries, E01–E26, in eight families. Each entry: what it does,
the reference behavior it attains (evidence = the `/tmp/techne-lane3-re/`
checkouts, pinned per RE-TARGETS §Version note), the honest mapping onto
`oi.expression/v1`, the landing seam in the cradle, the
UI-harmonisation note, and a verifiable acceptance shape.

### Family T — sequence / timeline model

- **E01 The journey timeline surface.** A time-proportional track for the
  whole expression: one clip per scene, width ∝ `duration`, the playhead
  running on global time, the scene strip (`renderTimeline`,
  `app.ts:221`) becoming its collapsed form.
  *Reference behavior:* every surveyed editor renders clips on a
  time-proportional track over a global clock — Blender's sequencer
  channels (`DNA_sequence_types.h:360-476`), Kdenlive's
  `TimelineModel`/track/clip composition (`timelinemodel.hpp:41-52`).
  *Mapping:* the track is the document's `scenes[]`; clip extents derive
  from `expressionTiming` — no new time object is invented (Σ durations
  stays the law; a global time base would be a second clock).
  *Landing seam:* replace the timeline panel body in
  `field-studies-journeys/src/app.ts` (`renderTimeline` `:221`); playhead
  keeps its id (`expression-playhead`) so `app.ts:849`'s UI tick is
  untouched; edit gestures route through `store.change`.
  *UI harmonisation:* same rail language as the existing strip
  (thumbnails, save-state dots); keyboard: Space = play/pause (existing),
  Left/Right = step; the panel remains collapsible to today's strip.
  *Acceptance:* screenshot of a 5-scene expression with visibly unequal
  clip widths matching durations (G6); playhead at global t maps to the
  same scene+local-time that `expressionTiming` reports (property assert);
  drag on a clip edge is E05.
- **E02 Scene-as-clip: content vs timeline coordinates.** Adopt the
  strip discipline: a Scene's **content identity** (`scene_ref`) is
  stable under every timeline move; its **timeline facts** (order,
  `duration`, `transition`) are mutable addressable state. Editing acts
  never mutate content to move a clip.
  *Reference behavior:* Blender `Strip` carries `start`/`len` with
  `startofs/endofs` handles and `anim_startofs/endofs` media trim
  separated from content (`DNA_sequence_types.h:360-476`); Kdenlive ids
  "have nothing to do with Melt IDs" — model ids stable under all moves
  (`timelinemodel.hpp:44-46`).
  *Mapping:* `scene_ref` ≈ content id; `scenes[]` order ≈ `start`;
  `duration` ≈ `len`. The Scene's living field is the "media" — it has
  no intrinsic length, so no media-trim handles exist (honest divergence:
  a scene shows its whole content; what trims is when it yields the
  stage).
  *Landing seam:* model-level invariant in `model.ts`/`sceneWorkflow.ts`
  (timeline ops reorder/retime but never touch content fields);
  kernel-side `scene_reorder` already carries `scene_refs` — identity is
  preserved by construction (`expression/types.ts:52`).
  *UI harmonisation:* clip chrome (name, save-state dot) persists across
  moves — visual continuity of identity.
  *Acceptance:* property test — after reorder/retime/split sequences,
  every surviving `scene_ref` maps to a scene whose field/entities
  digest equals its pre-move digest; one screenshot showing a moved clip
  retaining its thumbnail and dot (G6).
- **E03 Ref-addressed scene operations.** `setScene(scene_ref)` — the
  index becomes a derived view, never the address. Kills the audit's
  `setScene`-takes-index defect (PCD #6's second row; FINDINGS §6).
  *Reference behavior:* Kdenlive: every interaction addresses model ids,
  not positions (`timelinemodel.hpp:44-52`); Blender RNA paths name
  strips, not slots.
  *Mapping:* `scene_ref` is the kernel's own address (`selection.scene_ref`,
  `scene_reorder`); the app's `Scene.id` view labels already map 1:1
  through `SceneBinding` (`kernelDocumentBridge.ts:117,247`).
  *Landing seam:* `app.ts:300` (`setScene(index)` → overload accepting
  ref with index resolved internally); the `__FIELD_STUDIES__.setScene`
  disclosure (`app.ts:963`) becomes ref-typed (index accepted for
  compatibility, announced); `jumpToScene` (`app.ts:1055`) loses its
  index re-derivation; site host already passes sceneId + sceneMap
  (`site/src/expression/ExpressionApp.tsx:193-198`) — align the
  disclosure to it.
  *UI harmonisation:* none visible — purely addressal.
  *Acceptance:* scripted: reorder scenes, then `setScene(<ref of scene
  now in another position>)` opens the right scene; `?scene=<ref>` deep
  link opens by ref on the site page and in the app (see E22).
- **E04 Insert vs overwrite move semantics; gaps are still scenes.** The
  array is the ripple law: scenes are contiguous, so "ripple" =
  insert/remove shifting successors, and "overwrite" = replace in place.
  A timed void is authored as a **still scene**, not a null gap — the
  audit's stillness floor made literal in the data model (G2).
  *Reference behavior:* Kdenlive `requestClipMove` with group/ripple
  semantics and ripple resize (`timelinecontroller.h:662-665`);
  Blender's explicit gap removal as a separate act
  (`SEQ_edit.hh:69-80`) — oi.journey's contiguous array is the honest
  simplification (a scene is always "there"), so gap tools are not
  ported; instead a **slate/still scene starter** exists.
  *Mapping:* insert = `scene_create` + `scene_reorder`; overwrite =
  `scene_remove` + `scene_create` composite; still scene = `scene_create`
  with a quiet presentation (low count, no automation — authoring starter,
  not a new kind).
  *Landing seam:* `reorderScene` (`app.ts:468`) generalises to the two
  move modes; scene-add menu gains the still-scene starter.
  *UI harmonisation:* drag affordance shows insert edge (line) vs
  overwrite (highlight) — same visual grammar as the entity drag ghost.
  *Acceptance:* insert between scenes 2/3 leaves 1-2 **A** 3-4 →
  1-2-A-3-4 with durations summing identically (receipt: `scene_reorder`
  listing all `scene_refs`); still scene plays as deliberate stillness
  (G2 screenshot), not a dropped frame rate.

### Family R — trim / roll / slip / slide at scene granularity

- **E05 Trim: duration edge drag.** Pointer drag on a clip's edge changes
  that scene's `duration` (1–3600 s, validated) with a live preview and
  one undo entry.
  *Reference behavior:* Kdenlive `requestItemResize` returns
  success/failure and logs undo (`timelinemodel.hpp:638-641`); Olive's
  two trim directions (`set_length_and_media_out/in`,
  `block.h:63-64`) — mapping keeps only the timeline-length direction
  (the scene has no media out to trim; see E02's honest divergence).
  *Mapping:* `duration` rides the `scene_material_set` presentation
  envelope — kernel-expressible today, no new Change kind.
  *Landing seam:* new hit-zone in the E01 timeline; commits via
  `store.change` + kernel save path (`kernelExpressions.ts:238-249`).
  *UI harmonisation:* edge handles adopt the existing inspector's
  numeric input as their tooltip; hold for exact value entry.
  *Acceptance:* drag edge → receipt `scene_material_set` on exactly that
  `scene_ref`, revision+1; undo restores prior duration and receipt
  (E15); clamp at 1 s/3600 s surfaced as named refusal, not silent snap.
- **E06 Roll / slip / slide at the seam.** The standard four trim moves,
  honestly mapped: **roll** moves the boundary between two adjacent
  scenes (left duration +, right duration −, sum conserved; the crossfade
  shares the seam); **slide** moves a scene between fixed neighbours
  (pure reorder); **slip** changes where a scene *enters its own
  evolution* — an entry offset into the scene's sequence/track time.
  *Reference behavior:* the trimming-mode vocabulary
  (`timelinecontroller.h:656-722`: `slipProcessSelection`,
  `requestStartTrimmingMode`, `requestItemRippleResize`).
  *Mapping:* roll = two `scene_material_set`s (composite, E16); slide =
  `scene_reorder`; slip = a per-scene `entryOffset` presentation field —
  **new surface**, smallest honest shape: a Scene-level number clamped to
  [0, duration), evaluated by track/sequence evaluation as a time shift.
  Marked as the family's one kernel-side addition (a presentation field,
  not a new Change kind — it travels inside the envelope).
  *Landing seam:* E01 timeline gestures; slip field in
  `model.ts` Scene + evaluation in `propertyTracks.evaluateTracks` /
  sequence clock.
  *UI harmonisation:* one gesture grammar for all four (edge = trim,
  boundary = roll, body-drag with Alt = slip, body-drag = slide/move)
  shown in a single hint line; consistent with existing modifier law
  (shift = ×10 nudge, `app.ts:749`).
  *Acceptance:* roll conserves Σ durations exactly (property assert);
  slip renders identically on both sides of a mid-scene slip (two
  screenshots, G5/G6); each gesture = exactly one undo entry (E15/E16).
- **E07 Split scene at the playhead.** Cut one scene into two at global
  time t: left keeps content with tracks/sequence split at local time,
  right gets the same content re-based; durations sum to the original;
  crossfade between them defaults to 0 (a true cut) — author's choice.
  *Reference behavior:* Blender `SEQ_edit.hh` split with SOFT/HOLD
  methods (`SEQ_edit.hh:49-67`); Shotcut `SplitCommand` as one named
  undo unit (`timelinecommands.h:484`).
  *Mapping:* atomic composite over existing grammar: `scene_create` (new
  ref) + two `scene_material_set`s + `scene_reorder` — expressible
  **today**; must be receipted as ONE composite (E16), never three
  floating edits.
  *Landing seam:* new op beside `reorderScene` (`app.ts:468`); splitting
  walks `propertyTracks` points (points at < t stay, ≥ t re-based) and
  entity sequences (step boundary chosen at or before t — a sequence step
  is atomic; named limitation).
  *UI harmonisation:* the playhead gains the universal split affordance
  (blade icon in the timeline's tool row); key S.
  *Acceptance:* track value evaluated at t−ε on the left scene equals
  evaluation at the right scene's local ε (continuity assert; golden
  values per E08); one undo restores the unsplit scene and its ref
  disappears from the kernel document (receipt chain visible).

### Family K — keyframe channels and curves

- **E08 Interpolation types on property tracks.** Per-keyframe-pair
  interpolation beyond linear: `hold` (constant), `smooth` (smoothstep),
  `bezier` (with E09 handles); absent type = linear (byte-compatible with
  every existing document).
  *Reference behavior:* Olive `kLinear|kHold|kBezier`
  (`app/node/keyframe.h:46-48`); libopenshot
  `BEZIER|LINEAR|CONSTANT` + AUTO/MANUAL handles (`src/Point.h:29-43`);
  benchmark evidence that keyframe curves are callable at frame rate
  (`doc/JSON-KEYFRAME-BENCHMARK.md`).
  *Mapping:* `PropertyTrack.points` gains an optional per-point type +
  control points; tracks travel whole inside the scene presentation
  envelope, so this is app-model + validation only — the kernel stores
  the envelope verbatim (`kernelExpressions.ts:133-136`).
  *Landing seam:* `propertyTracks.ts:6` (`valueAt`) gains the
  interpolators; `validateTracks` (`:5`) validates types/monotonic time
  (existing law kept).
  *UI harmonisation:* curve lanes render in the E01 timeline's channel
  area with the stage's own palette discipline (G3: tint curves visibly
  move colour).
  *Acceptance:* golden-value tests — linear equals today's `valueAt`
  bit-for-bit on legacy data; hold/step, smoothstep and a canonical
  bezier evaluated at fixed samples; a rendered colour-journey scene
  (G3, G6) whose background/palette ride bezier tracks.
- **E09 Curve editor with validated handles.** Select a channel → edit
  keyframes and bezier handles in the timeline's channel lane; invalid
  handles (non-monotonic time, out-of-value-range) refused with named
  errors, matching the existing track-validation law.
  *Reference behavior:* Olive validates bezier control points and
  exposes typed accessors (`keyframe.h:104-121`); Kdenlive's
  request/return-success pattern for every gesture
  (`timelinemodel.hpp:46-52`).
  *Mapping:* same as E08 — envelope-carried.
  *Landing seam:* channel lane in E01; drag commits through
  `store.change` (one entry per finished drag — existing
  transaction law, `store.ts:12-16`).
  *UI harmonisation:* handle visuals reuse the guides/SVG grammar
  (`drawGuides`, `app.ts:810`); snapping to keyframes uses E25's model.
  *Acceptance:* drag a handle → smooth render change (screen capture,
  G6); a malformed handle (dragging time backwards) is refused with the
  named validation message; undo restores the curve exactly.
- **E10 Channel discipline.** Per-channel solo/mute/visibility over the
  existing addressable-path law — the whitelist
  (`field.params.*`, `entity.position/scale/tintWeight/force/sequence.*`,
  `propertyTracks.ts:4`) is **kept**: solo/mute are evaluation-time
  state, never new address space.
  *Reference behavior:* Kdenlive `GroupsModel` (selection acts on
  related members coherently, `groupsmodel.hpp:18-24`) as the model for
  grouping; standard channel-solo semantics of every NLE.
  *Mapping:* presentation-only state in the working view (not yet a
  kernel field); honest note: solo/mute do not travel in saved documents
  until the owner commissions that — drafts may keep them
  (renderer-local, like camera snap).
  *Landing seam:* `evaluateTracks` (`propertyTracks.ts:8`) filters by
  channel state; channel list UI feeds from existing tracks.
  *UI harmonisation:* channel rows adopt the automation lane row
  language already in the app (`automationEditor.ts`).
  *Acceptance:* soloing one colour channel while others animate → only
  it moves (paired screenshots, G5); saved draft omits solo/mute state;
  reload changes nothing about document contents (digest equal).

### Family X — transitions

- **E11 Typed, parameterised transitions.** The single hard-coded
  crossfade (`actTransition`, `app.ts:76-82`) becomes a typed transition
  per seam: `cut`, `crossfade`, `dip-to-colour` (through the scene's own
  background — the colour journey made structural, G3), `wipe` — each
  with the seam's existing `transition` duration and, for dip/wipe, a
  small parameter set. The chain-easing set already validated
  (`smoothstep|linear|kineticSnap|whip`, `app.ts:82`) stays the easing
  vocabulary.
  *Reference behavior:* MLT's service ontology treats a transition as a
  first-class attached service with properties
  (`mlt/src/framework/mlt_types.h:292`, `mlt.h:53-69`); Kdenlive
  compositions are model objects with their own move/insert requests
  (`requestCompositionMove`, `timelinemodel.hpp:463-465`).
  *Mapping:* a per-scene `transitionKind` + params inside the scene
  presentation envelope (travel whole via `scene_material_set`) — no new
  Change kind; the number `transition` stays the duration.
  *Landing seam:* `actTransition` (`app.ts:76-82`) and the
  `setScene` crossfade path (`app.ts:301`) gain the type switch; the
  capture recorder must honour it (it already frames transitions,
  `app.ts:849`).
  *UI harmonisation:* transition type chosen from the timeline seam
  gutter (small glyph between clips — same icon language as the tool
  rail); inspector shows the same control with numeric params.
  *Acceptance:* four named screenshots (one per type, G6) at mid-
  transition; dip-to-colour lands exactly on `field.background` (pixel
  check, G5); capture of a transition renders the same type.

### Family M — time navigation: markers and regions

- **E12 Journey markers.** Named, coloured time points on the sequence:
  create at playhead, rename, move, jump next/previous; markers are
  authoring/navigation furniture — never stage content (G1: metadata
  stays off the stage).
  *Reference behavior:* Kdenlive guide/marker models with snap
  integration (`snapmodel.hpp` feeds guides); Shotcut `MarkersModel`
  with ripple options (`timelinecommands.h:104-138`).
  *Mapping:* **the set's one genuinely new kernel surface**, named
  honestly: either (a) a `markers` field on the journey-level
  presentation (`oi.journey-properties/v1`, already the carrier for
  description/loop/shared — `kernelDocumentBridge.ts:251`), travelling
  through `scene_material_set`-style whole-envelope writes, or (b) a new
  `marker_set` Change kind. Recommendation: (a) first (no grammar
  change), promote to (b) if marker edits need their own receipts.
  Owner-decision flag on (b).
  *Landing seam:* marker store in the journey presentation; UI in the
  E01 ruler; `?marker=<ref>` deep link (E22).
  *UI harmonisation:* marker glyphs reuse the guide colour discipline;
  marker list lives in the existing timeline panel, not a new surface.
  *Acceptance:* create/rename/move each produce a visible receipt (or
  the documented envelope-write) and one undo; next/prev jumps land
  exactly (playhead assert); markers never render on the stage (G1).
- **E13 In/out loop regions.** Transport plays/loops between an in and
  out point; the journey `loop` flag remains the whole-journal case.
  A region looping over a still scene is a lawful reading mode (G2 —
  stillness is authored, and repeatable).
  *Reference behavior:* universal NLE in/out + loop; Kdenlive zone
  handling in guides; the existing `automationLoop` pattern
  (`app.ts:118-120`) shows the app's loop idiom.
  *Mapping:* in/out are presentation-level working state (like markers,
  E12 option (a)); `loop` stays kernel-carried.
  *Landing seam:* transport section of the timeline (E01);
  `sceneElapsed`/`journeyPlaying` clock (`app.ts:844`) honours the
  region bounds.
  *UI harmonisation:* region bracket renders in the timeline ruler;
  keyboard: I/O set/clear, matching the app's single-key law.
  *Acceptance:* play with region [a,b) wraps exactly at b→a (clock
  assert); loop over a still scene renders a held frame with no churn
  (G2 screenshot); clearing the region restores whole-journey behavior.

### Family N — nesting

- **E14 Nested expression occurrence.** Place another expression into a
  scene as a bounded occurrence (the meta-strip / nested-sequence move):
  it plays inside the host scene's timing and stays addressable by its
  own `expression_ref`.
  *Reference behavior:* Blender meta-strips are real nesting — a
  `seqbase` list inside a strip (`DNA_sequence_types.h:420`), editable
  in place or opened solo.
  *Mapping:* the kernel already holds the substrate: the **reuse
  register** (`reuse_set`/`reuse_clear`, `expression/types.ts:69-70`;
  disclosed budgets `expression.rs:910`). The target is the editor
  affordance over it: place/resize/remove a reuse occurrence, and the
  renderer evaluating it within the host scene's budget (pages/limits
  per `kernelDocumentBridge.ts:185-201` discipline — a nested field must
  respect the resident renderer budget, refusing honestly if over).
  *Landing seam:* scene-add menu gains "place expression…"; kernel
  round-trips the `reuse_set` change.
  *UI harmonisation:* nested occurrences get a distinct clip/entity
  sheen (same visual family as native-scene badges).
  *Acceptance:* a nested expression placed in a host scene plays within
  host duration (screen capture, G6); its `expression_ref` appears in
  the kernel document's reuse record; removing it receipts
  `reuse_clear` and restores budget.

### Family U — undo / redo as kernel receipts

- **E15 Labelled undo/redo converging with kernel act history.** Undo
  stops being anonymous full-document clones (`store.ts:7-18`, cap 60,
  no labels): each undo entry carries the operation name and the kernel
  changes it produced; undo/redo at or above the last kernel save
  re-issues **compensating kernel changes** (the same grammar, inverted)
  so the kernel revision history and the editor's undo stack describe
  the same work.
  *Reference behavior:* Kdenlive's design law — every elementary change
  writes its own inverse as it executes; composites get undo/redo pairs
  for free and a failing step cancels what was done
  (`timelinemodel.hpp:49-52`); Shotcut's named QUndoCommands
  (`MoveClipCommand` `timelinecommands.h:319`, `SplitCommand` `:484`).
  *Mapping:* the kernel side already receipts: `edit` carries
  `expected_revision` and returns the new revision
  (`kernelExpressions.ts:244-247`); durable act records exist
  (`oi.expression-act/v1`, `expression_act_store.rs:1-33` — replayable,
  archived, never deleted). The editor attaches the change list to each
  undo entry and, when the document is kernel-hosted, derives the
  compensating change set from it (parameter_set for value flips,
  scene_reorder for moves, and so on — the grammar is invertible for
  everything the app emits after E20).
  *Landing seam:* `store.ts` entries gain `{label, changes?}`; save
  path (`kernelExpressions.ts:238-249`) records which entries are
  kernel-clean.
  *UI harmonisation:* undo labels appear in the existing undo affordance
  (and toast on revert), phrased in the app's own voice ("Trim scene 3",
  "Reorder scenes").
  *Acceptance:* after an edit→save→undo sequence, the kernel document
  digest equals the pre-edit digest (receipted round-trip); the undo
  stack shows human labels; an act record for the edit is inspectable
  by ref (receipt evidence).
- **E16 Atomic composite edits.** Multi-step gestures (E06 roll, E07
  split, E04 overwrite) are one transaction: either all changes apply or
  none; a mid-gesture failure reverts what was applied and leaves **no**
  undo entry.
  *Reference behavior:* Kdenlive: "if an operation fails for some
  reason, we can easily cancel the steps that have been done so far
  without corrupting anything" (`timelinemodel.hpp:49-51`).
  *Mapping:* the app store already has the transaction idiom
  (`begin/finish/change` with baseline restore on throw,
  `store.ts:12-18`) — the target extends it to kernel batches: a
  composite's change list is submitted as one `edit` (one
  `expected_revision`, one receipt), so the kernel never holds a
  half-composite.
  *Landing seam:* `store.change` batching + the single-edit submission
  in `saveKernelExpression` (`kernelExpressions.ts:238-249`) — no code
  path may split one gesture across revisions.
  *UI harmonisation:* none visible; a failed composite surfaces the
  existing toast/refusal grammar.
  *Acceptance:* injected failure mid-split leaves document byte-equal
  (digest assert), zero undo entries, kernel revision unchanged; the
  happy path produces exactly one revision increment per gesture.

### Family S — data saving (explicit entries)

- **E17 Autosave schedule attaining the A1 shape.** Keep the working
  draft safety net, but adopt the schedule the Obsidian A1 study
  costed and the cradle accepted as precedent: trailing-debounce
  autosave, **immediate save on context switches** (scene change, panel
  close, open/save commands), and **flush-on-quit with grace**
  (recreation-backlog T2, `recreation-backlog.md:46-55`; the D-1 posture
  discipline, `:13-21`). Today's 350 ms single debounce (`app.ts:144`)
  plus the 5 s library throttle (`app.ts:159`) becomes: draft debounce
  (unchanged 350 ms coalescing), immediate draft flush on
  `setScene`/rail switch/studio close/beforeunload.
  *Reference behavior:* Obsidian 1.7.7 A1: 2 s trailing autosave +
  immediate on command/leaf-switch + flush-on-quit with grace —
  measured, gate-proven classes (recreation-backlog T2).
  *Mapping:* pure schedule change over the existing recovery owners
  (`recovery.ts:55-56` native-first, IndexedDB, localStorage fallback
  order preserved; never a silent browser fallback after native failure
  — `kernelExpressions.ts:71-81` law kept).
  *Landing seam:* `flushDraft`/`markSaved` (`app.ts:140-172`) gain
  flush triggers; no storage-shape change (that is E18).
  *UI harmonisation:* save-status line keeps its existing voice
  ("Working copy backed up on this device" etc., `app.ts:155-157`).
  *Acceptance:* kill the host mid-edit after a context switch → relaunch
  recovers to the last context switch, not the last 350 ms window
  (scripted crash test); beforeunload flush verified by pending-write
  counter reaching zero.
- **E18 Atomic, per-document storage; corruption quarantine.** The
  standalone library stops being one JSON array written wholesale on
  every save (`store.ts:34` — O(library) per write, one torn write loses
  the library): per-document keys + a manifest, each write atomic
  (IndexedDB keys are atomic; the localStorage fallback mirrors the same
  per-key shape). Unreadable entries are **quarantined verbatim, never
  dropped** — the existing law (`store.ts:29-33`) kept and per-key.
  *Reference behavior:* the kernel's own store discipline
  (`expression_act_store.rs:7-12`: atomic replace = temp + fsync +
  rename, CAS revisions); Shotcut's dedicated autosave-file object
  (`AutoSaveFile : public QFile`, `autosavefile.h:27`).
  *Mapping:* **D-1 decision point, restated for this lane** — Obsidian
  writes in place, non-atomic; the D-1 posture chose atomic-by-default
  with a documented divergence note, chosen once and never mixed
  (`recreation-backlog.md:13-21`). This target adopts that posture:
  atomic per-document writes, divergence note "no single-file vault
  compatibility to preserve" (the library is app-local, not an
  interchange format).
  *Landing seam:* `store.ts` (library) + `recovery.ts` draft stores;
  migration: existing array library read once, split per-document, array
  retained read-only one release, then quarantined.
  *UI harmonisation:* none; failure voice unchanged ("Existing library
  could not be read. It has not been overwritten.").
  *Acceptance:* corrupt one document key → others load, the bad key is
  listed in `readLibraryDetailed().errors` and preserved byte-verbatim
  (existing contract, now per-key); torn-write simulation (partial
  write) never loses a *different* document.
- **E19 Crash recovery: draft vs last kernel save.** After an unclean
  exit, reopening a hosted expression offers the real choice: resume the
  draft, or open the kernel's last saved revision — with a visible diff
  (scenes/durations/params changed) — instead of silently resuming or
  silently losing the draft.
  *Reference behavior:* Kdenlive's crash-backup flow
  (`backupwidget.*`, `temporarydata.*` in `src/project/dialogs/`): the
  reopen path surfaces recovered temporaries as a first-class decision.
  *Mapping:* the kernel holds the authoritative revision
  (`expression_ref` + `revision`); drafts live in the recovery owners
  (`recovery.ts:55-56`); both already exist — the target is the
  comparison surface and the explicit choice.
  *Landing seam:* boot path where `readDraft` finds a draft newer than
  the kernel document's `updatedAt`/revision (hosted mode); diff walks
  `sceneParameterChanges` (`sceneWorkflow.ts:27-35`) — it exists.
  *UI harmonisation:* the dialog uses the confirm-dialog grammar
  (`app.ts:616`); shows per-scene save-state dots (existing visual).
  *Acceptance:* scripted crash after N kernel-saved + M draft edits →
  reopen presents both; choosing kernel revision discards the draft
  *to quarantine* (recoverable, not deleted); choosing draft opens with
  draft contents and a pending save diff.
- **E20 Save expressibility: emit the kernel's whole standing Change
  grammar.** The app's diff refuses things the kernel can express:
  retitle, scene removal, parameter removal, automation edits, subject
  edits all die as "not expressible as a kernel edit in this cut"
  (`kernelExpressions.ts:156-204`) while the kernel grammar has `rename`,
  `scene_remove`, `scene_reorder`, `scene_create`, `parameter_set` and
  more (`expression/types.ts:39-72`). Target: `documentToChanges` emits
  the existing grammar for every operation the editor can perform, so
  save = receipted changes for the full editing surface; refusals shrink
  to genuinely-unrepresentable cases (and name them).
  *Reference behavior:* the grammar itself is the reference — the gap
  is app-side, not kernel-side (FINDINGS §4, "the gap that matters").
  *Mapping:* direct; `scene_reorder`/`scene_remove`/`rename` land as
  receipts when E01–E07 gestures commit; entity membership stays with
  native Scene operations per the bridge law
  (`kernelViewToChanges`, `kernelDocumentBridge.ts:259-262` — unchanged).
  *Landing seam:* `kernelExpressions.ts:152-232` only.
  *UI harmonisation:* the "not expressible in this cut" toasts become
  the exception, not the everyday.
  *Acceptance:* scripted session performing rename + scene remove +
  scene reorder + parameter edit saves in one `edit`, revision+1, all
  four receipted; the refusal set shrinks to documented cases (list
  them in the gate output).

### Family V — navigation (explicit entries)

- **E21 Scene→source→subject chain, with back-references.** From any
  bound entity occurrence: reveal its **source** (exists:
  `open`→`summon`, `app.ts:1052`) and its **subject** (the
  `subject_ref`'s owning register reading — the projection side exists,
  `wikiExpression.ts:424-461`), and from a subject, the reverse query:
  where does this subject stand on stage (which scenes/expressions carry
  occurrences of it) — jumpable. This is the one-field identity law
  (dual-reading §3) given an editor affordance.
  *Reference behavior:* Resolve-class media identity (every timeline
  instance traceable to its source bin item) — documentation-only
  possession, named as bar not evidence; the implementable reference is
  the app's own binding spine (`OccurrenceBinding`,
  `kernelDocumentBridge.ts:116,247`; view ids reversible, collisions
  refused, `:134-151`).
  *Mapping:* occurrences already carry `subject` clones
  (`kernelDocumentBridge.ts:247`); the back-reference is a query over
  the opened document's bindings + the register projection
  (`wikiProjectionStore.ts:1-30` — one projection state, many
  apertures; the back-reference MUST go through it, not a second
  index).
  *Landing seam:* inspector context menu on a selected occurrence
  (existing context-panel grammar); back-reference panel in the Library
  rail; `focus` kernel change (exists, `expression/types.ts:57`)
  receipts the jump when hosted.
  *UI harmonisation:* one "reveal" affordance family for source, subject
  and occurrences — same menu, same icons, no per-invention chrome.
  *Acceptance:* from a projected wiki entity: one gesture opens the wiki
  subject at its ref; the back-reference lists exactly the scenes
  carrying it (assert against bindings); each jump receipts a `focus`
  (kernel-hosted) and is undoable (E15).
- **E22 Deep links address refs, never indices.** `?expression=<ref>`
  (hosted), `?scene=<scene_ref>`, `?marker=<ref>` (E12), `?subject=`
  (E21) — every deep link resolves through the binding spine; positional
  indices are accepted only as deprecated compat and announced.
  *Reference behavior:* the site already hosts `?expression=` idiom and
  passes sceneMap by id (`site/src/expression/ExpressionApp.tsx:193-198`);
  the app README records the `?journey`/`?scene` idiom
  (`expressions-app/README.md:74-78`).
  *Mapping:* refs are the kernel's own addresses; nothing new.
  *Landing seam:* URL parsing at boot in `app.ts` (open path) +
  `jumpToScene` (`app.ts:1055`) once E03 lands.
  *UI harmonisation:* none.
  *Acceptance:* a URL with expression+scene refs opens at that scene on
  a fresh client (two-client check); a stale ref (scene removed) opens
  the expression at its start scene with a named note, never a silent
  fallback.
- **E23 Reader fullscreen and focus mode.** The audit floor, verbatim:
  real fullscreen (`requestFullscreen` on the stage), a focus mode
  hiding all chrome (key F), the scene list living in the field rail's
  language, related nodes in the connections panel — on the standalone
  page and on the in-reader frame (which keeps its in-rail scene list).
  *Reference behavior:* audit §"Reader experience (code, ready to do)"
  (`2026-10-07-expression-audit/FINDINGS.md:97-105`) — the canvas today
  is 59% of the viewport with no fullscreen anywhere in
  `site/src/expression/ExpressionApp.tsx`.
  *Mapping:* reading-side only; no document-model surface.
  *Landing seam:* `site/src/expression/ExpressionApp.tsx` (stage
  wrapper) + the app's existing present mode (`presenting`,
  `app.ts:745-748`) unified on the same keys.
  *UI harmonisation:* F = focus in both; Esc law already exists
  (`app.ts:745`).
  *Acceptance:* screenshot pair (chromeless vs normal, G6) at the same
  scene; fullscreen element is the stage (DOM assert); the audit's
  chrome-eats-the-experience measurement re-run shows the canvas ≥ 90%
  in focus mode.

### Family P — transport and snapping

- **E24 Transport: scrub, shuttle, frame stepping.** The playhead stops
  being the only clock surface: scrubbing (drag with live field
  evaluation — exists partially via `trackPreview`, `app.ts:710`), JKL
  shuttle (back/pause/forward with speed ramp), and frame stepping;
  the auto-advance clock (`app.ts:844`) becomes one transport mode
  under the same transport state, not the de-facto master.
  *Reference behavior:* JKL shuttle is the professional standard
  (Resolve bar, documentation-only) and present in the open sources'
  transport layers; the honest implementable reference is Kdenlive's
  transport/monitor separation — the *model* separates transport state
  from document state.
  *Mapping:* transport state is working-view state (the recovery
  session already carries `transport` — `recovery.ts:8` — so it
  survives reloads); documents unchanged.
  *Landing seam:* keymap beside the existing shortcuts
  (`app.ts:747-749`); transport UI in the E01 timeline.
  *UI harmonisation:* J/K/L and arrow semantics identical in app,
  site page and in-reader frame.
  *Acceptance:* J/L shuttle ramps and returns to prior state on K
  (state assert); stepping holds exactly one evaluation step; scrub
  audiolessly re-evaluates tracks at pointer rate without advancing
  `simTime` physics (existing scrub law, `app.ts:710`).
- **E25 Timeline snap model.** Snap points with candidate ranking and
  navigation: scene boundaries, markers (E12), playhead, in/out (E13),
  keyframe times (E09). Next/previous-snap navigation from the playhead.
  *Reference behavior:* Kdenlive `SnapModel` — add/remove points,
  closest, `getNextPoint`, `getPreviousPoint`
  (`snapmodel.hpp:15-49`) — the exact shape to mirror.
  *Mapping:* pure working-view model (no document surface); candidates
  derive from document state.
  *Landing seam:* replaces the single `camera.snap` toggle's timeline
  counterpart (`app.ts:527` keeps the camera's own snap); S toggles
  timeline snapping; Alt disables momentarily (standard grammar).
  *UI harmonisation:* snap indicator line reuses the guides SVG layer
  (`drawGuides`, `app.ts:810`).
  *Acceptance:* dragging a clip edge within threshold snaps to the
  neighbour boundary and to markers (order: nearest candidate wins —
  Kdenlive's closest-point law); S toggles; next/prev jumps playhead
  point-to-point (assert).

### Family O — organisation

- **E26 Collections as bins.** The kernel's `collections_set`
  (`expression/types.ts:70`) gets its editor surface: assign an
  expression to named collections; the Library groups/filters by
  collection; saved scenes carry colour tags for visual organisation.
  *Reference behavior:* bins/colour tags are universal organisation
  (Blender strip colour tags; Resolve bins — documentation-only bar);
  Shotcut's marker/organisation models show the minimal shape.
  *Mapping:* the Change kind exists — this is UI + one save-path
  emission (`collections_set`); no kernel work.
  *Landing seam:* Library panel (`libraryOpen` surfaces,
  `app.ts:119-120`); collection picker on the library card grammar.
  *UI harmonisation:* collection chips use the existing related-node
  chip language, moved out of the stage (G1).
  *Acceptance:* assign to a collection → `collections_set` receipted,
  revision+1; Library filters correctly after reload; a document in no
  collection reads as "Uncollected", never hidden.

## Sequencing note

Kernel-first order: **E20** (save expressibility) unblocks receipts for
everything else; **E03** (ref addressing) unblocks E01/E05–E07/E22;
**E15/E16** (receipted undo, atomic composites) precede any gesture that
bakes new surfaces in; E08 precedes E09; E12 before E13/E25 consume
markers. E14 (nesting) and the slip field inside E06 carry the set's only
kernel-side additions beyond envelope-carried presentation fields, and
both are flagged for owner eyes before phase 3 starts.

## Shared core interface — what lane 5 consumes

Lane 5 (M3′ Journey/Scenes + M5′ Palace) targets journey composition and
palace orchestration **over** this editing model. It consumes, and must
not fork, re-invent, or write beside:

- **SC-1 Sequence model** (E02/E03): scenes are ref-addressed clips;
  order + `duration` + `transition` are the timeline facts; content
  identity is stable under every timeline op. Journey composition UIs
  address scenes by `scene_ref`, never by index.
- **SC-2 Operation surface** (E04–E07, E11): the named scene-sequence
  operations (insert/overwrite, trim, roll/slip/slide, split, typed
  transition) and their composite shapes — lane 5 composes journeys from
  these, never by manipulating `scenes[]` directly.
- **SC-3 Receipt interface** (E15/E16, E20): one gesture = one labelled
  undo entry = one kernel `edit` batch = one revision increment; undo
  issues compensating changes. Palace edits ride exactly this path —
  no parallel undo, no silent writes.
- **SC-4 Time base and channels** (E01, E08–E10): `expressionTiming`
  (Σ durations) is the only clock; property tracks + their interpolation
  types are the channel system lane 5 automates against (palace-scale
  choreography = channels over nested occurrences, E14).
- **SC-5 Presentation-carried furniture** (E12/E13, E06 slip): markers,
  in/out regions and slip travel in the journey/scene presentation
  envelopes; lane 5 reads them through the same envelopes (and inherits
  the owner decision flag on a dedicated `marker_set` Change kind).
- **SC-6 Identity and navigation** (E21/E22): `OccurrenceBinding` +
  `subject_ref` chains, ref-addressed deep links, back-references
  through the one projection state (`wikiProjectionStore.ts`) — the
  palace's room-to-room and subject-to-subject travel uses these, not
  new link tables.
- **SC-7 Save/recovery posture** (E17–E19): the A1-shaped autosave
  schedule, atomic per-document stores with quarantine, crash-recovery
  choice, D-1 atomicity posture — shared verbatim by any journey/palace
  authoring surface.

Lane 5 owns, by the programme's shared-editor law: journey composition
UX (scene ordering at journey scale), palace orchestration, and their
instrument-native controls (dual-reading §7) — everything below SC-1…SC-7
is lane 3's and changes only through a recorded return to this document.

## What stayed unverified (named)

- **No live kernel or desktop-host run in this lane** — receipt,
  revision and act-store behavior are read from source
  (`expression_act_store.rs`, `kernelExpressions.ts`), not exercised
  end-to-end. Acceptance shapes above are written to be executable once
  phases 3–5 begin.
- **Reference behaviors come from static reading of the `/tmp`
  checkouts** (shallow clones, HEADs pinned in RE-TARGETS §Version
  note); none was built or run. Offset citations were re-verified this
  session and corrected where drifted (RE-TARGETS, marked inline).
- **DaVinci Resolve** — not installed, manual not downloaded; Resolve
  appears only as the owner's quality bar, never as a behavioral
  citation.
- **Audit-carried defects** (striped text rendering; frequency<1
  rejection) — carried at audit confidence, not reproduced here
  (FINDINGS §6); they gate the render side, not this editing-model set.
- **The proposed-new-surface places** (slip in E06, markers in E12,
  nested-occurrence budget behavior in E14) — the three places this set
  proposes new surface (two envelope fields, one
  owner-flagged Change kind); their acceptance shapes are untested by
  construction.
- **Undo convergence (E15) against kernel act-replay** — the act store's
  replay semantics were read structurally only; whether compensating
  changes are always expressible for every composite after E20 is a
  phase-3 verification item, not a settled fact.
