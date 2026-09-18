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
| F3 · Factory live updates (arrival/hold/resume over real streams) | PR #292 `FactoryLive.tsx` — ported as `FactoryLiveProvider` (observe-on-read + acknowledge; the donor's revision-index poll and `central-project-link-read` linkage check name kernel ops this cut does not carry, so there is no poll loop at all — observations come only from reads the Desk actually performs, with the basis disclosed per observation) | `factory_build_snapshot` (revision signature from the owner's disclosed `factory.build-view/v1` revisions; bounded content signature when the owner does not disclose them — never presented as an owner revision) | `FactoryCentre` wraps the Desk in one live field; `DeskBoard` cards carry the arrival marker + revision acknowledge; `DeskRunDetail` carries the live-follow Refresh + acknowledge | one provider per visible centre surface, no timer, unseen material accumulates until acknowledged | `walk/desk-live-material-probe.mjs` (arrival → acknowledge, fixture-labelled scenario) + desk probes green, `tsc --noEmit` clean for the lane | **landed 2026-09-18** (native watch/cursor absent by design — owner ops `factory_attempt_task_list_read` / `central-project-link-read` remain the donor's future wiring) |
| F4 · Handoff / material / attempt-task surfaces (persisted results, Git basis) | PR #292 files ported: `FactoryHandoffSurface`, `FactoryMaterialSurface`, `FactoryAttemptHandoffDocument`, `attempt-task.ts`, `factory-material-reading.ts`, `factory-review-snapshot.ts`, `CandidateReading` (subject browser) | material reads `factory_build_snapshot` + the owner validators (the donor's `build` development-read spelling is not carried; attempt-task ops `factory_attempt_task_list_read`/`factory_attempt_task_read` are NOT on this kernel cut — the handoff surface renders the named owner-read-unavailable state and invents no list) | Desk Run detail: Produced material section (inline material reading, fixture-labelled in the dev scenario) + Attempt handoff section | retained review snapshots (byte-bounded, exact identity+revision restore) bind the reviewed revision; a moved owner revision is offered, never auto-replaced | `walk/desk-live-material-probe.mjs` (fixture-labelled material, honest empty state, handoff unavailable state) + desk probes green, `tsc --noEmit` clean for the lane | **landed 2026-09-18** (material complete; attempt-handoff documents wait on the two owner kernel ops) |
| F5 · Cross-project desk aggregation over explicitly added Factory sources | desk lane (§10 of the handoff) | `development read` project → journey → runs at bounded concurrency | `DeskBoard` (already present in the live tree) | preferences, never a run database | `fixtures/desk-board.ts` + probes | already in tree (fixture-proven; live read proven by desk lane) |
| F6 · Tasks = the real chat in the centre | shared `AgentChat` (one conversation Surface) | encounter session; Run binding by exact agent-session ref | `FactoryCentre` Tasks view | draft survives view switches | `walk/desk-probe.mjs` 4/5 | already in tree |
| E1 · Expressions stage owns the full surface; the Studio dock is a summoned overlay, never a flex column that shrinks the field | Expressions mode (convergence line) | stage ownership law (#375 §9); shell canvas panels already float over the fixed full-window stage | `expressions.css` + `ExpressionsSurface.tsx` — `.xp-studio` absolute overlay (right/foot) over the full-bleed `.xp-field`, shared resize handle on the overlay's leading edge | dock geometry remembered per viewer (unchanged); field width invariant under open/close | `walk/expressions-overlay-probe.mjs` (field width invariant under open/close, overlay edge alignment, handle position, arrow-key resize) + `expression-resize-integration` green | **landed 2026-09-18** |
| E2 · Epi-Logos sixth entrance binds the world; context retains across arrangements; leaving is explicit | #375 amendment (the footer entrance was a dead boolean; the store's world-binding path was unreachable — `TREE_MODES` excludes epi-logos) | workspace context world (`context.world`) — structural, mode-independent | footer "Enter the Epi-Logos world" → binds world + opens the curated Epi surface; "Within Epi-Logos" chip with explicit Leave in every arrangement | the context (with return trail) lives in the workspace, not the mode — switching arrangements cannot lose it | `walk/epi-retention-probe.mjs` (enter → retains through factory/expressions/techne/base → explicit leave clears; no errors) | **landed 2026-09-18** |
| T1 · Technè top-bar instrument tabs M0′–M5′ bound to `TechneReading.disclosure` | QL-MEF `main` `dbff5cc` TechneAdapter + six instruments | `ql.techne/v1` | `techne/` arrangement (`TechneSurface` rail in the shared `TabPresentation` grammar; `techneReading.ts` provider seam) | subject's disclosed constellation, never a static six; tab switching is presentation state, arrangement restores | `walk/techne-instrument-tabs-probe.mjs` (six tabs, M0′ first view, stated reasons not simulated content, state preservation across tabs and modes, pin/orient/reveal grammar, wire-contract checks) + `tsc --noEmit` | **landed 2026-09-18** — the frame→subject seam landed the same evening (CradleFrame/Workbench pass `workspace.current.context.subject` into `TechneSurface`; the disclosure is requested for the person's selected subject). Open join: no QL reading provider registered into the cradle yet (`registerTechneReadingProvider` in `src/techne/techneReading.ts` is the QL-side seam) — until it registers, the rail truthfully names the unavailable reading source |
| W1 · O:I Web through the one Library (subjects → presentations → return) | existing Library/Search, Beings/Things, WorldPresentation, SharedField routes | native carriers (#18/#352/#366); providers read `expression list`, the hosted-field read, search; worlds refuse honestly (no list-all op — the reason IS the state) | `library/` scope model (here/local/shared) | identity/revision/reading position preserved | `walk/library-join-probe.mjs` (scopes disclose; shared-unavailable honest; no errors) | **standing confirmed 2026-09-18** — the connective field works with honest degradation; the full page → Expression → exact-source → return walk remains |
| C1 · Right companion: chat face, Run\|Agents\|Context panel sides (Ta-Onta) | `agent/agent-chat-ui-2026-09-18` — advanced from `a808da20` by the commissioned worker: `f5ac578d` (build repair — the lane tip had 17 tsc errors from snapshot fragments whose siblings lived in other lanes' trees) + `d1e2f5fd` (skill-assignment pipeline stages: real SKILL.md corpus search through the kernel files seam, bounded literal-comparison proposal with reasons/gaps/basis digest, truthful `profile_use_apply` receipt + `profile_use_plan` re-read) | files seam (`files_list`/`file_read`/`world_read`); `profile_use_plan`/`profile_use_apply`; missing named: owner mint op, work-start op | agency surface on the lane (`groundSkillSource.ts`, `MintAgent.tsx`) | uncommitted lanes preserved; fixtures dev-only | lane walk `skill-pipeline` 22/22 + tsc clean in the worktree | **advanced 2026-09-18** — Worker D (`be9295b8`) completed the commissioned standard's remaining items: the one resolved start interaction (StartPassage — intent as the composer's own draft, then Agent/Harness/Model/Environment/Skills/Context/Permissions rows each independently revisitable over real reads, Run-scoped Start naming its missing owner op), Direct work genuinely startable through the ordinary start/read pair, and Send/To:-address/Delegate-bounded-work as visibly distinct acts. Walk 23/23 against a real resident AIKit SessionSpace + controlled ACP fixture; skill-pipeline 22/22 regression; tsc clean. Still owner-side (named in the UI): model roster seam (AIKit), Run-scoped work start (#220), agent mint, bounded-delegation grant |
| B1 · Base files/editor/terminal/preview + Day/Flow documents | main @ `fe92e1d0` base workbench | kernel file ops; Day/Flow HTML on main | Base mode | existing left-files UX is accepted | `walk/mode-sweep-probe.mjs` (every entrance in the one shell, return to Base clean, no errors) + `walk/footer-probe.mjs` (reveal law: edge 3px→24px on hover, actions summary reachable) | **verified 2026-09-18** |

### Superseded presentations (retired by name, never silently)

- `BuildSurface` as the Desk's operating Run face (F1/F2 above) — retained
  only inside the dev-only development console.
- The six-tab Factory sidebar of PR #373 — already superseded on main by
  Run | Agents | Context (#379); nothing here reinstates it.
- The captured `factory-ui` demo as the Factory centre (per the 2026-09-18
  commission): every depth now binds the owner's real readings.

## Pre-existing findings (named, not introduced by this landing)

- `walk/tab-pane-probe.mjs`'s orient-tool "intercept" was probe drift, not a
  shell defect: the strip was legitimately FOLDED (unpinned — the hiding
  law), and its hidden tool sat under the left region's edge. The probe now
  approaches the reveal edge before clicking; resolved 2026-09-18. The
  horizontal fold keeps a 32px reveal edge (the vertical fold's counterpart)
  — recorded as the designed reveal, not a remainder defect.
- The ephemeral-vite-server probe pattern (`createServer({configFile:false})`)
  can no longer resolve the workspace engine deps (`three` from
  `packages/oi-design-system/expressions-engine`) since the engine entered
  the eager entry graph; `footer-probe` now reads the standing dev server
  like the other walks. Any probe still spinning its own config-less server
  will hit the same wall.
- The `factory-development` walk scenario still drives the pre-Desk
  development console (named in the handoff §10 known seams) — rewriting it
  onto Desk needs the walk bridge lane.

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
