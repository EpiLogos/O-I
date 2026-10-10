# The Hermes gateway contract — captured behavior, repo home

The captured, replay-verified contract of the owned Hermes harness
gateway (upstream `20f7ef4d`, v0.21.1), reverse-engineered 2026-10-07
through 2026-10-08 by the flow
`Control/agents/now/flows/hermes-gateway-re-20261007/`. This directory is
the contract's **repo home**: the executable guard lives here, in the
tree it protects, instead of in a flow folder.

## What is here

| Artifact | What it is |
| --- | --- |
| `replay-vectors.json` | the captured wire truth: 11 replay vectors from the live stdio session (isolated `HERMES_HOME`, zero inference calls, live state untouched) |
| `gate1-replay.py` | the replay gate: replays the vectors against the stub and asserts the responses byte-for-byte. Evidence record: gate1 PASS 13/13 (flow `evidence/`) |
| `rust-stub/` | the clean-room `hermes-gateway-stub` — the captured behavior as a runnable service (205-line `src/main.rs`, replay-verified) |

The full specification of record — `A1-gateway-surface.md` (225 methods,
34 events, stdio+WS auth, errors), `A2` config schema and precedence
(880 keys / 95 groups), `A3` lifecycle, `B-parity-table.md` and the
`convergence-backlog.md` (live execution-status log) — stays in the flow
folder beside its evidence bundles; this README names it rather than
duplicating it.

## The drift lock — how to run it

```sh
cd gates/hermes-gateway/rust-stub
cargo build --release
# target listens on the captured port; see gate1-replay.py's header
python3 ../gate1-replay.py        # exit 0 = the captured contract still holds
```

A Hermes upstream update that changes the captured behavior fails this
gate instead of rotting a spec. When it fires: re-capture (the flow's
`captures/capture_stdio.py`, isolated HOME), update the vectors, re-run,
and update `A1` + the parity table through the flow's own convergence
backlog — the loop is recorded as the
`harness-gateway-convergence` method (Control/user/skills).

## Promotion status (honest)

- The stub's promotion into a product test crate is INDEX open item 7 —
  an owner call, recorded, not taken.
- The delta watch (`delta-watch.py`, flow `captures/`) is triggered-not-
  scheduled by design and its trigger has no registered owner yet.
- The four landed integrations of this contract: `protocol.rs`'s
  capabilities rule, the refuse-to-write config law, the walk-bridge
  fan-out invariant, and the temporal-event system (O-I #615/#618/#626/#634).
