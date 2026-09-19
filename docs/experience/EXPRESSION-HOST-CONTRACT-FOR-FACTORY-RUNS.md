# The Expression host contract for Factory Runs

**Standing:** agent-authored receiving contract, 2026-09-19 (Mac Track 3), for the
parallel Factory-Runs lane ("Track 2"). It names the existing seams a Factory Run
uses to host and operate Expressions. It conveys **no Factory semantics ownership**:
Runs, Methods, artifacts and Recognition stay with Factory's own contracts
(`docs/program/NATIVE-WORKFLOW-AUTHORING.md`, O-I #401/#403 receiving contracts).

## The one seam

A Run hosts an Expression through the same typed `KernelOp` seam every surface
uses — no second API, no DOM access, no corpus-specific runtime:

```text
KernelOp::expression          (kernel/src/expression.rs)
KernelOp::expression_world    (kernel/src/expression_world.rs)
```

Wire shapes mirror `desktop/cradle/src/expression/world.ts` and
`desktop/cradle/src/expression/types.ts` exactly (tag `operation`, snake_case,
unknown fields refused kernel-side).

## Operations a Run may perform

| Need | Operation | Proof walk |
|---|---|---|
| materialise corpus/agent output | `expression {operation:"open", document, actor}` after the existing artifact import (`src/expression/artifactImport.ts` — `oi.journey` → `oi.expression/v1`) | `walk/scenarios/corpus-return-of-zero.mjs` leg B |
| read current state | `expression {operation:"inspect", expression_ref}` | same, leg C |
| list what exists | `expression {operation:"list"}` | same, leg B |
| reversible composition | `expression {operation:"edit", expected_revision, changes:[…], actor}` — CAS; a stale `expected_revision` is refused | `expression-world-join` §3 |
| shared selection | `expression_world {operation:"selection_set"|"selection_read"}` — one canonical selection; origins: graph/wiki/expression/agent/page | corpus walk legs D, join walk §2–3 |
| open the native source | `expression_world {operation:"portal_open"|"portal_inspect"|"portal_redock"|"portal_close"}` — honest `unavailable_surface` refusals | corpus walk leg E |
| bounded long composition | `expression_world {operation:"act_perform", act_ref, expected_revision, changes, activity_ref}` → `act_interrupt` (human hold) → `act_checkpoint` → `act_restore` | corpus walk leg F |
| source currentness | `whole_bind` / `whole_inspect` / `whole_rebase` — rebases refuse a stale expectation and a no-op; nothing rebases silently | corpus walk leg G |

## Correlation and authority

- `actor` is a string the caller owns (`agent:<run>` / `human:<who>`); it is
  attribution, never authority. Authority stays with the native owners of the
  subject refs the Expression binds.
- `activity_ref` on world operations is caller-supplied correlation. A Factory
  Run may carry its own Run/attempt ref there so evidence joins back to the
  Run — Factory reads its own ledger; the kernel does not become a Factory
  consumer.
- Semantics of the composition (which subjects, which relations) resolve through
  the knowledge/Wiki projection (`walk/scenarios/knowledge-expression.mjs`), not
  through Run-private state.

## Degradation law

Every unavailable thing is named, never fabricated: an unavailable portal target
returns `unavailable_surface`; a stale basis returns `whole_basis_conflict`; a
no-op rebase returns `whole_unchanged`; engine-less surfaces disclose absence
(walk `rest`). A Run must treat these refusals as data, not retry blindly.

## What this contract does NOT do

- It does not let a Run write native sources except through the owner's own CAS
  write (`source_save`) — Expressions are presentations, and subject mutation
  goes through the native owner's Actions.
- It does not give Factory a renderer: presentation stays in the cradle's one
  Global Expression Stage (`oi.cradle` walk law — no new renderer authority).
- It does not define Runs, attempts, trajectories or Recognition.
