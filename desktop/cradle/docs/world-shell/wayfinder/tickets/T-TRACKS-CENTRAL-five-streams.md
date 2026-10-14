# T-TRACKS-CENTRAL — Central's five streams on the shared Session and Arrangement

FOUNDATION §4 (mode adapters after F3); lock §9.1 Central row. Builder: Sonnet. 14 Oct 2026.

## Realises

- Manual `docs/dlw/DLW.md` §3: "In Central the day is a track, and so are your Flows, the people and things you are
  writing about, and your goals." "A DLW clip is an entry in your day …" "In Central, the day's face stands the entries
  you made while it was turned up." §5 (the Day, Flow, Beings, Things).
- Lock §9.1: Central — track = a stream (Day · Flows · Beings · Things · Goals); clip = an entry or document; stop = the
  day's face (the die) standing its entries; takes = revisions.
- Craft floor: `world-shell-mockup.html` `sessView` / `tlBody`; the shared views already draw it
  (`frame/tracks/SessionGrid.tsx`, `ArrangementRuler.tsx`).

## Contract

`UseModeTracks` in `packages/live-shell/ui/src/frame/tracks/modeTracks.ts`: a hook `(reading: TracksReading) =>
WorldTrackSet | null` over the published reading (it carries `transport`, the kernel carrier, so the hook may read
Central's owner itself). The set is `WorldTrackSet` (`timeline/worldTrackAdapter.ts`, extended at F3 with `status`,
`launch`, `takes`, `at`, `ruler`, `actions`, `depth`). The lead wires the table line `base: useCentralTracks` on converging.

## Work

1. `timeline/centralTrackAdapter.ts`: a pure adapter from Central's readings to five tracks, always in this order:
   Day, Flows, Beings, Things, Goals (ids `central:stream:<name>`). Day's clips are the day records and their entries,
   from the reads Central mode already makes (the browser's Days rows — `shell/ModeBrowser.tsx` and the families it
   reads; the World cut's day lane — `timeline/dayTrackAdapter.ts`). Each clip's id is the ref THE selection already
   uses for that material (the Central-relative path for a day record, as `App.tsx` `selectCentralSubject` writes it), so
   selecting a clip on the grid opens it in the Document detail. Rows are the days (a day's face stands its entries);
   the ruler is civil time (`at` from each entry's instant).
2. A stream whose owner read is not landed (Flows, Beings, Things, Goals — `shell/modeGrammar.ts` names each as
   `waiting`) is a named, empty track; put the owner's absence in the track's name tooltip via `kind` text, never a fake
   clip. Return what Central does disclose and nothing more.
3. `frame/tracks/useCentralTracks.ts`: the hook that reads what the adapter needs through `reading.transport` (reuse
   the existing readers; no second store) and returns the set.
4. Tests over recorded readings: five tracks in order; a day record's clip id is the selection ref; waiting streams
   are empty and named.

## Zone

`packages/live-shell/ui/src/timeline/centralTrackAdapter.ts`, `packages/live-shell/ui/src/frame/tracks/useCentralTracks.ts`,
`packages/live-shell/ui/tests/central-tracks*.test.mjs`. Not `modeTracks.ts` (the lead wires it).

## Done when

On screen (lead): Central's Session shows Day, Flows, Beings, Things, Goals; a day's entries sit in the Day track;
clicking one opens it in the Clip side; Tab shows the same on the ruler.
