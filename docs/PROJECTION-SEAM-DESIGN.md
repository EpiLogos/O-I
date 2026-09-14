# Actuation ↔ Central ↔ AIKit projection seam (reorientation of thread 6)

Status: design + working code. This **replaces** the "port `agent.rs`/`compose.rs`
into AIKit" plan in `OI-INHABITATION-FOUNDATIONS-2026-09-04.md` §6. The port was
the wrong cut: it would have made AIKit own model/harness/loop infrastructure
that Actuation already owns.

## The cut

| owner | owns | projects |
|---|---|---|
| **Actuation** | model/harness/loop reality (Agency, WorldBinding, Harness, Model relation, access profile, bounds, return) | `actuation.model-bearing/v1` — one full object |
| **Central** | authored identity/ground (Agent ref, World, profile/praxis/role intents) | `central.agent-profile/v1` — refs/intents only |
| **AIKit** | operative resolution (agencies/capabilities/contexts relative to those two; harness surfaces) | consumes both as refs, owns neither |

AIKit is the operative tool of/for the Agent. It **resolves per a given Actuation
definition** — it does not re-author Agency, Model, Harness or loop identity, and
does not build a second Model/Harness registry (its own `model_roster.rs` already
says "deliberately does not create another Model registry").

## The seam (built)

```
Actuation  ── actuation.model-bearing/v1 ──► ActuationModelBearingProjection ─┐
Central    ── central.agent-profile/v1   ──► CentralAgentProfileProjection    ├─► compose_actor_inputs
                                                                              │        │
                                                                              │        ▼
                                                                              │   RequestedActors{agent,agency,host}
                                                                              │   + selected_harness / selected_model / agent_session
                                                                              ▼
                                                       application_context_resolution(..., actors)
                                                       + project_actor_bootstrap(request)
```

### What is built

1. `aikit-adapters/src/actuation_model_bearing.rs`
   `ActuationModelBearingProjection` — the full `actuation.model-bearing/v1`
   object as refs+facts. Promoted refs: `harness_ref`, `model_relation.model_ref`,
   `agency_ref`, `agent_session_ref`. `engine`/`material`/`inference_surface`/
   `access_profile` stay nested facts (the contract's own framing: "engine,
   materialisation and surface remain nested refs/facts rather than promoted root
   identities"). Distinct-identity validation.

2. `aikit-adapters/src/central_agent_profile.rs`
   `CentralAgentProfileProjection` — `central.agent-profile/v1` as refs+intents,
   mapping to `CentralAuthoredProjection` (agent + profile/praxis refs; host is a
   separate Central machine relation).

3. `compose_actor_inputs(actuation, central) -> ComposedActorInputs`
   The single place the two authoritative projections meet. `RequestedActors{agent,
   agency, host}` + `selected_harness`/`selected_model`/`agent_session`. Only
   canonical `ResourceRef`s move.

4. Resolution seam: `application_context_resolution(..., actors: RequestedActors)`
   (aikit-core) — the caller-supplied actor refs win; host falls back to the
   descriptor machine hostname. Threaded via
   `aikit_tui::project_world_service::context_resolution_with_actors`.

## What remains (the live fetch — now built)

The shape is complete and wired. `aikit-adapters/src/actor_composition.rs`
(`compose_live_actor_inputs`) fetches and composes per project, and
`aikit-cli/src/app/mod.rs` feeds the result into
`context_resolution_with_actors` + `ActorBootstrapRequest`.

Per project it:

1. reads the Central `agent-profile` (via `ctrl --json --root ROOT action run
   agent-profile.list`, project-scoped, **exactly one** profile or none — never
   guessed);
2. reads the authored Actuation model-bearing receipt from
   `.aikit/actuation-model-bearing.json` when present (absence is `None`, never
   an error);
3. composes via `compose_actor_inputs`; a fetch failure is fail-soft (no
   projection), never a resolution failure.

## What was deliberately NOT done

- No `Kind::Model` / `Kind::Mcp` capsule kinds in AIKit.
- No `ModelProjection` / `SpendPolicy` / `AgentProfile`-as-AIKit-document.
- No `agent profile` / `compose` CLI store in AIKit.
- No model/harness compatibility or spend-law documents owned by AIKit.
