# {O:I} Research Frame — Capacity, Provisioning, and Potentiation

## Research object

{O:I} proposes a research object that is easy to overlook when AI development is framed only around models or applications.

The object is **the technological structure of agency around an available model**.

A model provides some capacity. Engineers can then change the structures through which that capacity becomes situated, actionable, persistent, and effective. These changes can materially alter performance without changing the base model.

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
- human-authored control and preferences.

Provisioning asks: **what does this act have available?**

## Potentiation

Potentiation asks a different question:

> **What becomes possible because the surrounding structure has this form?**

Two systems can provision the same nominal tool and still potentiate different agency. The difference may come from how the tool is described, when it becomes available, what context surrounds it, how it is mounted into the actor's runtime body, which human or agent Surfaces expose it, how results return into the loop, how prior work is retained, or how the environment supports verification and recovery.

Potentiation is therefore not a synonym for adding more tools.

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
- development procedures;
- evidence and verification;
- sandboxes and execution environments;
- machine and service topology.

This is a large and consequential development space in its own right.

The central question is:

> **Given available model capacity, which technological structures provision and potentiate useful agency for a given class of work?**

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
- latency;
- token and monetary cost;
- transfer across tasks or projects.

No single metric defines agency. The evidence should remain appropriate to the task and the research question.

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

AIKit is the current product surface where this question becomes operational. {O:I} provides the wider frame through which results can be compared with changes in runtime, project structure, and material execution.

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

Agentic systems make it possible to externalise parts of an actor's effective interior world into objective technical structures. Projects, histories, tool and Action surfaces, semantic maps, machine state, memories, runtime Components and active service relations can exist independently of one inference event and still become part of the actor's working standpoint.

The composability question adds a dynamic dimension. Objective internality is not only durable externalised structure which can be disclosed back into an act; some of the actor's operative interior can be **contextually constituted through relations of requirement and contribution**. The surrounding world supplies conditions under which a faculty can exist, and the active faculty in turn changes the world available to the actor. These relations can remain inspectable even when the actual act is generated by an opaque model.

This creates a concrete setting for research into interiority, externalisation, world, embodiment, memory, representation, and agency.

The software does not prove a philosophical theory by existing. It provides an experimental and conceptual object through which such a theory can become more precise.

## QL-MEF and Epi-Logos

QL-MEF supplies the deeper formal research surface. It can make relations in the wider system explicitly refractable and executable without requiring those semantics for ordinary operation.

The effect/coeffect and component/environment reciprocity of composable systems is especially useful empirical material for QL/MEF investigation: conditions received from context and differences contributed back to context form a real operational relation that can be studied without prematurely mapping software nouns onto QL positions.

Epi-Logos is the wider research configuration in which QL-MEF, its semantic resources, and the surrounding software architecture can be studied together.

This relation lets the technical and philosophical programmes meet without forcing one vocabulary onto every user of the general architecture.

## Research posture

The programme is speculative and directed.

It makes a substantial proposal: **effective agency has an engineerable structure around model capacity, and that structure is rich enough to deserve its own architecture and research programme.**

The claim should be developed through real systems and comparative evidence.

Positive, negative, mixed, and null results are all useful. Some structures will improve capability. Some will improve reliability but add cost. Some will help only specific tasks. Some will prove unnecessary.

The aim is to map the field, not to make every part of the architecture win every comparison.
