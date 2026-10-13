# T-SEQUENCE-EDITOR-MOUNT — the selected scene's Clip detail is the sequence editor

Label: wayfinder:task (UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Source: DEVICE-SEMANTICS-LOCK §9.4 (the Clip view table, Expressions column);
T-EXPRESSION-TRACKS (`src/timeline/expressionsSequenceEditor.ts`).

## Question

In Expressions mode the detail row's Clip side shows the selected scene. Make
it Live's Clip view for a scene: the clip box (scene name, colour,
signature = the field ratio 5:3), and the **note editor** — entity lanes ×
steps from `projectSceneSequence` (a step = a note: start, length = hold,
glide = transition), the automation lanes as clip envelopes under it (each
naming its `modulatedBy` when present), takes listed beside. Read-only in
this ticket: editing a step routes through the existing native editor
(`presentNativeEditor`) — no second write path.

## Lead's design

- Find where the Expressions Clip detail renders today:
  `src/components/NativeWorldDetail.tsx` (`mode === 'clip'`) and the
  native editor reading it already holds (entities, sequence, automation,
  property tracks of the presented scene). Build the `ExpressionsTrackReading`
  from that reading — no new store, no new fetch.
- New component `src/components/SceneSequenceEditor.tsx` (+ css in the
  existing detail stylesheet, shell tokens only): a piano-roll grid — lane
  heads at left (entity name + glyph), a time ruler in scene units, notes
  as bars (length = hold) with a glide tail (transition), envelopes as
  thin lanes below. Mockup floor: `../../world-shell-mockup.html`
  `liveDetail` (Live's piano roll) and the Expressions Clip detail.
- Clicking a note selects that entity+step through the existing selection
  path; double-click opens the native editor at it (`presentNativeEditor`).
- SSR test `tests/scene-sequence-editor.test.mjs` (renderToString like the
  mode-surface tests): lanes = entities, one bar per step with width
  proportional to hold, glide tails present, envelopes listed, empty scene
  shows the honest empty state.

## Acceptance

- Scripted: the SSR test; tsc 0; the existing native-detail suites green.
- UI: the scene's Clip detail shows the piano roll in Expressions mode at
  both viewports — the lead's computer-use / headless-Playwright pass.

## Resolution

**Code landed (13 Oct 2026; builder haiku, converged by the lead).**
`SceneSequenceEditor.tsx` — the scene's piano roll above the States editor
in Expressions' Clip side: lanes = objects, notes at their engine timing
(`readNativeGlyphTiming` — the engine may play an entity-level hold, so the
legacy projection's per-step hold is not trusted), length = hold, glide =
transition, envelopes with their modulator, takes, honest empty/pending
states; requests are only the existing `select` and `open` (double-click
opens the source editor). Lead rulings: the clip box omits scene colour and
the 5:3 signature until a native reading carries them; States stays the
default surface. Scripted: 16/16; neighbours 90/90; vite build ok.
Unverified: on screen (native, both viewports) — the lead's computer-use pass.
