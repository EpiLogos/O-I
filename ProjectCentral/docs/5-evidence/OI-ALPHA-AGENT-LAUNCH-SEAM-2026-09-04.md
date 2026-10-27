# O:I physical inhabitation alpha — Agent launch seam (2026-09-04)

## Folded-in parallel work (verified)

- All six non-O:I repos are on clean `main`, up to date with origin/main
  (Central #122, Actuation #25, Factory #187, QL-MEF #96 gitignore PRs merged).
- O:I stays on `agent/cmux-recognition` (PR #189 unstable, not merged); a clean
  worktree at `.central/worktrees/O-I-main` (`ed42789`) carries the authoring.
- The **carrier** exists in that worktree: `dev-world/session.toml` (AIKit
  SessionSpec schema 1, 10 windows / 14 panes, `@project/*` tokens),
  `dev-world/session-space.json` (`session-space/oi-development`, 7 Projects,
  parent Pi attachment, 4 provider native refs, default focus on the parent Pi),
  and `Control/machines/current/oi-development.toml` (machine-local checkout
  roots, provider binaries, parent Pi session id, desktop path).
- Real tmux proof stands (private socket): clean launch → 10 windows / 14 panes
  with correct cwd; re-run idempotent (`actions: []`, `created: false`); manual
  splits and long-running processes survive re-run.

## The two bootstrap gaps — closed

### 1. AIKit AgentProfile (compose seed)

Authored `agent/epilogos/oi-development` in the AIKit home
(`~/.aikit/agent-profiles/epilogos/oi-development.toml`), harness `claude`,
description tying it to `session-space/oi-development`.

`aikit compose --profile agent/epilogos/oi-development --json` now returns a
real `ComposePlan`: agent → (model unset, reported honestly) → harness `claude`
(native) → payload (none). The model lane is deliberately unset until a reviewed
model is admitted; no model is invented.

### 2. World join into the bootstrap

ai-kit branch `feat/actor-bootstrap-session-space` (pushed to origin) adds an
optional `session_space: Option<SessionSpaceRef>` to `ActorBootstrap` and
`ActorBootstrapRequest`. The managed `aikit-context` Skill now renders
`SessionSpace: session-space/…` as a stable ref (with an explicit "inspect
membership + machine World on demand" note), and `actor_world_disclosure` folds
the SessionSpace into the H4 horizon.

The field is caller-supplied (the World-owning launcher supplies
`session-space/oi-development`); AIKit never infers the World. Backward
compatible (serde default, `ActorBootstrapRequest` keeps `Default`).

Verification: `aikit-core` + `aikit-adapters` tests pass, including the two
actor-bootstrap suites; `cargo check --workspace` clean. (One pre-existing
environment drift noted: `aikit-adapters --test bkmr_real` asserts BKMR `6.5.0`
but the machine now reports `7.6.7` — unrelated to this change.)

## Live-state divergence recorded (not yet resolved)

ai-kit has two design lines that the installed binary contains but no single
branch does:

- `main` (harmonised): thin bootstrap — `actor_bootstrap.rs`, `aikit-context`.
- `codex/full-shape`: compose flow — `agent.rs`, `compose.rs`, portal/ops
  (50 commits, ~865 behind main's merge-base).

The installed `aikit` binary exposes both surfaces, so `aikit compose` (the
AgentProfile consumer) and the `aikit-context` bootstrap (the World seam) are
both real today, but reconciling `codex/full-shape` into `main` is a separate
architectural decision — **not** done here.

## What now holds together

```text
carrier (session-space/oi-development + SessionSpec + machine config)
    ↓ oi dev world launcher (to wire) resolves tokens + reconciles
AIKit AgentProfile agent/epilogos/oi-development  →  aikit compose plan
    ↓ project into harness
aikit-context thin bootstrap  →  Project / Run / Agent / Agency / Host /
    Harness / Model / session / SessionSpace (World) / horizons / body pointer
    ↓ on demand
oi recognition inspect / oi current-world  →  reconciled machine World account
```

## Next physical pressure

Implement `oi dev world` so the launch is one coherent act: resolve `@project/*`
tokens, reconcile SessionSpec + SessionSpace, supply `session_space` into the
harness projection, and surface the O:I World-recognition account to the Agent
at launch (refs, not a copied account). Then run a real Claude/Codex session
from the resolved Project and confirm the `aikit-context` skill lands on disk
with the SessionSpace and the Agent can reach the O:I World account.
