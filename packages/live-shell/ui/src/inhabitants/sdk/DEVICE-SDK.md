# The Device SDK — how agents (and humans) build devices for the shell

Standing: **device-sdk v1.1, 10 October 2026**, by `agent:zcode-device-sdk` on
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
                        devices: [/* … */], detachedKinds: ['object']})
```

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
