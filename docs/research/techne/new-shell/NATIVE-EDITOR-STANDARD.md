# Native editor standard — initial design and integration contract

Standing: **agent-derived design contract, v0.2, 2026-10-08**. The owner commissioned the foundation and subsequently required a lean chosen-parameter rack, settings disclosure, deep editing, and outward homes for all internal Expressions features. [UI-UX-CONVERGENCE-STUDY.md](UI-UX-CONVERGENCE-STUDY.md) is the source-bound refinement. The earlier all-settings rack failed that direction. The current compact surface implements the approved placement; visual and activity admission remains pending. Implemented adapters, proposed behavior and admission evidence remain distinct; no editor family is admitted by its presence or build alone.

## The intended working experience

A device or scene effect is a visual instrument. A person can understand what it changes, tune it precisely, see the relevant structure or response, and return to the same saved work. Its primary surface is designed around its operation. A list of implementation keys and inputs is useful diagnostic depth; it is not the editor.

The shell provides a common chain, selection, focus, input, acknowledgement, and continuation framework. Each editor supplies its own composition and domain visual language. An equaliser, fluid field, scene transition, relation graph, agent configuration, and machine workflow should share reliable interaction without being made to look like the same form.

The retained Expressions body remains the M4 embodiment. Moving a control into the shell must preserve its native operation and its relation to that body. A control is removed from the existing surface only after the shell version has passed the same activity against the same native document. The audio-engine and device-editing lanes remain their owners' work.

## Source basis

The exact bytes used are recorded in [editor-source-basis.json](editor-source-basis.json). These are the sources of the initial contract:

| Source | What it establishes |
| --- | --- |
| `PROGRAMME.md`, `CONVERGENCE.md`, lane-7 `STRUCTURE.md` and five target sets | Functional scope; full M0/M5 inclusion; M4 retention; one portable mode boundary; bounded engine lanes; licence gate. |
| `docs/research/ableton-live-12.0.25/ui/UI-EVIDENCE.md` and the two real reference captures | Measured neutral shell, amber interaction accent, five regions, dense device/detail area, bottom Clip/Device affordances. Captures are evidence, never shipped assets. |
| `expressions-app/src/engine/paramRegistry.ts` | Existing labels, groups, steps, units, soft ranges, hard bounds, linear/log scales, and entity parameter definitions. |
| `field-studies-journeys/src/nativeParameters.ts` | Existing reversible native-to-scene binding; WORLD_SCALE conversion; stable entity/link targets; the common automation target language. |
| `nativeWorking.ts`, `nativeWorkspace.ts`, `nativeSelectionQueue.ts`, `nativeOpenIntent.ts` | Existing native working state, revision checks, retained drafts, selection/open generation guards, and owner mutation serialization. |
| `src/kernel/types.ts`, `src/kernel/bridge.ts`, `packages/expressions-boundary/src/` | Existing owner transport, typed readings/receipts, host epochs, lease cleanup, and routed native Actions. |
| Obsidian RE `contracts/a1-save-handling.contract.md` | Saving completes when the owning write succeeds and is acknowledged; recovery, dirty buffers, and owner saving are distinct. |
| `suite/native-protocol.json` and its source `surfaces.json` | The six accepted owner descriptor IDs and pinned revisions. A descriptor does not establish current runtime availability. |
| `packages/live-shell/src/api.rs` | Current real-set document/summary readings. Device parameter strings are lossless readings; stable write addresses and write acknowledgements are not established by this read API. |

## Common surface and editor-specific body

The bottom chain contains the selected native subject's chosen controls and actual admitted devices/effects. Owned device order and authored chosen-control order remain distinguishable. A chain item has a compact, recognisable editor, a settings toggle and a deep-editor action. Selection and expansion preserve the retained instance, draft, document, renderer and clock. Scrolling the chain preserves the selected item and its edits. At narrow widths, the selected editor uses the available detail width; controls remain reachable without compressing text into illegibility.

### Three levels, one native owner

- **Compact:** chosen pinned properties and macro controls, meaningful compact feedback, actual enable/selection. Keep saved choices through banks or scrolling. An empty or unconfigured rack is created deliberately; it does not occupy permanent space.
- **Configure:** fuller settings, parameter mapping/ranges/law, exclusions and variation authoring appear on request. The browser's separate lower area can carry the selected mapping/parameter/material detail.
- **Deep edit:** the same sequence/source/layer/spatial or professional instrument gets center/fullscreen space and returns to the same selection. Popout needs an admitted additional view of the existing owner, with captured revisions/lifetimes and no duplicated physical body.

The existing **Journey.shared.toolbelt** is the authoritative chosen-property family. Pin/add/remove/reorder/Field/Follow/Bind operations reuse its DocumentStore and native `composition_set` path. Scene-local legacy toolbelt data or a shell preference cannot substitute for it. Follow selection resolves its target at gesture start; named subject bindings preserve native identity and disclose absence. Existing macro racks are a separate `Scene.parameterRacks` family with their own target scope and operations.

The property workflow is browser discovery/preview → explicit scope and pin → native acknowledgement → compact tuning → configuration/deep editing → owning save and fresh return. Every internal Expressions feature needs a deliberate outward location and a replay before its internal controls retire; the current coverage inventory is [EXPRESSIONS-FEATURE-MAP.md](EXPRESSIONS-FEATURE-MAP.md).

Every editor shares these affordances when the owner supports them:

| Common affordance | Required behavior |
| --- | --- |
| Identity | Human name, actual native instance reference, owner, and current revision available through contextual disclosure. A type name or list index is not an instance identity. |
| Enabled/bypass | Actual owner state, directly operable only with an owner operation. An unknown state has no illuminated power indicator. |
| Selection and focus | One subject/occurrence selection, visible focus, keyboard traversal, and restoration on return. Selecting a handle selects its native target. |
| Parameter | Domain label and unit, precise inline value, appropriate continuous/discrete control, supplied domain, and owner-derived reset value. |
| Input | Pointer drag, keyboard adjustment, direct typed entry, explicit commit/cancel, and retained focus. A gesture is one native history operation when supported. |
| Modulation/automation | Separate base, effective, and recorded/automated values when disclosed. A ring, lane, route, or moving handle has a real native reading behind it. |
| Write standing | Pending, acknowledged, conflict, refused, or unavailable. The visible editor keeps the intended value until the result is understood. |
| Depth | Routing, presets, advanced settings, source details, and diagnostics disclosed without replacing the primary visual editor. |

The editor body must answer three questions through its arrangement: **what is changed, how the controls relate, and what result is being observed**. Related parameters sit together. Modes that alter parameter meaning alter the editor visibly. A human label is not generated by prettifying an opaque path.

Examples to develop in the focused design session:

| Family | Primary editor composition | Evidence needed for the visual |
| --- | --- | --- |
| Filter/equaliser | Bands and response handles with frequency, gain, bandwidth and mode controls; compact band selection | Native parameter metadata plus an owner-computed response or verified equivalent calculation. No decorative frequency trace. |
| Dynamics/distortion | Transfer or envelope view with threshold/drive, timing, range and mix arranged around it | Native transfer/envelope semantics and actual input/output readings, where available. |
| Cymatics/physical field | Retained body beside grouped drive, material, medium and interaction controls; direct spatial/force handles where meaningful | Existing registry/binding plus actual simulation or physical body state. M2 modulation remains coupled to the source, never a second oscillator. |
| Scene/sequence | Transition structure, duration/phase and interpolation controls connected to actual scenes | Native scene identity and the shared time-axis/transport reading. No second playback clock. |
| Graph/relation | Native nodes and relation handles, direction/weight/type and selected occurrence context | Canonical graph reading and owner relation operations; source and projection revisions visible. |
| Agent/machine work | Domain-specific configuration, execution/state view and acknowledged Actions | Native product capabilities and receipts. No fabricated activity, agent participation, or execution success. |

## Parameter representation

Reuse `ParamDef` and `NATIVE_BINDINGS`; do not create another conversion table. The existing adapter already converts position units and radians/turns, supplies source defaults, and binds scene values back to native fields. The editor records which definition and binding revision it uses.

Rules for every bound parameter:

1. Address it by an owner-disclosed stable instance and parameter identity. Entity and relation automation use stable entity/link IDs; an array index is resolved only inside the existing native adapter.
2. Keep the native value losslessly. Formatting and display-unit conversion belong to the presentation. Reading a value outside the soft slider range does not clamp or rewrite it.
3. A soft range describes useful manipulation; hard bounds describe legal typed input. Logarithmic controls use a positive disclosed domain. Zero/sign-changing values require an explicitly supplied transform. Discrete/enumerated values expose the owner's actual choices.
4. Reset uses a disclosed factory/default definition or a separately labelled return-to-retained-basis operation, never a guessed zero. Registered field bindings have source defaults; `entityTargets().defaultValue` is that entity's current retained value, not a factory-reset definition. Typed values are checked for the unit, finite value and owner bounds before dispatch, then judged again by the native owner.
5. A parameter that lacks a definition stays preserved and inspectable. Its current raw value can be shown in Source details. The editor must not invent a unit, semantic label, writable range, default, or response curve.
6. Unknown fields survive round trips through the existing document owner. An editor changes its named fields; it does not serialise a reduced replacement document.

The current audio `/api/document` supplies readable device names and parameter values but no proven stable write identity/revision. Those readings remain read-only until the device lane's actual editing/metadata contract lands. The old generic numeric fallback in the existing scene implementation is not an admission basis for a new professional editor. The existing `bindValue` helper changes a local Scene with path safety; it does not enforce all parameter bounds or provide native CAS/acknowledgement. Importing it does not admit shell writes by itself.

## Interaction and visual craft

Use the measured shell chrome and typography. Amber marks focus/active interaction and native selected state; the user-colour layer identifies tracks/subjects. Device-specific colour may communicate real domain information, but does not compete with selection. Internal editor graphics may have their own meaningful palette.

Controls need enough target area to operate while keeping the dense shell rhythm. Knobs, sliders, XY/geometry handles, nodes and curves use the same input rules, accessible names, units, focus ring and inline numeric entry. Knobs are suitable for a scalar; a relational or spatial operation should expose the relation or space itself. Every direct manipulation also has a precise keyboard/typed route.

A control displays the latest acknowledged value and any current draft distinctly. Effective modulation never overwrites the authored base value. Undo/redo follows the native owning history. A visual display that cannot be derived from an owner reading says what is unavailable through a concise contextual disclosure; it does not animate a plausible substitute.

At 1920×1200 and around 700 px, replay the actual chain/selection, expansion, pointer and keyboard editing, contextual mode changes, and return from another instrument. Capture the candidate separately from the reference captures. No milestone prose belongs on the working canvas.

## Editor admission packet

Each editor lands with one packet, alongside its implementation, before it can replace native controls:

| Packet field | Required content |
| --- | --- |
| Editor identity | Stable editor/type ID, supported native owner/type revisions, compact/expanded composition, implementation package. |
| Source and licence | Step A/B/C/D acquisition, source revision, classification per imported source, applicable target IDs. Step-C classification precedes code adoption. |
| Bound controls | Exact native paths/refs, source definitions and conversions, grouping, defaults, ranges, accessibility and keyboard behavior. |
| Domain visual | Readings or calculation source, meaning, units, update policy, absent-data behavior. |
| Native operations | Read, preview (if supported), commit, cancel, reset, history and save operations actually supported; no no-op capabilities. |
| State and continuation | Revision basis, focus/open epochs, native draft/dirty standing, save destination and recovery owner. |
| Executed acceptance | Real document/ref/revision, before/after owner readings, receipt, save/reopen result, conflicts/cancellation, screenshots at both densities, exact failures. |

Existing permissive native primitives are Step B imports. tldraw remains study-only; GPL-family NLE source remains interface-only pending an explicit licence decision. Existing MapLibre stays the Places body. Source-specific classifications in the 126-target register remain authoritative; this standard does not reclassify them.

## Proposed editor operation protocol

This is an **adapter contract to implement against native capabilities**, not a new kernel wire API. Existing typed native operations and outcomes remain authoritative. Do not dispatch these illustrative names as invented kernel verbs.

An editor session carries:

```
ownerRef + subjectRef + occurrenceRef (when applicable)
native instance/parameter identities
document revision + parameter-definition revision
host binding/epoch + selection/open generation
capability reading + current value reading
```

These fields come from current owner readings. A missing capability is explicit. Display identity, chain position and parameter path alone are insufficient authority to mutate.

| Transition | What the adapter does |
| --- | --- |
| Open → ready | Read the subject, its definitions and operations; resolve the existing binding; subscribe to the existing owner disclosure mechanism. Validate identity before adopting. |
| Ready → gesture | Capture target, revision, epoch and selection generation once. Retain the starting value and the user's intended value separately. |
| Gesture → preview | Update the local visual draft. Dispatch preview only if the native owner offers a reversible preview capability; coalesce within that owner protocol and retain ordering. |
| Gesture → commit | Submit one native operation with the captured revision and target. Preserve its request identity and exact result. |
| Commit → acknowledged | Adopt the owner's resulting value/revision and receipt. Read back when that operation requires it. Expose actual owning save standing separately. |
| Commit → conflict | Keep the draft and both revisions. Refresh canonical readings; offer the existing native conflict operation. Never blind retry over the new revision. |
| Gesture → cancel | Discard the local draft; cancel native preview through its supported operation. No unconditional rollback write. |
| Any → stale/unavailable | Stop adopting stale replies and stop dispatching from the old binding. Dispose subscriptions/leases, retain unsaved work through its native family, and reread on return. |

An owner may only support atomic commits, rather than preview or grouped history. Expose that exact behavior; do not simulate native support. An operation that spans several products needs the native orchestrating owner or an explicit inspectable multi-owner plan; the shell cannot pretend that independent writes are one atomic transaction.

**Saving:** an acknowledged in-memory change, recovery checkpoint, saved scene and written file are different facts. Use the existing A1 family. The status names the owning operation and its failure/conflict. “Saved” appears only after the required owning operation succeeds; cancellation, transport failure, a retained draft, or an elapsed debounce timer cannot produce it.

**Timing:** the candidate now implements `techne:time-axis/v1` as a pure projection over the existing temporal facet/precision owner and an explicitly acknowledged session window. It is not an installed dated-Scene acceptance claim. Each automation source names its time domain, units, origin and authoritative clock. There is one authoritative clock per disclosed domain, with explicit conversion between audio, simulation, and civil/work time. A physical simulation snapshot is a retained reading, not another authoritative clock. Clock conversion and civil-time policy are owner contracts, not per-editor arithmetic guesses.

## Initial delivery and remaining work

Observed implementation: real audio document readings; reusable native definitions/bindings; hosted Expressions/Technē body; typed retained editor connection, Glyph/Force/Medium/Rack source; exact native refs/receipts; graph imports and headless Technē navigation. The source-native read-only bridge audit passed 17 checks. Native GUI commit/history retained Chakral revisions 5 and 6, with its original value restored. Neither proves canonical file Save or editor admission. A genuine competing recovery draft and unsubmitted input are preserved. Current generic audio forms and the historical crowded native rack **do not pass this standard**. The compact candidate still needs native computer-use craft admission.

The parent owns the shell-facing integration and acceptance described in [KERNEL-STATE-FOUNDATION.md](KERNEL-STATE-FOUNDATION.md), consuming bounded native/settings/editor contributions through the actual package/owner seams. No cross-chat orchestration replaces that work. The first outward path must prove chosen-control discovery/scope, real manipulation, acknowledgement, required saving, deep return and fresh continuation before original controls move.

The receiving grammar, `oi.native-editor/v1`, is now connected through normal `/editor` and `/editor-host` exports to the retained DocumentStore/NativeWorkspace. It captures Expression/native/scene/authoring basis plus host binding/epoch; replies carry owner readings/refusals. This is an app adapter, not a new kernel verb or admission proof. It now carries the authoritative Journey.shared.toolbelt chosen-control list and native pin/order/Follow/Bind operations. Scene editing and whole-expression composition are joined. Most other outward feature apertures still need implementation and activity admission. See [INSTRUMENTATION-CONTRACT.md](INSTRUMENTATION-CONTRACT.md) and the interaction study.

## Shared time receiving protocol — implemented foundation, unadmitted target scope

The boundary's normal `./time-window` export carries `oi.native-time-window/v1` over the existing correlated request channel. Requests address the exact Expression revision, Scene, primary reading and Timeline/Places instrument. The shell retains one adapter injected with the canonical host DisclosureSessionStore; the retained body has input drafts and acknowledged snapshots only. Primary owner reading admission does not move the session.

`read` aligns a co-referenced instrument and refuses stale source snapshots or conflicting native ground. `set` compares the captured session ref, source-qualified selection and prior window before using the native setter. `refresh` is an explicit person action which places the admitted source/Scene into the native session through its existing selection operation. It does not bypass a refused primary reading. Same-source window continuity follows the native store; a changed source follows its native reset rule. Camera pan/zoom never writes bounds.

Timeline, Relations, Phase, Activity and Places report the same acknowledged scope. Out-of-scope facts remain distinguishable; unresolved dates retain their verbatim carriers. Source-defined calendar comparisons preserve reduced historical years, explicit offsets and precision extents through the existing Timeline owner. There is no second timestamp store or clock.

The native protocol/helper exercise uses a genuine current-register reading and protects retained works. That register currently supplies no dates or located facets; the installed Technē Scene refuses its stale retained source. Those checks do not admit T6/T17 dated behavior, a host/iframe roundtrip or the mounted UI. Exact executed scope and remaining faults are in `shared-time-increment.json`.
