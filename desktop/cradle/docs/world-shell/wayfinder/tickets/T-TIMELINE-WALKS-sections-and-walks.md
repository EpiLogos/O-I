# T-TIMELINE-WALKS — Sections and walks in the Timeline; the Journey reads them

Label: wayfinder:task
Claimed-by: claude-code:dlw-lead (13 Oct 2026) — leg 1 builder: haiku ×1; leg 2 (the Journey binding in shell/modeGrammar.ts) after T-LABELS
Blocked-by: — (T-AE-REPORT landed `68e0b8ba5`)

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

## Lead's design (13 Oct 2026)

**Leg 1 — the contract and the four walk projections (builder).**

`src/timeline/worldTrackAdapter.ts` gains, all optional (existing adapters
and renderers stay valid):

```ts
export interface WorldTrackLayer { id: string; name: string; extends?: string }      // a reading; later readings extend, never rewrite
export interface WorldTrackSection {                                                    // Live's locators, nested
  id: string; name: string; span: {start: number; end: number};
  parentId?: string; layerId?: string;
  atmosphere?: string;                                                                  // the colour the narrowest section gives what plays inside it (the family's own token or hex)
}
export interface WorldWalkStop {
  id: string; label: string;
  clipId?: string;                                                                      // the clip this stop stands (same set)
  year?: number;                                                                        // tunes the transport position
  place?: {label?: string; lat?: number; lon?: number};                                 // tunes the Earth (Follow)
  also: string[];                                                                       // bucket-mates / attached material reached from this stop — nothing dropped
  sceneRef?: string;                                                                    // the Expression scene the stop launches (lock §9.2), when the material names one
}
export interface WorldWalk {
  id: string; name: string; layerId?: string;
  kind: string;                                                                         // family's own: 'aion-thread' | 'aion-whole-reading' | 'field-thread' | 'redbook' | 'dynamics-route'
  derived: boolean;                                                                     // true = computed from the material on read, never stored
  stops: WorldWalkStop[];
}
// WorldTrack gains layerId?: string. WorldTrackSet gains layers?, sections?, walks?.
export function walkReaches(set: WorldTrackSet, walkId: string): Set<string>           // every clip id + every `also` ref the walk reaches
```

`src/projections/atlas/aionTimeline.ts` re-projects Aion: **every** reading a
layer (`extends` kept); **every** epoch a section (nested by `parentId`, span
from/to, `atmosphere` = the epoch palette's core as hex via
`src/data/palette.ts`); events clips on one events track per reading; each
curated thread and the derived whole-reading walk (`src/aion/walk.ts`
`wholeReadingWalk`, `derived: true`) a walk whose stops are the events in
order (clipId, year, place lat/lon, `also` = the event's occurrenceIds) and a
walk track (kind `walk`) drawing the stops on the ruler. Columns stay the top
epochs (renderer compatibility). The history object is never mutated.

New `src/projections/atlas/walkTimeline.ts` — the same shape for:
- **field threads**: `projectFieldThread(model, type, id)` over
  `src/data/thread.ts` `planThread` (one stop per step; `also` = the step's
  bucket-mates and unplaced occurrences, as occurrence ids; year + place from
  the occurrence; `derived: true`);
- **the Red Book**: `projectRedbookWalk(model, redbook)` — sections = the
  book's sections (span from their stops' years), one stop per `stops[]` entry
  in curated order (`derived: false`);
- **dynamics routes**: `projectDynamicsRoute(route)` — sections = movements
  (span = stop index range), one stop per route stop in order, `also` = the
  stop's familyIds (`derived: false`).

Tests `tests/timeline-walks.test.mjs` over the fixture corpus
(`provider/fixtureCorpus.ts` → `buildModel`) and small inline Aion /
Red Book / route fixtures: nesting kept; every event of a thread reachable
from its walk (`walkReaches`, including `also`); the whole-reading walk is
`derived` and the history carries no stored copy; all four project through
one shape.

**Leg 2 — the Journey reads the walks (lead, after T-LABELS):** Technē's
Session (M3′) lists the walks of the projected set; Play walks them (pace,
stop n/N, arrival, Follow tunes position and Earth); the "waits for the
journey owner" text in `shell/modeGrammar.ts` goes.

## Resolution

**Leg 1 landed (13 Oct 2026, builder haiku ×1, converged by the lead).**
`worldTrackAdapter.ts` gains layers, nested sections, walks and
`walkReaches` (family-free); `aionTimeline.ts` re-projects every reading as a
layer, every epoch as a nested section with its atmosphere, events as clips
per reading, curated threads + the derived whole-reading walk as walks with
walk lanes; `walkTimeline.ts` projects field threads (planThread, `also`
kept), the Red Book and the dynamics route through the same shape. Scripted:
tsc 0; timeline-walks 12/12; timeline/atlas/mode-grammar/expressions suites
60/60; port pin check exit 0. Lead accepted the builder's four calls:
`walkReaches` counts each stop's own id (field-thread stops stand no clip);
columns are every reading's top epochs; later readings' tracks are
`aion-events:<id>`; walk lanes are new on the ruler.

**Open:** leg 2 (the Journey reads the walks) — after T-LABELS. UI: how the
Timeline draws walk lanes and nested sections — `UNVERIFIED: needs-computer-use`.
