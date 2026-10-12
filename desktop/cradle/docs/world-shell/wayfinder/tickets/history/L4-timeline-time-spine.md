# L4 — Timeline projection and the time spine (seams 5, 7)

Label: wayfinder:task (execution lane)
Claimed-by: — (work complete; commit sequenced — see resolution)

## Resolution — 2026-10-09 (zcode:timeline-spine-l4; commit SEQUENCED behind the native composition parent's timeline/ landing)

**Seams landed (uncommitted in the seat, work verified):**
- **Seam 7 — the time spine** (`src/timeline/timeSpine.ts`): Now (read
  civil field, never a wall clock) · Occasion (retained snapshot basis +
  separately-qualified current admission — the K8 behaviour) · Transport
  (playhead, drives nothing) · Chronos (read-only binding surface, honestly
  empty until QL binds) · Cron (cadences as parameters; every real firing
  lands as a Timeline clip). Pure, no timers.
- **Seam 5 — World track adapters**: day (civil days from `day_ref`;
  undated material in a relative column — no fake dates), run (the owner's
  12 admitted runs from `agency_read`), conversation (session-space
  receipts) — all over the kernel's ONE `temporal_events_read`, no second
  store. Poller `src/projections/useWorldTemporalReading.ts` (the
  receiving pattern ported); **real finding: day-bounded cache keys keep
  K1's horizon warm — ~10 s cold / ~13 ms warm live**.
- **The World cut** (`src/projections/worldTimelinePresentation.tsx/.css`):
  the mockup's Timeline forms — era ruler + declared break into the civil
  week strip, four lenses, epistemic-standing chips never upgraded by
  placement, now/occasion/transport cursors, §8 chips with the data-i law.
  Atlas scale adopted by import (never re-ported). Additive `world?` prop
  on `timelineResidence` (L1 pattern); native cut keeps precedence; audio
  DOM byte-identical. `useSet`/`document.ts` deliberately untouched —
  adapters proved additive (named in UNVERIFIED).
- **The found `timeline/` composition** (FOUND-TIMELINE.md): the parent's
  untracked `worldTrackAdapter.ts` contract adopted as THE shape; their
  `expressionsTrackAdapter.ts` registered unedited.
- **The aion patch**: sound, adapted at landing (family-named duck-typing
  removed from the neutral door; real manifest verification; distinct lane
  door); registry `registerWorldTrackAdapters.ts`. The pane-side jump
  consumer stays unlanded (needs the atlas mounted bundle).

**Executed against the LIVE bridge** (scripted; computer use still blocked
machine-wide): day track 18 clips + run track 12 admitted lanes visible;
occasion A→B→A retains A's exact basis, admission light unlit until
qualified; one cron firing landed as a clip; zone typecheck 0; unit 10/10;
guard native-composition-views **29/29**. Cross-lane named at baseline: 34
pre-existing at-HEAD type faults (stage/VisualsView/visuals store, pulled
via boundary imports — none this lane's). Unverified: no App.tsx wiring
(the encounter-admits-the-World-cut is the shell integrator's move); run
lanes honestly empty of clips (the week's read carried none); the atlas
jump unexercised end-to-end; the computer-use leg.

**⚠ Commit sequenced:** every L4 file imports the parent's untracked
`src/timeline/worldTrackAdapter.ts` contract (+ their
`expressionsTrackAdapter.ts`, registered) — staging L4's files alone would
commit against files the tree doesn't carry at that commit. **The
orchestrator commits when the native composition parent lands its
timeline/ work** (staging list prepared: src/timeline/{timeSpine,
dayTrackAdapter, runTrackAdapter, conversationTrackAdapter,
registerWorldTrackAdapters}.ts + src/projections/{useWorldTemporalReading,
worldTimelinePresentation.tsx, worldTimelinePresentation.css} +
timelineResidence.tsx hunk — the parent's own two files land with THEIR
lane's commit, before or together). Status: **work resolved; landing
sequenced per the map's hand rule.**

Zones: `SessionView`/`ArrangementView`, `useSet`/`document.ts` adapters, new
time-spine module.

## Question

World track adapters over the set model: day tracks, Factory run tracks,
conversation clips, expression tracks — the timeline is a projection of
existing events, not a second store. Now/Occasion/Transport controls over the
two-clock bridge (civil keeps closure law; transport is the projection's
playhead; occasion retains snapshot basis with separately-qualified current
admission). Port the atlas non-linear time scale for deep time. Stand up the
cron stratum: families declare cadences as parameters; the spine fires; every
firing lands as a Timeline clip.

## Evidence / acceptance

A day track and a run track visible in the Timeline projection; an occasion
switch retains its basis; a cron firing lands as a clip; checks pass.
