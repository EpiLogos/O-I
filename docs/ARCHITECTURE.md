# {O:I} Architecture

## Purpose

{O:I} is the shared frame around six independently useful product surfaces. It does not absorb their behaviour.

The architecture has two levels:

1. **the Idea** — a coherent account of the technological field through which model capacity becomes situated agency;
2. **the composition layer** — a small repository and CLI that disclose, install or register, connect, and hand off to the product surfaces.

The second level exists to serve the first.

## Functional field

| Function | Product surface | Boundary |
|---|---|---|
| Persistent personal ground | Central | Human-authored Control, Work, machine intent, and durable personal working structure. |
| Agent actuation | Agent Runtime | The LLM loop itself, from bare recurrence to a framework or harness. |
| Capability and context resolution | AIKit | Agent-use resolution of skills, tools, Actions, ContextSources, models, profiles, sessions, and harnesses. |
| Developmental agency | Software Factory | Durable Projects, Runs, Agents, Agencies, artifacts, evidence, candidates, and developmental patterns. |
| Material execution | Workcell | Workspaces, execution providers, runtimes, services, bindings, and material lifecycle. |
| Recursive formal intelligence | Quaternal Logic | Executable QL/MEF structure, semantic refraction, and related formal research. |

These are centres of responsibility, not mandatory stages in one runtime pipeline.

## The sparse {O:I} layer

The {O:I} repository owns only concerns that make sense at the level of the whole:

- the founding vision and public map of responsibilities;
- installation or registration of selected modules;
- a common `oi` namespace over native CLIs that actually exist;
- inspection of which surfaces are installed, registered, missing, or broken;
- documentation entry and agent-facing disclosure;
- the top-level route into project migration;
- compatibility information needed to compose moving product surfaces safely.

A product function stays in its product. Project control belongs to Central. Capability resolution belongs to AIKit. Run semantics belong to the Software Factory. Material placement belongs to Workcell. QL/MEF semantics belong to Quaternal Logic. Runtime recurrence belongs to the runtime that defines it.

## Two small kinds of state

Implementation clarified a useful distinction between **live surface description** and **local composition**.

[`surfaces.json`](../surfaces.json) describes the six current product entry points: repository, docs, current native kind, executable and alias where one exists, version-discovery seam, installation posture, and compatibility note. It is not product configuration and does not reproduce product schemas.

The local composition file records only what this machine has actually composed:

```text
module identity
native executable or source root
version when discoverable
alias
human docs entry
optional skill entry
personal-ground path
```

By default it lives at `~/.config/oi/composition.json`; `XDG_CONFIG_HOME` and `OI_HOME` can relocate it.

This metadata exists so `oi status`, registration, docs, and dispatch can remain simple. Each product continues to own its own configuration and runtime state.

## Native and composed installation

Every module keeps its native installation and native surface. When a module is composed through {O:I}, `oi` may expose a clean alias over a real native CLI.

The live verification currently justifies two aliases:

```text
ctrl ...    <=>    oi ctrl ...
aikit ...   <=>    oi kit ...
```

The Agent Runtime, Software Factory, Workcell, and Quaternal Logic do not currently publish user CLIs, so they receive no invented command names.

On Unix, alias dispatch replaces the `oi` process with the native executable. Arguments, standard input, standard output, standard error, signals, and exit status therefore remain native command semantics rather than wrapper semantics.

## Setup and installation

`oi init` establishes local composition state and discovers existing `ctrl` and `aikit` commands. When a personal-ground path is supplied and Central is available, setup delegates the actual initialisation to `ctrl`. Without Central, {O:I} can create only the minimal `Control/` + `Work/` seed that already exists in this repository.

`oi register` composes an existing native command or source checkout without reinstalling it.

`oi install` first detects an existing native installation. The only product with a currently verified generic install recipe is AIKit, whose live README documents its source `cargo install` path. Other surfaces remain explicit register-after-native-install paths until their own repositories publish stable installers.

## Project migration

`oi migrate <path>` is the shared entry, but migration itself belongs to Central.

The current live `ctrl` command surface has no project-adoption Action or command. The first implementation therefore prints the intended source/target/identity-preservation handoff and returns without mutation. This is deliberate: a missing native contract is not permission for {O:I} to become a second project manager.

When Central publishes the adoption operation, `oi migrate` can become a thin dispatcher to it without changing the ownership model.

## Agent-facing disclosure

An agent should be able to read `skills/oi/SKILL.md`, run `oi status`, and learn which surface owns the next operation. The same state is available as `oi status --json` so agents do not need to scrape prose output.

## Compatibility

The live descriptor for each surface records only composition-level compatibility information. It can point at a draft integration branch while a product is still under development, but {O:I} does not reinterpret that product's internal contracts.

The governing test remains simple:

> A change belongs in {O:I} when it improves shared disclosure, installation, registration, status, documentation, migration handoff, or compatibility. A change belongs in a product when it changes what that product can actually do.

That keeps the repository sparse as the surrounding system becomes more capable.
