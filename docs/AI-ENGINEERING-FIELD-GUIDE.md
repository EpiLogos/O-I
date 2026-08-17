# AI Engineering Field Guide

**Status:** public comparative companion  
**Current-field check:** 2026-08-17  
**Canonical source:** [`CANONICAL-PRODUCT-FIELD.md`](CANONICAL-PRODUCT-FIELD.md) and [`../data/ql-relational-field.csv`](../data/ql-relational-field.csv)  
**Tracking:** O:I #29

This guide answers a practical question for people who already know the modern AI and agent stack:

> **Where do familiar concerns such as agents, context engineering, tools, model routing, coding agents, evals, sandboxes, MCP/A2A, deployment, memory, and model serving live in O:I — and what changes when those concerns are treated as one larger field?**

It is a comparative overlay, not a second ontology.

The source hierarchy remains:

```text
native product architecture
        ↓
canonical O:I six-product field + relation data
        ↓
this public field guide
        ↓
site presentation
```

Industry terms in this document are deliberately ordinary and somewhat loose. They help a practitioner recognise the territory. They do **not** rename the six products, redefine their primitives, or become another authoritative feature database.

O:I has **six products**:

```text
P0  Central
P1  Actuation
P2  AIKit
P3  Software Factory
P4  Workcell
P5  Quaternal Logic
```

**O:I is the enclosing Idea, composition, and disclosure layer. It is not product seven.**

---

## Level 1 — the six products in plain language

Most contemporary AI stacks divide work among models, agent loops, context and tools, software-development systems, evaluation/observability, runtime infrastructure, and some form of persistent state. O:I recognises that territory, but draws several boundaries more sharply.

### P0 · Central — durable authored ground

**Plain-language job:** keep the person's durable working world stable while models, sessions, tools, and machines change.

**Closest familiar terms:** long-term state, workspace, personal/project memory, configuration, user preferences, machine state, local knowledge source.

**Owns here:** human-authored `Control`, ordinary `Work`, machine intent, durable local orientation, persistent personal source, and stable Actions over that authored ground.

**Deliberately does not own:** the model context window, retrieval strategy, hidden agent memory, agent identity, model routing, or a software-development Run.

**What the framing adds:** durable human-authored ground is treated as a source with explicit authorship. It is not silently collapsed into whatever an agent inferred last session.

### P1 · Actuation — situated agency

**Plain-language job:** say what the actor is, how agency is situated and composed, what bounds it, and how an act returns difference to its world.

**Closest familiar terms:** agents, agent runtimes, multi-agent systems, delegation, orchestration, autonomy, agent identity, agent lifecycle, agent communication research.

**Owns here:** `Agent`, `Agency`, `WorldBinding`, `AgenticComposition`, determination and lineage, bounds, metagency, `Return`, and model-bearing agency research.

**Deliberately does not own:** the active tool bundle, harness/session composition, Project/Run semantics, or the container/VM in which execution happens.

**What the framing adds:** **Agent identity is not model identity, session identity, process identity, or harness identity. Agency semantics are not harness composition.** An Agency can remain itself while its operative body or material host changes.

### P2 · AIKit — operative resolution

**Plain-language job:** resolve what is available, usable, relevant, and explainable for this actor in this project/session/task now.

**Closest familiar terms:** context engineering, tool/function calling, skills, capability registries, model routing, agent workspaces, sessions, RAG/retrieval, MCP integrations, resource navigation, agent UI/runtime composition.

**Owns here:** `Context`, capabilities and skills, Actions as available powers, models, harnesses, Profiles/SkillSets, AgentSessions and SessionSpaces, Components/Surfaces, knowledge/resource navigation, and explanation of the effective operative field.

**Deliberately does not own:** durable human-authored ground, semantic Agent/Agency identity, Factory developmental meaning, or the material sandbox/provider lifecycle.

**What the framing adds:** Context is larger than prompt text. AIKit treats the operative world, information horizon, and current focus as resolvable relations, while keeping **availability, Capability grant, and Action authority distinct**.

### P3 · Software Factory — developmental intelligence

**Plain-language job:** turn intention into developed, evidenced, reviewable software while preserving why the work exists and what was learned.

**Closest familiar terms:** coding agents, software-engineering agents, planning/workflows, agentic software factories, evals, run tracing, candidate generation, software-development orchestration, human review.

**Owns here:** Projects, Runs and Run Maps, intent/design/development, coding and engineering, Candidates, Claims, Evidence, evaluation/assessment, Decisions, HumanRequests, Recognition/Return, recursion, and Execution Intelligence demand.

**Deliberately does not own:** Agent identity, Context resolution, harness/session identity, or the physical execution provider.

**What the framing adds:** development is not reduced to a sequence of tool calls. A developmental act has durable intent, alternatives, evidence, decisions, candidate lineage, and a return into future project ground.

### P4 · Workcell — material actuality

**Plain-language job:** make an execution need real on actual compute.

**Closest familiar terms:** sandboxes, code execution, containers, VMs/microVMs, model serving/inference, local models, GPU scheduling, deployment, storage/network/service binding, runtime lifecycle.

**Owns here:** material execution planning and preparation, compute placement, workspaces, isolated execution, providers, services, resource/accelerator requirements, storage/network bindings, exposure, observation, collection, release, and reconciliation.

**Deliberately does not own:** model-selection semantics, Agent identity, SessionSpace identity, Project/Run meaning, or Capability/Action authority.

**What the framing adds:** materialisation is treated as its own layer. A model server, sandbox, endpoint, GPU, or VM is a material binding — not the semantic identity of the Agent, Project, model choice, or developmental task using it.

### P5 · Quaternal Logic — formal and reflexive intelligence

**Plain-language job:** make deeper formal relations, perspectives, and recursive structures executable when they are useful.

**Closest familiar terms:** there is no clean industry equivalent. Adjacent ideas include formal reasoning, relational analysis, logical/process/causal perspectives, structured synthesis, and executable reasoning experiments.

**Owns here:** executable QL/MEF references and forms, relation/refraction, the twelve-lens MEF registry, formal synthesis, recursion, `locate` / `refract` / `relate` / `synthesise`, provenance of formal readings, and evidence-led formal experimentation.

**Deliberately does not own:** ordinary Project, Agent, Context, Run, Action, or material-execution semantics.

**What the framing adds:** the whole system can gain a deeper formal/reflexive reading **without making QL/MEF a runtime prerequisite for ordinary software**. Alignment does not mean renaming every software object in formal language.

---

## The short version

A useful first approximation is:

```text
persistent authored ground        → Central
semantic agency                   → Actuation
operative context/capabilities    → AIKit
development/evidence               → Software Factory
material execution                 → Workcell
formal/reflexive intelligence      → Quaternal Logic

whole-level composition/disclosure → O:I
```

The important word is **approximation**. Real AI work crosses these boundaries. The point of the architecture is not to force every act into six stages; it is to keep different kinds of identity and responsibility distinguishable while allowing them to compose.

---

## Level 2 — familiar AI engineering terms mapped into the field

| Familiar term / concern | What people usually mean | Primary O:I locus | Supporting loci | How O:I covers it | What O:I adds or separates |
|---|---|---|---|---|---|
| **Foundation models / model APIs** | Model capacity exposed through hosted or local inference APIs. | **AIKit** | Actuation · Workcell | AIKit resolves model choices and their operative compatibility; Actuation can study model-bearing Agency; Workcell materialises serving when the model is locally/privately hosted. | **Model ≠ Agent ≠ session ≠ server process.** Model capacity is one constituent of an act. |
| **Model routing / model selection** | Pick a model for a request based on quality, task, latency, cost, or policy. | **AIKit** | Factory · Actuation · Workcell | AIKit resolves eligible models; Factory supplies task/use-type evidence and fitness observations; Actuation supplies model-bearing Agency conditions; Workcell contributes serving/resource facts where material. | Routing can use evidence and context without turning a benchmark score into truth or a provider endpoint into identity. |
| **Model serving / inference / local models** | Run and expose models through engines such as vLLM, llama.cpp, Ollama, or managed inference services. | **Workcell** | AIKit | Workcell treats engines, accelerators, placement, process/service lifecycle, endpoints, storage, and network as material provider facts; AIKit resolves whether that model/variant is usable here. | Serving is **materialisation**, not model-selection semantics and not Agent identity. |
| **Agents / agent runtimes** | A model in a tool-using loop with instructions, state, and some autonomy. | **Actuation** | AIKit · Workcell | Actuation defines Agent/Agency, situated WorldBinding, determination/bounds and Return; AIKit supplies an operative body; Workcell supplies material execution. | Agent identity survives changes in model, harness, session, Surface, process, or Workcell where the native contracts allow it. |
| **Multi-agent orchestration / delegation / handoffs** | Coordinate several agents, delegate work, or transfer control. | **Actuation** | AIKit · Factory · Workcell | Actuation owns semantic `AgenticComposition`, determination and delegated/metagentic relations; AIKit composes harnesses/sessions/capabilities; Factory can commission multiple developmental trajectories; Workcell executes them. | **AgenticComposition ≠ HarnessComposition.** Semantic plurality is not the same thing as runtime layout. |
| **Tool use / function calling** | Let a model invoke typed functions, APIs, hosted tools, code, or services. | **AIKit** | native product owning the Action · Workcell | AIKit makes capabilities and Actions discoverable/resolvable and projects them into compatible clients; native products retain Action meaning and authority; Workcell may execute the material operation. | A tool call is an invocation mechanism. It does not by itself define durable Action identity, authority, Agency, or product ownership. |
| **Actions** | Stable domain operations that may be callable by humans, agents, APIs, CLI, or automation. | **Native owning product, resolved through AIKit** | O:I composition | Central, Factory and other products can publish canonical Actions; AIKit exposes them as actor-available powers; O:I can compose/disclose them without minting replacements. | One semantic Action can have several projections. **Capability availability ≠ Action authorisation.** |
| **Skills / capability catalogs** | Reusable procedures, tool bundles, instructions, or packaged capabilities. | **AIKit** | all native products | AIKit discovers, indexes, resolves, groups, explains, projects and learns usage/fitness of Skills/Capabilities while preserving native source/provenance. | Skill availability, Capability grant, and Action authority remain separate axes rather than one “installed = allowed” bit. |
| **Context engineering** | Curate the information and state presented to a model/agent so it can act effectively. | **AIKit** | Central · Factory | AIKit resolves Context, information horizon, capabilities/resources and current focus; Central supplies durable authored sources; Factory supplies Project/Run developmental focus. | Context is not merely the text already in the prompt or the model's context window; **availability can remain broad while prompt inclusion stays selective**. |
| **RAG / retrieval / knowledge navigation** | Retrieve relevant external information from files, vector stores, databases, search, or knowledge bases. | **AIKit** | Central · Factory | AIKit owns search/resource/navigation routes and ContextSource-style availability; Central can own durable authored material; Factory contributes project maps, prior Runs, Claims and Evidence as developmental sources. | Retrieval is a way of entering the information horizon. It does not transfer source ownership or make retrieved text canonical truth. |
| **Memory / long-term memory** | State persisted outside one model call so later interactions can recover useful information. | **Central** for durable authored ground | AIKit · Factory | Central owns durable human-authored Control/Work; AIKit owns session/context resolution and may expose memory-like sources; Factory retains developmental history and evidence. | **Durable authored ground ≠ agent memory ≠ conversation history ≠ model context window.** Derived memory cannot silently outrank authored source. |
| **Agent workspaces / sessions** | A persistent or resumable working environment containing conversations, terminals, editor surfaces, project state, and agent runtime state. | **AIKit** | Central · Factory · Workcell | AIKit owns AgentSession/SessionSpace and Surface/runtime composition; Central anchors durable Work; Factory Runs outlive any one session; Workcell can materialise the underlying workspace/environment. | `SessionSpaceRef`, AgentSession, Project, Run, Agent and Environment are distinct identities. Closing one presentation need not destroy the others. |
| **Coding agents / software-engineering agents** | Agents that inspect repositories, edit code, run tests, open PRs, and sometimes carry larger tasks end-to-end. | **Software Factory** | AIKit · Actuation · Workcell | Factory gives coding work Project/Run/RunMap/Candidate/Claim/Evidence/Decision semantics; AIKit supplies body/context/capabilities; Actuation supplies Agency; Workcell supplies execution. | “Coding agent” becomes a cross-product composition rather than a new identity that collapses development, runtime and infrastructure into one process. |
| **Planning / workflows / agent graphs** | Decompose work into steps/nodes, branches, handoffs, retries, and gates. | **Software Factory** | Actuation · AIKit | Factory owns durable Run/RunMap developmental topology and candidate branches; Actuation owns semantic Agency/determination; AIKit resolves the operative bodies needed at each point. | A Run Map can remain meaningful after a particular orchestrator/session disappears. Workflow topology is not the same thing as Agent identity. |
| **Evals / assessment / model or agent fitness** | Measure quality, correctness, safety, usefulness, or task performance using tests, graders, benchmarks, or human judgment. | **Software Factory** | Actuation · AIKit | Factory records Claims/Evidence/Assessment/fitness in the context of developmental work; Actuation owns experimental model/agency research; AIKit can use observed fitness during operative resolution. | **Fitness is contextual evidence, not truth, identity, or authored preference.** O:I does not require one universal score. |
| **Observability / tracing** | Record model calls, tool calls, workflows, errors, timings, tokens, and other execution telemetry. | **Software Factory** for developmental traces/evidence | AIKit · Workcell | Factory retains provenance, execution trajectories and evidence inside a Run; AIKit can explain what was resolved; Workcell returns observed material state/resource evidence. | Telemetry stays evidence about an act. It does not become the semantic identity of the Project, Agent, Run, or Decision it describes. |
| **Guardrails / permissions / approvals** | Constrain inputs/outputs/tools, require approvals, enforce permissions, or bound autonomous actions. | **Actuation** for Agency bounds | AIKit · Central · Factory | Actuation carries bounds and determination authority; AIKit keeps availability/grant/Action-authorisation separate; Central owns durable human-authored policy/source where appropriate; Factory owns developmental HumanRequests/Recognition. | “The tool exists” is never sufficient evidence that this actor is authorised to use it. Different authority questions remain owned by the layer that gives them meaning. |
| **Human-in-the-loop** | Ask a person for approval, choice, correction, or supervision. | **Depends on the authorial question** | Central · Actuation · Factory · AIKit | Central governs durable authored changes; Actuation governs Agency/Return constraints; Factory owns developmental commission/recognition/HumanRequests; AIKit can surface the request in the operative environment. | Human involvement is not one generic approval primitive. O:I asks **what is the human authorising or recognising, and who owns that meaning?** |
| **Sandboxes / code execution** | Run untrusted or task-specific code in an isolated process/container/VM with controlled filesystem/network access. | **Workcell** | AIKit | Workcell owns the material isolation/execution provider and its bindings/lifecycle; AIKit may resolve whether sandbox/code-execution capability is available and granted. | **Material isolation ≠ capability/permission resolution.** A sandbox is not an Agent, SessionSpace, Project, or authority object. |
| **Deployment / compute / GPUs** | Place services/models/tasks on machines, clusters or accelerators and manage lifecycle/capacity. | **Workcell** | Factory · AIKit | Workcell owns resource requirements, placement, material providers, services, network/storage binding and lifecycle; Factory expresses developmental Execution demand; AIKit resolves operative compatibility. | Compute topology can change without changing semantic Agent/Project/Run identities. |
| **MCP** | A protocol for exposing/calling tools and other interaction/data primitives between model/agent clients and servers. | **AIKit** for operative integration | O:I composition · native Action owners | AIKit can discover/project MCP-backed capabilities/resources into Context; O:I can compose/disclose protocol-bearing contributions; native products retain semantic Action/resource ownership. | **MCP is a protocol, not Agent identity, Agency, trust, or authority.** The current MCP core is explicitly protocol/integration infrastructure, not a universal agent ontology. |
| **A2A / agent communication** | Interoperability between independently implemented agent systems: discovery, messages, tasks, modalities, and cross-system collaboration. | **O:I composition/shared-field layer** *(not a seventh product)* | Actuation · AIKit | O:I owns the whole-level projection/Participant/SharedField/Encounter/admission and current A2A transport seam; Actuation retains Agent/Agency identity and determination semantics; AIKit can supply operative Surfaces/capabilities. | **Protocol endpoint / Agent Card / task / message ≠ Agent identity ≠ Participant ≠ authority ≠ Actuation Determination/Return.** Transport does not get to redefine what it carries. |
| **Agent-native applications / shared Surfaces** | Applications exposing typed operations/resources directly to agents as well as through human UI. | **AIKit** for operative Component/Surface resolution | native product · O:I desktop/composition | Products publish their own Actions/read models/Surfaces; AIKit composes them into SessionSpaces and operative bodies; O:I can host/disclose them without copying semantics. | Human and agent projections can share stable semantic objects and Action lineage without requiring screen-scraping or a second “agent API” ontology. |
| **Identity / provenance** | Know what actor/object/version produced or changed something and where it came from. | **Native semantic owner** | Actuation · Factory · Central · O:I | Actuation owns Agent/Agency identity; Factory owns developmental lineage/evidence; Central owns authored source; O:I shared projections retain native subject/source/revision provenance. | O:I does not make protocol IDs, database row IDs, session IDs, process IDs, or transport locators canonical semantic identity merely because they are convenient. |
| **Formal / reflexive reasoning** | Structured logical, relational or higher-order reasoning over the system itself. | **Quaternal Logic** | all products as subjects of optional reading | QL/MEF can locate, relate, refract and synthesise existing objects through explicit formal perspectives and executable experiments. | Formal depth can increase without forcing every ordinary operation through QL or renaming the native objects being examined. |

---

## A few distinctions worth keeping visible

The guide is useful only if it prevents familiar labels from flattening real architectural differences.

```text
Agent identity              ≠ model / session / process identity
Agency semantics            ≠ harness composition
Context                     ≠ prompt tokens / context window
Capability available        ≠ Capability granted ≠ Action authorised
Development                 ≠ tool invocation
Execution/materialisation   ≠ semantic identity
Durable authored ground     ≠ hidden agent memory
Evaluation / fitness        ≠ truth or authored preference
Protocol                    ≠ identity or authority of what it transports
Formal QL/MEF               ≠ mandatory runtime dependency
```

These are not claims that the rest of the field is “wrong”. They are the boundaries O:I chooses to keep inspectable because collapsing them creates ambiguity about ownership, authority, provenance, continuity, and what exactly changed.

---

## What O:I claims — and what it does not

The useful outward-facing claim is modest:

> **O:I covers the familiar engineering terrain around modern model-based systems while separating several concerns that current stacks often bundle together. The enclosing O:I layer then makes those different concerns inspectable and composable as one technological world.**

That means the architecture can recognise familiar categories such as models, agents, context, tools, retrieval, coding agents, evals, sandboxes, serving, deployment, memory, MCP and A2A without pretending that six new names were invented for the same feature checklist.

It also means O:I does **not** claim:

- that every product competitively implements every AI-stack feature;
- that the six products form a compulsory six-step request pipeline;
- that O:I is a seventh implementation product;
- that the industry has one settled universal taxonomy;
- that a protocol or benchmark can supply semantic identity or authority;
- that QL/MEF must run for ordinary software to work.

The six centres are **responsibility boundaries and relation points**. The value of the larger field is that an engineer can move across them without losing track of what kind of thing they are looking at.

---

## Current field vocabulary checked

This comparative vocabulary was checked against current primary sources on **2026-08-17**. These sources are evidence that the terms are in active use; they are not adopted as O:I's ontology.

- **Anthropic — “Effective context engineering for AI agents”**: context engineering, finite context windows, tools, retrieval, progressive disclosure, external memory/state.  
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- **OpenAI — Agents SDK documentation**: agents, agent loops, tools/function calling, handoffs/agents-as-tools, orchestration, sessions, guardrails, human-in-the-loop, tracing, sandboxed execution and MCP integrations.  
  <https://openai.github.io/openai-agents-python/>
- **OpenAI — Developer quickstart**: model APIs plus built-in web/file search, function calling and remote MCP as model tools.  
  <https://platform.openai.com/docs/quickstart>
- **Amazon Bedrock — intelligent prompt routing**: foundation models, model/prompt routing, quality/cost criteria and request-specific model selection.  
  <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html>
- **Amazon Bedrock — documentation overview**: agents, flows/workflows, knowledge bases and Retrieval Augmented Generation (RAG), prompt management and model routing remain active practitioner vocabulary.  
  <https://docs.aws.amazon.com/bedrock/>
- **Model Context Protocol — 2026-07-28 specification release**: MCP as a stateless data/interactivity protocol core with tools, routing/authorization concerns, Tasks/extensions and updated SDKs.  
  <https://blog.modelcontextprotocol.io/posts/2026-07-28/>
- **Agent2Agent (A2A) Protocol — v1.0**: independent/opaque agent interoperability, capability discovery, modalities, collaborative tasks and information exchange without access to internal memory/tools.  
  <https://a2a-protocol.org/latest/specification/>
- **OpenTelemetry — Generative AI semantic conventions**: model requests, agents, conversations, retrieval, tool execution, workflow naming, evaluation scores and GenAI observability vocabulary.  
  <https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/>
- **KServe — 2026 LLM inference releases**: production LLM serving/inference, vLLM, multi-node inference, model caching, routing and cloud/on-prem deployment.  
  <https://kserve.github.io/website/blog>

Terminology will keep moving. Where a term becomes unstable or several communities use it differently, this guide should prefer plain explanatory prose rather than pretending there is one formal industry standard.

---

## Where to go deeper

- [`CANONICAL-PRODUCT-FIELD.md`](CANONICAL-PRODUCT-FIELD.md) — the canonical six-product field and QL relation grammar.
- [`../data/ql-relational-field.csv`](../data/ql-relational-field.csv) — the current manipulable 144-relation development map.
- [`SURFACES.md`](SURFACES.md) — each product entered from the need it serves.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — ownership and whole-level O:I composition/disclosure.
- [`VISION.md`](VISION.md) — why the technological world around model capacity is the object of the project.

For most readers, this guide is the bridge: **recognise the stack you already know, then inspect why O:I keeps some of its familiar pieces apart.**
