# Agency Gateway — awareness brief for the desktop programme

**Status:** session-authored interjection (2026-09-06), for the desktop
execution programme. Not a new spec — the spec is
[EpiLogos/O-I#154](https://github.com/EpiLogos/O-I/issues/154). This brief
exists because the gateway is currently invisible to this programme's own
awareness channels, and the desktop will either consume it or accidentally
duplicate it.

## What the gateway is (three sentences)

The Agency Gateway is the persistent encounter/contact plane through which the
**same Agency and attributable ActuationStream** remains continuable across
embodied communication contexts — Cradle/desktop, harness UI, terminal, and
external connectors (Telegram first; Discord/Slack/Matrix/webhook later). It is
specified as one small Workcell-hosted Rust service with a WebSocket network
carrier and UDS local carrier, a public connector SDK, and strict
identity law: provider conversation IDs never collapse into canonical
AgentSession identity. Its read model (SessionSpaces, Agencies, AgentSessions,
Streams, Surfaces, reachability, granted capabilities) is what makes agency
*legible* from outside any one surface — "presence does not imply authority."

## Ground truth — what exists, what is dead

Verified 2026-09-06 by direct inspection:

| Piece | Standing | Evidence |
|---|---|---|
| Gateway runtime + connector SDK + Telegram adapter | **built, unexposed** | `Work/ai-kit/crates/aikit-adapters/src/{gateway_service,gateway_runtime,gateway_connector,telegram_gateway}.rs` (~3.6k lines); binary `bin/aikit-gateway.rs` (`serve --ws/--unix/--state-file`, token auth) |
| CLI/setup exposure | **absent** | zero gateway surface in `ai-kit/crates/aikit-cli`; the binary is bare, nothing in `oi init`/bootstrap chains to it |
| Workcell hosting + fabric placement | **landed as materiality** | `Workcell/crates/workcell-runtime/src/reference_services.rs` (AIKit Gateway managed service); `workcell-tailscale/tests/aikit_gateway_fabric.rs` proves stable logical identity across fabric facts |
| ActuationStream (issue #154 step A) | **contract-tested only** | `Work/Actuation/docs/ACTUATION-STREAM.md`; capability matrix: "contract-tested; provider persistence and cross-surface deployment not exercised" |
| Cradle architecture placement | **authored** | `docs/cradle/02-ARCHITECTURE.md` §1/§3/§4: `AgencyService` composes Gateway #154; `agencies` field is "Gateway-informed"; ladder names Gateway UDS + Gateway WebSocket seams |
| This programme | **blind** | zero gateway mentions in `IMPLEMENTATION-PROGRAMME-2026-09-06.md` slices 0–8 and `BOOTSTRAP-AND-LOADING.md`; `OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md:279` lists "Gateway continuity" as **fog** |
| M-prime capability routing | **blind** | `suite/desktop-projection.json` and `suite/product-capabilities.json` carry no gateway capability rows — the desktop agent cannot discover this feature set through its designed awareness channel |

So the gateway is not unbuilt — it is **half-built and disconnected**: body in
AIKit, hosting in Workcell, contracts in Actuation, architecture in the Cradle
docs, and no path from any of it into bootstrap, setup UX, or a programme slice.

## Why the desktop owns seams to it (not the implementation)

- #155's acceptance target is desktop UX riding the gateway: a live
  AgentSession exposed through the Gateway, encountered in ordinary
  interaction, legible in semantic Activity, opened into the Session
  Observatory, detached and re-projected through another Surface — the same
  canonical session/stream throughout (W4/W6/W10 consume #154's ecology).
- #158 makes this gateway the normal encounter relation between the primary
  machine and the second-machine Omarchy Reference World. Desktop↔remote
  Workcell continuity is *through this*, not through a parallel mechanism.
- **Hard boundary (from #154's coordination comment):** the desktop must not
  introduce a second websocket, session registry, connector ontology, or
  provider conversation identity. Presentation correlates back to the
  Agency/AgentSession/ActuationStream state owned elsewhere.

## Interjection points — mapped to the existing slices

1. **Slice 3 (Situated agency):** `AgencyService` consumes the gateway's
   authorised ecology read model for `AgencyPresence` / session attach —
   AIKit-side attach, never a desktop-side session registry. Existing-session
   attach (already ordered before streaming) is exactly where gateway
   visibility belongs.
2. **Composition truth (Slice 5 / `EffectiveComposition`):** gateway becomes a
   presence dimension — present / degraded / absent — with CurrentWorld
   explaining it like any other product. Absent-and-silent is the current bug
   shape; absent-and-named is the fix.
3. **Bootstrap:** one recovery branch in `BOOTSTRAP-AND-LOADING.md` for the
   gateway/ecology, same honesty law as the other product branches — at
   minimum "gateway absent, here is what is not reachable".
4. **M-prime routing:** gateway capability rows in `product-capabilities.json`
   + `desktop-projection.json`, sourced from the AIKit/Workcell refs above, so
   capability-based awareness stops being structurally blind.
5. **UX states (03-UX-STATES):** surface detach/re-projection and remote
   encounter states derive from "Gateway continuity" (already cited at :103 as
   a derivation source) — keep those states honest about which seam served
   them (provider-truth law, 02-ARCHITECTURE §10).

## Open for the owner (not decided here)

- Whether #154's completion (ActuationStream provider persistence, first
  Telegram acceptance run, `aikit` CLI exposure) is commissioned now as its
  own line feeding this programme, or the desktop only reserves the seams
  above and stays consumer-side until #154 lands. The fog entry in the
  wayfinder resolves to one of these two, not to silence.
- Where this awareness durably lives if not here: candidate home is the docs
  tree / #154 itself; this working file is the shareable interim.

## Update 2026-09-06 (later) — the AIKit side landed; the bootstrap fold

The AIKit line of this brief is now executed (commit `f80d6fe` on ai-kit
`main`, plus a follow-up for the bootstrap fold; not pushed). What this
changes for the desktop programme:

- **The gateway now has a product front door**: `aikit gateway
  serve|protocol|discover|status|ecology|snapshot`, both carriers, house JSON
  envelope. The ecology read model (#154 step D) exists: agencies/sessions/
  streams/surfaces derived from bindings+journals, five invocation modes,
  `presence-does-not-imply-authority`.
- **One well-known endpoint**: `~/.aikit/state/gateway.sock` with semantic
  state at `~/.aikit/state/gateway.json`. Flagless serve binds it; flagless
  queries find it; restart restores identity and journals from the default
  state file.
- **`aikit doctor` now carries `gateway.service`**: note-with-version when
  answering, warning when the socket is present but dead, note-with-start-
  command when not running. This is the single honest probe the desktop
  bootstrap should consume for gateway presence — not a bespoke socket check.

### The three UX lanes and what each consumes

1. **User ↔ desktop lane** (this programme): composition truth reads gateway
   presence through the doctor/status probe; the bootstrap branch for the
   gateway names the same well-known endpoint; CurrentWorld explains
   present/degraded/absent in those words. The desktop never binds the
   default socket itself — it addresses what `aikit gateway serve` (or a
   Workcell materialisation of it) already bound.
2. **User ↔ terminal lane** (landed in ai-kit): flagless serve/query at the
   default endpoint; honest `cli.gateway_unreachable` failures that name the
   start command; `aikit gateway serve --ws HOST:PORT --ws-token` as the
   deliberate network posture.
3. **Agent UX lane** (its own UX): agents address the same endpoint through
   the CLI's `--json` envelope or the carrier protocol directly
   (`aikit-adapters::gateway_command`); `ecology` is the discovery surface
   for what is invocable, and invocation remains a separate AIKit capability
   grant, never implied by presence. The desktop's Session Observatory /
   detach-projection states correlate to the same canonical
   Agency/AgentSession/ActuationStream refs this read model discloses.

The M-prime routing rows for the new command group and the 219-command count
remain this programme's to collate (O-I `suite/`, not touched from ai-kit).
