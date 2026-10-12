# Lane 5 RE targets — journey/palace composition

Candidates surveyed with **possession status** verified and recorded; the
chosen targets and the reasoning per feature family follow. Guardrails held:
open-source checkouts live in scratch (`/tmp/re-lane5/`, outside every
product tree); documentation targets are cited as readable docs, never
decompiled; short quotes only, with offsets.

## 1. Candidates surveyed

| # | Candidate | Possession status (verified 2026-10-07) | What it would teach |
|---|---|---|---|
| C1 | **Godot Engine 4.8-dev** — `AnimationNodeStateMachine` + its editor | **Possessed: open-source checkout**, MIT, shallow-cloned to `/tmp/re-lane5/godot` (`version.py`: major 4, minor 8, patch 0, status dev). Read: `scene/animation/animation_node_state_machine.h`, `editor/animation/animation_state_machine_editor.cpp` | Transitions as first-class named edges with crossfade time + curve + switch mode; travel paths; drag-to-connect graph editor with live transition rendering |
| C2 | **Twine 2.12.1** (klembot/twinejs) | **Possessed: open-source checkout**, MIT, shallow-cloned to `/tmp/re-lane5/twine` (`package.json`: `"version": "2.12.1"`). Read: `src/store/stories/stories.types.ts`, `src/util/parse-links.ts`, `src/components/passage/passage-map/`, `src/components/passage/passage-connections/` | Passage-graph composition: free spatial arrangement of addressable units, links as composition, drag/grid-snap, story map as integral whole |
| C3 | **Unity Timeline 1.2/1.8 manual** | **Possessed: documentation only** (docs freely readable; Unity source is not legitimately possessed — recorded limitation, no decompilation attempted). Verified page: `docs.unity3d.com/Packages/com.unity.timeline@1.2/manual/clp_blend.html` (fetched 2026-10-07; quoted below). Ease-in/out page known from search snippets only (direct URL unresolved — named in §5) | Track/clip/blend vocabulary: mix-mode blending by overlap, outgoing/incoming clips, blend area = transition duration, ease in/out durations |
| C4 | **Unreal Engine Sequencer** (5.x docs) | **Possessed: documentation only** (`dev.epicgames.com/documentation/en-us/unreal-engine/cinematics-and-movie-making-in-unreal-engine`, fetched 2026-10-07) | Sequences/shots/takes non-linear assembly; camera cuts; spawnable vs possessable binding; playlists |
| C5 | Scene-sequencing/previz/storyboard tools (openvideo/otsdemux class, Krita storyboard docker, Blender VSE) | **Not pursued this pass** — Blender VSE is the closest possessed-able candidate but its model (strips on channels) overlaps Unity/Godot evidence; recorded for a later pass rather than half-surveyed | — |

## 2. Chosen targets and why

### Target A — Godot's animation state machine + its editor (transition law and playback)

The journey's real gap (FINDINGS.md §4.2) is that a scene transition is one
preview-only crossfade with four reused easings. Godot is the genuine
reference because its transition model is exactly the shape the journey
needs — **per-edge, authored, structured** — and it is fully possessed.

Evidence (short quotes, offsets into the scratch checkout):

- `scene/animation/animation_node_state_machine.h:37-63` —
  `class AnimationNodeStateMachineTransition : public Resource` with
  `enum SwitchMode { SWITCH_MODE_IMMEDIATE, SWITCH_MODE_SYNC,
  SWITCH_MODE_AT_END }` (l.41-45), `enum AdvanceMode {…ADVANCE_MODE_AUTO}`
  (l.47-51), and fields `float xfade_time = 0.0;` (l.58),
  `Ref<Curve> xfade_curve;` (l.59), `bool break_loop_at_end` (l.60),
  `bool reset = true` (l.61), `int priority = 1` (l.62),
  `String advance_expression` (l.63).
- `scene/animation/animation_node_state_machine.h:133-139` — transitions are
  first-class named edges: `struct Transition { StringName from; StringName
  to; Ref<…> transition; }` held in a vector on the state machine.
- `scene/animation/animation_node_state_machine.h:333,341` — playback asks
  for a **travel path**: `void travel(const StringName &p_state, …)` and
  `Vector<StringName> get_travel_path() const` — the engine routes through
  the graph, and the editor can show where it will go.
- `editor/animation/animation_state_machine_editor.cpp:1071` — the editor
  draws each edge with its live meaning:
  `void _connection_draw(…, SwitchMode p_mode, bool p_enabled, bool
  p_selected, bool p_travel, float p_fade_ratio, bool p_auto_advance, …)` —
  during playback the **fade ratio is rendered on the edge**; drag-to-create
  a transition ends in `_add_transition` (l.1014, do/undo via
  `add_transition`, l.1045, 158-161).

What it names for the journey: (a) transitions as **authored objects with
time + curve + switch semantics**, not one implicit crossfade; (b)
**sync/at-end switching** (a transition can wait for the outgoing scene's
natural end); (c) **travel** — play an ordered path through a graph of
scenes, with the path itself inspectable; (d) the editor shows transition
state live on the composition (strip/edge), so the craft is visible while
composing.

### Target B — Twine 2's story map (integral composition and presentation/addressability split)

TD6's law — "arrangement is composition/presentation state; each underlying
object remains independently addressable" — is Twine's entire architecture,
and it is fully possessed.

Evidence (short quotes, offsets):

- `src/store/stories/stories.types.ts:8-53` — a `Passage` is
  `{id, name, text, tags, left, top, width, height, selected, highlighted}`:
  free 2D position is **presentation state on the card**, while identity is
  the stable `id`/`name` pair.
- `src/store/stories/stories.types.ts:55-91` — a `Story` is
  `{ifid, id, name, passages[], script, stylesheet, snapToGrid, startPassage,
  storyFormat, tagColors, lastUpdate}` — one named **start** and a set of
  addressable units; `snapToGrid` (l.86) is an authoring aid, never identity.
- `src/util/parse-links.ts:63-77` — `parseLinks(text, internalOnly)` extracts
  unique `[[link]]` targets from passage source: **composition is declared
  at the content level** (a passage names its successors), and the map's
  arrows are derived (`passageConnections(passages)`,
  `src/components/passage/passage-connections/passage-connections.tsx:20-22`),
  including `BrokenConnection`, `SelfConnection`, `StartConnection` and
  `LinkMarkers` components in the same directory — honesty about dangling
  links is part of the map.
- `src/components/passage/passage-map/passage-map.tsx:1-40` — the map is a
  draggable, zoomable canvas (`react-draggable` `DraggableData`, `zoom`,
  marquee selection via `components/marquee-selection`); moving a card
  changes only `left/top`.

What it names for the palace: (a) **free spatial arrangement as pure
presentation** over independently addressable objects; (b) **derived
connection drawing with honest broken/self/start edges**; (c) a named
**entry** (start passage) instead of implicit order; (d) zoom + marquee +
grid-snap as the composition feel.

### Target C (documented vocabulary) — Unity Timeline's clip blending

Documentation-only (recorded limitation: Unity's implementation is not
possessed; the vocabulary comes from the readable manual). Verified verbatim
from `docs.unity3d.com/Packages/com.unity.timeline@1.2/manual/clp_blend.html`
(2026-10-07):

> "To blend two clips, select the Mix Clip Edit mode and position or trim
> one clip until it overlaps an adjacent clip. In a blend, the first clip is
> referred to as the outgoing clip and the second clip is referred to as the
> incoming clip. The area where the outgoing clip transitions to the
> incoming clip is referred to as the blend area. The blend area sets the
> duration of the transition."

Plus (search-snippet level, unverified URL): Ease In/Out Duration on a clip
creates fades relative to adjacent clips. This contributes the **outgoing/
incoming + overlap-means-transition** vocabulary to the scene strip (a
dragged overlap authors a transition), complementing Godot's per-edge
fields.

### Target D (rejected for this lane, recorded) — Unreal Sequencer

Docs possessed and readable; the sequences/shots/takes and spawnable/
possessable model is real, but (a) docs-only possession, (b) its center of
mass is camera/actor binding inside one engine runtime — the expressions
editor core (lane 3's) is our runtime, and Godot covers the transition law
with source evidence. Not chosen; revisited only if lane 3's editing model
adopts shot-assembly semantics.

## 3. Reasoning per feature family

- **Composition model (ordering scenes into a journey):** current strip +
  `scene_reorder` already carries the linear floor; Godot contributes the
  *transition edges* between steps and Twine the *graph view* with honest
  connections. The journey stays linear-first (the app's scene strip), with
  per-edge transitions as authored objects.
- **Playback model:** Godot's `travel` + `xfade_time/xfade_curve` +
  `switch_mode` (immediate/sync/at-end) name the whole target; playback of
  the journey walks the authored edges, and the UI can render fade progress
  (Godot draws `p_fade_ratio` on the edge).
- **Reordering/drag composition:** Twine (free drag, snap, marquee, zoom)
  for the palace integral board; the app's existing strip drag (app.ts:766-768)
  for the journey, extended with Unity's overlap-to-blend affordance.
- **Integral composition (palace):** Twine's story map is the direct
  reference for TD6's presentation/addressability split; Godot's editor
  contributes the "compose by connecting" affordance where a palace region
  names its guided path; the kernel substrate law (region = Scene with one
  body, replay-idempotent plan, CAS) stays exactly as implemented
  (composition.ts) — the RE targets change the surface craft, never the
  substrate.
- **Presence/return:** no external target needed — the deep floors
  (`presence.ts`, `return.ts`, `regions.ts`, `recall.ts`, `agent.ts`,
  `agent-state.ts`) already model it; the targets wire them (TARGET-SET.md),
  and Twine's start-passage + broken-connection honesty shapes the
  presentation.

## 4. Shared-editor dependency (binding)

**Lane 3 owns the expressions editing-model target set; lane 5 consumes it.**
At write time `lane-3-expressions-editor/` is **empty** (checked twice,
latest 2026-10-07). All editor-core targets in TARGET-SET.md are recorded as
`consumes lane-3 editing core: <named sections>` placeholders — named as the
capabilities this lane's features need (selection/inspection surface,
fullscreen/focus chrome, transition-capable preview engine, per-scene
save/restore UX), to be reconciled with lane 3's actual deliverable at
convergence. Lane 5 duplicates no editor-core feature.

**Continuation pass, 2026-10-07 (later the same morning):** lane 3's
FINDINGS.md and RE-TARGETS.md have since landed (their RE basis: Kdenlive
operation/undo, Blender VSE sequence model, Olive/libopenshot keyframe
channels, Shotcut/MLT autosave discipline); their TARGET-SET.md is still
unwritten. Possession claims above were re-verified in place: `/tmp/re-lane5/godot`
(`version.py`: 4.8.0-dev) and `/tmp/re-lane5/twine` (`package.json`: 2.12.1)
stand as cited; the quoted transition header lines
(`animation_node_state_machine.h:37-63`) match the checkout verbatim.
TARGET-SET.md §Dependency now names the five expected lane-3 sections
against that RE basis.

## 5. What stayed unverified

- Unity's Ease In/Out Duration details rest on search snippets; the exact
  manual page URL did not resolve (docs restructuring). The blend page quote
  is verified verbatim.
- Unreal Sequencer findings are summary-level from the docs index page; no
  feature-specific page was fetched this pass.
- Godot's runtime xfade behavior is read from headers/editor code; no Godot
  build was run (possession is the checkout; runtime verification is a
  phase-3 pass).
- Twine's publishing side (story formats) was not examined — lane 5 needs
  the map/arrangement model, not the compiler.
- Scratch clones are pinned by shallow clone at 2026-10-07; upstream drift
  after that date is unnamed.
