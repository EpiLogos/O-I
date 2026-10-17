# T-TRACKS-TECHNE — Technē's readings as tracks, its walks as stops

FOUNDATION §3 F3 (one Session and Arrangement; each mode supplies its tracks by registration). Central's five streams
(`useCentralTracks`) and Factory's sessions (`useFactoryTracks`) landed on 14 Oct; Technē still stands on the World
cut's merged sets (`modeTracks.ts` `worldTracks`). Builder: Sonnet. 14 Oct 2026.

## Realises

Manual `docs/dlw/DLW.md` §3 (Session and Arrangement are the same tracks two ways) and §8 (Technē: readings laid on one
ruler; a walk stops at events and launches the scenes they carry). Lock §9.1 Technē row: track = a native stream (a
reading's thread, a subject's occurrences, a journey, runs, revisions, sky); clip = an event, occurrence or revision at
its time and place; stop = a **walk stop** (it stands its event and launches the Expression scene(s) it carries); takes =
readings that extend a reading (layers, never rewrites). Lock §9.2 (a walk). `shell/modeGrammar.ts` Technē meanings
("readings … walk stops", "one ruler", provenance "lock §9.1 Technē row").

## The contract

`timeline/worldTrackAdapter.ts` (`WorldTrackSet`, tracks/clips/columns/ruler/actions); the references
`timeline/centralTrackAdapter.ts` + `frame/tracks/useCentralTracks.ts` (a pure adapter + a hook over the published
`TracksReading`, reading owners already in the frame — never a second poller) and `timeline/factoryTrackAdapter.ts`.
The published reading carries `world` (the World cut's one temporal read) and `transport`.

## Sources to port (find each; name path:line)

The World cut's Technē streams in `projections/useWorldTemporalReading.ts` and the adapters it merges
(`timeline/*TrackAdapter.ts`), the journey walks (`grep -rln "walk" src/projections src/timeline src/frame`; the
journey-walks test names them), the M2′ ruler readings, and the atlas places through `provider/suiteStanding.ts`
(N3). A stream without an owner read stands as a named, empty track — never a fabricated clip.

## Zone

`packages/live-shell/ui/src/timeline/techneTrackAdapter.ts`, `packages/live-shell/ui/src/frame/tracks/useTechneTracks.ts`,
`packages/live-shell/ui/tests/techne-tracks*.test.mjs`. Not `modeTracks.ts` (the lead wires it); not the shared views.

## Done when (lead, on screen)

Technē's Session shows its streams as tracks with their events as clips and walk stops as rows; Tab shows the same
clips on one ruler; selecting a clip selects it everywhere (THE selection); a walk stop launches what it carries
through the owner path that exists, and has no action where none does.
