# T-E04 + T-E06 — Insert/overwrite moves, still scenes; roll / slip / slide

Label: wayfinder:task (Phase 4 · lane 3; UI legs)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:171` (E04), `:214` (E06).

## Resolution

**Landed (13 Oct 2026).** `insertScene` / `overwriteScene` (by Scene ref,
through the content guard; insert keeps Σ, overwrite replaces in place and
the total falls by the replaced scene — no gaps by law, accepted); a
"Still scene" starter (a normal scene, count 4000, no entities, no
automation); roll = Shift+drag on the clip edge (plain edge-drag stays E05's
trim): left +d, right −d, Σ conserved exactly (200 seeded cases), 1–3600 s
clamp reported; slip = Alt+drag on the body sets the Scene's `entryOffset`
(a timeline fact — `SCENE_TIMELINE_FACTS`), `evaluateTracks` reads t +
entryOffset; slide/insert = a plain body drag (pointer-based; the inert
HTML5 drag removed); one hint line names the gestures; each gesture is one
composite (one undo entry, one kernel edit: slip one scene_material_set,
roll two). Split of a slipped scene cuts at t + entryOffset (builder fix).
Scripted: scene-moves 13; field-studies 517 pass / 0 fail; build + tsc clean.
Unverified: the gestures, marks and readouts in the native app.

**E06b (claimable):** the live sequence clock — `expressions-app/src/engine/fieldModel.ts:334`
(`resolveSequence`, consumed at `entityPose.ts:31` with the engine's simTime)
honours the presented scene's `entryOffset`, so a slipped scene's entity
motion starts at its offset like its tracks; and any trim/split that
shortens a scene below its offset clamps `entryOffset` into [0, duration)
(today `validateJourney` admits [0, 3600]).
