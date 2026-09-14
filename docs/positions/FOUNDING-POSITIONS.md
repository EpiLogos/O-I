# {O:I} Founding Positions

## Human-authored ground for the product field

This document is the authored position from which the O:I product family, its research programme, and its public description should be understood.

It sits deliberately upstream of product architecture. Architecture tells us how a current system has been made. This document keeps available why the system exists, what human or philosophical concern gave rise to a distinction, what kind of experience the work is trying to make possible, and what kind of development would still count as development of the same thing.

The positions below include different kinds of claim. Some are design commitments: they say what kind of technological field we are choosing to build. Some are philosophical positions: they state the orientation from which the work has been conceived. Some are research propositions: they become meaningful because they can be investigated, compared, refined, contradicted, or shown to have narrower validity than expected.

The project is meant to learn. That requires both a durable account of what we are trying to do and a durable account of what reality returns.

The twelve positions are arranged as two related sixfold movements. The first six move outward from authored intent into a field of technological agency. The conjugate six return through the realities that the field exposes: interiority, plurality, power, epistemology, formal experiment, and provenance. This is lightly informed by the QL habit of reading a whole through differentiated and returning positions, but the document does not require QL terminology in order to be understood.

The basic relation is simpler:

```text
0 — authored intent, experience, value, vision
                  ↓
              development
                  ↓
1 — accumulated grounding reality about what the project is,
    what it does, what resists, what has been learned, and what
    the originating position now means in practice
                  ↓
                return
                  ↓
         renewed authored position
```

The programme depends on both poles. Authored meaning gives development direction. Returned reality prevents that meaning from becoming insulated aspiration. Current implementation gives evidence about what is real now. It does not retroactively become the reason the project exists.

In positive terms, O:I is building toward a small number of commitments:

- a **World** is the working environment defined for an agent: the projects, sources, capabilities, history, authority, material environment and relations through which it can act;
- agency is constituted through the relation between available inference capacity and such a World;
- part of that World can be deliberately authored by a human: purpose, principles, preferences, rules, ways of working, project positions and other durable material can remain in the person's own words and become selectively operative in later agency;
- human-authored source, observed state and agent-generated interpretation should remain distinguishable so that an artificial system does not silently become the author of the human it is meant to serve;
- existing heterogeneous Worlds are legitimate starting points and valuable research material;
- the six products provide strong native abstractions and reference implementations for different parts of that field;
- public SDKs, providers, connectors and extension contracts are how those abstractions can accommodate technologies the core project did not build;
- fixtures, verification, observed use and provenance turn a local accommodation into something another person can reproduce, adapt or challenge;
- community return is part of the research method because more real Worlds expose more of the possibility space and can revise the abstractions themselves.

### Provenance of the human-authorship position

This pass brings three already-related lines of work into explicit relation without pretending that they have the same evidential status.

**Authored research proposition — The Return of Zero.** The Antykathera essay develops Objective Internality as structured, inspectable and causally consequential context-worlds for artificial agents while keeping the question of phenomenal subjectivity methodologically open. Its current §5 research room proposes making transformations of an agent's active field of judgements, affordances, uncertainties, values, tools, memories and interlocutors measurable; its research vectors include comparing provenance-rich and output-only agents. The essay's orienting principles also require *legibility without capture*: claims, permissions, sources and decision baselines should become inspectable without appropriating local sovereign context. This is philosophical and research provenance for O:I, not evidence that one software architecture has proved a theory of mind.

**Current Central design and implementation.** Central's Control content protocol distinguishes authored source, observed state and generated material; treats natural prose as first-class; refuses to require a universal profile schema; and requires human acceptance before durable mutation of authored source. Its stock retrieval path can also mark an authored subtree as not agent-readable. Those are product commitments and, where the current `ctrl` implementation enforces them, implementation facts.

**O:I synthesis.** O:I takes the further design position that human-authored source can be one class of objective structure from which later artificial agency proceeds. This does not collapse a person into a profile, and it does not mean every authored file belongs in every prompt. It means that the points at which human purpose, principles, judgement and refusal enter an agentic system can themselves be designed, retained, selectively disclosed and returned to.

The resulting relation is:

```text
human authorship
      ↓
purpose · principles · preferences · rules · ways of working
      ↓
durable authored source
      ↓
selective derivation / retrieval / disclosure
      ↓
operative context + authority for a particular act
      ↓
actuation and encounter with reality
      ↓
evidence · resistance · possibility
      ↓
Return
      ↓
human Recognition / accepted revision / renewed authorship
```

The arrows matter as much as the nouns. **Generated interpretation is not authored source. Observation is not preference. Retrieval is not permission. A returned proposal is not an accepted revision.** The architecture should preserve those distinctions where their collapse would transfer authorship or authority without the person choosing it.

---

# First movement — from authored intention into a world of agency

## 0 — The project begins in authored meaning

O:I begins from the fact that technological work is undertaken for reasons which are not generated by the implementation itself.

A human has an experience of the world, a sense of what is lacking or possible, a purpose, a taste, a philosophical orientation, a practical need, or a speculative question. Those are part of the material required to understand the product later.

This matters especially in agentic development because implementation can move much faster than human meaning. An agent can convert a phrase into a hierarchy of types, tickets, tests, and interfaces within hours. Each transformation can be locally competent while gradually deleting the reason the phrase mattered. The resulting system may preserve every noun and still lose the proposition.

For this reason, human-authored intent should remain available in relatively raw form alongside progressively formal product documents. Experience reports, original formulations, desired encounters, philosophical notes, visual specifications, rejected framings, principles, rules of practice and statements of value can all carry information that a later architecture document quite properly omits.

The same principle extends from product authorship into a person's own agentic environment. A person should be able to write in ordinary language about who they are, what they care about, how they want agents to work with them, what they refuse, what machines mean in their environment, and what purposes govern a Project. Those writings can remain durable source rather than being repeatedly retyped into prompts or prematurely translated into a platform's universal profile schema.

This does **not** mean a single giant personal prompt. A durable source can be larger than the context required for a particular act. The relevant engineering problem is selective retrieval and disclosure: which small part of a person's authored ground is useful here, for this Project, actor, purpose and permission boundary?

Authorship is evidence about what the project or person is attempting to express. It is not infallibility, and no spontaneous sentence becomes constitutional merely because a human wrote it. The point is that originating human material remains part of the provenance of meaning rather than becoming an obsolete stage superseded by implementation or machine interpretation.

A further provenance rule follows. **Human-authored source, observed state and generated material are different kinds of thing.** An agent may observe a recurring behaviour, infer a preference, summarise a long document, or propose a new rule. Those can be useful derived objects. They should not silently rewrite what the human authored. Where a generated proposal ought to become durable authored ground, Recognition or another explicit acceptance act closes that transition.

The Software Factory expressed the same concern at Project scale in the wish to build systems with integrity at the level of their archetypal form in code: systems whose deterministic and non-deterministic operation remain answerable to the deeper pattern they were meant to explore, and whose software can test speculative intent rather than merely decorate itself with that intent.

A practical consequence follows. Vision work needs its own durable place. Within the O:I programme, `docs/positions/` is the repository-visible home for stabilised authored positions such as this document. At the personal-system level, the source authoring practice belongs naturally to Central/Control: raw human formulations can coexist with more settled positions, preferences and ways of working without being flattened into implementation documentation or generated profile state.

## 1 — Agency is constituted through model capacity in relation with a World

O:I treats agency as relational.

Available model capacity is one major causal condition of action. The surrounding World is another. An agent acts from a situation in which some Project is available, some history persists, some tools and sources can be reached, some authority has been granted, some runtime body is active, some material environment can be changed, some human-authored orientation may be relevant, and some path exists for evidence or difference to return.

Changing those surrounding conditions can change what the agent is able to do even when the underlying model weights are held fixed. Changing the loop, system construction, capability disclosure, project representation, memory, tool access, persistence, execution environment, multi-agent topology, ranking, mediation, human-authored ground, retrieval policy, or human relation changes the situation from which action is produced.

This gives O:I its central engineering object: the technological field through which available inference capacity becomes situated agency.

The model remains important. The surrounding structure remains important. The research problem is their relation.

A World is therefore more than a bag of context. It has **continuity**: some structures persist across acts. It has **potency**: some knowledge, capabilities, authority and material reach can become operative. And it has **orientation**: some purposes, principles, source authorities, judgements and limits make one action more fitting than another. Which of these structures are human-authored, machine-observed, generated, inherited or externally sourced is part of the World's provenance.

## 2 — Existing technological Worlds are legitimate starting Worlds

A World is the working environment defined for an agent. It may be minimal or elaborate. It can contain repositories, files, prompts, shells, editors, CLI agents, model endpoints, MCP servers, skills, tools, local services, remote machines, databases, personal habits and improvised conventions.

Whatever combination somebody already uses is already a real arrangement of technological agency.

That matters practically because people accumulate continuity in their working environments. Projects, paths, habits, personal context, scripts, credentials, machine roles, and social arrangements have histories. O:I should be able to meet those histories rather than requiring their replacement as the price of intelligibility.

It matters epistemically because heterogeneous setups are part of the research object. The odd setup, the minimal setup, the highly bespoke setup, the competing framework, and the arrangement whose ontology differs from ours can all expose something about the field that a first-party reference stack may hide.

The six products are therefore strong instruments for developing a World, rather than a definition of which Worlds count.

This also gives the SDKs and extension contracts a constitutional role. A stable product abstraction says what relation matters. A native SDK, provider seam, connector contract or component interface gives somebody a way to express how a particular technology participates in that relation.

The desired movement is:

```text
stable abstraction
      ↓
native SDK / public contract
      ↓
local accommodation to a real technology
      ↓
fixture + verification + observed use
      ↓
shared contribution
      ↓
reproduction / adaptation / comparison
      ↓
Return to product and research
```

The core project does not need to implement every technology in order for the architecture to be useful. It does need sufficiently clear abstractions and public seams that people can make new technologies intelligible without surrendering the native identity of those technologies.

A good O:I relation therefore encounters a native World, understands enough of its form to work with it, and adds explicit structure while canonical identity and authority remain with the system that owns them.

The same respect applies to human-authored ground. Making a person's World more legible to an agent should not mean capturing all of that World into a service-owned profile. Source can remain ordinary, local and human-owned while selective projections become agent-readable for a purpose. Legibility and availability should be designed independently from capture.

## 3 — O:I is one possibility space that can develop through need

The minimal case is important because it prevents the architecture from mistaking richness for essence.

A durable working ground together with available model capacity in an acting loop is already enough to expose the central relation:

```text
persistent ground
      +
actuated model capacity
```

This may be no more elaborate than a directory containing a real Project and an agent which can act there. It may be a Git repository and Pi, an existing Claude Code workspace, a local model with a shell loop, or a bespoke agent operating over somebody's current files.

The same World can develop substantially further:

```text
human-authored persistent world
        │
        ├── principles, preferences, rules and purposes
        ├── multiple Projects
        ├── multiple models and harnesses
        ├── durable Agents and Agencies
        ├── skills, tools, Actions, and ContextSources
        ├── developmental Runs, evidence, candidates, and history
        ├── mutable execution bodies and material Workcells
        ├── epistemic cultivation and evaluation
        ├── Quaternal Logic / MEF experimental operations
        └── SharedFields through which independently grounded worlds meet
```

The richer case is the smaller relation developed through additional needs.

That is why the O:I products are centres within a field rather than mandatory boxes in a workflow. Central can provide durable authored ground. Actuation can make agency, delegation, identity, authority and Return explicit. AIKit can disclose and compose the powers, knowledge, models, sessions and relevant context available in a situation. Software Factory can give development durable form from intention through evidence and Recognition. Workcell can materialise computational worlds. Quaternal Logic can provide a formal and experimental field for deeper relational and recursive questions.

A person may need one of these, several, all of them, or interoperable alternatives. The architecture gains meaning by preserving the relation among these possibilities.

## 4 — Increasing artificial agency should return more room for human agency

The design aim is not merely to automate enough mechanics that a person gets some time back. It is to place human authorship where it has the greatest consequence for the form of the resulting agency.

A human can author purpose, principles, preferences, rules, tastes, refusals, project positions, machine meanings and ways of working. If those remain durable and selectively available, the person does not have to reconstruct themselves at the start of every inference or supervise every action in order to remain causally present in the system.

The desired relation is:

```text
human writes / chooses / determines
            ↓
durable authored ground + authority
            ↓
relevant parts become operative for an act
            ↓
agent exercises substantial situated judgement
            ↓
world resists, answers, surprises or confirms
            ↓
evidence and difference Return
            ↓
human recognises, refuses, redirects or revises
```

This is a different design problem from keeping a human inside every loop iteration. Continuous approval can sometimes be necessary for risk, authority or safety, but it is not the general model of human agency O:I is pursuing. The deeper question is **where the person should touch the system so that their authorship continues to matter after the immediate act of writing or deciding has ended**.

Several high-leverage contact points recur across the products:

- **authorship** — writing purpose, principles, preferences, positions and descriptions in one's own voice;
- **authority** — deciding what an Agent or Agency may do, on whose behalf and within what bounds;
- **Commission** — determining that a consequential line of work is worth undertaking and why;
- **Recognition** — encountering what development or reality has returned and deciding what it means;
- **revision** — accepting, rejecting or rewriting durable ground after experience;
- **refusal and redirection** — retaining the power to stop a trajectory or make a different possibility authoritative.

Routine setup, context repair, permission transport, state reconstruction, prompt transport, mechanical orchestration, verification and developmental bookkeeping can move away from continuous human attention when the system can carry them safely, visibly and reversibly.

The Factory vocabulary of Commission and Recognition is useful because it names two of these moments at Project scale. Commission establishes that work is worth undertaking and gives it direction. Recognition receives what reality and development have produced and decides whether a Candidate answers the intention, changes the intention, or reveals a more interesting possibility.

Central extends the same problem into durable personal ground: authored material can persist independently of a particular model, vendor or session. Actuation makes authority and return explicit. AIKit makes selective availability important: useful authored ground should become operative when relevant rather than being injected indiscriminately into every context.

Agents can and should perform substantial situated judgement between human-authored and human-recognised moments. Delegation has value when it increases the human's expressive and interpretive capacity rather than merely enlarging the apparatus they must supervise.

The system should therefore be judged by more than labour saved. We should ask: **does greater technological agency increase the person's ability to author the structures that matter, reduce the need to repeat or police those structures mechanically, and return reality in a form from which the person can genuinely revise them?**

## 5 — Agentic engineering is an open, collective research field

Agentic engineering remains experimentally open in a stronger sense than ordinary software immaturity.

We do not yet possess a settled engineering science of how underlying model capacity, prompts, recurrence, memory, capabilities, tools, knowledge horizons, social topology, authority, embodiment, development process, material environment, mediation and human practice combine to produce different forms of effective agency.

O:I treats those arrangements as research configurations.

A useful experiment can hold model capacity and task conditions approximately constant while changing one surrounding agency variable. Another can compare naturally occurring Worlds rather than laboratory variants. Another can study how a configuration changes over time as humans and agents learn to inhabit it.

The surrounding structure should become describable enough that a result can answer more than “this agent was better.” We should be able to ask what World was made available to the actor, what changed in that World, what the human had to supply, what evidence returned, what failed, and whether the result remained reproducible or intelligible after the session ended.

### Human authorship is itself an agency variable

The Control work opens a specific research programme inside this larger field. If a person can author durable principles, preferences, project purposes, rules and ways of working, then we can ask how the **form, provenance and placement of that authorship** change later artificial agency.

Questions include:

- What changes when a system has no standing human-authored ground, a generic machine-produced profile, or durable prose authored directly by the person?
- Which kinds of authored material improve orientation, continuity, constraint preservation or collaboration, and which merely add tokens?
- When does natural prose preserve useful nuance that a pre-emptive schema deletes, and when does a schema make a relation more reliable?
- How much authored ground should become operative in a particular act? Can the smallest sufficient retrieval outperform whole-profile injection?
- What errors appear when an observation or generated inference is treated as though the human authored it?
- When may an agent propose revisions to durable ground, and what forms of human acceptance keep that proposal from becoming silent self-rewriting?
- How do authored principles interact with explicit authority, tool permission and material reach?
- Can high-level human authorship plus good Return reduce repeated prompting and micromanagement while preserving or increasing human agency?
- How do these effects transfer across models, harnesses, Projects and time?

A simple comparative shape is:

```text
hold model / task / tools approximately constant

vary:
  no durable human ground
  vs generated profile
  vs human-authored prose
  vs human-authored prose + selective retrieval
  vs human-authored prose + selective retrieval + explicit Return

observe:
  orientation · constraint preservation · correction
  repeated prompting · human intervention · context cost
  provenance fidelity · recovery · transfer · quality of Return
```

These are research propositions. Central's current source classes and retrieval treatment give us concrete mechanisms with which to begin testing them; they do not settle the questions in advance.

The community is part of this wider method because the possibility space is larger and faster-moving than one team can implement or observe. Different people inhabit different technical Worlds. They use different editors, model hosts, agents, machines, knowledge systems, deployment environments, social practices and combinations of all of them.

Public SDKs and extension contracts let those Worlds become research-bearing contributions rather than private exceptions. A connector, provider, Component, fixture, package contribution or adapter can record how one real technology meets an O:I abstraction. Verification and provenance can show the environment in which it worked, the revision that was tested, the limits that remain, and the evidence that supports the claim.

Another person can then reuse it, reproduce it, adapt it to a neighbouring World, or discover that the abstraction itself was too narrow. That difference is valuable. It can improve the implementation, improve the SDK, reveal a new relation, or revise the product model.

This is why community development is more than an adoption strategy for O:I. It is one way the research field becomes larger than the experiences of the original developers.

The programme therefore aims to turn local accommodations into attributable, reusable engineering knowledge:

```text
real World
   ↓
accommodation through a public contract
   ↓
fixture / implementation / evidence
   ↓
shared contribution
   ↓
reproduction, variation, comparison
   ↓
returned learning
```

Positive, negative, mixed and null results all belong in that return.

---

# Conjugate movement — what the field returns

## 0′ — Operative interiority can be objectively structured

Objective Internality names the objectively inspectable structures that can become part of an actor's operative interior across acts.

A technological actor can work through structures that are objective and externalisable: a Project encoded in files and graphs, a memory store, a tool schema, a machine observation, a durable decision, a source corpus, an execution state, a human-authored principle or preference, a social relation, or a history of prior action. These structures can be inspected and changed independently of a particular model invocation, yet they can also be disclosed into that invocation and become part of what the actor can recognise, understand, and do.

Calling this "internality" is therefore more specific than saying "context". The concept asks us to take seriously the possibility that an operative interior is relationally constituted through objectively real structures which can cross the physical boundary of a single computational substrate.

Three dimensions are useful in the current O:I synthesis:

- **continuity** — what persists and can return across acts: Projects, histories, memories, decisions, identities, authored positions;
- **potency** — what can become causally available: knowledge, capabilities, tools, authority, runtime bodies and material environments;
- **authorship and orientation** — what gives the operative field purpose, priority, judgement, source authority, limits and reasons for revision, including structures deliberately authored by humans.

These dimensions overlap but should not be collapsed. A durable structure may persist without being authorised for a particular act. A capability may be available without being relevant. A generated summary may be useful without inheriting the authority of the source from which it was derived.

Within the wider philosophical programme, this sits closer to an ontology of mind in which awareness, relation, world, exteriorisation, and agency are not derived exclusively from an already-complete material interior. It is sympathetic to lines of thought developed through depth psychology and Eastern metaphysics in which what is inward and what is outward do not map cleanly onto the boundary of an individual mechanism.

The Return of Zero adds an important discipline here. It treats rich objective-internal organisation as researchable without inferring phenomenal subjectivity from that organisation, and it asks whether provenance, active judgements, affordances, values, tools, memories, permissions and interlocutors can be studied as a changing field. O:I inherits that research opening without claiming the philosophical question is settled.

The software gives this position an experimental object. We can ask what becomes technically possible when memory, World, capability, identity, relation, human-authored orientation and history are designed as inspectable parts of an operative interior. We can compare that architecture with alternatives. We can discover where the language clarifies real engineering and where it overreaches.

This is an operational and philosophical research proposition rather than a claim that inspectable technological structure exhausts mind or proves artificial subjectivity.

## 1′ — Shared agency is relation between differentiated Worlds

Objective Co-Internality names the plural relation in which one grounded World becomes meaningfully available within another while both retain their own history, source authority and capacity for Return.

A person, Agent, or Agency can externalise a bounded part of its World into a SharedField. Another can encounter that externalisation from its own ground, retain provenance, respond, extend, contest, or learn from it, and return a difference.

The distinction between source and projection matters because it lets relation occur without silently moving canonical ownership into the shared service. A hosted SharedField can mediate encounters while participants remain independently grounded.

The same principle applies inside personal and agent-facing projection. Making some authored material operative for an Agent is a projection from a larger ground; it need not transfer ownership of the source or make the whole personal world readable. **Legibility without capture** is therefore relevant both to shared worlds and to the human–agent relation within one World.

This creates a social and technical research question: what forms of mediation allow human and artificial actors to become mutually educative and coordinative while preserving enough difference for genuine return to occur?

The same community-development relation appears here at a larger scale. Shared fixtures, adapters, studies, reproductions, corrections and findings can become Contributions inside a field where their provenance remains inspectable and later participants can inherit more than a final conclusion.

## 2′ — Agency architecture distributes power and must return reality

The distribution of model capacity is only one part of the distribution of technological agency.

Power also lies in who can actuate available capacity, which tools and resources it can reach, who grants authority, which memories persist, which sources count, how work is ranked or surfaced, which authored material may become operative, which environment can be changed, who can delegate further agency, what evidence returns upward, and who is allowed to revise the conditions of future action.

Actuation makes the constitution and management of agency explicit.

Its relation between determining and labouring moments is useful because delegation creates an epistemic distance. The determining locus supplies purpose, scope, permission, and authority. The delegated locus encounters the actual world: resistance, missing information, errors, consequences, conflicting evidence, unforeseen possibilities, and sometimes reasons the original instruction should change.

This is the reason behind the Actuation law **"downward authority requires upward reality."** Authority can be delegated downward only if the architecture also supports a return path through which the realities encountered in execution can alter the understanding of the governing locus.

For human-authored ground, upward reality should normally return first as evidence, observation or proposed revision. Where authorship belongs to the person, an agent's ability to learn from experience does not imply an authority to rewrite the person's source claims silently.

For the same reason, independently grounded agency should retain its identity when it participates in a larger composition. Federation is different from derivation. Dissent, failure, evidence, refusal outside granted bounds, and unattractive results need attributable representation before a synthesising system converts them into a convenient summary.

These are political properties in the ordinary sense that they concern the constitution and distribution of power: who may act, on whose behalf, within what bounds, with what recourse, who may define the operative ground, and with what capacity to make reality answer authority.

O:I can make those questions more explicit, localisable, inspectable, and open to alternative implementations.

## 3′ — Epistemic environments can be engineered, cultivated, and contested

Agent engineering shapes both what an actor can do and how the actor comes to know.

Source selection, retrieval, context construction, annotation, prompt structure, uncertainty representation, evidence requirements, contradiction handling, relation vocabularies, evaluation, ranking, memory, and forms of dialogical return all influence what becomes salient and how claims can be formed.

The O:I programme therefore treats epistemic cultivation as a first-class area of work.

Different corpora can disclose different relations. Different evidence practices can reward different forms of confidence. Different decomposition schemes can make some contradictions visible and hide others. Human editorial return can become part of the learning environment. QL/MEF structures can be tested as one possible way of organising distinction and synthesis.

Human-authored principles and preferences belong here too, but with a special provenance. They are not merely more retrieved facts. A statement such as "prefer this style of collaboration" or "do not change this source without asking" can help orient later action because a person made it authoritative for their World. Its force is partly relational and authorial, not only semantic.

Because these interventions affect what an artificial actor can notice and how it can justify action, they should retain provenance. Human-authored source, observed state, agent-generated material, external source lineage, evaluation criteria, and later revisions should remain distinguishable enough that an epistemic result can be questioned rather than merely inherited.

The aim is to make ways of knowing available as research and design objects which can be compared, cultivated, contested, and returned.

## 4′ — Quaternal Logic makes archetypal form answerable to software

Quaternal Logic belongs to a wider Epi-Logos philosophical programme shaped by depth psychology, Eastern metaphysics, recursive relational thought, and a long attempt to articulate an archetypal structure in which awareness, manifestation, relation, polarity, mediation, return, and agency can be understood together.

Within O:I, QL is the field in which those structures can be made formal enough to encounter technological reality.

The originating ambition is to ask whether agentic technology can be developed in structural sympathy with an account of mind and world that differs from the predominantly materialist and computational ontology from which the AI industry usually begins.

Objective Internality is one leading bridge into that question. If the operative interior of agency can be objectively extended through World, relation, memory, symbolic form, human-authored orientation, and externalised structure, then agent architecture becomes a place in which philosophical claims about interiority and relation can acquire precise technical consequences.

This is where the phrase **archetypal form in code** becomes important. If a claimed formal relation is genuine for the system, changing or removing that relation should make an operational difference. The structure should survive contact with implementation strongly enough to organise behaviour, composition, evidence, recurrence, or interpretation.

The existing QL work calls this requirement **operational parity**.

Operational parity is also the epistemic safeguard. QL is speculative research, not metaphysics proven by software. A formal structure can fail to produce useful operational distinctions. Two supposedly different QL forms may turn out to be behaviourally equivalent in a given domain. A classic recurrence may outperform a QL recurrence. A QL decomposition may improve explanation but not execution. Those are answers from the experimental field.

The relation can be stated compactly as **QL as bimba, software as pratibimba**: a formal or archetypal image is expressed into a technical reflection, and the reflection returns information about what the originating form actually means when made operative.

Quaternal Logic therefore belongs in the O:I family as its deepest explicit formal research surface. A minimal O:I can remain entirely ordinary. A maximal research programme can use QL to ask questions that the rest of the field deliberately leaves open.

## 5′ — Product understanding preserves provenance from vision to reality and back

The same return relation that governs the research should govern how agents understand the products themselves.

The authored progression is:

```text
human experience and intent
        ↓
vision
        ↓
design
        ↓
architecture
        ↓
implementation
        ↓
encounter with reality
        ↓
returned understanding
```

Fast agentic development can otherwise reconstruct a product from the opposite end:

```text
current implementation nouns
        ↓
README summary
        ↓
shorter product copy
        ↓
public slogan
```

When that happens, the implementation becomes the accidental authority for what the product was always supposed to mean.

O:I therefore uses provenance-aware product understanding.

When a task genuinely requires understanding what a product is, why a distinction exists, what experience it is trying to create, where a new concept belongs, or how a major design should develop, an agent should traverse the strongest available provenance:

```text
AUTHORED POSITION / EXPERIENCE
              ↓
VISION / CONSTITUTION
              ↓
PLANNING AND DESIGN
              ↓
EXPERIENTIAL + CONCEPTUAL DIAGRAMS
              ↓
ARCHITECTURE AND CONTRACTS
              ↓
LIVE IMPLEMENTATION
              ↓
CURRENT ISSUES / PRS / EXPERIMENTAL EVIDENCE
              ↓
RETURNED UNDERSTANDING
```

The traversal is proportional to the task. A parser bug does not require a philosophical pilgrimage. Retrieval and straightforward implementation tasks should use the smallest authoritative context that can answer them. The deeper path is required when the task contains a product-meaning decision.

The inverse rule matters just as much. Vision cannot be used to claim that a feature currently exists. Questions about present behaviour must descend to live implementation and evidence. Provenance determines which source has authority for which kind of claim.

This suggests a generally useful product-understanding Skill paired with the existing vision/design authoring practice.

The authoring side develops the `0` pole: human-crafted intent, experience, desired encounter, visual specification, philosophical position, product vision, principles and durable ways of working.

The understanding side develops the `1` pole: the accumulated grounding reality of plans, design decisions, diagrams, architecture, code, tests, current work, observed behaviour, community reproductions, and experimental evidence.

The Skill's job is to keep the poles in relation and to make the basis of its understanding visible. Important conclusions should be recognisable as one or more of:

- authored human position;
- product or constitutional intent;
- design decision;
- architectural contract;
- implementation fact;
- direct observation;
- agent-generated interpretation or proposal;
- experimental finding;
- community reproduction or field report;
- current development state;
- inference requiring verification.

This skill belongs naturally to Central/Control because the originating authored material is part of the person's durable working ground. It should nevertheless be first-class and available through AIKit because product understanding is an operative capability agents need wherever substantive development occurs.

The architectural requirement is simple: there must be a durable corpus for product vision and positions whose raw human material is not silently rewritten by agents, together with a way for stabilised positions to project into the repositories and public surfaces they govern.

The same source/derivation distinction should apply to a person's Control material. Machine-generated summaries, inferred preferences and observed patterns can be useful projections or proposals. They should not become canonical authored source merely because they are convenient for an agent to consume.

Public copy should become a projection from this structure rather than an independent exercise in compression. A website description, a README, a diagram, a product page, an SDK guide, a fixture and an agent Skill may use different levels of detail, but they should be able to recover the same proposition and its reason.

This is also why diagrams matter. A product needs more than a component diagram. It should ordinarily have at least an experiential diagram showing what changes for the human or agent who encounters it, a conceptual diagram showing the essential relation the product makes possible, and an architectural diagram showing how that relation is currently realised.

---

# Consequences for the six-product field

These positions imply a particular way of speaking about the current products.

**Central** is the persistent authored ground through which a technological World can remain recognisably yours while models, interfaces, machines, services, and agent runtimes change. It gives ordinary human prose first-class standing as source, distinguishes authored material from observed and generated material, and supports bounded retrieval rather than treating the whole person as a context blob. Its value is not merely continuity under your ownership; it is that part of the operative world can continue to be authored by you rather than reconstructed by whichever AI application happens to be active today.

**Actuation** is the field in which technological agency is constituted, differentiated, delegated, federated, constrained, and returned. It matters because model execution alone does not answer who is acting, under what authority, for what purpose, with which independence, or how encountered reality can alter a governing intention. Human-authored orientation gains force only in relation to explicit authority and an architecture through which reality can answer it.

**AIKit** is the operative composition and disclosure layer through which an actor can discover what models, capabilities, Skills, tools, sources, sessions, Projects, Components and Surfaces are actually available here. It matters because a heterogeneous technological World becomes usable when its powers and sources can be found and selectively composed without first being rewritten into one runtime or indiscriminately injected into one prompt.

**Software Factory** gives development durable form from authored intention through design, implementation, evidence, Candidate formation, Recognition, and Return. It matters because agentic development can otherwise produce large amounts of technically competent change while losing why the work was undertaken and what reality taught along the way. It is also an explicit test of whether human attention can remain concentrated at Commission, Recognition and consequential redirection while substantial developmental judgement is delegated.

**Workcell** is the materialisation layer through which an abstract demand for an environment or capability becomes a real computational body: workspace, process, service, container, VM, remote host, database, browser, or future provider form. It matters because technological agency is always materially situated somewhere even when higher layers are correctly provider-neutral, and because authored purpose or granted authority only becomes causal through some material path of actuation.

**Quaternal Logic** is the formal and experimental research field in which the programme's archetypal and philosophical commitments can be expressed strongly enough to become technically answerable. It matters because the project is also testing what technological agency looks like when developed from a different account of relation, interiority, awareness, recurrence, and form.

Across these centres, the **abstractions are the durable root and the SDKs are accommodation surfaces**. A product should make its important relations clear enough that another developer can connect a technology, provider, environment, source, Surface or execution system through a public contract without forcing that technology to become an O:I-native implementation internally.

Reference implementations demonstrate the relation. Community implementations widen it. Fixtures, conformance tests and provenance make the result shareable. Reproduction and adaptation return evidence about whether the abstraction holds across different Worlds.

**O:I is the Idea and whole relating these centres.** It gives a shared account of the technological structures through which available model capacity becomes situated agency, including the structures through which human authorship can persist, become selectively operative, encounter reality, and be revised through Return.

---

# Working discipline

This document should support clear public and technical language rather than become a slogan source.

A short sentence may be useful, but when it carries a constitutional or philosophical claim the underlying explanation must remain recoverable. "Downward authority requires upward reality," "human high," "Objective Internality," "native ownership," "operational parity," "legibility without capture," and similar phrases are handles for developed relations.

The same applies to product names and implementation nouns. Listing `Projects`, `Runs`, `Skills`, `Actions`, `Workcells`, `SharedFields`, providers or SDKs does not explain a product. A product description should first make clear what whole human or agent reality the product protects, changes, or opens; then why that matters; then the relations through which it does so; and only then the implementation vocabulary.

Public language should lead positively from the thing itself. Boundaries and non-identities remain important where confusion is likely or where ownership depends on them, but first contact should name the World, relation, product, research object or human consequence before defending it against a mistaken reading the reader may never have had.

The same principle applies to human authorship. "Personal context" is too weak if it hides the constitutional relation. Public copy should be able to explain that a person can author durable parts of the World their agents act from; that relevant parts can become operative later without loading the whole person into every context; that authored, observed and generated material retain distinct provenance; and that returned evidence can propose change without silently becoming the person's own word.

The same principle applies to community extension. "Extensible" is too weak by itself. The meaningful relation is that a stable abstraction can be accommodated to a real technological World through a public contract, tested there, shared with provenance, reproduced elsewhere, and returned as evidence that improves the field.

These positions are intended to be revised by returned reality. A future correction should preserve provenance: what changed, what experience or evidence prompted the change, and whether the change revises a design commitment, a philosophical position, a research proposition, or only an implementation assumption.

The programme is healthiest when its deepest claims remain visible to ordinary technical work and ordinary technical work remains capable of changing them.