# Native integration contract / observed differences

Baseline: `63e650d26a04447b973f73dded6b5046a0829e84`. Read ENGINE_HANDOFF.md,
UX_CONTRACT.md and the supplied full canvas UX specification before implementation.

## Ownership

The journey shell owns documents, undo, selection, tools, presentation, text and
one requestAnimationFrame scheduler. The existing PointCloudField owns simulation
time, phase integrators, native automation evaluation, entity runtime and the
continuous modal resonator. In hosted mode it is synchronously stepped by that
scheduler; it installs no input listeners, resize listener or autonomous loop.
The shell reads native telemetry, rather than evaluating the preview's different
phase, sequence, focus and automation laws. Paused/hidden frames render without
advancing particles, resonator envelopes, phases, triggers or time.

## Explicit differences and decisions

* A stage unit is **400 native world pixels**. Coordinates, radii and keyframe
  offsets use this reversible conversion. Camera basis and projection come from
  the shell, including off-centre editorial framing. Layout plane, camera and
  physics confinement remain separate.
* The preview's glyph width/height/rotation have no equivalent native transform.
  Add native local transform uniforms; changing transforms must not regenerate
  particle state or target geometry. Optional normalized target dimensions are
  an authoring extension, not a replacement for existing native glyph/yantra/
  authored-cymatic geometry. Existing native scale behaviour is preserved.
* Preview per-link durations are richer than native uniform sequence durations.
  Extend the native resolver with optional per-link hold/transition; absent values
  continue through the existing native law. Native order, easing, jitter, phase,
  rate and impulse remain available and are not flattened on import.
* `makePin` defaults to vortex instead of the required attract. `pinsToPlacedPoints`
  loses spin. Persistent points currently use the transient pointer's hard cutoff,
  inconsistent with the model's Gaussian entity-force contract. Correct the entity
  pin path, while retaining legacy compact-falloff placed points explicitly.
* Native automation uses wall time despite the one-simulation-clock contract.
  Evaluate it once against simulation time. Native lane blending is retained:
  each lane is relative to the stored base, in list order; the final write wins.
* Native damping is viscosity per 60-Hz frame; preview damping has no documented
  equivalent. Expose viscosity/Q by their real names and units rather than
  pretending that damping and resonator Q are interchangeable. Likewise do not
  interpret preview `flow` as a known production coupling constant.
* Native station frequencies come from CymaticResonator's native mode table,
  not the shell's illustrative 80–800 labels. One field frequency has an explicit
  manual / focus / automation driver; inspection is never a tuning command.
* Native allocations support 10 formations and 8 pins. The editor validates these
  limits rather than silently discarding extra entities.
* Native scene changes update existing simulator state. Persistent IDs interpolate
  positions/transform/forces/tints; changed targets remain spring destinations.
  Introduced/removed allocations change target ownership, not live positions.
  No page-pixel dissolve is used for production. Count changes are explicit
  reallocation/reseed operations, visibly disclosed.
* A native render-to-target image hook re-renders the current state at output
  resolution; it does not upscale old pixels, step physics, alter count or reseed.
  Live video remains capability-detected, silent, fixed-size browser recording.
  Checkpoints, instantaneous physical seek and offline controlled clip rendering
  are not advertised without their required foundations.
* `oi.journey` remains the authoring envelope. Native schema-4 documents use the
  existing migration chain, retaining the original payload and native fields;
  errors are per document and source files / old browser keys are untouched.

## Acceptance

Native tests must check actual GPU state, not just guide placement: attract,
repel, vortex and independent spin; forces outside the characteristic radius;
zero-delta immutability; no reseed/rebake on positions/force/tint/transform; camera
projection parity after orbit/resize/DPR; sequence and focus telemetry; continuous
resonator envelopes; safe migration; high-resolution PNG decode; video decode;
standalone artifact reopening. Preserve the existing root application and suites.
