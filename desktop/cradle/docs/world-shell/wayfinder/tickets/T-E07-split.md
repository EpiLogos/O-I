# T-E07 — Split scene at the playhead

Label: wayfinder:task (Phase 4 · lane 3; UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku + lead refactor)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:239` (register `lane-3:E07`).

## Resolution

**Landed (13 Oct 2026).** `splitScene` (sceneWorkflow.ts) cuts one scene at
local t through `applyTimelineMove` (the split scene is the one exempted
from the content guard; every other scene's digest is unchanged): the left
keeps the ref and duration t; the right is a new scene "<name> / split",
duration = original − t, transition 0. Property tracks are cut so each side
evaluates the original curve — linear/hold by a boundary point, smooth and
bezier subdivided exactly (de Casteljau on the same curve
`propertyTracks.ts` evaluates; lead refactor: `segmentControls` /
`curveParameter` exported once and shared, no duplicate curve math);
sequences keep whole steps on the left and rotate on the right (the step
containing the cut restarts — named limitation); automation lanes copied,
take ranges clipped. Edge rule = the 1 s minimum scene; refusals named,
document byte-equal. `app.ts`: a "Split" action in the scene row and key S,
one `composite('Split scene <name>')` at the playhead. Scripted: 15 new
(continuity to 1e-9 for every interpolation type; one change list
scene_create + material sets + scene_reorder; one undo restores byte-equal);
field-studies 471 pass / 0 fail. Unverified: the button, key S and the
redraw after a split in the native app; the live kernel apply.
