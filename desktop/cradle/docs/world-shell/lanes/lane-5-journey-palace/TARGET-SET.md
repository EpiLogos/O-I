# Lane 5 target set — M3′ Journey/Scenes + M5′ Palace

**Standing:** lane 5 deliverable (phases 1–2) of the Technè instruments
genuine-functionality-parity programme (`../PROGRAMME.md`), 2026-10-07.
**Scope:** journey/palace *composition* quality on the shared editing core.
Shell/editor-core questions are lane 3's; this lane consumes them and
duplicates nothing (§Dependency).

## Reading guide

Each target names: what it does, the reference behavior it attains, the
landing seam in the cradle, the UI-harmonisation note, and a verifiable
acceptance shape. Current-state evidence for every seam is in FINDINGS.md;
reference evidence (Godot/Twine/Unity) is in RE-TARGETS.md.

## Dependency (binding): consumes lane-3 editing core

**Lane 3 owns the editing-model target set; this lane consumes it.** At
write time `../lane-3-expressions-editor/TARGET-SET.md` is **not yet
written** (their FINDINGS.md and RE-TARGETS.md are landed, 2026-10-07).
This lane's editor-core consumption points, named as the capability
sections expected from lane 3's deliverable, tied to lane 3's own RE basis
(Kdenlive operation/undo, Blender VSE sequence model, Olive/libopenshot
keyframe channels, Shotcut/MLT autosave discipline):

1. **Transition-capable engine** — the transition *law* (how two scenes
   blend in the render) lives in the engine; lane 3 owns making it real
   beyond the current preview-only, linear-only crossfade
   (FINDINGS.md §1.4, §4.2). Lane 5's T5–T8 author and expose it per edge.
2. **Selection/inspection surface** — clicking a scene/beat must open the
   shared inspector grammar (lane 3 FINDINGS §3, §5).
3. **Fullscreen/focus chrome** — the audit's reader-experience floor
   (`requestFullscreen`, focus mode) is lane 3's; journey playback and the
   palace walk present inside it.
4. **Per-scene save/restore UX** — the Draft/Saved/Edited-since-save
   workflow (`sceneWorkflow.ts:8-25`) is editor core; lane 5 composes
   journeys over saved scenes and keeps its semantics.
5. **Keyframe/property channels** — journey automation visible inside a
   beat consumes lane 3's channel system (Olive reference); lane 5 adds no
   channel model.

Lane 5 duplicates no editor-core feature. If lane 3's deliverable is still
absent at convergence, the integrator reconciles these five named sections
against whatever lane 3 actually lands; every lane-5 target below marks its
consumption with "consumes lane-3: <section>".

## Craft bar carried from the expression audit

The 2026-10 audit (`../../2026-10-07-expression-audit/FINDINGS.md`,
§"What good asks for instead") is law for this lane too — target sets name
craft-quality bars, never compliance checklists. Applied to journey/palace:

- **A still scene is lawful.** Journey playback and palace walks hold
  stillness deliberately; nothing in the target set makes per-pair churn
  mandatory or stillness non-compliant (today's corpus makes stillness
  illegal by floor — audit floor #2).
- **The colour journey is part of composition.** Transitions blend
  backgrounds and palettes as meaning (today 108/135 journeys carry one
  background throughout); the strip should *show* the colour journey.
- **Text by exception on the journey stage.** Beat titles derive from the
  scene ref (beats.ts:66-69); metadata (citations, paths, routing) never
  rides the stage — it lives in the reading frame and inspector.
- **Composition is render-verified, not self-reported.** Acceptance shapes
  below name screenshots/runtime evidence where the claim is visual.
- **The stage is the stage.** Playback presents clean; authoring chrome
  (strip, inspector, save dots) recedes during play-through.

### T1. The M3′ deep journey surface exists — a reading composed into a journey

**What it does:** opens a reading-derived beat sequence as a working
surface: one beat per scene-bearing Expression binding, in binding order,
each beat framed by the reading's own temporal/spatial/provenance facets.
A reading whose bindings carry no scene refs shows the honest
unavailable-reason as data, never an error and never an invented beat.
This is the instrument the deep floor models and nothing mounts
(FINDINGS.md §1.1, §4.1).

**Reference behavior attained:** Twine's story map treats units as
addressable cards over one stable identity (`stories.types.ts:8-53`); the
beat surface gives each scene-bearing binding the same standing — a card
whose identity is the verbatim `scene_ref`, never a re-keyed copy.

**Landing seam:** mount `src/techne/m0m5/journey/beats.ts` (pure, no
store) inside the hosted app's journey lens (`app.ts:1015`,
`lens==='journey'`), beside the existing Expressions-native scene strip —
the strip remains the Expressions-native view; the beat surface is the
reading-derived view over the same scenes.

**UI harmonisation:** beats render as Expressions-family cards (same
visual grammar as scene-strip thumbnails); the reading frame (temporal,
place, source chips) uses the field's existing facet-chip language, not a
new dialect.

**Acceptance shape:** open a real subject's reading with scene-bearing
bindings → one beat per binding, `scene_ref` strings byte-identical to the
kernel document's (screenshot + DOM text compare against
`kernelDocumentBridge` bindings); open a scene-less reading → the
disclosure's own reason is displayed, no beats fabricated. Confidence:
high (model is tested; only the mount is new).

### T2. Scene composition is a routed proposal, not a local write

**What it does:** from the beat surface, composing a new scene mints the
proposal in the substrate's own grammar (`${expressionRef}:scene:${slug}`,
compose.ts:93), refuses collision with an already-disclosed scene
(compose.ts:95-97), enforces CT materiality per Vāk lock §4, and routes
`oi.expression.edit` to the Expression owner — nothing persists client-side
(compose.ts:28).

**Reference behavior attained:** Godot's editor creates a transition only
through an explicit editor act with undo (`_add_transition`,
`animation_state_machine_editor.cpp:1014,1045`); the journey likewise
creates a scene only through one attributable, refusable proposal.

**Landing seam:** `src/techne/m0m5/journey/compose.ts` `composeSceneProposal`
→ the hosted app's existing kernel edit channel (the same one
`kernelComposition.ts:145-147` CAS-gates). First consumer of this floor.

**UI harmonisation:** the compose affordance lives in the shared
Expressions toolbar/inspector grammar; the refusal texts are the floor's
own plain reasons, shown as toasts (the app's existing toast channel).

**Acceptance shape:** compose on a reading with a bound register
Expression → exactly one `scene_create` change reaches the kernel, CAS-gated
on the disclosed revision; the new scene's ref appears in the reopened
kernel document in the substrate grammar; composing a colliding title is
refused with the floor's reason. Replay of a refused compose emits nothing.

### T3. Reorder and pace: the draft is local, the order is native, the boundary is honest

**What it does:** drag-reorder of beats/strip scenes produces a
`SequenceDraft` (order + per-scene dwell); `composeProposal`
(sequence.ts:110-142) refuses drafts that invent or drop scene refs and
routes `scene_reorder` with `{expression_ref, revision, scene_order}`.
Per-scene duration/transition seconds persist **natively** inside the
scene-material envelope (`oi.journey-scene/v1`,
`kernelComposition.ts:19,118`) — that is where pacing already legitimately
lives; the deep floor's local pace draft rides presence (T9), and no third
store is created. The sequence.ts boundary ("the Change union has no
pacing change", sequence.ts:12-15) stays: if journey-level pacing beyond
per-scene duration is ever wanted semantically, that is a substrate
decision, not a shadow store.

**Reference behavior attained:** Godot's state machine stores order and
edges as first-class state-machine state; Unity's blend vocabulary makes
duration part of the transition itself. The strip's existing drag
(app.ts:766-768 → `reorderScene`, app.ts:468) plus the existing
per-scene duration/transition inputs already carry the linear floor —
the target is the deep surface joining the same laws, not a new mechanism.

**Landing seam:** `src/techne/m0m5/journey/sequence.ts` → kernel
`scene_reorder`; duration/transition inputs stay on the strip writing
scene material.

**UI harmonisation:** one drag grammar across strip and beats (same
drop targets, same ghost); pace inputs use the strip's existing
duration/transition field styling.

**Acceptance shape:** reorder beats → one `scene_reorder` change naming
exactly the disclosed refs in the new order; a draft naming an
undisclosed ref is refused client-side with the floor's error; after
save + reopen (`kernelDocumentToJourney`), scene order is the authored
order (round-trip via `bindings`).

### T4. One scene identity, no shadow store — the law holds at every new seam

**What it does:** every journey/palace surface treats the kernel
`oi.expression/v1` scene refs as the only scene identity. View ids may be
remapped for the working view (`kernelDocumentBridge.ts:247` bindings
map), but composition, crossing, presence and Return all carry native
refs; replay/rebase keeps view ids stable
(`kernelComposition.ts:171-185`). No surface introduces a second scene
store, a second id space that persists, or identity encoded in minted
strings.

**Reference behavior attained:** Twine separates card identity
(`id`/`name`) from presentation position — but the journey's stronger
substrate law (one field, one store) already exceeds it; the target is
*keeping* it under the new surfaces, which is where shadow stores
historically creep in (FINDINGS.md §4.7 documents the one that exists).

**Landing seam:** a standing check, not a file: every new surface
(T1–T3, T5–T19) is reviewed against this law; the kernel's own refusal
("Subject must remain native", `kernel/src/expression.rs:1195-1196`) is
the backstop.

**UI harmonisation:** none (law, not UI).

**Acceptance shape:** grep audit of every new surface's writes: only
kernel edits + the two presentation stores named in T20/T21 appear;
the acceptance passes of T1–T3 double as identity proofs (refs compared
byte-identical after round trip).

### T5. Transitions are authored per-edge objects, not one implicit crossfade

**What it does:** each ordered pair of scenes carries an authored
transition: time (seconds), curve, and switch semantics
(immediate / sync / at-end — a transition may wait for the outgoing
scene's natural end). Authored on the strip or beat surface, persisted
inside the scene-material envelope alongside `duration`/`transition`
(the envelope already holds per-scene entry-transition seconds;
this generalises it to the *pair* semantics Godot models).

**Reference behavior attained:** Godot's
`AnimationNodeStateMachineTransition`: `xfade_time`, `xfade_curve`
(`Ref<Curve>`), `SwitchMode {IMMEDIATE, SYNC, AT_END}`,
`break_loop_at_end` (`animation_node_state_machine.h:37-63`). Today the
journey has exactly one mechanism — a preview-only canvas crossfade with
`transitionEasing` hardcoded `'linear'` (`app.ts:301-302`) — against the
app's own UX-contract admission: "The preview's page dissolve is not a
physical transition law" (`docs/UX_CONTRACT.md:45`).

**Landing seam:** transition authoring state joins the scene-material
presentation envelope (`scene_material_set`); runtime blending consumes
lane-3's transition-capable engine. **Consumes lane-3: transition-capable
engine** (§Dependency 1).

**UI harmonisation:** the transition editor uses the shared inspector
form grammar (the strip's existing duration/transition inputs are its
seed); curves render in the engine's own easing-curve visual language.

**Acceptance shape:** a journey with authored per-edge transitions plays
with each edge honouring its time/curve/switch mode; at-end edges hold
the outgoing scene to its natural end; reload restores the authored
edges from the kernel document (envelope round trip). Confidence: high on
the persistence seam (pattern proven by `oi.journey-scene/v1`), medium on
runtime blending until lane-3's engine section lands.

### T6. Overlap-to-blend authoring: dragging scenes into overlap authors the transition

**What it does:** on the strip, dragging a scene to overlap its
neighbour's tail authors/extends the transition between them; the overlap
width *is* the transition duration; separating the scenes to zero overlap
returns to a cut.

**Reference behavior attained:** Unity Timeline's blend model, verbatim:
"In a blend, the first clip is referred to as the outgoing clip and the
second clip is referred to as the incoming clip. The area where the
outgoing clip transitions to the incoming clip is referred to as the
blend area. The blend area sets the duration of the transition."
(`clp_blend.html`, verified verbatim 2026-10-07 — documentation-only
possession, RE-TARGETS.md §2.C).

**Landing seam:** the strip's existing drag machinery
(`app.ts:766-768` → `reorderScene`); overlap state writes the same
per-edge transition state as T5.

**UI harmonisation:** drop-target and snap visuals follow lane-3's snap
model (their Kdenlive RE basis) so drag feels identical on strip and
timeline; **Consumes lane-3: per-scene save/restore UX + snap grammar**
(§Dependency 4).

**Acceptance shape:** drag scene B's head over scene A's tail by N px →
the pair's transition reads N seconds; playing the join shows one blend
of that duration; screenshot pair before/after shows the strip rendering
the blend area (render-verified, not self-reported).

### T7. Transition truth is visible while composing — the strip shows the live edge

**What it does:** while playing (or scrubbing) the journey, the strip
renders each transition's live state on the edge itself — progress of
the fade, switch mode, enabled/disabled — so the craft is visible during
composition, not only in playback.

**Reference behavior attained:** Godot's state-machine editor draws each
connection with its live meaning, including the fade ratio during
playback (`_connection_draw(…, SwitchMode p_mode, …, float p_fade_ratio,
bool p_auto_advance, …)`, `animation_state_machine_editor.cpp:1071`).

**Landing seam:** the strip's per-scene buttons and inter-scene gaps
(`renderTimeline`, app.ts:221) gain edge rendering driven by the same
transition telemetry the engine already emits
(`transitionStart`/`transitionDuration`, app.ts:301-302, 845).

**UI harmonisation:** edge rendering uses the strip's existing
save-state-dot/progress-bar vocabulary (per-scene progress bars already
exist, app.ts:847); no new chrome family.

**Acceptance shape:** during a transition, the edge between the two
scenes visibly fills at the fade ratio (screencap sequence at t=0/50/100%
of the transition); an at-end edge is distinguishable from an immediate
edge at a glance.

### T8. Playback walks the authored journey with an inspectable path

**What it does:** journey playback plays the authored sequence (saved
scenes only, honoring loop and `break-at-end` semantics) and makes the
path inspectable: the next scene(s), the active edge, and the journey
position are legible at any moment — including across loop.

**Reference behavior attained:** Godot playback asks the state machine
for a **travel path** (`travel()`, `get_travel_path()`,
`animation_node_state_machine.h:333,341`); `break_loop_at_end`
(animation_node_state_machine.h:60) names the loop-exit semantics the
journey's loop toggle lacks today (loop simply wraps, app.ts:844).

**Landing seam:** the playback loop (`app.ts:844`) plus the strip edge
rendering from T7; the beat surface (T1) shows the same path over
reading-derived beats.

**UI harmonisation:** playback chrome is the existing transport bar
extended with a next-scene whisper — recedes to nothing at fullscreen
(**Consumes lane-3: fullscreen/focus chrome**, §Dependency 3).

**Acceptance shape:** playing a 5-scene journey with a loop-exit edge
stops at the named scene instead of wrapping; the path (scene 2 → 4
travel) is visible before arriving; paused mid-transition shows both
scenes' names on the strip edge.

### T9. Journey presence: reload re-enters where the author stood

**What it does:** the journey surface persists its position and local
draft (current scene ref, order draft, pace draft) through reload —
strict validate-then-accept, drifted entries dropped, basis standing
against the current reading disclosed (`current` / `field-advanced` /
`stale`). This wires the finished, test-only presence floor.

**Reference behavior attained:** no external target needed — the floor
is the law (`presence.ts:49` key, `:58-83` validation, `:149-152`
standing); Twine's autosave-of-layout (`lastUpdate`, positions on cards)
is the felt reference: leave and return, and the map is where you left it.

**Landing seam:** `src/techne/m0m5/journey/presence.ts` (first consumer)
→ the hosted app's session-save path (`saveSession`, app.ts:137, which
already persists transport/session state under `SESSION_KEY`) — presence
adds the reading-basis and draft fields the session state lacks.

**UI harmonisation:** a restored `field-advanced` presence shows a
one-line banner in the shared notice style ("the field moved while you
were away — showing the new revision"); `stale` presence is dropped with
the same plain-language treatment.

**Acceptance shape:** compose a draft, navigate away, reload → position
and draft restored, still a draft (nothing routed); advance the reading's
revision out-of-band → banner discloses `field-advanced`; corrupt the
localStorage payload → the surface opens with no presence and no error.

### T10. The formal crossing is the journey→scene entry path (4:2 ↔ 3:3)

**What it does:** entering a scene *from the journey* performs the
crossing law, not a bare index jump: the scene ref is appended to the
selection's own `focus_refs`, the occupied-cut guard holds, and
subject/reading/selection/agent-session cross untouched
(`crossing.ts:44-99`). The app currently navigates by scene index inside
itself; the deep surface crosses with identity carried.

**Reference behavior attained:** this is TD4's own law
(TECHNE-DUAL-READING.md §"TD4"): one Scene identity, one source basis,
"no Journey shadow scene store" — the crossing floor exists tested; the
target is the mount.

**Landing seam:** `src/techne/m0m5/journey/crossing.ts`
`crossToExpression` (first consumer) → the app's `setScene` path and the
host channel (`open-expression` + `lens`, `hostedApp.ts:440-462`) so the
same law holds when the journey lens opens the Expression reading.

**UI harmonisation:** crossing uses the shared lens-chooser/announce
mechanics (`oi-app-state`, `hostedApp.ts:498-514`); no extra chrome — the
crossing is the navigation.

**Acceptance shape:** from a beat, enter its scene → the active
selection's `focus_refs` ends with that scene ref (inspected via the
session store); subject_ref, reading_ref, selection_ref,
agent_session_ref are byte-identical before/after (assert from
`crossing.ts:90-97` semantics at runtime); crossing onto the occupied cut
is refused with the floor's reason.

### T11. Return restores the exact beat, by ref equality, never an index

**What it does:** returning from the Expression reading to the journey
re-enters the beat the selection's scene focus names — matched by
`scene_ref` equality; a lost or no-longer-disclosed focus is an honest
miss displayed as data (`crossing.ts:75-78, 101-108`), never a guessed
position.

**Reference behavior attained:** TD4's return leg ("return to
Journey/deep field"); Godot's travel path model — return is routed
through recorded state, not positional memory.

**Landing seam:** `crossing.ts` `returnPosition` → the app's
return-to-journey affordance (the lens return path in `activateInstrument`,
app.ts:1001-1023) plus journey presence (T9) for the reload case.

**UI harmonisation:** the return affordance is the same
"Return to scene"-style header control the source portal already uses
(`SceneSourcePortal.tsx:8`) — one return grammar across portals and
crossings.

**Acceptance shape:** enter scene 3 of 5, cross to Expression, return →
beat 3 is focused (ref equality, provable by reordering scenes while
crossed and still returning to the same *ref*); delete the scene out-of-band
→ return discloses the honest miss, lands nowhere false.

### T12. The source/verso leg is reachable from the journey, with explicit return

**What it does:** from a scene in the journey (beat or strip), the
source/verso portal opens the scene's declarative portal target as a
surface in its disclosed placement (`preview|overlay|beside|full|
detached|re_dock`), and "Return to scene" closes it — the TD4 leg
"inspect/open source/verso" completed inside the journey flow.

**Reference behavior attained:** the mechanism exists and is native
(`scenePortal.ts:11-33` resolves the trigger from the native Scene;
`associateScenePortal` opens it through `worldOp portal_open`;
`SceneSourcePortal.tsx` carries the explicit return); the target is
reaching it from the journey surface rather than only the Expression
editor.

**Landing seam:** the beat surface's per-beat portal affordance → the
existing portal resolution path; **Consumes lane-3: selection/inspection
surface** for the placement chrome (§Dependency 2).

**UI harmonisation:** portal placement previews use the shared surface
grammar (the portal's own CSS family); the return control is T11's return
grammar.

**Acceptance shape:** a scene carrying an `occasion:'activate'`,
`kind:'portal'` trigger shows its portal affordance on the beat; opening
it surfaces the target source in the disclosed placement with the
subject binding intact (`data-source-ref` present); "Return to scene"
restores the journey position (T11 proof applies).

### T13. Honest absence everywhere — a surface with no facet says so

**What it does:** every journey/palace surface reports missing facets
from the reading's own disclosure: no scene refs → the disclosed reason
(T1); no Expression bound → the honest refusal (`compose.ts:88-91`,
`wikiReadingProvider.ts:23-31`); no QL/temporal/spatial facet → the beat
frame simply carries none, never fabricated metadata
(TECHNE-DUAL-READING.md §3: "It does not fabricate metadata or silently
choose another subject").

**Reference behavior attained:** Twine's honest `BrokenConnection`
rendering — the map shows what is missing instead of hiding it
(`passage-connections.tsx:20-22` family). The one-field law raises this
from a nicety to acceptance law.

**Landing seam:** standing acceptance rule across T1–T24; the floors
already return honesty as data (`unavailableReason`, disclosure
reasons) — the surfaces must render it and never paper over it.

**UI harmonisation:** absence is rendered in the shared notice style
(same family as T9's banner) — plain reason, no error dialog.

**Acceptance shape:** for each surface, one negative case exercised:
scene-less reading, unbound subject, undisclosed action — each shows the
disclosure's own reason; no surface invents a placeholder beat, region or
source.

### T14. The integral whole composes the reading's real facets, not Expressions only

**What it does:** the palace surface offers integral regions derived from
the reading's real facets across the whole M′ field — M0′ ground (subject
and members), M1′ canvas/constellation, M2′ temporal facets, M3′ journey
beats, M4′ places, sources, agency, expressions — each region naming only
ref families the reading actually discloses (`regions.ts:77-214`). Today
the mounted palace composes Expressions only; the reading-wide integral
composition exists as tested data with no surface (FINDINGS.md §2.2, §4.5).

**Reference behavior attained:** TD6 verbatim: "Compose several real
subjects/Expressions/Views/Journey elements into the M5′ whole."
Twine's story is a whole made of addressable units of different kinds
(passages, story metadata, stylesheet — `stories.types.ts:55-91`); the
palace whole is made of the reading's own refs.

**Landing seam:** `src/techne/m0m5/palace/regions.ts` `palaceRegions`
(first consumer) → the mounted palace studio section
(`palaceInstrument.tsx`, opened at `app.ts:1018-1019`); durable regions
still land as real region Scenes of the Palace's own Expression via
`composition.ts` (`scene_body_set` one-member law, `composition.ts:19-37,
350-369` — unchanged).

**UI harmonisation:** region cards use the Expressions-family card
grammar; each M′ family's region keeps its native inspector fields
(temporal facets read as timeline chips, places as place chips) —
dual-reading §7: common grammar, native controls.

**Acceptance shape:** a reading with ground + temporal + place + source
+ expression facets shows all those regions, each carrying verbatim refs
(DOM compare against the reading); a facet-less region is absent with no
placeholder; saving lands region Scenes whose bodies carry exactly the
one member each (`discoverRegions` readback matches).

### T15. Arrangement is free spatial composition — pure presentation over the whole

**What it does:** regions and elements arrange freely on a zoomable,
draggable board: positions are presentation state on the card; grid-snap
and marquee selection are authoring aids; nothing semantic moves. The
fixed 3×2-rooms × 4-loci floor (`composition.ts:87-90`) remains available
as the *method-of-loci* arrangement (T17), not as the only layout.

**Reference behavior attained:** Twine's story map is the direct
reference: free `left/top` on every passage card, `snapToGrid` as an
aid never identity, draggable/zoomable canvas with marquee selection
(`stories.types.ts:8-53`, `passage-map.tsx:1-40`). TD6: "arrangement is
composition/presentation state."

**Landing seam:** the palace studio section becomes the board (replacing
the linear region list for arrangement, keeping the list as the walk
order); arrangement state persists via T21's presentation store.

**UI harmonisation:** drag/zoom/marquee feel matches lane-3's canvas
grammar (their Blender/Kdenlive drag-snap RE basis) so arranging a palace
and arranging a timeline feel like the same house gesture. **Consumes
lane-3: selection/inspection surface** for marquee→inspector handoff.

**Acceptance shape:** drag three regions anywhere, zoom, marquee-select
two → reopening (same session, T21) shows the same arrangement; the
underlying region Scenes' order and bodies are untouched by pure moves
(kernel document byte-identical before/after a move-only interaction).

### T16. Objects stay independently addressable — Open, with honest connections

**What it does:** every element on the board opens in its own instrument
(portal "Open" — the summon path already mounted,
`palaceInstrument.tsx:98-111`); where composition is declared between
elements, the board *derives* the connection lines and renders broken or
self references honestly instead of hiding them.

**Reference behavior attained:** Twine's map derives arrows from content
(`parseLinks.ts:63-77`) and names its honest edge kinds
(`BrokenConnection`, `SelfConnection`, `StartConnection`); TD6: "each
underlying object remains independently addressable."

**Landing seam:** the existing region portal triggers
(`composition.ts:371-381`) for region members; derived-connection
rendering over the guided path (the Palace's own scene order,
`composition.ts:385-401`) — the path *is* the declared composition, so
the board draws it and any gap in it (a named-but-missing member renders
broken, not invisible).

**UI harmonisation:** connection lines and edge markers adopt the
canvas layer's stroke vocabulary; "Open" uses the shared summon/menu
grammar.

**Acceptance shape:** Open on any region/element lands in that object's
own instrument with its subject_ref intact (T10's identity proof);
reorder the guided path → the board's drawn path follows without any
re-authoring; rename-remove a member out-of-band → the board shows the
broken edge on next readback (`discoverRegions` drives it).

### T17. The guided integral walk — method of loci over the whole

**What it does:** a walk mode traverses the arrangement in spatial or
authored order with wrap, focusing one locus at a time
(`recall.ts:27-62`), starting from a *named* entry (the palace's start
locus — Twine's `startPassage` standing, `stories.types.ts:74-77`), over
the full integral board, not the 3:3 expression floor alone.

**Reference behavior attained:** the mnemonic walk floor is tested and
unmounted (FINDINGS.md §2.2); Twine contributes the named-start law;
Godot's travel contributes path legibility during the walk (T8's edge
rendering, applied to loci).

**Landing seam:** `src/techne/m0m5/palace/recall.ts` (first consumer) →
the palace board's present/walk mode; walk position rides the same
session-presentation store as arrangement (T21).

**UI harmonisation:** walk chrome is the playback transport grammar
(recede at fullscreen, **Consumes lane-3: fullscreen/focus chrome**); the
craft bar applies — a walk may *hold still* at a locus; nothing forces
per-locus churn.

**Acceptance shape:** walking N regions from the named start visits
each occupied locus in order and wraps; leaving mid-walk and returning
resumes at the same locus; an empty palace's walk honestly focuses
nothing (`recallAt` normalisation, recall.ts:27-35).

### T18. Archaeology honesty on every region — warranted structure vs free composition

**What it does:** each region displays its own standing: regions standing
in warranted QL structure say so with their provenance; free mnemonic
composition says that plainly (`regionArchaeology`, `regions.ts:281-291`)
— the palace never dresses free composition as warranted structure.

**Reference behavior attained:** the audit's law in palace form — claims
carry their standing; TD6's "attributable" requirement starts here: you
cannot attribute what will not say what it is.

**Landing seam:** `regions.ts` `regionArchaeology` (first consumer) →
region card inspector panel; **Consumes lane-3: selection/inspection
surface** (§Dependency 2).

**UI harmonisation:** standing renders as the field's provenance-chip
language (same family as source selectors in the beat frame).

**Acceptance shape:** a QL-warranted canvas region shows warrant class +
provenance ref; a hand-arranged region shows the free-composition line;
screenshot pair proves the two treatments are visually distinct.

### T19. Explicit Return: a recognised result returns as an attributable proposal

**What it does:** closing the integral walk, the author composes a
Return: a shaped input carrying the composition's native refs in
arrangement order plus region intent, routed to the reading's disclosed
governed-write action (e.g. `aikit.wiki.stage`, `return.ts:51-108`); a
refused or undisclosed route yields an explicit unrouted receipt that
mutates nothing; on success the M0′ ground re-opens on the same session
(`return.ts:128-139`). The palace's Save is an Expression edit — Return
is the *other* half of TD6, and it has no surface today (FINDINGS.md
§4.6).

**Reference behavior attained:** TD6 verbatim: "one recognised result can
return as attributable Wiki/source proposal/accepted knowledge through
the native owner." The floor is complete and tested; the target is the
mount plus the governance being legible (proposal → await
human-acceptance, per the agency floors' `propose-await-human-acceptance`
stance, `agent.ts:155-167`).

**Landing seam:** `src/techne/m0m5/palace/return.ts` (first consumer) →
a Return panel in the palace studio; routing through the shared adapter
(`resolveActionRoute`, the same routing `sequence.ts` uses); closure via
the crossing affordance into M0′.

**UI harmonisation:** the Return panel uses the shared
proposal/receipt grammar (the same toast/notice family as T2's refusals
and T13's absences); attribution (who proposed, from which reading
basis) is rendered, never implied.

**Acceptance shape:** compose regions → Return → one routed action
carrying the arranged refs + intent, governance
`propose-await-human-acceptance`; refuse it → the unrouted receipt is
rendered and the composition/reading is byte-unchanged; accept it →
M0′ re-opens on the same DisclosureSession (`returnCrossing`) with the
returned material at its native owner.

### T20. Semantic saving: the kernel Expression stays the only store of record

**What it does:** everything durable about journeys and palaces saves as
`oi.expression/v1` state through the kernel's CAS-gated edit: scene order
(`scene_reorder`), scenes (`scene_create`/`scene_remove`), scene material
including duration and per-edge transitions (`scene_material_set`,
`oi.journey-scene/v1` envelope), whole-journey presentation
(`oi.journey-properties/v1`), palace region Scenes with their one-member
bodies, portal triggers and guided order. Every proposal carries the
snapshot revision (`expected_revision`); a `revision_conflict` is refused
loudly with the draft preserved; replay of an applied composition emits
nothing (idempotence by diffing against the live snapshot).

**Reference behavior attained:** the kernel's own operation guard — one
edit carries at most 256 changes against a 2048-object bound
(`kernelComposition.ts:138-147`) — and Godot's resource discipline:
transitions are `Resource`s saved with the state machine, never a side
file. Lane 3's Kdenlive RE basis (request-functions with their own
inverse) is the operation-architecture this already matches.

**Landing seam:** `kernelComposition.ts` / `composition.ts` as they
stand — the target binds every new surface (T1–T19) to these two
composition floors, no third write path.

**UI harmonisation:** save/receipt feedback uses the app's existing
markSaved/toast channels; conflict handling shows the preserved-draft
state in the notice grammar.

**Acceptance shape:** save under a stale revision → loud
`revision_conflict`, draft intact, nothing partially written; replay the
same composition twice → second save is a no-op ("Nothing to save",
`palaceInstrument.tsx:151-152` already proves the pattern); reopened
kernel document reproduces scenes, order, bodies, triggers and material
(readback-verified, the palace Save's existing double-check).

### T21. Presentation saving: journey and palace presence get real, honest persistence

**What it does:** the two presentation stores become actual persistence:
(a) journey presence (position + draft; T9) under
`oi-cradle.techne-journey.presence.v1`; (b) palace arrangement, walk
position and bookmarks — today an in-memory Map that dies with the
session (`palace-state.ts:8-13, 35-37, 73-84`) — gain the same
discipline as `presence.ts`: serialisable, saved on change, restored on
mount, keyed by `subject_ref\0reading_ref`, strict validate-then-accept,
corrupt payloads degrade to no presence, storage refusal degrades to an
unpersisted session. Basis standing is disclosed on restore
(current/field-advanced/stale). Nothing semantic ever enters these
stores — refs and presentation values only.

**Reference behavior attained:** Twine persists the story map's
presentation (positions, zoom) with the story; the cradle's own layout
persistence (`src/surface/persist.ts`, the discipline presence.ts names)
is the house pattern.

**Landing seam:** `src/techne/m0m5/journey/presence.ts` (exists, wire
it); `src/techne/m0m5/palace/palace-state.ts` (add the presence store
beside the session Map — its own header already names app-restart
recovery as "a recorded join on the owner's presentation-artifact
path"; this target is that join).

**UI harmonisation:** restore banners (T9 grammar); bookmarks render in
the shared list-control style.

**Acceptance shape:** arrange a palace, bookmark two loci, reload →
arrangement, walk position and bookmarks restored with a `current`
standing; advance the reading out-of-band → `field-advanced` disclosed;
corrupt the store → honest empty restore, no error; private-browsing
(storage refused) → the session works and simply does not survive, told
once.

### T22. The browser-local journey library gets an explicit standing

**What it does:** resolves FINDINGS gap 7: `oi.field-studies.journey-library.v1`
currently holds full journey documents browser-locally, and the app's
boot can open from it, so two sources of journeys coexist silently. The
target: documents authored fresh in the app are labelled local work
until first saved to the kernel; library entries record their origin
(kernel-ref vs local-draft); boot prefers the kernel-bound document when
one exists, with the library as explicitly-local scratch beneath it. No
silent coexistence; no deletion of local work.

**Reference behavior attained:** lane-3's Shotcut/MLT RE basis — the
autosave/recovery file is a named, recoverable artifact, never a second
silent truth; Twine's library is explicitly a *local* library with
publishing as a separate act.

**Landing seam:** `store.ts:2,20-35` + `applyJourney`
(`app.ts:444` — `saveToLibrary` on every open) gain the origin record;
the kernel boot path decides precedence.

**UI harmonisation:** local-only documents wear the same
local-draft treatment lane 3 gives unsaved editor work (badge in the
masthead/library list grammar).

**Acceptance shape:** author a journey without a kernel binding →
library entry marked local; open a kernel Expression → library entry
marked with its expression ref and the kernel copy wins on boot
conflict; no entry is ever silently dropped (the store's
byte-for-value retention law holds, store.ts:30-35).

### T23. Journey ↔ scene ↔ source identity chain (the TD4 navigation contract)

**What it does:** the whole chain — reading → beat → scene in the living
Expression → source/verso → back through scene → back to journey — is
one navigation contract with one identity: `subject_ref`,
reading basis, selection and agent-session preserved at every hop
(T10–T12 mounted together); host commands and `oi-app-state` position
announcements stay the transport (`hostedApp.ts:440-462, 498-514`); a
reload re-enters via presence (T9) and return re-enters by ref equality
(T11).

**Reference behavior attained:** TECHNE-DUAL-READING.md §3's
preserved list, TD4's passage chain, and TD8 (cut continuity) for the
repeated-crossing case.

**Landing seam:** composition of T9–T12; the session store owns state,
the crossing floor owns law (`crossing.ts` header: "the store owns the
state").

**UI harmonisation:** each hop reuses the lens/announce mechanics; no
new navigation chrome.

**Acceptance shape:** walk the full TD4 chain and back twice (TD8-style
repeat): refs byte-identical at start and end; hidden heavy renderers
suspend on crossing (no duplicate engine loops — assertable via the
research-instruments close path, `app.ts:1012`); every hop is announced
honestly in `oi-app-state` (playing state, scene, save state).

### T24. Palace → objects navigation: bookmarks and the named start

**What it does:** from the palace, every object navigates to its own
instrument with identity intact (T16's Open at board scale); bookmarks
are named positions (basis + locus + focused ref) that jump the
board+walk to that state (T21's persistence carries them); the palace's
named start (T17) is the default landing. "Return to ground" closes
into M0′ per T19's crossing.

**Reference behavior attained:** TD6's addressability law plus Twine's
start-passage: a whole with a named entry and addressable members;
bookmarks are the palace's own addition over the tested
`PalaceBookmark` floor (`palace-state.ts:73-84`).

**Landing seam:** `palace-state.ts` bookmarks + `recall.ts` focusing →
the board; portal summon path for member instruments (already mounted,
`palaceInstrument.tsx:98-111`).

**UI harmonisation:** bookmark list uses the shared list/inspector
grammar; "Return to ground" is T11's return control in the palace's
header.

**Acceptance shape:** Open on each region family lands in the right
instrument on the same subject (M2′ beats → journey beat, places →
place, sources → source surface); a bookmark restores board position,
walk index and focus in one hop; "Return to ground" re-opens M0′ on the
same session with the palace receipt rendered when a Return preceded it.

## What stayed unverified

- **Lane 3's TARGET-SET.md was absent at write time** (checked twice,
  latest 2026-10-07 11:20): the five consumption sections in §Dependency
  are *expected sections*, named from lane 3's landed FINDINGS/RE-TARGETS;
  the integrator reconciles at convergence. T5/T8's runtime-blending
  acceptance and T6's snap feel inherit this uncertainty.
- The hosted app's build was still not exercised at runtime in this
  continuation pass (static reading + the predecessor's evidence); the
  transition-runtime claims remain code+contract-read, not run. Acceptance
  shapes above are written to be executed in phase 3.
- T5's per-edge transition *persistence* generalises the existing
  scene-material envelope; whether the envelope needs a schema revision
  (pair-keyed transitions vs per-scene entry-transition) is a phase-3
  design decision against the kernel's Change union — the target names
  the outcome, not the envelope encoding.
- Godot runtime xfade behavior and Twine publishing remain as
  RE-TARGETS.md §5 records them (headers/editor read; nothing built or
  run; scratch pinned at 2026-10-07).
- The palace presentation store (T21) is a new persistence surface in a
  floor whose header explicitly deferred it ("a recorded join") — its
  key scheme and degradation paths follow presence.ts but are unproven
  until implemented.
