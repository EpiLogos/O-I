# World shell: builder contracts

**Standing:** the shell's builder contracts, carried from `WORLD-SHELL-DESIGN.md` and `DEVICE-SEMANTICS-LOCK.md` on 27 Oct 2026; the manual ([`../dlw/DLW.md`](../dlw/DLW.md)) is the spec, and PROGRAMME ([`../../desktop/cradle/docs/world-shell/PROGRAMME.md`](../../desktop/cradle/docs/world-shell/PROGRAMME.md)) holds the owner's rulings.

## 1. The device face, its parameters, and the faces with bodies

*From WORLD-SHELL-DESIGN §5 and §14.*

The device aperture is proven and generalises as-is. A face receives
`{reading, disabled, apply, captureCurrent}` plus `renderControl` and
`createCustody` for gesture-bearing devices
(`NativeDeviceEditors.tsx:420-425`); writes are same-basis, single-flight,
with retained drafts and explicit Apply/Discard/Retry
(`NativeDeviceInputCustody`, 47-85). Presentation states exist: chain strip
(`NativeDeviceStrip`), compact vs configure (`NativeRackEditor`
`is-compact`/`is-configuring`), Configure families
(controls/device/rack/scene, `NativeWorldDetail.tsx:158-178`), Deep edit
expand/collapse, and device enable toggles. Pop-out is supplied by the
pane engine's detach rather than a new mechanism.

- **Document faces**: hosted HTML pages — `ql-flow.html`, the 4+2
   `ql-daily-die.html`, curated returns and future pages. The hosting
   path exists (`document/frame.ts` sandboxed opaque-origin iframe,
   bounded postMessage `oi:document-host-request/response/changed`,
   payload island `#ql-doc`, save router with named outcomes
   `saved | unchanged | stale | conflict | refused`). The design promotes
   the binding to a device face: body = the page, rack strip = identity +
   basis + save state, aperture = the encounter. Documents become rack
   citizens with lifecycle (dock / expand / pop-out) instead of special
   cases.
- **Conversation faces**: Nara/agency encounters — canonical CAS stays
   in AIKit; the shell binds via `oi.nara-dialogue-binding/v1` over kernelOp
   (`nara/nativeDialogue.ts`); the surface is an `encounter` binding already
   hosted in panes and detachable windows. A conversation is also a clip in
   the Timeline projection (its transcript is temporal material).

### 1.1 Parameters, specification and modulation

"Plugins/params introduce scope for modulation and specification" made
precise:

- **Parameter** = typed address with declared scope:
  `{family, device-instance, key, type, range/unit, write-path}`. The
  device change kinds are the seed grammar (`engine.{key}`, `morph.law`,
  `colour-setting{key:value}`); the family manifest generalises it.
- **Specification** = scope declaration — what an instance binds to:
  encounter, subject, pane, session. The aperture's target/basis is the
  existing mechanism. Tightening scope is specialisation.
- **Modulation** = a routing relation, source → target parameter, within
  declared scope, always through the custody/receipt law (modulation
  deepens writeShared, never bypasses it). Sources: time functions (§7),
  telemetry (Actuation), native engine observations (the crosswalk's
  "evaluator observed separately from authored values"), and other
  parameters via macros — the mockup's macros are the first modulators,
  and the rack-topology family's "macro range/curve/scope" is their
  contract.
- **Honesty law for modulation**: every modulated parameter shows its
  modulator (Live colours the modulated knob). Capability honesty applied
  to parameters — nothing moves without a visible cause.

The experiment case composes all of it: an Actuation experiment is
specification (scope: these agents, this loop) + telemetry (observables) +
modulation (cadence from cron, or M3 phase from chronos, addressing the
capture rate) + Factory receiving (results Return).

## 2. The semantics gate

*From DEVICE-SEMANTICS-LOCK §0 item 5 and §5. The law the gate checks is the manual's §3 and §16 ("What each part keeps").*

**The gate makes it unavoidable.** Law a gate cannot check is aspiration
(`skills/m-prime-development/FOUNDING.md`).

The rules live in `inhabitants/sdk/validate.ts`, with the vocabulary in
`inhabitants/sdk/semantics.ts` and the registry in `semantic-registry.json`:

1. **`liveSemantic` is required** on every face declaration, from the closed
   vocabulary (`device-instrument`, `device-audio-fx`,
   `device-midi-fx`, `rack`, `macro`, `clip`, `track`, `scene`, `browser`,
   `detail-clip`, `transport-slot`, `return`, `link`, `info`, …). Unknown or
   missing → refused at admission, fault named.
2. **Mode legality.** A semantic must be legal in each mode the face claims
   (the chains of manual §16.2).
3. **Invariants.**
   - `device-instrument` declares the owner op that generates (write path);
   - `device-audio-fx` / `device-midi-fx` declares the material it transforms
     and keeps the stream (no replacing write without a receipt);
   - `rack` declares its chains (≥1) and its chain selector;
   - `macro` maps ≥1 declared row of its own device, with ranges;
   - `clip` binds native material by ref + revision with a state;
   - `track` names its native stream (no copied store);
   - `scene` names the clips it launches together.
4. **Presentation follows semantic.** The format stays (`chain-plate`, `die`,
   …) but must be compatible: `die` only for the Day instrument; `run-viewer`
   only for `track`/`arrangement` in Factory; `instrument-face` only for
   `device-instrument`.
5. **Live-basis cross-check.** A semantic that has a Live-mode exemplar
   carries a pointer to it (device dossier or `.als` behaviour in
   `Work/reverse-engineering/ableton-live-12.0.25/`), so the DLW reading can be checked
   against the measured original.
6. **The registry is generated.** `devices:validate --json` emits the
   world's semantic registry (every face: family, modes, semantic, format,
   write paths); a test locks it, so a semantic change is a reviewed diff.

## 3. Families, the neutral door and exposure

*From WORLD-SHELL-DESIGN §12, §13, §16, and §5.6's plugin kind (§1.3 of the folded panes ontology).*

Owner direction, 8 October 2026, extended in conversation from the
agent-shell mockup (`agent-shell-mockup.html`, tokens copied from the real
shell styles at `45e15ed8b`) and the port accounting
(`EXPRESSIONS-PORT-STATUS.json`): the six products — **central, actuation,
ai-kit, software-factory, workcell, quaternal-logic** (the full-suite
backing, `footprint.json`) — each contribute a **device family**, and that
is the cleanest way to expose their functionality across every view,
surface and lens.

A family is an inhabitant manifest with declared contents:

- `browser` — its left-browser categories and places;
- `faces` — its rack devices, each implementing the proven aperture;
- `params` — its typed parameter addresses (kind/key/value grammar, ranges,
  units, write path under the writeShared law);
- `projections` — optional adapters that project family material onto the
  shell's tracks and instruments (Factory runs → Timeline tracks; QL sky →
  the World's sky layer; Central ground material → graph overlays);
- `inspectors` — its implicit agent/file-grade contextual panels;
- `time` — which time strata it consumes and which temporal material it
  contributes (§7);
- `telemetry` — the observables it exposes as modulation sources.

The manifest is authored by the family's native owner — this is the
mechanism behind "Factory and Central entry points stay reserved for their
native owners": the shell's door is neutral, the keys are held by owners.

The shell core is the uncarved block: it knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture,
parameters, modulation routing, the time spine, and the admission door.
The core never says "Central" or "Factory"; products exist only as
admitted families. Carving = declaring a family = adding typed scope to a
neutral substrate.

Working test of neutrality: a seventh product should integrate with no
core change. If a core change is needed, either the family boundary or the
core concept is wrong — and the correction is proposed at the neutral
layer, never special-cased per product.

Each family appears in exactly four places and nowhere else: the browser
(its categories), the rack (its devices on the selected material's chain),
the projections (its material via adapters), and the inspectors (its
implicit panels) — plus its time bindings and telemetry declarations. A
family needing a fifth place is a design smell: either the projection set
or the family boundary is wrong. This is the no-bespoke-UI law stated per
family, and it is how "QL-MEF and ta onta and all the rest become utterly
available" without any of them becoming an application.

### 3.1 Plugin: the delivery kind

**Definition.** A plugin is a family's or owner's admitted manifest package:
instruments + devices + browser categories + faces, delivered through the one
neutral door. Two spellings, one door:

- the **family manifest** (`manifest.ts:85-98` `InhabitantManifest`: browser,
  faces, params, projections, inspectors, time, telemetry — the four
  surfaces of §3, `manifest.ts:13-16`), admitted at the neutral registry
  (`manifest.ts:111-190`; re-admission, collisions and undeclared-face
  parameters refuse, `manifest.ts:123-153`);
- the **SDK declaration** (`sdk/define.ts:179-212` `FamilyDeclaration`: owner,
  product carving, browser ids, devices, paramsGrammar, transport bindings,
  projections, inspectors, time, telemetry, writers + writerAuthority) —
  validate-first admission (`define.ts:527-551`) and additive extensions
  (`define.ts:559-603`).

The **mode plugin** ("a declared bundle — `{browser category entries,
device faces, projection bindings, document kinds, optional center panel}`",
`WORLD-SHELL-DESIGN.md:519-526`) is the plugin kind scoped to a mode: the SDK's
mode scoping realises it (`define.ts:143-149` `modes`/`formats` per device;
`define.ts:318-328` `facesForMode`). The **uncarved-block law** is the
plugin/instrument boundary: "the core knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture, parameters,
modulation routing, the time spine, and the admission door"
(`WORLD-SHELL-DESIGN.md:758-762`); the working test is the seventh product
admitting with no core change (`WORLD-SHELL-DESIGN.md:764-771`). In ontology terms: **the core knows instrument types
and the door; plugins deliver types' implementations, devices, and
categories.** Atlas-earth is the worked example — a family (not one of the six
products) admitting its own views and faces (`atlasFamilyManifest.ts:9-47`).

## 4. Panes and instrument types

*From WORLD-SHELL-DESIGN §4 and §5.6–§5.9 (the folded panes ontology), with the specification gaps G1–G8 and G10 from that ontology's §5 (`wayfinder/DLW-PANES-ONTOLOGY.md`, retired in `948b53b0e`).*

The pane engine is the cradle surface system, hosted in the shell — `TabGroupPane` / `SplitPane` / `LayoutState` with
`root`, `surfaces`, `closedStack`, `focusedGroupId`, `maximizedGroupId`,
`sidePane`, `detached`, `modeLayouts` (`surface/types.ts:86-172`); operations
open/close/split/tile/moveTab/cycleTab/togglePin/detach/redock
(`surface/engine.ts`); retained bodies kept mounted per pane
(`Workbench.tsx:460-463`); real second-window detach and redock
(`DetachedFrame.tsx` → `window_binding` / `window_redock`; admitted kinds
include `source, knowledge, file, encounter, browser, terminal, flow`).
The engine composes the main area in every mode; a pane holds one
instrument instance.

- **Hidden-inhabitant retention**: projections keep mounting while
  hidden (`App.tsx:124-134`), so returning to a pane restores its actual
  camera, selection and temporal state — the Atlas already proves this
  pattern (time-window snapshots across mode transitions,
  `controller.ts:418,845,882,959`).

Every pane in the shell hosts an **instrument**: a pane-instrument is the
generating body that produces and maintains a pane's surface, and every pane
body is an instance of exactly one instrument **type** (Earth, Timeline,
Graph, Expression, Document, Sessions, Thread, Terminal, …). An instrument
type is a declared contract — mount/unmount, encounter subscription, retention
class, its device set, its browser categories, its render surface — and a type
may have several **implementations**, which coexist as selectable
alternatives exactly as Ableton offers several reverbs under one effect type.
**Devices** are the parameter-bearing kind: SDK-declared faces docked on the
rack that parameterise an encounter; a pane-instrument *exposes* devices (the
Earth instrument exposes the graph tools and time control) but is not one.
**Plugins** are the delivery kind: a family's or owner's admitted manifest
package that delivers instruments, devices, browser categories and faces
through the one neutral door (`inhabitants/manifest.ts`) — the core (the
uncarved block) knows only instrument types and the door, never a product.
A **set** is a named arrangement of panes × instruments × (devices, contexts):
each mode's default set is declared data (the mode grammar), user-saved sets
are retained `LayoutState` snapshots per workspace — the Ableton Live Set
analogy, made precise by the pane engine's own persistence law.

### 4.1 Pane-instrument: the superordinate kind

**Definition.** A pane-instrument is the generating body a pane hosts: the
thing that produces and maintains the pane's surface. A **pane** (the engine's
tab group leaf — `desktop/cradle/src/surface/types.ts:122-140` `TabGroupPane`,
`types.ts:142-148` `SplitPane`) is geometry + focus + a tab strip; it is *not*
content. What fills it is an **instrument instance**: one running body of one
instrument type, bound to one encounter slice. Two panes can hold two
instrument instances of two types over the same subject ("two panes can hold two projections of the same subject side by
side"; `types.ts:22-35` header; instance identity is kind + subject,
`types.ts:111-118` `binding.projection`).

**Every pane body is an instrument instance of an instrument type.** The four
projection pane body kinds (`types.ts:36-45`
`PROJECTION_PANE_KINDS`: `projection.earth` · `projection.timeline` ·
`projection.constellation` · `projection.expressions`) are the first four
instrument types given engine-level names. The ontology's move is to
generalise: the engine's *body kind* **is** the instrument type id, for every
body — documents, terminals, threads, sessions, the knowledge graph — not only
the four projection kinds. Today those other bodies ride ad-hoc binding-kind
strings (`SurfaceBinding.kind`, `types.ts:69`; detached admitted kinds
"include `source, knowledge, file, encounter, browser, terminal, flow`",
`WORLD-SHELL-DESIGN.md:454-456`); gap G1 (§4.7) proposes unifying the
spellings.

**The type contract.** What an instrument type declares. The projection seam
already carries the whole shape for projection kinds
(`desktop/cradle/src/surface/projectionModules.ts`); the ontology states it as
the general contract every type satisfies:

```ts
/* SKETCH — the instrument-type contract. The projection seam already
 * implements this for the four projection kinds (projectionModules.ts:119-153);
 * the ontology promotes that shape to every pane body kind. */
interface InstrumentTypeDeclaration {
  id: string;                       // the pane body kind ('projection.earth', 'graph.knowledge', 'doc', …)
  title: string;                    // human name ("Graph", "Terminal")
  family?: string;                  // the admitting family, when not core (§3 exposure law)

  // — lifecycle —
  create(ctx: InstrumentContext): InstrumentHandle | Promise<InstrumentHandle>;
  //  InstrumentContext = { kind, binding:{id,title,subject_ref?}, element, encounter }
  //  InstrumentHandle  = { unmount(): void; setVisible?(v: boolean): void }
  //  — verbatim the ProjectionModule contract (projectionModules.ts:119-141),
  //  including the hidden-inhabitant law: state MUST survive until unmount
  //  (projectionModules.ts:133-141); returning restores actual camera,
  //  selection and temporal state.

  // — encounter subscription —
  //  through the EncounterBridge (projectionModules.ts:83-99): the module
  //  reads mode × world × subject × occasion × accessEpoch, subscribes
  //  epoch-guarded, and propagates selection as EncounterTransitionIntent
  //  (subject | occasion | present) — never a second selection store
  //  (projectionModules.ts:72-81).

  // — retention —
  retention: 'retain-concealed' | 'release-concealed';
  //  the pane tier's three-tier law (Workbench.tsx:426, 451, 474): every kind
  //  retains concealed except declared cheap-list kinds ('sources','blank'
  //  today — CONCEAL_RELEASES, Workbench.tsx:474); each type declares its class.

  // — its device set —
  devices: readonly string[];       // face addresses `${family}:${face}` that
                                    // present when this type is focused
                                    // (the rack follows the focused pane's
                                    // instrument — manifest.ts:165-171 facesFor;
                                    // device "operatesOn" names surface kinds,
                                    // manifest.ts:26-28)

  // — its browser categories —
  browserCategories: readonly string[]; // where instances of this type are
                                    // listed/offered (mode grammar categories,
                                    // modeGrammar.ts:79-95,127-129; family
                                    // declarations, manifest.ts:49-54; the
                                    // mockup's per-mode `views` category IS the
                                    // instrument chooser — world mockup:1505)

  // — its render surface —
  surface: 'pane' | 'pane-or-window';   // detachable types admit pop-out
                                    // (engine.ts:681-693 detach/redock;
                                    // instrument types with windows declare it)
}
```

**Instance.** `type → implementation → instance (pane)`. An instance is one
running body: binding id + type + implementation + encounter slice + retained
state. The binding carries the instance's slice as plain serialisable
presentation state (`binding.projection.{kind, subject_ref?}`,
`types.ts:111-118`; absent `subject_ref` = the pane follows the encounter,
present = pinned).

### 4.2 Device: the parameter-bearing kind

**Definition.** A device is a component docked on a rack/chain that
parameterises an encounter — the die, hygiene, morph, colour, gateway, world,
git. Devices are SDK-declared (`packages/live-shell/ui/src/inhabitants/sdk/define.ts:134-161`
`DeviceDeclaration`: id, title, mark, kind, mode scoping, presentations, note,
admission, dock, document/conversation body, `params` rows) and
agent-addressable: each parameter row is a typed address `{family,
device-instance, key, type, range/unit, writePath}` (`manifest.ts:38-47`
`ParamAddress`; `sdk/define.ts:57-129` — "A row without a writePath IS a
reading — that is the grammar, not a convention", `define.ts:18-20`), written
only through the custody/apply aperture and the writers law
(`sdk/define.ts:204-212`, `define.ts:396-407`; `NATIVE-EDITOR-STANDARD.md:43-56`
affordance table). Every face wears its mark from the icon cut — the one
readable place of the shell's icon language (`inhabitants/sdk/icons.ts`,
generated from `new-shell/icon-cut.html`; `modeGrammar.ts:11-12`), and a
device without its mark "is not a face of this shell" (`sdk/define.ts:140-142`).

**The relationship to pane-instruments, precisely.** A pane-instrument *may
expose* devices; a device never hosts a pane. Three composable relations:

1. **Exposition** — the instrument declares which faces present when it is
   focused: the Earth instrument exposes the atlas's own graph tools, mode
   switch and time control (`atlasFamilyManifest.ts:25-31`); the rack "follows
   the focused pane's instrument" (`manifest.ts:165-171` `facesFor`;
   `WORLD-SHELL-DESIGN.md:272-273`). The device's `operatesOn` names the
   encounter-surface kinds it works on (`manifest.ts:26-28`) — an instrument
   type id may appear there.
2. **Composition** — some devices are *bodies of* an instrument instance:
   document devices (the Day die, the Flow) and the conversation device have
   bodies that can fill a pane (`worldShellFamilies.ts:56-90`: `kind:
   'document'` / `kind: 'conversation'` with `dock: ['dock','expand',
   'pop-out']`). The ontology reads this as: the instrument types **Document**
   and **Conversation** have their canonical *instances* as rack
   faces, and any face instance may be docked, expanded (pane), or popped out
   (window) — three presentations of the same instance, one body, no duplicate
   (`sdk/define.ts:155-157`; pop-out is supplied by the pane engine's
   detach).
3. **Parameterisation** — devices address an instrument's behaviour through
   §1.1 parameter addresses and modulation (`WORLD-SHELL-DESIGN.md:772-799`;
   every modulated parameter shows its modulator). The atlas's graph tools
   (depth, dust, ties, spread, gravity, sky) are exactly this: device-shaped
   controls over the graph instrument's tool state
   (`projections/atlas/src/graph/tools.ts:7-17,19-29`).

The distinctions the owner drew hold: an **instrument** is a
pane-instrument (it fills the focused pane and carries its own native controls
— `WORLD-SHELL-DESIGN.md:143-148` Rev 3 "the instrument is the instrument");
its *controls* are devices on the detail row (the Technē device column,
`world-shell-mockup.html:1646-1649`). A device is never "inside" a pane as its
body; where a device body needs pane space it *becomes* an instrument instance
by docking into one (relation 2).

### 4.3 Implementation and type

The owner's reverb point (PROGRAMME R7), made structural. Ableton's device
chooser offers several reverbs: one *effect type*, several *implementations*,
each instance one choice:

```
instrument TYPE        implementations (coexisting, selectable)      instances (panes)
──────────────         ──────────────────────────────────────        ─────────────────
Earth              →   atlas globe port (three.js, SwiftShader)   →  pane
Timeline           →   world presentation (L4) / aion / live arr. →  panes
```

**What makes implementations interchangeable is the type contract** (§4.1):
every implementation of a type satisfies *the same* obligations — its
material over an encounter-bound reading, navigation, selection that
propagates as an encounter transition, honest ghosts for unresolved material,
its device set, its browser categories, retention class.

The **admission grammar follows the type ladder**:

```
type                  (the pane body kind — engine-known)
  └─ implementation   (admitted per type through the door; ONE default, N alternates)
       └─ instance    (kind + subject binding — types.ts:111-118)
```

The projection door admits **one module per kind** and refuses a
second ("kinds are not silently replaced", `projectionModules.ts:157-169`) —
correct as an admission discipline, but it collapses implementation into kind.
The ontology requires the door to mature one level: kind → *implementation
registry* (gap G2, §4.7), where a family admits an implementation under a type,
one implementation is the default (per mode, per set), and switching
implementations is a per-instance choice — Ableton's device chooser, not a
fork.

**Base instrument per mode.** Each mode's default pane-instrument — what a new
pane opens with in that mode — is grammar data. Each mode's opening is the
manual's (§17.1–§21.1); the per-mode Session|Arrangement presentations are
typed in `modeGrammar.ts:122-124` (`session`/`arrangement`). The
base-instrument declaration is gap G6 (§4.7). The per-mode layout
*retention* exists (`workspace/store.ts:125-141`
`switchWorkspaceMode` saves the leaving mode's tree into `modeLayouts`,
`store.ts:42`), which is the mechanism a declared default set initialises.

### 4.4 Set: the named arrangement

**Definition.** A set is a named arrangement of panes × instruments ×
(devices, contexts): *which* panes (the split tree), *which* instrument
instances fill them (bindings + subjects + implementations), *which* devices
stand on the focused chains (enablement, fold state), *which* contexts the
panes hold (follow/pin). Two registers:

- **Default set (per mode).** Declared by the mode grammar: the mode's browser
  categories, its Session/Arrangement presentations, its Clip|Device pair
  (`modeGrammar.ts:115-142` `SurfModeGrammar`) — with each mode's opening
  arrangement as the manual states it (§17.1–§21.1). The rule both registers
  obey:
  "Each arrangement keeps its own panes; the encounter carries across"
  (`world-shell-mockup.html:1596` data-i).
- **User set (per workspace).** The Ableton Live Set analogy made precise by
  the engine's persistence law. **What saves** is exactly a `LayoutState`
  (`types.ts:162-208`): the pane tree (`root`), every binding ever opened with
  its encounter slices (`surfaces`, including closed — the reopen-honestly
  stack `types.ts:167-171`), focus (`focusedGroupId`, `focusedTabId`),
  maximise mask, side pane, detached windows, per-mode side-region memory
  (`modeRegions`, `types.ts:206-207`) — plus, per retained tab, the body's own
  state (camera, selection, temporal position: the hidden-inhabitant law,
  `projectionModules.ts:133-141`; the hosted engine checkpoint ref,
  `types.ts:97-104`). **What does not save**: semantic state — subjects stay
  refs, never copies (`types.ts:12-13` "Presentation state only — it never
  becomes a semantic identity"); encounter state lives on the spine, so a set
  reopened under a moved encounter re-binds instead of lying.
  Mechanism: `modeLayouts` per workspace book (`store.ts:42`,
  `CradleFrame.tsx:427-428` reconciles surfaces across all layouts). Named,
  savable user sets are gap G4 (§4.7).

### 4.5 What each kind is not

| | Pane-instrument | Device | Plugin | Set |
|---|---|---|---|---|
| Fills a pane's body | **yes** (it *is* the body) | never (docks on the rack; may *become* a pane by docking, §4.2) | never (delivers things that do) | names an arrangement *of* panes |
| Bears parameters | may expose them | **yes** — its whole point (`ParamAddress`, `manifest.ts:38-47`) | declares them (`params` grammar) | retains their fold/enable state |
| Is admitted | as a type's implementation, through the door | as a face, through the door (`manifest.ts:115-155`) | **is** the admission unit (`InhabitantManifest`) | not admitted — saved |
| Has implementations | **yes** — the reverb insight (§4.3) | per-family faces; hot-swap within compatibility (DLW-PLAN §2 row "Hot-swap") | — | — |
| Is named/saved | — | presets (DLW-PLAN §2 "Preset") | — | **yes** — default + user sets (§4.4) |

### 4.6 The template every instrument type follows

Every other type follows the same five moves: (1) write the type contract as
the union of its implementations' proved obligations; (2) name each
implementation's file-level owners; (3) give the type one browser row and the
implementations the chooser; (4) bind instances as kind+subject (+implementation
choice); (5) declare the device set and retention class in the manifest. The
gaps in §4.7 are what stands between here and there.

### 4.7 The specification gaps

**G1 · body kinds become instrument types.** The pane engine's
body-kind spellings are three systems today: the four `PROJECTION_PANE_KINDS`
(`types.ts:36-45`), ad-hoc `SurfaceBinding.kind` strings (source, knowledge,
file, encounter, browser, terminal, flow… `types.ts:69` + detached kinds,
`WORLD-SHELL-DESIGN.md:454-456`), and the SDK face kinds
(parameter/document/conversation/instrument — `worldShellFamilies.ts:57-90`).
Sketch: one `InstrumentTypeDeclaration` registry (§4.1 sketch) whose ids are
the body kinds; the binding's `kind` references it; the four projection kinds
are its first four members; the cradle's existing kinds are declared (not renamed)
as the next members. Migration is additive; no operation changes.

**G2 · the admission door grows kind → implementations.** Today
`registerProjectionModule` admits one module per kind and refuses a second
(`projectionModules.ts:157-169`) — right discipline, wrong granularity for
the reverb insight. Sketch:

```ts
/* SKETCH — implementation registry at the existing door */
interface InstrumentImplementation {
  id: string;                 // the implementation
  typeId: string;             // the instrument type it implements
  family: string;             // admitting family (§3 exposure law)
  create: ProjectionModuleRegistration['create'];   // unchanged module contract
}
registerInstrumentImplementation(impl);   // refuses: unknown type, wrong family, duplicate id
setImplementationDefault(typeId, implId, scope: 'core' | SurfMode);  // per mode or core-wide
// instance binding gains: {kind, subject_ref?, implementation?}
//   — absent implementation = the scope's default; present = the chooser's pick.
```
The existing one-module-per-kind refusal becomes the *default slot's* refusal
(two defaults for one type refuse; alternates never collide).

**G3 · the default Graph, per mode.** Settled by the owner's correction of 13 Oct 2026 (PROGRAMME R26, §8.1): the two graphs are two instruments, not two implementations of one type, so no default Graph is chosen between them (manual §17.2 graph view, §17.3).

**G4 · the Set document (named user sets).** What saves is
§4.4's list; what needs specifying: the Set's identity and home (a workspace
book record? a kernel-owned document with refs?), the save gesture (the
manual's File menu: Save Set, Save Set As…, Save Set as Template…, §10.3),
and set contents' ref-honesty on reopen (a set is a *layout over refs*;
subjects may have moved — reopen re-binds, never copies).
Proposed acceptance: save a set
in mode A with pinned + following panes; close; reopen in a fresh workspace
book; all instrument instances restore by ref with retained camera/selection.

**G5 · the chooser gestures as grammar.** The mockup's
insertion law — click into the focused pane as a tab, ⇧-click splits
(`world-shell-mockup.html:1505,1583-1584`), drag a tab onto a centre/edge
(`:1684-1688`), the ⊞ menu (`:1620`) — is the instrument-chooser grammar and
is not yet in the mode grammar or the engine's action registry (the engine has
`splitOff/tileSurfaces/moveTab`, `engine.ts:451-563`; the launcher gestures
are mockup-local). Sketch: name them as frame actions (`views.pull`,
`views.pull-split`) beside the existing frame disclosures
(`registry.ts:96-153`), so browser rows, launcher cells and keys share one
grammar.

**G6 · base instrument + default arrangement per mode in the
grammar.** `SurfModeGrammar` gains `baseInstrument` (the new-pane
default) and `defaultSet` (the seed arrangement, as the manual states each
mode's opening, §17.1–§21.1), validated
against the instrument-type registry (a base instrument names a real type +
implementation). Cross-held to `sdk/modes.ts` the way the Rev-5 tables are
(`modeGrammar.ts:12-15`).

**G7 · are dock tiles full pane-instrument instances?** Settled by the manual (§16.3, §10.6): a tile on the rail is a device's Widget view, a monitor has its Widget and its Full, and the rail is the hosting geometry for those views.

**G8 · retention classes declared per type.** The three-tier
law exists (`Workbench.tsx:426,451,474`) but the release set is a hardcoded
pair (`'sources','blank'`). Each type's `InstrumentTypeDeclaration.retention`
(§4.1) declares its class; the pane tier reads the declaration. Projections
retain (the hidden-inhabitant law); cheap lists release; everything else
retains by default.

**G10 · instrument devices' `operatesOn` vocabulary.** Device
faces name the encounter-surface kinds they operate on (`manifest.ts:26-28`)
with free strings today ('expressions', 'source', a projection kind). Under
the ontology, `operatesOn` values are instrument-type ids (the rack follows
the focused pane's *instrument*, `manifest.ts:165-171`) — one controlled
vocabulary, the type registry's.

## 5. The encounter spine

*From WORLD-SHELL-DESIGN §2.1–§2.2.*

1. **Mode** — the shell's `ShellMode` (`audio | base | factory |
   expressions | techne | settings`, `src/continuity/workspace.tsx:15`) over the
   cradle's
   `WorkspaceMode` (`base | factory | expressions | techne | epi-logos |
   settings`, `cradle/src/workspace/mode.ts:23`), "each mode carrying its
   own layout tree (`modeLayouts`), with the standing rule that **a mode
   never closes surfaces**." (The new shell's surf grammar is
   `SURF_MODES` = live · base · factory · expressions · techne,
   `shell/modeGrammar.ts:31-33`.)
2. **World context** — the workspace book's `WorldContext`
   (`world: central | epi-logos`, subject, reading, trail;
   `cradle/src/workspace/store.ts`): "This is the encounter: what is
   selected, of which world, with what reading, and where you have been" —
   "plus project navigation and recent places."
3. **Kernel epoch** — "transport status and `accessEpoch`/`accessReady`
   generation bumping, which retires stale callbacks and gates every read on
   the current connection".

"Every projection instance and every device reads the encounter from this
spine; selection changes propagate as encounter transitions, not as per-view
state." The bridge is `projections/encounterBridge.ts` (epoch-guarded;
transitions through `book.setContext` as the one owner).

**The encounter address and the one transition** (`cradle/src/workspace/encounter.ts`): an `EncounterAddress` is
`{arrangement, projection, subject?, aperture, viewAs, occasion?}` where
arrangement ∈ base|factory|expressions|techne|epi-logos|settings,
projection ∈ earth|timeline|constellation|expressions, aperture ∈
world|local|shared|federated, viewAs ∈ me|field|public. `encounter()` is
"the only transition. Any axis may change; **the subject is kept unless
explicitly replaced — switching arrangement or projection never loses what
you were looking at.** The trail grows by one on every transition."

**Three spines, named apart.** "Spine" names three different things; keep
them apart:

1. the **time spine** — the five strata of §7 (`timeSpine.ts`);
2. the **navigation spine** — mode × world-context × kernel epoch, this
   section;
3. the **encounter spine** — `encounter()` and the Trail
   (`cradle/src/workspace/encounter.ts:61-89`).

### 5.1 The response laws

1. **A mode never closes surfaces.** `cradle/src/workspace/mode.ts`
   header: "Switching modes never closes surfaces, never restarts an
   encounter session and never touches the window's one Expression stage:
   open work, splits, widths and the accompanying binding all ride
   through." Per-mode trees wait unmounted in `modeLayouts` ("A mode with
   no saved tree opens on its MODE_CURATION default").
2. **Panes retain.** "Hidden-inhabitant retention stays: projections keep
   mounting while hidden (`App.tsx:124-134`), so returning to a pane
   restores its actual camera, selection and temporal state" (§4); retained
   bodies stay mounted per pane (`Workbench.tsx:460-463`); the retention
   warm set keeps recently visited workspaces' trees alive
   (`store.ts` `lastVisitedAt` + `surface/retention.tsx`).
3. **Every transition is an encounter transition.** `encounter()` is the
   only transition; subject survives any axis change; the trail grows by
   one; the encounter is linkable (`decodeEncounter`).
4. **Panes follow the encounter unless pinned** (the transport `follow`
   slot re-means per mode: "views follow the scene/day's Now/panes follow
   the encounter/arrangement scrolls with playback").
5. **Custody on every write** (§1): "writes are same-basis,
   single-flight, with retained drafts and explicit Apply/Discard/Retry";
   "Stale replies never commit to changed target, uncommitted human input
   retained" (crosswalk gesture-state family).
6. **Modulation honesty** (§1.1): "every modulated parameter shows its
   modulator (Live colours the modulated knob)… nothing moves without a
   visible cause."
7. **The designed empty state** (modeGrammar `state: 'waiting'` +
   `centre` compositions): an unreadable presentation renders "a DESIGNED
   surface, never a bare sentence in a void," and a waiting category "names
   its owner, never another mode's content."

## 6. Track adapters, takes and the builder's recipe

*From WORLD-SHELL-DESIGN §3.6, §3.8–§3.11.*

In the Digital Logos Workstation there is one material — the World, the shared
semantic field owned by native owners — and every sounding thing and every
temporal thing is **track material in the same neutral shape**: a family
projects its own reading into columns, tracks, clips and optional transport
takes through a World track adapter (`worldTrackAdapter.ts`), and the
Timeline "knows no family." The work-time stratum that all performable
material shares is the **sample clock**, bound read-only into a five-strata
time spine (chronos · civil · cron · transport · occasion) through one
declared mapping table in which **a conversion without a row refuses** — no
silent conversion between samples, seconds, transport units, M1 phase, M3
inscription, sky occasion and civil day ever happens by arithmetic alone.
The musical system is not a second ontology beside this one: M1 is the
oscillator **source** (owner D13), M2 declares **observables** whose type
carries `generates: false` and whose routes compile before realtime
execution, M3 supplies **form and score as clip material**, M4 is the
**body** the whole application already is — and every sonic or physical
entity carries its **role in the type** (resonator ≠ emitter ≠ collision
trigger ≠ analyser ≠ visual-only), its **epistemic standing verbatim**
(placement never upgrades standing), and its **take machinery** (§6.3). A track for sound and a
track for civil days are the same kind of thing at different carriers:
"Tracks are lanes of World material: Expressions scenes, historical events,
Factory runs, agent activity, conversations, civil days, celestial motion,
M3 clock transformations. Clips are the material in lanes".

### 6.1 The World track adapter contract

The contract (`src/timeline/worldTrackAdapter.ts`, header):
"a family projects its own reading into the Timeline projection's neutral
shape: columns (time blocks, e.g. scenes), tracks (lanes, e.g. objects or
automation), clips (spans placed in a column on a track), and optional
transport material. The Timeline renders this shape; it knows no family."

The four shapes, verbatim from the contract:

```ts
WorldTrackColumn  { id, name }
WorldTrack        { id, name, kind }            // kind chosen by the family
WorldTrackClip    { id, trackId, columnId, label,
                    span?: {start, end},        // column-local; units are the family's own
                    state?: string }            // the clip's standing
WorldTrackTake    { id, target, name }          // "Takes belong to the Transport stratum
                                                //  of the time spine. An adapter may expose
                                                //  them, but a take is never a clock and
                                                //  never a Timeline track."
WorldTrackSet     { columns, tracks, clips, transport? }
WorldTrackAdapter<T> { id, project(reading: T): WorldTrackSet }
```

The registered adapters, one shape:

| Adapter (registration id) | Family | Columns | Tracks | Clips | Source |
|---|---|---|---|---|---|
| `central-day-track` | Central civil | the civil days the reading covers; an **`undated` column stands FIRST** ("relative material is visible, never silently mixed into dated days") | `Central · day` (streams `central-now`, `wiki-returns`), `Machines · NOW` (`aikit-history`), `Kernel · event log` (`kernel-event-log`) | one **moment** per event at its day-local hour; standing `'fact'` as read | `src/timeline/dayTrackAdapter.ts` over the kernel's one temporal read |
| `factory-run-track-adapter` | Software Factory | civil days | one lane per run subject, **bounded to the twelve most active — honest overflow names the count, it never truncates silently** | the run's real events as moments; "a run with no events in the window draws no clips — its absence is disclosed by the presentation, not invented" | `src/timeline/runTrackAdapter.ts`; `isRunSubject()` admits `agent-session/`, `factory/`, `run:`, `run\d+` — "Conversation spaces are NOT runs" |
| `conversation-clips` | Central/agency conversations | civil days | one lane per conversation space (`session-space/` subjects), bounded to the **eight most recent with honest overflow** | the space's receipts — "a conversation's clip is its receipt trail"; "the canonical conversation stays in its owner; only its receipts are placed" | `src/timeline/conversationTrackAdapter.ts` |
| `expressions-tracks` | Expressions | **the scenes** | one row per entity of the presented scene, plus one automation track when any automation lane exists | **each sequence step as a glyph-state span: hold + transition**; `transport.takes` = the presented scene's property tracks | `src/timeline/expressionsTrackAdapter.ts` |
| `ql-audio-track-adapter` | Quaternal Logic (musical) | the composition passes | lanes carrying their **role in the type** (`ql-audio/resonator` …); spans are **exact u64 sample cursors** converted by the declared mapping | role + standing travel on the label; takes = the performance-recording seed | `src/timeline/qlAudioTrackAdapter.ts` |
| `ql-physics-track-adapter` | Quaternal Logic (musical) | the composition passes | lanes with role in the type **and a declared span unit** (`seconds \| m1-ticks \| engine-blocks`) disclosed on the track row | visual-only clips honestly labelled `· visual-only`, `state: 'visual-only'` | `src/timeline/qlPhysicsTrackAdapter.ts` |
| `atlas-aion-timeline` | Atlas (Earth/Aion) | deep-time epochs | the atlas family's epoch jump | — (epoch material) | `src/timeline/registerWorldTrackAdapters.ts` (lazy import of `../projections/atlas/aionTimeline`) |

**The two doors** (`src/timeline/registerWorldTrackAdapters.ts`), the
admission law of the ontology:

- `projectWorldTracks(declarationId, reading)` — **the FAMILY door**: "the
  id must be declared by an admitted family manifest (`projections[]`) and
  registered here… the shell admits material through owners' manifests,
  never by presence."
- `projectLaneWorldTracks(id, reading)` — **the lane door** for adapters a
  lane landed ahead of its family's manifest declaration: "the registration
  is the disclosure; the family door stays strict."

Laws every adapter inherits (from the files themselves):

1. **Nothing is copied** — each adapter projects "over the kernel's ONE
   temporal read (`temporal_events_read` — K1's bounded, cached read;
   nothing is copied into a second store)" (dayTrackAdapter header).
2. **No silent conversion** — units are declared per lane; cross-stratum
   mapping happens only through the declared table (§7.1).
3. **Standing travels verbatim** — "placement never upgrades it"
   (every adapter; §6.2).
4. **Honest absence** — designed empty states name their owner (mode
   grammar `state: 'waiting'`; undated column; disclosed overflow counts).
5. **Takes are transport material, never clocks** (contract line).
6. **Refusal names the law** — a miscast role or a wrong rate throws the
   classification or no-resampling law in the error text.
7. **Lazy import** — "a family's adapter module loads only when projected."
8. **Families never import the registry** — "the Timeline knows no family."

### 6.2 Standing in the code

The laws in the code:

- `timeSpine.ts eventStanding()`: "Events read from the kernel's temporal
  read are readings of record → 'fact'. The spine never upgrades standing
  by placement (Revision 2 law); a future source may supply
  claim/inferred/hypothesis/disputed/ghost and the presentation keeps it."
- The presentation renders standing on every clip as a
  `data-standing` attribute and in every hover title
  (`worldTimelinePresentation.tsx`; clips carry `state: clip.standing ??
  'fact'`).
- The audio adapter: "The role and the standing travel with the label:
  placement never upgrades standing, and the classification is visible."
- `ghost` is the honest unresolved link (crosswalk lane-1:C1, "Unresolved-
  link ghost nodes, rendered").
- **The occasion's basis/admission split is the temporal form of the same
  honesty** (`timeSpine.ts`): "a selected occasion RETAINS its snapshot
  basis (the event exactly as read: instant, summary, evidence) and
  separately qualifies its CURRENT admission — standing in a retained time
  is honest only while the qualification says the material is still
  admitted. Basis and qualification never merge." The K8 sky contract is
  the source law: `retained-occasion` "requires an existing exact
  snapshot… it never rewrites the snapshot or attests fresh current sky";
  retained admission "always sets `fresh_current_attested=false`"
  (`K8-SKY-CONTRACT.md`).

### 6.3 The take machinery

- The adapter contract admits `transport?: {takes: WorldTrackTake[]}` with
  the law: "Takes belong to the Transport stratum of the time spine. An
  adapter may expose them, but a take is never a clock and never a Timeline
  track."
- The Expressions adapter exposes the presented scene's property tracks as
  takes (the record-local-chosen-properties family, crosswalk "Session
  launch and recorded Arrangement occurrences").
- The QL audio adapter exposes `QlPerformanceTake {id, target, operation:
  'record' | 'replace' | 'append'}`; realtime recording belongs to #281's
  packets.
- The full record law is #281 §2.5: "Record the full relevant performance:
  note lifetimes and expression, tuning/source revisions,
  modulation/automation, body/form/force sequence, context changes, seeds,
  transport mapping and state needed for continuation. Persist through
  existing Expression/Scene/Edition and native owner services, not a second
  project or score store… Checkpoint semantics must state which physical
  trajectories replay exactly and which resume from a documented numerical
  state/tolerance; never claim an exact GPU rewind from a visual screenshot."

### 6.4 Constructing a new track type: the builder's recipe

Everything a builder needs is in the pattern the adapters share.
The recipe, extracted:

1. **Name the family reading.** Define `T` — the family's own shape, read
   from its owner (never a copy: the adapter projects, nothing is stored).
2. **Choose columns and their units.** Columns are time blocks in the
   family's own units (civil days for temporal material; scenes for the
   Expressions family; composition passes for the QL family; epochs for the
   atlas). Decide the undated/honest-absence behaviour up front.
3. **Define tracks (lanes) with a discriminating `kind`.** The kind is the
   family's namespace (`ql-audio/resonator`,
   `ql-physics/visual-only`, `day`, `conversation`, `cron`); the
   presentation groups lanes by kind (`groupOfTrackKind` — new kinds need
   their group named there, or they fall into "Central · civil field",
   which a new family should not allow silently).
4. **Place clips with spans in the family's declared unit.** Carry the clip's
   standing verbatim in `state` and its role/law in `label` where
   sonic/physical. Refuse malformed input by naming the law (empty spans,
   wrong rates, miscast roles).
5. **If the material sounds or moves physically, classify the role in the
   type** (`QlSonicRole` + `QL_ROLE_LAWS`) and admit only the roles whose
   operative product the track honestly hosts; refuse the analyser to both
   tracks (metering's concern).
6. **Map across strata only through `QL_CLOCK_MAPPINGS`.** Same-family
   conversions may be declared rates; cross-stratum joints are measured
   anchors; M3 state moves by event, never interpolation. A conversion
   without a row is a bug, not an extension: add a declared row or refuse.
   (Open: the table lives in the QL family's own module —
   `qlSampleClock.ts:64-93`, `Object.freeze`d — so where a non-QL family
   declares its rows, in its own module through the same shape or by
   extending the QL table, is genuinely undecided; the one-ontology claim
   and the QL-owned table are not yet reconciled. Open for the family
   owners; no answer invented here.)
7. **Expose takes as transport material only**, named honestly.
8. **Register through a door.** Lane door (registration is the disclosure)
   to land; family door (manifest `projections[]` declared by the family's
   owner) to be admitted. The manifest is "authored by the family's native
   owner" (§3) — the shell's door is neutral, the keys are held by owners.
9. **Declare the family's `time` bindings** (§3 family manifest:
   "which time strata it consumes and which temporal material it
   contributes") and **`telemetry`** ("the observables it exposes as
   modulation sources") — time in, time out, observables out; one manifest,
   four surfaces (§3: "A family needing a fifth place is a design smell").

## 7. The time spine and the sample clock

*From WORLD-SHELL-DESIGN §15.6–§15.7. The time law as people meet it is the manual's §16.8.*

1. **Chronos** — qualitative/cosmic time: "kerykeion sky positions,
   the M3 clock and inscription phases, Aion epochs, the planetary field.
   Provided by the QL family; exposed by the spine as read-only time
   functions any family may bind." The spine "holds the binding surface and
   no values; until a family binds, the stratum honestly reports no
   functions."
2. **Civil time** — "the day/now closure law, owned by Central
   (`civil-time-policy.json`)… The spine only READS a situated civil-field
   reading supplied by its caller (the kernel's temporal read). It never
   reads the wall clock to tell civil time, and no shell timer becomes a
   clock." The poller: `useWorldTemporalReading.ts` — one
   `temporal_events_read` per 90 s (K1-measured owner cost), window = the
   last seven civil days through tomorrow bounded at UTC midnights (keeping
   the kernel's 2 s answer cache warm; measured "~10 s cold, ~13 ms warm");
   **Now is derived from the reading's own newest civil instant**, never the
   wall clock — the wall clock only bounds the query window.
3. **Cron** — "families declare cadences as parameters; firings are
   real executions, and EVERY firing lands as a Timeline clip — a cron run
   is temporal material like anything else… The spine fires only what was
   declared, records only what actually fired, and fabricates no history"
   (`fireCadence` refuses undeclared ids; `cronClips()` maps firings to
   clips on the `cron` track). Example: the Timeline projection's own
   civil-field read is a declared, armed, fired cadence
   (`READ_CADENCE_ID 'central-temporal-read'`, `declaredBy: 'timeline
   projection (K1-measured owner cost: the temporal read walks every
   stream)'`).
4. **Transport** — "the Timeline projection's playhead over
   performable material. It moves over clips and drives nothing else. A
   transport take is material, never a clock."
5. **Occasion** — retained time (the basis/admission split of §6.2; the
   K8 sky contract's behaviour: "Standing in 1913's sky without lying
   about now is what makes historical exploration honest").

The Now / Occasion / Transport controls "are the user-facing face of
strata 2, 5 and 4; chronos and cron are the deeper platform strata".
Time binds back to modulation: "Time as a modulation
source closes the loop with §1.1: an LFO was always time — this world's LFOs
are transits, day phases, cron cadences and clock phases, addressable from
any family because the strata are locked at the top."

**The two-clock doctrine** (lane-6 SCOPE, quoted in MAP.md Decisions):
"civil time keeps closure law; one work-time core (sample clock included);
one typed bridge." Lane-2's `techne:time-axis/v1` is the bridge's content
spec. And the #281 packet law: "Transport state never silently overwrites
civil Day or geometric clock state"
(`M-PRIME-PHYSICAL-MUSIC-WORK-PACKETS.md` §9-C). "Families bind, never fork
clocks."

### 7.1 The sample clock: the seven-row mapping table

`src/timeline/qlSampleClock.ts` encodes QL-MEF #281 §2.5 as executable law.
The commissioned law, quoted in the module header: "Use a coherent
sample-time domain for the active audio device/offline renderer and explicit
mappings to transport, physical/control updates, display frames, M1 phase,
M3 inscription/aperture state, astronomical occurrence and civil Day/NOW."

The seven named strata (`QlStratumKey`): `samples` · `seconds` ·
`transport` · `m1-phase` · `m3-inscription` · `sky-occurrence` ·
`civil-day`.

**The seven declared rows** (`QL_CLOCK_MAPPINGS` — the ontology's whole
cross-stratum grammar; the table is "exposed so a face can render it and a
reviewer can audit every conversion the stratum will ever perform"):

| # | From → To | Via | Carrier | Law (verbatim, compressed) |
|---|---|---|---|---|
| 1 | samples → seconds | declared-rate | `sampleRate 48000 Hz (QL scene_field.rs default_field)` | exact device-rate division; no resampling, no drift term |
| 2 | seconds → samples | declared-rate | same 48000 | floor to the integer sample boundary (the audio binding schedules on integer device samples — `native-audio.mjs #newOriginTime`) |
| 3 | samples → m1-phase | declared-rate | **a declared tick cadence** (`controller.ts CADENCES`: world 1 tick/s, user 12 ticks/s; "neither is fixed by the M1 contract") | samples/48000 × declared ticks-per-second; the cadence's own source string rides the result |
| 4 | samples → transport | declared-rate | a declared transport rate **supplied by the caller** | no implicit tempo: the Timeline's performable time base must be declared before samples map onto it |
| 5 | samples → civil-day | **anchor** | a **measured anchor** (`samples_elapsed` + the owner read's civil instant, from ONE acknowledgement) | the only sample↔civil joint is a measured anchor; instants map to days by the spine's own UTC-day law |
| 6 | civil-day → sky-occurrence | anchor | the sky epoch of the anchor (or "now") | a sky occasion retains its snapshot basis and separately qualifies current admission (the K8 behaviour) |
| 7 | m3-inscription → m1-phase | anchor | `ring_codon_advance` determinant events (M3 form → Vimarśā pose) | inscription state advances **per owner EVENT, not per rate** — no silent interpolation between events |

The three laws the table executes:

- **No silent conversion**: `mappingFor` throws
  `no declared mapping X → Y in QL_CLOCK_MAPPINGS; no silent conversion` —
  "that IS the no-silent-conversion law, made executable."
- **Anchors are measured, not computed**: "The only joint between the
  sample stratum and civil time is an anchor read off an owner receipt…
  Declared RATES carry conversions inside a stratum family; anchors carry
  conversions across strata" (`QlClockAnchor`: exact u64 `samples_elapsed`,
  `atUnixMs`, optional m1/m3/sky state, and a `source` string naming what
  measured it).
- **Declared cadences only**: `QL_TICK_CADENCES` = world (1 Hz, "M3/M4′
  world clock") and user (12 Hz, "PPS user-facing tick"); a mapping riding
  an undeclared cadence refuses because "the M1 contract fixes neither
  rate."

**Binding into the spine is read-only** (`bindToSpine`): the stratum
contributes one chronos function — `ql-work-clock`, reading
`samples_elapsed N @ 48000 Hz (generation G, standing S)` — and when no
owner stands it returns the spine's own honesty string: "no functions — the
QL field/PCM owner is not standing." "The spine binds READ-ONLY (§15.1
discipline): this stratum contributes one chronos function — the owner's
work-time cursor — and transport takes are material, never a clock."

Policy constants are ports, not choices: sample rate 48000 (QL
`scene_field.rs` `default_field` via `controller.ts` `SCENE_SAMPLE_RATE`),
block 8192, lead/lookahead 0.5 s (`EMBEDDED_NATIVE_PLAYBACK`).

## 8. The musical owner's faces

*From WORLD-SHELL-DESIGN §18 and §18.1. The manual's §21–§22 state what a person meets; the commissioned law is QL-MEF #281.*

- **D13** (`M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md:32`, wayfinder §0.2, in
  full): "**M1 is the oscillator source; M2 pitch structures are
  tuning/modulation targets over that source.** M1's Prakāśa/Spanda carrier
  and M2-1′'s MEF/Vimarśā reading are both essential. Vimarśā writes the
  shared `audio_octet[8]` and `nodal_quartet[4]`; this does not make M2 an
  independent oscillator source, and it does not permit M1′ to bypass the
  source-defined reading."
- **Music is a first-class working mode, not another app** (wayfinder §3.1):
  "an **integrated musical working mode, not another app** (#281 §3.1),
  reusing the shell's own machinery."
- **Common cause** (wayfinder §0 failure table): "Sound and animation
  merely share a timestamp" is the failure; the replacement: "Tests
  demonstrate the intended common physical cause." "Sound and visible
  form are projections of one evolving state (the common-cause / cymatics
  law) — never effects sharing a timestamp."

**M1 — the oscillator source, as an instrument device.** "The field/PCM
owner docks as an **instrument device** in the rack (the played torus/field
as a device face with the proven aperture); the stage stays the instrument's
visible body." The face (`src/inhabitants/qlInstrumentDevice.tsx` +
`src/inhabitants/ql/qlInstrumentReading.ts`) binds the owner's real states,
never invented ones:

- standing: `manual | opening | following | held | unavailable`
  (controller.ts `NativeStatus`, verbatim);
- the identity tuple every native field frame carries (native-audio.mjs
  `IDENTITY`): `event_ref, subject_ref, registry_revision, geometry_ref,
  material_ref, model_ref`;
- exact u64 cursors (`acknowledged` and `presented`: `generation` +
  `samples_elapsed`);
- the audio receipt, schema `ql.native-audio-receipt/v1`, **rate-locked at
  48000 — "a 44100 receipt refuses"** (no implicit resampling);
- the launch contract rendered verbatim when no owner stands
  (`QL_LAUNCH_CONTRACT`): owner `ql-field-host (+ ql-field-worker)`;
  launcher "the kernel's native-expression owner (… compose → spawn)";
  bindings both-or-neither.

**M2 — modulation sources with `generates: false` in the type**
(`src/inhabitants/ql/qlModulationSources.ts`): "the first **native
modulation sources** of §1.1: the owner's audio/nodal readings
(audio_octet, nodal_quartet) as observables addressing device parameters
within declared scope; compiled relation plans before realtime execution;
never a second oscillator (D13)." The type-level form of D13:

```ts
/** D13: this observes the M1-source's reading; it generates nothing. */
readonly generates: false
```

"a module that claimed to generate from a source would have to assert a
type that does not exist. The only operation a source exposes is a read."
The twelve declared observables: `ql:m2/audio-octet/0..7` (Hz, from the
shared `m2.vimarsha.reading.audio_octet_hz`) and `ql:m2/nodal-quartet/0..3`
(mode-index voices with m/n + frequency_hz). Routes (`sourceId → typed §1.1
parameter address`, amount/polarity, transfer linear|log, scope instrument
| body | context | presentation) **compile to an immutable plan BEFORE
realtime execution**; compilation "refuses unknown source ids, targets
outside the declared scope, target addresses without a write path,
non-finite amounts, duplicate source→target pairs" (plus log transfers with
non-positive amounts). `evaluate()` is pure and "every effect names its
source — nothing moves without a visible cause" (§1.1's honesty law). No
route writes: "a route never writes — it proposes an effective value the
owning device applies through its own custody/receipt law." Declared scope:
`quaternal-logic` family addresses only; widenings "are the family
owner's later declaration".

**M3 — form and score as clip material.** "**score material in tracks and
clips** (the Timeline projection's grammar): articulation and form
sequences as clip material; body/form geometry stays the engine's visual
body — one state through the shared owner. The port ledger's take machinery
(record/replace/append) is the seed for performance recording. The
form→body preparation pipeline (versioned prepared bodies, off-thread
eigenstructure, crossfade/reinit policy) is #281's M3 packet". The #281
law beneath it (wayfinder §2.3): "The M3/physical packet must implement the defined conversion from form to physical
body. Resolve topology/connectivity, geometry and scale, material, boundary
conditions, excitation locations and observation locations. A point cloud
or glyph identifier alone is not a complete membrane/plate/string/cavity
model."

**M4 — the body, unchanged law.** "the Expressions application is the body;
a declared world context, a personal Nara context and an explicitly shared
context are distinct admissible occasions over the same source definitions
(#281 §1.2) — in shell terms, per-context state over the encounter spine"
(L5 dual-reading lock §11a).

**The realtime boundary** (wayfinder §2.5, law for everything above):
"Presentation stutter cannot stall the audio callback; external sky or
agent latency cannot become note latency. The realtime boundary excludes
allocation, blocking locks, graph/network access and UI work… Never query
the whole Bimba graph from the audio callback" (§2.2). When the owner is
not installed, the kernel's compose refuses with the exact repair named;
"the refusal is itself the gate datum."

## 9. The smallest seam set

*From WORLD-SHELL-DESIGN §10.*

The smallest set of architectural seams between today's code and this
design:

1. **Projection pane kinds** — the pane engine's body kinds carry the
   projection kinds (`projection.earth`, `projection.timeline`,
   `projection.constellation`, `projection.expressions`); the engine composes
   the main area per mode (`modeLayouts`). Hidden retention carries over.
2. **Projection module boundary** — each projection is a module with
   mount/unmount + encounter subscription (the Atlas's vanilla-TS
   controller mounts the way the retained app's controller does; no React
   rewrite of the Atlas).
3. **Encounter bridge** — encounter.subject/occasion/trail drive each
   projection's state machine; Atlas World·Focus·Manifestation·Thread·Deep
   ↔ spine mapping (§5). No second selection store.
4. **Inhabitant manifest** — generalise the registries (panels slots,
   FIELD_FAMILIES, browser categories, detached kinds) into one declared
   inhabitant manifest admitted through `inhabitants.rs`; document and
   conversation devices become face kinds with bodies.
5. **Timeline generalisation** — Session/Arrangement present any World
   track set (§6); the set model (`useSet.ts`, `document.ts`) gains World
   track adapters (day tracks, run tracks, conversation clips).
6. **Occurrence binding contract** — the generalised `Occurrence`
   (subject_ref + place + time + image + basis) as the Earth projection's
   data seam; QL sky binds as the M2 layer; no separate map subsystem.
7. **Time spine** — Now/Occasion/Transport controls over the two-clock
   bridge; Atlas non-linear scale adopted for deep time.
8. **Pop-out** — device pop-out rides the pane engine's existing
   detach/redock; no new windowing mechanism.

## 10. Kernel rules for builders

*From WORLD-SHELL-DESIGN §11 and §11.1.*

- No parallel World models, event stores, selection systems, graph stores,
  Factory/Expression state stores, agent registries, or filesystem models.
- No claims beyond native owners: Factory and Central entry points stay
  reserved for their native owners; the source-by-source licence gate
  governs all reference adoption (the Atlas is owned source — acquisition B; its NASA
  tiles and Wikimedia images are external *data* with their own terms,
  recorded, not code adoption).
- **Derive first.** Read the map, the manual and the rulings. Call a thing Open
  only after the sources are exhausted (LAW:21).
- **The map wins.** New ratios and tables enter only by re-authoring the map.
  Renderers hold no local codon, 72 or tarot tables (LAW:19,61-64;
  INTEGRATED-1-2-3:654-655).
- **Bind, never recompute.** "Without renderer-local recomputation or fabricated
  availability" (LOCK:722). One profile tick, no widget-local clock.
- **Keep primed and unprimed apart; qualify every M4.** Epii ≠ Palace ≠ Aletheia
  (LOCK:400-406,510-517).
- **Never pair sixfolds, or the Logos cycle and modes, by count**
  (LOCK:55-85,766).
- **A coordinate existing is not it being ready.** Missing legs degrade visibly
  (INTEGRATED-1-2-3:424-432).
- **Protected stays protected.** Lived pattern → canon only through propose →
  review → accept → apply, dry-run by default (INTEGRATED-4-5-0:639-660).

## Sources and paths

Carried from origin/main `8873b09`: `desktop/cradle/docs/world-shell/WORLD-SHELL-DESIGN.md` and `desktop/cradle/docs/world-shell/wayfinder/DEVICE-SEMANTICS-LOCK.md`, and the gap list of `desktop/cradle/docs/world-shell/wayfinder/DLW-PANES-ONTOLOGY.md` at `948b53b0e^`. Paths under `src/` are `packages/live-shell/ui/src/` unless they name the cradle; cradle paths are under `desktop/cradle/src/`. File and line cites are the sources' own, as of the dates they state; a cite of `WORLD-SHELL-DESIGN.md` or `DEVICE-SEMANTICS-LOCK.md` inside a passage names the section carried here. In §10 the cites LAW, LOCK and INTEGRATED-… are the retired DLW-VISION's keys for its QL-MEF sources; LOCK there is not the device-semantics lock. What was trimmed, and what was left out as superseded, is listed in the fold's change record.
