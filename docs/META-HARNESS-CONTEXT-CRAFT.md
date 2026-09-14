# Meta-harness and Context Craft

**Status:** research synthesis + design proposition + live implementation note  
**Primary authored ground:** `docs/positions/FOUNDING-POSITIONS.md`  
**Source study:** `docs/AGENTIC-ENGINEERING-DAVID-ONDREJ-TRANSCRIPT.md`  
**Native praxis owner:** `EpiLogos/ai-kit`  
**Whole-field relation:** {O:I}

## 1. Why this note exists

The Agentic Engineering transcript contains a concrete account of something the {O:I} founding positions already imply: an agent does not become coherent only because a model is capable or because one prompt is good. Coherence can be deliberately cultivated in the surrounding world through authored artifacts, retrieval structure, reusable praxis, session orientation, validation and returned evidence.

The transcript calls one version of that arrangement a **meta harness** and repeatedly treats markdown engineering, context structure and process validation as serious engineering work. The useful move for {O:I} is to recover the relation beneath those phrases, place it inside the suite's existing ownership model, and make the resulting praxis available to agents as first-class knowledge.

This note therefore keeps four things distinct:

1. what the transcript actually reports;
2. what current {O:I} authored positions already establish;
3. what we derive as a research/design proposition;
4. what has now been implemented as agent-facing AIKit/O:I knowledge on the associated development branches.

## 2. Authored ground already present in {O:I}

### 2.1 Agency is relational

`FOUNDING-POSITIONS.md` holds that effective agency arises through a relation among the model and the surrounding world that situates, provisions, informs, remembers, materialises and returns action. The model boundary is therefore not the whole operative interior.

`0′ Objective Internality` makes the same claim from another side: Project files and graphs, durable decisions, memory, tool schema, machine observations, source corpus, execution state, authored preference, social relation and history can become part of what an actor can recognise, understand and do.

The meta-harness proposition belongs here. It is a way of deliberately shaping portions of that operative interior.

### 2.2 Epistemic cultivation is engineerable

`3′ Epistemic cultivation` explicitly treats context construction, prompt structure, retrieval, source selection, annotation, uncertainty, evidence, contradiction, relation vocabulary, evaluation, ranking, memory and dialogical return as conditions that shape how an actor knows.

This gives context craft its deeper meaning. Context is not merely input text. It is the selected epistemic field through which a wider Project/human world becomes locally available for judgement and action.

### 2.3 Product understanding already has a provenance path

`5′ Provenance-aware product understanding` gives a directional semantic progression:

```text
human experience / intention
        ↓
vision
        ↓
design
        ↓
architecture
        ↓
implementation
        ↓
encounter reality
```

and a corresponding traversal from authored position through current implementation, current work/evidence and returned understanding.

Meta-harness craft should compose with that traversal. Product understanding asks **what this world means and what is real now**. Meta-harness craft asks **how the operative world around repeated agent work can make that understanding and its associated praxis more reliably available**.

### 2.4 Human authorship and returned reality form a circuit

The founding positions place human attention near purpose, vision, judgement, taste, alternatives, interpretation and recognition, while giving agents room to make real developmental judgements between authored boundary moments.

For Software Factory work, this is expressed through Commission and Recognition. More generally the relation is:

```text
human authorship
        ↓
engineered operative context
        ↓
agent judgement + action
        ↓
material encounter
        ↓
returned evidence / understanding
        ↓
renewed human authorship where consequential
```

The transcript contributes unusually concrete machinery for the middle of this circuit.

## 3. What the transcript contributes

The following are **source-derived observations from the transcript**, not {O:I} constitutional claims.

### 3.1 Markdown is treated as part of engineering

Near the opening, the speakers state that engineering the markdown can deserve more time than executing the code. Across the discussion, this means designing project artifacts that carry intent, plans, architecture, conventions, user feedback, process and history in a form that both people and agents can work with.

The important property is not the filename extension. The described artifacts are useful because they can be human-readable, agent-readable, versioned, indexed, typed by convention, validated, linked and revised.

### 3.2 A project can become a context base

Around 10:54–16:01, the transcript describes teams storing shared Project-specific knowledge and Skills in repositories so multiple human/agent workers can enter the same operative world. Later the speakers describe a Project repository containing marketing context, user feedback, deployment context and engineering material, and call the resulting whole a `context base` / `meta harness` rather than merely a code base.

The underlying relation is persistent Project world → selected context → action.

### 3.3 The process is artifact-shaped and typed

Around 35:43–40:32, the speakers describe constructing a packet of context for each engagement or Project, defining artifact sets, conventions, parseable metadata and indexes, and associating shared Skills with artifact types.

They describe a human/agent context CLI, an agent-oriented startup context packet, architecture/convention retrieval, and a recent-activity log that agents write back after significant work.

This is a concrete managed-context machine:

```text
persistent artifacts
    + metadata / indexing
    + artifact-specific praxis
    + context resolution
    + startup orientation
    + write-back
```

### 3.4 Validation makes non-code process inspectable

Around 44:20–46:36, the transcript describes a validation command with many rules checking the path from requirements/problem through PR/product state. It detects drift between declared and current state and enables agents to surface or repair inconsistencies.

This is especially important for {O:I}: the value of a context artifact rises when some of the relations it claims can return evidence rather than remaining inert prose.

### 3.5 Long-running work needs orientation and return

Around 15:44–16:01 the speakers discuss entropy/divergence in longer tasks. Around 47:53–49:44 they argue that each session should begin with enough Project context for the agent to enter as a situated senior collaborator rather than rediscovering the world from scratch.

The transcript's practical answer combines a startup seed with process Skills and on-demand retrieval.

### 3.6 Human contribution remains strongest at the authored boundaries

Around 20:25–20:59 the speakers describe human value at the `first mile` and `final mile`. In {O:I}/Factory terms this maps naturally onto originating purpose/Commission and Recognition/returned judgement, while agents operate through a deliberately structured middle.

This mapping is an **{O:I} interpretation**, not terminology used by the source.

## 4. Derived proposition: meta-harness

### 4.1 Definition

**Research/design proposition:**

A **meta-harness** is the deliberate, inspectable and revisable arrangement of persistent artifacts, context-selection rules, reusable praxis, validation and return paths through which a model becomes situated enough to act coherently across sessions.

A narrow harness concerns model↔execution adaptation. The meta-harness names the wider operative relation around the harness.

```text
persistent human / Project world
        ↓
addressable sources + artifacts + maintained knowledge
        ↓
Focus + retrieval / selection
        ↓
bounded ContextResolution
        ↓
Skills + Methods + Actions + harness
        ↓
agent action / development
        ↓
material encounter
        ↓
validation + evidence + write-back + history
        ↓
revised knowledge / praxis / authored proposal
```

This is a cross-product relation, not a seventh {O:I} product surface.

### 4.2 Why this changes agent capability

A capable model can still spend large amounts of intelligence reconstructing the local world: what matters, which sources are authoritative, what current state is, how this Project works, what conventions have already been learned, what evidence counts, and how results should return.

A well-crafted meta-harness moves those relations into inspectable shared structure. This changes the agent from an isolated solver receiving an instruction into a situated participant that can recover its operative world, apply accumulated praxis, make current judgements and leave the world better articulated for the next act.

The gain is not simply more context. It is **better relations among context, authority, praxis and return**.

## 5. Why markdown matters

**Derived design proposition:** markdown is a particularly useful transparent authoring substrate when the artifact benefits from these properties:

- simultaneous human and agent readability;
- ordinary versioning and diffability;
- stable headings, links and paths for addressability;
- lightweight metadata and typing;
- straightforward indexing and retrieval;
- source/provenance references;
- compatibility with validators and generators;
- portability across harnesses and tools.

The medium is serving a deeper requirement: **structured, queryable, provenance-bearing artifacts whose relations can be inspected and revised**.

That lets us ask of an important markdown artifact:

```text
What act is this for?
What role does it play?
Who/what authored or derived it?
What scope and authority does it carry?
How is it addressed and retrieved?
What does it relate to?
Is it stable, working, generated, historical or candidate material?
What returned reality should revise it?
What can be validated?
```

This is what “engineering the markdown” means in the {O:I} paradigm: engineering the shared cognitive and developmental relations carried by the artifact.

## 6. Derived proposition: world-situated agency

The research prompt that motivated this work asks for a meta-perspective on the AI's relation not only to a local notion of `self`, but to its human collaborator and to the wider human world from which its operative capacities derive.

The most useful operational articulation is **world-situated agency**.

An agent can locate, as far as the current task requires:

1. the human or Project purpose within which the act has meaning;
2. its current Agency, body, harness, capabilities and authority;
3. the authored sources and provenance governing the work;
4. the wider human world of language, concepts, standards, institutions, tools, codebases, research, histories and practices on which the work depends;
5. the Focus and smallest sufficient active context for this act;
6. the wider discoverable ContextSource horizon beyond that active context;
7. the material action/encounter and the path by which evidence returns.

The psychoanalytic phrase `big Other` can remain a productive research pointer for the fact that an actor's intelligibility and actionability arise within inherited symbolic/social worlds larger than the local exchange. The engineering term `world-situated agency` keeps the operational relation explicit without requiring the product to encode one theoretical vocabulary.

This extends Objective Internality in a useful direction: the operative interior is not merely enlarged by files and tools. It is **situated within humanly inherited relations that provide language, norms, concepts, infrastructure, practices and purposes**.

## 7. The meta-harness reflex

The key agentic improvement is to make the meta-perspective **generative during ordinary work**.

A well-situated agent should be able to notice when local success or recurring friction suggests a durable improvement to the operative world and forward that improvement to the native owner.

**Derived praxis:**

```text
recurring orientation / relation
    → Guidance

recurring intelligent procedure
    → Skill

contextual composition around a purpose
    → Method

Project/profile-specific adjustment
    → UsageOverlay

repeated source lookup
    → ContextSource / index improvement

repeated explanation of a stable relation
    → durable source or maintained knowledge artifact

recurring vocabulary ambiguity
    → vocabulary / ontology / semantic-ref proposal

repeated drift
    → validator / verification rule

repeated re-orientation after session reset
    → startup seed / context-resolution improvement

repeated mismatch between intention and outcome
    → Claim/Evidence return + Method/design/authored review

successful local pattern with wider value
    → reusable Skill / Method proposal with provenance
```

The agent should forward a compact proposal containing the observed pattern, the reason it matters, the native owner/object, the expected human/agent effect, and supporting evidence/provenance. Consequential changes to authored meaning arrive at human Recognition.

This is the move from **using a good context** to **participating in the cultivation of the context system itself**.

## 8. Native ownership across the six-product field

The meta-harness is experienced as one operative world while its parts retain native ownership:

```text
Central
    human-authored Ground, durable personal/Project authorship, ordinary Work

Actuation
    Agency, actuation/agent loop, authority, model/harness/agent-instance research

AIKit
    ContextSources, Guidance, Skills, Methods, SkillSets, Profiles,
    ContextResolution, harness projection, meta-harness praxis

Software Factory
    developmental Projects/Runs, Claims, Evidence, validation/return,
    Commission/Recognition, candidates/repair

Workcell
    material body, execution, services, storage, network/fabric, lifecycle

Quaternal Logic
    formal/named structural projection where operationally warranted

{O:I}
    sparse composition/disclosure/projection of the whole relation
```

The ownership map matters because the agent's operative world crosses surfaces while each durable fact or capability still needs an authoritative home.

## 9. Context resolution: small seed, wide horizon

The transcript's startup-context idea becomes stronger when combined with AIKit's current ContextResolution model.

A session does not need the whole Project world in its prompt. It needs a compact orientation into a discoverable world.

A useful seed can include pointers to:

- Project / Agency / Focus identity;
- authored ground;
- selected SkillSet and Methods;
- relevant ContextSources;
- current working/history refs;
- governance/authority;
- validation and return expectations.

Keep these distinct:

```text
available world
    everything the authorised actor could discover

selected / projected world
    sources and capabilities chosen for this Project/Profile/Focus

active context
    material actually resolved into the current act

used evidence
    material actually relied on for judgement/action
```

This relation preserves both rich whole-world awareness and the smallest sufficient context for local work.

## 10. First-class plumbing implemented with this study

The associated development work uses existing AIKit primitives rather than introducing a new prompt framework.

### AIKit branch: `praxis/meta-harness-context-craft`

Added:

- `guidance/aikit/world-situated-agency`
  - standing SessionStart orientation;
  - locates purpose, Agency/body/harness, provenance, inherited human world, context horizon and return;
  - instructs the agent to surface durable meta-harness improvements when recurring patterns become visible.

- `skill/aikit/meta-harness-craft`
  - reusable procedure for crafting persistent artifacts, bounded context, startup orientation, validation and return;
  - includes the meta-harness reflex and proposal format;
  - composes with `product-understanding`, `knowledge-navigation`, `skill-authoring`, `profile-skillset` and `verification`.

- `aikit-project-author` SkillSet membership for `meta-harness-craft`.

### {O:I} branch: `research/meta-harness-context-craft`

This note is the provenance-bearing source study and design synthesis. The O:I AIKit profile selects the new Guidance and Skill so the paradigm becomes available during live {O:I} work. The local `{O:I} Agent Skill` also carries the whole-field routing/reflex needed to forward improvements to their native owners.

These are **implementation facts on development branches** until merged and projected into a concrete harness/profile runtime.

## 11. Research propositions opened by this work

The transcript is useful because it supplies an existence proof for a practical style of context engineering. {O:I} can now study a broader field rather than copy one company's arrangement.

High-value experiments include:

### A. Entry quality

Can a fresh agent enter a mature Project with a thin seed plus discoverable sources and reach a correct working model faster than with a large static project prompt?

### B. Context provenance

Can ContextResolution expose not only what was selected, but why, from which source/revision/authority, and what evidence was actually used?

### C. Praxis cultivation

Can repeated successful local procedures be detected and proposed as Skills/Methods with enough evidence that a human can recognise the reusable pattern?

### D. Drift as returned reality

Which markdown/context relations are valuable enough to validate mechanically? Can status, architecture, source refs, generated projections and Method dependencies return clean drift evidence?

### E. Human attention

Does the meta-harness shift human attention toward purpose, judgement, alternatives and Recognition while maintaining or increasing the depth of agent work?

### F. Shared-field transfer

When Project/world praxis becomes genuinely reusable, what should travel across the {O:I} SharedField as a Skill, Method, instrument, source pattern or verified example? How should provenance, compatibility and local adaptation remain visible?

That last question connects directly to the wider idea of a library/makerspace of agent instruments: the thing being shared is not only code or a prompt, but a piece of cultivated operative praxis with provenance and an intelligible place in a larger world.

## 12. Working conclusion

The transcript's deepest useful signal is that **the surrounding cognitive-developmental world can itself be engineered**.

{O:I} already had the constitutional pieces: relational agency, Objective Internality, epistemic cultivation, provenance-aware product understanding, native ownership, human authorship and returned reality. The meta-harness study makes their operational conjunction more explicit:

```text
humanly inherited + locally authored world
        ↓
articulated sources / knowledge / praxis
        ↓
bounded context resolution
        ↓
situated agent action
        ↓
material encounter
        ↓
evidence + reflection
        ↓
world / praxis cultivation
```

The agent thereby gains a first-class capacity not only to work **within** a context, but to recognise how that context participates in its own agency and to help cultivate the shared world in which future human and agent work becomes possible.
