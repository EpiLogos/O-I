# T-E11 — Typed, parameterised transitions

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md` E11 (register `lane-3:E11`); E09b rides the same commit.

## Resolution

**Landed `3bff4eec2` (13 Oct 2026; builder haiku, converged by the lead).**
`transitions.ts` defines the kinds, all validated by name and bounded in
`validateJourney`:
- `cut`;
- `crossfade`, the default — an absent kind is byte-identical, and the test
  pins it;
- `dip-to-colour`, through the incoming scene's `field.background`;
- `wipe`, in four directions.

The spec is a timeline fact (`SCENE_TIMELINE_FACTS`) carried whole in the
scene material through `scene_material_set`; there is no new Change kind. The
journey timeline shows a seam glyph between clips. Its chooser covers kind,
parameters and duration, and each change is one labelled undo entry ("Set
transition <kind>"). The preview engine paints dip and wipe, and capture
composites painted frames.

Lead rulings:
- The seam write moved into `writeSeamTransition`, still inside
  `applyTimelineMove`; the app-wiring gate holds.
- A committed curve keeps the field evaluating at the playhead while paused,
  as Live shows automation at the stopped playhead.
- Act passages keep crossfade.

E09b, in the same commit:
- the field previews during a curve drag;
- range refusal checks only the touched keys;
- the curve gesture's time-order refusal reads "Keyframes stay in time order."

Scripted: transitions 9 and curve-lane 24; field-studies 627 pass / 0 fail;
both builds are clean.

**E11b (landed `e33c08971`):** a transition pass in the production engine, since the
native app renders there:
- dip exact at the midpoint;
- wipe holds the outgoing frame;
- no pass when inactive;
- capture includes the overlay;
- the inspector carries the same control.

Unverified (native pass): the four named mid-transition screenshots, the
dip pixel check, and whether the seam glyph overlaps the trim edges.

E11b as landed: `transitionPass.ts` composites the native field through a
live render target. Dip is exact at the colour point (shader formula
mirrored and asserted on CPU: `#f4f2eb` → 244,242,235). Wipe holds the
outgoing frame. With no painted transition, `present()` returns false and
the old render call runs. PNG and video capture carry the overlay, and the
inspector uses the seam chooser. A wipe no longer crossfades particles.
Open: the engine imports `field-studies-journeys/transitions.ts`; the pure
helpers may move into the engine.
