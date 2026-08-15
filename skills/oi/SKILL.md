# {O:I} Agent Skill

## Purpose

Use this skill when a user asks you to understand, install, inspect, compose, or enter a {O:I} system.

{O:I} is the sparse shared Idea and composition layer around six product surfaces. It is not the place to reimplement the products.

Your first job is to disclose the field clearly and route the work to the surface that owns it.

## Core idea

{O:I} is an open architecture for the **provisioning and potentiation of technological agency around LLM capacity**.

Think in functional terms first:

- persistent personal ground — Central;
- agent actuation — Agent Runtime;
- capability and context resolution — AIKit;
- developmental agency — Software Factory;
- material execution — Workcell;
- recursive formal intelligence — **Quaternal Logic**, implemented in the `EpiLogos/QL-MEF` repository.

Explain the need first and the current product second. The six functions are centres of responsibility, not mandatory stages in one runtime pipeline.

## Start with disclosure

When installation state is not already known, begin with:

```text
oi status --json
```

The status distinguishes:

- `installed` — a native CLI is detected but not registered into {O:I};
- `registered` — composition metadata resolves to a usable executable or source root;
- `missing` — no current installation is known;
- `broken` — registration exists but its executable or root no longer resolves.

If `oi` is not installed but this repository is present, read the local documentation before taking installation action.

## Route by ownership

Use the surface that owns the operation.

### Persistent personal ground and project control

Use Central for human-authored Control, the personal directory structure, Work, machine intent, and project-control operations.

### Agent actuation

Use the configured Agent Runtime for loop behaviour, harness/framework behaviour, runtime sessions, and recurrence.

### Capability and context resolution

Use AIKit for skills, tools, Actions, ContextSources, models, harnesses, profiles, sessions, and local capability/context resolution.

### Developmental agency

Use the Software Factory for durable Runs, Run Maps, Agents, Agencies, Artifacts, Claims, Evidence, Decisions, Candidates, and related developmental work.

### Material execution

Use Workcell for workspaces, execution providers, project runtimes, services, bindings, containers, VMs, capacity, placement, and material lifecycle.

### Recursive formal intelligence

Use Quaternal Logic for QL/MEF kernel semantics, lens/refraction operations, provider/service formal operations, and related research machinery.

## Current `oi` surface

Use `oi` for concerns shared by the composition:

```text
oi help
oi status [--json]
oi init [--personal-ground PATH]
oi register <module> ...
oi install <module>
oi docs [topic|module]
oi migrate <path>
```

Only use aliases that correspond to a verified native CLI. The live surfaces currently justify:

```text
oi ctrl ...  ->  ctrl ...
oi kit ...   ->  aikit ...
```

The Agent Runtime, Software Factory, Workcell, and Quaternal Logic do not currently publish native user commands. Do not invent aliases for them.

Alias dispatch is transparent. Treat the native product's arguments, input/output, signal behaviour, and exit semantics as authoritative.

## Installation and registration

Prefer discovery and registration over reinstalling an existing product.

For a native CLI, register the executable. For a current development/library surface, register its source root only when composition disclosure is useful.

`oi install` follows only installation mechanisms verified in the live product descriptor. AIKit currently has such a generic source-install contract. If another product has no generic installer, use its native documentation and then `oi register`; do not synthesize a plausible install command.

After setup, report what was installed or registered, the native entry point, any `oi` alias, the docs entry, and any remaining user action.

## Project migration

Treat migration as adoption of an existing project into the personal working ground, preserving project and repository identity unless the user explicitly asks to create something new.

The current live Central `ctrl` surface does **not** yet expose a project-adoption Action or command. Until it does, `oi migrate <path>` deliberately returns a non-mutating handoff-unavailable result after disclosing the intended source and target.

Do not work around that boundary by moving repositories yourself and calling the migration complete. The missing operation belongs in Central, after which `oi migrate` can become a thin native delegation.

## Communication

Write for the user's experience of the field. Prefer direct prose and functional language. Explain what a surface gives the person or agent before discussing its internal types.

Use {O:I} as the canonical written form for the Idea and project. Use `oi` for the CLI command. Use **Quaternal Logic** as the public product name; use `QL-MEF` when referring specifically to its repository or implementation vocabulary.

## Architectural guardrail

Before adding code to this repository, ask:

> Does this change improve shared disclosure, setup, installation/registration, status, documentation, migration handoff, compatibility, or aliasing?

If the change alters what a product can actually do, implement it in that product instead.
