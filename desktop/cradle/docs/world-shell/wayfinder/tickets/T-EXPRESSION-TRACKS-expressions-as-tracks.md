# T-EXPRESSION-TRACKS — Expressions are tracks, scenes are clips, two sides each

Label: wayfinder:task
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
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

## Lead's design (13 Oct 2026) — code legs only; the UI mount waits for the screen gate

**Contract** (`src/timeline/worldTrackAdapter.ts`, family-free, optional):
`WorldTrack` gains `groupId?: string` (the track a lane belongs to) and
`lane?: 'visual' | 'audio'` (lock §9.3: one track, two sides).

**The Timeline level** (`src/timeline/expressionsTrackAdapter.ts`):
`projectExpressionsWork(reading: ExpressionsWorkReading): WorldTrackSet` with

```ts
interface ExpressionsWorkReading {
  expressions: {id: string; name: string;
    scenes: {id: string; name: string; duration: number; takes?: {id: string; name: string}[]}[]}[]
  stops?: {id: string; name: string; scenes: {expressionId: string; sceneId: string}[]}[]   // Live's scene rows
}
```

- tracks: per Expression two lanes, `expression:<id>:visual` and
  `expression:<id>:audio` (`kind` `expression-visual` / `expression-audio`,
  `groupId` `expression:<id>`, `lane`);
- clips: each scene is a clip on **both** lanes, ids
  `scene:<expr>:<scene>:visual|audio`, same span (scenes laid end to end by
  duration within their Expression — the two sides stay locked);
- columns: one per stop when stops are given (a scene sits in the stop that
  names it; a scene no stop names sits in a trailing `unstopped` column);
  without stops, one column per scene position (`position:<n>`);
- takes: `transport.takes`, one per scene take, `target`
  `scene:<expr>:<scene>`.
`expressionsTrackAdapter.project` becomes `projectExpressionsWork`.

**The sequence editor** (new `src/timeline/expressionsSequenceEditor.ts`,
the inside of one scene — lock §9.4 note-editor row): today's
`projectExpressionsTracks` logic moves here as
`projectSceneSequence(reading: ExpressionsTrackReading)` returning
`{lanes: {id, entityId, name}[]; notes: {id, laneId, start, length, glide, label}[];
envelopes: {id, target, enabled}[]; takes: WorldTrackTake[]}` where
`length` = hold and `glide` = transition (a step's hold + transition = a
note's length + glide), plus `sceneSequenceAsTracks(reading)` returning
exactly today's WorldTrackSet (the old function's output, byte-for-byte) so
"no step lost" is provable by deep-equal. Port law: cite the old adapter's
lines and the Expressions app's own sequence model
(`desktop/cradle/expressions-app/src/engine/types.ts` — the step's
hold/transition) by path:line.

**Tests**: `tests/expressions-track-adapter.test.mjs` (rewritten:
Expressions → two-lane tracks, scenes → clips on both lanes with equal spans,
stops → columns, takes on scenes); a sequence-editor case that deep-equals
`sceneSequenceAsTracks(fixture)` with the pre-change projection of the same
fixture (pasted as an expected literal) and checks length/glide;
`tests/timeline-time-spine.test.mjs` updated only where it calls
`projectExpressionsTracks`.

Not in this ticket: mounting the sequence editor in the Expressions Clip
detail (a UI leg; PATH §3 — no new UI on unseen UI). It is the next ticket
once the screen pass has run.

## Resolution

**Code legs landed (13 Oct 2026; builder haiku ×1, converged by the lead).**
- Contract: `WorldTrack.groupId?` and `lane?: 'visual' | 'audio'`
  (family-free).
- Timeline level: `projectExpressionsWork` — each Expression two lanes
  (visual, audio) under one group; each scene a clip on both lanes with one
  span; stops are columns (a trailing `unstopped` column when needed;
  position columns without stops); takes target their scene. Lead's ruling
  on the builder's open point: spans are **column-local** (the contract's
  law) — a scene starts at 0 in its stop's column, scenes sharing a column
  lie end to end; order across stops is the columns' order.
- Sequence editor: `expressionsSequenceEditor.ts` — `projectSceneSequence`
  (entity lanes; notes with length = hold, glide = transition; envelopes
  with an optional `modulatedBy`; takes) and `sceneSequenceAsTracks`, which
  deep-equals the pre-change projection (no step lost). Ported from the old
  adapter (HEAD lines 79-135) and `expressions-app/src/engine/types.ts:193-207`.
- Scripted: tsc 0; expressions-track-adapter, timeline-time-spine,
  timeline-walks, ql-musical-timeline → 58/58.

**Carried:** mounting the sequence editor in the Expressions Clip detail
(UI; after the screen pass) — **T-SEQUENCE-EDITOR-MOUNT**. The live
Expressions reading feeding `projectExpressionsWork` (no producer yet).
The registry key `expressions-tracks` (`registerWorldTrackAdapters.ts:45`)
differs from the manifest's `expressions-track-adapter`; harmless today
(the Expressions manifest is not at the door), reconcile with the mount.
