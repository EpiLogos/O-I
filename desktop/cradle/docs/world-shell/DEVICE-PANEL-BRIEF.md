# Device panel brief — build one Expressions panel as one whole device

Standing: working brief for implementers, 8 October 2026. Read with [EXPRESSIONS-PORT-PLAN.md](EXPRESSIONS-PORT-PLAN.md), [NATIVE-EDITOR-STANDARD.md](NATIVE-EDITOR-STANDARD.md) and [UI-UX-CONVERGENCE-STUDY.md](UI-UX-CONVERGENCE-STUDY.md) §Three levels of disclosure.

## What a device is (owner model — do not drift from it)

The Expressions app already has about a dozen **deep settings panels**, each holding its own bounded parameters. **Each panel becomes ONE whole device.** Do not fragment a panel into small pieces and do not merge two panels. Parameters that genuinely belong together and change together live together in one designed whole, with a visual whose parts are driven by those parameters.

A device has three presentations of the **same live parameters**:

1. **Compact rack widget** (bottom space, a toolbar of small widgets the person *adds*): title, activator light (only if the owner has an enable operation), a small live diagram, and at most 4 default controls (`compact`). Parameters are always active in their default state whether or not the widget is on the rack.
2. **Expanded** (left Browser column and the contextual pool beneath it): the WHOLE panel — diagram with handles, every parameter and every non-numeric control, grouped as the app groups them. Making changes here never adds anything to the rack.
3. **Full** (centre, the Expressions Studio suite): the app's own panel opened by `studio` section id.

You build the device's **model** (pure facts), its **view** (diagram + switches) and its **tests**. The rack widget and the pool host are generic and are built elsewhere from your model: that is why `compact`, `groups` and `studio` are declared in the model.

## Files you create (per device `<key>`; keys are fixed: physics, pointer, relational, medium, contacts, morph, focus, colour, ink, depth, resonance)

- `packages/live-shell/ui/src/components/nativeFieldFace.<key>.ts` — pure `FieldFaceModel` (see `nativeFieldFaceModel.ts`): `name`, `paths` (EVERY numeric parameter of the app panel, in app order), `groups` (coupled groups with titles, covering `paths` exactly), `compact` (≤4), `studio`, `controlPath` (the one native path the bottom slider handle drives), `enabled(reading)`, `strip.summary`, `strip.toggle`.
- `packages/live-shell/ui/src/components/NativeFieldFace.<key>.tsx` (+ optional `.css` imported from it) — `FieldFaceView`: `draw(ctx)` returns SVG content for the 360×160 viewBox; `switches(ctx)` returns the panel's non-numeric controls.
- `packages/live-shell/ui/tests/native-device-<key>.test.mjs`.
- Registry: ONE line in `nativeFieldFaceModel.ts` and `nativeFieldFaceViews.tsx` each (import + entry), replacing your `@face-*` / `@view-*` anchor comment(s) — the anchors are plain comments; keep the other anchors untouched. If your key replaces an existing entry (flow→physics, collision→contacts, interaction→pointer), replace that entry line and delete the old files you replace.
- Do NOT edit `NativeDeviceEditors.tsx`, `nativeDeviceStripModel.ts`, other devices' files, or other shared files. If you believe a shared edit is required, STOP and report it with file:line and the exact proposed hunk.

## How the pieces work (read these first)

- `nativeFieldFaceModel.ts`, `nativeFieldFaceViews.tsx`, `NativeFieldFace.medium.tsx` + `nativeFieldFace.medium.ts` (the reference implementation of one device), `nativeFieldFaceValues.ts` (`short`, `fieldValue`).
- `NativeFieldHandle.tsx` + `nativeFieldHandleModel.ts`: a reusable in-diagram handle that drives exactly ONE native parameter along a line in SVG space (pointer drag, arrows/PageUp/PageDown/Home, double-click reset, Escape, private-draft custody, one `{kind:'parameter',target:'field.<key>'}` apply on release). `draw(ctx)` receives `{reading, graphValue, position, value(path), family, disabled, apply, captureCurrent, setDraft}`; render `<NativeFieldHandle … onDraft={ctx.setDraft} />` for each handle and use `ctx.value(path)` (it returns the live draft while dragging) to draw the diagram, so the diagram moves with the handle. Never give a handle the same path as `controlPath`.
- `NativeDeviceEditors.tsx` renders your `groups` as titled sections of exact-value controls (`FieldControl` with private-draft custody) beside the diagram, shows the activator light from `enabled`, and hosts `switches` — you do not write value inputs.
- Non-numeric controls are written ONLY through admitted change kinds: `{kind:'field-setting', key}` (mediumEnabled, mediumDimension, mediumPlane, resonanceEnabled, collisionEnabled, pairwiseEnabled, collisionMode), `{kind:'panel-setting', key, value}` (21 keys in `packages/expressions-boundary/src/nativeFieldPanelSettings.ts`: engine backgroundMode, dotShape, volumeProfile, pointerMode, pointerClick, relationalMode, sweepDirection, templateDimension, resonatorMode, focusOrder, grainProfile, volumeEnabled, depthPerspective, depthOcclusion, relationalEnabled, autoSweep; composition frequencyDriver, focus, carryTint, carryStation; scene pointerScope), `{kind:'route-order', entity_ids}`, `morph-setting`, `colour-setting`/`colour-palette`/`colour-background`/`colour-preset`, and glyph `field-font`. Use the exact option lists from that table/`NativeFieldPanelChange` — never invent options. A control the boundary cannot write is shown as a read-only disclosure line ("not writable from the shell yet: <why>"), never a dead control.

## Design rules (the standard — each is tested or reviewed)

1. **Whole panel.** `paths` equals the app panel's numeric registry parameters exactly (assert it in tests against `NATIVE_BINDINGS` by group/path); every non-numeric control of the panel is present in `switches` or disclosed as unavailable. Group order and titles follow the app (`inspector.ts` line cited in your device spec).
2. **Honest visual.** Every drawn element is computed from values in the reading (`ctx.value`) or from the engine's own documented relation (cite the shader/engine line in a comment). Never animate a plausible substitute. The caption says it is a configuration diagram; the Stage shows the physical result. Absent/unknown data states what is missing.
3. **Handles.** At least two in-diagram handles for the panel's principal degrees of freedom (use more where the geometry offers them), each bound to a distinct real parameter, with the existing keyboard/exact-value/reset/undo equivalents (provided by `NativeFieldHandle` + the exact-value grid).
4. **Coupling is real.** If the app couples controls (shared update function, derived value, gating flag), the view shows the coupling (a gated group is visibly disabled with the reason; a derived value is shown as derived). Cite the code.
5. **Real labels and units** from `NATIVE_BINDINGS` (`binding.label`, `unit`, soft/hard ranges). Never prettify opaque paths.
6. **Activator.** `enabled` returns a boolean only if a real owner enable exists for the device; otherwise `undefined` (hollow light). `strip.toggle` only for those.
7. **UI craft.** Shell tokens only (`--bg-0..3`, `--line`, `--text`, `--text-dim`, `--accent`); amber marks focus/interaction; ≥22px hit areas; visible focus; no text overflow at ~700px and 1920px (viewBox scales; text 9–10px SVG labels); every control has an accessible name; `prefers-reduced-motion` respected (no animation unless derived from a real reading).
8. **Compact set.** `compact` lists the ≤4 controls a performer most wants, justified in a comment.

## Tests (`tests/native-device-<key>.test.mjs`, node:test, loader pattern of `tests/native-device-strip.test.mjs`)

Model: `paths` ⟷ registry coverage (exact set equality with the panel's parameters), `groups` cover `paths` exactly with no duplicates, `compact` ⊆ `paths` and ≤4, `controlPath` ∈ `paths` and not used by any handle, `enabled`/`strip.summary` over fixture readings (values must come from the reading), toggle shape. View: SSR render (react-dom/server) of `draw` inside an `<svg>` and of `switches` with a fixture reading: handles present with role=slider and `aria-label`, diagram changes when `ctx.value` changes, each switch emits exactly the admitted change shape when its handler is invoked (call the handlers via a stub `apply`). Follow `tests/native-field-handle.test.mjs` for rendering `NativeFieldHandle` over a fixture.

## Verify and report (run for real; do not claim what you did not run)

- `node --test tests/native-device-<key>.test.mjs tests/native-device-strip.test.mjs tests/native-field-faces.test.mjs tests/native-field-handle.test.mjs`
- `node --experimental-webstorage --localstorage-file=$(mktemp -d "$TMPDIR/ls.XXXXXX")/x.json --test --test-concurrency=1 tests/native-colour-field.test.mjs tests/native-morph-drive.test.mjs tests/native-force-gesture.test.mjs` stays green.
- `node_modules/.bin/tsc --noEmit` in `packages/live-shell/ui` exits 0 (other agents edit other devices concurrently: if a type error is in a file outside your lane report it, do not fix it; re-run once before reporting).
- Report (≤350 words): files + line counts; which app panel lines you followed; the final `groups`/`compact`/handles; each non-numeric control and its change shape; what the diagram draws and from which parameters; commands + pass counts; tsc exit; every place something could not be determined or is unavailable. No browser/server is available: say the visual is unverified in a running app.

## Lane rules

Shared checkout with many uncommitted edits by other writers: touch only your files; no `git add/commit/stash/checkout`; no servers; no `npm run build`; re-read a shared file immediately before editing it; never reformat; never touch other devices' anchors.
