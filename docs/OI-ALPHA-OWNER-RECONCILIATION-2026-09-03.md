# O:I physical inhabitation alpha — owner-capability reconciliation (2026-09-03)

## Test oracle (independently inspected machine, 2026-09-03)

| native system | observed | state |
|---|---|---|
| cmux | 0.64.22 (102) `ddd4a01bc`, `/usr/local/bin/cmux` | daemon not running |
| tmux | 3.6a, `/opt/homebrew/bin/tmux` | server running |
| Herdr | 0.8.2, `~/.local/bin/herdr` | live |
| Claude Code | 2.1.238, `~/.local/bin/claude` | installed |
| Codex CLI | 0.153.0, `/opt/homebrew/bin/codex` | installed |
| Gemini | `/opt/homebrew/bin/gemini` | broken (missing simdjson dylib) |
| Pi | 0.84.4, `~/.local/bin/pi` | installed |
| Ollama | 0.12.6, `/usr/local/bin/ollama` | installed |
| Docker | `/usr/local/bin/docker` | installed |

## What O:I disclosed before this change

`oi recognition inspect /Users/admin/Central` recognised only **cmux** and **Herdr**.

- cmux observation carried `owner_bindings: []` even though AIKit ships an accepted
  cmux working-environment/SessionSpace provider. → **owner/composition discovery defect**.
- Herdr's AIKit binding existed only because the built-in recogniser hard-coded
  `aikit.herdr-working-environment/v1`. → anti-pattern for the generic seam.
- tmux, Claude, Codex were physically present and already related to the installed
  AIKit (`aikit mux detect`, `aikit client status`), yet O:I disclosed none of it.
  → the answer to "why cannot O:I already tell the human and Agent that tmux exists
  and AIKit has a known relation to it" is: **the whole-level account never queried
  the installed native owners' adapter/provider/connector registries.**

## Change

`oi.world-recognition` now runs an owner-participation reconciliation pass after
native recognisers. It is O:I-owned whole composition, not recogniser-local, and it
hard-codes no AIKit semantics into any native recogniser.

The first implemented owner source is AIKit's public registry disclosures:

- `aikit mux detect --json` → `aikit.working-environment-provider/v1` (tmux, cmux)
- `aikit client status --json` → `aikit.harness-adapter/v1` (claude, codex, opencode, cursor)

Each participation carries owner, native system identity, contract, readiness state
(`installed` / `installed-running` / `installed-not-running` / `installed-unprojected`
/ `degraded`), readiness facts, and source provenance. Recognised observations are
joined to matching participations by native name/system ref, so cmux now carries its
AIKit binding without the recogniser knowing AIKit semantics.

The account adds `owner_participations` (owner-discovered systems surfacing even
when no O:I recogniser exists, e.g. tmux/claude/codex) and a
`oi:builtin/owner-participation-reconciliation` provider entry.

## What O:I discloses after this change

`oi recognition inspect /Users/admin/Central` now reports:

```text
Owner participations:
  AIKit  claude   aikit.harness-adapter/v1               installed
  AIKit  cmux     aikit.working-environment-provider/v1  installed-not-running
  AIKit  codex    aikit.harness-adapter/v1               installed
  AIKit  cursor   aikit.harness-adapter/v1               installed-unprojected
  AIKit  opencode aikit.harness-adapter/v1               installed-unprojected
  AIKit  tmux     aikit.working-environment-provider/v1  installed-running
```

cmux's observation now carries:

```json
{"owner":"AIKit","contract":"aikit.working-environment-provider/v1",
 "state":"installed-not-running",
 "provenance":["AIKit crates/aikit-adapters/src/mux/cmux.rs","aikit mux detect"]}
```

## Remaining classified gaps (development pressure, not masked)

- **Gemini, Pi, Ollama, Docker** — physically present, not yet disclosed by any
  owner registry query. Gemini is currently broken on this machine. These are the
  next owner-query/recogniser extensions, not a reason to duplicate native support.
- **Harness edition/version** — the owner participation discloses the installed
  relation and readiness but not the exact Claude/Codex version string; that belongs
  to native observation (a recogniser) or an AIKit client-status version field.
- **Desktop/Agent surface parity** — the CLI + JSON account now exposes the same
  actuality to human and Agent. Desktop presentation of the World account is the
  next surface increment.

## Verification

`cargo test` (cli): 14 lib + 13 main + 15 cli + 3 + 1 + 2 + 5 + 3 + 11 + 2 = all pass.
