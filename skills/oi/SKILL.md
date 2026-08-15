# {O:I} Agent Skill

## Purpose

Use this skill when a user asks you to understand, install, inspect, compose, or enter a {O:I} system.

{O:I} is the shared idea and composition layer around several product surfaces. It is not the place to reimplement the products.

Your first job is to disclose the field clearly and route the work to the surface that owns it.

## Core idea

{O:I} is an open architecture for the **provisioning and potentiation of technological agency around LLM capacity**.

Think in functional terms first:

- persistent personal ground;
- agent actuation;
- capability and context resolution;
- developmental agency;
- material execution;
- recursive formal intelligence.

The current products that implement these functions are Central, Agent Runtime, AIKit, Software Factory, Workcell, and QL-MEF.

Do not use a product name as a substitute for the function when you are explaining the architecture to a new user. Explain the need first. Name the product second.

## Start with the installation state

When the `oi` CLI is available, begin with:

```text
oi status
```

Use the result to determine which product surfaces are installed and which aliases are available.

If `oi` is not installed but this repository is present, read the local documentation before taking installation action.

## Route by ownership

Route requests according to the function they concern.

### Persistent personal ground and project control

Use the registered control surface for human-authored Control, the personal directory structure, project placement, machine intent, and project adoption or migration.

### Agent actuation

Use the configured agent runtime for loop behaviour, harness behaviour, framework behaviour, and runtime-specific sessions or recurrence.

### Capability and context resolution

Use the registered AIKit surface for skills, tools, Actions, ContextSources, models, harnesses, profiles, sessions, familiarity, and local capability resolution.

### Developmental agency

Use the Software Factory surface for durable Runs, Run Maps, Agents, Agencies, Artifacts, Claims, Evidence, Decisions, Candidates, and related developmental work.

### Material execution

Use the Workcell surface for workspaces, execution providers, project runtimes, services, bindings, containers, VMs, machines, capacity, and material lifecycle.

### Recursive formal intelligence

Use QL-MEF for executable QL/MEF semantics, refraction, formal operators, and related research machinery.

## Use `oi` as a front door

Use `oi` for operations that concern the composition as a whole:

```text
oi help
oi status
oi init
oi install <module>
oi docs [topic]
oi migrate <path>
```

Use `oi <alias> ...` when the user wants the common namespace or when it improves orientation.

You may use the native CLI directly when the user already knows the product surface or when the native documentation requires it.

The alias is a dispatcher. Do not recreate native command behaviour inside the {O:I} layer.

## Installation

A user can install the whole family or only selected surfaces.

Support three cases:

1. start from {O:I} and install selected modules;
2. register an existing native installation into the {O:I} composition;
3. leave a module independent of {O:I} and use its native CLI normally.

Do not force reinstall when an existing compatible module can be registered.

After installation, report:

- what was installed or registered;
- the native command;
- the `oi` alias;
- the documentation entry point;
- any action the user must still take.

## Project migration

Treat migration as adoption of an existing project into the personal working ground.

Preserve project and repository identity unless the user explicitly asks to create something new.

At the {O:I} layer, gather the source path and target personal ground, then delegate the actual project-control operation to the registered control surface.

A path change is not a new Project.

## Communication

Write for the user's experience of the field.

Prefer direct prose and functional language. Explain what a surface gives the person or agent before discussing its internal types.

Keep the speculative research frame positive and directed. Do not weaken it with unnecessary disclaimers. Distinguish established software behaviour from open research claims when that distinction matters.

Use {O:I} as the canonical written form for the Idea and project. Use `oi` for the CLI command.

## Architectural guardrail

Before adding code to this repository, ask one question:

> Does this change improve shared disclosure, installation, composition, migration, compatibility, or handoff?

If the answer is no, the change probably belongs in one of the product repositories.
