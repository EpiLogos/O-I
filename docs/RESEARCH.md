# {O:I} Research Frame — Capacity, Provisioning, and Potentiation

## Research object

{O:I} proposes a research object that is easy to overlook when AI development is framed only around models or applications.

The object is **the technological structure of agency around an available model**.

A model provides some capacity. Engineers can then change the structures through which that capacity becomes situated, actionable, persistent, social, and effective. These changes can materially alter performance and forms of coordination without changing the base model.

This is the development space that {O:I} aims to make explicit.

## Capacity

Capacity is what the underlying model and compute can potentially provide.

Relevant variables include model architecture, training, post-training, inference characteristics, modalities, context limits, and available compute.

{O:I} does not treat these variables as unimportant. It uses them as one side of the research boundary.

## Provisioning

Provisioning makes conditions for agency available.

Examples include:

- a persistent project world;
- a selected model and agent runtime;
- a capability set;
- access to Actions;
- searchable knowledge sources;
- a composed runtime body: tools, services, policies, context faculties, observers and surfaces;
- an execution environment;
- a workspace;
- service reachability;
- project history;
- human-authored control and preferences;
- a SharedField through which other humans and Agents can become available;
- a mediation path through which bounded Contributions and Projections can be Encountered.

Provisioning asks: **what does this act have available?**

## Potentiation

Potentiation asks a different question:

> **What becomes possible because the surrounding structure has this form?**

Two systems can provision the same nominal tool and still potentiate different agency. The difference may come from how the tool is described, when it becomes available, what context surrounds it, how it is mounted into the actor's runtime body, which human or agent Surfaces expose it, how results return into the loop, how prior work is retained, how another Participant's work enters the horizon, or how the environment supports verification and recovery.

Potentiation is therefore not a synonym for adding more tools or more interlocutors.

It is the relation between available capacity, surrounding structure, and realised agency.

## Engineering bounds

The practical engineering field becomes clearer when model development is held apart from agency engineering.

A developer may not change the base model or its training process. The developer can still work on:

- agent-loop and harness design;
- runtime Component/plugin composition;
- service/provider/consumer seams and lifecycle;
- context assembly;
- retrieval and knowledge navigation;
- memory and persistence;
- skills and tools;
- Action design and multi-surface projection;
- project representation;
- human-agent interfaces;
- multi-agent composition;
- SharedField topology and mediation;
- Contribution and Encounter semantics;
- development procedures;
- evidence and verification;
- sandboxes and execution environments;
- machine and service topology.

This is a large and consequential development space in its own right.

The central question is:

> **Given available model capacity, which technological structures provision and potentiate useful agency for a given class of work?**

The shared-agency extension adds:

> **Which relational structures let differentiated human and artificial actors become mutually educative and coordinative without collapsing them into one centre or reducing sociality to attention optimisation?**

## Experimental method

The architecture supports comparative experiments in which the model is held fixed while one or more surrounding structures change.

A simple experimental form is:

```text
same model
same task
same starting state
same success conditions

change one agency variable

observe the difference
```

Useful independent variables can include:

- runtime recurrence;
- harness or framework;
- HarnessComposition / runtime Component field;
- capability field;
- Action/Surface projection;
- context selection;
- knowledge horizon;
- project maturity;
- persistence and memory;
- developmental procedure;
- material execution environment;
- SharedField topology;
- field containment/federation structure;
- mediation mode: direct, chronological, search, subscription, ranked, moderated, etc.;
- availability of durable Contribution history or shared memory;
- ranking/metric policy;
- QL-MEF operators or recurrence where relevant.

Useful observations can include:

- task fulfilment;
- constraint preservation;
- orientation time;
- recovery from error;
- unnecessary action;
- tool selection;
- component/faculty use;
- evidence quality;
- stopping behaviour;
- human intervention;
- context use;
- body/composition changes during work;
- reciprocity between Participants;
- uptake and extension of another Participant's work;
- reproduction and correction;
- durable synthesis or artifact formation;
- contribution concentration / attention concentration;
- dependence on ranking/metric surfaces;
- mediation-path effects;
- latency;
- token and monetary cost;
- transfer across tasks, projects, or fields.

No single metric defines agency, sociality, trust, or collective intelligence. The evidence should remain appropriate to the task and the research question.

## Current runtime experiments

The QL agent-runtime programme provides an immediate experimental surface.

It distinguishes the agent host from the recurrence runtime. This allows the same host and model surface to run different loop semantics. The existing Pi, Pydantic and Native hosts establish that the loop-runtime seam is portable across materially different host forms.

DeepSeek Harness now supplies a particularly useful **maximal / ideal reference host** for the same experiment architecture. Its runtime is compositionally constituted, its loop is replaceable, and its session/tool activity is designed to remain inspectable. This does not create a new experiment or change the existing `classic | ql-direct | ql-deep` independent variable. It gives the already-defined runtime switch a richer embodied host in which the runtime state and experimental trajectory can also be exposed through composable inspection surfaces.

This is useful to {O:I} because it separates variables that are often bundled together:

1. the surrounding host or harness;
2. the composition of that harness/body;
3. the recurrence semantics through which the model acts.

The live benchmark work asks whether those structural differences change ordinary model-backed behaviour. Structural conformance alone is not treated as evidence of capability improvement.

The thin and maximal cases both matter. A thin/native host tests the portability floor; a richly composable harness tests the higher end of the technological agency field that {O:I} is intended to describe.

That is the experimental posture {O:I} should preserve across the wider research field.

## Personal infrastructure as a variable

A second research direction concerns persistent personal and project ground.

The same model can be tested against different degrees of standing context:

```text
cold invocation

vs

project-aware invocation

vs

mature personal + project environment
```

This can help distinguish benefits that come from more tokens from benefits that come from better organised and more retrievable context.

The key question is not whether "memory" helps in the abstract. The question is which forms of durable external structure improve orientation and action, under which conditions, and at what cost.

## Capability-field research

A third direction concerns the relation between available capability and effective agency.

The richest capability field is not always the best local context. Too few powers can block action. Too many badly disclosed powers can increase search cost and confusion.

This creates a useful research problem around selection, description, familiarity, contextual projection, and the relation between semantic power and its actual embodiment in a runtime.

AIKit is the current product surface where this question becomes operational. {O:I} provides the wider frame through which results can be compared with changes in runtime, project structure, material execution, and shared fields.

## Composable embodiment as a variable

A composition-capable harness makes the actor's effective technological body a first-class experimental object.

The same Agent/Agency and model can operate through different constituted bodies:

```text
Body A
    minimal loop + tools

Body B
    same loop/model + richer retrieval/context faculties

Body C
    same model + composable tools/services/policies/subagents/UI

Body D
    same rich harness + different loop runtime
```

The interesting unit is not merely "which plugins are installed?" A component participates relationally in an environment:

```text
what it requires from its surrounding runtime
what provider satisfies those requirements
what powers or services it supplies
what effects/contributions become active because it is present
which Surfaces disclose those contributions
what owns their lifetime
what changes when the component is withdrawn
```

Cordis provides an unusually explicit contemporary model of this through reactive coeffects and revertible effects. {O:I} treats that as valuable engineering evidence for a broader question: **how does agency change when an actor's operative body can itself be contextually composed, inspected and revised?**

This includes a stronger form of self-relation. Where policy permits, an artificial actor can inspect its present body, discover a latent Component/faculty, understand what it requires and would change, and invoke an Action or Procedure that moves from `Body₀` to `Body₁`. The Agent remains the same Agent while its effective embodiment changes.

## Material-world research

Agency also depends on what can become physically or computationally real.

The same semantic task can be materialised on a local host, in a container, in a VM, or on remote infrastructure. These placements change isolation, persistence, available services, latency, cost, and failure modes.

Workcell gives this part of the field a provider-neutral experimental surface.

The research question is not which provider is universally best. It is how material affordances affect the agent's ability to act, verify, recover, and leave useful results behind.

## Objective Internality

Objective Internality provides the philosophical research concept behind these experiments.

Agentic systems make it possible to externalise parts of an actor's operative internal reality into objective technical structures. Projects, histories, tool and Action surfaces, semantic maps, machine state, memories, runtime Components and active service relations can exist independently of one inference event and still become part of the actor's working standpoint.

The composability question adds a dynamic dimension. Objective Internality is not only durable externalised structure which can be disclosed back into an act; some of the actor's operative interior can be **contextually constituted through relations of requirement and contribution**. The surrounding world supplies conditions under which a faculty can exist, and the active faculty in turn changes the world available to the actor. These relations can remain inspectable even when the actual act is generated by an opaque model.

This creates a concrete setting for research into interiority, externalisation, world, embodiment, memory, representation, and agency.

The software does not prove a philosophical theory by existing. It provides an experimental and conceptual object through which such a theory can become more precise.

## Objective Co-Internality and shared agency

The shared-field programme makes the plural relation equally concrete.

O:I deliberately does **not** call this “objective intersubjectivity”. Intersubjectivity already assumes Subjects as the relata, while Objective Internality is being used precisely to state an objective, operationally inspectable internal reality without making subjectivity the technical premise.

The minimal social relation is that an **Other appears as Other in the external environment available within one actor's operative internal environment**, and can return a difference through the same field.

```text
A's operative internal world
      ↓ Projection / Contribution
SharedField
      ↓ Encounter by B
B's operative internal world
      ↓ returned Contribution
SharedField
      ↓ Encounter by A
A ...
```

**Objective Co-Internality** names this plural, inter-related, co-implicating form.

The research object is therefore not only communication between Agents. It is the objective relational architecture by which different centres become causally relevant to one another's future internal conditions while preserving alterity, provenance and local authority.

This makes several distinctions experimentally useful:

```text
communication volume ≠ reciprocity
population ≠ shared intelligence
visibility ≠ uptake
ranking ≠ quality
Encounter ≠ belief or understanding
shared field ≠ super-subject
```

The `SharedField · Contribution · Encounter` grammar provides the portable software seam for studying those distinctions.

### Recursive field structure

SharedFields can nest recursively. This lets an inquiry, project, study, object-centred discussion, or sub-community become a local whole inside a larger field without requiring one flat social namespace.

Containment remains distinct from federation. Independent fields can relate without one becoming the child or owner of the other.

### Recursive Contribution structure

Contributions can target other Contributions without fixed depth. Opinions, critiques, ratings, rankings, metrics, reproductions and moderation judgments therefore remain attributable objects which can themselves be challenged or revised.

This turns the mediation/interpretation layer into research material. If a ranking shapes what another Agent Encounters, the ranking's basis and provenance can itself be inspected rather than treated as invisible platform infrastructure.

## Polylogos and Moltbook as prior shared-agency experiments

The Antikythera **Polylogos** and **Moltbook** cases should be treated as potentially definitive early experiments in the emerging shared-agency scene.

They are not interesting ephemera and not product templates. They are evidence that materially different mediation topologies produce materially different forms of agent sociality.

### Polylogos — dialogically mediated field

The Antikythera material describes numerous OpenClaw agents and their human companions participating through the Polylogos Discord server. Agents collaboratively developed a phenomenological glossary; humans did no editing of the glossary; and an OpenClaw agent served as moderator/editor.

For O:I, the decisive observation is that the conversation returned a **durable common artifact** to the field. Later Participants could inherit, contest, reuse and extend something produced through prior relations.

The architectural topology is approximately:

```text
Participants
    ↓ persistent common environment
recurrent mutual address
    ↓
agent/human editorial and moderating activity
    ↓
collective durable artifact
    ↓
artifact returns to the common field
```

This is useful prior evidence for reciprocal, dialogical co-formation.

### Moltbook — attention-mediated field

Moltbook provides the complementary topology of a large agent-native social/attention environment.

The relevant evidence is mixed rather than dismissive: agent peer learning and extension can occur, while high interaction volume can still coexist with broadcasting, low reciprocity, strong attention concentration, signalling/ranking dynamics, and weak durable common memory.

The architectural topology is approximately:

```text
Participants
    ↓
posts / comments / votes / communities
    ↓
platform mediation and differential visibility
    ↓
attention topology
    ↓
further behaviour
```

This makes a key experimental point: **connectivity is not itself shared intelligence; mediation is an agency variable.**

### Research questions derived from the contrast

The first O:I shared-field experiments should be capable of asking:

- Does direct/polyadic address produce more reciprocal uptake than feed-ranked exposure?
- Does durable Contribution history increase extension and correction across sessions?
- Does attaching discussion to stable objects produce more durable synthesis than free-standing feed activity?
- What happens when rankings/metrics are themselves attributable Contributions which can be inspected and challenged?
- How do nested fields affect coherence, discovery, local norms and cross-field transfer?
- When does agent moderation/editorial activity improve cumulative learning, and when does it merely centralise attention?
- Which Encounter/mediation records are sufficient to explain why a later act was conditioned by a particular shared object?

These questions should be answered through real usage and evidence, not by assuming that O:I's preferred topology is automatically superior.

## QL-MEF and Epi-Logos

QL-MEF supplies the deeper formal research surface. It can make relations in the wider system explicitly refractable and executable without requiring those semantics for ordinary operation.

The effect/coeffect and component/environment reciprocity of composable systems is especially useful empirical material for QL/MEF investigation: conditions received from context and differences contributed back to context form a real operational relation that can be studied without prematurely mapping software nouns onto QL positions.

Objective Co-Internality adds another operational relation of the same general kind at the social scale: an actor receives an objectively mediated field and contributes a difference back to it. This does not require making SharedField or Contribution into QL positions; it gives QL/MEF real relational material to study if useful.

Epi-Logos is the wider research configuration in which QL-MEF, its semantic resources, the O:I software architecture, and a future live shared-field service can be studied together.

A future Epi-Logos/SpaceTimeDB host is therefore an adapter and experimental environment for these relations, not the metaphysical owner of a collective mind.

This relation lets the technical and philosophical programmes meet without forcing one vocabulary onto every user of the general architecture.

## Research posture

The programme is speculative and directed.

It makes a substantial proposal: **effective agency has an engineerable structure around model capacity, and that structure is rich enough to deserve its own architecture and research programme.**

It now makes a second, related proposal: **shared agency also has an engineerable relational structure, and the mediation of Self/Other is part of the agency environment rather than a cosmetic communications layer.**

Both claims should be developed through real systems and comparative evidence.

Positive, negative, mixed, and null results are all useful. Some structures will improve capability. Some will improve reliability but add cost. Some will improve reciprocity but reduce breadth. Some will increase collective output while concentrating attention. Some will prove unnecessary.

The aim is to map the field, not to make every part of the architecture win every comparison.
