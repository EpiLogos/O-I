# DLW panes ontology — the pane-instrument kind system

**Standing:** design lane return, 2026-10-11. Lane `zcode:panes-ontology-o1`,
dispatched by `zcode:world-shell-orchestrator`. This document formalises the
owner's realisation — "the pane system needs to be foundational, and each mode
has its base plugin/device/instrument… every possible pane instrument, from
technē instrument to browser and terminal to expression surface to earth axis
to graph… then just like Ableton it becomes trivial to have default sets for
these views and of course users save their own, per the workspace" — and the
reverb insight: "the Archetypal-Earth components… a beautiful coloured graph
surface… but we already in the cradle have the Obsidian RE based graph — these
can BOTH be graph types, just like Ableton has a different type of reverb."

It extends `WORLD-SHELL-DESIGN.md` §5 (the five inhabitant kinds), never
contradicts it; it composes with `DLW-PLAN.md` §2 (the Ableton→DLW mapping),
§5 (the expressions/track ontology) and `WIDGET-GUIDE.md` (the shared widget
vocabulary). Every code claim cites file:line (seat
`/Users/admin/Central/worktrees/env-1/o-i`, branch `agent/o-i-20261007-1639`,
the L1–L9 landed tree); every mockup claim cites the mockup file and its
section/line. TypeScript in this document is **sketch**, written here, not in
`src/`.

---

## 0. The one-paragraph statement

Every pane in the shell hosts an **instrument**: a pane-instrument is the
generating body that produces and maintains a pane's surface, and every pane
body is an instance of exactly one instrument **type** (Earth, Timeline,
Graph, Expression, Document, Sessions, Thread, Terminal, …). An instrument
type is a declared contract — mount/unmount, encounter subscription, retention
class, its device set, its browser categories, its render surface — and a type
may have several **implementations** (the atlas coloured graph and the
Obsidian-RE knowledge graph are both Graph), which coexist as selectable
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

## 1. The kind system, made precise

The owner asked: *"we got this distinction properly down btw?"* This section
is the answer. Four kinds, one superordinate; each defined, each distinguished
from its neighbours, each anchored in landed code or in the mockups.

### 1.1 Pane-instrument — the superordinate kind

**Definition.** A pane-instrument is the generating body a pane hosts: the
thing that produces and maintains the pane's surface. A **pane** (the engine's
tab group leaf — `desktop/cradle/src/surface/types.ts:122-140` `TabGroupPane`,
`types.ts:142-148` `SplitPane`) is geometry + focus + a tab strip; it is *not*
content. What fills it is an **instrument instance**: one running body of one
instrument type, bound to one encounter slice. Two panes can hold two
instrument instances of two types over the same subject — the L1 seam proved
exactly this ("two panes can hold two projections of the same subject side by
side"; `types.ts:22-35` header; instance identity is kind + subject,
`types.ts:111-118` `binding.projection`).

**Every pane body is an instrument instance of an instrument type.** The four
projection kinds landed as pane body kinds (`types.ts:36-45`
`PROJECTION_PANE_KINDS`: `projection.earth` · `projection.timeline` ·
`projection.constellation` · `projection.expressions`) are the first four
instrument types given engine-level names. The ontology's move is to
generalise: the engine's *body kind* **is** the instrument type id, for every
body — documents, terminals, threads, sessions, the knowledge graph — not only
the four projections. Today those other bodies ride ad-hoc binding-kind
strings (`SurfaceBinding.kind`, `types.ts:69`; detached admitted kinds
"include `source, knowledge, file, encounter, browser, terminal, flow`",
`WORLD-SHELL-DESIGN.md:454-456`); the catalogue in §2 names them as types, and
gap G1 (§5) proposes unifying the spellings.

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
  family?: string;                  // the admitting family, when not core (§16 exposure law)

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

### 1.2 Device — the parameter-bearing kind

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
   and **Conversation** (§2 T8, T13) have their canonical *instances* as rack
   faces, and any face instance may be docked, expanded (pane), or popped out
   (window) — three presentations of the same instance, one body, no duplicate
   (`sdk/define.ts:155-157`; `WORLD-SHELL-DESIGN.md:494-496` "Pop-out is the
   one gated gap — supplied by the pane engine's detach").
3. **Parameterisation** — devices address an instrument's behaviour through
   §14 parameter addresses and modulation (`WORLD-SHELL-DESIGN.md:772-799`;
   every modulated parameter shows its modulator). The atlas's graph tools
   (depth, dust, ties, spread, gravity, sky) are exactly this: device-shaped
   controls over the graph instrument's tool state
   (`projections/atlas/src/graph/tools.ts:7-17,19-29`).

The distinctions the owner drew hold: the **technē instrument** (the six of §2.5 in the lock) is a
pane-instrument (it fills the focused pane and carries its own native controls
— `WORLD-SHELL-DESIGN.md:143-148` Rev 3 "the instrument is the instrument");
its *controls* are devices on the detail row (the Technē device column,
`world-shell-mockup.html:1646-1649`). A device is never "inside" a pane as its
body; where a device body needs pane space it *becomes* an instrument instance
by docking into one (relation 2).

### 1.3 Plugin — the delivery kind

**Definition.** A plugin is a family's or owner's admitted manifest package:
instruments + devices + browser categories + faces, delivered through the one
neutral door. Two landed spellings, one door:

- the **family manifest** (`manifest.ts:85-98` `InhabitantManifest`: browser,
  faces, params, projections, inspectors, time, telemetry — the §16 four
  surfaces, `manifest.ts:13-16`), admitted at the neutral registry
  (`manifest.ts:111-190`; re-admission, collisions and undeclared-face
  parameters refuse, `manifest.ts:123-153`);
- the **SDK declaration** (`sdk/define.ts:179-212` `FamilyDeclaration`: owner,
  product carving, browser ids, devices, paramsGrammar, transport bindings,
  projections, inspectors, time, telemetry, writers + writerAuthority) —
  validate-first admission (`define.ts:527-551`) and additive extensions
  (`define.ts:559-603`).

The §5.5 **mode plugin** ("a declared bundle — `{browser category entries,
device faces, projection bindings, document kinds, optional center panel}`",
`WORLD-SHELL-DESIGN.md:519-526`) is the plugin kind scoped to a mode: the SDK's
mode scoping realises it (`define.ts:143-149` `modes`/`formats` per device;
`define.ts:318-328` `facesForMode`). The **uncarved-block law** is the
plugin/instrument boundary: "the core knows only neutral, product-less
concepts — frame, projections, encounter spine, rack and aperture, parameters,
modulation routing, the time spine, and the admission door"
(`WORLD-SHELL-DESIGN.md:758-762`); the working test is the seventh product
admitting with no core change (`WORLD-SHELL-DESIGN.md:764-771`; executed at L2,
`DLW-PLAN.md:324-328`). In ontology terms: **the core knows instrument types
and the door; plugins deliver types' implementations, devices, and
categories.** Atlas-earth is the worked example — a family (not one of the six
products) admitting its own views and faces (`atlasFamilyManifest.ts:9-47`).

### 1.4 Implementation vs type — the reverb insight, formalised

The owner's reverb point, made structural. Ableton's device chooser offers
several reverbs: one *effect type*, several *implementations*, each instance
one choice. The shell's graph already lives this:

```
instrument TYPE        implementations (coexisting, selectable)      instances (panes)
──────────────         ──────────────────────────────────────        ─────────────────
Graph              →   atlas constellation (d3-force, coloured)   →  pane A
                   →   Obsidian-RE knowledge graph (canvas+minimap)→ pane B
Earth              →   atlas globe port (three.js, SwiftShader)   →  pane
Timeline           →   world presentation (L4) / aion / live arr. →  panes
```

**What makes implementations interchangeable is the type contract** (§1.1):
both graphs satisfy *the same* obligations — nodes and links over an
encounter-bound reading, navigation (pan/zoom/focus), selection that
propagates as an encounter transition, honest ghosts for unresolved material,
its device set, its browser categories, retention class. §3 states the Graph
contract and shows both implementations meeting it, line by line.

The **admission grammar follows the type ladder**:

```
type                  (the pane body kind — engine-known)
  └─ implementation   (admitted per type through the door; ONE default, N alternates)
       └─ instance    (kind + subject binding — types.ts:111-118)
```

Landed today: the projection door admits **one module per kind** and refuses a
second ("kinds are not silently replaced", `projectionModules.ts:157-169`) —
correct as an admission discipline, but it collapses implementation into kind.
The ontology requires the door to mature one level: kind → *implementation
registry* (gap G2, §5), where a family admits an implementation under a type,
one implementation is the default (per mode, per set), and switching
implementations is a per-instance choice — Ableton's device chooser, not a
fork.

**Base instrument per mode.** Each mode's default pane-instrument — what a new
pane opens with in that mode — is grammar data. The mockup declares it
(`world-shell-mockup.html:1602` `newPaneTab()`: Base → Things document;
Factory → Terminal; Technē → the Project lens as form; Expressions → Graph as form;
Live → Session grid) and the per-mode Session|Arrangement presentations
(`world-shell-mockup.html:1707` `VIEWMAP`; typed in `modeGrammar.ts:122-124`
`session`/`arrangement`). Landed, the mode grammar holds the presentations and
categories but **no base-instrument declaration yet** — gap G6 (§5). The
landed per-mode layout *retention* exists (`workspace/store.ts:125-141`
`switchWorkspaceMode` saves the leaving mode's tree into `modeLayouts`,
`store.ts:42`), which is the mechanism a declared default set initialises.

### 1.5 Set — the named arrangement

**Definition.** A set is a named arrangement of panes × instruments ×
(devices, contexts): *which* panes (the split tree), *which* instrument
instances fill them (bindings + subjects + implementations), *which* devices
stand on the focused chains (enablement, fold state), *which* contexts the
panes hold (follow/pin). Two registers:

- **Default set (per mode).** Declared by the mode grammar: the mode's browser
  categories, its Session/Arrangement presentations, its Clip|Device pair
  (`modeGrammar.ts:115-142` `SurfModeGrammar`) — with the mockup supplying the
  seed arrangement (Base: Day + Flow/Things panes; Factory: Sessions + Thread;
  Expressions: the field; Technē: the World at system scale; `world-shell-mockup.html:746-750`
  `S.modes`). The mockup's own header states the rule both registers obey:
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
  reopened under a moved encounter re-binds instead of lying. Landed
  mechanism: `modeLayouts` per workspace book (`store.ts:42`,
  `CradleFrame.tsx:427-428` reconciles surfaces across all layouts). Named,
  savable user sets are the remaining work (gap G4, §5).

### 1.6 The five inhabitant kinds composed with the superordinate kind

`WORLD-SHELL-DESIGN.md:496-526` classifies the rack's residents five ways.
The pane-instrument kind is superordinate and perpendicular, not competing —
§5.5 classifies by *rack role and delivery*; the pane-instrument kind
classifies by *pane-body generation*. The composition:

| §5.5 inhabitant kind | Pane-instrument reading |
|---|---|
| 1. Parameter devices | Never pane bodies (§1.2 relation 1/3). Exposed *by* instruments; live on chains. |
| 2. Document devices | The **Document** instrument type's instances (T8): canonical face on the rack, dock/expand/pop-out into pane/window (`worldShellFamilies.ts:56-82`). |
| 3. Conversation devices | The **Conversation** instrument type's instances (T13): "the surface is an `encounter` binding already hosted in panes and detachable windows" (`WORLD-SHELL-DESIGN.md:511-515`). |
| 4. Instrument devices | The rack-face *projection* of instrument types: "the Techne instruments over the encounter… Registered faces, not new applications" (`WORLD-SHELL-DESIGN.md:516-518`). The type fills the pane; its face is the detail-row device (Technē device column, `world-shell-mockup.html:1646-1649`). |
| 5. Mode plugins | The delivery kind (§1.3): bundles that admit instrument types' implementations, devices, and browser categories per mode (`define.ts:143-149`, `define.ts:318-328`). |

No contradiction: a mode plugin *delivers* an instrument; an instrument *may
expose* devices; a document/conversation device *is* an instrument instance
with a rack face. One lattice, three vocabularies for three questions
(delivery? parameter? body?).

### 1.7 What each kind is NOT (the one-table distinction)

| | Pane-instrument | Device | Plugin | Set |
|---|---|---|---|---|
| Fills a pane's body | **yes** (it *is* the body) | never (docks on the rack; may *become* a pane by docking, §1.2-2) | never (delivers things that do) | names an arrangement *of* panes |
| Bears parameters | may expose them | **yes** — its whole point (`ParamAddress`, `manifest.ts:38-47`) | declares them (`params` grammar) | retains their fold/enable state |
| Is admitted | as a type's implementation, through the door | as a face, through the door (`manifest.ts:115-155`) | **is** the admission unit (`InhabitantManifest`) | not admitted — saved |
| Has implementations | **yes** — the reverb insight (§1.4) | per-family faces; hot-swap within compatibility (DLW-PLAN §2 row "Hot-swap") | — | — |
| Is named/saved | — | presets (DLW-PLAN §2 "Preset") | — | **yes** — default + user sets (§1.5) |

---

## 2. The instrument-type catalogue

Every pane content in both mockups and the shell, as instrument types.
Method: the world mockup's aperture table `APS` + lens table `INST`
(`world-shell-mockup.html:803-824`), its Rev-5 additions (`docgrid`,
`musicsess`, `musicarr` — `world-shell-mockup.html:1701-1703,1707`), the
agent mockup's centre views and dock (`agent-shell-mockup.html:547,824`), and
the landed body kinds. Sixteen types. Each entry: contract sketch · landed
implementations (files) · mockup evidence · device set · standing.

**T1. Earth / World** (`projection.earth`; Technē "World / Places").
Contract: bodies, places, relations between bodies; scales
system·body·region·palace; encounter following (aim/fly on subject change).
Implementations: the atlas port — `projections/atlas/` (82 modules,
`DLW-PLAN.md:230-232`): `mount.ts:67-130` `mountAtlas`, `src/globe/engine`,
`src/app/controller`, provider registry `provider/corpusProvider.ts`; admitted
under kind `projection.earth` through the module door (`mount.ts:6-9` names
the §10.2 obligation). Mockup: `world` aperture, scales and relations legend
(`world-shell-mockup.html:811`, slot scale buttons `:1517-1519`, planet
building `WORLD-SHELL-DESIGN.md:169-182`); `WORLD-SHELL-DESIGN.md:355-371`
(§3.1). Devices: planet building (Body·Landmass·Climate·Sky·Locations·
Relations), the atlas faces (`atlasFamilyManifest.ts:25-31`: globe-engine,
graph-tools, mode-switch, time-control), QL sky as the dated layer
(`atlasFamilyManifest.ts:37-40`; `provider/skyProvider.ts`). Standing:
specified + implementation ported (admission as a shell pane still to prove —
`modeGrammar.ts:426-427` keeps the Bodies category `waiting`: "the atlas port
refused the merge" is the recorded state).

**T2. Timeline** (`projection.timeline`; Technē "Relation Field"; Base
"today on one ruler"; Live Arrangement). Contract: tracks, clips, ruler,
lenses (chronology·causal·recurrence·concurrency), epistemic standing chips;
Session and Arrangement are two presentations of one type
(`WORLD-SHELL-DESIGN.md:399-408`). Implementations: `projections/
worldTimelinePresentation.tsx` + `useWorldTemporalReading.ts` (the L4 World
cut; `DLW-PLAN.md:233-235`); seven World track adapters behind the neutral
shape (`src/timeline/worldTrackAdapter.ts…`, table at `DLW-PLAN.md:1823-1831`);
the atlas `aionTimeline.ts` epoch adapter; native session/arrangement content
adapters (`NativeSessionContent`, `NativeSourceArrangement`,
`WORLD-SHELL-DESIGN.md:394-396`). Mockup: `timeline` aperture with lens
segment (`world-shell-mockup.html:812`, `:1523`), `musicarr` (`:1704`),
`docgrid` Day·Session (`:1701`, `:1710-1711`). Devices: time-spine controls
(Now/Occasion/Transport — `WORLD-SHELL-DESIGN.md:577-597`; §5.4
`DLW-PLAN.md:1943-1997`), take machinery (DLW-PLAN §5.7). Standing:
specification landed (adapters + spine); pane-kind hosting landed; per-mode
Session/Arrangement compositions are the mode chapters' work.

**T3. Graph / Constellation** (`projection.constellation`; Technē
"Project / Wiki / Graph" field view). **Two implementations** — the
commission's case study; see §3 for the full contract and both
implementations. Mockup: `field` aperture with list·tree·graph·form views
(`world-shell-mockup.html:814`, `:1524`), the browser's compact bounded graph
(`:1494-1497`), the agent dock's `graph` tile (`agent-shell-mockup.html:824-851`).
Standing: both implementations exist; chooser + type contract are gaps G2/G3.

**T4. Expression** (`projection.expressions`; the 3:3 living field). Contract:
the retained M4 body mounted once, deep cut changes disclosure; stage-only in
the pane, tools in the Studio (`WORLD-SHELL-DESIGN.md:423-430,53-56`).
Implementations: the retained app via `PointCloudHost` iframe
(`DLW-PLAN.md:242-244`); `panels/expressions.tsx:43-46` deep cut; the hosted
engine checkpoint (`types.ts:97-104`). Mockup: `expression` aperture
(`world-shell-mockup.html:817`), Rev-5 stage-only body (`:1712`), Scene|Studio
detail pair (`:1642`). Devices: the Studio — the engine's own controls, the
wave-2 families (physics, medium, resonance, contacts, ink, depth, relational,
pointer, focus, morph, colour; entity and scene families —
`INSTRUMENTATION-CONTRACT.md:456-485`). Standing: largest port in flight (213
actions; `INSTRUMENTATION-CONTRACT.md:487-509`).

**T5. Canvas** (Technē "Canvas / Constellation"). Contract: arrange,
frame, relate artefacts; drag is presentation; drawn relations are proposals
until promoted (`WORLD-SHELL-DESIGN.md:265-267`). Implementations: **none
landed** (lane-1 targets A1–B4 all pending, `FUNCTIONAL-CROSSWALK.md:20-33`);
the minimap geometry already serves both graph and canvas
(`navigationMinimapGeometry.ts:14-15` "The affine origin differs between the
native graph… and Canvas"). Mockup: `canvas` aperture (`world-shell-mockup.html:815`),
`cvEdges` overlay (`:1612-1613`). Devices: frame/relation presentation
controls — unspecified beyond the mockup. Standing: OPEN (design-specified,
unbuilt).

**T6. Scenes / Journey** (Technē "Journey / Scenes"). Contract: walks as
ordered scene rows; ▶ walks, ● records (`WORLD-SHELL-DESIGN.md:257-260`).
Implementations: none as a pane (scene rows live inside the retained app and
the mockup); lane-3 E-targets and lane-5 T1–T13 pending. Mockup: `scenes`
aperture (`world-shell-mockup.html:813`), walk stepping (`:1274-1275` stepWalk,
`launchScene`). Devices: walk pace/stop/presence (transport slots, Technē
column `modeGrammar.ts:442-471`). Standing: OPEN.

**T7. Palace** (Technē "Palace / Integral Whole"). Contract: enter a
location; rooms composing native refs; guided path; portals; private room
fogs (`WORLD-SHELL-DESIGN.md:247-249`). Implementations: none landed
(lane-5 T14–T24 pending). Mockup: `palace` aperture + `palaceSVG`
(`world-shell-mockup.html:816`, `viewBody0` `:1264`), palace scale on the
World instrument (`:1517`). Standing: OPEN.

**T8. Document** (Base's four forms + files/sources). Contract: a hosted page
or native file over its CAS identity — form, file, revision, bindings,
highlights, notes, packet; the save router's named outcomes. Implementations:
the document hosting path (`document/frame.ts` sandboxed iframe, bounded
postMessage, save router `saved|unchanged|stale|conflict|refused`,
`WORLD-SHELL-DESIGN.md:501-510`); `DocumentDayDieFace`, `DocumentFlowFace`
(`worldShellFamilies.ts:56-82`); source surfaces in the cradle
(`desktop/cradle/src/surface/SourceSurface.tsx`, `SourceHistory.tsx`);
detached kinds `source, file, flow` (`WORLD-SHELL-DESIGN.md:454-456`).
Mockup: `day/flow/thing/being` apertures (`world-shell-mockup.html:818-821`),
the four paper forms (`:1268-1269` docView; DOCS `:701-717`), Document|Devices
detail (`:1642`, clipDetail `:1660-1662`). Devices: Text · Highlight · Notes ·
Packet · Answer · form devices (Die faces · Participants · Bindings) —
`WORLD-SHELL-DESIGN.md:124-131`; packet as "exactly what the agent receives"
(`:128-131`). Standing: most satisfied — this type is where the ontology is
already the landed practice.

**T9. Sessions (session grid)** (Factory Session; Base Day·Session; Live
Session). Contract: tracks are lanes, clips are material, scenes are rows;
launch/record/trim/split. Implementations: the agent shell's session grid
(`agent/` — 28 files, `DLW-PLAN.md:236-237`); Live's grid in the mockup only.
Mockup: `sessions` aperture (`world-shell-mockup.html:822`), `docgrid`/`musicsess`
(`:1701-1703,1710-1711`), the full session grammar
(`agent-shell-mockup.html` §3.3, WIDGET-GUIDE §3.3). Devices: per-track mixer
strip (mockup §3.4); transport slots (Factory column, `modeGrammar.ts:318-347`).
Standing: agent-shell landed; Live-craft and per-mode grids open (§4.1 chapter).

> **Re-pinned 12 Oct 2026 (P0-V2 item 23).** The mockup cites still resolve to the same code: `world-shell-mockup.html:822` (`sessions`), `:1701-1703` and `:1710-1711` (`docgrid`, `musicsess`, the view body). The `agent/` cite is stale. `DLW-PLAN.md:236-237` no longer carries it (those lines now hold M5-5 text); the `agent/` (28 files) row is at `DLW-PLAN.md:296`, a 10 Oct count. Today `packages/live-shell/ui/src/agent` holds 32 files and `desktop/cradle/src/agent` holds 44; the plan does not say which tree its 28 counted. "Live's grid in the mockup only" was not re-checked here.

**T10. Thread** (Factory centre; conversation log). Contract: one session's
conversation + tool events, nested as spawned. Implementations: the agent
shell thread view (`agent-shell-mockup.html` §3.6; `renderThread` `:706`).
Mockup: `thread` aperture (`world-shell-mockup.html:823`), thread view with
needles (`agent-shell-mockup.html` §3.6). Devices: effort/autonomy overrides
live on the agent device, not here. Standing: landed in the agent shell;
pending its mode-grammar composition.

**T11. Terminal**. Contract: the selected scope's shell, live; follows the
selected run. Implementations: the cradle's terminal body kind (binding
`terminal: {cwd, command}`, `types.ts:88-92`; admitted detached kind,
`WORLD-SHELL-DESIGN.md:454-456`). Mockup: `terminal` aperture
(`world-shell-mockup.html:824`), `viewBody0` terminal body (`:1271`), dock
tile (`:1625`), agent tile (`agent-shell-mockup.html:824-851` `term`). Devices:
none — a reading surface. Standing: landed as a body kind; trivially an
instrument type under G1.

**T12. Log / task log** (the Clip reading of Factory). Contract: the selected
task's tool-run log; Fold/Steers/Open-thread affordances. Implementations: the
agent shell's clip log (`agent-shell-mockup.html:811-821` `renderClip`); the
gateway frame monitor (`renderGw` `:769-786`). Mockup: Factory Task log detail
(`world-shell-mockup.html:1663-1665`), Task log|Agent chain pair (`:1642`).
Devices: none (readings). Standing: landed in agent shell; the "one log
surface per depth" question is the gateway view's (chrome, not instrument).

**T13. Conversation (Nara)**. Contract: the situated agent's surface; canonical
CAS in AIKit, shell binds via `oi.nara-dialogue-binding/v1`; transcript is
Timeline material. Implementations: `ConversationNaraFace.tsx` +
`worldShellFamilies.ts:83-90` (`nara-conversation` face, binding declared);
encounter surfaces hosted in panes/detached windows
(`WORLD-SHELL-DESIGN.md:511-515`). Mockup: `convo` tile + Base companion
Conversation (`world-shell-mockup.html:1623`, `:1548-1553`), Anima/Epii
companions (`:1534` CTABS). Devices: the companion's own Context tile shows
the packet (`:1553`). Standing: declared; hosting exists; face admission is
the L2 pattern to finish.

**T14. Browser** (the inspection instrument; the catalogue itself — §4.1).
Contract: categories over actual owners; category/results above, contextual
pool below; preview ≠ open ≠ add; the instrument/device chooser (the `views`
category). Implementations: `WorldBrowser.tsx` (dispatches
`oi:epi-open-knowledge`, `WORLD-SHELL-DESIGN.md:437-439`); the agent-shell
browser; `NativeTechneBrowser` instrument list (`WORLD-SHELL-DESIGN.md:522-524`);
landed `ModeBrowser` (`DLW-PLAN.md:169-172`). Mockup: browser two-column
geometry (agent `agent-shell-mockup.html:55-91` §browser; world `:92`,
bcols `:451`); BCATS per mode (`world-shell-mockup.html:1469-1473`); CATS
(`agent-shell-mockup.html:547`). Devices: hot-swap pool semantics (DLW-PLAN §2
"Browser" row). Standing: geometry + categories landed; the *chooser* gestures
(click → focused pane, ⇧-click → split, `world-shell-mockup.html:1505,1583-1584`)
are not yet grammar (G5).

**T15. The instrument rack (composite)**. The Device view as a type: the
focused pane's chain of device faces, with its own presentations
(compact/configure/deep — three disclosure levels, `UI-UX-CONVERGENCE-STUDY.md:71-77`).
Contract: chain strip; fold; enable light as a reading; expand to Deep;
pop-out rides detach. Implementations: `NativeDeviceStrip.tsx`,
`NativeRackEditor.tsx`, `NativeDeviceEditors.tsx`, `NativeWorldDetail.tsx`
(`WORLD-SHELL-DESIGN.md:482-494`); the SDK's `inhabitantRack.tsx`. Mockup: the
agent chain (gateway→agent→skills→world→git, `agent-shell-mockup.html:800-810`
`renderChain`); Technē Instruments column (`world-shell-mockup.html:1646-1649`);
Live's Drum Rack → Glue Compressor → Reverb (`:1759-1765`). Devices: it *is*
the device surface. Standing: landed pattern; per-mode chain composition is
the mode chapters' work.

**T16. Inspector tiles (the context dock)** — tentatively a type family, not
one type. The dock's tiles are miniature aperture instances of other types
(session list, frames, agents hive, files, web, graph, diff, ledger,
approvals, wiki, calendar — `agent-shell-mockup.html:824-851` `CTX`; world
`WID` `world-shell-mockup.html:1623-1625`) plus the pure-conversation tiles.
The ontology's reading: **a tile is an instance of an instrument type hosted
in the dock region at tile size** — the same instance law, smaller frame; the
pin affordance ("Stop following; keep this view", `agent-shell-mockup.html`
dock header) is the same follow/pin law as panes. Classification with §16
(inspectors are a family's fourth surface) holds: *inspectors* are the
family-declared contextual panels; *tiles* are the hosting geometry. Whether
every tile must be expressible as a full pane instance (drag a tile into the
centre = open the aperture) is **OPEN-QUESTION G7** (§5) — the mockups imply it
(the agent tile's terminal preview opens the terminal view) but no source
rules it.

**Chrome, explicitly not instruments** (the inventory's remainder): the
transport bar (one transport, five meanings — `modeGrammar.ts:149-158`),
status bar (28 px; the F2 explanation surface, WIDGET-GUIDE §1), the 2×2
launcher (chrome over the catalogue), pane tab rails and the ⊞ pane menu
(`world-shell-mockup.html:1615,1620` — pane-engine chrome), the aperture slot
(the focused pane's context + view controls — the groove-pool geometry,
`world-shell-mockup.html:1509-1531`; WIDGET-GUIDE §4.3), companion headers,
dialogs/toasts. None generates a pane body; all are frame.

**Count: 16 instrument types** (T1–T16), of which T1–T4, T8, T9–T11, T13, T15
have landed implementations; T5–T7 are design-specified only; T12/T14/T16 are
landed surfaces awaiting their formal type declaration (G1).

---

## 3. The graph case study — the template every type follows

The owner's worked example, fully.

**Owner correction, 13 Oct 2026 (DEVICE-SEMANTICS-LOCK §8.1):** the two
graphs studied here are two instruments, not two implementations of one
Graph type. The atlas coloured graph is the 0 instrument's second view
(Earth and solar system ⇄ Graph); the Obsidian-RE knowledge graph is a
standalone instrument under `docs/cradle/WIKI-CONSTELLATION-SPEC.md`. The
contract below remains the template for a type with several
implementations; read "both implementations" as the two graphs' separate
obligations, each kept whole by its own instrument.

### 3.1 The Graph instrument type contract

What *any* graph instrument must do — drawn jointly from both implementations'
existing obligations (neither may lose a behaviour the other proved):

```ts
/* SKETCH — the Graph type contract, composed from the two implementations' */
 /* own landed obligations. Cited obligation-by-obligation in §3.4/§3.5.    */
interface GraphInstrument extends InstrumentTypeDeclaration {   // §1.1
  id: 'graph';                          // one TYPE, two implementations:
                                        //   'atlas' (coloured constellation)
                                        //   'knowledge' (Obsidian-RE lineage)

  // — data —
  //  Nodes/links are a SECOND VIEW of owned material, never a store:
  //  atlas: "the graph is a second view of exactly the field the globe
  //  shows" (atlas graph/build.ts:1-2); knowledge: graph data "remains
  //  owned by its native semantic system; the projection is a surface
  //  over it" (WORLD-SHELL-DESIGN.md:415-417).

  // — navigation —
  //  camera {x,y,zoom}; pan/zoom/pinch; focus/travel to a ref; zoom bounds.
  //  atlas: d3-zoom + whole/local modes (graph/view.ts:2-4);
  //  knowledge: Camera + zoomAt + travel easing + keyboard pan/zoom
  //  (GraphCanvas.tsx:4,56,113-120) and camera handoff to a minimap
  //  (navigationMinimapGeometry.ts:16-25).

  // — selection & encounter binding —
  //  pick/hover with neighbourhood emphasis; selection propagates as an
  //  encounter transition (subject), never per-view state; the pane may
  //  pin a subject (binding.subject_ref, types.ts:111-118).
  //  atlas: GraphHandlers.onSelect/onEarth/onWhole (graph/view.ts:12-20);
  //  knowledge: onSelect/onOpen/onClear + unresolved-ghost honesty
  //  (GraphCanvas.tsx:10,67-69,80-81).

  // — honest ghosts —
  //  unresolved links render as ghosts, never invented nodes
  //  (lane-1:C1, FUNCTIONAL-CROSSWALK.md:34; atlas GHOST_VIS whisper,
  //  graph/view.ts:8; knowledge dashed hollow nodes, GraphCanvas.tsx:80).

  // — devices —
  //  its device set presents when focused (facesFor, manifest.ts:165-171):
  //  atlas: depth, dust, tie bases, spread, gravity, sky anchors, fit
  //  (graph/tools.ts:7-17) + the one-control Earth⇄Graph switch
  //  (graph/switch.ts:1-4);
  //  knowledge: labels (automatic/all/focus), arrows, emphasis, minimap
  //  toggle, context menu (GraphCanvas.tsx:10,147-154).

  // — disclosure —
  //  minimap/overview where the implementation carries one (knowledge:
  //  NavigationMinimap + shared projection geometry,
  //  navigationMinimapGeometry.ts:5-12; atlas: the atlas's own strip/focus
  //  labels, src/ui/).

  // — honesty & a11y —
  //  idle-when-clean rendering (atlas view.ts:4-5 "renders only when
  //  something changes… goes fully idle otherwise"; knowledge: one
  //  demand-driven rAF loop, GraphCanvas.tsx:11-12); every subject
  //  addressable (knowledge accessibility pages, GraphCanvas.tsx:146,155).

  // — retention —
  //  'retain-concealed': camera and selection survive conceal
  //  (projectionModules.ts:133-141; the Atlas's own time-window snapshots
  //  across mode transitions, WORLD-SHELL-DESIGN.md:466-469).
}
```

### 3.2 Implementation A — the atlas coloured graph surface

The ported Archetypal-Earth graph: d3-force constellation, canvas 2D, HiDPI,
"the same field as a calm force-directed constellation (Obsidian's graph, in
this world's light)" (`graph/view.ts:1`). Build is pure data — nodes
(archetype·family·occurrence·body), edges (instance·co·tie·parallel·sky), rank,
colour/glow, time slider position, liveness (`graph/build.ts:4-33`); view
renders idle-when-clean with ghost recede at 0.05 visibility
(`graph/view.ts:4-8`); tools are the graph's own settings space — depth, dust,
tie bases, spread, gravity, sky anchors, fit, earth, whole (`graph/tools.ts:7-17,
19-29`); the mode switch is the one Earth⇄Graph control (`graph/switch.ts:1-4`).
Its state is the atlas five-state machine with `graph?: true` as a mode flag
(`src/state/store.ts:21-32`), mapped onto the spine without a second selection
store (`projectionModules.ts:20-43` table). It renders on SwiftShader-class
software GL for the globe half (`mount.ts:126` WebGL honesty note) — the
"beautiful coloured graph surface" of the owner's quote. Delivered at the door
as the `atlas-earth` family: browser entries `earth/graph/aion`, faces
`graph-tools`/`mode-switch`/`time-control`/`globe-engine`
(`atlasFamilyManifest.ts:17-40`).

### 3.3 Implementation B — the Obsidian-RE knowledge graph

The cradle's knowledge graph: `desktop/cradle/src/knowledge/GraphCanvas.tsx`
(one demand-driven canvas loop; camera model `{x,y,zoom}` with eased travel
and gesture composition on `travel.to`, `GraphCanvas.tsx:49-56`; native
relations drawn as admitted segments with receded/strong batches, `:60-66`;
unresolved associations drawn dashed separately from native assertions,
`:67-70`; hover-drawn relation pulses, `:72`; relation labels admitted by a
box-collision budget, `:87-92`), over `graphNavigation.ts`
(drag-into-neighbourhood, unresolved resolution), `graphRelationPresentation.ts`
(C4 emphasis + label admission), `graphContext.ts` (context menu basis) — with
the shared minimap: `NavigationMinimap.tsx` consuming
`navigationMinimapGeometry.ts` (`projectNavigationMinimap` bounds-fit,
`:5-12`; `navigationViewport` with the native-graph vs Canvas affine origins,
`:14-19`; click-to-camera `:20-25`). Accessibility is first-class: keyboard
pan/zoom/open, context-menu key equivalent, paged subject buttons keeping
every ref addressable under a bounded DOM (`GraphCanvas.tsx:120,146,155`).
Its lineage is the A3 oracle (source/link/Graph oracle at the pinned Obsidian
1.7.7 boundary — `FUNCTIONAL-CROSSWALK.md:12`); its data owner is the native
graph/wiki reading. It is the graph the graph inspector opens from any
projection (`WORLD-SHELL-DESIGN.md:434-439` §3.5).

### 3.4 How both sit in the browser as choices

The mockups already draw the chooser: the browser's per-mode **Views category**
is the instrument catalogue — "Views — click opens in the focused pane, ⇧
splits", one row per aperture (`world-shell-mockup.html:1505`), the same list
the 2×2 launcher mirrors (`LORDER`, `:1569-1570`; `renderLauncher`
`:1582-1584`). Graph appears there once as a *type* (`APS.field`, "The bounded
local whole of the encounter", `:814`). The implementation choice — atlas
constellation vs knowledge graph — is the **device-chooser gesture one level
down**: like Live's plug-in browser offering two reverbs under "Reverb", the
Graph row admits alternatives; a family contributes an implementation through
its manifest (atlas-earth already contributes `graph` as a browser entry,
`atlasFamilyManifest.ts:20-24`); the knowledge graph is the shell's own
(central family's wiki/knowledge ground). Concretely, in the pane: two panes
hold two graph instances of the same subject — one of each implementation —
which is exactly the proved two-panes-two-projections law (`types.ts:22-35`)
with implementations differing instead of kinds.

### 3.5 What each must add to satisfy the contract (the audit)

| Contract obligation | Atlas implementation | Knowledge implementation |
|---|---|---|
| Type/instance binding | `makeProjectionBinding('projection.constellation', subject_ref)` (`engine.ts:263-285`; `types.ts:111-118`) | same binding shape once G1 names its body kind (`graph.knowledge`) — today an ad-hoc binding kind |
| Encounter subscription | EncounterBridge + five-state mapping (`projectionModules.ts:20-43,83-99`) | encounter surfaces via `surface_open`/book (`WORLD-SHELL-DESIGN.md:438-439`); epoch-guarded reads (workspace spine) |
| Navigation | d3-zoom, whole/local, focus labels (`graph/view.ts`) | camera + travel + minimap + keyboard (`GraphCanvas.tsx:113-124`; `navigationMinimapGeometry.ts`) |
| Selection → encounter | `onSelect/onEarth/onWhole` handlers (`graph/view.ts:12-20`) | `onSelect/onOpen/onClear` → encounter transition (`GraphCanvas.tsx:10,107-108`) |
| Ghosts | ghost whisper visibility (`graph/view.ts:8`) | dashed hollow nodes + disclosed sources (`GraphCanvas.tsx:80`; a11y label `:155`) |
| Device set | graph-tools + mode-switch faces (`atlasFamilyManifest.ts:25-29`; `tools.ts:7-17`) | labels/arrows/emphasis/minimap/context — device-shaped, not yet SDK rows (**G2 work**) |
| Retention | handle + `setVisible` pause; state until unmount (`mount.ts:102-120`; `projectionModules.ts:133-141`) | React body retained concealed by the pane tier (`Workbench.tsx:447-457`) |
| Honesty/a11y | idle-when-clean; WebGL honesty (`view.ts:4-5`; `mount.ts:124-127`) | demand-driven loop; paged a11y; reduced-motion (`GraphCanvas.tsx:11,34,146,155`) |

**Neither implementation needs to lose anything**: the contract is the union,
each implementation satisfies it its own way — which is precisely what makes
them *alternatives* rather than a merge. (The recorded atlas-port refusal of
the shell merge, `modeGrammar.ts:426-427`, is this ontology's vindication:
two implementations, one type, no forced wedding.)

### 3.6 The template

Every other type follows the same five moves: (1) write the type contract as
the union of its implementations' proved obligations; (2) name each
implementation's file-level owners; (3) give the type one browser row and the
implementations the chooser; (4) bind instances as kind+subject (+implementation
choice); (5) declare the device set and retention class in the manifest. §5's
gaps are what stands between here and there.

---

## 4. What this resolves

### 4.1 The left-sidebar ambiguity

**Resolved: the browser per mode is the catalogue of the mode's available
instruments, devices and content.** Not a file list, not a nav tree — the
*chooser* over the ontology. The mockup's per-mode columns are the evidence,
mode by mode (`world-shell-mockup.html:1469-1473` `BCATS`):

- **Base**: Central — Days, Flows, Beings, Things, Goals (content categories);
  Project — Files, Wiki; **New** (the four forms = the Document type's
  factory row, `:1490`); **Views** (the instrument chooser, `:1505`).
- **Factory**: Work — Sessions, Agents, Runs, Chats; Ground — Files,
  Knowledge, **Views**.
- **Expressions**: Field — Graph, Scenes, Library; **Views**.
- **Technē**: To hand — Sources, Files; World — Bodies, Locations, Earth
  places, Palaces, Journeys; **Views**.

Every column is one of three things under the ontology: a **content category**
(instances of some type over owned material), a **type chooser** (Views: the
instrument catalogue — the mode's available instruments, from which a new pane
instance is pulled), or a **device category** (devices offered for insertion —
the study's law: "A device category is useful only when its insertion/
capability is real", `UI-UX-CONVERGENCE-STUDY.md:61`). The landed grammar
already types the categories as data with `cut`/`waiting` states and owning
families (`modeGrammar.ts:79-95`; base `:234-250`; factory `:303-312`; technē
`:419-436`) — the catalogue reading is what those categories were always
for. And the agent-shell browser shows the same tripartite reading for a mode
whose content is work: Library categories over owners (Agents, Agentsets,
Skillsets, Worlds, Context, Git, Models — `agent-shell-mockup.html:547`),
Places, Favorites.

The region *below* the browser resolves with it: the aperture slot is the
focused pane's own context + view controls (follow/pin, the view's scale/lens,
the pane layout — `world-shell-mockup.html:1509-1531`), in the groove-pool
geometry (`UI-UX-CONVERGENCE-STUDY.md:63`; WIDGET-GUIDE §4.3) — not a second
browser, and never a pile (`:63`: "a small selector changes that lower area's
role").

### 4.2 Default sets + user sets as trivial consequences

Once panes host instrument instances and the mode grammar declares each mode's
presentations and categories, "default sets" is not a feature — it is the
mode's declared initial arrangement (§1.5): the mockup's `S.modes` seeds
(`world-shell-mockup.html:746-750`) + `newPaneTab()` (`:1602`) + `VIEWMAP`
(`:1707`) are the default sets in rehearsal. "Users save their own, per the
workspace" lands on the engine's existing persistence: a named user set *is*
a `LayoutState` snapshot under the workspace book (`modeLayouts`,
`store.ts:42,125-141`), with the honest-reopen law the engine already enforces
(closed-stack reopening, `types.ts:167-171`; restore point
`types.ts:234-238`, `engine.ts:642` `restoreLayout`). The Ableton analogy closes exactly: a Live Set saves
tracks·devices·arrangement·transport state; a DLW set saves
panes·instrument-instances·bindings·chain standing — and, like Live, *not*
the semantic material, which stays owned (the World is never copied into a
set; `types.ts:12-13`).

### 4.3 The mode system as the grammar that names the defaults

The landed mode grammar (`modeGrammar.ts`) is the ontology's defaults
registry, already: per-mode Session|Arrangement presentation meanings
(`:122-124,171-172,224-225,…`), the Clip|Device detail pair (Rev 4,
`:125-129,173-176,226-229,296-299,358-361,410-413`), browser categories
(`:127-129`), centre compositions (`:130-133`), status identity (`:134-136`),
and the 28 transport slots' meanings per mode (Rev 5, `:136-138,149-158`,
full tables per mode). What the grammar does *not yet* declare — the base
instrument per mode and the mode's default pane arrangement — is gap G6. The
composition is exact: the grammar is "Rev 5's tables as typed data" (`:1-3`),
and the ontology supplies the nouns those tables were re-meaning.

### 4.4 No contradiction with §5.5 — shown, not asserted

§1.6's table is the proof; the two sentences that matter: §5.5 asks "what kind
of rack resident is this?" and the pane-instrument kind asks "what generates
this pane's body?" — different questions, one lattice. The instrument device
kind (§5.5.4) and the pane-instrument superordinate kind meet without collision
in Technē: the *instrument* fills the pane; the *face* sits on the detail row;
both are the same type seen at two exposures — which is Rev 3/Rev 4's own
"the instrument is the instrument" ruling (`WORLD-SHELL-DESIGN.md:143-148,
88-89`) rendered as ontology.

---

## 5. The specification gaps

Honest accounting. Where landed code already satisfies the ontology, §2 said
so; what follows is what needs specifying beyond the mockups. Owner-decision
items are `OPEN-QUESTION (for the owner)`; specification work is `SPEC-NEEDED`
with its sketch.

**G1 · SPEC-NEEDED — body kinds become instrument types.** The pane engine's
body-kind spellings are three systems today: the four `PROJECTION_PANE_KINDS`
(`types.ts:36-45`), ad-hoc `SurfaceBinding.kind` strings (source, knowledge,
file, encounter, browser, terminal, flow… `types.ts:69` + detached kinds,
`WORLD-SHELL-DESIGN.md:454-456`), and the SDK face kinds
(parameter/document/conversation/instrument — `worldShellFamilies.ts:57-90`).
Sketch: one `InstrumentTypeDeclaration` registry (§1.1 sketch) whose ids are
the body kinds; the binding's `kind` references it; the four projections are
its first four members; the cradle's existing kinds are declared (not renamed)
as the next members. Migration is additive; no operation changes.

**G2 · SPEC-NEEDED — the admission door grows kind → implementations.** Today
`registerProjectionModule` admits one module per kind and refuses a second
(`projectionModules.ts:157-169`) — right discipline, wrong granularity for
the reverb insight. Sketch:

```ts
/* SKETCH — implementation registry at the existing door */
interface InstrumentImplementation {
  id: string;                 // 'atlas' | 'knowledge'
  typeId: string;             // 'graph'
  family: string;             // admitting family (§16 exposure law)
  create: ProjectionModuleRegistration['create'];   // unchanged module contract
}
registerInstrumentImplementation(impl);   // refuses: unknown type, wrong family, duplicate id
setImplementationDefault(typeId, implId, scope: 'core' | SurfMode);  // per mode or core-wide
// instance binding gains: {kind, subject_ref?, implementation?}
//   — absent implementation = the scope's default; present = the chooser's pick.
```
The existing one-module-per-kind refusal becomes the *default slot's* refusal
(two defaults for one type refuse; alternates never collide).

**G3 · OPEN-QUESTION (for the owner) — the default Graph, per mode.** Which
implementation opens when a pane pulls "Graph": the atlas coloured
constellation, the knowledge graph, or mode-dependent defaults (Technē's Project →
knowledge; Expressions' Field → atlas)? Ableton ships defaults per device
type; the owner chooses. The mockup hints (`APS.field` = the bounded local
whole, the knowledge-graph shape; `INST.M0` view `field`), but no source
rules it.

**G4 · SPEC-NEEDED — the Set document (named user sets).** What saves is
§1.5's list; what needs specifying: the Set's identity and home (a workspace
book record? a kernel-owned document with refs?), the save gesture (Live:
⌘S a set; DLW: name + save from where — the aperture slot's pane-layout
section is the mockup's host, `world-shell-mockup.html:1511`), and set
contents' ref-honesty on reopen (a set is a *layout over refs*; subjects may
have moved — reopen re-binds, never copies). The mockup's host for the
gesture is the aperture slot's pane line (`world-shell-mockup.html:1509-1510`).
Proposed acceptance: save a set
in mode A with pinned + following panes; close; reopen in a fresh workspace
book; all instrument instances restore by ref with retained camera/selection.

**G5 · SPEC-NEEDED — the chooser gestures as grammar.** The mockup's
insertion law — click into the focused pane as a tab, ⇧-click splits
(`world-shell-mockup.html:1505,1583-1584`), drag a tab onto a centre/edge
(`:1684-1688`), the ⊞ menu (`:1620`) — is the instrument-chooser grammar and
is not yet in the mode grammar or the engine's action registry (the engine has
`splitOff/tileSurfaces/moveTab`, `engine.ts:451-563`; the launcher gestures
are mockup-local). Sketch: name them as frame actions (`views.pull`,
`views.pull-split`) beside the existing frame disclosures
(`registry.ts:96-153`), so browser rows, launcher cells and keys share one
grammar.

**G6 · SPEC-NEEDED — base instrument + default arrangement per mode in the
grammar.** `SurfModeGrammar` (§4.3) gains `baseInstrument` (the new-pane
default — mockup `newPaneTab()`, `world-shell-mockup.html:1602`) and
`defaultSet` (the seed arrangement — mockup `S.modes`, `:746-750`), validated
against the instrument-type registry (a base instrument names a real type +
implementation). Cross-held to `sdk/modes.ts` the way the Rev-5 tables are
(`modeGrammar.ts:12-15`).

**G7 · OPEN-QUESTION (for the owner) — are dock tiles full pane-instrument
instances?** §2 T16's reading (a tile = an instance at tile size; drag into
centre = the aperture) matches both mockups' behaviour but no source rules
it. If yes, T16 dissolves into the other fifteen types + the dock as hosting
geometry; if no, tiles stay a sixteenth family of compact inspectors and §16's
"inspectors" surface absorbs them.

**G8 · SPEC-NEEDED — retention classes declared per type.** The three-tier
law exists (`Workbench.tsx:426,451,474`) but the release set is a hardcoded
pair (`'sources','blank'`). Each type's `InstrumentTypeDeclaration.retention`
(§1.1) declares its class; the pane tier reads the declaration. Projections
retain (the hidden-inhabitant law); cheap lists release; everything else
retains by default.

**G9 · OPEN-QUESTION (for the owner) — Base's "Day · Session" (`docgrid`).**
The ontology reads it as a **Timeline presentation** (document streams as
tracks, entries as clips — `world-shell-mockup.html:1701,1710`; VIEWMAP pairs
it with `tl-today`, `:1707`), not a seventeenth type. The mockup draws it as
its own body. Confirm the reading; if confirmed, `docgrid` is spelled
`projection.timeline` with a `document-track` adapter set.

**G10 · SPEC-NEEDED — instrument devices' `operatesOn` vocabulary.** Device
faces name the encounter-surface kinds they operate on (`manifest.ts:26-28`)
with free strings today ('expressions', 'source', a projection kind). Under
the ontology, `operatesOn` values are instrument-type ids (the rack follows
the focused pane's *instrument*, `manifest.ts:165-171`) — one controlled
vocabulary, the type registry's.

**G11 · SPEC-NEEDED — device sets for the unbuilt types (T5–T7).** Canvas,
Scenes/Journey, Palace have mockup-drawn controls (frames/promote;
pace/stops; rooms/portals) but no device declarations. Each type's §2 entry
names its device set as OPEN; the declaring families (quaternal-logic for
T5–T7 per the grammar's `waiting` attributions, `modeGrammar.ts:426-435`)
declare them at the door when their owners land.

**G12 · OPEN-QUESTION (for the owner) — set scope across machines.** The
owner said "users save their own, per the workspace" — workspace-scoped sets
confirmed. Open: do sets follow the person across machines (the workcell
model) or stay per-ground? No source rules it; the workspace book's own
scope is the current default.

---

## 6. Verification statement

- **Code claims** cite file:line in the seat tree named at the header; the
  L1 seam (`0d69d5b2c` lineage — `PROJECTION_PANE_KINDS`,
  `projectionModules.ts`, `projectionPane.tsx`), the mode grammar, the
  manifest/SDK, the atlas port and the knowledge graph were read directly.
- **Mockup claims** cite file + line/section in
  `new-shell/world-shell-mockup.html` (rev 5) and
  `new-shell/agent-shell-mockup.html` (rev 4).
- **Catalogue exhaustiveness**: both mockups' HTML surface inventory was
  walked — world: 14 `APS` apertures + 6 `INST` lenses + Rev-5 `docgrid`/
  `musicsess`/`musicarr` + 11 `WID` dock tiles + per-mode `BCATS` categories
  + per-mode `CTABS` companion tabs + detail pairs (`DVN`) + the pane tree/
  menu/drag; agent: browser `CATS`, session/arrangement/thread/gateway centre
  views, the device chain (gateway, agent, agentset, skillset, world, git,
  ledger, approvals, native Medium/Depth), clip view, 12 `CTX` dock tiles,
  launcher. Every drawn surface is catalogued above as an instrument type
  (§2 T1–T16), an instance of one (dock tiles, companion bodies), a device
  (§1.2), or chrome (§2 closing list). Nothing drawn is unaccounted.
- **No source files were edited**: this lane writes one document; `tsc`
  state is untouched by construction (no `src/` writes; the TypeScript above
  is sketch inside this file).

---

## 7. Handoff — what the per-mode lane (O2) should bind to

O2 composes the modes; this ontology is its noun list. Concretely:

1. **Bind the mode grammar's next fields to G6**: `SurfModeGrammar` gains
   `baseInstrument` + `defaultSet`, seeded from the mockup's
   `newPaneTab()`/`S.modes`/`VIEWMAP` (`world-shell-mockup.html:1602,746-750,1707`),
   validated against the instrument-type registry of G1 — never hand-named
   strings in components.
2. **Treat every per-mode centre composition as instrument-instance
   composition**, not new views: Base's Day·Session is Timeline presentations
   over document tracks (G9's reading, pending the owner's confirmation);
   Factory's centre is T9+T10; Technē's lens bar is the six-instrument
   exposure of T1–T7 with the device column as their faces (§1.2 relation 1).
3. **Per-mode device composition through `facesForMode`**
   (`sdk/define.ts:318-328`) and `operatesOn` typed to instrument-type ids
   (G10) — the mode's chain is the focused pane's type's device set, never a
   per-mode hand-list.
4. **Mode switching stays an encounter transition** (`modeGrammar.ts:17-24`
   mapping; `store.ts:125-141` for the per-mode tree hand-off) — the
   ontology adds nothing to the spine; the mode names defaults, the encounter
   carries.
5. **Do not resolve the chooser (G5) per mode**: it is one frame grammar; the
   mode only decides which categories and base instruments the browser
   *lists* (§4.1).
