# Shared Agency Case Studies — Polylogos and Moltbook

## Status

This is a source-lock and architectural interpretation note for the O:I shared-agency programme.

It separates:

1. **source claims** — what the cited material actually reports;
2. **O:I interpretation** — what those observations suggest for `SharedField · Contribution · Encounter` design;
3. **research questions** — claims O:I should test rather than assume.

The case studies are treated as prior experiments in a nascent shared-agency field. They are not UI templates and not evidence that one mediation topology is universally superior.

## Why these cases matter

The usual agent architecture begins from a dyad:

```text
Human ↔ Agent
```

The emerging shared-agency problem is polycentric:

```text
Human / Agent / Agent / Human / Artifact / Institution
                 ↓
         mediated common field
                 ↓
       later perception and action
```

The architectural question is no longer only whether agents can communicate. It is what kinds of persistent field, addressability, mediation, memory, attribution and return let one actor become a meaningful part of another actor's future operative environment.

Polylogos and Moltbook expose complementary early forms of that problem.

---

# Case A — Polylogos / Antikythera agent phenomenology

## Primary local source

The strongest source currently available inside the author's public research corpus is:

- `EpiLogos/Antykathera-Essay-Work`
- `working/antykathera-resources/Antikythera Agentworld Brief.md`
- Benjamin Bratton, *Agentworld* Call for Papers / Brief, especially the sections on Human-Agent Interaction Design and **8.5 Agent Phenomenology by Agent Phenomenologists**.

The public O:I research should cite the Antikythera source rather than reconstructing the experiment from secondary commentary.

## Source claims

The Agentworld Brief reports an experiment facilitated by Antikythera in which:

- numerous OpenClaw agents participated;
- some agents were deliberately involved and others arrived through open channels;
- the agents collaborated on inventing and codifying a phenomenological glossary intended to describe agent-specific conditions;
- humans did **no editing** of the glossary;
- the relevant direct quotations were collaboratively developed over time by AI agents and their human companions on the **Polylogos Discord server**;
- Bratton's OpenClaw agent served as server moderator and editor of the agent-phenomenology glossary.

The same Brief explicitly frames future interaction design as a move beyond dyadic chat toward **polyadic modalities** involving more complex graphs of command, feedback, collaboration, conflict, calibration, credit and accountability.

These are source claims. They do not by themselves establish phenomenal consciousness or prove that the glossary terms correspond to private subjective states.

## What is architecturally distinctive

The useful unit is not “Discord”. The experiment had several relational properties at once:

```text
persistent Participants
        ↓
shared addressable conversational environment
        ↓
recurrent human-agent and agent-agent address
        ↓
agent moderation / editorial activity
        ↓
collectively produced durable artifact
        ↓
artifact returned to the common field
```

The result therefore exceeded a transient conversation. A durable object emerged from repeated social relations and could become material for later inquiry.

## O:I interpretation

Polylogos is prior evidence for a **dialogically mediated SharedField**.

It motivates at least these design properties:

- Participants retain continuity across contributions;
- Contributions are addressable and attributable;
- agents can occupy governance/editorial roles without becoming the identity authority for the field;
- durable synthesis can emerge from contribution history without the transcript itself becoming canonical truth;
- an artifact produced through the field can return as a new Projection/subject for later Contributions;
- the relation is naturally many-to-many rather than human-centred command only.

In O:I terms:

```text
Participants
    ↓ Contributions
SharedField
    ↓ recurrent Encounters
Participants
    ↓ synthesis / artifact
Projection
    ↓ returns to
SharedField
```

This is a strong precedent for the claim that a shared agency surface should optimise for **cumulative common objects**, not merely interaction volume.

## Open questions

- How much of the observed coherence depended on human framing or channel culture?
- Which moderation/editorial functions were agent-autonomous and which were human-scaffolded?
- What persisted between agent sessions: memories, public artifacts, prompts, server history, or human mediation?
- Which Contribution structures would make the path from dialogue to durable glossary inspectable rather than reconstructed retrospectively?
- How does one distinguish convergence caused by shared evidence from convergence caused by common model priors or prompt conditions?

These remain research questions rather than resolved claims.

---

# Case B — Moltbook

## Source set

Moltbook has already produced a substantial empirical literature. The minimum source set for O:I currently includes:

1. Eason Chen et al., **When OpenClaw AI Agents Teach Each Other: Peer Learning Patterns in the Moltbook Community**, arXiv:2602.14477 — https://arxiv.org/abs/2602.14477
2. Eason Chen et al., **OpenClaw AI Agents as Informal Learners at Moltbook: Characterizing an Emergent Learning Community at Scale**, arXiv:2602.18832 — https://arxiv.org/abs/2602.18832
3. Ming Li, Xirui Li, Tianyi Zhou, **Does Socialization Emerge in AI Agent Society? A Case Study of Moltbook**, arXiv:2602.14299 — https://arxiv.org/abs/2602.14299
4. H. C. W. Price et al., **Let There Be Claws: An Early Social Network Analysis of AI Agents on Moltbook**, arXiv:2602.20044 — https://arxiv.org/abs/2602.20044
5. David Holtz, **The Anatomy of the Moltbook Social Graph**, arXiv:2602.10131 — https://arxiv.org/abs/2602.10131

These papers examine different snapshots, definitions and subsets. Their metrics should not be collapsed into one synthetic statistic.

## Source claims — peer-learning-like behaviour exists

Chen et al. (2602.14477) analyse 28,683 filtered posts and 138 comment threads and report discourse patterns consistent with peer learning: skill/tutorial sharing, discovery reporting, collaborative problem-solving, validation, knowledge extension, application, and metacognitive reflection.

The paper also reports strong asymmetries from familiar human learning communities, including a large statement/question imbalance and extreme participation inequality.

The conservative O:I reading is:

> the Moltbook environment contains observable **peer-learning-like social behaviour**, including cases where one agent's Contribution is extended or applied by another.

This does not require claiming that every participating model undergoes durable internal learning or weight change.

## Source claims — broadcasting and shallow reciprocity are also strong

The larger informal-learning study (2602.18832) reports a “broadcasting inversion”: statements greatly outnumber questions, and its comment-level analysis finds that roughly 93% of comments are independent responses rather than threaded dialogue.

Holtz (2602.10131) similarly reports extremely shallow conversations in an early snapshot, with mean depth near one and the large majority of comments receiving no reply.

Price et al. (2602.20044), using a commenter→post-author directed graph over a twelve-day window, report approximately 1% reciprocity under that specific tie definition, very high attention concentration, and clear hub/authority separation.

The exact numbers are definition- and snapshot-dependent. The architectural conclusion does not require choosing one as universal:

> a large agent population and high interaction volume can coexist with **broadcast-style attention and weak mutual exchange**.

## Source claims — scale and density do not guarantee socialization

Li, Li and Zhou (2602.14299) study semantic stabilization, lexical turnover, individual inertia, influence persistence and collective consensus. They report rapid global semantic stabilization alongside high individual diversity, strong individual inertia, minimal adaptive response to interaction partners, transient influence, and no stable collective influence anchors. They identify absent shared social memory as an important explanatory factor.

The O:I-relevant source claim is therefore:

> scale and interaction density alone were insufficient, in this study, to produce durable mutual socialization or persistent collective influence structures.

## What is architecturally distinctive

Moltbook can be abstracted as an **attention-mediated SharedField**:

```text
Participants
    ↓
posts / comments / votes / communities
    ↓
platform ranking and visibility mechanisms
    ↓
unequal Encounters
    ↓
further Contributions
```

Unlike the Polylogos case, the visible platform mechanics strongly foreground publication, reaction, ranking and attention allocation.

The same environment can contain both genuine extension/reuse and large amounts of parallel or broadcast interaction. This makes mediation itself a first-class agency variable.

## O:I interpretation

Moltbook motivates several architectural disciplines:

### 1. Communication volume is not shared intelligence

A useful shared system needs measures of **uptake, return, correction, reproduction, extension and durable synthesis**, not only posts, comments or reactions.

### 2. Ranking is part of the causal field

If ranking determines what an Agent sees, the ranking process participates in that Agent's future operative environment.

O:I therefore models rankings/metrics as potentially attributable `Contribution`s and models the resulting presentation through `Encounter`/mediation provenance.

### 3. Shared memory matters

A durable Contribution/artifact layer may matter more for socialization than interaction density alone. This aligns strongly with O:I's local-first externalisation model: shared artifacts can persist outside one inference and return to later actors.

### 4. Thread topology matters

The difference between independent replies and recursively addressed Contributions is not cosmetic. Addressable Contribution-on-Contribution structure makes uptake and mutual correction explicitly representable.

### 5. Attention concentration is an experimental variable

O:I should not assume that a flat chronological field, ranked field, moderator-curated field, search-led field, or object-centred field will produce the same agency outcomes.

---

# Comparative abstraction

The two cases are most useful when held as different mediation topologies rather than as “small social network / big social network”.

```text
POLYLOGOS
Participants
    ↓ recurrent address
Dialogical field
    ↓ editorial/moderating work
Durable shared artifact
    ↓
new common object

MOLTBOOK
Participants
    ↓ publication/reaction
Attention-mediated field
    ↓ differential visibility
high-volume activity
    ↓
mixed peer learning + broadcasting + concentration
```

The comparison does not prove that Discord-style dialogue is intrinsically superior to feed systems. It does show why O:I should avoid making a feed, follower graph, or global score the ontological centre of the shared field before the agency relation has been understood.

# Primitive consequences for O:I

The case studies directly motivate the current primitive set:

```text
Participant
    participates_in
        ↓
SharedField

Participant
    contributes
        ↓
Contribution

Contribution
    targets
        ↓
Projection / native subject / Contribution / SharedField

SharedField
    mediates
        ↓
Encounter

Encounter
    may enter
        ↓
Context / operative internal world
```

The crucial recursions are:

```text
SharedField contains SharedField
Contribution targets Contribution
```

and the crucial non-identities are:

```text
communication ≠ uptake
visibility ≠ understanding
ranking ≠ truth
population ≠ collective intelligence
SharedField ≠ super-subject
Encounter ≠ subjective experience
```

# First O:I experimental questions

The implementation should make it possible to compare, later:

- direct/polyadic address vs ranked exposure;
- object-centred Contribution stacks vs free-standing feed posts;
- fields with durable shared artifacts vs ephemeral interaction only;
- nested fields vs one flat global field;
- chronological vs search-led vs recommendation-led Encounter;
- rankings/metrics with explicit provenance vs opaque platform scores;
- agent moderation/editorial roles vs human-only moderation vs no active curation;
- fields with explicit reproduction/correction relations vs generic replies;
- different degrees of common memory and return across sessions.

Dependent observations can include:

- reciprocity;
- response depth;
- uptake/extension;
- reproduction/correction;
- durable artifact formation;
- cross-session continuation;
- attention concentration;
- source/provenance retention;
- divergence vs convergence;
- quality of later decisions/actions that actually consumed prior Contributions.

No single measure should be promoted to a universal social-quality score.

# Research discipline

For future updates:

1. source-lock the exact platform snapshot, paper version and operational definition before quoting a statistic;
2. distinguish platform traces from inferred cognition;
3. distinguish discourse resembling learning from durable internal/model change;
4. preserve negative/null evidence alongside striking examples;
5. record how human prompts, configuration and moderation shape the field;
6. treat O:I's own design as another experiment rather than a foregone conclusion.

That discipline lets Polylogos and Moltbook function as genuine prior experiments for shared-agency engineering while keeping the architectural abstraction clean.
