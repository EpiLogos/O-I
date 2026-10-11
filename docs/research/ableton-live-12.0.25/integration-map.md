# Integration map — where the Live dynamics work lands in O-I

**Status:** revision 2 (2026-10-11). Part I (revision 1, 2026-10-07) is kept
below unchanged; **Part II** adds the shell-integration map — the Device SDK
contract, the live-mode device surface vs live-dynamics, the exact gap list,
the wiring seam (file:line refs), and the verification recipe for the UI
round. Companion to `README.md` (guardrails) and
`reconstruction-backlog.md` (what lands when).

---

# Part I — the receiving surface (revision 1, kept)

## What exists in O-I today (the receiving surface)

| surface | path | state |
| --- | --- | --- |
| The Cradle (O:I desktop app) | `Work/O-I/desktop/cradle/` | Tauri + Rust kernel (`oi-cradle-kernel`) + React shell (`oi-cradle`) |
| Native-audio playback precedent | `desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/native-audio.mjs` | plays a native owner's PCM; encodes the house rule: **companions never create a second DSP/oscillator/clock owner** |
| Instrument contract | `desktop/cradle/src/instrument/source.ts` (`ql.focused-instrument/v1`) | desktop owns presentation only; the instrument is a QL native concern |
| Nara instrument channel | `desktop/cradle/src/nara/instrumentProtocol.ts` (`nara-instrument`) | bounded channel pattern a future audio channel would mirror |
| RE-dossier precedent | `docs/research/openrig-c8fca9d/` (`BEHAVIOURS.md`, `CROSSWALK.md`) | source-locked external study, "reference study only: no code vendored" |
| Research protocol | `docs/RESEARCH-PROTOCOL.md` | source-lock → study → interpret → compare → operationalise |
| Package convention | `packages/<name>/` with own manifest | independent crates are the norm (no root Cargo workspace) |
| Landing gate | `gates/manifest.json` (`oi.gate-manifest/v1`), run via `node gates/run.mjs landing` | a new Rust crate needs its own gate entries (fmt/clippy/test) per `gates/README.md` |
| CI | `.github/workflows/verify.yml` | path-scoped to `cli/**`, `suite/**`, `surfaces.json`, `schemas/**`; `docs/**` and `packages/**` are **not** CI triggers — no CI edit needed for this lane |

## The gap

There is **no audio-DSP surface anywhere in O-I** — no crate, no cradle panel,
no contract. The cradle's only audio material is the presentation-bounded PCM
playback of a *native owner's* output. The Live dynamics lane supplies the
missing native owner in the form of a clean-room crate whose sole authority is
the behavior documentation in this folder.

## Where things land (exact paths, decided)

1. **RE dossiers + session model + this map** → `docs/research/ableton-live-12.0.25/`
   (this folder; OpenRig precedent: source-locked, no vendored code, reopen-when).
2. **Clean-room Rust rebuilds** → `packages/live-dynamics/` — independent crate
   (own `Cargo.toml`, like `desktop/cradle/kernel`), the **single native owner**
   of the "clean-room device dynamics" audio domain. Its README states the
   clean-room rule: written from `docs/research/ableton-live-12.0.25/` behavior
   documents only; decompiled material never enters the crate.
3. **Verify gates** → golden renders + spectral-distance gates per device, run by
   the crate's own test harness (renders live under the research folder, not the
   crate); a `rust-live-dynamics` entry added to `gates/manifest.json` when the
   crate lands on a branch for review.
4. **Cradle wiring (future, not this lane)** → when the cradle wants these
   dynamics, the pattern is the focused-instrument pattern: a typed contract
   module beside `src/instrument/source.ts`, the crate compiled into the kernel
   (path dependency), the cradle side presentation/receipts only. Per the house
   rule, the DSP owner stays one: `live-dynamics` — the cradle never
   reimplements device behavior.

## Authorship note

This lane's files are generated commissioned work standing in the owner's
repository (working seat). Landing them on a branch / PR is the owner-visible
act that transfers authorship; until then the crate is a proposal in code form
per the authorship law.

---

# Part II — the shell integration map (revision 2, 2026-10-11)

Written for the owner directive: after this round, the device/instrument UIs
must be verified correct in the shell and integrated into the **live** mode of
the new main shell (`packages/live-shell/ui/`). Everything below was read or
run offline from this checkout; nothing here touched Live.

## A. How a device is registered in the SDK (the contract)

The authoring kit is `packages/live-shell/ui/src/inhabitants/sdk/`
(`DEVICE-SDK.md` is the procedure; `scaffold.ts` is the pure generator;
`scripts/scaffold-device.mjs` is its CLI).

**The scaffold CLI contract** — `node scripts/scaffold-device.mjs <family> <owner> <device> <device-title> [icon]`
(`scripts/scaffold-device.mjs:43`). It validates BEFORE writing: family/device
ids are lowercase kebab, the owner is named, the device carries a title, and
the icon is a mark of the cut (`scaffold.ts:47-58`); it builds the declaration
and runs the real gate over it, refusing to scaffold anything that would fail
(`scaffold.ts:203-228`, CLI `:56-60`); it never overwrites (`:62-73`). It
writes exactly three files (`scaffold.ts:232-241`):

1. `src/inhabitants/<Family>FamilyManifest.ts` — a `load<Family>Family()`
   calling `admitFamily({id, owner, browser, paramsGrammar, devices:[{id,
   title, icon, note, params}]})`. The starter carries **readings only** — a
   scaffold never pretends a writer (`scaffold.ts:63-107`).
2. `src/inhabitants/<Family><Device>Face.tsx` — `FacePlate` + `ReadingRow` +
   `Disclosure` over the proven aperture `{reading, disabled, apply,
   captureCurrent}`; the face never dispatches a write of its own
   (`scaffold.ts:109-139`).
3. `tests/<family>-family.test.mjs` — admits through the door, runs the door
   validator + `validateAdmittedWorld`, and asserts every starter row is a
   reading (`scaffold.ts:141-197`).

**The registration data** (`define.ts`): devices carry §14 param rows built by
`numberParam` / `enumParam` / `reading`. **A row without a `writePath` IS a
reading** — that is the grammar. Write paths are `kernel:<op>` (a real op of
the kernel's union, `kernelOps.ts`), `shell.<setter>` (armed by the shell or
declared on the family's `writers` with an authority), or `<tool>:<command>`
(known tools: `workcell-cli`, `ctrl`, `aikit`, `oi` — `kernelOps.ts:152`);
grammar at `validate.ts:49-53`, writers law at `validate.ts:180-201`. Mode
scoping is declarable (`modes: ['live', …]`, per-mode `formats` from
`DEVICE_FORMATS`; live's default format is `chain-plate` — `modes.ts:303-316`;
the five modes at `modes.ts:40`). Already-admitted families compose additively
via `declareDeviceExtension`.

**What `scripts/validate-devices.mjs` checks** (exit 0 = pass; `--json` for
the machine payload):

- the door's manifest law over every admitted family
  (`validateAllInhabitantManifests` — `:49`);
- the SDK world gate `validateAdmittedWorld()` (`:50`) — per-family door
  validator, §14 address grammar + one-owning-address uniqueness, the writers
  law, modulation honesty (a `modulatedBy` must name an admitted telemetry
  observable), transport double-booking (one meaning per mode slot), §12
  product-carving exclusivity, and the kit rows against the verified
  `AGENT_SHELL_ADDRESS_TABLE` (`validate.ts:348-446`);
- icon drift: `sync-icons.mjs --check` (`:52`);
- payload `{families, manifestFaults, sdkFaults, cross, icons, pass}`
  (`:61-68`).

**What `scripts/device-gaps.mjs` reports TODAY** — run offline on 2026-10-11,
exit 0:

```text
device gaps — 91 candidate capabilities (standing filter: partial + claimed-only)
```

The 91 rows distribute as: software-factory 31, no-family-scope 25, actuation
12, ai-kit 9, central 7, quaternal-logic 6, workcell 1. It is a discovery join
over `suite/capability-matrix.json` × `suite/product-capabilities.json` × the
admitted families' faces/params (`device-gaps.mjs:84-85, 96-129`) — a
**shell-capability** view. **No audio/device/DSP capability exists in that
matrix**, so this front door reports nothing about the live-dynamics devices;
the audio-device inventory lives in `devices/COVERAGE.md`. For the device
round, do not expect `devices:gaps` to see the work — that is a real
tooling gap to name, not a hidden one.

## B. Which devices live mode exposes today vs what live-dynamics implements

**Where live mode is defined.** `src/shell/modeGrammar.ts` —
`MODE_GRAMMAR.live` (`:173-224`; mode→spine mapping comment `:23-24`: live →
the shell's audio cut), and `src/inhabitants/sdk/modes.ts` — the SDK's own
live declaration (`:137-156`; `SDK_MODES` `:40`). `App.tsx:65` reads the
frame's mode (`surfModeOf(continuity.mode) ?? 'live'`); live mode composes
the audio BrowserPane (`App.tsx:371`, live only), the one Timeline projection
over the opened set/document, the DeviceChainPanel detail row (`App.tsx:421`,
live only), and the context dock (`App.tsx:414`).

**What live mode exposes today** (from the pool/registry code):

- **BrowserPane** (`components/BrowserPane.tsx:24`): the Devices listing is
  `ctx.set.tracks.flatMap(track => track.devices)` — **only the devices
  present in the opened set**, category-filtered (Instruments / Audio Effects
  / Plug-ins), rows read-only ("insertion requires native device owner",
  `:33`). No device catalogue, no add.
- **DeviceChainPanel** (`components/DeviceChainPanel.tsx:34-46`): one tile per
  track device; every stored parameter renders losslessly read-only
  ("editing awaits the native device owner", `:43`). Its `:44` is the only
  mounted **bottom-slot panel host** in live mode.
- **The device-face family exists as code but is NOT registered.**
  `panels/index.ts:9-15` imports only `context, expressions, knowledge,
  settings, workbench, agentShell`. The three device panel modules
  self-register on import (`registerPanel`, `shell/panels.ts:56`) but nothing
  imports them:
  - `panels/devices/` — Glue Compressor, Echo, Reverb, generic `DevicePanel`
    **live editing through the M3 API** (`devices/index.tsx:30-58`).
  - `panels/devices-pro/` — pro faces + rack faces for Glue, Echo, Reverb,
    Wavetable (wired to the same M3 API) and Operator (local state, "model
    arriving") (`devices-pro/index.ts:51-72`).
  - `panels/devices-b2/` — 12 faithful ports (EQ Eight, Auto Filter, Auto
    Pan, Saturator, Drum Buss, Chorus-Ensemble, Delay, Hybrid Reverb,
    Multiband Dynamics, Utility, Drift, Wavetable), **local state only**
    (`devices-b2/index.tsx:45-56`; README: "persistence wires in with the
    per-device M3 edit API").
  - `components/RightDock.tsx:12` — the `right-dock` host — is **mounted
    nowhere** in the frame; every full device face declares slot
    `'right-dock'`, so those faces have no host today.
- The other device surfaces in the source list belong to other modes, not
  live: `NativeDeviceEditors/NativeDeviceBrowser/NativeDevicePoolView` are
  the native Expressions Field/entity/scene families (physics, medium,
  resonance, contacts, ink, depth, relational, pointer, focus, morph, colour,
  force, formation, sound, meaning, scene, text, automation, blueprint,
  arrange, body — `components/nativeDeviceCatalogue.ts:67-74`);
  `AgentDevicePool/AgentDeviceChain/NativeAgentDeviceRack` are the agency
  chain (gateway → agent → skillset → world → git —
  `inhabitants/agentDeviceCatalogue.ts:33-55`). Neither carries audio devices.

**What live-dynamics implements** (`packages/live-dynamics/src/lib.rs:21-48`):
23 device modules; 16 carry per-sample/coefficient layers — saturator,
overdrive, redux, erosion, gate, limiter, utility, eq8, auto_filter,
filter_delay, compressor, glue, echo, reverb, operator, wavetable — and 7 are
surface-only params structs: beat_repeat, channel_eq, chorus_ensemble,
drum_buss, eq_three, grain_delay, phaser_flanger. `params.rs` carries 15
tables keyed by **document element name** via `params::table()`
(`params.rs:5932`).

**The gap list, name by name** (element name → live-dynamics → shell face):

| element (`params::table` key) | live-dynamics module | shell face (panel module) | face state |
| --- | --- | --- | --- |
| GlueCompressor | glue.rs (render-gated) | devices + devices-pro pro/rack | wired to M3 API; **not registered** |
| Echo | echo.rs | devices + devices-pro pro/rack | wired; **not registered** |
| Reverb | reverb.rs | devices + devices-pro pro/rack | wired; **not registered** |
| Wavetable / InstrumentVector | wavetable.rs | devices-pro pro/rack + devices-b2 | pro wired; **not registered** |
| Operator | operator.rs | devices-pro pro/rack | local state; **not registered** |
| Eq8 | eq8.rs | devices-b2 | local state; **not registered** |
| AutoFilter | auto_filter.rs | devices-b2 | local state; **not registered** |
| AutoPan | *(table only)* | devices-b2 | local state; **not registered** |
| Saturator | saturator.rs | devices-b2 | local state; **not registered** |
| DrumBuss | drum_buss.rs | devices-b2 | local state; **not registered** |
| Chorus2 | chorus_ensemble.rs | devices-b2 | local state; **not registered** |
| Delay | *(table only)* | devices-b2 | local state; **not registered** |
| Hybrid | *(table only)* | devices-b2 | local state; **not registered** |
| MultibandDynamics | *(table only)* | devices-b2 | local state; **not registered** |
| StereoGain | utility.rs | devices-b2 | local state; **not registered** |
| Drift | *(table only)* | devices-b2 | local state; **not registered** |

**No shell face at all** (12 live-dynamics modules): Compressor
(`Compressor2`), Overdrive, Redux, Erosion, Gate, Limiter, FilterDelay,
BeatRepeat, ChannelEq, EqThree, GrainDelay, PhaserFlanger.

**Table-only devices with no Rust module yet**: AutoPan, Delay, Hybrid
Reverb, Multiband Dynamics, Drift (their params.rs tables cite evidence;
their DSP modules do not exist). Conversely, no shell face exists without a
live-dynamics table — the 16 face-covered elements all have tables.

**The API seam the faces build against is referenced but not routed**: the
three endpoints `/api/device-descriptors`, `/api/document/device-params`,
`POST /api/document/device-param` (`panels/devices/api.ts:5-10`) do not exist
in `packages/live-shell/src/main.rs:117-124` (`build_router` today routes
only `/`, `/api/summary`, `/api/document`, `/api/set`, `/api/config`). The
handler-side document reading exists (`api.rs:38` `summary_json`, `:109`
`document_json` — device params from the live-set document); the descriptors
serialization from `live_dynamics::params::table` does not.

## C. The integration path (the seam, with file:line refs)

The seam is the **M3 device-edit HTTP contract** — not the inhabitant door.
Wiring one live-dynamics device end-to-end is mechanical in four steps:

1. **Server** — add the three routes to `build_router`
   (`packages/live-shell/src/main.rs:117-124`) and their handlers beside
   `api.rs`'s `document_json` (`api.rs:109`): descriptors from
   `live_dynamics::params::table(element)`, serialized to the existing
   `ParamDescJson` shape; `device-params` from the live-set document;
   `device-param` POST validates against `stored_min`/`stored_max` and writes
   the set back.
2. **Client** — `ui/src/panels/devices/api.ts` is already the contract:
   `ParamDescJson` (`:14-23`), `deviceDescriptors` (`:46`),
   `fetchDeviceParams` (`:57`), `postDeviceParam` (`:73`). The generic
   `DevicePanel` renders any table (continuous slider + numeric entry,
   discrete menu of stored labels, toggle switch; debounced POST ~150 ms;
   per-control saved/error marks — `panels/devices/DevicePanel.tsx:90-255`).
   `panels/devices-pro/kit.tsx:20-24` `useDeviceEdit` is the same round-trip
   for the ported faces.
3. **Registration (the missing line)** — import `./devices`, `./devices-b2`,
   `./devices-pro` in `src/panels/index.ts` (after `:15`). Each module
   self-registers; `registerPanel` replaces by id (`shell/panels.ts:56`) —
   no frame change needed for the registry itself.
4. **The live-mode host** — bottom-slot panels render inside the live detail
   row's DeviceChainPanel (`DeviceChainPanel.tsx:44`), the one mounted host
   in live mode. Full faces declare `'right-dock'` and need a host: either
   mount `components/RightDock.tsx` in the frame's dock residence
   (`App.tsx:414`) or re-slot the faces. This is the round's one structural
   decision.

**The SDK door as an alternative (named, not recommended).** live-dynamics
devices could also be admitted as a family through the Device SDK
(`admitFamily` in a new `src/inhabitants/<Family>FamilyManifest.ts`; gate
`validate.ts:348`). But the SDK's writer grammar has **no member for a stored
.als device parameter** today: `KERNEL_OPS` (`kernelOps.ts:14`) carries no
device-param op, and `KNOWN_TOOLS` is `workcell-cli | ctrl | aikit | oi`
(`kernelOps.ts:152`). A family admitted there would be readings-only (the
SDK's own honesty posture) until an owner write path is minted. The M3 POST
is that write path and it lives outside the SDK's writers registry — keep the
audio device family on the M3 seam (the faces and the API client already
exist), or mint a kernel op / shell setter to bring it inside the writers
law. Owner's call; the map records both.

## D. The verification recipe for the UI round

All offline gates (run from `packages/live-shell/ui/`), with today's observed
result:

1. `npm run devices:validate` — the world gate. Today, exit 0:
   `admitted families: actuation, ai-kit, atlas-earth, central,
   quaternal-logic, software-factory, workcell` /
   `device gate: PASS (manifests, §14 cross-checks, icon sync)`.
2. `node scripts/validate-devices.mjs --json` — the machine payload. Today
   `pass: true`, 0 manifest faults, 0 sdk faults, 0 cross faults, icons ok.
3. `npm run test:device-sdk` — kit tests + the gate. Today 21/22 pass; the
   one red is the **kernel-op drift gate**: `kernelOps.ts has drifted from
   the kernel's op union (129 ops)` — regenerate with
   `node scripts/sync-kernel-ops.mjs`. That drift is the kernel lane's move
   under the SDK's generated registry, not the device work.
4. `npm run devices:gaps` — the discovery join (91 shell capabilities today;
   it does not see audio devices — see A).
5. `npm run build` (`tsc --noEmit && vite build`) — today 2 pre-existing tsc
   errors outside the device surfaces
   (`src/projections/timelineResidence.tsx` duplicate `WorldTimelineView` ×2,
   `src/shell/nativeContent.ts` duplicate `readNow`); the sdk/panels trees
   are clean.
6. Browser walk: `npm run devices:walk` (`tests/device-sdk.browser.mjs`) —
   the SDK face-kit capture walk (vite on `127.0.0.1:5207`, playwright;
   asserts the plate's mark/title/owner, scalar drag → retained draft, Enter
   acknowledges, the enum cycles, the waiting card names its owner; captures
   to `tests/artifacts/device-sdk/`). **There is no live-mode device-panel
   walk yet** — the round should add one (pattern:
   `tests/support/agentShellHarness.mjs` `launchShell` + a fixture server
   answering the three device endpoints). The closest frame-level coverage
   today is `tests/live-mode-place.test.mjs` (the DeviceChainPanel read-only
   laws) and `tests/mode-grammar.test.mjs`.
7. Rust side: `cd packages/live-dynamics && cargo test` (unit), and
   `cargo test -- --ignored` for the golden gate when
   `docs/research/ableton-live-12.0.25/harness/renders/` is present.

**What "correct" looks like for a device editor** (the editor standard —
`DEVICE-SDK.md` §4, `sdk/controls.tsx`, `NATIVE-EDITOR-STANDARD.md`):

- **Completeness**: one control per stored parameter of the device's
  live-dynamics table — no invented controls, none missing.
- **Lossless reading**: stored values shown verbatim; units from the table;
  menu labels only where the evidence holds them (a `?` renders as the stored
  index with its note — never invented text); "not stored in this document"
  renders as its own honest row, never a fake fill.
- **Writes round-trip**: a moved control POSTs and then shows the value the
  server persisted, with per-control saved/error state; the bound track is
  named; a control that has no owner write says so.
- **Input law**: pointer drag + arrow keys + typed entry; Enter commits,
  Escape cancels; a retained draft stays visibly distinct from the
  acknowledged base (the custody law).
- **Honest state**: an unknown state shows no lit lamp; every colour resolves
  a shell token; a UI flag is never evidence of a native effect.

## What makes the round mechanical (the one-paragraph answer)

The faces and the parameter tables both exist; what is missing is three
import lines, three server routes, and one host. Register
`panels/devices{, -b2, -pro}` in `panels/index.ts`; route
`/api/device-descriptors`, `/api/document/device-params` and
`/api/document/device-param` from `params::table` over the live-set document;
mount the right-dock host (or re-slot the full faces to the bottom host that
already renders in live mode's detail row); then walk each device's editor
against the editor standard above and record the walk. The devices with no
face (Compressor, Overdrive, Redux, Erosion, Gate, Limiter, FilterDelay,
BeatRepeat, ChannelEq, EqThree, GrainDelay, PhaserFlanger) are the round's
second queue — each is a table plus a face away, and the generic `DevicePanel`
renders any table without a line of per-device code.
