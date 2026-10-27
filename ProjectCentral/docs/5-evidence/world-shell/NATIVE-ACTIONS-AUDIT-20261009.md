# Native actions framework audit — Expressions port ledger and the aperture law

Lane `zcode:native-actions-audit-l6`, dispatched by `zcode:world-shell-orchestrator`, 2026-10-09.
Ticket: `wayfinder/tickets/L6-native-actions-audit.md`. Seat: `/Users/admin/Central/worktrees/env-1/o-i`
(READ-ONLY for this lane except new test files named `audit-l6-*.test.mjs`; the seat's ~66 dirty
entries of other lanes' work were preserved — nothing staged, nothing committed, `src/projections/atlas/` untouched).

Standing of this document: **audit record**. It promotes no target of the 126, retires no
`pending-native-stack` field, and touches no ported row's claims. Source checks here never stand
in for native effects; every claim names what would settle it live.

---

## 1. What was audited, and how

- **Ledger read in full:** `EXPRESSIONS-PORT-STATUS.json` at audit start: 213 rows — 136 ported,
  33 partial, 11 owner-op-required, 4 not-ported, 11 studio-only-by-design, 12
  internal-no-outward-need, 6 out-of-scope-other-track; every row `live_replay: pending-native-stack`.
- **Part A sample:** 45 `ported` rows verified in the seat, covering **every surface value that
  carries ported rows** (transport 5/5, stage 7, clip 9, device 11, browser 4, menu 2, rack 3) plus
  the four `ported` rows that claim `boundary_op: null` (quick-guide, about, select-text,
  reveal-param) as a deliberate class check. Per row: (a) the cited component exists and implements
  the action; (b) the cited `boundary_op` is exactly what the code dispatches; (c) no shell-local
  store or invented verb hides behind the UI.
- **Mechanical cross-check** (runs green, re-runnable): `packages/live-shell/ui/tests/audit-l6-wire-grammar.test.mjs`
  — five checks asserting that every stage command the shell builds is in the hosted frame's
  `STAGE_COMMANDS` vocabulary; every editor operation the shell's request layer sends is in the
  retained receiver's allow-list (`hostEditor.ts`); every change kind any shipped face dispatches is
  applied by some owning boundary reducer; the agent gateway control rides the kernel-typed
  `harness_agent_control` op and verifies its outcome kind; and the transport model produces only
  scene actions the owner union admits.
- **Live attempt** (Part C, §4): headless drive of the real shell App over the running stack.
- **Family manifests' door:** `packages/live-shell/ui/src/inhabitants/` audited for bypassing actions.

## 2. Part A — adherence verdicts

**Totals: 45 sampled, 45 adhere, 0 deviate, 0 unverifiable-statically.** Every sampled row's
component exists, dispatches the exact claimed grammar, and shows the custody/receipt discipline.
Uniform caveat: all verdicts are static; the native effect of each row remains
`pending-native-stack` until its live replay.

Representative verification chain (one per grammar family; all sampled rows verified the same way):

| Row(s) | Claimed boundary_op | Verified dispatch site | Custody / receipts |
|---|---|---|---|
| toggle-play, play-journey, previous, next, choose-scene | `scene request action=play\|pause`, `play-saved\|stop-saved`, `focus scene_ref` | `NativeTransportBar.tsx` → pure model `nativeScenePlayback.ts` → `nativeContent.ts` `scene()` sends `{operation:'scene', basis, intent_epoch, action}`; union `NativeSceneEditorRequest` (editor.ts:186); receiver `hostEditor.ts:481` with an action allow-list (line 312) | intent_epoch carried; reply adopted only while captured presentation is current; playing state read from the owner reading, never a shell clock |
| save-scene / save-next / restore-scene | `scene action=save-snapshot next=…`, `restore-snapshot` | `NativeSceneEditor.tsx` snapshot() on the captured basis + intent_epoch; membership-complete guard | refuses incomplete membership; owner's snapshot workflow reused |
| new-scene, journey-settings | `scene-edit intent operation=add / expression-title` | `nativeSceneList.ts`, `nativeSceneFace.scene.ts` via `{operation:'scene-edit', basis, intent_epoch, native_selection, intent}`; union `sceneEdits.ts` | exact native selection required for composition-level intents |
| select-entity, set-glyph, delete-entity, undo, capture-step-state | `select entity_id`, `step-source`, `entity-remove` → membership cut, `operation=undo`, `step-overrides capture` | `NativeWorldDetail.tsx`/`nativeContent.ts` select; `GlyphSequenceEditor.tsx`; `nativeEntityFace.formation.ts` → `nativeFormations.applyNativeObjectChanges` → `kernelComposition.ts` scene_compose cut + entity_remove only when no Scene carries it; `history('undo')` → receiver owner commit | lock/blueprint guards; one DocumentStore change per gesture; kernel grammar preserved |
| native-palette, add-palette, palette-invert/random | `colour-preset palette_id`, `colour-palette colors=[2–8 hex]` | `NativeColourField.tsx` + `nativeColourController.ts` pre-validate with the SAME validator the reducer uses; `nativeDeviceEdits.ts` applies via the catalogue writer `applyPalette` and reasserts only the four admitted engine paths through writeShared | foreign operands refused; double-write per target refused; atomic clone+validateJourney |
| force-kind, edit-morph, material, toggle-global | `force-mode`, `morph-setting` → `engine.{key}`/`morph.law`, `field-material`, `shared-setting` | `NativeDeviceEditors.tsx`, `NativeMorphDrive.tsx`, `NativeFieldFace.ink.tsx`, device reducer branches — exact kinds, exact sharing law | effective-value law honoured for automated targets; entity locks respected |
| move-text, scene-body-image, blueprint | `text-layer-set`, `scene-material body set carrier=image_media`, `blueprint request intent` | `nativeSceneFace.text.ts` (one in flight, drafts retained on refusal with Retry/Discard), `NativeSceneFace.body.tsx` (`operation:'scene-material'`), `NativeSceneFace.blueprint.tsx` (`{operation:'blueprint', basis, intent}` bind/release/transform) | carrier options disclose resolvability; refusals surfaced |
| load-saved, entry-open | host command `open-expression ref=<ref>` | Browser row → `workspace.requestExpression(ref)` → `panels/expressions.tsx` → boundary `host.ts` `sendOpen` (`open-expression`, with recovery binding when held) | ref-addressed, never an index; pending open queued until the frame announces |
| confirm-belt-add, import-favourites, pin-entity, belt-up | `chosen-add key scope [entity_id|field|selected]`, `chosen-order entry_ids` | `nativeBrowserModel.ts`, `nativePinMode.ts`, `NativeChosenControls.tsx` → apply batch on captured basis | the chosen-controls family rides the authoritative toolbelt grammar (no shell pin store) |
| native-save | editor request `operation=save` on the captured basis | `NativeTransportBar`/`NativeDeviceEditors`/`GlyphSequenceEditor` → receiver `owner.save()` | "Saved" only from the owner's reply reading |
| tool-select, view-2d, native-reset, present, capture-image, export-json, import | stage commands `command=tool|view|engine|present|capture|export|import` | `src/native/stageCommands.ts` builders → boundary `stageCommand()` (correlating req, epoch-keyed pending, timeout) → frame `app.ts runStageCommand` case dispatch, replying `stageReplyMessage` | frame refuses rather than flips (double-start, unconfirmed reset: `stageRefusal`); aria states read from the frame-published state, "no toggle claims a state it cannot read" |
| quick-guide, about, select-text, reveal-param | NONE | Guide/About render app text with drift tests; text-layer selection is local focus, noted "read-only: writes no document"; reveal-param opens the owning device panel through the admitted open-device event | honest no-native-effect rows: the absence of a boundary op is itself disclosed |

**Parallel-store check:** no sampled row keeps a domain value of its own. The local states that do
exist are presentation, disclosed as such in code and ledger notes (the transport's `armed` flag
decides what Play does and is never a document value; the scrub draft never reaches the owner until
release; `takeMode` mirrors the frame's reading).

**Deviation watch — one build fault, not an aperture fault:** the seat's working tree cannot build a
whole-App bundle right now: the untracked, in-flight `desktop/cradle/src/surface/projectionPane.tsx`
(another lane's work) imports `isProjectionPaneKind` from `projectionModules.ts`, which imports it
from `./types` without re-exporting it. Recorded here for that lane; the audit's live run bridged
exactly this one line with a loader-only re-export (§4).

### The five family manifests' door (src/inhabitants/)

- The door is neutral and enforcing: `familyManifest.ts` admits a manifest by id and **refuses
  re-admission with different contents**; no family name appears in the door.
- All five product manifests (central, actuation, ai-kit, software-factory, workcell) declare
  browser categories, faces, projections, inspectors, time and telemetry through
  `admitFamilyManifest`; the atlas family self-admits at the same door (the concurrent lane's
  additive import).
- The agent device chain is **derived from the door** (`agentDeviceCatalogue.ts` reads
  `allFamilyManifests()`; an unadmitted face drops out; a slot with no admitted faces drops out).
- **No bypass found.** The families' writable controls name their exact writers in
  `agentParamAddresses.ts`: `kernel:harness_agent_control` (kernelOp, typed in
  `desktop/cradle/src/kernel/types.ts:298`, outcome kind verified client-side in
  `src/agent/harnessAgentControl.ts`), `shell.setEffort/setSteer/setHeartbeat/setWriteArm` (the
  shell's own session state — the shell is the declared owner of those controls, per the table's own
  header law), `workcell-cli:…`. Rows without a writePath are readings with explicit
  absence disclosures ("spend_ledger has no writer in O-I — the meter discloses absence";
  "protocol_read is available but unwired — the route discloses absence"). This is the aperture
  law applied to the agent shell.

## 3. Part B — the open rows driven

Ledger counts after this lane: **partial 33 → 24, owner-op-required 11 → 20** (213 total preserved;
no ported row touched; no `live_replay` field retired).

**Reclassified partial → owner-op-required (9), each noting the owner precisely.** preset-browser,
keep, native-library, modes, start-mode, open-featured, load-built-in, entry-starter-mark: the only
remaining gap is the native **save_as/fork owner operation** (the same shell-callable ops the ledger
records under native-save-file and fork-saved; kernel owner). library: the unshown New/Import/file
sections are gated on the create/import/saved_works-admission owner ops already named in rows
new-journey, import-legacy and native-open-file. The live run (§4) observed the fork-refusal
disclosure verbatim in the running browser — the read-only listing with disabled Open rows is the
honest state.

**Owner-blocks recorded on partial rows (kept partial).** automation-play (retained app frame
handler + live-stack ordering), automation-loop (retained app frame handler), studio-section
(retained Studio chrome, by design), native-kundalini-sequence (expressions-boundary apply grammar:
one batch is inexpressible while the boundary mints step ids inside apply — the boundary editor
owner's call), show-monitor and monitor-formation (retained engine + boundary reading producer:
live monitor output is not in `NativeEditorReading`), save-video (retained frame: the browser
requires the download click inside the frame). tool-text and tool-orbit: shell side re-verified;
remaining gap is a live replay / a frame-side mode the app never holds. native-retry-open: named as
shell feature work (a Retry affordance re-issuing the existing open-expression command), not an
owner block — not built here because the lane's seat is read-only beyond tests. The ten shell
feature-work rows (place-formation, tool-formation, objects, image-suite, source-new, source-image,
layer-add, place-keyframe, source-entity, sequence-entity) were re-confirmed with their remainders
named; no owner block applies to them.

**not-ported rows (4) — owner-blocks sharpened.** select-all (the editor select grammar addresses
one entity; multi-select needs a boundary grammar extension plus a shell control — neither
invented), monitor-mode and monitor-dock (gated on the same missing telemetry reading),
tune-station (needs an admitted station-set change kind from the resonance owner).

**owner-op-required rows (the original 11) — confirmed; live evidence added where the run produced
it.** new-journey and entry-new: the audit proved **the kernel create op exists and answered live**
(receipt in evidence), so their notes now say precisely: the gap is the shell-side New control plus
the owner's admission policy for shell-created works — the owner decision these rows record stands.
fork-saved reconfirmed (the only boundary fork remains material saveReusable). delete-saved's owner
named (the saved-works store owner: a removal op callable from the shell). The rest (native-resolve,
native-retry-file, native-save-file, native-open-file, add-built-in, import-legacy, chakra-add) were
checked against their cited seams and stand as recorded.

## 4. Part C — the live replay attempt (honest, not executed)

Everything attempted against the **running** stack: walk-bridge `127.0.0.1:4179` (PID 88442) and
live-shell backend `127.0.0.1:8788` (PID 88740) were up at attempt time and were **not started,
stopped or restarted**. Evidence: `evidence/native-actions-audit-l6-20261009/`
(`live-replay-receipt.json` + five screenshots), driver
`packages/live-shell/ui/tests/audit-l6-live-replay.test.mjs`.

Method: the F2 harness pattern (`tests/agent-shell-live.browser.mjs`) — bundle the real App entry
(main.tsx's exact tree, real providers, no stubs), serve it from a throwaway harness page whose
`/api/config` is the **running backend's own config** (bridge pinned to the running bridge), and
proxy every other path to the running backend so the hosted Expressions frame loads same-origin.

What executed, in order (all recorded):

1. **The real shell App booted over the live bridge**, presented its working surface, and the
   Expressions inhabitant mounted. With the real config the foundation's world/workcell guard
   qualified (the synthesized-config run before it disclosed the guard banner — the admission gate
   demonstrably gates).
2. **The owner's expression home answered EMPTY** — `POST 4179/op {op:'expression',
   request:{operation:'list'}}` → `{expressions:[], schema:"oi.expression-list/v1"}`. The decisive
   stack gap: the walk-bridge's owner holds no expressions (the retained works of earlier sessions
   lived on the previous bridge, not running).
3. **A lane-named scratch expression was created through the kernel's own create op**
   (`expression:audit-l6-replay-scratch`, actor `agent:zcode:native-actions-audit-l6`; kernel event
   receipts recorded). Precedent: the programme's colour/morph native proof ran scratch-only against
   the live owner and left it standing; this scratch likewise stands, disclosed in the browser.
4. **The live browser disclosed the scratch work** ("1 expression"; the row's title carried
   `expression_ref · revision 1`), and clicking it **routed the open** — the hosted frame's iframe
   loaded with `expression=expression%3Aaudit-l6-replay-scratch`.
5. **The replay point was never reached.** The hosted frame booted and announced itself
   (`oi-kernel-hello` ×2, `hello`, `oi-app-state` ×5, `nara-instrument` — all inbound; zero
   outbound host→frame messages recorded), but the host's handshake announcement
   (`oi-kernel-channel`, `host-mode`, native `available`) never landed in this harness boot, so the
   frame stayed "Native owner (loading…)", no qualified native editor reading existed, and the
   shell's native Scene transport — which renders only on that reading — never presented.

**Named impossibility.** A live replay of `scene action=play|pause|focus` could not honestly
execute because no qualified native editor session existed at the replay point. The missing stack
pieces, precisely: (a) an expression home with a work — supplied during the attempt via the owner's
own op; (b) the host→frame handshake in the harness boot — the one piece that failed; its precise
interior cause (StrictMode double-mount handshake ordering, or an artifact of the throwaway harness
vs the dev server) is the retained-host lane's to settle in minutes with the Vite dev server against
this same backend+bridge, repeating the identical drive. What would retire the rows: that replay —
`editor:request {operation:'scene', action:'play'|'pause'}` on the wire with the owner's
`editor:result` reading.

Additionally named: the **take START** (row record-properties) was deliberately not fired even had
the transport presented — it records authored tracks into the owner document, a write into live
shared work; it needs a scratch work with chosen properties on a qualified native session.

Harness honesty note: the bundle carried a recorded loader-only shim appending
`export {isProjectionPaneKind} from './types';` to `projectionModules.ts` — one re-export line of
the module's own import, bridging the in-flight surface lane's missing re-export so the real App
could build at all (§2). No editor, transport or boundary path was touched. The receipt's first
version also recorded a driver bug (a Node-side helper referenced inside a page evaluate); fixed and
re-run — the final receipt is fault-free.

## 5. What stayed unverified

- **Every native effect.** All 136 ported rows remain `live_replay: pending-native-stack`; source
  checks here promoted none of them and none of the 126 targets.
- The transport/take family replay (§4) — attempted, not executed; the named handshake gap is the
  blocker, and the take START additionally needs a scratch-with-chosen-properties session.
- The frame-handler bodies (`app.ts runStageCommand` automation/take/tracks branches) beyond their
  dispatch grammar — not unit-testable from the shell harness (owner-blocks recorded).
- Live monitor output, station writes, multi-select grammar — owner-blocked as recorded in §3.
- The interior cause of the harness handshake gap (§4) — named for the retained-host owner.
- The audit sampled 45 of 136 ported rows; the unsampled 91 were not re-verified by this lane
  (their claims stand as landed, untouched).

## 6. Artifacts

- Ledger: `EXPRESSIONS-PORT-STATUS.json` (rows and counts updated as §3; standing note appended).
- Report: this file.
- Tests: `packages/live-shell/ui/tests/audit-l6-wire-grammar.test.mjs` (5/5 pass),
  `packages/live-shell/ui/tests/audit-l6-live-replay.test.mjs` (driver + receipt writer).
- Evidence: `evidence/native-actions-audit-l6-20261009/` — live-replay-receipt.json, five
  screenshots (shell chrome, presented App with the disclosed scratch row, the "Native owner
  (loading…)" state).
- Standing scratch in the live owner: `expression:audit-l6-replay-scratch` (named, lane-attributed,
  deliberately left standing after the programme's scratch-only precedent).
