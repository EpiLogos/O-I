# Workcell — branch research table (N6, [OI-GIT-NORM])

Researched 2026-09-05, read-only. Base: local `main`, tip 2026-09-05
("Re-point secret-conformance CI push trigger to main").
Unmerged remote branches: **1**. Class counts:
**0 MERGE-RECENT · 0 QUARRY · 1 SUPERSEDED-DELETE · 0 KEEP-LIVE**.

| branch | ahead | tip-date | files | content summary | cross-repo refs | proposed verdict (reason) |
|---|---|---|---|---|---|---|
| feat/aikit-gateway-service | 3 | 2026-08-31 | 3 | AIKit gateway managed-service specimen over Tailscale Fabric: `aikit_gateway_service` + `hermes_gateway_service` reference services, AIKIT_GATEWAY_APPLICATION_PROTOCOL/MANAGEMENT_SOURCE metadata, gateway fabric test | ai-kit (21 aikit / 16 AIKIT / 1 ai-kit refs), Actuation (1) | SUPERSEDED-DELETE (all 3 files exist on main in evolved form — main re-pinned `AIKIT_GATEWAY_SOURCE_REVISION` from `bf51ee5…` (branch) to `4b614a7…`; both revisions verified present in ai-kit, so no dead pin) |

## Repo state

- Unpushed main commits: **3**:
  - `70a04fb` Record that executable identity is answered locally
  - `7a7fb72` Merge docs: cursor/executable-identity-doorway-4a68 (CONTROL-SERVICE-AND-AGENT-HOSTING) into main
  - `dc076fd` Re-point secret-conformance CI push trigger to main
  Content: the executable-identity / control-service-and-agent-hosting docs line
  plus the same branch-gated-CI cleanup the other repos received.
- Stale local branches / worktrees: none (single worktree on main).

## Hazards / notes

1. None. The single unmerged branch is an earlier pin of work that is live on main;
   the pin it carried (`bf51ee53…`) still exists in ai-kit, so even the stale
   reference is not dead. After N0 pushes main, this repo is fully normalised with
   one delete.
