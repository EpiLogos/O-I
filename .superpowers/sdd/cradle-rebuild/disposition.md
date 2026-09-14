# U0.7 — Disposition audit (P0 closes)

Branch `cradle-rebuild` · 2026-09-05 · map §4 baseline disposition applied to
every module of the legacy desktop line. Verdict grammar: **REMOVED** |
**RE-DERIVED-IN-KERNEL** (the capability lives in `desktop/cradle/kernel/`,
re-proven by the U0.4 walk) | **HARVESTED-TO-NONE** (examined, nothing taken —
reasons recorded) | **HARVEST→RE-EARN recorded** (P1/P3 units re-derive; nothing
to copy now) | **SURVIVES** (named design-set contract; none granted).

**SURVIVES count: 0.** No design-set section requires any legacy module as-is
in the cradle. The kernel mechanics the design does require were already
re-derived (U0.4) and are cited by receipt, not by survival.

## desktop/core/src/ — 25 modules (8,618 lines)

| module | verdict | relation cell | evidence / receipt |
|---|---|---|---|
| `events.rs` | RE-DERIVED-IN-KERNEL | S — kernel event seam (map §2 row 1) | `cradle/kernel/src/events.rs` (header cites the port); ledger U0.4 row (e0118ad): 30/30 walk, log strictly monotonic 1..14 |
| `focus.rs` | RE-DERIVED-IN-KERNEL | S — one global focus (map §2 row 1; U1.4 re-proves fan-out) | `cradle/kernel/src/focus.rs` ("essentially as-is"); ledger U0.4 row; focus event carries the same ref (walk data) |
| `world.rs` | RE-DERIVED-IN-KERNEL (reading core only) | S→S0 — owner read models, no tree/UI coupling (map §4 "minus tree/UI coupling") | `cradle/kernel/src/world.rs`: participating sources from `projectcentral.change.horizon` + `ground.inspect` fallback; the WorldService tree/CentralWorldClient halves are REMOVED — U1.1 re-derives the rooted-World navigator from Central bindings, not from this tree |
| `flow.rs` | RE-DERIVED-IN-KERNEL | S→S0 — CAS write + `SourceWriteFailure`, two state layers (map §4) | `cradle/kernel/src/flow.rs`: every write through `projectcentral.source.write` with U0.2 canonical refs; ledger U0.4 row: conflict walk preserved both sides |
| `central_change.rs` | RE-DERIVED-IN-KERNEL | S→S0 — owner change horizon (owner Action adapter) | the same owner action is consumed in `cradle/kernel/src/world.rs::participating_sources`; the standalone legacy client is removed with the crate |
| `shell.rs` | REMOVED (ref vocabulary re-derived) | S — legacy host shell | `SemanticRef`/`RefProvenance` shapes carried verbatim into `cradle/kernel/src/refs.rs` (U0.4); the `DesktopHost`/destinations (Home/Personal/Build/Explore/System) are the legacy app shape — the cradle is austere rest + OS frame grammar (D1, D16/D17), a different shell |
| `bridge.rs` | REMOVED | S — legacy caller/call-class authority | 21 call classes gating 27 legacy commands; the cradle seam is the single typed `KernelOp` channel + dev-only walk bridge (D10) — no such class table exists in the design set |
| `contribution.rs` | REMOVED | S — legacy contribution-host envelope | the `oi.desktop-host-reading/v1` host grammar is the legacy host system; the cradle's component grammar is ref + owner state + disclosed Actions (D15), consumed through the contribution field when verticals land — no dormant envelope is named by the design set |
| `agent_surface.rs` | REMOVED | S→S1 × S→S2 — replaced | baseline REMOVE: manufactured uniform capabilities; D4 rules the encounter runs over `agent_session_host.rs` + clients (U2.1), through the AIKit dependency — not this adapter |
| `aikit_workbench.rs` | HARVESTED-TO-NONE | S→S2 — resolution mode (future U2.x/U3.1 rewrite) | examined: `SessionSpaceApplicationStore` glue (list/read/focus via AIKit preview/apply). Nothing taken: (a) it carries SessionSpace-application semantics the new design replaced (D4; law 4 forbids desktop SessionSpace semantics), (b) the durable pattern — owner-client envelope discipline — is already re-derived as `cradle/kernel/src/flow.rs::CentralClient`, (c) hosting it dormant would pin the dependency-light kernel (serde only) to a git rev with zero consumers — dead code |
| `local_aikit.rs` | HARVESTED-TO-NONE | S→S2 — observation | examined: a one-liner over `SessionSpaceFileObservationProvider` projecting into the legacy contribution-host envelope (`NativeContributionReading`/`HostRegion` — removed grammar above). Nothing durable independent of removed modules |
| `project_field.rs` | HARVEST→RE-EARN recorded (U1.1/U3.1) | S→S0 — rooted-World spine | examined: (a) ctrl owner-Action CLI envelope — already re-derived in `CentralClient`; (b) `ContextSourceIndex` horizon/search composition over the ai-kit pinned rev (6b25178) — re-derived at U3.1 against ai-kit main; (c) disclosure-law strings — design content, not code. Nothing copied: no P0/P1 consumer; kernel stays dependency-free until its units land |
| `project_knowledge.rs` | HARVEST→RE-EARN recorded (U3.2/U3.4) | S→S2 + S→S0 — knowledge apertures | examined: `KnowledgeApplication` search/read/relations + authored-wiki relation composition over the pinned rev. Re-derived at U3.x against ai-kit main when the aperture lands. Nothing copied now (same law: no consumer, no dead code) |
| `living_wiki.rs` | REMOVED | S→S2 + S→S0 — legacy living-wiki projection | the wiki vision (D21) is re-derived as the U3.4 wiki graph surface from real project+root+shared-field wiki content through owner seams — no design section requires this legacy projection |
| `living_contemplate.rs` | REMOVED | S→S2 — explicit Contemplate transport | Contemplate-class acts are waypoint W1.4 fog ("depends on AIKit #122 flow cognition state; never auto-invoked") — re-designed in context, not salvaged |
| `flow_contemplate.rs` | REMOVED | S→S2 — Flow contemplation | same waypoint W1.4; transport over the removed `AikitAgentSurface` |
| `living_focus.rs` | REMOVED | S→S2 — trivial ref parse | 13 lines over `aikit_core::ResourceRef::parse`; re-derives trivially if ever needed |
| `living_return.rs` | REMOVED | S→S0 — Contemplate-return projection | W1.4 fog; projects `AgentWikiMaintenancePlan` from the removed Contemplate path |
| `central_agent_profile.rs` | REMOVED | S→S0 — authored-ground mode (U2.4 re-derives) | ctrl `agent-profile.*` client; its envelope law already lives in `CentralClient::run` (generic over action names); U2.4 consumes it — schema guards re-land with that unit's need, not dormant |
| `local_factory.rs` | REMOVED | S→S2→S3 — Factory import is fog (map §2.4) | binds `epilogos-factory` build provider; exposed when the P4 gate opens it — no contract requires it in the cradle now |
| `live_product.rs` | REMOVED | S→S2→S3/S→S1 — factory/session-space correlation | fog rows (§2.4); correlation re-derived at U2.5/U2.6 over real Activity semantics |
| `native_application.rs` | REMOVED | S→S2 — snapshot loaders | file-snapshot loaders for `ContextResolution`/`ModelRuntimeReadModel`; U2.x consumes compose/session-host facts over ai-kit main (U0.1 receipt); law 6 removes the desktop model-parameter motivation |
| `product_command.rs` | REMOVED | S — legacy Command/System region | `oi` CLI catalogue projection for a legacy region; APP-SPEC §13 region accounting happens per vertical when a System region actually lands |
| `execution_authority.rs` | REMOVED | S→S1 — authority mode | process-local bounded-grant ledger for the legacy dispatcher; in the cradle invocation crosses the owner's authority seam (D15) and Actuation owns authority semantics (U2.5) — no desktop-side grant store is named by the design set |
| `lib.rs` | REMOVED | — (crate root) | the crate root of the removed crate; its four KEEP-RE-EARN exports already live in `cradle/kernel/src/lib.rs` |

## desktop/src-tauri/src/ — 4 modules (1,662 lines)

| module | verdict | relation cell | evidence / receipt |
|---|---|---|---|
| `main.rs` | REMOVED (replaced by rewrite) | S — legacy product bridge | 27 commands incl. `include_str!` contribution fixtures; replaced by `desktop/cradle/src-tauri/src/main.rs` — thin `kernel_op` + `kernel_event_log` over the new kernel (map §4 "REWRITE"; U0.3) |
| `flow.rs` | REMOVED | S→S0 — legacy Flow command surface | Flow loop re-derives at U4.x over the kernel seam |
| `living.rs` | REMOVED | S→S2 — legacy living command surface | W1.4 fog |
| `profile.rs` | REMOVED | S→S0 — legacy profile command surface | U2.4 re-derives over `CentralClient` |

## Directories

| path | verdict | evidence |
|---|---|---|
| `desktop/ui/**` (90 files, 15,533 src lines) | REMOVED | law 1; kernel business logic already harvested into `cradle/kernel/` (U0.4); token layer extracted to `packages/oi-design-system` (U0.5, sourced from `site/src` per D9); presentation re-derives per vertical |
| `desktop/fixtures/` | REMOVED | `native-contributions.json` consumed only by legacy `src-tauri/src/main.rs` (`include_str!`), verified by grep — no other consumer |
| `desktop/core/` | REMOVED (crate) | all 25 modules dispositioned above; nothing SURVIVES; crate + tests (15 integration test files) removed |
| `desktop/src-tauri/` | REMOVED | replaced by `desktop/cradle/src-tauri/` (self-contained) |

## Wiring cleaned (live references to the removed line)

- `.gitignore`: legacy `/desktop/core/target|Cargo.lock`, `/desktop/src-tauri/target|gen` entries removed (cradle has its own `.gitignore`).
- `.github/workflows/desktop.yml`: rebuilt around the cradle — cli tests+clippy, cradle kernel tests+clippy, site + cradle builds, shared-field presentation contracts, cradle src-tauri locked check (aarch64).
- `.github/workflows/prelocal-release.yml`: desktop-bundle job repointed at `desktop/cradle` (npm ci/build from its lock, `cargo check --locked`, tauri bundle from `desktop/cradle/src-tauri`, lock-diff proof on cradle locks).
- `.github/workflows/living-wiki-w7.yml`, `authored-wiki-relations-w8.yml`: the O:I-side jobs that tested the removed line are deleted (owner-repo conformance at pinned SHAs kept; desktop pin assertions and desktop build/test steps dropped; `desktop/**` path triggers dropped). The legacy line they proved is this unit's removal; `suite/*.json` remain untouched as historical conformance records.
- `cli/src/first_suite.rs`: `oi app` dev launcher repointed `desktop/src-tauri` → `desktop/cradle/src-tauri`.
- `cli/src/dev_world.rs`: machine-config test fixture repointed to cradle paths (`src`/`kernel`, port 1421); disclosure schema unchanged.
- `desktop/README.md`: rewritten for the cradle-only layout.
- Not touched (justified): `docs/**` and the map (design set); `skills/cradle-execution/SKILL.md` (process skill; cites `desktop/ui` removal in prose — absence is the expected state); `scripts/cradle-context-check.sh` (already allowances-aware; its inputs cite no `desktop/core` path); `suite/*.json` (pinned historical run records); `dev-world/session.toml` (banner text, no removed-path reference); `tests/native-action-parity` fixture string `projection:oi-desktop/factory-build` (an id, not a path).

## Post-removal proof

- `npm run build` in `desktop/cradle` — green.
- `cargo check` in `desktop/cradle/kernel` and `desktop/cradle/src-tauri` — green; `cargo test` kernel — 25 green.
- `node walk/run.mjs all` — 3 consecutive all-green runs (rest / surfaces / kernel-cas).
- `git grep -l "desktop/ui\|desktop/core" -- ':!docs' ':!.superpowers'` — only historical records (suite jsons, workflow history in W7/W8 names) — no live wiring.
