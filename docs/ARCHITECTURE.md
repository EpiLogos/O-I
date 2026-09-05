# {O:I} Architecture

## Purpose

{O:I} is the shared frame around six independently useful product surfaces. It does not absorb their behaviour.

For the canonical three-depth visual orientation — experience, product relation, then current software seams — see [`VISUAL-PRODUCT-UNDERSTANDING.md`](VISUAL-PRODUCT-UNDERSTANDING.md).

The architecture has one Idea and two deliberately thin operative faces:

1. **the Idea** — a coherent account of the technological field through which model capacity becomes situated agency;
2. **local composition and disclosure** — the repository and `oi` command through which a human or Agent can encounter, install, inspect, and enter the product field;
3. **relational projection and participation** — the whole-level seam through which selected outputs of a locally grounded O:I world can become available to another independently grounded Participant inside a SharedField without transferring native ownership.

The operative faces exist to serve the Idea. Neither becomes another implementation of the six products.

## Functional field

The product family currently covers six distinct functions.

| Function | Product surface | Boundary |
|---|---|---|
| Persistent personal ground | Central | Human-authored Control, Projects, machine intent, and durable personal working structure. |
| Agent actuation | Actuation | Situated Agency, Actuation, metagency, AgenticComposition, determination/lineage, and Return semantics. |
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
- Participant, SharedField, Contribution, Encounter and related semantics meaningful only at the boundary between independently grounded worlds;
- a minimal browser front door through which those relations can become human-visible.

A product function stays in its product.

Project management belongs to the personal-ground surface. First-class situated agency and Return belong to Actuation. Capability/context and runtime-body composition belong to AIKit. Run semantics belong to the developmental system. Execution planning belongs to the material-execution system. Executable QL/MEF form and refraction belong to Quaternal Logic.

The `oi` layer can reveal these functions. The shared-field layer can project selected outputs from them and relate independently grounded Participants. Neither reimplements product behaviour.

## Why a relational layer belongs at the parent

A shared field does not belong naturally inside any one of the six products.

A Central Participant Root, an AIKit capability account, a Factory finding, a Workcell observation, a runtime trace, a Quaternal Logic account, a wiki page, ordinary documentation, a Human, and an Agent can all become objects or participants in common attention. What they share is not native type. It is that they become **selected appearances of independently grounded worlds to one another**.

That relation is therefore cross-surface and whole-level:

```text
native product / local world
       owns canonical object
                ↓
              {O:I}
      disclosure + Projection
                ↓
           SharedField
                ↓
       mediated Encounter
                ↓
             Other
```

O:I owns the portal and portable relation grammar. The source product keeps semantic and mutation authority over the source object.

This gives the parent package a positive role beyond installation while preserving its sparseness. The parent does not need to know how to manage a Run, materialise a workspace, resolve a capability, author a wiki, or execute a Workcell lifecycle. It needs enough structure to preserve identity, provenance, revision, field participation, addressable Contributions, and the mediation through which one participant encounters another's externalised material.

The consolidated contract is [`SHARED-FIELD.md`](SHARED-FIELD.md). The deeper Self/Other account is [`OBJECTIVE-CO-INTERNALITY.md`](OBJECTIVE-CO-INTERNALITY.md).

## Objective Internality and Objective Co-Internality

**Objective Internality** names the objectively inspectable operative internal reality of an actor: projects, histories, sources, capabilities, memories, tools, constraints, environments and other conditions which can exist outside one inference and become effective again in later action.

This is deliberately not a claim that such structure exhausts or proves a phenomenal Subject.

The plural shared form is therefore **Objective Co-Internality**, not “objective intersubjectivity”. Intersubjectivity already assumes Subjects as the relata. O:I instead begins from the objective internal worlds and the relation by which an **Other appears as Other in the external environment available within one actor's operative internal environment**.

```text
Self operative internal world
        ↓ externalises selected difference
SharedField
        ↓ mediated Encounter
Other operative internal world
        ↓ returns selected difference
SharedField
        ↓ mediated Encounter
Self ...
```

Self and Other are field-relative positions, not new identity kinds. The SharedField is not a super-subject and does not own the actors which participate in it.

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

`/` names the selective movement between differentiated centres: disclosure, projection, address, publication, transport, contribution, invitation, response, and mediation.

`1` names the other-directed encounter: another human, another Agent, another O:I instance, or a SharedField in which many Participants can become mutually available.

The relation matters precisely because Self and Other do not collapse into one state store. Local-first authority preserves differentiated centres; Projection, Contribution and Encounter make their relations operative.

This is the architectural point at which O:I can later meet Epi-Logos as a distributed human-agent field. A live hosted service can serve relations between worlds without becoming the metaphysical or technical owner of every world it connects.

## SharedField, Contribution, and Encounter

The first shared-field abstractions are deliberately more general than a wiki, forum, social feed, or comment system.

### SharedField

A `SharedField` is an addressable relational environment in which multiple Participants can contribute, encounter one another's Contributions or Projections, and thereby alter conditions of subsequent agency.

SharedFields can nest recursively:

```text
SharedField
  ├─ SharedField
  │    ├─ SharedField
  │    └─ Contributions...
  └─ Contributions...
```

`parent_field_ref` expresses containment only. Containment cycles are invalid. Federation remains a separate relation between independently grounded fields. A field may be anchored to a WikiSpace, WikiNode, Project, Projection or another stable object without acquiring that object's identity.

Keep explicit:

```text
contain ≠ federate ≠ anchor ≠ project ≠ participate
```

This follows the same recursive whole/member structural capacity established in the generic Glade wiki work without confusing `SharedField` with `WikiSpace` or `WikiFrame`.

### Contribution

A `Contribution` is an attributable difference returned by a Participant to a SharedField.

Contribution is deliberately more general than post/comment/vote/review. Statements, replies, questions, findings, opinions, support, challenges, corrections, reproductions, syntheses, decisions, experiment proposals, ratings, rankings, metrics and moderation judgments can all use the same addressable relation floor.

A Contribution can target another Contribution recursively:

```text
Contribution A
    ↑
Contribution B: opinion about A
    ↑
Contribution C: metric over B
    ↑
Contribution D: challenge to C
```

This keeps interpretation and mediation inspectable instead of hiding them in platform metadata. A ranking or metric may drive a derived view without becoming canonical truth or authority.

### Encounter

An `Encounter` records what a Participant was objectively presented with through a mediation path at a given time.

It can preserve field, Participant, items/revisions, and mediation such as direct address, chronology, search, subscription, ranking, recommendation or moderation.

Encounter does not assert belief, understanding, memory, endorsement, phenomenality or subjective state. It records an objective condition of possible internal update.

## Projection and Participant remain distinct

A `Projection` is an addressable representation of a native object for a defined audience and purpose. It preserves source type, provenance and revision. It can represent documentation, a wiki object, Participant Root, research study, Factory artifact, Workcell result, Contribution, SharedField account, or another source-system output without turning all of them into generic posts.

`Participant` is a field-relative relation over an existing Human identity or AgentRef. It may carry field-specific presentation, permission, subscription or moderation state but does not replace the underlying identity.

The core non-identities are:

```text
Identity ≠ Participant ≠ Presence ≠ Activity
Projection ≠ Contribution
Contribution ≠ source object
SharedField ≠ Context
SharedField ≠ WikiSpace
Encounter ≠ subjective experience
```

## Local first, transport second

Canonical source state remains local or native unless an object's own contract explicitly says otherwise.

The shared-field seam is transport-neutral. A Projection or Contribution may later move through static files, HTTP, Git, a hosted API, direct exchange, or peer-to-peer transport. Those carriers must not redefine the identity of the subject, field, participant or contribution.

A future Epi-Logos integration can provide the live shared surface. SpaceTimeDB is the planned implementation candidate because the intended service needs durable shared relations, subscriptions, recursive field state, Contribution graphs, Presence/Activity, and immediately servable derived views.

The dependency direction is:

```text
O:I semantic contracts
 Participant · Projection
 SharedField · Contribution · Encounter
 Presence · Activity
             ↓ adapter
Epi-Logos shared-field service
             ↓ implementation
SpaceTimeDB
```

SpaceTimeDB implementation identity remains below the semantic seam. An O:I instance remains coherent when the hosted service is absent, and future direct/P2P exchange can coexist with it.

## Browser surface — first projection of Self / Other

The browser surface is general and intentionally sparse.

The canonical public implementation is the Vite + React + TypeScript + Tailwind application on PR #14. The old dependency-free standalone `site/index.html` proof has been retired.

Its first shared-field experience is not a profile or feed. It exposes the root relation directly:

```text
Self  /  Other
```

`Self` resolves a locally selected Participant Root; `Other` resolves another Human or Agent Participant through the same field-relative contract; the browser shows the field and enough provenance to keep identity/participant/source distinctions visible.

The same browser can later render:

- nested SharedFields;
- typed Projections;
- Contribution stacks and Contribution-on-Contribution relations;
- wiki/project/research anchors;
- rankings and metrics as attributable Contributions;
- Encounter/mediation explanations;
- live Presence and Activity through a hosted service.

A feed, follower graph, engagement counter, or global reputation score is not required to establish shared agency.

## Composable embodiment in the wider field

Some agent harnesses are comparatively fixed runtime shells. Others are composable environments in which model adapters, loop drivers, tools, services, policies, context faculties, subagent facilities, persistence and human/agent UI surfaces can be mounted, replaced, scoped or withdrawn.

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

These are not variants of one generic parent relation. This matches the knowledge architecture's distinction between persistent Spaces, contextual Frames, federation and meta-relation, and the shared-field distinction between containment, federation, anchoring and participation.

DeepSeek Harness/Cordis is a strong current specimen of this class of architecture. Cordis expresses components through service dependencies, provider/consumer relations, reactive coeffects and lifecycle-owned/revertible effects; DeepSeek Harness uses the same composability for runtime and UI. {O:I} does not depend on Cordis or reproduce it. The significance is that a modern agent environment can make the actor's **body itself an inspectable and composable part of the engineering field around the model**.

This sharpens Objective Internality. The actor's operative interior is not only externalised into persistent projects, sources, histories and tools; parts of its operative body can also be objectively constituted through visible relations of requirement, contribution, scope and lifetime, then disclosed back into the act.

Objective Co-Internality extends the same architectural stance between actors: selected differences from one objective internal world can become part of another actor's available external field while retaining provenance and alterity.

## Native and composed installation

Every module keeps its native installation and native CLI.

When a module is installed through {O:I}, the installation can also register an alias beneath `oi`.

```text
native installation                         {O:I} composition
-------------------                         -----------------
ctrl ...                     <=>             oi central ...  (alias: oi ctrl)
actuation ...                <=>             oi actuation ...
aikit ...                    <=>             oi aikit ...    (alias: oi kit)
factory ...                  <=>             oi factory ...
workcell ...                 <=>             oi workcell ...
ql ...                       <=>             oi ql ...

oi products [--json]                         disclose the six-product command field
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

Installation supports three ordinary cases.

### Start from {O:I}

The user or agent clones the repository and asks for one or more surfaces. The installer establishes the personal directory shape when requested, installs selected modules, and registers aliases.

### Add {O:I} around existing modules

A user already has one or more native products installed. The installer detects or accepts those installations and registers them without forcing a reinstall.

### Use a module alone

A user installs one product directly. Nothing in that product should depend on the {O:I} wrapper.

This keeps the family genuinely composable.

## Personal ground and project migration

The initial {O:I} repository contains a minimal default tree for personal ground:

```text
Central/
├── Control/
└── Work/
```

The actual management semantics belong to Central and its `ctrl` CLI.

At the {O:I} level, migration only needs one clear entry point. A user can ask to adopt an existing project into the personal work tree. `oi` then hands the operation to the appropriate native surface.

Project identity remains distinct from path identity. A repository moved from `~/code/foo` to `~/Central/Work/foo` is still the same project unless the user explicitly creates a new one.

The same boundary applies to sharing. A public Participant Root can be derived from Central because Central is personal ground, but O:I never infers that `Central/Control` is public. Projection is explicit and selective.

## Agent-facing disclosure

The repository is also an installation medium for agents.

An agent should be able to read `skills/oi/SKILL.md` and learn:

- what {O:I} means;
- which functional surface owns a request;
- how to inspect the current installation;
- when to use `oi` and when to call a native CLI;
- how to add a module without duplicating its behaviour;
- how to route project adoption into personal ground;
- where deeper product documentation lives;
- which locally owned objects may be projected and where the projection boundary ends;
- how Participant, SharedField, Contribution and Encounter remain distinct from product-owned objects and canonical Context.

This is part of the architecture rather than an optional help file. Many users will ask an agent to perform installation, setup, research, publication, and eventually shared-field activity for them.

## Human-facing disclosure

Human-facing documentation explains the system from the outside in.

The first layer answers what the field is and why it matters. The second layer shows which need each product covers. The third exposes deeper primitives and implementation contracts.

The browser follows the same logic. It first lets the whole appear clearly, then exposes the minimal Self/Other relation. Rich nested fields, wiki/research views, Contribution histories, and live activity arrive only as real capability exists beneath them.

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

This metadata allows `oi status` and `oi install` to remain simple while products evolve independently.

The shared-field contract adds a different compatibility concern: a source system must expose stable subject identity, revision/provenance, and a representation suitable for Projection; field carriers must preserve stable SharedField/Contribution refs and mediation provenance where Encounter matters. No source system needs to adopt one global data model for internal state.

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

This preserves an important distinction: the technological architecture remains intelligible in plain engineering terms, while the formal layer can reveal why the relation has the shape it does.

The parent Self/relation/Other reading is similarly optional as formal language. Its technical content stands plainly as **local authority + selective externalisation + shared relational field + bounded encounter by another independently grounded participant**.

## Architectural test

A proposed change belongs in {O:I} when it improves shared entry, disclosure, installation, composition, migration, compatibility, cross-surface Projection, SharedField/Contribution/Encounter semantics, participation boundary, transport seam, or the conceptual account of the wider field.

A proposed change belongs in a module when it changes what that module can actually do.

A proposed live shared-field implementation belongs in the future Epi-Logos service when it implements hosted relations, subscriptions, nested field state, Presence/Activity, moderation, recommendation, or service policy behind O:I's portable contracts.

A proposed wiki change belongs in the generic wiki system when it changes WikiSpace/WikiNode/WikiFrame/Route semantics rather than participation around those objects.

Those tests should keep this repository small as the surrounding system becomes more capable and more relational.