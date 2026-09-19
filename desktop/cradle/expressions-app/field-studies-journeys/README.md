# Field Studies — native journeys

This directory contains the quiet journey editor and its standalone build.
The integrated production adapter is `src/production.ts`; `src/preview.ts` is
retained as reference source only and is **not bundled into the native product**.

From the repository root, run `npm ci && npm run dev` for the native application,
or `npm run build` to produce both the static multi-page deployment and the
self-contained `field-studies.html`. Open that HTML in a WebGL2-capable browser to
review it offline. No API key or external asset service is required.

## Documents and code

- `docs/ENGINE_HANDOFF.md` and `docs/UX_CONTRACT.md` retain the original requirements.
- `docs/NATIVE_CONTRACT.md` records the implementation's ownership and conversions.
- `docs/NATIVE_PARAMETER_MAP.md` is the generated native registry inventory;
  `docs/PARAMETER_MAP.md` remains the original **preview** inventory, not native calibration.
- `docs/NATIVE_ACCEPTANCE.md` records executed tests and explicit remaining limits.

`src/model.ts` owns the authoring envelope; `src/store.ts` owns editing transactions
and safe browser persistence. `src/nativeBridge.ts` translates to/from the existing
schema-4 configuration and keeps source payloads. `src/nativeParameters.ts` maps
actual owners, bounds, units and stable entity-ID automation targets. The original
native laws remain under the repository's `src/engine/` directory.

The shell owns one scheduler, input routing and document edits. The hosted engine
owns the single simulation clock and evaluates automation, phases, entity sequences
and shared resonance once. `src/timeline.ts` preview utilities remain useful for
pure authoring tests, but are not a second physical runtime.

## Review workflow

The initial Ink scene provides the large granular O/I, optional editorial text,
crosshair and four labelled canvas tools. Editing opens beside or beneath the
artwork. Pin placement, working-plane selection, exact coordinates, locks, undo,
independent entity sequences, native automation and the continuous station band all
operate on the same live medium.

Save/export journey preserves configuration. Native schema-4 imports report
success/failure per entry and retain their original input. Existing legacy browser
saves can be read from Library without changing the old key. Export living artifact
includes the journey and editor inside one HTML file. Image and video capture omit
editing guides and optionally include authored text.

## Tests

Use the root commands documented in `../README.md`. `tests/native_gpu.py` checks
real floating-point GPU data. `tests/native_browser.py` exercises the native editor
and decodes PNG/video/artifact exports. `tests/module_browser.py` checks the default
served entry and its portable-export bundle. `tests/browser.py` and
`docs/TEST_REPORT.md` are retained **pre-integration preview evidence**, not proof
of native acceptance.

Exact runtime checkpoints, instantaneous physical seeking, controlled offline
clip rendering and guaranteed hardware recording rates are not advertised as
finished. The built artifact is a live instrument, not a simulation checkpoint.
