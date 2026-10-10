# Expressions boundary and candidate mount — 2026-10-07

Standing: implemented in shared seat `env-1/o-i`, branch
`agent/o-i-20261007-1639`; no child commit. Candidate HEAD observed at return:
`214df508973b49b88b59465e2b47e98cd5919f59`. The integration parent owns the
campaign checkpoint, NOW return, source-wide build and native UI acceptance.

## What is prepared and running

The shell's `world.expressions` registered center panel mounts the actual
candidate Expressions bundle once. Expressions/deep mode changes post the
existing mode channel over that same iframe. It preserves native refs,
selection readings and the application's own scene/document/controls.

The package imports the existing kernel bridge, native save/CAS/readback
family, source readers, library, Wiki/deep/constellation owners and Nara/Epii
facade. Empty native inventories prepare/open the owner's actual Wiki
projection through `ensureWikiNativeExpression`; existing native work wins.
No demo work, second semantic store, second globe or captured asset is used.

Running candidate:

- `http://127.0.0.1:5176/app/` — UI Vite, persistent tty session `8049`.
- `http://127.0.0.1:8788/` — candidate backend, tty session `13997`.
- Native host configured explicitly as `http://127.0.0.1:4180`.
- Real set: `/Users/admin/Music/Ableton/User Library/Templates/Piano and voices mastering.als`.
- Candidate `/api/document` read: tempo 131, eight Scenes, 21 tracks.
- `/api/config` preserves `default_set`, adds `kernel_bridge` only when
  `LIVE_SHELL_KERNEL_BRIDGE` is explicitly set.
- `/__application/expressions/index.html` is the seat's own built asset.
  Direct backend and Vite-proxied index both match its SHA-256:
  `10e96d306f0f83d92ecf122c30101dd4020c053f312df751281d4ec89cccebde`.

`packages/live-shell/src/api.rs` was consumed verbatim from the owner's
landed source, not reimplemented. Both source copies hash to
`fd91bbfa6b1662d8b1de9b41255efd8766accea95d1bd9bbff1f66bd92e7b1a7`.
Its contract supplies tracks, arrangementClips, sessionSlots, device params
and bounds. It supplies no mixer/routing/user-color fields yet.

## Executed checks

| Command | Evidence and limits |
|---|---|
| `npm --prefix packages/expressions-boundary test` | 10/10 passed; actual controller over Node MessageChannels, including malformed/foreign messages, readiness, reload/dispose, duplicate requests, hidden/stale target, private recovery scope, native lease lifetime and canonical Action routing. Protocol evidence, not native UI/save acceptance. |
| `npm --prefix packages/expressions-boundary run check` | Passed; canonical imported types and Cradle declarations. |
| `npm --prefix packages/expressions-boundary run test:native -- --kernel-url http://127.0.0.1:4180` | Grade B, 2/2 passed: real kernel Expression inventory and missing-subject inspection, native results/refusal preserved unchanged. Inventory was empty during the probe. |
| `CARGO_BUILD_JOBS=2 cargo test --manifest-path packages/live-shell/Cargo.toml` | 10/10 passed, including actual built application serving, traversal refusal, no primary-tree fallback, preserved summary and imported deep-document routes. |
| `CARGO_BUILD_JOBS=2 cargo build --manifest-path packages/live-shell/Cargo.toml` | Passed; running binary serves the candidate assets/API. |
| Same-origin HTTP checks on 8788 and 5176 | Real config/document served; Expressions index byte hash equals candidate dist. Panel TSX transforms through Vite. |

First UI build encountered `TS2741` in the parent's then-in-flight App
document binding; no parent-owned file was changed to bypass it. The parent
subsequently made that source coherent and owns the final UI build.

## Source/acquisition and concrete files

Acquisition **B**: existing in-tree O:I/native owners, consumed by ordinary
package imports. New integration code implements the portable protocol host,
center mount and static serving. No step-C code entered; no GPL/source-available
reference code or captures entered. Native source hash references are in README.

- `packages/expressions-boundary/`: package manifest, source protocol/host,
  optional Cradle owner adapter, typecheck config, protocol/native acceptance
  probes and provenance.
- `packages/live-shell/ui/src/panels/expressions.tsx` and additive `panels/index.ts` import.
- UI `package.json`/lock (file dependency), `tsconfig.json` (canonical JS/declarations)
  and `vite.config.ts` (same-origin candidate API/application proxy, React dedupe).
- `packages/live-shell/src/main.rs`: candidate-only Expressions route,
  explicit native bridge configuration and bind address; API compatibility kept.
- `packages/live-shell/src/api.rs`: byte-exact owner-source deep API import.

Boundary source hashes:

| File | SHA-256 |
|---|---|
| `src/protocol.ts` | `3c2dcde07c98ca0b991ee8315a0d254a153b31d4d238e9e7b5876cecdb766656` |
| `src/host.ts` | `3df5b45d0722a06df6b57f51b8cac112a79e8d890f9941af51f2b62c91793aac` |
| `src/cradle.ts` | `f1b1f61c2ba17c81a6473be43a178eeb202c33dda75cd3bb9fa84b511548fdc2` |

## Open native acceptance and limitations

- Parent computer-use acceptance must demonstrate actual frame boot, default
  native Wiki/saved work, editing/saving/reopen, and retained subject/selection
  across both cuts. This checkpoint does not close those targets or the 126-target
  programme from protocol tests.
- Native recovery `find_checkpoint` exposed the owner's pending schema/binary
  fault (`unknown field record`; expected `schema scope kind id revision value`).
  The native child owns its repair/rebuild at 4180; recovery acceptance waits for
  that ready signal and the original-activity replay.
- Constellation editor `open` returns a named refusal until the native editor
  is mounted through `onOpenConstellation`; inspect/relate use real owners.
- The optional personal facade requires same-origin assets; its pagehide
  disposal prevents private late replies from entering a navigated frame.
- The current app's v1 state handshake has no echoed epoch/nonce. Native
  operation replies and captured targets are epoch guarded; a formal nonce
  extension would require a paired app/host change, outside this source boundary.
- No Ableton audio playback/device-editing claim is made. Owner engine/device
  lanes remain independent.
- GitNexus primary index was six commits behind. Existing relay impact HIGH
  was reported; existing sources/callers were untouched. New shell paths were
  absent (`UNKNOWN`); parent refresh/detect-changes remains necessary before
  committing.

## Context surfaces and first-load repair — later increment

New owned UI files are `packages/live-shell/ui/src/components/WorldBrowser.tsx`
and `NativeContextPanel.tsx`; parent-owned frame/styles/panel wiring remain
with the integration parent. WorldBrowser reads the native Works inventory,
opens exact refs through the retained frame, navigates Central directories
using owner-disclosed locations, filters this folder and reads selected UTF-8
files. Context shows native scene/source/revision, Day, received owner receipts,
O-I Agency sessions and the existing per-scope native Agent profile controller.
Cards read only after a person selects a disclosed identity. Tab IDs use React
`useId` because both context regions can render simultaneously. No model,
message, terminal process, profile creation or personal source write was added.

Narrow package exports adopt the existing file, Agency, Agent-card, Agent-roster
and Day clients. Central relative root reads use `""`; the real owner refuses
`"."`. No source reader, roster parser or native persistence was reimplemented.

Executed through the genuine bridge at `http://127.0.0.1:4180`:

| Read | Observed result |
|---|---|
| `listFiles(transport, '', true)` + `readFile` | Native root has 24 entries. `AGENTS.md` is 32,633 bytes, ref `central:path:/Users/admin/Central:AGENTS.md`, revision `central.content-fnv1a64/v1:32633:62ec7c1dbaa2357e`. |
| `readAgency(transport, 'O-I')` | Eight real sessions. Their native attachments contain purpose/provenance/session only; no Agent ref. No identity was inferred. |
| Existing controller roster in O-I | `scope_ref: project:O-I`, empty native profile roster. |
| `dayRead` | `central:day:control:root:2026-10-07`; civil date 2026-10-07, uninitialised authored document, zero-byte revision. No Day was authored or initialised. |
| Native boundary acceptance rerun | Grade B, 2/2 passed; rebuilt owner inventory now contains two genuine native Expressions. |

The earlier recovery schema fault is superseded by the native child's repaired
owner at 4180. That child reports exact recovered authored and Central Document
equality; parent computer-use/save/mode-cut replay remains the UI acceptance.

The parent found a live first-open failure. Source diagnosis identified that
application boot can issue its hello/state/native reads before the first iframe
`load` event. The portable host previously treated that initial load as a
replacement and aborted/discarded replies belonging to the first document.
`mountExpressionsApplication` now marks only its initial navigation pending;
first load completes the same epoch and announces availability. Subsequent loads
still invalidate requests, targets and native leases. The app/assets are unchanged.

Executed after this repair: **11/11** protocol tests passed, including an
in-flight owner response and queued open across initial load followed by late
reply refusal on actual replacement. Boundary `npm run check` passed. Full UI
`tsc --noEmit` passed after the native-context/roster/useId changes. These are
protocol/type evidence; parent computer-use must replay the originally failing
open before claiming its live result.

The grade-B native acceptance probe was also extended and rerun: the genuine
4180 owner inventory request now begins before the initial load event and its
actual native reply survives that event; missing-subject inspection remains
unaltered. **2/2 passed**, two actual native Expressions disclosed. This
exercises the repaired controller against HTTP, without claiming DOM/UI evidence.

Current source SHA-256:

| File | SHA-256 |
|---|---|
| `src/host.ts` | `eb82027f8f598019d39448a899fa90cc670bbee0e6c914426e43a180bbead8e4` |
| `src/cradle.ts` | `416acfcdb6040d21b95e15da257f5ff48f7ad2360180acc29b037a8a888f3142` |
| `WorldBrowser.tsx` | `c5685de93132da31425f51821f37868e8de8e079af0ec4281291032a96abbea4` |
| `NativeContextPanel.tsx` | `7f13cdcb217bc3b1538e1139b001e2a108992f6c8eeb3ec49b625d5504cf3696` |

### Native Agent owner repair packet (read only)

The Central profile scope on the currently configured bridge refuses an actual
native roster read: `unknown field self_source` in the stored acceptance. It
is a deployed-owner revision mismatch, not a reason to alter personal receipts.

Installed `/Users/admin/.local/bin/ctrl` resolves to the OI application-support
binary and reports `ctrl 0.1.0 (f019561cabec)`, matching primary Central main
`f019561cabec2234d6aac2704f88495696847399`. Its authoritative
`Work/Central/ctrl/src/agent_profile_acceptance.rs:31` Acceptance uses
`serde(deny_unknown_fields)` and has neither self-source field; review's exact
receipt deserialisation is at line 110. Source SHA-256:
`b2f873b738aa5959322725ade5f74e192675e5bb9b16df2f5b60b4af54d80814`.

The existing native implementation is Central commit
`93aa39743e2a20032473586b8282d6cca1ae8445`, carried by owner branch
`feat/agent-self-integration-20261007`, head
`1ed6e625d0d7ee1d9986cd8171e98b5d2bddc4bc`, seat
`/Users/admin/Central/worktrees/env-3/central`. It supplies optional
`self_source`/`relational_logos` acceptance pins, legacy omission support,
exact source/digest/horizon validation and preservation of human authority.
Its original implementation changes four files: `agent_profile.rs`,
`agent_profile_acceptance.rs`, `agent_profile_actions.rs` and the acceptance
suite. No existing owner code or checkout was modified by this child.

An existing compiled owner is already available:
`/Users/admin/Central/worktrees/env-3/central/target/release/ctrl`, reporting
`ctrl 0.1.0 (93aa39743e2a)`, SHA-256
`56512253dffcbc5c0c271d18846e6f47e0fb124f2f1d93515f9eff4ecb498adf`.
**Executed** its real read-only `agent-profile.roster` Action against the same
Central ground: success, `scope_ref: control:root`, 39 actual profiles including
`agent/anima`, `agent/aletheia`, `agent/epii`; four pinned profiles report
`self_sources_resolved: true`. `execution_authority_granted` stays false.
No accept/review mutation or model execution occurred.

Also **executed** the installed suite's actual read-only Agent card command
under that process-local owner override for `agent/anima` and `agent/aletheia`
in `control:root`: both succeed with exact `oi.human-agent-card/v1`, matching
requested identities, revision `r3`. Each currently discloses zero public
capabilities; the UI renders the actual card fields and does not invent a
capability list. No global owner was replaced and no Agent was prompted.

Candidate-local owner selection is supported by existing
`OI_CENTRAL_CTRL_BIN`; `desktop/cradle/kernel/src/flow.rs:193` documents it and
the suite route inherits it. Parent can configure the existing matching binary
for candidate 4180, preserving primary/runtime owners. This packet does not
claim that bridge reconfiguration or the UI's Central roster replay has occurred.

Four immutable personal acceptance files already contain these two
`{reference, content_digest}` pins. Only their metadata/keys were inspected;
their content and source records were unchanged. SHA-256 evidence:

- `9acd68ef107ffe67723812ff2485226b7d26fa604f406ec182ff98f7ec880727`
- `95301d9ee7851bc78cec8419c69ff1a201ef4585b215d11f982e3d48c54458b5`
- `94815397839bba748a7d60a98262a2d82127efcf7357c0847fbbe7db4ef377da`
- `f30923ce43b0db2547b63e8ba5b65b2e643c89bf6901f138950d241e43509fa3`

Existing owner tests to run on any consumed build include
`self_pinned_review_shows_exact_text_and_acceptance_records_verified_pins`,
missing/withheld/digest-mismatched source refusal, and
`real_cli_express_review_accept_with_self_pins`. Their source was read; this
child did not claim to run those Rust tests or start a competing heavy build.
After candidate owner configuration, replay the Central roster then a disclosed
Agent card through 4180 and computer-use UI. Preserve immutable receipt hashes.

Acquisition remains **B**, ordinary in-tree owner imports. No step-C code or
reference assets entered. GitNexus reported readAgency/readAgentCard LOW with
the primary index six commits behind; NativeAgentController's imported class
has CRITICAL importer reach (351), so it was reused intact. No canonical
controller, source reader, owner acceptance or authorisation code was changed.
