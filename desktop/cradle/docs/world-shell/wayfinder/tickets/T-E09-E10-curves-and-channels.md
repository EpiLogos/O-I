# T-E09-E10 — Curve lane and channel discipline

Label: wayfinder:task (Phase 4 · lane 3)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md` E09, E10 (register `lane-3:E09`, `E10`).

## Resolution

**Landed `b91d79d69` (13 Oct 2026; builder haiku, converged by the lead).**
`curveLane.ts` (pure: frame, hit-test, key/handle moves, segment type,
insert/remove, path sampling through `valueAt`, channel rows). Selecting a
channel in the journey timeline opens its curve lane under the clips;
keyframe and bezier-handle drags commit once on pointer-up as
`changed(…, "Edit curve <channel>")` through the existing scene
`propertyTracks` save; refusals are named (`validateCurveEdit`: the
`validateTracks` messages plus handle-in-segment and channel range).
Double-click inserts, Delete removes (never below two keys), interpolation
per segment. E10: S / M / eye per channel; `evaluateTracks(s, t, channels)`
skips muted and, with any solo, non-soloed channels (mute wins); this is
working state, never saved (digest test). Lead accepted the playback call
passing channel state (app.ts) — without it mute/solo would be inert.
Scripted: curve-lane 20/20; field-studies 572/0/3 skipped; E08 suites 28/28;
tsc 0; both builds clean.

**E09b (dispatched):** the field previews during a curve drag (today only
the lane moves until pointer-up — Live updates as you drag); range refusal
checks only the edited key/handle (a legacy out-of-range key elsewhere must
not block editing its channel); the time-order refusal reads in words
("Keyframes stay in time order"), not "Invalid property keyframe".

Unverified (native pass): drag feel, handle visuals, the lane at ≤ 620 px,
audible mute/solo.
