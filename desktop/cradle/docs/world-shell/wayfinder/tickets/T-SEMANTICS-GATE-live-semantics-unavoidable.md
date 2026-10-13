# T-SEMANTICS-GATE — Every device declares its Live semantic; the gate refuses otherwise

Label: wayfinder:task (Phase 1 — before any new device work)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder: haiku ×1)
Blocked-by: —

Zones: `packages/live-shell/ui/src/inhabitants/sdk/` (`modes.ts` vocabulary,
`define.ts`, `validate.ts`), `packages/live-shell/ui/src/inhabitants/manifest.ts`
(the face declaration type), every `*FamilyManifest.ts` / extension module in
`packages/live-shell/ui/src/inhabitants/` (add the field to existing faces),
`packages/live-shell/ui/scripts/validate-devices.mjs`, tests.

## Question

Make DEVICE-SEMANTICS-LOCK.md §5 law: add `liveSemantic` to the face
declaration from the closed vocabulary of the lock's §1; gate it (required,
mode-legal per §2, invariants per §5.3, format compatible per §5.4, Live
exemplar pointer per §5.5); declare it on every existing face per the lock's
§2 tables; emit the semantic registry from `devices:validate --json` and lock
it with a test (§5.6).

## Acceptance

- A face without `liveSemantic`, with an unknown one, an illegal mode or a
  broken invariant is refused at admission with the fault named (tests show
  each refusal).
- Every admitted face carries its semantic; `npm run devices:validate` exits 0;
  `npm run test:device-sdk` green; tsc zero; lane suites green.
- The registry snapshot is committed and test-locked.
- No face changes its behaviour — this is declaration and gate only.

## Lead's design (13 Oct 2026) — the builder executes this, decides nothing

**Scope.** The door's admitted world: the 38 faces `devices:validate` loads
(actuation 5, ai-kit 5, atlas-earth 4, central 7, quaternal-logic 7,
software-factory 6, workcell 4) plus Central L7's `day-now`. The Expressions
manifest (`src/expressions/expressionsFamilyManifest.ts`, 22 faces, not at
the door) and the Live devices-pro panels are **out of scope** — carried as
T-SEMANTICS-EXPRESSIONS (they get their semantics when the Studio sections
become chain devices, lock §4.8).

**New module `src/inhabitants/sdk/semantics.ts`** — pure; imports nothing but
types from `./modes.ts`.

- `LIVE_SEMANTICS` (closed vocabulary, lock §1 + §3; `stop` is Live's Scene
  row per lock §9.1 — in the DLW "scene" is an Expression's clip):
  `set, session-view, arrangement-view, track, clip, stop, launch-follow,
  device-instrument, device-audio-fx, device-midi-fx, rack, macro,
  device-chain, browser, groove-slot, detail-clip, detail-device,
  transport-slot, return, automation, modulation, capture, link, key-map,
  info, view-selector, pack, status`.
- `SemanticInvariant` (all optional; which are required depends on the
  semantic): `generates` (write path) | `generatesAbsent` (honest absence
  naming the owner it waits for); `transforms`, `replaceReceipt` (write
  path); `chains[]`, `chainSelector`; `maps[] {key, range: [min,max] |
  string[]}`; `material`, `revision`, `states[]`; `stream`; `launches[]`;
  `routesTo` (write path).
- `isWritePath` moves here; `validate.ts` re-exports it unchanged.
- `LEGAL_SEMANTICS_BY_MODE`: every semantic is legal in `live`; `base`,
  `factory`, `expressions` admit everything except `device-midi-fx`;
  `techne` admits everything except `device-midi-fx` and `device-audio-fx`
  (a Technē chain device is an instrument, lock §5.2). `return` is legal in
  every mode (the Return carries routing outside Live, lock §4.3).
- `FAMILY_HOME_MODES`: actuation, ai-kit, software-factory, workcell →
  `factory`; central → `base`; quaternal-logic, atlas-earth → `techne`.
  Modes checked = the face's declared modes, else the family's home modes,
  else none (vocabulary + invariants still apply).
- `LIVE_EXEMPLARS`: semantic → pointer under
  `Work/reverse-engineering/ableton-live-12.0.25/` (device-instrument →
  `devices/operator-voice.md`; device-audio-fx → `devices/reverb.md`;
  device-midi-fx → `devices/arpeggiator-derivation.md`; rack, macro,
  device-chain → `devices/racks-session-model.md`; launch-follow →
  `devices/follow-action.md`; modulation → `devices/mod-matrix.md`; set,
  stop → `session-model.md#2`; track, return → `session-model.md#3`; clip →
  `session-model.md#5`; automation → `session-model.md#5`; transport-slot,
  link, capture, key-map → `lom/LOM-INVENTORY.md`; browser, groove-slot,
  detail-clip, detail-device, info, view-selector, session-view,
  arrangement-view, status, pack → `ui/UI-EVIDENCE.md`).
- `FORMAT_SEMANTICS`: `die` and `instrument-face` → `device-instrument`
  only; `run-viewer` → `track` or `arrangement-view`, and only in `factory`;
  `chain-plate`, `scene-strip`, `tool-tile` → any. Checked only where a
  format is declared (the mode default is not imposed — no behaviour change).
- `validateFaceSemantic(face, {family, modes?, formats?}) → string[]`,
  faults written `<family>/<face>: …` naming the law and the fix:
  missing/unknown semantic; illegal in a mode; invariant broken
  (device-instrument: `generates` is a write path or `generatesAbsent` is
  non-empty — waiting faces exempt; fx: `transforms` non-empty,
  `replaceReceipt` a write path if present; rack: chains ≥1 + chainSelector;
  macro: maps ≥1, each with a range; clip: material + revision + states ≥1;
  track: stream; stop: launches ≥1; return: `routesTo` a write path); an
  invariant field that does not belong to the semantic; an incompatible
  format.

**Wired at every door** (refused at admission, fault named):
`familyManifest.ts` `admitFamilyManifest` (throws with the faults);
`manifest.ts` `declareFamilyExtension` (validates the extension's faces
before composing) and `validateInhabitantManifest`; `sdk/define.ts`
(`DeviceDeclaration` gains `liveSemantic` + `invariant`; `buildFaces`
carries them and `modes`). `FamilyFaceDeclaration` gains `liveSemantic`
(required in the type), `invariant?`, `modes?`.

**World gate (`validate.ts` `validateAdmittedWorld`)**: re-run
`validateFaceSemantic` with each face's presentation `modes`/`formats`
(`facePresentation`); a macro's `maps[].key` must be a row of the same
family; a `shell.` routesTo/generates must be armed (`ARMED_SHELL_SETTERS`
or the family's writers), a `kernel:` one a known kernel op, a tool one a
known tool. `semanticRegistry()` emits every face `{family, face, kind,
liveSemantic, modes, formats, invariant, writePaths, exemplar}` sorted by
family/face.

**Registry**: `scripts/validate-devices.mjs --json` includes `registry`;
`--write-registry` writes `src/inhabitants/sdk/semantic-registry.json`;
`tests/live-semantics.test.mjs` regenerates and deep-equals it, and shows
each refusal (missing, unknown, illegal mode, each invariant, format) at
each door.

**The per-face table:**

| Family/face | liveSemantic | invariant |
|---|---|---|
| actuation/gateway | return | routesTo `kernel:harness_agent_control` |
| actuation/gateways-rack | rack | chains hermes, aikit-agency-gateway, actuation-frank, remote-carrier; chainSelector `gateway` |
| actuation/harness-model | device-instrument | generates `kernel:harness_agent_control` |
| actuation/experiment | capture | — |
| actuation/frames-monitor | status | — |
| ai-kit/skillset-rack | rack | chains skill-device; chainSelector `skill (admit light)` |
| ai-kit/skill-device | device-audio-fx | transforms "the agent turn passing the skillset chain (the turn passes on)" |
| ai-kit/knowledge-route | device-audio-fx | transforms "the agent's context reach (knowledge bounds on the World device)" |
| ai-kit/agency-gateway | return | routesTo `kernel:harness_agent_control` |
| ai-kit/capture-skill | capture | — |
| atlas-earth/globe-engine | device-instrument | generatesAbsent "the corpus provider seam (C2) has no owner op yet; the globe forms from the bound CorpusProvider bundle" |
| atlas-earth/graph-tools | detail-device | — |
| atlas-earth/mode-switch | view-selector | — |
| atlas-earth/time-control | transport-slot | — |
| central/context-world | device-audio-fx | transforms "the agent's context: Central ground reads and context writes" |
| central/agent-identity | info | — |
| central/ground-hygiene | device-audio-fx | transforms "the ground in focus — analysed, passed unchanged" |
| central/impact | device-audio-fx | transforms "the selected folder or note — its neighbourhood read, passed unchanged" |
| central/day-die | device-instrument | generates `kernel:receiving` |
| central/flow-document | clip | material "the Flow document (Dialogue · Flow · Journal)"; revision "CAS revision (central.files.write)"; states draft, saved, edited since save |
| central/nara-conversation | device-instrument | generates `kernel:nara_dialogue` |
| central/day-now (L7) | transport-slot | — |
| quaternal-logic/sky, torus, m3-clock, deck, chakra, m-prime-matrices (waiting) | device-instrument | — (waiting: generates exempt) |
| quaternal-logic/ql-instrument | device-instrument | generates `kernel:native_expression` |
| software-factory/agent-custody | macro | maps autonomy → [suggest, review, auto] |
| software-factory/context-write-mode | return | routesTo `shell.setWriteArm` |
| software-factory/ledger | track | stream "the Factory ledger (main-track receipts)" |
| software-factory/approvals | return | routesTo `kernel:harness_agent_control` |
| software-factory/run-device | track | stream "the Factory run (one session's task stream)" |
| software-factory/attempt-review | capture | — |
| workcell/git-seat | return | routesTo `workcell-cli:git commit` |
| workcell/remote-carrier | link | — |
| workcell/link | link | — |
| workcell/seat | return | routesTo `workcell-cli:seat land` |

Test fixtures that admit families (device-sdk, inhabitant-manifest,
agent-family-manifest, agent-native-p0, timeline-time-spine, central-family-l7,
ql-musical-family tests) gain `liveSemantic` on their faces; no assertion
about behaviour changes. `scaffold.ts` / `scripts/scaffold-device.mjs` emit a
`liveSemantic` slot; `DEVICE-SDK.md` documents the field.

## Resolution

**Landed (13 Oct 2026, lane `dlw/phase1-semantics-20261013`; builder haiku ×1,
converged by the lead).**

- `src/inhabitants/sdk/semantics.ts`: the closed vocabulary (28 semantics),
  invariants, mode legality, format rules, Live exemplar pointers, family home
  modes; `isWritePath` moved here from `validate.ts` (re-exported unchanged).
- Refused at every door, fault named: `admitFamilyManifest`,
  `declareFamilyExtension`, `validateInhabitantManifest`, `admitFamily`,
  `declareDeviceExtension`; the world gate (`validateAdmittedWorld`) re-checks
  with presentation modes/formats, macro rows of the same family, and armed
  write paths.
- Every door face carries its semantic per the design table (39 incl.
  `central/day-now`); `devices:validate --json` emits the registry;
  `src/inhabitants/sdk/semantic-registry.json` is test-locked.
- Lead addition: the 22 Expressions faces (`src/expressions/expressionsFamilyManifest.ts`
  `EXPRESSIONS_FACE_SEMANTICS`) — physics, glyph, sound are the instrument
  (`kernel:native_expression`); field and entity devices are effects that keep
  the stream; resonance and Body 3:3 modulate (never generate, D13);
  automation is automation; a scene is a clip at its document revision. So
  T-SEMANTICS-EXPRESSIONS is not needed as a separate ticket; the Expressions
  manifest is not at the door, so its faces are validated through the schema
  (inhabitant-manifest test), not in the door registry.
- Checks (scripted, re-run by the lead): `tsc --noEmit` 0;
  `devices:validate` PASS; `test:device-sdk` 22/22; live-semantics 14/14;
  inhabitant-manifest + expressions-family-manifest 19/19; the admitting
  suites green; full suite adds no failing file (the baseline's 10 files stay
  red for their own reasons — see PATH §9).

**Unverified:** none with a UI leg. `day-now` is admitted by the gate and
the test, not by the production loader (unchanged behaviour).
