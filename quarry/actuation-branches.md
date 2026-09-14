# Actuation — branch research table (N4, [OI-GIT-NORM])

Researched 2026-09-05, read-only. Base: local `main`, tip 2026-09-05
("Detection engine: actuation harness detect proves the catalog live").
Unmerged remote branches: **6**. Class counts:
**2 MERGE-RECENT · 1 QUARRY · 3 SUPERSEDED-DELETE · 0 KEEP-LIVE**.

| branch | ahead | tip-date | files | content summary | cross-repo refs | proposed verdict (reason) |
|---|---|---|---|---|---|---|
| agent/26-prime-recursive-actuation | 3 | 2026-09-04 | 14 | Prime recursive relational Agency experiment: depth-two QL field, harmonic probe evidence (parseable), embedded `ql-relational` skill (Rust) + source-lock + CI (#26, #81) | QL runtime, O:I #81 | MERGE-RECENT (all 14 files new, absent from main; freshest branch in the repo; direct input to the QL/Epi relational line) |
| feat/oi97-native-cli | 1 | 2026-09-03 | 6 | native `actuation` CLI (bin/actuation, cli/actuation.mjs surface, verify --json) | oi-managed install | MERGE-RECENT (CLI code is on main, but `.oi/product.json` on main still declares `contract-component`; the branch carries the `cli`-kind admission + installed-verify commands — small real delta) |
| research/epistemic-cultivation | 18 | 2026-08-16 | 14 | model-bearing agency research: `model-condition.v0` schema + conformance fixtures, source-locked model serving cases, epistemic-cultivation / model-interior research docs, dependency-free CI | O:I (30), AIKit (26), Workcell (23), Quaternal (8) | QUARRY (11 files absent from main; contracts/model-bearing-v1 on main is the evolved operative form — quarry the research semantics + source-locked conformance cases, then delete) |
| feat/actuation-stream-v1 | 5 | 2026-08-27 | 5 | ActuationStream v1 portable contract: schema + ordering/replay proofs + identity/continuity doc | O:I (3), AIKit (3), Workcell (2), #15 | SUPERSEDED-DELETE (all 5 files byte-identical on main — ai-kit's actuation_stream consumer is aligned to the landed version) |
| feat/oi155-semantic-activity | 5 | 2026-08-31 | 5 | semantic Activity v1 projection over the canonical ActuationStream | workcell (4), O:I (3), #155 | SUPERSEDED-DELETE (all 5 files byte-identical on main) |
| fix/gitignore-build-artifacts | 1 | 2026-09-03 | 1 | .gitignore Rust build artifacts | — | SUPERSEDED-DELETE (byte-identical on main) |

## Repo state

- Unpushed main commits: **3 at snapshot end** (was 2 at research start):
  - `27dae35` Harness detection catalog and `actuation.harness-detection/v1` contract
  - `958be8e` Re-point branch-gated CI push triggers to main, drop dead branch entries
  - `e101b03` Detection engine: actuation harness detect proves the catalog live —
    **appeared on local main during this research**: a parallel N0 push-floor unit is
    active in this repo. Counts here are a snapshot; re-verify before S-PRODUCTS rules.
- Stale local branches / worktrees: none (single worktree on main).

## Hazards / notes

1. Harness detection is a live line: local main carries a brand-new contract
   (`actuation.harness-detection/v1`) invisible to origin until N0 pushes.
2. `feat/oi97-native-cli` looks fully landed (bin/ + cli/ exist on main) — the
   remaining delta is only the `.oi/product.json` artifact-kind admission
   (`contract-component` → `cli`, entry `bin/actuation`, installed verify command).
   Suite manifests reading main today describe the wrong artifact kind.
