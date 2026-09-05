# Cradle rebuild — execution ledger

Branch `cradle-rebuild` · map of record `docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md`
([OI-CRADLE-REBUILD-WF], issue #190). One row per unit: what is real, what was
walked, what remains. Rulings are ledgered, never re-asked.

| unit | relation | status | what is real | what was walked | what remains |
|---|---|---|---|---|---|
| branch bootstrap | — | done 2026-09-05 | `cradle-rebuild` off `main`; map + `skills/cradle-execution/` carried (e528715 on main, branch inherits); this ledger created as first act on the branch (931c7a4) | `scripts/cradle-context-check.sh` → "context chain intact" | — |
| U0.1 ai-kit substrate | S→S2 | closed 2026-09-05 (owner re-aim) | ai-kit main (e300ed0) is the full shape; D11 port premise aged out (codex/full-shape deleted post-port; modules live as composition.rs/profile.rs/actor_composition.rs). `aikit compose` restored on main + installed; binaries rebuilt from HEAD | `aikit compose --json` in /Users/admin/Central/Work/O-I: ok, plan `aikit.actor-bootstrap/v2`, composition_error null, model/harness honestly unset. Workspace tests all green except 1 env-sensitive TUI test (mux_install timeout, spawns a terminal) | (a) OWNER-AUTHORING, not code: `agent/epilogos/oi-development` exists only in AIKit store ground; `ctrl action run agent-profile.list {scope:personal}` → profiles:[] — the owner authors the Central AgentProfile. (b) Contract change: compose no longer takes `--profile`; the profile is derived through Central and disclosed in the plan's agent field; never fabricated |
| U0.2 Central source-ref canonicalisation | S→S0 | pending | — | — | inspect discloses hash-form refs while source.read/write take path-form (D12) |

## Ruling log

- (none yet)
