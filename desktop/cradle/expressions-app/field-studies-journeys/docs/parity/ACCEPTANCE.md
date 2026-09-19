# Native parity acceptance

## Reproduce

Use Node 22, the lockfile and the immutable source checkouts below. The permanent
`Expressions native parity` workflow performs these checkouts and all checks with
**contents: read**. It cannot publish or rewrite application source.

- Entity-native oracle: `63e650d26a04447b973f73dded6b5046a0829e84` at `.parity-reference/master`.
- Historical application: `040627d0ea40032fe7c7b8c98be9a246be9db7f6` at `.parity-reference/main`.
- Approved Expressions starting shell: `9bf229dfeddfcacc3839f68662ec65e82afbd48b`.

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run test:journeys
npm run test:parity
python -m pip install -r field-studies-journeys/tests/requirements.txt
python -m playwright install chromium
npm run test:gpu
npm run test:browser
npm run test:workspace
npm run test:parity:browser
python field-studies-journeys/tests/module_browser.py
npm run test:reference-apps
```

Share the installed node_modules with each reference checkout; do not modify its
source. `tests/parity/reference-apps.mjs` builds both native applications. The CI
checks their tracked sources remain unchanged after running them.

## What is checked

The original 70 engine/bridge cases, 23 authoring model cases, five GPU suites,
25 browser workflows and 23 approved-workspace checks remain mandatory.

The new independent suite checks 27 complete native fixtures (19 factory, five
composition and three boundary/unknown-data fixtures) in both direct and saved
round trips. It checks isolated edits, all mapped native numeric endpoints,
older expression envelopes, stable unregistered entity/link automation after
reorder, native source-kind export, all five original layout algorithms, native
phase/sequence/focus laws, automation waves/easings/blends, palettes and chains.
Expected values come from the pinned original source, not the new bridge.

Nine actual GPU fixtures compare the original engine and hosted engine using
identical initial position/velocity buffers, clock and device. Constructor warm-up
is deliberately normalized; four physical steps are compared per fixture. The
maximum permitted target error is 0.00013 and position/velocity error 0.00025 in
native units, accounting for float32 local-transform ordering. This is a bounded
same-device comparison, not an assertion of long chaotic trajectory identity.

A separate **64-case native classic material matrix requires exact pixel equality**:
eight colour distributions × two mark styles × two dot shapes × palette enabled/
disabled. It aligns GPU state and camera and compares actual render-target bytes.
It does not compare the old dashboard or declare the approved shell background,
typography or normalized opening composition to be unchanged legacy pixels.

Sampler comparisons require exact candidate equality for seven yantras, 21 cymatic
template combinations, 54 raster configurations and nine default ASCII drawings.
The repaired ASCII option handling is exercised separately, rather than compared
to the reference implementation's ignored options. Low-mode-count sparse resonance
and same-glyph first-link source switching have explicit defect regressions.

The restored-feature browser suite exercises the actual contextual controls,
including live drag before release, native spacing and scaffolds, all native
palettes/papers/chain presets, eight-stop editing, native enums, template geometry,
PNG/JPEG/WebP decoding and raster options, portable asset reopening, ASCII, runtime
commands, saved-copy deletion and recovery. Default-allocation acceptance runs
**62,000** particles and loses/restores a real WebGL context, preserving the
expression while explicitly recreating physical state.

Image and video tests decode actual output and reopen the portable app. The served
module test exercises the real default HTTP route and module-to-standalone export.
Both unchanged native applications are also opened through their built HTTP roots.

## Evidence and scope

CI uploads `expressions-native-parity-review` containing the application,
machine-readable feature inventory, result JSON, current screenshots, decoded
media and a build receipt with exact SHA/hash. The source artifact records the
submitted revision. Test reports in repository history are not substitutes for
that run's result files.

Local inline-content tests declare their in-memory browser-storage double. Local
managed-browser policy blocks localhost navigation; it is not bypassed. Served
route/native-application checks are therefore certified by the GitHub run, not
claimed as local HTTP successes. Software-WebGL measurements are not a benchmark
of the user's GPU, Safari/Firefox certification, or a 30 fps guarantee.

All deliberate differences and unsupported historical/preview features are named
in DIVERGENCES.md. This handoff does not invent checkpoints, replay, offline video,
audio or seamless physical loops. An exact saved configuration is not an exact
running particle/resonator checkpoint. Finite tests provide evidence for the
catalogued surface, not a mathematical proof for every possible input/device.
