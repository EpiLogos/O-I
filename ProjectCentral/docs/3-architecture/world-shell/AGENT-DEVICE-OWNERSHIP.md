# Agent device ownership — verified map

Standing: **development slice 0**, 8 October 2026. Each row cites native
owners in the O-I tree (`worktrees/env-1/o-i` unless noted). The shell
declares families at the neutral door
(`packages/live-shell/ui/src/inhabitants/`); it does not embed product
logic in the frame.

## Principle

One visible device face may combine parameters from several families; every
parameter has exactly one owning address `{family, device-instance, key, …}`
(WORLD-SHELL-DESIGN §14). The mockup chain order is **gateway → agent →
skillset racks → world → git** (AGENTIC-CONVERGENCE Rev 5).

## Device chain

| Device / rack | Owning family | Native source (verified) |
| --- | --- | --- |
| Gateway device (transport, approvals, stall-after, frame monitor, readiness) | **actuation** | Hermes RE specs (`Control/agents/now/flows/hermes-gateway-re-20261007/`); temporal stream adapters `desktop/cradle/kernel/src/temporal_sources.rs` → `oi.temporal-events/v1` |
| Remote carrier (reach/where; refused/composed, never live) | **workcell** | AIKit inhabitation facet `AIKIT_WORKCELL_REF` / `--workcell` (`ProjectCentral/docs/5-evidence/cradle/CENTRAL-FIELD-NATIVE-AUDIT-A.md` B1); owner remote-posture ruling in convergence-backlog |
| AIKit agency gateway (harness binding sessions) | **ai-kit** | Kernel `HarnessAgentRead` / `HarnessAgentControl` (`desktop/cradle/kernel/src/lib.rs`); gateway answers verbatim (`harness_agent_gate.rs`) |
| Hermes `tui_gateway` vs Actuation on frank | **actuation** (distinct faces) | Three similarly named gateways stay separate on Main **Gateways** rack (Rev 5); Actuation product id in `packages/live-shell/package-payload.py` |
| Agent device — model, effort, harness, budget, heartbeat, steer/queue | **actuation** | Harness disclosure `desktop/cradle/src/agency/harnessDisclosure.tsx`; native agent session prep `NativeAgentLauncher.tsx` (harness topic → ai-kit owner for setup, runtime tuning → actuation manifest) |
| Agent device — autonomy, review gate, write mode, hand-back custody | **software-factory** | Custody / hold patterns in agent object registry `holdHanded` (`desktop/cradle/src/agent/objects/registry`); Factory sidebar agents tab documents roster separation `FactoryAgentsTab.tsx` |
| Agent identity (roster, never hardcoded crowd) | **central** | `agent-profile.roster` via `desktop/cradle/src/agency/roster.ts`, kernel `agent_definition.rs`. **Blocker 2026-10-08:** the read is refused by Central's ctrl (`agent_profile_acceptance_invalid: unknown field \`self_source\`` — `Work/Central/ctrl/src/agent_profile_acceptance.rs`); the shell discloses the refusal by name until that owner lands the fix |
| Skillset racks, skill admit lights, Capture → skill | **ai-kit** | Skillset/skill grammar in AIKit crates (seat env-1 zone); manifest `aiKitFamilyManifest.ts` |
| Context-world (reads, writes, write mode) | **central** + **ai-kit** (split params) | Prepared context / Central ground in `NativePreparedContext.tsx`, `preparedContextBinding.ts`; knowledge route is AIKit (`aikit knowledge search` hook law) |
| Write receipts / Return on world device | **software-factory** | Receiving and run returns (Factory product); disclosed on context-world face |
| Git device (seat, branch, land, PR) | **workcell** | Seat instrument (`Control/user/workcell/`, `workcell-cli`); no new worktrees (session ground) |

## Sessions, tracks, threads

| Surface | Owner | Evidence |
| --- | --- | --- |
| Session grid tracks (today) | **Expressions** session/arrangement views | `packages/live-shell/ui/src/App.tsx` → `SessionView` / `ArrangementView` on `native.session` / `native.arrangement` |
| Agency participation (roster, chat, tape) | **central** profiles + **ai-kit** harness gateway | `NativeAgencyParticipation.tsx` → `AgentLayer`; roster from Central; lifecycle via kernel gateway ops |
| Thread full-width centre | **ai-kit** conversation + cradle `AgentLayer` | Rev 4: double-click clip → thread; `AgentLayer` conversation plane |
| Temporal arrangement needles | **actuation** read model | `temporal_events.rs` + PR #634 adapters; needles are last-activity, not predicted end |

*Open:* whether Factory runs supply a parallel track adapter — no `factory-run-track-adapter` is wired yet; manifest reserves the projection id.

## Context dock tiles

| Tile | Family | Notes |
| --- | --- | --- |
| Sessions | Shell inspector over **ai-kit** + **central** sessions | Rev 5: replaces Agents hive as default tile |
| Ledger, Approvals, Diff, review | **software-factory** | |
| Frames, telemetry, spend | **actuation** | **Spend:** `spend_ledger` schema referenced in brief; **no writer found** in O-I tree — meter must disclose absence |
| Files, Terminal, Web, Graph | Shell inspectors | Native owners: Central file host (`Foundation.tsx` file resource host), terminal/web/graph as scoped inspectors |
| Agents hive | **central** / **ai-kit** | Launcher only after Rev 5 |

Existing dock: `native.context` panel (`packages/live-shell/ui/src/panels/context.tsx`) — slice 2 retiles this.

## Transport controls (Rev 2 + mockup)

| Control | Family |
| --- | --- |
| Effort, Budget, Heartbeat, Tap, Interrupt quantize, Link (shared field) | **actuation** |
| Write arm, Hand back, Capture → skill (proposal path) | **software-factory** / **ai-kit** (capture lands as skill proposal → AIKit) |
| Token counter (Σ) | **actuation** telemetry (disclose if no writer) |
| Output style (per-task override) | Task document owner (Factory run / act clip schema — slice 7) |

## Neutral door (slice 0)

Manifests admitted through `admitFamilyManifest` in
`familyManifest.ts` — **five families as of 8 October 2026:
actuation, ai-kit, software-factory, workcell, central** (the World
device's family is admitted, not just stamped). Expressions keeps its
parallel manifest (`expressionsFamilyManifest.ts`) until the Expressions
lane publishes a shared neutral type; the cradle's core contract
(`desktop/cradle/src/inhabitants/manifest.ts`, `oi.inhabitant-manifest/v1`,
with `ParamAddress`) is the neutral shape going forward.

§14 parameter addresses: every agent-shell control renders through
`src/inhabitants/agentParamAddresses.ts` — one typed address
`{family, device-instance, key, type, range?, unit?, write-path}` per
control, 28 addresses across the five families (corrected 9 October 2026
from 29, verdict fault F4: the table enumerates the parameter-bearing
controls the devices render — gateway 7 + agent 7 + skillset 4 + world 5 +
git 5, one-to-one with the pool's rendered rows; the admit lights are the
rack's readings, not §14 parameters); the device pool and rack
derive their rows from the admitted manifests
(`src/inhabitants/agentDeviceCatalogue.ts`), never a hardcoded table, and
admit lights are readings (harness binding, roster acceptance, workcell
status), never `is-on` literals.

## Known absences (honest disclosure)

- Pushed turn streaming — not built; threads may poll (backlog item 1).
- `spend_ledger` — no writer located in O-I.
- Remote carrier — composed/refused only.
- Earth / Technē / Workbench transport buttons — `soon` in mockup; deviations logged when slice 7 lands.
