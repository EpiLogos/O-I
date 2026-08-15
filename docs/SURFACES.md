# {O:I} Product Surfaces

{O:I} is easiest to enter by need rather than by repository name.

The six surfaces are centres of responsibility, not mandatory stages in one runtime pipeline. A person can use only the surfaces they need, and each product remains independently useful outside {O:I}.

## Persistent personal ground — Central

A useful agentic system needs somewhere durable to stand. Central gives the user a personal working ground for human-authored Control, ordinary Work, machine intent, and other durable material that should survive individual model sessions.

The current native command is `ctrl`. In a composed installation, `{O:I}` exposes the same surface as `oi ctrl ...`.

The active Rust implementation remains under development in Central's current integration line, so {O:I} registers an existing `ctrl` rather than pretending to own Central installation or behaviour.

## Agent actuation — Agent Runtime

A model needs to be placed into an active loop before it can operate as an agent. The current QL agent-runtime programme in `agent-system-design` deliberately separates the host from recurrence semantics so the same model and capability field can be compared through Classic, Direct QL, and Deep QL loops.

The live surface is presently a repository workbench and Series 1 workflow, not a released native command. There is therefore no `oi` runtime alias yet.

## Capability and context resolution — AIKit

Once an actor exists, it needs a usable field of powers and information. AIKit resolves skills, tools, Actions, profiles, sessions, harnesses, models, and context at the agentic use level.

The native command is `aikit`, with a documented source installation path. A composed installation exposes it as `oi kit ...` without changing the underlying command semantics.

## Developmental agency — Software Factory

Some work needs continuity across intention, design, implementation, evidence, alternatives, decisions, and return. The Software Factory gives that work a durable developmental body through Projects, Runs, Run Maps, Agents, Agencies, Artifacts, Claims, Evidence, Decisions, and Candidates.

The current executable implementation is a Rust crate in the Factory integration branch. It does not yet publish a native user CLI, so {O:I} records a source checkout when useful and assigns no alias.

## Material execution — Workcell

Agency eventually meets a material environment. Workcell resolves semantic execution demands into workspaces, runtimes, services, provider bindings, and material lifecycle without forcing higher-level software to encode Docker, VM, host, or placement details.

The current implementation is a Rust workspace and provider/control-plane library surface. It has no released native CLI, so {O:I} assigns no alias.

## Recursive formal intelligence — Quaternal Logic

The structures through which an agent works can themselves become objects of computation and reflection. **Quaternal Logic** is the public name for the recursive formal-intelligence surface implemented in the `EpiLogos/QL-MEF` repository.

Its current Rust implementation supplies the QL/MEF kernel, lens registry, provider/service boundary, and optional client adapters. It is currently a library/service surface rather than a released CLI, so {O:I} does not invent a command alias for it.

## Verified native entry points

The live repositories were rechecked on 15 August 2026. The composition descriptors in [`surfaces.json`](../surfaces.json) retain only the discovery and handoff facts needed by `oi`.

| Surface | Current native entry | Preferred `oi` alias |
|---|---|---|
| Central | `ctrl` | `oi ctrl` |
| Agent Runtime | repository workbench / Series 1 workflow | none |
| AIKit | `aikit` | `oi kit` |
| Software Factory | Rust crate / integration surface | none |
| Workcell | Rust workspace / control-plane crates | none |
| Quaternal Logic | QL/MEF Rust kernel/service/adapters | none |

An alias appears only when a product actually exposes a native CLI. The absence of an alias is not a missing {O:I} feature; it is a truthful description of the current product surface.

## The whole field

The six functions can still be read together as:

```text
0  standing ground
1  intelligence in act
2  available powers and horizons
3  developmental form
4  material encounter
5  recursive disclosure
```

This relation is useful because it covers a wide range of practical need without requiring one giant product. {O:I} provides one map and one entry point while allowing every surface to remain fully itself.
