# Central — branch research table (N2, [OI-GIT-NORM])

Researched 2026-09-05, read-only. Base: local `main` = `origin/main` @ `07dcfb3` (2026-09-05).
Unmerged remote branches (tip not contained in main by ancestry): **14**. Class counts:
**0 MERGE-RECENT · 0 QUARRY · 14 SUPERSEDED-DELETE · 0 KEEP-LIVE**.

Evidence basis: per-file comparison of every branch's three-dot diff against main
(`git diff main origin/<b> -- <file>` per changed file), plus feature-presence greps.
**Finding: no branch adds a single file that main lacks, and every branch's key
feature is live on evolved main** — Central landed its work by re-derivation/squash,
not by ancestry merge. The branches are historical stacks whose shared-file versions
are older than main's. This is the "looks unmerged, actually landed" pattern at repo
scale; the hazard runs the *safe* direction (deleting loses only commit history, not
content).

| branch | ahead | tip-date | files | content summary | cross-repo refs | proposed verdict (reason) |
|---|---|---|---|---|---|---|
| agent/oi-watch-notification-conformance | 25 | 2026-08-17 | 20 | UserNotification Port + macOS Notification Center Connector + Personal authored-ground Actions + O:I Watch conformance fixture (#51/#52) | O:I Watch (5), AIKit TUI | SUPERSEDED-DELETE (UserNotification + notification.rs live in connector-sdk/connectors/macos; subsumes the two branches below — keep this branch's history last if quarried) |
| agent/personal-surface-notifications | 24 | 2026-08-17 | 19 | same stack minus the Watch conformance fixture | AIKit TUI | SUPERSEDED-DELETE (zero unique diff vs the row above) |
| build/central-ticket-14 | 16 | 2026-08-14 | 15 | native Work entry + reconciliation registry, macOS connector composition (#14) | — | SUPERSEDED-DELETE (zero unique diff vs agent/oi-watch-notification-conformance) |
| build/central-ticket-15 | 36 | 2026-08-15 | 30 | descriptor-driven Raycast Surface (TS package) + bidirectional Shortcuts + Automation Connector + public Action descriptor schema + feature CI (#15) | — | SUPERSEDED-DELETE (all 5 raycast files byte-identical on main; shortcuts connector live) |
| build/central-ticket-16 | 40 | 2026-08-15 | 30 | recovery composition: Synchronizer contract, macOS Homebrew/chezmoi recovery stack, recovery Action catalog | oi-connector (3) | SUPERSEDED-DELETE (Synchronizer live in connector-sdk + git-sync; recovery tests live in connectors/macos) |
| agent/projectcentral-authored-ground | 11 | 2026-08-19 | 11 | ProjectCentral authored-ground Actions/proposals exposed through ctrl + portable real-specimen tests + PROJECTCENTRAL-CONTRACT docs (#70, #60) | AIKit (22), O:I (18), Workcell (2) | SUPERSEDED-DELETE (projectcentral_ground.rs + 3 ground tests live on main; Track-K reads main, not this branch) |
| agent/projectcentral-now-day | 9 | 2026-08-19 | 6 | ProjectCentral NOW/DAY temporal lifecycle + action coverage + temporal contract doc (#74) | aikit (2), O:I (3) | SUPERSEDED-DELETE (projectcentral_now.rs + PROJECTCENTRAL-NOW.md live on main) |
| docs/central-human-altitude-framing | 14 | 2026-08-19 | 13 | Central vision framing: human attention, recursive return, outward handoff docs, stacked on authored-ground | O:I (32), AIKit (30), Workcell/Actuation/Quaternal | SUPERSEDED-DELETE (CENTRAL-VISION.md + handoff docs live on main in evolved form) |
| feat/layered-agent-governance-sources | 18 | 2026-08-19 | 16 | layered human-authored Agent governance source model + read models + proof tests, stacked on vision docs (#70, #71) | AIKit (44), O:I (32) | SUPERSEDED-DELETE (agent_governance.rs + AGENT-GOVERNANCE-SOURCES.md live on main — K1's ground is main) |
| feat/flow-source-93 | 14 | 2026-08-23 | 9 | Flow role-composition with source roles, Horizon/DAY integration, PROJECTCENTRAL-FLOW.md; tip committed by github-actions bot (Flow compose loop) | aikit (3), WORKCELL, #93 | SUPERSEDED-DELETE (projectcentral_flow.rs + PROJECTCENTRAL-FLOW.md live on main; note bot-authored tip before any ruling) |
| feat/oi155-recursive-world-agentset | 2 | 2026-08-31 | 2 | recursive World, propagation, AgentSet + placement source model (OI155) | Workcell (WorkcellClass) | SUPERSEDED-DELETE (AgentSet live in ctrl/src/world.rs + central_computer.rs) |
| oi157/source-history-provider | 7 | 2026-09-01 | 7 | provider-neutral SourceHistory Port + Git SourceHistory provider + application seam (OI157) | — | SUPERSEDED-DELETE (source_history.rs live in connector-sdk and git-sync; only stale ctrl/src/lib.rs version differs) |
| oi97-ubuntu | 18 | 2026-08-21 | 14 | Ubuntu host binary + Ubuntu connectors (acceptance/conformance/recovery) + hosted-Linux CI (#17) | o-i | SUPERSEDED-DELETE (connectors/ubuntu + hosts/ubuntu live on main, 8 files) |
| fix/gitignore-build-artifacts | 1 | 2026-09-03 | 1 | .gitignore Rust build artifacts | — | SUPERSEDED-DELETE (already byte-identical on main; nothing to merge) |

## Repo state

- Unpushed main commits: **0** (matches programme §2).
- Stale local branches / worktrees: none (single worktree on main; only local branch is main).

## Hazards / notes for S-PRODUCTS

1. All 14 are *content*-superseded, not ancestry-merged: GitHub will show them as
   "not merged" forever. Deleting after owner ruling loses no code, only the
   commit-by-commit design narrative — if that narrative is wanted anywhere, quarry
   `agent/oi-watch-notification-conformance` and `feat/layered-agent-governance-sources`
   histories first (they carry the richest test/doc semantics).
2. `feat/flow-source-93` tip is bot-authored (Flow verification pulse) — do not
   treat its commit messages as human design record.
