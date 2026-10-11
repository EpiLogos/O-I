# Agent shell — parent acceptance record

One parent record per `feature-completion.md`: each required behaviour is
connected to its native owner, the implementation, the executable test that
fails if the connection is cut, and the evidence in the intended world.
Child completions cannot close an unmet parent. Standing axes per row:
**implemented / exercised / passed / cut-red** — a row is closed only when
all four hold.

- Commission: SESSION BRIEF — agent-native shell from the owner-approved
  mockup (fidelity + ontology non-negotiables). Design basis:
  `AGENTIC-CONVERGENCE.md` Rev 5/4/3/2, `WORLD-SHELL-DESIGN.md` §12–16,
  `DEVICE-PANEL-BRIEF.md`.
- Acceptance oracle (F1): `agent-shell-fidelity.json` — tokens, frame
  geometry, transport order, control inventory, full function table.
- Intended world: the running O-I shell — `native.agent` centre panel in
  the live app (`desktop/cradle`), kernel bridge attached, at 1920×1200
  and ~700px. A fixture is not the intended world.
- Lane: env-1 seat, branch `agent/o-i-20261007-1639`, workers
  `codex:sol-new-shell` (first increment) + `zcode:agent-shell-repair`
  (this repair).
- Independent verdicts: Fidelity 71960daf / Standards ebbec6a6
  (2026-10-08) — parent ruled open; the unfinished step named there is
  rows L1–L4 below. This record is the response.

## Fidelity rows (mockup as acceptance)

| # | Behaviour | Native owner | Implementation | Test that fails when cut | Evidence |
| --- | --- | --- | --- | --- | --- |
| F1 | Frame, six regions, tokens, transport order match the oracle at both viewports | shell (live-shell/ui frame) | `agentShell.css` scoped token block + frame grid; `AgentShellTransport` 18 ids | `tests/agent-shell-live.browser.mjs --live` computed-style + region checks (fails when bridge down via `--expect-live-red-when-cut`) | pending: live captures `evidence/agent-shell-f2-live-20261008/` |
| F2 | Hovering any implemented control states its function in the status bar (data-i law) | shell | `statusInfo.ts` delegated mouseover → StatusBar info; `agentFidelity.ts` oracle strings | same live harness, hover checks | pending |
| F3 | Tracks are real sessions; clips are real tasks (running: no drawn end; queued: no length; stalled: frozen; empty slot = soft stop) | kernel `agency_read` + `encounter_task_read` (AIKit SessionSpace owner) | `agentRunModel.ts` + `AgentSessionGrid` | live harness compares rendered rows against the harness's own `agency_read` result; cut → red | pending |
| F4 | Group tracks + stepped rails per nesting depth | kernel `agency_read` spaces (subagent parentage not yet exposed — disclosed) | `buildTracks` group containers per space; disclosure row in deviations | unit: `agent-run-model.test.mjs`; live: rails render per space members | pending |
| F5 | Arrangement needles: one live needle per thread at last activity, shared axis; stalled freeze | kernel `temporal_events_read` (oi.temporal-events/v1, PR #634) | `needleFor` + `AgentArrangementView` ruler + readouts | unit: `agent-arrangement-needles.test.mjs`; live: needle position equals temporal read | pending |
| F6 | Thread opens full-width on clip double-click; stalled thread ends in retry/hard-stop/steer | kernel `encounter` (cradle AgentLayer) | `AgentThreadView` → `NativeAgencyParticipation` | live harness opens a thread | pending |
| F7 | Transport controls carry their agent functions (Rev 2 table) with real controls wired (Run/Stop via `harness_agent_control`) | actuation (runtime tuning) + software-factory (custody) | `AgentShellTransportBridge` ops | cut test: controls disabled/disclosed when bridge down; live: stop/restart issue named refusals | pending |

## Ontology rows

| # | Behaviour | Native owner | Implementation | Test that fails when cut | Evidence |
| --- | --- | --- | --- | --- | --- |
| O1 | Every device/tile/control belongs to exactly one family via its manifest at the neutral door; UI READS the door | the six families' owners | `src/inhabitants/*` five manifests (incl. **central**) + `allFamilyManifests()` consumed by pool/rack | `agent-family-manifest.test.mjs` (requires central); live: pool rows == manifest faces | pending |
| O2 | §14 parameter addresses `{family, device-instance, key, type, range/unit, write-path}`; every modulated parameter shows its modulator | family owners | `agentParamAddresses.ts` table; lights are readings (harness binding, roster acceptance, workcell status) | `agent-param-addresses.test.mjs`; live: data-family == manifest id | pending |
| O3 | Agent identity from Central's accepted profiles (kernel roster), never a hardcoded crowd | central (`agent-profile.roster`) | provider maps `agentRef → roster {name, accepted}` | unit asserts roster mapping; live: displayed names == roster names (cut → red) | pending |
| O4 | Honest disclosure where a source is absent (spend has no writer; remote carrier refused/composed; turn streaming poll-only) | per-source | disclosed-absence renders in pool/rack/transport | fixture harness asserts no fake rows; live asserts disclosed lines | pending |

## Standards rows (the reviewers' unfinished step)

| # | Behaviour | Native owner | Implementation | Test that fails when cut | Evidence |
| --- | --- | --- | --- | --- | --- |
| L1 | Live `native.agent` against the F1 oracle in the running shell | kernel bridge + live-shell | `tests/agent-shell-live.browser.mjs --live` bundling the REAL app (no stub providers) | the suite itself; `--expect-live-red-when-cut` proves it fails against a dead bridge | pending: receipt + PNGs |
| L2 | Red-when-cut demonstrated, not asserted | — | harness records which live assertions fail with the bridge cut | `red-when-cut-receipt.json` non-empty | pending |
| L3 | Suite + typechecks green in the seat | — | full serial `node --test` of agent-shell tests + `tsc --noEmit` | — | pending |
| L4 | Deviations logged per departure (F3 law) | — | `agent-shell-deviations.md` reconciled | — | pending |

## Known absences (disclosed, not defects)

- `spend_ledger` has no schema and no writer in O-I — the meter discloses.
- Pushed turn streaming is not built (backlog item 1) — threads poll.
- `agency_read` exposes no subagent parent linkage — nesting derives from
  spaces; deeper rails disclosed until the kernel exposes parents.
- Remote carrier stands at refused/composed, never live (owner ruling).
- Earth / Technē / Workbench transport buttons are `soon` placeholders.

## Executed evidence — 8 October 2026, repair pass (zcode:agent-shell-repair)

- **LIVE (the reviewers' unfinished step):** `node tests/agent-shell-live.browser.mjs --live`
  against the real kernel bridge (`walk-bridge` rebuilt from the seat with
  `temporal_events_read` + `harness_agent_read`) — **exit 0, 18 observations,
  0 faults**: app mounted, agent shell opens, six oracle regions, 18
  transport ids in oracle order, oracle data-i hooks, 1920×1200 frame,
  oracle grid geometry, **oracle tokens on the agent frame surface**,
  **hover law lands in the status bar**, `agency_read` answered with
  **12 real rows**, rendered tracks equal the run model over the bridge,
  browser rows converge, spend meter discloses absence, **the roster
  refusal is disclosed by name**, no fabricated rows, no page errors,
  compact 700×1200 variants. Captures + receipt:
  `evidence/agent-shell-f2-live-20261008/` (schema
  `oi.agent-shell-fidelity-f2/v2`).
- **Red-when-cut:** `--expect-live-red-when-cut` → `proved: true`; the 5
  `native:true` checks all fail against a dead bridge (0 pass), and a
  native check surviving a dead bridge fails the harness as fake.
  `red-when-cut-receipt.json`.
- **Offline modes:** `--cut` (honest refusal states), `--fixture`
  (refusal harness only; the fake Porting/Honey rows are deleted from the
  codebase), `agent-shell-fidelity.browser.mjs` — all exit 0.
- **Suites:** 33/33 agent-shell unit tests pass; `tsc --noEmit` exit 0.
  Full package serial suite: 2 pre-existing failures in
  `continuity-storage` / `native-knowledge-adapter`, classified BASE —
  module resolution inside `desktop/cradle/src/workspace/store.ts`
  (committed code, untouched by every lane here; extensionless import
  under node's loader).
- **Kernel repair carried in this pass** (documented, uncommitted with its
  owner's WIP): `temporal_sources.rs` envelope readers read `data.*`
  (`run_envelope` returns the whole ActionResult); the temporal read is
  windowed to 24 h and polled at mount + 90 s because the projection costs
  ~70 s per call against the live ground. Kernel queue starvation is the
  known cost driver; a longer read horizon for agency/harness reads is the
  kernel lane's next lever.

## Verification commands (the seat's own gates)

```sh
cd /Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui
node --test tests/agent-shell-tokens.test.mjs tests/agent-shell-status-info.test.mjs tests/agent-shell-transport-ids.test.mjs tests/agent-run-model.test.mjs tests/agent-arrangement-needles.test.mjs tests/agent-family-manifest.test.mjs tests/agent-param-addresses.test.mjs
node tests/agent-shell-live.browser.mjs --live        # needs the kernel bridge
node tests/agent-shell-live.browser.mjs --expect-live-red-when-cut
node tests/agent-shell-live.browser.mjs --cut && node tests/agent-shell-fidelity.browser.mjs
node_modules/.bin/tsc --noEmit
```
