# T-E05 — Trim: duration edge drag

Label: wayfinder:task (Phase 4 · lane 3; UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:197` (register `lane-3:E05`).

## Resolution

**Code landed (13 Oct 2026).** A 6 px right-edge zone on each timeline clip;
the drag previews through the document and `expressionTiming` (one clock),
commits once on pointer-up as `changed(…, "Trim scene <name>")` (one
labelled undo entry — E15's labelled `store.change`); the save rides the
existing `scene_material_set` for exactly that scene. `durationFromEdgeDrag`
clamps at 1 s / 3600 s and names the limit (toast), never a silent snap;
Alt or double-click opens the timeline's exact Hold input. Scripted: trim
12 + layout 9; scene suites unchanged (75/75); build clean. Unverified
(native pass): drag feel, the edge drifting under the pointer as the
proportional total changes (scale fixed at drag start), click suppression,
WKWebView dblclick/Alt, the clamp toast, the kernel receipt (revision + 1).
The 1/3600 constants mirror `model.ts` until E02 exports them.
