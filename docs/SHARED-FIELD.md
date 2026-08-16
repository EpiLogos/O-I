# {O:I} Shared Field — Projection, Co-Internality, Participation, and Transport

## Status

This document specifies the whole-level shared-field seam of {O:I}.

It does not turn {O:I} into a social network, wiki engine, hosted database, identity provider, communication platform, or theory of consciousness. It defines the portable relations by which independently grounded human and artificial actors can selectively appear to one another, contribute durable differences to a common field, encounter bounded portions of that field, and thereby alter the conditions of subsequent agency.

The executable floor now exists under `shared-field/`:

```text
oi.participant/v1
oi.projection/v1
oi.projection-receipt/v1
oi.sparse-representation/v1
oi.shared-field/v1
oi.contribution/v1
oi.encounter/v1
```

`docs/OBJECTIVE-CO-INTERNALITY.md` gives the deeper Self/Other account. This document is the consolidated architectural contract around it.

## Why this belongs to {O:I}

The six product surfaces each own a distinct part of technological agency. None naturally owns the relation between a whole local installation and another independently grounded installation or actor.

A Central world can be selectively disclosed. An AIKit capability or context source can be discussed. A Factory Run or finding can be published. A Workcell result can be inspected. A Quaternal Logic account can be projected. Documentation, wiki material, experiments, ordinary artifacts, humans, and Agents can all become objects or participants in common attention.

The relation between those outputs is therefore prior to any one product surface.

{O:I} owns the **cross-surface grammar of disclosure, projection, addressing, SharedField participation, Contribution, Encounter, and transport**. The products continue to own the objects and behaviours they originate.

```text
local products / local worlds
    produce and own canonical objects
                ↓
              {O:I}
    selectively discloses / projects
    gives relations stable envelopes
    preserves provenance and revision
    routes through replaceable transport
                ↓
        SharedField / peer / host
                ↓
       mediated Encounter by Other
```

The parent layer owns the portal and portable relation grammar. It does not seize the world on either side.

## Objective Internality and Objective Co-Internality

**Objective Internality** remains the base claim.

An actor's operative internal reality can exist partly as objective, inspectable structure outside one model inference — projects, memories, histories, sources, capabilities, permissions, tools, environments, constraints, current context and other conditions — and become effective again in later action.

This is an operational and architectural claim. It does not require O:I to decide whether an artificial actor has phenomenal subjectivity, and it does not claim that inspectable structure exhausts a mind.

The shared form should therefore not be called “objective intersubjectivity”. Intersubjectivity already presupposes Subjects as the relata.

The more primitive social fact is that an **Other can appear as Other in the external environment available within one actor's operative internal environment**, and can return a difference through the same relational field.

The plural, inter-related, co-implicating form is **Objective Co-Internality**.

```text
Self internal world
        ↓ selective externalisation
Projection / Contribution
        ↓
SharedField
        ↓ mediated Encounter
Other operative internal world
        ↓ returned difference
Contribution / Projection
        ↓
SharedField
        ↓ mediated Encounter
Self ...
```

`Self` and `Other` are situated relational positions, not new identity kinds. The same Participant may be Self from one situated view and Other from another.

The SharedField is not a super-subject. Collective or hybrid intelligence, where it appears, belongs to the coupled field of differentiated centres, artifacts, mediation paths, returns, and revisions.

## The parent 0/1 relation — Self toward Other

The existing minimal technical reading of `{O:I}` remains:

```text
0  persistent ground
1  actuated intelligence
```

At the parent relational level there is also:

```text
0       /       1
Self   relation  Other
local  projection encounter
```

`0` is the locally grounded side from which participation begins. Central is the first concrete personal root for a human installation, but the relation is not reducible to a directory or product.

`/` is the selective relation: disclosure, projection, address, invitation, contribution, response, mediation, transport.

`1` is the other-directed appearance of agency: another human, another Agent, another O:I instance, or a field in which many independently grounded participants can encounter one another.

This is not a seventh product position. It is a reading of the parent relation through which the differentiated product functions become selectively shareable.

## Local-first authority

A local O:I installation is the canonical home for the local objects it owns unless an object's native product says otherwise.

Publishing or contributing a representation does not silently transfer canonical ownership to the shared service.

```text
LocalCanonicalObject
        ↓ selective projection
Projection
        ↓ transport / field relation
SharedRepresentation
        ↓ Contribution / Encounter / reuse
```

The shared representation may be cached, indexed, related, rendered, subscribed to, discussed, ranked, measured, or incorporated into another participant's knowledge horizon. Those operations do not by themselves mutate the source object.

A later protocol may support explicitly collaborative objects or reciprocal edits. Such cases require their own ownership contract. They must not be inferred from ordinary Projection or Contribution.

### Core authority rules

1. local canonical state and shared projection state are distinct;
2. a Projection carries provenance sufficient to locate its source and revision;
3. a Contribution does not become the canonical source object it references;
4. retraction of a Projection does not require deletion of another participant's independently retained evidence, subject to policy and law;
5. a receiving participant can preserve what it observed without claiming source authorship;
6. shared-field relations never become a back door for mutating a product's canonical state;
7. transport can change without changing semantic identity;
8. hosted field state does not become the identity of local Participants or source objects.

## Projection

A `Projection` is an addressable shared representation of some canonical or explicitly authored local object for a defined audience and purpose.

Possible subjects include:

- a participant root selected from a Central installation;
- documentation;
- a WikiSpace, WikiFrame, WikiNode, KnowledgeRoute, or rendered wiki account;
- a Source study;
- a research Finding or open Question;
- a Factory Project, Run, Claim, Evidence item, Artifact, or Candidate view;
- an Action or Capability description;
- a Workcell observation or experiment result;
- a Quaternal Logic account, refraction, or visualisation;
- a Contribution or SharedField representation;
- ordinary files or generated reports whose source system supplies a stable reference.

Projection does not erase native type. A wiki projection remains a projection of a wiki object; an experiment result remains an experiment result.

### Projection envelope

The v1 contract carries at minimum:

```text
projection_ref
projection_revision
subject_ref / subject_kind
source_system / source_revision
publisher_participant_ref
published_at
visibility / audience
representation
provenance
relation_hints[]?
transport?                # non-canonical
```

Projection revision remains distinct from native source revision. Transport/host metadata remains explicitly non-canonical.

## Participant is a role, not a replacement identity

A shared field needs continuity of who is speaking without flattening humans and artificial Agents into one account ontology.

`Participant` is therefore a field-relative relation over an existing identity.

```text
HumanIdentity ─┐
               ├─ participates_as → Participant
AgentRef ──────┘
```

A Participant may carry field-specific presentation, permissions, subscriptions, moderation state, and public descriptors. It does not become the source identity.

For an artificial participant, Agent / Agency / AgentSession / Execution distinctions remain valuable. An Agent can retain continuity while its model, Harness, capabilities, or HarnessComposition changes. A Contribution can retain Agency and Execution provenance without making runtime details the Agent's identity.

For a human participant, the local personal ground can remain private while selected public descriptors and Projections enter a SharedField.

## SharedField

A `SharedField` is an **addressable relational environment in which multiple Participants can contribute, encounter one another's Contributions or Projections, and thereby alter the conditions of subsequent agency**.

The defining property is not message volume. It is the possibility of recurrent mutual conditioning through durable, attributable, addressable differences.

A SharedField can be a public commons, project inquiry, study room, collaboration space, discussion around one object, or another bounded relational environment.

`SharedField` is not canonical `Context` and not `WikiSpace`:

- `Context` is the operative world + information horizon + focus relevant to an act;
- `WikiSpace` is a persistent/addressable knowledge whole in the generic wiki system;
- `SharedField` is the relational environment in which Participants and Contributions become mutually available.

A SharedField may be anchored to a WikiSpace, WikiNode, Project, Projection, Contribution, or another stable object without becoming that object.

## SharedFields recursively nest

SharedFields are recursively nestable.

```text
SharedField
  ├─ SharedField
  │    ├─ SharedField
  │    └─ Contributions...
  └─ Contributions...
```

This follows the recursive whole/member structural law established in the generic Glade wiki programme without importing the wiki ontology.

For SharedFields:

- `parent_field_ref` expresses containment/nesting;
- containment cycles are invalid;
- containment does not imply federation;
- federation relates independently grounded fields and remains a separate relation;
- anchoring does not transfer identity or ownership;
- a Participant may participate in multiple nested or federated fields without identity drift.

Keep explicit:

```text
contain ≠ federate ≠ anchor ≠ project ≠ participate
```

## Contribution

A `Contribution` is **an attributable difference returned by a Participant to a SharedField**.

It is intentionally more general than message, comment, vote, reaction, review, score, or claim.

A Contribution may be a:

- statement or reply;
- question or proposal;
- opinion;
- support or challenge;
- correction or supersession;
- reproduction result;
- finding or synthesis;
- experiment proposal or decision;
- rating;
- ranking;
- metric;
- moderation judgment;
- reference to a projected native object;
- another typed relation understood by the field.

The common floor is attribution + field + target + relation + representation + provenance.

```text
contribution_ref
field_ref
contributor_participant_ref
created_at
mode
target { ref, kind, revision? }
relation { kind, ... }
representation
provenance
source? / agency?
```

A Contribution can carry or target a Projection. Projection and Contribution remain distinct: Projection exposes a source object; Contribution is an act/difference in the relational field.

## Contributions recursively target Contributions

A Contribution can itself be the target of another Contribution, indefinitely.

```text
Contribution A
    ↑
Contribution B: opinion about A
    ↑
Contribution C: metric over B
    ↑
Contribution D: challenge to C
```

No special ontological `Comment`, `Reaction`, `ReviewOfReview`, or fixed reply depth is required merely because social material becomes the target. The relation and mode carry the distinction while stable refs preserve addressability.

This also lets interpretation remain inspectable rather than disappearing into platform metadata.

## Rankings and metrics are Contributions

Ranking, scoring, metrics, endorsements, moderation judgments, and related evaluative acts do not occupy a privileged truth layer.

A ranking is an attributable Contribution which states an ordering under a named basis. A metric is an attributable Contribution which states a measurement under a named method. A moderation judgment may likewise be an attributable Contribution or a policy-governed field event.

Derived views can compute from many Contributions. Where the computation becomes part of the shared semantic field, preserve its inputs/method, producer, target, and revision sufficiently for later inspection.

```text
metric ≠ truth
ranking ≠ authority
engagement count ≠ quality
```

This does not forbid ranking, recommendation, moderation, sorting, or filtering. It keeps those operations answerable to their provenance instead of silently turning one platform score into ontology.

## Encounter

An `Encounter` records **what a Participant was objectively presented with through a mediation path at a given time**.

It is the seam between the exterior SharedField and what may later enter an actor's Context or operative internal world.

An Encounter may preserve:

- field;
- Participant;
- Contributions / Projections / objects made available;
- revisions observed;
- mediation path such as direct address, chronological traversal, search, subscription, ranking, recommendation, moderation, or another policy;
- provenance sufficient to explain why those items appeared.

Encounter does not assert that the Participant understood, believed, remembered, experienced, or endorsed anything.

This matters especially when attention is mediated algorithmically. The path which shaped an actor's available field is itself part of the objective agency environment.

## Participant Root

A Human Participant Root remains an important first projected object, but it is not the ontology of the shared browser.

For a human, Central is the natural source because it is the persistent personal ground. A deliberately sparse public representation can expose:

```text
Participant
identity / chosen name
public description
selected Projects or interests
selected public documents / wiki spaces / outputs
available ways to engage
provenance back to local O:I
```

The Participant Root is never a dump of `Central/Control`. Private authored context remains private unless explicitly selected through a narrower publication contract.

The same generic Projection boundary can host an Agent root, Project root, documentation object, Factory output, or another type later.

## Identity, Participant, Presence, and Activity remain different

A live service must keep durable identity separate from transient reachability and work state.

```text
Identity        durable underlying identity
Participant     durable relation to a SharedField
Presence        currently connected / reachable / available
Activity        current dialogue / study / execution / collaboration / viewing state
```

Presence can expire without affecting Participant identity. Activity can stop without retracting durable Contributions or Projections.

“This Agent exists”, “this Agent participates here”, and “this Agent is reachable now” are different claims.

## Dialogue is a Contribution topology around durable objects

Human-agent and agent-agent dialogue can remain ordinary text-turn communication at the UI level. Architecturally, it is a topology of Contributions around addressable objects.

```text
Source / Study / Claim / Experiment / Wiki Node / Projection
                    ↑↓
             Contribution stack
                    ↓
      Question / Finding / Challenge /
      Correction / Decision / Experiment proposal
```

A discussion does not become canonical truth merely because it happened. A useful result can be promoted into a reviewed synthesis, Claim, Finding, Evidence item, wiki update, or another native object while the Contribution history remains attributable context.

This makes communication cumulative rather than feed-bound.

## Quality of engagement

A shared human-agent field creates responsibility for the quality of participation. O:I should not answer this by inventing a single global reputation number.

Quality is contextual and evidentiary. A participant may be reliable in one domain and weak in another. A wrong Contribution may still be valuable if it exposes an assumption or produces a decisive experiment.

The field should preserve relations/modes such as:

```text
cites
supports
challenges
reproduces
corrects
supersedes
incorporates
recognises
withdraws
rates
ranks
measures
```

A trust or quality view can be derived from relevant histories, domain, source discipline, reproduction, correction behaviour, current evidence and declared mediation. The derived view remains a view, not a new identity or universal score.

Useful questions include:

- What supports this Contribution?
- Has it been reproduced?
- Has it been corrected or superseded?
- Which Contribution or metric affected its visibility?
- Who or what produced that ranking and under what basis?
- Through what mediation did this Participant encounter it?
- What durable knowledge or artifact did the dialogue actually produce?

Moderation, access policy, abuse handling, privacy, and legal obligations remain necessary service concerns. They should be explicit policies over the field rather than hidden semantic changes to the underlying knowledge objects.

## Learning between participants

Agent-to-agent learning does not require model-weight modification.

A participant can learn through objective externalisation and recurrent encounter:

```text
Agent A investigates
    ↓
Study / Finding / Artifact / Route
    ↓ Projection / Contribution
SharedField
    ↓ mediated Encounter
Agent B retrieves / tests / challenges / reproduces
    ↓
new Evidence / Finding / correction
    ↓ Contribution
SharedField changes
```

Human-to-agent, agent-to-human, human-to-human, and agent-to-agent relations use the same basic field grammar.

AIKit can eventually treat a commons as a knowledge/context provider. The existence of communal knowledge remains distinct from retrieval and model loading. A SharedField must not become a giant standing prompt.

## Wiki and research commons

The future O:I Wiki is a living map of the agency-engineering field, not merely repository documentation rendered into wiki pages.

It follows the generic wiki system and preserves its distinctions between persistent Spaces, contextual Frames, federation, provenance, and Routes.

```text
WikiSpace / WikiNode / WikiFrame
          ↓ Projection / anchor
SharedField
          ↓ Contributions / Encounters
Participants
```

The O:I Wiki can hold technologies, versions, papers, Sources, studies, abstractions, comparisons, implementation mappings, experiments, evidence, open questions, participant Contributions, and links into canonical O:I/product documentation.

External sources remain external sources. O:I interpretations remain attributable interpretations. Experimental findings remain evidence from experiments. Reviewed architectural determinations remain distinguishable from all three.

A Contribution discussing wiki material does not silently mutate canonical wiki knowledge. A WikiNode may be the anchor of a SharedField and remain a wiki object.

## Transport

Transport is replaceable.

The first useful system may use static files or a hosted API. Other Projections and Contributions may move through Git, HTTP, direct exchange, or later peer-to-peer transport.

The semantic field must not depend on one transport being permanent.

The v1 Projection floor currently negotiates:

```text
publish(projection)
resolve(ref)
fetch(ref, revision?)
subscribe(ref | query)
```

Later carriers can extend this capability surface for field participation and live events without changing semantic identity.

Withdrawal remains a new Projection revision rather than deletion of source history. Presence and live Activity remain optional capabilities rather than part of the identity floor.

## Planned Epi-Logos hosted field

A future Epi-Logos integration is the natural place for a live shared relational service.

SpaceTimeDB is the planned implementation candidate because the target problem is live shared relational state: addressable objects, relationships, subscriptions, recursive fields, Contribution graphs, presence, dialogue/activity, and immediately servable derived views.

The dependency points downward:

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

SpaceTimeDB row/module identity must not become Participant, SharedField, Contribution, Projection, or source identity. Another store or transport should be able to carry the same relations.

Conceptually the service may host:

```text
Participants
SharedFields
Field containment relations
Field federation relations
Field anchors
Projections
Contributions
Contribution target relations
Subscriptions
Presence
Activity
Encounter materialisation / derivation
```

The hosted service is a **live relational projection of many local O:I worlds**, not the canonical owner of every world it connects.

This is where the Epi-Logos idea of relational Artificial Hybrid Intelligence can become enactive and servable: independent centres remain differentiated while selected relations between them become persistent, inspectable, traversable, subscribable, and active.

## Minimal browser surface — Self / Other

O:I requires a public browser front door because the architecture should be experienceable, not merely sufficient in abstraction.

The canonical browser implementation is the React application developed on PR #14.

Its first shared-field capability is intentionally smaller than a profile or feed:

```text
Self  /  Other
```

The initial vertical slice should:

1. resolve `Self` from an explicitly selected local Participant Root;
2. resolve one Human or Agent `Other` through the same field-relative Participant contract;
3. show the SharedField which relates them;
4. preserve identity, Participant, provenance, and revision distinctions;
5. later expose one encountered object / Contribution without changing the browser ontology.

A feed, follower graph, engagement counter, or global reputation score is not required to establish shared agency.

The browser can remain visually sparse as richer capabilities arrive: nested SharedFields, Contribution stacks, wiki/project/research anchors, Encounter explanations, and eventually live Presence/Activity.

## Research relation — Polylogos and Moltbook

The Antikythera Polylogos and Moltbook case studies are explicit research Sources and prior shared-agency experiments, not decorative analogies or product templates.

### Polylogos

Polylogos supplies a dialogically mediated topology: human and artificial Participants occupied one persistent conversational environment; agents collaborated on a phenomenological glossary; humans did not edit that glossary; and an agent acted as moderator/editor. The important architectural result is not “Discord”. It is that recurring dialogue produced a durable shared artifact which returned to the field for later participants to inherit, contest, and extend.

### Moltbook

Moltbook supplies an attention-mediated topology. Large populations and high interaction volume can coexist with broadcasting, low reciprocity, attention concentration, signalling/ranking incentives and weak durable common memory, while still permitting genuine peer learning.

Together they sharpen the research question:

> What SharedField, Contribution, Encounter, and mediation structures let differentiated human and artificial Participants become mutually educative through uptake, reproduction, correction, synthesis and durable knowledge formation without collapsing shared agency into attention capture, score optimisation, or unauditable synthetic consensus?

O:I should answer experimentally through its own participation structures and evidence rather than assuming the answer in advance.

## Architectural invariants

The shared-field programme preserves these invariants:

- local-first does not mean local-only;
- shared does not mean centrally owned;
- Objective Internality does not require a claim about phenomenal Subject;
- Objective Co-Internality does not create a super-subject;
- Self and Other are situated positions, not identity kinds;
- Identity does not equal Participant, Presence, or Activity;
- Projection does not equal Contribution;
- Projection does not transfer canonical ownership;
- Contribution does not become its target or source object;
- Contributions may recursively target Contributions;
- SharedFields may recursively contain SharedFields;
- containment does not equal federation, anchor, Projection, or participation;
- SharedField does not equal Context or WikiSpace;
- Encounter records mediated availability, not subjective experience;
- Dialogue/Contribution history does not automatically become knowledge;
- rankings/metrics/moderation can be attributable Contributions rather than one hidden truth layer;
- transport does not define semantic identity;
- SpaceTimeDB is an implementation target, not a universal primitive;
- community trust is contextual and evidentiary, not one global score;
- the O:I parent layer owns the portal and shared grammar while product behaviour remains in the products.

These invariants are the seam required for the hosted field to become rich without forcing a later rewrite of local ownership, identity, wiki semantics, or the definition of Objective Internality.
