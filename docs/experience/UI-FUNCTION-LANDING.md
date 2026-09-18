---
Register: design
Standing: current-development-state
---

# UI function landing — Version 2 shell × Version 1 functionality

The integration commission of 2026-09-18: the parallel UI (Version 2) is the
presentation destination; the accumulated functionality (Version 1 and the
native owners) is the donor. One real application. This is the landing table
the commission (§4) requires; it is maintained here and reported on #375.

## Revisions this landing stands on (verified 2026-09-18 evening)

| Role | Revision |
|---|---|
| UI destination (working tree, authoritative incl. uncommitted refinements) | `agent/expression-world-convergence-20260917` @ `7747d5e6` + live dirty state (the currently open app: `tauri dev`, vite :1421) |
| Functionality donor (pre-convergence cut) | O-I `main` @ `fe92e1d0` |
| Factory donor — real workbench | PR #292 `origin/cradle-factory-arrangement` |
| Factory donor — desk reading lane | `agent/factory-desk-reading-20260918` @ `6a450b74` (worktree `/private/tmp/oi-factory-ui-review`) |
| Companion lane (continue, never restart) | `agent/agent-chat-ui-2026-09-18` @ `a808da20` (worktree `.worktrees/agent-chat-ui`) |
| Settings/System lane | `agent/settings-redesign-2026-09-18` @ `979b6b8e` |
| QL instruments (`ql.techne/v1`, TechneAdapter) | QL-MEF `main` @ `dbff5cc` |
| Kernel camelCase `providerContract` | already in the live tree (`kernel/src/factory.rs` accepts both spellings; the 6a450b74 fix) |

The owner lanes above are active and respected; none is rebased, reset or
landed here. The integration commits ride the convergence branch locally;
PR #370 is the owner's to land.

## Landing table

| Functional obligation | Donor implementation | Native contract | Destination in the new UI | State/lifecycle binding | Test in the new app | Standing |
|---|---|---|---|---|---|---|
| F1 · Full SSSF Run view of a selected Run (multi-lane monitor + semantic reading + live world + run map) | F0 trace composition already captured (`components/ExecutionTraceExplorer/PhaseDetail`, Factory `factory-ui` port); Run-map reading + validators from PR #292 (`run-reading.ts`, `RunMapReading.tsx`, `factory.css`) | `factory_build_snapshot` (kernel accepts `providerContract` camelCase); `factory_development_read` `run` → `factory.run-reading/v1` | `desk/DeskRunView.tsx` inside `DeskRunDetail` (Desk centre) — depths Trajectory/Reading/Live/Map | one read per entry, owner validators, honest refused states; no poll | `walk/desk-run-view-probe.mjs` (all four depths, fixture + refused map), `walk/desk-probe.mjs`, `tsc --noEmit` | **landed 2026-09-18** |
| F2 · Demo BuildSurface retired from the operating face | — | — | `BuildSurface` now mounted only in the dev-only development console (`FactoryDevelopmentSurface`, `import.meta.env.DEV` `<details>`) | dev disclosure only | desk probes assert the centre no longer routes through it implicitly | **landed with F1** (file retained for the dev console; retirement by name recorded here) |
| F3 · Factory live updates (arrival/hold/resume over real streams) | PR #292 `FactoryLive.tsx` | `factory_development_read` + execution telemetry cursor | Desk board / Run view live-follow (paused-follow law already in sidebar RunPlane) | bounded buffers, acknowledge-by-revision | extend desk probes once wired | remaining (port + wire) |
| F4 · Handoff / material / attempt-task surfaces (persisted results, Git basis) | PR #292 `FactoryHandoffSurface`, `FactoryMaterialSurface`, `FactoryAttemptHandoffDocument`, `attempt-task.ts`, `factory-material-reading.ts`, `factory-review-snapshot.ts` | owner reads/Actions over developmental state | Context plane Produced material + Desk Run detail material | held revisions bind exact reviewed revision | ported read-model tests + shell probes | remaining (port) |
| F5 · Cross-project desk aggregation over explicitly added Factory sources | desk lane (§10 of the handoff) | `development read` project → journey → runs at bounded concurrency | `DeskBoard` (already present in the live tree) | preferences, never a run database | `fixtures/desk-board.ts` + probes | already in tree (fixture-proven; live read proven by desk lane) |
| F6 · Tasks = the real chat in the centre | shared `AgentChat` (one conversation Surface) | encounter session; Run binding by exact agent-session ref | `FactoryCentre` Tasks view | draft survives view switches | `walk/desk-probe.mjs` 4/5 | already in tree |
| E1 · Expressions stage owns the full surface; sidebars are summoned overlays | Expressions mode (convergence line) | stage ownership law (#375 §9) | `expressions/` presentation | stage identity per window | visual probes | remaining |
| T1 · Technè top-bar instrument tabs M0′–M5′ bound to `TechneReading.disclosure` | QL-MEF `main` `dbff5cc` TechneAdapter + six instruments | `ql.techne/v1` | `techne/` arrangement | subject's disclosed constellation, never a static six | instrument host contract checks | remaining |
| W1 · O:I Web through the one Library (subjects → presentations → return) | existing Library/Search, Beings/Things, WorldPresentation, SharedField routes | native carriers (#18/#352/#366) | `library/` scope model | identity/revision/reading position preserved | Library → page → Expression → source walk | partially in tree (scope model); walks remaining |
| C1 · Right companion: chat face, Run\|Agents\|Context panel sides (Ta-Onta) | `agent/agent-chat-ui-2026-09-18` @ `a808da20` (owner lane — continue it there) | encounter/session planes | panel sides per mode | per-mode planes, one glass container | lane's own probes | active owner lane — not duplicated here |
| B1 · Base files/editor/terminal/preview + Day/Flow documents | main @ `fe92e1d0` base workbench | kernel file ops; Day/Flow HTML on main | Base mode | existing left-files UX is accepted | editor/day probes | already in tree (verify joins) |

### Superseded presentations (retired by name, never silently)

- `BuildSurface` as the Desk's operating Run face (F1/F2 above) — retained
  only inside the dev-only development console.
- The six-tab Factory sidebar of PR #373 — already superseded on main by
  Run | Agents | Context (#379); nothing here reinstates it.
- The captured `factory-ui` demo as the Factory centre (per the 2026-09-18
  commission): every depth now binds the owner's real readings.

## Protocol for subsequent increments

1. Identify the new-UI receiving component and interaction.
2. Connect the real owner read/Action through the existing boundary
   (`development.ts`, kernel transport, encounter ops).
3. Preserve state, authority, error and lifecycle semantics (owner
   validators; honest refused states; no synthesised success).
4. Test the interaction in the NEW app entrypoint (dev probes against the
   live shell; fixtures labelled, never native claims).
5. Update this table and publish the increment (local commits on the
   convergence line; PR #370 remains the owner's).
