# O:I Development World — carrier + runbook

One canonical development SessionSpace for the whole O:I suite, materialised as
one resumable parent Pi AgentSession plus simultaneous provider disclosures
(tmux floor, HerdR default, O:I Desktop integrated, cmux optional).

## Identity law (unchanged)

```
HerdR Workspace  ≠ SessionSpaceRef
tmux session     ≠ SessionSpaceRef
HerdR pane       ≠ SurfaceRef
tmux pane        ≠ SurfaceRef
Pi process       ≠ AgentRef
terminal process ≠ AgentSessionRef
```

The provider objects materialise and locate canonical relations; they do not
become those relations. Canonical identity is AIKit-owned:

```
session-space/oi-development
  ├── project/epilogos/o-i          (parent context)
  ├── project/epilogos/central
  ├── project/epilogos/ai-kit
  ├── project/epilogos/actuation
  ├── project/epilogos/factory
  ├── project/epilogos/workcell
  ├── project/epilogos/ql-mef
  └── agent-session/epilogos/oi-parent-pi   (parent Pi, resumable)
```

## Files

| File | Role | Machine-specific? |
|---|---|---|
| `session.toml` | AIKit `SessionSpec` (schema 1): the portable tmux layout — one window per repo plus `world`, `desktop`, `parity`. | No — `cwd` carries `@project/<key>` tokens. |
| `session-space.json` | `SessionSpaceAuthoredState` seed: canonical id, Project membership, parent Pi attachment, provider native refs, default focus. | No. |
| `Control/machines/current/oi-development.toml` | Checkout roots, provider binaries/preferences, parent Pi session id, desktop launch path. | **Yes** — never committed. |

## Launch (target operator experience)

```sh
oi dev world                # resolve the World and delegate materialisation (tokens resolved)
oi dev world status         # compact readout: SessionSpace + active providers + parent Pi
oi dev world focus pi       # resume/focus the parent Pi AgentSession (no new Pi minted)
```

`oi dev world` now resolves `@project/*` and `@parent` tokens against the
machine-state file, writes the token-resolved spec to a temp file, and prints
the delegated `aikit session up <resolved>` — it observes and resolves, never
mutates. Provider materialisation (`--provider herdr|tmux|desktop`) and
`focus pi` remain the next launcher increments.

Re-running any launcher form is idempotent and non-destructive: it never creates
`oi-2`, a second Pi, a duplicate desktop session, or duplicate panes.

## What is live now (real tmux floor)

The real tmux world is materialised on the user's normal server as session
`oi-development`:

```text
world     O:I parent shell + parent Pi Surface
o-i       O-I Project shell
central   Central Project shell
aikit     AIKit Project shell
actuation Actuation Project shell
factory   Factory Project shell
workcell  Workcell Project shell
ql        QL-MEF Project shell
desktop   desktop dev/server + logs/test
parity    SessionSpace/provider observation + Activity/Action/reconciliation
```

Proven (against a private socket, same code path):

- clean launch → 10 windows, 14 panes, correct per-project cwd;
- re-run → `actions: []`, `created: false`;
- manual split in a window survives re-run (untagged panes are never removed);
- a long-running process in a pane survives re-run;
- AIKit restart (re-invocation) reconstructs the same binding, never a duplicate.

Manual equivalents while the provider/focus increments land:

```sh
# tokens resolve via 'oi dev world'; then reconcile idempotently
aikit session up dev-world/session.toml
aikit session diff dev-world/session.toml
aikit session attach oi-development
```

## Parent Pi continuity

`open my O:I Pi` means resume/focus `agent-session/epilogos/oi-parent-pi`, not
spawn another Pi. The machine-state file records the stable `session_id`; the
launcher uses `pi --session-id <id>` (or `pi --resume` when no id is pinned) so
tmux, HerdR and Desktop become three encounters with one AgentSession.

## Desktop parity role

Keep the real tmux and HerdR worlds alive while testing the Desktop. Every
desktop claim about Project / Agent / Session / Surface / Activity / Action is
checked against the same actuality through another native Surface:

```text
same semantic subject → same canonical Ref → same native owner
  → same Action lineage → same authority → same returned result/provenance
  → different appropriate Surface presentation
```

Provider degradation is explicit: HerdR unavailable ⇒ SessionSpace stays valid,
tmux stays healthy, Desktop reports the degraded provider — no duplicate world.

## Agent launch seam (the two bootstrap gaps, now closed)

The parent Agent launch has its two missing seeds:

1. **AIKit AgentProfile** — `agent/epilogos/oi-development` is authored in the
   AIKit home (`~/.aikit/agent-profiles/epilogos/oi-development.toml`), harness
   `claude`. `aikit compose --profile agent/epilogos/oi-development` now returns
   a real plan (agent → model → harness → payload). The model lane stays unset
   until a reviewed model is admitted; compose reports "no model selected"
   honestly rather than inventing one.

2. **World join** — the thin actor bootstrap (`aikit.actor-bootstrap/v2` →
   managed `aikit-context` Skill) now carries an optional `session_space`
   reference (ai-kit `feat/actor-bootstrap-session-space`). The launcher supplies
   `session-space/oi-development` as the canonical World identity; the bootstrap
   renders it as a stable ref and stays thin (membership and the machine World
   stay on-demand).

Remaining launcher increments (`oi dev world`): provider materialisation
(`--provider herdr|tmux|desktop`), `focus pi`, and supplying `session_space`
plus the O:I World-recognition account into the harness projection at launch.
Until those land, `oi dev world` resolves + delegates and the manual
equivalents above hold.
