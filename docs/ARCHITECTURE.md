# {O:I} Architecture

## Purpose

{O:I} is the shared frame around six independently useful product surfaces. It does not absorb their behaviour.

The architecture has one Idea and two deliberately thin operative faces:

1. **the Idea** — a coherent account of the technological field through which model capacity becomes situated agency;
2. **local composition and disclosure** — the repository and `oi` command through which a human or Agent can encounter, install, inspect, and enter the product field;
3. **relational projection** — the whole-level seam through which selected outputs of a locally grounded O:I world can be addressed and encountered by another participant or shared field without transferring their native ownership.

The operative faces exist to serve the Idea. Neither becomes another implementation of the six products.

## Functional field

The product family currently covers six distinct functions.

| Function | Product surface | Boundary |
|---|---|---|
| Persistent personal ground | Central | Human-authored Control, Projects, machine intent, and durable personal working structure. |
| Agent actuation | Agent Runtime | The LLM loop itself, from bare recurrence to a framework or harness. |
| Capability and context resolution | AIKit | Agent-use resolution of skills, tools, Actions, ContextSources, models, profiles, sessions, harnesses, and composition-capable runtime bodies/surfaces. |
| Developmental agency | Software Factory | Durable Projects, Runs, Agents, Agencies, artifacts, evidence, candidates, and developmental patterns. |
| Material execution | Workcell | Workspaces, execution providers, runtimes, services, machines, bindings, and material lifecycle. |
| Recursive formal intelligence | Quaternal Logic | Executable QL/MEF structure, semantic refraction, and related formal research. |

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
- compatibility information needed to compose releases safely;
- a transport-neutral envelope through which native objects can be selectively projected beyond one local O:I world;
- participant and relation semantics that are meaningful only at the boundary between independently grounded worlds;
- a minimal browser front door through which those projections can later become human-visible.

A product function stays in its product.

For example, project management belongs to the personal-ground surface. Capability/context and runtime-body composition belong to AIKit. Run semantics belong to the developmental system. Execution planning belongs to the material-execution system. QL recurrence belongs to the runtime or Quaternal Logic layer that defines it.

The `oi` layer can reveal these functions. The shared-field layer can project selected outputs from them. Neither reimplements their behaviour.

## Why a relational layer belongs at the parent

A shared field does not belong naturally inside any one of the six products.

A Central participant root, an AIKit capability account, a Factory finding, a Workcell observation, a runtime trace, a Quaternal Logic account, a wiki page, and ordinary documentation can all become objects of common attention. The thing they share is not their native type. It is the fact that they are **selected appearances of locally owned worlds to another participant**.

That relation is therefore cross-surface and whole-level:

```text
native product / local world
       owns canonical object
                ↓
              {O:I}
      disclosure + Projection
                ↓
   peer / browser / shared field
```

O:I owns the portal and projection grammar. The source product keeps semantic and mutation authority over the source object.

This gives the parent package a positive role beyond installation while preserving its sparseness. The parent does not need to know how to manage a Run, materialise a workspace, resolve a capability, or author a wiki. It needs to know enough to identify what is being projected, where it came from, which revision is being shown, who published it, and how another participant can resolve it.

The detailed local-first contract is specified in [`SHARED-FIELD.md`](SHARED-FIELD.md).

## The parent 0/1 relation — Self, relation, Other

The six product positions remain:

```text
0  persistent ground
1  actuation
2  capability field
3  developmental form
4  material context
5  recursive intelligence
```

At the level above those differentiated functions, `{O:I}` also gives a useful reading of the relation by which a whole becomes available beyond itself:

```text
0       /       1
Self   relation  Other
local  projection encounter
```

This does not assign the products new positions or create a seventh surface.

`0` names the locally grounded side of the relation. Central is the first concrete personal root of that ground, but a whole O:I installation may project objects owned by any product.

`/` names the selective movement between differentiated centres: disclosure, projection, address, publication, transport, invitation, response.

`1` names the other-directed encounter: another human, another Agent, another O:I instance, or a shared field in which many participants can become mutually present.

The relation is important precisely because Self and Other do not have to collapse into one state store. Local-first authority preserves differentiated centres; transport and projection make their relations operative.

This is the architectural point at which the O:I parent can later meet Epi-Logos as a distributed human-agent field. A live hosted service can serve the relations between worlds without becoming the metaphysical or technical owner of every world it connects.

## General projection and browser surface

The first shared-field abstraction is deliberately more general than a wiki or forum.

A `Projection` is an addressable representation of a native object for a defined audience and purpose. It preserves the source object's type and provenance. It can represent documentation, a wiki object, a participant root, a research study, a Factory artifact, a Workcell result, or another source-system output without turning all of those objects into generic posts.

The browser site is therefore also general. The current `site/index.html` shows only the `{O:I}` mark and a GitHub link. Its main element is already marked as the future projection root. The next functional slice can render a public Participant Root derived from explicitly selected Central material, while the same surface remains capable of rendering other projection kinds later.

A richer browser experience should follow demonstrated capability rather than precede it. The visual shell can remain sparse while the underlying shared relations deepen.

## Local first, transport second

Canonical source state remains local or native unless an object's own contract explicitly says otherwise.

The shared-field seam is transport-neutral. A projection may later move through static files, HTTP, Git, a hosted API, direct exchange, or peer-to-peer transport. Those transports must not redefine the identity of the projected subject.

A future Epi-Logos integration can provide the live shared surface. SpaceTimeDB is the planned implementation candidate because the intended service needs durable shared relations, subscriptions, presence, dialogue, and immediately servable derived views.

The dependency direction is:

```text
O:I Projection / Participant contracts
                ↓ adapter
Epi-Logos shared-field service
                ↓ implementation
SpaceTimeDB
```

SpaceTimeDB implementation identity must therefore remain below the shared semantic seam. An O:I instance remains coherent when that hosted service is absent, and future direct/P2P exchange can coexist with it.

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

The shared-field relation extends the same idea between actors: a selected part of one objective internal world can become inspectable and usable within another actor's knowledge horizon while retaining provenance back to its source.

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

The same boundary applies to sharing. A future public Participant Root can be derived from Central because Central is the personal ground, but O:I must never infer that the contents of `Central/Control` are public. Projection is explicit and selective.

## Agent-facing disclosure

The repository is also an installation medium for agents.

An agent should be able to read `skills/oi/SKILL.md` and learn:

- what {O:I} means;
- which functional surface owns a request;
- how to inspect the current installation;
- when to use `oi` and when to call a native CLI;
- how to add a module without duplicating its behaviour;
- how to route project adoption into the personal-ground surface;
- where deeper product documentation lives;
- which locally owned objects may be projected and where the projection boundary ends.

This is part of the architecture rather than an optional help file. Many users will ask an agent to perform installation, setup, research, and eventually publication for them.

## Human-facing disclosure

The human-facing documentation should explain the system from the outside in.

The first layer should answer what the field is and why it matters. The second layer should show which need each product covers. The third layer can expose the deeper primitives and implementation contracts.

The browser surface follows the same logic. It should first let the whole appear clearly; richer participant, wiki, research, and dialogue views should arrive only as real shared-field capability exists beneath them.

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

The shared-field contract adds a different compatibility concern: a source system must be able to expose stable subject identity, revision/provenance, and a representation suitable for projection. It does not need to adopt one global data model for its internal state.

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

The public architecture can use these functional terms without requiring QL terminology. Quaternal Logic can disclose the deeper relation where that reading is useful.

This preserves an important distinction: the technological architecture must remain intelligible in plain engineering terms, while the formal layer can reveal why the relation has the shape it does.

The parent Self/relation/Other reading is similarly optional as formal language. Its technical content stands plainly as **local authority + selective projection + encounter by another independently grounded participant**.

## Architectural test

A proposed change belongs in {O:I} when it improves the shared entry, disclosure, installation, composition, migration, compatibility, cross-surface projection, participation boundary, transport seam, or conceptual account of the wider field.

A proposed change belongs in a module when it changes what that module can actually do.

A proposed shared-field change belongs in the future Epi-Logos service when it implements live hosted relations, presence, dialogue, subscriptions, moderation, or service policy behind O:I's portable contracts.

Those tests should keep this repository small as the surrounding system becomes more capable and more relational.
