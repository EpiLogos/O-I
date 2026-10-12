# T-EXPRESSION-TRACKS — Expressions are tracks, scenes are clips, two sides each

Label: wayfinder:task
Claimed-by: —
Blocked-by: — (runs beside T-TIMELINE-WALKS on a disjoint zone; both touch
`timeline/worldTrackAdapter.ts` only if the contract changes — the lead
orders them if so)

Zones: `packages/live-shell/ui/src/timeline/expressionsTrackAdapter.ts`, the
Expressions Clip detail module in `packages/live-shell/ui/src/shell/` (or
the component it mounts), tests.

## Question

DEVICE-SEMANTICS-LOCK §9. Today `expressionsTrackAdapter.ts` projects scenes
as columns, entities as tracks and sequence steps as clips — the inside of
one scene drawn at the track level. Make the Timeline level read: each
Expression a track with a visual lane and an audio lane; its scenes are its
clips; rows are stops; takes are a scene's captured takes. Move the entity ×
step projection into the selected scene's Clip detail as the **sequence
editor** (entity lanes × steps; hold + transition = length + glide; the
automation lane = clip envelopes with their modulators), with the scene's
visual and audio sides shown in sync.

## Acceptance

- Adapter tests: Expressions → tracks (two lanes each), scenes → clips,
  takes on scenes; the sequence-editor model reproduces today's entity ×
  step content exactly (no step lost).
- Port law: the sequence editor ports from the existing adapter and the
  Expressions app's own sequence model (cite path:line); no second store.
- tsc zero; timeline suites green. UI legs UNVERIFIED until the screen pass.

## Resolution

—
