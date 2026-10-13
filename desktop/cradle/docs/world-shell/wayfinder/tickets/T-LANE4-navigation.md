# T-LANE4-NAV — Places: pitch/bearing, fly-to by precision, the precision marker grammar

Label: wayfinder:task (Phase 4 · lane 4)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-4-world-places/TARGET-SET.md` T1, T2, T10 (register `lane-4:T1`, `T2`, `T10`).

## Resolution

**Landed (13 Oct 2026; builder haiku, converged by the lead).** The Places
map (research canvas `psychogeographic/`) carries pitch and bearing
(drag/touch rotate and touch pitch; flat mode holds top-down; a readout in
the map's own chrome); `flyToPlace` derives zoom from the facet's
`precisionMarker` kind (exact 16, approximate 11, region 4, unlocated: no
flight, named for the register) with the Canvas's cubic in-out easing and a
duration by angular distance; markers take four renderings from the
authority (solid, halo, dashed outline, register-only — never at 0,0) with
the uncertainty note beside them. `placeNavigation.ts` imports the cradle
authority (`project.ts`, `geometry.ts`, `mapStyle.ts`) — accepted. Lead
accepted the visible change: selecting a place flies to its precision zoom.
Scripted: places-navigation 20 + place-reading 8 (28/28); tsc 0; the
read-only render harness passes; PROVENANCE refreshed (lead).

**T-LANE4-NAV-b (lead, persistence):** the saved place viewport admits
optional `pitch` [0,85] and `bearing` [-180,180] — kernel validator
`desktop/cradle/kernel/src/expression_scene.rs:427-438`, app
`researchMaterial.ts:117` (`validateViewport`, `ResearchViewport`), then the
host (`researchInstruments.tsx:691,709`) switches to
`viewStateFromPlaceRecord` / `placeRecordFromViewState` (kernel first —
the helper only emits pitch/bearing for a tilted view).

## Resolution — T-LANE4-NAV-b (persistence, lead)

**Landed (13 Oct 2026).** The kernel's research viewport validator
(`expression_scene.rs` `validate_research` → `viewport`) admits optional
`pitch` [0,85] and `bearing` [-180,180] — earlier records unchanged, no
other unknown field admitted (unit test); the app's `validateViewport` and
`ResearchViewport` match; the Places host restores with
`viewStateFromPlaceRecord` and saves with `placeRecordFromViewState` (an
untilted view still writes the legacy `{x,y,zoom}`). Scripted: kernel
`expression_scene` 2/2; places 28/28; tsc 0; build clean. Unverified: a
tilted view saved and restored in the native app.
