# {O:I} Architecture

## Purpose

{O:I} is the shared frame around six independently useful product surfaces. It does not absorb their behaviour.

The architecture has two levels:

1. **the Idea** — a coherent account of the technological field through which model capacity becomes situated agency;
2. **the composition layer** — a small repository and CLI that disclose, install, connect, and hand off to the product surfaces.

The second level exists to serve the first.

## Functional field

The product family currently covers six distinct functions.

| Function | Product surface | Boundary |
|---|---|---|
| Persistent personal ground | Central | Human-authored Control, Projects, machine intent, and durable personal working structure. |
| Agent actuation | Agent Runtime | The LLM loop itself, from bare recurrence to a framework or harness. |
| Capability and context resolution | AIKit | Agent-use resolution of skills, tools, Actions, ContextSources, models, profiles, sessions, harnesses, and composition-capable runtime bodies/surfaces. |
| Developmental agency | Software Factory | Durable Projects, Runs, Agents, Agencies, artifacts, evidence, candidates, and developmental patterns. |
| Material execution | Workcell | Workspaces, execution providers, runtimes, services, machines, bindings, and material lifecycle. |
| Recursive formal intelligence | QL-MEF | Executable QL/MEF structure, semantic refraction, and related formal research. |

These are centres of responsibility, not mandatory stages in one runtime pipeline.

## The sparse {O:I} layer

The {O:I} repository owns only concerns that make sense at the level of the whole:

- the founding vision;
- public documentation for the field;
- the map of product responsibilities;
- installation of selected modules;
- a common `oi` namespace over installed native CLIs;
- inspection of which modules and entry points are available;
- the top-level route into Central/project migration;
- an agent-facing skill that explains the whole and the handoff rules;
- compatibility information needed to compose releases safely.

A product function stays in its product.

For example, project management belongs to the personal-ground surface. Capability/context and runtime-body composition belong to AIKit. Run semantics belong to the developmental system. Execution planning belongs to the material-execution system. QL recurrence belongs to the runtime or QL layer that defines it.

The `oi` layer can reveal these functions. It does not reimplement them.

## Composable embodiment in the wider field

Some agent harnesses are comparatively fixed runtime shells. Others are themselves composable environments in which model adapters, loop drivers, tools, services, policies, context faculties, subagent facilities, persistence and human/agent UI surfaces can be mounted, replaced, scoped or withdrawn.

This creates a useful architectural distinction:

```text
Agent
    enduring identity
        ↓ situated as
Agency
        ↓ embodied through
Harness
        ↓ constituted as
HarnessComposition
```

The actual body may therefore change without the Agent becoming another Agent.

AIKit is the system surface responsible for making that body intelligible and resolvable: which Components exist, what they require, which providers satisfy them, what they contribute, where those contributions appear, what owns their lifetime, and what would change if the composition were revised.

The deeper composition grammar distinguishes relations such as:

```text
contain
federate
frame
compose / mount
require
provide
contribute
target scope
project
bind
map / refract
```

These are not variants of one generic parent relation. This matches the existing distinction in the knowledge architecture between persistent Spaces, contextual Frames, federation and meta-relation.

DeepSeek Harness/Cordis is a strong current specimen of this class of architecture. Cordis expresses components through service dependencies, provider/consumer relations, reactive coeffects and lifecycle-owned/revertible effects; DeepSeek Harness uses the same composability for its runtime and UI. {O:I} does not depend on Cordis or reproduce it. The significance at this level is that a modern agent environment can make the actor's **body itself an inspectable and composable part of the engineering field around the model**.

This sharpens Objective Internality. The actor's effective interior is not only externalised into persistent projects, sources, histories and tools; parts of its operative body can also be objectively constituted through visible relations of requirement, contribution, scope and lifetime, then disclosed back into the act.

## Native and composed installation

Every module keeps its native installation and native CLI.

When a module is installed through {O:I}, the installation can also register an alias beneath `oi`.

```text
native installation                         {O:I} composition
-------------------                         -----------------
ctrl ...                     <=>             oi ctrl ...
aikit ...                    <=>             oi kit ...
<other native CLI>           <=>             oi <alias> ...
```

The native command remains the authority. The alias preserves its argument and exit semantics unless a documented composition feature requires additional handling.

This gives the user one memorable front door without creating a second implementation of every command surface.

## Discovery before dispatch

The composition layer needs a small local description of the installation.

It must be able to answer:

- Which modules are installed?
- Where is each native executable?
- Which alias exposes it?
- Which version is installed?
- Where is the personal ground?
- Which documentation and agent skill describe the surface?

A future manifest can hold this information. The manifest is composition metadata. It must not become a duplicate configuration store for the modules themselves.

Conceptually:

```text
{O:I} installation

alias       native surface       state
-----       --------------       -----
ctrl        ctrl                 installed
kit         aikit                installed
...         ...                  optional
```

## Installation

Installation should support three ordinary cases.

### Start from {O:I}

The user or agent clones the repository and asks for one or more surfaces. The installer establishes the personal directory shape when requested, installs the selected modules, and registers their aliases.

### Add {O:I} around existing modules

A user already has one or more native products installed. The installer detects or accepts those installations and registers them without forcing a reinstall.

### Use a module alone

A user installs one product directly. Nothing in that product should depend on the {O:I} wrapper.

This keeps the family genuinely composable.

## Personal ground and project migration

The initial {O:I} repository contains a minimal default tree for the personal ground:

```text
Central/
├── Control/
└── Work/
```

The actual management semantics belong to the Central product and its `ctrl` CLI.

At the {O:I} level, migration only needs one clear entry point. A user can ask to adopt an existing project into the personal work tree. `oi` then hands the operation to the appropriate native surface.

Project identity must remain distinct from path identity. A repository that moves from `~/code/foo` to `~/Central/Work/foo` is still the same project unless the user explicitly creates a new one.

## Agent-facing disclosure

The repository is also an installation medium for agents.

An agent should be able to read `skills/oi/SKILL.md` and learn:

- what {O:I} means;
- which functional surface owns a request;
- how to inspect the current installation;
- when to use `oi` and when to call a native CLI;
- how to add a module without duplicating its behaviour;
- how to route project adoption into the personal-ground surface;
- where deeper product documentation lives.

This is part of the architecture rather than an optional help file. Many users will ask an agent to perform installation and setup for them.

## Human-facing disclosure

The human-facing documentation should explain the system from the outside in.

The first layer should answer what the field is and why it matters. The second layer should show which need each product covers. The third layer can expose the deeper primitives and implementation contracts.

This order matters because the whole should be understandable before the reader has to learn its internal vocabulary.

## Compatibility

The composition layer eventually needs a small compatibility contract.

At minimum, each module should be able to declare:

- module identity;
- supported installation method;
- native executable or entry point;
- preferred `oi` alias;
- version;
- compatibility range with the {O:I} composition schema;
- documentation entry point;
- optional agent skill entry point.

This metadata allows `oi status` and `oi install` to remain simple while the products evolve independently.

## Sixfold relation

The current family also has a deeper formal reading:

```text
0  persistent ground
1  actuation
2  capability field
3  developmental form
4  material context
5  recursive intelligence
```

The public architecture can use these functional terms without requiring QL terminology. QL-MEF can disclose the deeper relation where that reading is useful.

This preserves an important distinction: the technological architecture must remain intelligible in plain engineering terms, while the formal layer can reveal why the relation has the shape it does.

## Architectural test

A proposed change belongs in {O:I} when it improves the shared entry, disclosure, installation, composition, migration, compatibility, or conceptual account of the wider field.

A proposed change belongs in a module when it changes what that module can actually do.

That test should keep this repository small as the surrounding system becomes more capable.
