# Visuals preview — one window Expression stage

Implementation commit: `c5418ac0d3829afcd28e7d4d7141a6387fb8dc06` on `aikit/ui-expression-convergence`, following `aa14aa3d1d67a45cb04f18ba5246a26c983c0604`. Four files only: VisualsView, ExpressionStage, the real component browser page and its regression. No engine or other staged files entered this commit. Exact committed file hashes and commands: `visuals-preview-evidence.json`; portable patch: `visuals-preview-c5418ac0.patch`.

## Defect and repair

VisualsView created `EngineSurface.forElement` beside the window provider's `forWindow` surface. The browser regression returned **3 connected canvases instead of 2** before the repair (`visuals-preview-before.log`). The repaired view acquires a normal shared-stage presentation and moves its existing production canvas/context into the preview. Leaving, disabling or unmounting releases that presentation. The remaining two canvases are one production WebGL field and the shared 2D overlay.

The preview retains configuration, Disperse, Reset, Pause/Resume, the native PNG capture, diagnostics and the deliberate reduced-motion override. The normal presentation handle exposes these operations with current-generation checks; released handles cannot operate on replacement presentations. The force-motion override resets on release and new presentation admission. An occupied stage is an explicit unavailable state with retry; capture and field commands are disabled until acquisition succeeds. Existing owner preferences and rich controls remain in place.

## Executed checks

- `npx tsc --noEmit` — pass.
- `node tests/visuals-preview-lifecycle.mjs` — red before the repair (3 versus 2 canvases), pass after. Uses the actual Visuals settings component, actual providers in React StrictMode, actual native production engine and WebGL. Covers master disable/enable, one connected WebGL context, accepted glyph configuration, pause/resume, native PNG signature/dimensions, field commands, navigation release, zero settled RAFs, busy refusal and retry, stale handle refusal, reduced-motion override and handover, settings remount and full provider remount. No mock engine or owner data.
- `node tests/expression-provider-lifecycle.mjs` — pass, including the existing disabled startup, StrictMode/remount, pause handover, stale generation, two-window ownership and idle RAF cases.

Logs: `visuals-preview-after.log`, `visuals-provider-regression.log`. Parent runs subsequent full builds and native inspection; this component test is not #65 human experience acceptance.

## Bounded active and idle observation

`visuals-preview-sample.json` contains source hashes, source HEAD, timestamp and raw results; `visuals-preview-sample.mjs` is the reproducer. Measured after the parent's WALK build finished. The actual owner default remains **120,000 particles**. One isolated Chromium browser exercised the real component/providers at 1280×820, with ANGLE SwiftShader software rendering and no reduced motion.

| State | Interval | Production frames / window RAF callbacks | Connected WebGL contexts | Renderer task time |
| --- | ---: | ---: | ---: | ---: |
| Active preview | 5.001 s | 31 / 31 | 1 | 0.034171 s (0.683%) |
| Released preview | 2.501 s | 0 / 0 | 1, dormant | 0.001438 s (0.057%) |
| Disabled | 0.501 s | no engine / 0 | 0 | 0.001197 s (0.239%) |

The software renderer managed about **6.2 frames/s** at this default. This is an observed active-rendering limitation on this setup, not a physical GPU result or a universal budget. Chromium renderer TaskDuration excludes the software GPU process, so it is not total application CPU. Other desktop work can contribute ambient load. The earlier same-machine original/current full-app idle comparison remains the comparative performance evidence.

The context instrumentation holds strong references deliberately. After disable, its detached context is still not marked lost: the native engine destroys Three resources but does not explicitly force context loss. The evidence proves no connected engine canvas/context and no continuing clock; it does **not** prove immediate browser context deallocation or a memory leak. Resource retirement is a separate native-owner concern if immediate context loss is required.
