# Wayfinder — Factory Expressions and Ta-Onta operation

**Governing spec:** [EXPRESSION-DEVELOPMENT-SPEC.md](../../docs/cradle/handovers/factory-expressions-2026-09-26/EXPRESSION-DEVELOPMENT-SPEC.md)
(retrieved from EpiLogos/O-I PR #542 @ `925f96a7`; blob `658437169d67`, sha256 `ee65147c…`; first publication `4793cd68`)
· [START-HERE.md](../../docs/cradle/handovers/factory-expressions-2026-09-26/START-HERE.md) (later owner directions: `factory-ui-study.html` approved; right-sidebar X omitted; Graph among Context insertion choices — those amend the shared UI lane, not this commission).
**Shared contract:** [EXPRESSION-ACT-MATERIAL-V1.md](../../docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md) (lead-owned).
**Local path recorded in NOW:** O-I `ProjectCentral/now/agents/factory-expressions-commission-spec-placed-2026-09-26.json`.

## Destination

A Factory Run performed through the actual Expressions engine: profile characters, a goal object, Run
telemetry driving authored states/gestures/exchanges/text, object panels with real actions, one act
continuing across Factory, Expressions and Technè, reusable Scenes chosen/created by Anima, Aletheia
Return and curation, rich save/reopen and Scene playback — the spec §9 encounter, shown in the
installed desktop.

## Notes

- Execution is carried into this map (Wayfinder Notes override): lanes implement, the lead integrates.
- Controlling reason: the owner's §1 clarifications. "Not as particles" is withdrawn.
- Worktree/build rule: all lanes work in `worktrees/env-1/*` (no new worktrees). Only the lead runs
  `npm run build`, `package-bundle.sh`, `oi desktop install`, installs of `ctrl`/`oi`, and commits.
  Lanes run `tsc --noEmit`, node tests and `cargo test` for their crates only.
- Coordinate with the in-flight UI lane (uncommitted in env-1/o-i): never revert or restage its files
  (`CradleFrame.tsx`, `agent/**`, `contributions/core/**`, `desk/RunMap.tsx`, `desk/fdesk.css`,
  `sidebar/sidebar.css`, `generated.ts`, `registered-kinds.mjs`, `cradle.css`, `TaOntaSide.tsx`,
  `hostedApp.ts`, `point-cloud-host.css`, `surface/Workbench.tsx`, `navigator.css`, `workspace/**`,
  `field-studies-journeys/src/expressions.ts`, `…/src/library.ts`, `library.html`, `library/LibraryHost.tsx`,
  `docs/cradle/10-SIDEBARS.md`, `11-FACTORY.md`, `sidebars/factory-ui-study-20260926.html`).
  Lead-owned edits to `hostedApp.ts` sit on top of those hunks.

## Lanes and exclusive file ownership

| Lane | Owns (exclusive) |
|---|---|
| **Lead** | this map; the contract; `src/expressions/hostedApp.ts`, `PointCloudHost.tsx`, `fieldOpen.ts` (relay/host), shared integration, installs, §9 acceptance, commits |
| **A — material & characters** | Central `ctrl/src/agent_profile*.rs` (+tests); AIKit `aikit-adapters/src/central_agent_profile.rs`, `central_entities.rs`; O:I `cli/src/agent_participation.rs`; kernel `expression_profile.rs`, `agent_card.rs`, `agent_definition.rs`; `expressions-app/src/engine/**`; `field-studies-journeys/src/{kernelComposition,kernelExpressions,kernelDocumentBridge}.ts` and `native-field/**`; `src/agency/**` (creator Character section, Agent Card preview) |
| **B — acts & performance** | kernel `expression.rs`, `expression_scene.rs`, `expression_world.rs`, new `expression_act_store.rs`/`expression_material.rs`, `lib.rs` (world-state init only), `src-tauri/src/main.rs` (socket routing); `cli/src/desktop_command.rs`; `src/expression/**`; `field-studies-journeys/src/{app,model,store}.ts` and new reuse/act UI modules there; `suite/desktop-projection.json` descriptor; kernel tests `expression_world.rs`, `expression_scene.rs`, new act tests |
| **C — Factory & Ta-Onta** | `src/contributions/factory/**` except UI-lane files above (incl. new `live/**`, `RunExpressionBody.tsx`, `run-expression.ts`, `FactoryLive.tsx`, `desk/RunPage.tsx`, `desk/RunLive.tsx`, `factory.css`); kernel `factory.rs`; `walk/factory-run-expression.mjs`; `desktop/cradle/material/factory-expressions/**` (curated starter material); QL-MEF `skills/**`, `workflows/**`, `docs/integrations/epi-logos/**` |

## Tickets (local tracker)

| Ticket | Lane | Blocked by | State |
|---|---|---|---|
| FX-0 Place spec, contract, map, NOW | Lead | — | done |
| FX-A1 Profile `expressive_character_ref` through Central/AIKit/`oi agent card` | A | — | done |
| FX-A2 Full material in Expression profiles (remove six-key restriction) and per-object sound/material routes | A | — | done |
| FX-A3 Creator Character section + Agent Card preview + Edit in Expressions | A | FX-A1 | done |
| FX-B1 `reuse` block, `reuse_set` change, `material_list` | B | — | done |
| FX-B2 Role grafting + extended act ops (`act_open/select/gesture/text/operate/continue/complete/seek/inspect/list`), persistence | B | FX-B1 | done |
| FX-B3 Socket/CLI/frame relay/SDK descriptor parity | B + Lead | FX-B2 | done |
| FX-B4 Expressions app: roles, save-as-reusable (character/scene/expression/gesture), select+bind, playback over act sequence | B | FX-B1 | done |
| FX-C1 Event-map inventory over real attempt/encounter schemas + test | C | — | done |
| FX-C2 Engine-backed Live tab: cast/goal/objects, act driving, timeline; remove "not as particles" | C | FX-B2, FX-C1 | done |
| FX-C3 Object detail panels with existing actions | C | FX-C2 | done |
| FX-C4 Curated starter material + associations; Ta-Onta Methods (Anima/Aletheia/Chronos) in QL-MEF | C | FX-B1 | done |
| FX-L1 Cross-mode continuation Factory→Technè→Expressions→Factory | Lead | FX-B2, FX-C2 | done |
| FX-L2 Installed §9 demonstration and evidence | Lead | all | done |

## Decisions so far

- Reusable material = ordinary `oi.expression/v1` documents + one `reuse` block (contract §1).
- Profile carries `expressive_character_ref` (refs-only rule; contract §2).
- One role-binding mechanism: `role` on Scene material entities/text layers, grafted in the kernel (contract §3).
- The act extends the ES4 act and persists; ops per contract §4.
- Material register is `Work/O-I/desktop/cradle/material/expressive-material/<kind>/` — Central protects `Control/**` (except `Control/user/flows/`) and every `ProjectCentral/` from ordinary file writes (FX-B1 finding).
- `act_select {role,state}` without a Scene is an object-local state change; `act_open` is an idempotent resume that extends the cast.

- Acceptance: §9 walk 63/63 at integration `b702ecf3` (installed desktop, bundle sha256 `5ec8a289…`); real two-agent Run `run:01M3FNY3P0E4H7JGN0BARSRQ8R`; agent track (Anima choose/create/reuse, Aletheia Return + curation) and installed-socket checks. Evidence index: root NOW `Control/agents/now/flows/factory-expressions-2026-09-26/README.md`.
- Integration line: `integration/factory-expressions-20260926` = this branch + local main `aa0da4a6` + fixes (the seat for landing); Central/AIKit `integration/expressive-character-20260926`; QL-MEF `feat/expression-acts-20260926`; Factory `feat/expression-acts-workflow-fixture-20260926`.

## Remaining

- The acceptance Run reads "Queued" in Factory: its attempts returned and verified, but the driver never attached Factory receiving/advance, so the Run's own lifecycle is not closed.
- Branches are committed locally, not pushed; nothing is merged to main (the primary checkout Work/O-I stands on main without this work).
- AIKit's installed candidate base `426b19e3` (convergence branch) fails `cargo fmt --check` in aikit-cli (not this commission's files).

## Not yet specified

- Whether Technè constellation instruments need their own act operations beyond `act_operate` references.

## Out of scope

- Deeper M1–M2–M3 research (spec §4).
- The Factory chrome visual commission (UI lane).
