# Expressions port — plan to a finished state

Standing: **working plan, 8 October 2026.** Scope is the Expressions app only. Technè and Factory/Agency run as parallel tracks and are out of scope here. Read with [EXPRESSIONS-FEATURE-MAP.md](EXPRESSIONS-FEATURE-MAP.md) (the rows being ported), [NATIVE-EDITOR-STANDARD.md](NATIVE-EDITOR-STANDARD.md) (the craft bar) and `/Users/admin/Downloads/oi-editor-v2/EDITOR-AND-DEVICE-SPEC.md` (the design basis). Owner direction: port the full capability, not a piecemeal subset; keep to the shell's UI standards; parallel Haiku implementation under one integrating parent.

## Definition of finished

Every Expressions row of the feature map has an outward home in the shell that is built, wired to its existing native operation, covered by tests, and — when the native stack is up — exercised in the live shell. A row is *not* finished because a component exists. Concretely, each device family or surface ships its **admission packet** (standard §Editor admission packet): identity, bound controls with exact native paths, a domain visual derived from the reading, supported native operations only, state/continuation behaviour, and executed acceptance.

Every device face must satisfy: (1) a compact face and an expanded editor; (2) every graphical handle has an exact-value, keyboard, reset and undo equivalent; (3) the visual is derived from the reading and states what it cannot show — no plausible substitutes; (4) real label/unit/range from `NATIVE_BINDINGS`, never prettified paths; (5) an activator light only where the owner has an enable operation (unknown = hollow); (6) accessible names, visible focus, ≥22 px targets, no text overflow at ~700 px and 1920 px; (7) one gesture = one native history entry; (8) base, effective and automated values shown separately.

## Architecture rules (so parallel work stays safe)

- **Field device faces** are registry entries: a pure model file `nativeFieldFace.<fam>.ts` (name, exact-value paths, slider-handle path, enable reading, strip summary/toggle) and a view file `NativeFieldFace.<fam>.tsx` (SVG drawing, switch rows), registered with one line each at the `@face-*` / `@view-*` anchors in `nativeFieldFaceModel.ts` / `nativeFieldFaceViews.tsx`. `NativeDeviceEditors.tsx` and the strip are not edited per family. Writes use the existing `{kind:'parameter', target:'field.<key>'}` change and the existing custody machinery.
- **New change kinds** (modulation, sound, scene, rack, etc.) are an explicit protocol addition: `editor.ts` union, `nativeDeviceEdits.ts` validator+reducer, `hostEditor.ts` admission list, `nativeInputRecovery.ts` where a private draft exists. One writer at a time; each addition is its own packet with its own tests.
- No second store, clock or document. Anything not derivable from a reading is declared unavailable.
- Native stack down is not a blocker for model, view and handle behaviour (tests plus the vite harness over fixture readings); live-shell replay is recorded as pending until the stack is up.

## Waves

| Wave | Content | Lane |
| --- | --- | --- |
| 0 | Field face registry refactor; strip reads the registry | parent + 1 implementer |
| 1 | Field faces on existing generic writes: **Ink/Mark** (Material 12, Paper, Particles 3), **Constraint/Depth** (Volume 10, Depth 8), **Relational** (10), **Interaction** (6), **Physics** (Physics+ 12: gravity vector, snap/tether, thermal, confinement, time scale), **Focus/Orchestration** numeric part (4), **Resonator** full (Cymatics 14 incl. sweep/plate/boundary) | up to 5 parallel implementers, one family each |
| 2 | Protocol families: **Modulator/Envelope** and automation lanes (LFO/ramp, takeover, monitor), **Sound/Excitation**, **Focus route editor**, **Fold/Form** (only if an Expressions-scoped native implementation exists) | one protocol writer at a time |
| 3 | Shell surfaces: Expressions **transport**, **Scene CRUD** in Session, **Browser insertion/hot-swap/audition** of devices/racks/sources/materials, **Session clip slots/launch** and **Arrangement occurrences/recording** (UI on existing ops; missing native owner ops listed explicitly), **Stage controls** (camera, capture, present, export/import) | parallel by file lane |
| 4 | Integration: whole-shell visual replay at ~700 px and 1920 px, keyboard pass, accounting against the 207 router actions and all feature-map rows, standards packet per family, handoff | parent |

## Accounting

The authoritative checklist is the feature map plus `expressions-ui-actions.json` (207 router actions, all currently `unaccepted`). `EXPRESSIONS-PORT-STATUS.json` (to be generated at wave 4) maps every row and action to: outward home, component, native operation, tests, live-shell replay (pass / pending-native-stack / absent). Rows outside Expressions (Technè lenses, Factory, Nara/Epii dialogue) are marked out-of-scope-for-this-track, not done.

## Not claimed

No original 126-target ID changes standing from this plan. Source/fixture checks do not establish native acknowledgement, GPU/audio response or user acceptance.

## Status after wave 3 (8 October 2026)

Waves 0–3 are built and verified at source/fixture level (see the contract checkpoint). Wave 4 (integration and replay) is not done: no live-shell replay exists because the native stack was down, and the accounting still shows 56 partial, 10 not-ported and 10 owner-op-required actions. `EXPRESSIONS-PORT-STATUS.json` is the authoritative list; this plan does not claim completion.

## Closing status after wave 4 (8 October 2026)

Ported 113 / partial 56 / not-ported 4 / owner-op-required 11 / studio-only 11 / internal 12 / other-track 6 of 213 app actions. Shell UI suite 879 tests (877 pass; two environmental failures), all three typechecks clean. No live-shell replay yet: the native stack was down. Wave 4 as defined here (whole-shell replay at ~700 px and 1920 px with the native stack up, keyboard pass, per-family admission packets) remains to do.

## Top-bar session (8 October 2026)

Built and verified at source, fixture and stubbed-DOM level; **not replayed in the live shell** (the native stack was down and was not restarted). Accounting: `EXPRESSIONS-PORT-STATUS.json` (`additions`, `defects`); no row changed status.

- **Bar layout.** Transport, Time Scale (drag the name, type, arrows), the arm and take dot, the tool rail (single letters at narrow widths), the Map (pin) toggle, an engine light, then an overflow menu for Scene choice, saved sequence, Save, position, times, take mode and Guide. A second row carries the controls strip. The stage toolbar lost its tool group. Reviewed at 700 px and 1920 px over fixture readings.
- **Live parameter channel.** Frame command `live` (`set`, `hold`, `release`): a transient override layer inside `frameData`, applied to a copy of the scene, never the document. About 20 Hz while dragging; one committed write on release; Escape restores; the take sampler reads the override. Proven: streamed value equals committed value (12 tests); against the real frame (production engine adapter) the clock stops under a streamed Time Scale 0, resumes on release, the document is byte-identical with no state announces, and a take recorded during a drag holds the ramp 1 to 3 rather than a staircase. Effective values are polled at 250 ms while a lane runs or a take records.
- **Arm, record, re-enable.** Arm + Play starts a take, Stop keeps it, append or replace is the overdub choice. Re-enable automation is a frame command (`automation resume`, reading `automationHeld`), runtime only, hidden until something is held. On an automated parameter a bar gesture holds the manual value in the frame; Device panels still use the existing reducer, which offsets a replacing lane (takeover law deferred to #580). The two paths differ on purpose until that is decided.
- **Pin mode and seed.** Map toggle with a Field | Follow | Bind chip and a Shared | Local scope (Alt-click flips one pin); a pin on every Device control and Browser row; Field pins project into the bar from the document's chosen controls, with no new store. Seed in priority order: Time Scale, Viscosity, Shape hold (rack macro over snapRigidity and densityTether, added on request, starts where the parameters already are), 3D (volumeEnabled and depthPerspective), Particle size (two handles, log track, shaded 0.2 to 1.4 band, hard bounds unchanged), Cymatic with Plate Size, Relational, Turbulence, Ink Opacity. Hiding a seed slot is a per-viewer browser setting.
- **Grid size decision.** The Cymatic "grid size" is `cymatics.plateSize`. `medium.gridRes` is the shared medium's grid; the resonator reads only `uResPlateSize` (simulationShaders.ts:758). Turning the Cymatic field on from the bar also sets the plate size to 300 (`CYMATIC_LOW_PLATE`, easy to change) in the same undo step, unless it is already lower, so the pattern reads clearly.
- **Rack.** Field-scoped chosen controls live in the bar and the rack lists object (Follow/Bind) pins only. A reorder of the visible rack controls is merged over the whole list so each hidden Field entry keeps its own slot (`wholeChosenOrder`). Unpinning a Field control is done from Pin mode or the bar.
- **Not done.** Metronome, tap tempo and quantise are omitted as agreed. Rounded material now round-trips through an `authoredMaterial` marker. The take start with chosen properties and the hold on a real lane were replayed against the real frame (production engine adapter). Not replayed: the shell route with a native-owner-backed document (opening a work there needs an owner recovery checkpoint).
