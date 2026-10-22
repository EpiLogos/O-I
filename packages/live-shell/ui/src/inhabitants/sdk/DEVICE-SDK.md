# The Device SDK — how agents (and humans) build devices for the shell

Standing: **device-sdk v1.1, 10 October 2026**, by `agent:zcode-device-sdk` on — the worked example of the domain's ecology of law (`skills/m-prime-development/FOUNDING.md`); the domain loop lives at `skills/m-prime-development/SKILL.md`.
the standing new-shell lane. The SDK is the development loop the owner
commissioned: point an agent at functionality — from the UX spine and the
capability matrices, at the app, at any gap — and the agent builds the
device/plugin for it natively, to the shell's UI standard, using the icon
sets of `icon-cut.html`, within the correct paradigm.

The SDK does NOT open a second plugin path. It is the typed front for the
laws that already stand:

| Law | Source | Where the SDK binds it |
| --- | --- | --- |
| The neutral door, one rack, families | WORLD-SHELL-DESIGN §5.5, §12–16 | `../familyManifest.ts` (admission), `../manifest.ts` (composed manifests) |
| §14 parameter addresses, one owning family per row | WORLD-SHELL-DESIGN §14, `AGENT-DEVICE-OWNERSHIP.md` | `define.ts` rows, `validate.ts` cross-check against `AGENT_SHELL_ADDRESS_TABLE` |
| The proven aperture `{reading, disabled, apply, captureCurrent}` | `nativeDeviceCustody.ts` | `controls.tsx` names it (`DeviceFaceAperture`), never redefines it |
| The editor standard (identity, input law, honest state, draft vs acknowledged) | `NATIVE-EDITOR-STANDARD.md` | `controls.tsx` + `sdk.css` |
| The icon law | `icon-cut.html` (the specimen) | `icons.ts` — GENERATED from the specimen by `scripts/sync-icons.mjs`; byte-locked by test |
| The mode ontology (five modes, transport slot meanings, per-mode marks and readouts, device formats) | `icon-cut.html` MODES + SLOTS + mode rows; WORLD-SHELL-DESIGN Rev 5 | `modes.ts` — readouts drift-gated against the specimen by test |
| The product carving law (six carvings, keys held by owners, the seventh-product test) | WORLD-SHELL-DESIGN §12–13, `suite/product-capabilities.json` | `products.ts` + the `product`/`newProduct`/`transport` declaration fields, enforced by the gate |

## The modules

```
src/inhabitants/sdk/
├── icons.ts          GENERATED — the cut's marks + renderIcon (never hand-edit)
├── Icon.tsx          the icon law as a component (<Icon name size title/>)
├── modes.ts          the five modes: marks, Rev 5 transport rows and per-mode
│                     meanings, specimen readouts, the transport-slot ontology
│                     (cut mark · rejected alt · rationale), device formats
├── products.ts       the six-product registry (drift-gated vs the suite catalogue)
├── define.ts         the authoring kit: admitFamily / declareDeviceExtension /
│                     param builders, mode scoping + formats, product binding,
│                     transport bindings, presentation + §14 registries
├── validate.ts       the gate: per-device checks, family checks, the world gate
│                     (§14 uniqueness, ownership-map contradictions, §12 carving
│                     exclusivity, mode/format/slot/product laws)
├── controls.tsx      FacePlate · ScalarParam · EnumParam · BoolParam ·
│                     ReadingRow · Lamp · Disclosure · WaitingFace ·
│                     useFaceDrafts (base vs draft vs standing)
├── sdk.css           the face language — every value resolves an existing
│                     shell token; --sdk-* only NAMES the resolutions
├── marks.tsx         the lane's components for the marks beyond the 24×24
│                     dictionary (chevrons, kind shapes, wood marks) — by the
│                     co-worker lane, consuming icons.ts
├── adoptVerifiedRows.ts  adopts the verified address table into the kit's
│                     registries (the five agent-shell families' §14 layer,
│                     identity with the table, no door writes)
├── scaffold.ts       pure generator for a new family's three files
├── dev/              the visual harness (`npm run devices:dev`, port 5207)
└── DEVICE-SDK.md     this file
```

## The loop

**1. Find the work.** The capability matrices joined with the admitted
device surface:

```sh
npm run devices:gaps                 # partial + claimed-only capabilities
npm run devices:gaps -- --family central
npm run devices:gaps -- --json
```

Each row: the capability claim and standing, the family that would carry it,
and the faces/params that family already fields. The gap between the need
and that surface is the work candidate. Read the thread law in the
new-shell lane's `UX-SPINE-ALIGNMENT.md` before choosing where a thread
lands — the spine decides, the SDK only serves it.

**2. Own the family boundary.** A device belongs to its native owner's
family. No family for it yet? Scaffold one — but the family author is the
native owner or a lane commissioned by one (the door is neutral; the keys
are held by owners):

```sh
npm run devices:scaffold -- <family> <owner> <device> <device-title> [icon]
# e.g. npm run devices:scaffold -- acme "Acme Instruments" probe "Probe" form
```

This writes a manifest module, a face component and a test — all passing
the gate, all honest (the starter carries readings only; a scaffold never
pretends a writer).

**3. Declare to the law.** In the family manifest module, declare devices
and their §14 rows:

```ts
import {admitFamily, numberParam, enumParam, reading} from './sdk/define.ts'

export function loadAcmeFamily(): void {
  admitFamily({
    id: 'acme',
    owner: 'Acme Instruments',           // the disclosure law: a face names its owner
    browser: ['acme'],
    writers: ['shell.setAcmeGain'],      // the shell paths THIS family arms (the
                                         // writers law — see below)
    paramsGrammar: 'acme/parameter-address/v1',
    devices: [{
      id: 'probe',
      title: 'Probe',
      icon: 'form',                      // a mark of the cut — required
      liveSemantic: 'info',              // the Live semantic it occupies — required (below)
      note: 'Reads op acme_probe_read; the calibration writer waits.',  // the honesty lives here
      params: [
        numberParam({key: 'gain', title: 'Gain', type: 'number',
                     range: {min: 0, max: 2, unit: 'x'}, writePath: 'shell.setAcmeGain'}),
        enumParam({key: 'mode', title: 'Mode', type: 'enumerated', values: ['slow', 'fast']}),
        reading({key: 'readiness', title: 'Readiness', type: 'string',
                 disclosure: 'No owner reading wired yet.'}),
      ],
    }],
  })
}
```

Write-path grammar: `kernel:<op>` (the kernel op union), `shell.<setter>`
(the shell's own armed setters), or `<tool>:<command>` (a native owner's
CLI — `workcell-cli:git commit`). **A row without a writePath IS a
reading** — that is the grammar, not a convention.

**The Live semantic law** (DEVICE-SEMANTICS-LOCK §1, §2, §5; `sdk/semantics.ts`):
every device names the Live semantic it occupies, from the closed vocabulary
`LIVE_SEMANTICS` (`device-instrument`, `device-audio-fx`, `device-midi-fx`,
`rack`, `macro`, `clip`, `track`, `stop`, `return`, `link`, `info`, …).
The gate refuses a face with no semantic, an unknown one, one illegal in a
mode it presents in (`LEGAL_SEMANTICS_BY_MODE`), a broken invariant, an
invariant field that does not belong to its semantic, or a format its semantic
does not take (`FORMAT_RULES`: `die` and `instrument-face` are instruments;
`run-viewer` is a track or arrangement in factory only). The invariant names
what the semantic keeps: an instrument names the owner write it `generates`
(or `generatesAbsent`, the owner it waits for); an effect names what it
`transforms`; a return names the `routesTo` it proposes to; a rack its
`chains` and `chainSelector`; a macro the `maps` it moves; a clip its
`material`, `revision` and `states`; a track its `stream`; a stop the
`launches` it stands. A new device starts as `info` (readings only). The
registry is generated: `node scripts/validate-devices.mjs --write-registry`
writes `sdk/semantic-registry.json`, which a test locks.

**The writers law:** every write path is membered. A `shell.` path must
be armed by the shell (`ARMED_SHELL_SETTERS`, derived from the verified
address table) or declared on the family's `writers` — and self-arming
carries an authority (`writerAuthority`: who commissions the arming; a
fixture names itself). A `kernel:` path must name a real op of the
kernel's own union (`kernelOps.ts`, generated from the kernel's types by
`scripts/sync-kernel-ops.mjs` — 78 ops, drift-gated). A `<tool>:`
path must name a known native-owner tool (`workcell-cli`, `ctrl`,
`aikit`, `oi`); the command stays with the tool's repository. The law
runs at admission, on the extension path, and again in the world gate.

**Modulation honesty (§14):** a row may declare `modulatedBy` — the
telemetry observable that moves it. The gate checks the observable
against every admitted family's telemetry declaration ("nothing moves
without a visible cause"), and the kit's controls show the modulation on
the row.

**Panel slots** (`InhabitantPanelSlot`) are not a fifth surface: their
slots (`center`, `right-dock`, `bottom`, `browser-section`) are positions
WITHIN the four §16 surfaces, and the gate checks the names against the
registry.

A declaration that breaks the law throws at admission, naming each fault.

Already-admitted family, new faces? Compose, never rewrite the owner's
base:

```ts
declareDeviceExtension({id: 'acme:world-shell', by: '<your lane>', family: 'acme',
                        devices: [/* … */]})
```

**Pop-out (seam 8).** A device pops out into its own native window only where
that window can draw the device's body from its identity alone. The rule is
`faceStandsAlone` (`manifest.ts`), and nothing else decides it. Today the
standalone faces are Central's day die (`day-die`, a document), the Flow
(`flow-document`, a document), the Nara conversation (`nara-conversation`, a
conversation) and the QL instrument (`ql-instrument`, an instrument). Parameter
faces have no body in the rack. The atlas and knowledge-graph bodies drive the
main window's mounted globe or graph handle, which a separate window cannot
reach, so they stay in the main window. A window for any of those would be
empty or inert.

- The kit's default: a device pops out only where its id and kind name a
  standalone face, and not while it waits. `popOut: false` opts a face out.
- `popOut: true`, or `'pop-out'` written in a device's `dock`, on any other
  face throws at declaration, naming the face. Its window would be empty.
- A device that pops out puts `'pop-out'` in its dock, and its family
  declares the `device` detached kind. The kit does both for you.
- The day die needs a Day in its aperture, and the Flow needs a flow. Without
  one the device door refuses the window by name, and the rack offers no
  pop-out.
- `detachedKinds` names the window kinds a family's document faces pop out
  through (`flow`, `file`, `encounter`, …). It is not where devices are
  declared. A hand-written manifest declares `'device'` and `'pop-out'`
  itself, and the device door refuses a face that does not stand alone.

### Modes — the mode-specific plugin surface

Modes are the shell's spine (no second navigation model, no mode SDK) — but
what varies BY MODE is declarable right here, from the specimen's own
ontology (`modes.ts`):

```ts
admitFamily({
  id: 'acme',
  product: 'acme-works',                    // §12 carving (newProduct for a
                                            // NEW product, with authority)
  transport: [                              // Rev 5's table, addressable:
    {mode: 'factory', row: 'tempo-signature', face: 'probe', key: 'gain'},
  ],
  devices: [{
    /* … */
    modes: ['live', 'factory'],             // mode-scoped plugin
    formats: {live: 'chain-plate', factory: 'run-viewer'},  // per-mode shape
  }],
})
```

- `modes.ts` carries the five modes' cut marks, the specimen's per-mode
  transport readouts (drift-gated byte-for-byte against `icon-cut.html`),
  Rev 5's per-mode row meanings and Session/Arrangement presentations, the
  transport-slot ontology (cut mark · rejected alternative · rationale),
  and the device-format vocabulary (`chain-plate`, `die`, `scene-strip`,
  `run-viewer`, `instrument-face`, `tool-tile`) with each mode's default.
- `facesForMode(mode)` resolves the mode-scoped plugin surface;
  `sdkMode`, `transportSlot`, `PRODUCTS` are the lookups.
- The gate enforces it: modes and formats must be from the ontology,
  transport bindings must sit on real rows addressing real §14 rows, a
  product binding must be registered (or claimed as `newProduct` with its
  authority), one product family per product, and an unbound family does
  not squat a product's name.

**4. Compose the face** from the kit (`controls.tsx`) against the proven
aperture — the face receives `{reading, disabled, apply, captureCurrent}`
and never dispatches a write of its own:

```tsx
import {FacePlate, ScalarParam, ReadingRow, useFaceDrafts} from './sdk/controls.tsx'

export function ProbeFace({aperture}: {aperture: DeviceFaceAperture}) {
  loadAcmeFamily()                                   // idempotent admission
  const drafts = useFaceDrafts(async changes => {    // map onto YOUR aperture:
    await aperture.apply(changes.map(toNativeChange)) // the custody law stays the owner's
  })
  return (
    <FacePlate presentation={facePresentation('acme', 'probe')!} power="unknown">
      {/* scalar rows bind drafts.base/drafts.drafts through useFaceDrafts */}
      <ReadingRow param={row('readiness')} value={state.readiness} />
      <Disclosure title="Probe" instanceRef="acme:probe" owner="Acme Instruments" />
    </FacePlate>
  )
}
```

The controls carry the editor standard: pointer drag + arrow keys + typed
entry on scalars; acknowledged base and retained draft shown distinctly;
Enter commits, Escape cancels; an unknown state has no illuminated lamp;
every colour resolves a shell token.

**5. Pass the gate.**

```sh
npm run test:device-sdk       # kit tests + the world gate
npm run devices:validate      # the gate alone (also --json)
npm run build                 # tsc --noEmit && vite build
```

The gate checks: the door's manifest law, §14 address grammar and
uniqueness, the verified ownership map (`AGENT_SHELL_ADDRESS_TABLE`), the
icon law, waiting-face honesty. Exit 0 = the world passes.

**6. Verify like the house verifies.** A declaration passing the gate is
the floor, not the acceptance: exercise the face in the dev harness
(`src/inhabitants/dev/`), capture the running behaviour, name what waits.
The editor standard's admission packet applies to editors that replace
native controls.

## Waiting component forms — where a capability plugs in

*Folded verbatim from the retired `wayfinder/WIDGET-GUIDE.md` §5 (L481-499), 9 Oct 2026. The mockups hold the forms; the manual (§16.9-§16.14) states the current vocabulary.*

Capabilities plug into these **waiting forms** — no bespoke chrome per
feature:

| Waiting form | Where | What plugs in |
|---|---|---|
| Generic native device (visual + Amount knob) | detail chain | any family parameter device (§3.7) |
| Folded rack card | detail chain | any admitted-but-compact family device |
| Pool `.row` configure form | browser pool | any device's settings tier |
| Launcher cell + tile shell + Pin/✕ | context dock | any inspector/tile surface (SDK badge for provider widgets) |
| Clip slot grid + stop row | session view | any task/scene material (agents, native scenes share the grid) |
| Needle + event lanes | arrangement | any temporal material with last-activity |
| Epistemic-standing clip chips | timeline | any dated/historical material |
| Ghost node | constellation | any unresolved link |
| Proposal → Promote card | canvas/court | any presentation awaiting a native Action |
| Occurrence chip (count·frame·precision) | earth surface | any situated material |
| Planet-building parameter group | World device | any per-World body parameter |
| Scene launcher row | timeline scenes / journey | any walk stop |
| Portal chip | palace | any authored link-out |
| Day die face / Flow participant / Being binding row | Base documents | Central material as devices |

## Improvement ledger — forms that exceed the mockups

*Folded verbatim from the retired `wayfinder/WIDGET-GUIDE.md` §7 (L536-541) and §8 (L545-585). Where an implementation exceeds the mockup, record the improvement here so the next device starts from the better form; where it falls short, name the gap until it closes.*

**Maintenance law** (WIDGET-GUIDE §7):

Wherever an implementation **exceeds** the mockup, the improvement is
recorded back here (§8) so the next device starts from the better form.
Wherever an implementation **falls short**, the gap is named in §6 until
closed. The guide changes only through this ticket's owner (C3) or a
successor claim on the map — it is the shared floor, edited like ground, not
per-lane.

**Ledger** (WIDGET-GUIDE §8):

*(implementations exceeding the mockup, recorded back per §7)*

- **Reading-row form** (L7, 9 Oct — `CentralHygieneDevice`): a reading row
  that carries its `boundary_op`, its live standing **verbatim**
  (answered/refused with the owner's own words in place), and a
  honoured-how note — the disclosure law made tabular. Proposed for any
  device whose body is a set of owner readings.
- **Declared-tender form** (L7, 9 Oct): a tender that cannot fire honestly
  renders **declared and unfireable** — `ownerOperation` + `receiptShape`
  visible on the control itself, so the receipt a press *would* produce is
  readable before any press. Extends the guide's disabled/soon law (§1)
  with a receipt-shaped disclosure.
- **Completion-stamp form** (L7, 9 Oct — `CentralSubjectDetail`): save-router
  outcomes rendered as all-unreached until a document device acts — the
  honest-empty law applied to outcome state, not just rows.
- **Named-outcome chip form** (inhabitants-craft, 9 Oct — the document
  devices): the save router's five outcomes each get their own drawn chip —
  `saved` filled green, `unchanged` dotted hollow, `stale` amber-outlined on
  accent wash, `conflict` hazard-striped, `refused` dashed red — the
  outcome named on the chip, the owner's own words in the title. Replaces
  the plain text line the strip carried; the router's grammar unchanged.
- **Die-net reading form** (inhabitants-craft, 9 Oct — `day-die`): the
  device's compact face draws the icon-cut Day-die net (six positions,
  open face inked, fold dashes) as a READING of the payload's own
  `meta.face`; the ‹ › turn affordance renders named-and-unfireable where
  no host turn channel is declared (the §1 disabled law with the reason on
  the tooltip, the gap named in the lane's return).
- **Chain-of-manifests rack** (inhabitants-craft, 9 Oct — `InhabitantRack`):
  a manifest-rendered rack that wears the §3.7 chain anatomy — fixed-width
  cards with power light, kind mark, name, owner line, fold/pop-out marks,
  honest reason line, and one dashed drop zone naming what may dock — so a
  declared family lands on the chain at device density, not as full-width
  grey rows. Waiting faces fold into it as the honest dashed card with a
  dark lamp.
- **Icon-cut discipline for the manifest rack** (inhabitants-craft, 9 Oct,
  with the device-SDK lane): the rack's marks are NAMED marks cut from
  `icon-cut.html` (the `I` dictionary, FOLD/POP chevrons, `kindShape`
  kind marks, the woodcut method marks) via the generated
  `sdk/icons.ts` + `sdk/marks.tsx` — no inline SVG inventions on faces.
  The chevrons and kind marks entered the generated module through the
  sync script (evaluated pure specimen code, byte-faithful output).

## Device lifecycle gestures and rack-topology integrity laws

*Folded verbatim from the retired `wayfinder/DLW-PLAN.md` §3.2 (L566-597, the device-lifecycle gestures with their Live reference and DLW acceptance shape) and §3.4 (L636-652, Live's loader laws restated as rack-topology integrity laws), 10 Oct 2026. Bracketed source keys resolve in the research tree `docs/research/ableton-live-12.0.25/`.*

### The acceptance gestures

The crosswalk's operation family "Device lifecycle and rack topology" is this
chapter's acceptance surface [CROSSWALK §Additional operation families]:

> **Anchors:** "installed entity/processor owner instances, scoped Field controls,
> source/rack/occurrence identities"
>
> **Gestures:** "insert/select/fold/move/duplicate/remove/activate; compatible
> hot-swap; preset store/recall; group rack; map macro range/curve/scope; variation
> store/recall/exclusions"
>
> **Shape:** "Serial/parallel/shared contribution topology has real separate
> supported native instances, useful graphical faces and expanded views"
>
> **Detecting trial:** "Native topology readback per operation and rich rack reload;
> macro target/range/curve/exclusions; refusal of unsupported swaps"

Gesture-by-gesture, with the Live reference each one attains:

| gesture | Live reference behavior (corpus) | DLW acceptance shape |
| --- | --- | --- |
| insert | Drag target everywhere; device lift-in from preset as-is (+Id +pointees) [session-model §4; UI-EVIDENCE] | browser → chain drop lands a declared device; the aperture captures current basis; receipt names the write |
| select | Selected-slot ring, device dropdown per track header [capture 1–2] | selection carries subject_ref; no second selection store [WSD §10 seam 3] |
| fold | `foldedRack`: "A device folded to its title, as in Live" [mockup:agent] | fold state per device; expanded view keeps the same instance |
| move | Chain reordering — the landed chain drag: `agentChainDrag.ts` card slide + insertion index among chain cards, `chainDropDecision` naming each refusal | move lands through the owner op; insertion index readback |
| duplicate | (Live edit semantics; corpus silent on the gesture itself — UI-level) | duplicate creates a new instance with its own §14 addresses; no shared mutable state |
| remove | Loader law: removal must clear `AutomationEnvelopes`, `SignalModulations`, clip `Envelopes` referencing the removed device — dangling references are rejected [session-model §4 rule 3] | remove receipts name what was cleared; nothing dangles |
| activate | Device `On` parameter; bypass-reference renders calibrate against it [session-model §6; backlog gate] | activator light only with a real owner enable; otherwise hollow [DEVICE-PANEL-BRIEF rule 6] |
| hot-swap | Compatibility = signal-domain typing of chains [racks §1.1] | "refusal of unsupported swaps" is part of the detecting trial [CROSSWALK] |
| preset store/recall | `.adv/.adg` containers; lift-in semantics [session-model §6; racks §1.4] | store/recall through owner ops; recall restores addresses + ranges + identity |
| group rack | `GroupDevicePreset` chassis: Branches + ReturnBranches + macros [racks §1.2] | group creates a rack device whose chains are the grouped devices; topology readback |
| map macro range/curve/scope | MacroControls.0–15 + MidiControllerRange 0..127; mapping store = Flip layer (persistence probe open) [racks §1.7] | macro mapping names target, range, curve, scope; readback exact |
| variation store/recall/exclusions | MacroSnapshots + MacroVariations + `ExcludeMacroFromRandomization/Snapshots` per macro index [racks §1.2, §1.7] | variation recall honors exclusions; unset slots stay unset (−1/false) |

### Live's loader laws restated as the DLW's rack-topology integrity laws

The corpus's loader rejections are not trivia; they are the integrity laws a rack
implementation must enforce to deserve the word "rack". Restated for the builder
[sources in §4.1 A4]:

1. **Identity**: every chain member carries an identity. (DLW: instance refs;
   "Deep links address refs, never indices" [lane-3 E22; CROSSWALK].)
2. **Resolution**: every parameter address resolves to an allocated, admitted row —
   a dangling address is a rejection, not a warning. (DLW: §14 grammar + gate.)
3. **No danglers on removal**: removing a device clears every automation, envelope
   and modulation that referenced it. (DLW: the remove gesture's receipt names the
   cleanup; the detecting trial exercises it.)
4. **Arity**: sends match returns — topology arity is load-bearing, enforced at
   write time. (DLW: the rack gate should refuse a chain whose declared sends have
   no return counterpart.)
5. **Lift-in equivalence**: preset recall = the same device element, same identity
   discipline, re-addressed. (DLW: preset store/recall restores §14 rows + ranges
   + identity, verified by readback.)

## Naming and carrier rules for faces

*Folded verbatim from the retired `wayfinder/WIDGET-GUIDE.md` §9 (L594-626), 12 Oct 2026 (DLW-VISION §5.2 item 21). Names of retired documents inside the text are the source's own.*

**Six naming and carrier rules** *(12 Oct 2026; DLW-VISION §5.2 item 21)*:

1. **A lens is not a device.** "A pane-instrument *may expose* devices; a
   device never hosts a pane" (`WORLD-SHELL-DESIGN.md` §5.6, "1.2 Device").
2. **Every relocated Live control names its function, or is labelled reuse
   of the slot's place.** The transport keeps its places fixed; where a
   slot keeps only its place, say so (as the aperture slot does, §4.3; the
   F/P column of DLW-PLAN §2).
3. **Plain instrument names; the M′ address is provenance.** The deep
   instruments are project/graph, canvas, timeline, journey, places, palace
   (D-F, `desktop/cradle/docs/world-shell/PROGRAMME.md` R9); an M′ coordinate appears only in a
   provenance field, never as the face's name.
4. **No coined names.** A control, device or act is named by what it does,
   in plain words; origin-return in particular gets no coined UI label.
5. **Live-corpus M-labels are not Bimba coordinates.** The Live corpus's
   "M0/M1/M3" are gate and seam labels ("live-engine is M1"; "The M3 POST is
   that write path"), not QL/Bimba addresses (**Inferred** from usage, no
   source states it; DLW-VISION L-0); never read or render one as the other.
6. **"Base" names Live mode.** Under the owner's ruling (12 Oct 2026,
   `CONTEMPLATION-DLW-INSTRUMENT.md:232-252`) "base" means Live mode, and the
   Central mode is titled "Central". Where this guide's Rev 3–4 forms say
   "Base" for the ground (§4.5, §4.13, §4.14), read "Central". Two ids carry
   the word: the surf/shell id `base` is Central's, and the stored book mode
   `base` serves both Live and Central (`modeGrammar.ts:19-20`;
   `packages/live-shell/ui/src/continuity/workspace.tsx:27`), so it is never
   renamed without a migration.

**Tension recorded beside rule 6 — the Technē companion label** (DLW-VISION
L21; DLW-PLAN §10 item 49): the dock names the Technē companion "Epii"
(`ModeContextDock.tsx:67`), its M5 subsystem; the Expressions companion is
named by its S4′ operator, Anima. The other side of the tension, the L5
lock's "Technē_i := Aletheia_i", went with the four-and-two reading (owner,
19 Oct 2026), so the label stands.

## Field-panel devices — the owner's whole-device model and the craft rules

*Folded verbatim from the retired `DEVICE-PANEL-BRIEF.md` (working brief, 8 Oct 2026: "What a device is", "How the pieces work", "Design rules", "Tests") and from the retired `EXPRESSIONS-PORT-PLAN.md` (working plan, 8 Oct 2026: "Definition of finished", "Architecture rules"). The brief's lane-bound parts (files to create, verify-and-report, lane rules) are not carried. The "three presentations" in the model below were refined by the six views of the lock (§0.3); the rest stands.*

### Standing of the port plan (EXPRESSIONS-PORT-PLAN.md, L3)

Standing: **working plan, 8 October 2026.** Scope is the Expressions app only. Technè and Factory/Agency run as parallel tracks and are out of scope here. Read with [EXPRESSIONS-FEATURE-MAP.md](EXPRESSIONS-FEATURE-MAP.md) (the rows being ported), [NATIVE-EDITOR-STANDARD.md](NATIVE-EDITOR-STANDARD.md) (the craft bar) and `/Users/admin/Downloads/oi-editor-v2/EDITOR-AND-DEVICE-SPEC.md` (the design basis). Owner direction: port the full capability, not a piecemeal subset; keep to the shell's UI standards; parallel Haiku implementation under one integrating parent.

### What a device is (owner model — do not drift from it)

The Expressions app already has about a dozen **deep settings panels**, each holding its own bounded parameters. **Each panel becomes ONE whole device.** Do not fragment a panel into small pieces and do not merge two panels. Parameters that genuinely belong together and change together live together in one designed whole, with a visual whose parts are driven by those parameters.

A device has three presentations of the **same live parameters**:

1. **Compact rack widget** (bottom space, a toolbar of small widgets the person *adds*): title, activator light (only if the owner has an enable operation), a small live diagram, and at most 4 default controls (`compact`). Parameters are always active in their default state whether or not the widget is on the rack.
2. **Expanded** (left Browser column and the contextual pool beneath it): the WHOLE panel — diagram with handles, every parameter and every non-numeric control, grouped as the app groups them. Making changes here never adds anything to the rack.
3. **Full** (centre, the Expressions Studio suite): the app's own panel opened by `studio` section id.

You build the device's **model** (pure facts), its **view** (diagram + switches) and its **tests**. The rack widget and the pool host are generic and are built elsewhere from your model: that is why `compact`, `groups` and `studio` are declared in the model.

### How the pieces work (read these first)

- `nativeFieldFaceModel.ts`, `nativeFieldFaceViews.tsx`, `NativeFieldFace.medium.tsx` + `nativeFieldFace.medium.ts` (the reference implementation of one device), `nativeFieldFaceValues.ts` (`short`, `fieldValue`).
- `NativeFieldHandle.tsx` + `nativeFieldHandleModel.ts`: a reusable in-diagram handle that drives exactly ONE native parameter along a line in SVG space (pointer drag, arrows/PageUp/PageDown/Home, double-click reset, Escape, private-draft custody, one `{kind:'parameter',target:'field.<key>'}` apply on release). `draw(ctx)` receives `{reading, graphValue, position, value(path), family, disabled, apply, captureCurrent, setDraft}`; render `<NativeFieldHandle … onDraft={ctx.setDraft} />` for each handle and use `ctx.value(path)` (it returns the live draft while dragging) to draw the diagram, so the diagram moves with the handle. Never give a handle the same path as `controlPath`.
- `NativeDeviceEditors.tsx` renders your `groups` as titled sections of exact-value controls (`FieldControl` with private-draft custody) beside the diagram, shows the activator light from `enabled`, and hosts `switches` — you do not write value inputs.
- Non-numeric controls are written ONLY through admitted change kinds: `{kind:'field-setting', key}` (mediumEnabled, mediumDimension, mediumPlane, resonanceEnabled, collisionEnabled, pairwiseEnabled, collisionMode), `{kind:'panel-setting', key, value}` (21 keys in `packages/expressions-boundary/src/nativeFieldPanelSettings.ts`: engine backgroundMode, dotShape, volumeProfile, pointerMode, pointerClick, relationalMode, sweepDirection, templateDimension, resonatorMode, focusOrder, grainProfile, volumeEnabled, depthPerspective, depthOcclusion, relationalEnabled, autoSweep; composition frequencyDriver, focus, carryTint, carryStation; scene pointerScope), `{kind:'route-order', entity_ids}`, `morph-setting`, `colour-setting`/`colour-palette`/`colour-background`/`colour-preset`, and glyph `field-font`. Use the exact option lists from that table/`NativeFieldPanelChange` — never invent options. A control the boundary cannot write is shown as a read-only disclosure line ("not writable from the shell yet: <why>"), never a dead control.

### Design rules (the standard — each is tested or reviewed)

1. **Whole panel.** `paths` equals the app panel's numeric registry parameters exactly (assert it in tests against `NATIVE_BINDINGS` by group/path); every non-numeric control of the panel is present in `switches` or disclosed as unavailable. Group order and titles follow the app (`inspector.ts` line cited in your device spec).
2. **Honest visual.** Every drawn element is computed from values in the reading (`ctx.value`) or from the engine's own documented relation (cite the shader/engine line in a comment). Never animate a plausible substitute. The caption says it is a configuration diagram; the Stage shows the physical result. Absent/unknown data states what is missing.
3. **Handles.** At least two in-diagram handles for the panel's principal degrees of freedom (use more where the geometry offers them), each bound to a distinct real parameter, with the existing keyboard/exact-value/reset/undo equivalents (provided by `NativeFieldHandle` + the exact-value grid).
4. **Coupling is real.** If the app couples controls (shared update function, derived value, gating flag), the view shows the coupling (a gated group is visibly disabled with the reason; a derived value is shown as derived). Cite the code.
5. **Real labels and units** from `NATIVE_BINDINGS` (`binding.label`, `unit`, soft/hard ranges). Never prettify opaque paths.
6. **Activator.** `enabled` returns a boolean only if a real owner enable exists for the device; otherwise `undefined` (hollow light). `strip.toggle` only for those.
7. **UI craft.** Shell tokens only (`--bg-0..3`, `--line`, `--text`, `--text-dim`, `--accent`); amber marks focus/interaction; ≥22px hit areas; visible focus; no text overflow at ~700px and 1920px (viewBox scales; text 9–10px SVG labels); every control has an accessible name; `prefers-reduced-motion` respected (no animation unless derived from a real reading).
8. **Compact set.** `compact` lists the ≤4 controls a performer most wants, justified in a comment.

### Tests (`tests/native-device-<key>.test.mjs`, node:test, loader pattern of `tests/native-device-strip.test.mjs`)

Model: `paths` ⟷ registry coverage (exact set equality with the panel's parameters), `groups` cover `paths` exactly with no duplicates, `compact` ⊆ `paths` and ≤4, `controlPath` ∈ `paths` and not used by any handle, `enabled`/`strip.summary` over fixture readings (values must come from the reading), toggle shape. View: SSR render (react-dom/server) of `draw` inside an `<svg>` and of `switches` with a fixture reading: handles present with role=slider and `aria-label`, diagram changes when `ctx.value` changes, each switch emits exactly the admitted change shape when its handler is invoked (call the handlers via a stub `apply`). Follow `tests/native-field-handle.test.mjs` for rendering `NativeFieldHandle` over a fixture.

### Definition of finished

Every Expressions row of the feature map has an outward home in the shell that is built, wired to its existing native operation, covered by tests, and — when the native stack is up — exercised in the live shell. A row is *not* finished because a component exists. Concretely, each device family or surface ships its **admission packet** (standard §Editor admission packet): identity, bound controls with exact native paths, a domain visual derived from the reading, supported native operations only, state/continuation behaviour, and executed acceptance.

Every device face must satisfy: (1) a compact face and an expanded editor; (2) every graphical handle has an exact-value, keyboard, reset and undo equivalent; (3) the visual is derived from the reading and states what it cannot show — no plausible substitutes; (4) real label/unit/range from `NATIVE_BINDINGS`, never prettified paths; (5) an activator light only where the owner has an enable operation (unknown = hollow); (6) accessible names, visible focus, ≥22 px targets, no text overflow at ~700 px and 1920 px; (7) one gesture = one native history entry; (8) base, effective and automated values shown separately.

### Architecture rules (so parallel work stays safe)

- **Field device faces** are registry entries: a pure model file `nativeFieldFace.<fam>.ts` (name, exact-value paths, slider-handle path, enable reading, strip summary/toggle) and a view file `NativeFieldFace.<fam>.tsx` (SVG drawing, switch rows), registered with one line each at the `@face-*` / `@view-*` anchors in `nativeFieldFaceModel.ts` / `nativeFieldFaceViews.tsx`. `NativeDeviceEditors.tsx` and the strip are not edited per family. Writes use the existing `{kind:'parameter', target:'field.<key>'}` change and the existing custody machinery.
- **New change kinds** (modulation, sound, scene, rack, etc.) are an explicit protocol addition: `editor.ts` union, `nativeDeviceEdits.ts` validator+reducer, `hostEditor.ts` admission list, `nativeInputRecovery.ts` where a private draft exists. One writer at a time; each addition is its own packet with its own tests.
- No second store, clock or document. Anything not derivable from a reading is declared unavailable.
- Native stack down is not a blocker for model, view and handle behaviour (tests plus the vite harness over fixture readings); live-shell replay is recorded as pending until the stack is up.

## Honest known limits

- The five agent-shell families' §14 rows are IN the kit through the
  adoption loader (`adoptVerifiedRows()` — identity with the verified
  table, called after the families load; the racks' fidelity-bound cards
  keep their own markup until their lane rebinds it, which is that lane's
  deliberate refactor, not an SDK gap). Quaternal-logic and atlas-earth
  keep their own faces; their owners adopt the kit when they take that
  refactor on.
- `icon-cut.html` is the icon source; the roster in the new-shell lane's
  `glyph-language/` (79 marks) is a prepared, separate system — not wired
  here. One cut, one sync (`npm run devices:sync-icons -- --check` (the `--` matters: without it npm swallows the flag and the command REGENERATES instead of checking)).
- The gap finder is a discovery join over `suite/capability-matrix.json`
  and `suite/product-capabilities.json` — deliberately a catalogue view,
  NOT another capability matrix; the sources stay authoritative.
- The lane's `desktop/cradle` tests carry pre-existing failures (missing
  `visuals/observations` module in this worktree) — not the SDK's; the
  owner lane owns that repair.
- If `tsc --noEmit` reports errors OUTSIDE the sdk tree, they are the
  lane's, not the SDK's — judge the SDK by
  `npx tsc --noEmit 2>&1 | grep 'src/inhabitants/sdk'` (empty = clean)
  plus `vite build`, and name the owning lane in your return. (The
  October 2026 mode-union dirt in `App.tsx`/`WorldBrowser.tsx` was
  repaired by its owner mid-lane; expect such dirt to come and go on a
  shared lane.)
- §16's four-surfaces law is schema-shaped: the manifest cannot carry a
  fifth surface. Panel slots are positions within the four surfaces (see
  the writers-law section above); an exposure that genuinely needs a
  fifth place is a §16 amendment for the owner, not an SDK escape hatch.
- `<tool>:<command>` commands are shape-checked and their tool ids
  membered; the command surface itself lives in each tool's repository —
  a wrong command on a right tool is caught on first exercise, and the
  row's disclosure carries the absence.

## Docking list (from FOUNDATION sec 4)

*Moved verbatim on 22 Oct 2026 from the retired `desktop/cradle/docs/world-shell/wayfinder/FOUNDATION.md` (history: `2a1ccca02`). FOUNDATION-AUDIT is `desktop/cradle/docs/world-shell/audit-20261014/FOUNDATION-AUDIT.md`.*

The contracts are in FOUNDATION-AUDIT §D, "Docking contracts":
- material: `WorldTrackAdapter`;
- instrument: `ProjectionModuleRegistration`, with type and build;
- device: `DeviceDeclaration` + `SdkParamRow`;
- clip editor: `PanelRegistration` slot `clip`;
- transport: `TransportBinding`;
- browser entry: manifest entries with a kind;
- widget: `PanelRegistration` slot `right-dock`.
