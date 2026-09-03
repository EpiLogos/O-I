# O:I physical inhabitation alpha — owner-capability reconciliation (2026-09-03)

## Test oracle (independently inspected machine)

| native system | observed | state |
|---|---|---|
| cmux | 0.64.22 (102) `ddd4a01bc`, `/usr/local/bin/cmux` | daemon not running |
| tmux | 3.6a, `/opt/homebrew/bin/tmux` | server running |
| Herdr | 0.8.2, `~/.local/bin/herdr` | live |
| Claude Code | 2.1.238, `~/.local/bin/claude` | installed |
| Codex CLI | 0.153.0, `/opt/homebrew/bin/codex` | installed |
| Gemini | 0.29.5, `/opt/homebrew/bin/gemini` | installed (was broken earlier this session; recovered) |
| Pi | 0.84.4, `~/.local/bin/pi` | installed |
| Ollama | 0.12.6, `/usr/local/bin/ollama` | installed |
| Docker | 29.2.1, `/usr/local/bin/docker` | installed |

## Ownership model (corrected)

- **Actuation** owns the model/harness/agent-instance main body:
  `actuation.model-bearing/v1` (plus agency / realised / stream / activity).
- **AIKit** owns operative capability projection — its agent-client adapters project
  skills/sources into clients and its mux adapters drive working environments.
  AIKit does **not** own the harness body.
- **Workcell** owns material/provider execution (`workcell.provider-sdk/v1`).

## What the account now discloses

`oi recognition inspect /Users/admin/Central` composes:

- recognised native systems with version/degraded facts (cmux, Herdr, claude, codex,
  gemini, pi, ollama, docker);
- native-owner participations reconciled from owner registries, not recognisers:
  - AIKit `mux detect` → `aikit.working-environment-provider/v1` (tmux, cmux)
  - AIKit `client status` → `aikit.client-adapter/v1` (claude, codex, opencode, cursor)
- native-owner semantic contracts disclosed from owner registries:
  - Actuation `contract list` → `actuation.model-bearing/v1`, agency, realised,
    stream, activity
- native-owner material capacities disclosed from owner registries:
  - Workcell `providers` → workspace / execution / artifact-storage, with health
- an extension frontier, routed by native ownership:
  - harness / model-provider → Actuation `actuation.model-bearing/v1`
  - material-executor → Workcell `workcell.provider-sdk/v1`

cmux carries its AIKit working-environment binding without the recogniser knowing
AIKit semantics. tmux, claude and codex surface even though no O:I recogniser exists
for them.

## Structure

`discover_world(target, registry)` remains the pure, target-scoped recognition
engine (recognisers + source apertures) so registry tests stay isolated from the
live machine. `discover_ground(target)` layers machine-global native-tool
observation, owner-participation reconciliation, owner-contract disclosure,
owner-capacity disclosure and the extension frontier over it. The CLI
(`oi recognition inspect`, `oi adopt`) and the desktop (`DesktopHost` →
`ShellSnapshot.world_recognition`) consume the full `discover_ground` reading;
the same structured JSON is the Agent surface.

## Agent-as-inhabitant parity

The same account answers the situated questions from structured state alone
(no prompt knowledge): target (where am I), harnesses/models with version,
operative owner participations with state, Actuation-owned semantic fields,
Workcell material capacities with health, degraded facts, and the extension
frontier with owner + SDK. Human (CLI text) and Agent (JSON) read the same
underlying actuality; only presentation differs.

## Remaining classified gaps

- **Desktop React rendering** — now done. `WorldRecognitionNavigator` (plus the
  pure `world-recognition-model.mjs` render model and its node tests) discloses
  the reconciled World in the navigator: systems with version/degraded facts,
  owner bindings, Actuation contracts, Workcell material capacities, the
  extension frontier and provider errors. Default view stays a summary; detail
  is collapsible.
- **Continuing-run reconciliation** — the account re-observes on each run and
  now also on demand from the desktop: `DesktopHost::reconcile_world()` +
  `reconcile_world` Tauri command + a "Re-observe World" control. The account
  refreshes the read model without a restart. Automatic rescan-on-change
  (start/stop/install of tools detected without any user action) is still not
  wired; a filesystem watch/periodic re-observe is the next deterministic step.
- **Central connector/machine registry** is not yet queried as an owner source
  (Central exposes `ctrl capabilities`/`ctrl doctor`; its connector Ports are the
  next authored-ground case).

## Verification

`cargo test` (cli): all pass.
`cargo test` (desktop-core): all pass, including World-account shell-snapshot
and `reconcile_world` refresh tests.
`cargo check` (desktop src-tauri): passes.
`node --test` (desktop ui): 70 pass.
`npm run build` (desktop ui): tsc + vite build pass.
