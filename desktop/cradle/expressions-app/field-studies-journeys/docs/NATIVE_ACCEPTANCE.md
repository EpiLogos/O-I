# Native integration acceptance

Source baseline: `63e650d26a04447b973f73dded6b5046a0829e84`.
Integration branch: `agent/native-engine-journeys`.

## Executed local acceptance

| Suite | Result | What it establishes |
|---|---:|---|
| Root regressions (`npm test`) | 70 passed | Existing 51 engine cases plus 19 bridge, ownership, migration and persistence cases |
| Authoring model | 23 passed | Scene validation, editing, bounds and journey/model invariants |
| Strict TypeScript | Passed | Both native and shell projects |
| Native and legacy production build | Passed | Default native module app, retained workbench and independent HTML artifact |
| GPU acceptance | 5 suites passed | Actual float-buffer forces, state continuity, single stepping, combined resonance and projection/capture |
| Native browser acceptance | 25 workflows passed | Real editor input, motion, save/import/export, touch/mobile, PNG, decoded live video and portable reopening |

Evidence is written to `field-studies-journeys/evidence-native/` by the scripts.
The CI review artifact includes JSON results, screenshots, video and the tested
portable HTML. The earlier `docs/TEST_REPORT.md` is preview-era evidence only.

The local browser is Chromium with software WebGL. Interaction/GPU fixtures use
2,048 particles for controlled acceptance; the default product opens at 62,000.
These are functional checks, not a claim of device-level throughput or 30-fps
recording at the default allocation. Inline-content persistence tests explicitly
use a browser-storage test double. The separate served-module test exercises the
real root route and module-to-standalone export on CI; local managed-browser URL
policy blocks navigation to the test server, so that local test is not claimed.

## Important measured results

For the same seeded GPU field, mean radial velocity was approximately -2.30865
for attraction and +2.30865 for repulsion. Two identical attractors produced
-4.61731, demonstrating shared additive force application. Independent spin
produced tangential motion, including with radial force disabled. Particles
outside the characteristic radius continued to receive Gaussian force.

Zero-delta rendering left time, particle state, phases and seed count unchanged.
A 1/30-second advance used two 1/60-second physics steps. Moving, resizing and
rotating an entity changed uniforms without re-baking targets or reseeding.
Changing allocation explicitly increased the seed count once.

Two independently sequenced entities with overlapping pins, travelling focus
and resonance ran for 45 steps with finite GPU data and one seed operation.
Focus tuning changed frequency continuously rather than selecting fixed images.
Camera projection agreed between shell and native engine to under 10^-9 CSS
pixels across the tested orbit, resize and device-pixel-ratio cases.

Native 800×600 render-target capture preserved time and all particle positions.
Selection highlighting was excluded: captured pixel bytes matched the clean
unselected output. Browser acceptance decoded a 1280×889 PNG and a silent VP9
performance recording, then reopened the exported self-contained artifact with
its edited journey and native engine intact.

## Scope and honest limitations

A saved configuration is not a runtime checkpoint. Instant physical seeking,
checkpoint/replay, deterministic offline clip rendering, recorded-input replay
and proven seamless loops are not implemented or presented as completed controls.
Live recording requests 30 fps, detects available codecs, keeps fixed dimensions,
limits elapsed time/memory and stops for hidden tabs or viewport changes.

The native numeric registry is available with actual scope, soft/hard bounds and
units. Two legacy registered parameters no longer consumed by the current native
runtime (`autoMorphDuration` and `cymatics.sweepSpeed`) remain explicitly disabled,
not disguised as live controls. Preview-only thickness/warp/lattice macros without
faithful production equivalents are not assigned invented physical meanings.
Native image and ASCII target import is implemented; this run's browser workflow
covers ASCII. An exhaustive accessibility audit, native multi-touch camera
navigation and a broad matrix of real GPUs/browsers remain device-level work.

The initial standalone/main screenshot is a real native render, not a generated
mockup. Browser checks do not establish that the user's app-browser review pane
was opened: no such presentation tool was available in this session.
