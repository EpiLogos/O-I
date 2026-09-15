# Native cue / legacy loader removal

Implementation commit: `01421b659fe87e705beb1d85bfcf0b12ef354040` (25 scoped files).
Native engine in these checks: `703b6970bfd405c482c2a15985c09c8925ec3b7d`.
Exact committed source hashes: `native-cue-removal-basis.json`.
The parent is forward-porting to a subsequently accepted O:I/main; this receipt does not claim checks against the next native intake.

## Actual changes

- Removed the Canvas2D Expression overlay, procedural form generator, ink probe, CSS clouds/cluster animations, masked SVG loader and their renderer exports. Brand identity assets and real graph rendering remain.
- Kept portable semantic vocabulary and accessible pending-operation text. React Loading has no renderer, observer or visibility listener; removed its false `surface.ready` cleanup event (unmount/cancellation does not prove readiness).
- NativeCues addresses the window's existing EngineSurface with native glyph/entity/camera helpers. Its bounded cue allocation is 4096 points. Capacity comes from the native MAX_FORMATIONS export (10); overflow is refused rather than truncated. Cue IDs and semantic updates survive foreground preemption.
- Static cues have no clock. Pixel tests exposed that native attraction-target updates alone leave old particle positions while paused. On changed static cue material only, the controller materialises native targets, calls native reset-field and renders the settled cue. This is bounded drawing with zero continuing RAF; unchanged lease renewal draws nothing. Foreground and actual retained-field reservations exclude this path.
- Nara reservation is acquired by the actual successful retained lease. Cue state remains meaningful but does not replace or reseed a released reserved field. Explicit new foreground admission can replace that reservation.
- Stage exposes actual ready/play completion and appearance/backdrop forwarding. Non-frontstate restored presentations defer while opening owns the field, then retry through an availability update on frontstate release. Admission does not change provider API identity.
- Replaced Knowledge's decorative cloud and graph wallpaper; real graph dimensions/radii use semantic graph/layout roles. The original search width remains responsive to its original rem spacing.

## Executed evidence

- `npx tsc --noEmit`: pass.
- `node packages/oi-design-system/checks/verify.mjs`: pass, zero unresolved consumer tokens/raw colours (`native-cue-design-verify.log`).
- `node packages/oi-design-system/checks/browser.mjs`: 13/13 pass: real status updates, safe label text, removal/focus, light/dark, forced colours, reduced motion, 320px layout and keyboard disclosure.
- `node desktop/cradle/tests/native-cues-lifecycle.mjs`: pass (`native-cues-lifecycle.log`). One native canvas/context; disabled zero canvases and all held real GPU contexts lost; static cue and unchanged refresh zero RAF/steps during bounded 400ms observations; active native progress without an FPS requirement; actual rendered glyph pixels at original and moved target bounds; foreground preemption/restoration; hidden target, reduced motion, capacity refusal, stale generation and StrictMode remount. `native-cue-static.png` shows the actual native glyph at its target.
- `QL_NARA_SNAPSHOT=/tmp/oi-ui-owner-verification-20260915/ql-personal/focused-snapshot.json node desktop/cradle/tests/nara-retained-field.mjs`: pass (`nara-native-cue-priority.log`). The genuine QL example plus native Stage retains actual texture identities and particle seeds across release/reentry while a queued active cue remains suppressed. Released/superseded lease clocks refuse. Existing eight partitions/seven GPU loci/atomic stale-generation checks remain.
- `node desktop/cradle/tests/visuals-preview-lifecycle.mjs`: pass (`visuals-preview-single-canvas.log`): real preview controls/config/PNG, one-context ownership, navigation/disable/context loss, busy retry, reduced motion and StrictMode.
- Existing provider lifecycle check passed with new one-canvas/zero-disabled expectations.

## Scope / limits

The prior legacy overlay sample (`legacy-overlay-sample.json`) measured 72 RAF callbacks and 27 Canvas2D draws in 1.2008s with a visible idle anchor even when Expression was disabled. The replacement has no Canvas2D renderer; the bounded static observations above showed zero ongoing native RAF/steps. These are lifecycle observations, not universal CPU/GPU budgets. The active checks use SwiftShader; physical-GPU performance belongs to the native agent's separate evidence.

The semantic anchor retains its 10-second lease renewal and geometry observers; the controller uses one deadline timer only while handles exist and bounded resize/scroll/visibility/motion listeners. No continuous cue rendering occurs without actual active material. Root owns final production/native builds, complete opening tests, detached-window acceptance and #65 lived UX evidence. No user installed application, preferences or owner configurations were changed by these tests.
