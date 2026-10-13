# T-E12-E13 — Journey markers and the loop region

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md` E12, E13.

## Resolution

**Landed `5e7d5364a` (13 Oct 2026).**

E12, markers (Live's locators):
- The flags sit in the ruler row.
- `M` adds a marker at the playhead; `[` / `]` jump between markers.
- A drag snaps to scene boundaries within 6 px.
- Double-click renames; Delete removes; the ruler's right-click menu adds.
- Each act is one labelled undo entry.
- Markers never reach the stage (a test checks that no engine file reads them).

E13, loop region (Live's loop brace):
- `I` / `O` set in and out while the timeline is open; otherwise they keep
  their tool meanings. `\` clears the region.
- The brace edges and body drag.
- Saved-sequence playback wraps exactly at out → in (`regionWrap`), with a
  cross-scene seek.

Persistence: `compositionProperties` → `composition_set`. The lead accepted
the `kernelComposition.ts` zone exception, since that is the path that
already carries description and loop. The kernel `Composition` validates at
most 64 markers, palette colours and a bounded region.

Scripted: journey-markers 16 (plus a browser smoke of create, rename, undo
and delete); kernel `expression` tests 88 pass.

Open:
- The scene's own Play ignores the region.
- With unsaved scenes, the wrap point can drift from the ruler.
- The `?marker=` deep link waits for E22.
- The native round trip is unverified.
