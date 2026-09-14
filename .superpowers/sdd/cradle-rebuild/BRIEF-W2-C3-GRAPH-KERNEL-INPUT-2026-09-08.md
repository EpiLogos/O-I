# Wave 2 · Cell 3 — Typed graph kernel input (owner repo: O-I, kernel only)

Binding: WAVE-2-HANDOFF-2026-09-08.md; wayfinder U3.1/U3.4; invariant "product
owner → canonical operation/read model → O:I/AIKit composition → cradle kernel
adapter → presentation input". Depends on reviewed cell-1/cell-2 returns. One
worker, this cell only.

## Goal

Adapt the accepted owner readings into one typed graph input for U3.1/U3.4
presentation. Adapter only: no semantic storage, no invented capability state.

## Verified current ground (O-I cradle-p1 cc4f401)

- Thin knowledge transport: desktop/cradle/kernel/src/knowledge.rs (Search /
  Read / Relations / Explain / History / Use over `oi aikit --json -C <project>
  knowledge ...`), with truthful provider-loss error preservation.
- KernelOp::Knowledge: kernel/src/lib.rs:157; read-before-use enforcement and
  knowledge_refs provenance records at lib.rs:398-411.
- Exact-binding test precedent: kernel/tests/flow_return.rs requires explicit
  absolute executable paths and fails loudly when unset.

## Deliverable

- A typed GraphReading input: nodes (stable owner ref, kind, label, owner
  provenance, available Action refs), edges (typed relation, both endpoint
  refs, provenance), counts, and explicit unavailable/deferred inputs.
- Shared-field graph projection is a named deferred owner input in the type —
  absent is a truthful state, never an empty fabrication. No Shared Field
  implementation enters this wave.
- Assembly = Central wiki read model (cell 1) + AIKit resolution/relations
  (cell 2). Failure of one input degrades that input honestly.
- No persistence, no cache, no index, no ranking in the kernel.

## Files you may touch (O-I only)

kernel/src/knowledge.rs, kernel/src/lib.rs (new KernelOp variant + provenance),
one new module (e.g. kernel/src/graph.rs), one new test
kernel/tests/graph_input.rs. Nothing under src/, src-tauri/, walk/.

## Real tests required

Explicit absolute OI_BIN / OI_CENTRAL_CTRL_BIN / OI_AIKIT_BIN bindings (fail
loudly when unset), isolated temp Central ground + isolated AIKIT_HOME:
- Node/edge counts equal the owner counts from the cell-1/cell-2 fixtures.
- Every node ref round-trips through its owner read.
- Absent wiki → explicit unavailable input, not an empty graph.
- `cargo test --manifest-path desktop/cradle/kernel/Cargo.toml` green.

## Worker law
No spawning agents; no branch/worktree changes; no commit/push/reset; no live
user ground; no PATH binaries; no owner-repo edits; no presentation files —
input-shape mismatches go back to the orchestrator as questions, not local
workarounds.

## Receipt

`w2-c3-graph-kernel-input-receipt.json`: bound executable sha256s, test log
refs, the GraphReading JSON schema, counts-comparison evidence, explicit gaps.
Confidence is not acceptance.
