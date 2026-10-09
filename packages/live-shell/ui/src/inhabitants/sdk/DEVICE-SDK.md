# The Device SDK — how agents (and humans) build devices for the shell

Standing: **device-sdk v1, 9 October 2026**, by `agent:zcode-device-sdk` on
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
| Four surfaces and nowhere else; honesty (writePath only with a real writer; waiting faces carry no body) | WORLD-SHELL-DESIGN §16, the door's validator | `validate.ts`, run pre-admission AND as CI |

## The modules

```
src/inhabitants/sdk/
├── icons.ts          GENERATED — the cut's 50 marks + renderIcon (never hand-edit)
├── Icon.tsx          the icon law as a component (<Icon name size title/>)
├── define.ts         the authoring kit: admitFamily / declareDeviceExtension /
│                     numberParam·stringParam·boolParam·enumParam·reading,
│                     presentation + §14 row registries (reset with the door)
├── validate.ts       the gate: per-device checks, family checks, the world gate
│                     (§14 uniqueness, ownership-map contradictions)
├── controls.tsx      FacePlate · ScalarParam · EnumParam · BoolParam ·
│                     ReadingRow · Lamp · Disclosure · WaitingFace ·
│                     useFaceDrafts (base vs draft vs standing)
├── sdk.css           the face language — every value resolves an existing
│                     shell token; --sdk-* only NAMES the resolutions
├── scaffold.ts       pure generator for a new family's three files
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
reading** — that is the grammar, not a convention. A declaration that
breaks the law throws at admission, naming each fault.

Already-admitted family, new faces? Compose, never rewrite the owner's
base:

```ts
declareDeviceExtension({id: 'acme:world-shell', by: '<your lane>', family: 'acme',
                        devices: [/* … */], detachedKinds: ['object']})
```

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
      <Disclosure title="Probe" ref="acme:probe" owner="Acme Instruments" />
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

- The kit's presentation registries hold kit-declared faces only; the five
  agent-shell families and QL predate the kit — the world gate validates
  their manifests and cross-checks the address table, but their plates
  render through their own components until their owners adopt the kit.
- `icon-cut.html` is the icon source; the roster in the new-shell lane's
  `glyph-language/` (79 marks) is a prepared, separate system — not wired
  here. One cut, one sync (`npm run devices:sync-icons [--check]`).
- The gap finder is a discovery join over `suite/capability-matrix.json`
  and `suite/product-capabilities.json` — deliberately a catalogue view,
  NOT another capability matrix; the sources stay authoritative.
- The lane's `desktop/cradle` tests carry pre-existing failures (missing
  `visuals/observations` module in this worktree) — not the SDK's; the
  owner lane owns that repair.
