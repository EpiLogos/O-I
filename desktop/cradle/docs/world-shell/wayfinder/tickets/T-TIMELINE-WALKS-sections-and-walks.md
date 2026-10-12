# T-TIMELINE-WALKS — Sections and walks in the Timeline; the Journey reads them

Label: wayfinder:task
Claimed-by: —
Blocked-by: T-AE-REPORT (the walk modules arrive with it)

Zones: `packages/live-shell/ui/src/timeline/` (the contract and adapters),
`packages/live-shell/ui/src/projections/atlas/aionTimeline.ts` and a new
walk adapter beside it, the Technē Session (M3′) binding in
`packages/live-shell/ui/src/shell/`, tests.

## Question

DEVICE-SEMANTICS-LOCK §7.2–7.4.2–3. Extend `WorldTrackSet` with nested
sections and walks (ordered stops: clip ref, year, place, `also`, the
Expression scene the stop carries). Re-project Aion: readings as layers,
epochs as nested sections (the narrowest colours), events as clips, curated
threads and the derived whole-reading walk as walks. Project AE's field
threads (`data/thread.ts` planThread — thinned with `also`), Red Book stops
and dynamics routes through the same walk shape. Technē's Session (M3′)
reads the walks; Play walks them (pace, stop n/N, arrival, Follow tunes the
position and the Earth projection to the standing stop) — the mockup's
Technē transport, already in `modeGrammar.ts`.

## Acceptance

- Contract tests: nesting kept; every event of a thread reachable from its
  walk (including `also`); the whole-reading walk derived, never stored.
- Aion, field-thread, Red Book and dynamics walks project through one shape.
- The Journey no longer "waits for the journey owner".
- tsc zero; timeline and mode-grammar suites green. UI legs UNVERIFIED until
  the screen pass.

## Resolution

—
