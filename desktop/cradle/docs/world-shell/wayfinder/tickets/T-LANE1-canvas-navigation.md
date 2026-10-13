# T-LANE1-NAV — Canvas: alignment guides, overview, zoom and fit

Label: wayfinder:task (Phase 4 · lane 1)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-1-canvas-graph/TARGET-SET.md` A1, A5, A6 (register `lane-1:A1`, `A5`, `A6`).

## Resolution

**Landed `37b40b30d` (13 Oct 2026; builder haiku, converged by the lead).**
`navigationGeometry.ts` (guide segments, zoom steps centred on the pane,
fit-all and fit-selection bounds), the `CanvasGuides` and `ZoomReadout`
overlays (under the vendored canvas, recorded as PROVENANCE `overlays`), and
the wiring in `researchInstruments.tsx`. A single-card drag snaps through the
cradle authority `snapPosition` (`src/techne/m0m5/canvas/interactions.ts`;
imported, not copied — accepted, as the expressions tree does elsewhere) at
8 px ÷ zoom, with guides that clear on release; the grid composes after the
guides. Keys: `+`/`=` zoom in, `−` zoom out, `0` resets to 100 % (accepted,
following tldraw), Shift+1 fits all, Shift+2 fits the selection. The
readout fades. A5's corner minimap had already landed
(`CanvasNavigationOverview` with the shared `NavigationMinimap`), so FINDINGS'
"no minimap" is stale. Scripted: canvas-navigation 15/15; the canvas suites
170/0/3 skipped; tsc 0; verify-source passes.

**T-LANE1-NAV-b (dispatched 13 Oct 2026):** an explicit zoom floor in
`CanvasView.tsx` (xyflow's default 0.5 stops a 50-card fit), reduced motion
for every camera move (one duration helper), the vendor +/−/Fit row
suppressed when the host supplies its own controls (the standalone canvas
keeps it), an icon toggle for the overview in place of standing text, and
edge-to-edge snapping by extending the authority `snapPosition`
(centre-only behaviour stays unchanged when no sizes are given).

Unverified (native pass): the guide render mid-drag, the controls' layout
beside the minimap, key handling in WKWebView.
