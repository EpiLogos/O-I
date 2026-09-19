# Production-engine integration handoff

## Authorial intent

Preserve this shell's visual proportions, crosshair, open canvas, restrained typography and named whole-scene approach. Do not turn it back into a stacked parameter dashboard. A **journey** is an authored artifact composed of named, live **scenes**, with optional page text and temporal relationships. A scene is a whole composition, not an engine mode or a glyph preset.

Integrate the user's existing engine into this shell. Do not port the alternate engine, and do not “improve” the preview renderer into a competing simulation. The engine is what makes the continuous resonant medium real; this work makes it understandable and operable.

**User-reported defect: the production pin feature is damn buggy. Reproduce and repair it against the interaction contract below. Moving its old controls into the new UI is not a fix.** The shell's placement/dragging tests do not establish that production force application is correct.

## First: read the actual current production implementation

Inspect current `fieldModel.ts`, `entityRuntime.ts`, `PointCloudField.ts`, parameter registry, automation and snapshot migration. Compare them to `src/engine.ts`, `model.ts`, `camera.ts`, `timeline.ts`, `app.ts` and `capture.ts` here. Inventory exact fields, units, dynamic state, resets, rendering/capture hooks and unsupported functionality. The shell registry is not a claim that all approximately seventy production parameters have been exhaustively mapped.

Produce a short contract/difference plan, then implement. Preserve genuinely richer production capabilities. Do not infer an absent mapping or migration from similar property names.

## Boundary supplied by this shell

`src/engine.ts` exports:

```ts
interface FieldEngineAdapter {
  readonly canvas: HTMLCanvasElement;
  readonly capabilities: EngineCapabilities;
  render(frame: EngineFrame): void;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}
```

`EngineFrame` carries the current scene, simulation time, delta, evaluated field parameters, camera, pointer world position and selected IDs. Install `window.OI_ENGINE_FACTORY` **before** the shell bundle, or replace the bootstrap factory import in a module-hosted build. The default `PreviewAdapter` is isolated in `preview.ts`.

This is a usable seam, not a promise that the actual engine matches it with zero adaptation. Add typed production commands and capabilities where necessary. Keep document ownership in the shell; do not let the adapter manipulate DOM, persistence or selection. Bind UI enablement to actual supported parameters and capabilities, not merely `kind: 'production'`. The shipped preview gates unsupported groups by preview status; production integration must complete parameter-level disclosure.

### One time authority

The shell currently schedules one requestAnimationFrame loop and owns `simTime`; pure timeline functions consume that time. Integrating an existing engine-owned simulation clock requires an explicit handover: either the shell steps the engine and reads the resulting time, or the engine supplies the sole time source and the shell subscribes. **Never run both autonomous loops.** Pausing, timescale, capture and hidden-tab behaviour must all use this same authority.

The preview evaluates field automation before `render`. Ensure the production engine does not evaluate these lanes a second time. Prefer reusing its proven phase, sequence and automation laws; preserve their exact semantics and remove duplicate preview evaluation once the owner is chosen. The preview phase instrument is not authoritative physics.

### Identity and continuous state

Persistent entity IDs drive incremental updates. Positions and editable parameters must update uniforms/native state without rebaking targets or reseeding particles. Local target geometry stays in local coordinates. Formation particle shares and force-only pins remain distinct. All entity forces sum over the same medium; centres are not separate particle universes.

Scene-to-scene playback needs a designed transition command: identify persistent versus introduced/removed entities and interpolate intended parameters without implying a reseed. The shell preview uses a **rendered-frame dissolve** for page-level preview transitions. It is explicitly not a physical transition algorithm and must not replace continuous particle motion in production.

Changing count and an explicitly invoked reset are the only documented reseed reasons in the user's design. Reconcile any additional reset with that intent instead of silently inheriting it.

### Spatial mapping

Coordinates are world-space xyz in a modest stage scale. Map those units deliberately into the engine. The editor uses an orthographic camera and explicit XY/XZ/YZ working planes. A pin-placement click ray-intersects that plane at its displayed depth. Edge-on planes fail with an explanation rather than guessing depth.

Ordinary XY dragging preserves the selected entity's z; coordinates offer the precise alternative. A saved scene view contains yaw, pitch, zoom and normalized pan. Camera view, working plane, composition-layout plane and Z confinement are different properties. Changing “2D view” must not flatten the simulation.

Keyframe positions in this shell are **offsets from the base entity position**. Moving the entity moves the whole path. Production's existing per-link positions may use a different representation: translate explicitly. The selected keyframe context must be visible before canvas dragging changes it.

### Cymatics and chakras

The shared resonator is one continuously excited medium with seven marked resonant stations. Spatial chakra centres and resonant station indices are distinct. Selecting an entity is inspection, not a tuning command. The continuous frequency, physical excitation/damping and formation–resonance dominance live at field scope. Authored glyph targets must remain distinguishable from emergent cymatic geometry.

Define the tuning driver explicitly: manual, travelling focus or automation. The shell stores `frequencyDriver` and station associations but deliberately does not generate cymatics. Integrate actual station frequencies, normalisation and medium capabilities rather than adopting the preview's illustrative 80–800 slider bounds as a scientific contract. Seven station labels here are UI placement, not a calibration.

Seven centres and Kundalini are ordinary editable compositions and focus routes, not legacy engine switches. Colour ownership remains palette → local tint → travelling-focus contribution. Show the current driver and blend ordering in the control concerned.

### Parameters and local sequences

Keep existing production controls. `docs/PARAMETER_MAP.md` records the current shell's controls and extra alternate material characteristics. Expand using the native registry's scope, units, useful slider range, validated hard bounds and automation support. Do not rename a physically specific parameter to a vague macro without a reversible mapping.

Live controls must distinguish base from evaluated values. The shell never overwrites base values on a frame. Retain the full native set of LFOs, one-shots/easings, blend semantics and parameter targets; the preview includes a useful but smaller authored set.

An entity can hold its own sequence (seconds or one toroidal cycle per link), formation, parameters, tint and spatial path. A journey contains entire scenes above this entity layer. Neither an entity sequence nor the seven-centre preset should be confused with journey scene changes.

## Required pin acceptance contract

Choose Pin, click on the intended working plane, and obtain exactly one force-only entity at that location. Default to attract. Return to Select unless repeated placement is explicitly requested. Show a stable centre and a falloff radius, not an invented hard cutoff.

Test attract/repel/vortex against actual particle response; move and edit a pin without altering other entities, palettes, station links or clocks. Forces should affect the shared medium according to their laws. Dragging must preserve deliberate depth and never simultaneously apply pointer interaction, orbit the camera or place another pin. Inspect hit testing after zoom, orbit, resize, device-pixel-ratio changes and importing a saved scene. Test touch, exact numeric positioning, undo/redo, deletion, locks and overlapping centres. Test the production code, not only this preview's deformation shader.

## Capture and persistence

Keep image, video, configuration and runtime-state concepts separate. The shell records the **clean artwork** (no UI, guides or cursor), optional page text and fixed output dimensions. Implement the production engine's render-to-target/snapshot hook rather than resetting count/state to capture. Audit WebGL buffer lifetime and high-resolution rendering so exports contain the actual live frame.

The existing PNG path scales/crops the current canvas pixels; it is not yet a production-quality supersampled re-render. Browser live recording detects MIME support, buffers chunks with limits and supports preview/download. Test native performance on the actual target hardware; 30 fps is requested, not guaranteed. No audio is captured by default. Offline frame-accurate rendering requires checkpoint/initial-state, simulation stepping, bounded encoder/muxer queues and input-event replay; do not advertise it before implementing those foundations. A period of phase controls does not prove a seamless physical loop.

`oi.journey` version 1 is a separate authoring envelope. Implement an explicit bridge to the real schema-4 engine payload and its existing migration chain. Preserve unknown/newer fields where safe; record conversion errors per document. Never overwrite the user's old snapshots or original export files during experiments. Browser storage remains origin-scoped. A scene configuration is not an exact particle/resonator checkpoint.

## Execution and Sonnet work packages

The orchestrating agent owns the shared contract, architecture, single clock and final integration. Read current code first; make a small implementation plan and execute it. Use Sonnet for bounded tasks only when it is actually available; do not claim delegation that did not occur.

Suggested coordinated packages after the shared contract lands:

1. Engine adapter and pin repair: production state/coordinate/force mapping; one owner for shared engine files.
2. Native parameter and motion coverage: registry mapping and scoped controls, consuming the agreed adapter contract.
3. Scene transitions and persistence bridge: identity continuity, whole-scene orchestration and reversible snapshot conversion.
4. Native capture and browser acceptance: clean rendering hook, PNG/video performance, screenshot and interaction checks.

Give each agent exact file ownership, dependencies, existing tests and measurable acceptance criteria. Do not assign competing redesigns of the model, input handling or clocks. Integrate sequentially where ownership overlaps; run the actual application between packages. Final evidence must include two independently sequenced entities, overlapping pins, continuous resonance, chakra/focus interactions, named journeys, optional text, save/import, and a decoded video—not just a compile and a plausible screenshot.

Deliver the integrated working application. Preserve the shell's quiet visual direction and immediate usability throughout.
