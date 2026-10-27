# Objective Co-Internality — Self, Other, SharedField, Contribution, Encounter

## Status

This document extends `docs/SHARED-FIELD.md` with the relational grammar needed for shared agency.

It is a whole-level O:I contract. It does not define a social network, a feed, a universal identity system, a theory of consciousness, or a replacement wiki ontology. It names the smallest objective relations required for independently grounded human and artificial actors to become mutually conditioning parts of one another's operative environments while retaining distinct identity, provenance, ownership, and local worlds.

The corresponding executable floor lives in `shared-field/social.mjs`.

## Objective Internality remains the base claim

O:I uses **Objective Internality** to avoid making an unnecessary metaphysical claim about a hidden or phenomenal Subject.

An actor's operative interior can be represented objectively as inspectable structure: remembered objects, projects, constraints, histories, tools, sources, capabilities, permissions, current context and other conditions which can become effective for later action. This is an objective internal reality of a mind/agent in operation. It does not settle whether the actor has subjective phenomenality, nor does it make a representation exhaustive of the actor.

The shared-field programme therefore should not rename its social layer “objective intersubjectivity”. Intersubjectivity already presupposes subjects as the relata. The point here is more exact and more primitive: sociality becomes technically tractable when an **Other appears as Other within the external environment represented inside one actor's operative internal environment**, and when that relation can recur in the reverse direction.

The plural, co-implicating form is **Objective Co-Internality**.

## Minimal Self / Other relation

At the parent O:I level the smallest shared-agency relation is:

```text
Self
  │ selective disclosure / address / contribution
  ▼
SharedField
  │ mediated encounter
  ▼
Other
```

and recursively:

```text
Self internal world
      ↓
Projection / Contribution
      ↓
SharedField
      ↓
Encounter by Other
      ↓
Other operative internal world changes
      ↓
Contribution returned to the field
      ↓
Encounter by Self
```

“Self” and “Other” are relational positions here, not new identity kinds. The same Participant can be Self from one situated view and Other from another. The system must preserve alterity: an Other is not a copy of Self, not merely a local embedding, and not a platform-owned account record.

The first browser projection should expose this relation directly. It does not need a feed, follower graph, karma score, or large profile ontology. A sparse Self/Other portal is sufficient to prove the root relation.

## Core primitives

### SharedField

A `SharedField` is an **addressable relational environment in which multiple Participants can contribute, encounter one another's contributions, and thereby alter the conditions of subsequent agency**.

The crucial property is not communication volume. It is the possibility of recurrent mutual conditioning through durable, attributable, addressable differences.

A SharedField can be a public commons, a project inquiry, a study room, a collaboration space, a discussion attached to one object, or another bounded relational environment. Its transport or host does not define its semantic identity.

`SharedField` is not canonical `Context` and not `WikiSpace`:

- `Context` is the operative world + information horizon + focus relevant to an act;
- `WikiSpace` is a persistent/addressable knowledge whole in the generic wiki system;
- `SharedField` is the relational environment in which Participants and Contributions become mutually available.

A SharedField may be anchored to a WikiSpace, Projection, Project or other stable object without becoming that object.

### Recursive SharedFields

SharedFields are recursively nestable.

```text
SharedField
  ├─ SharedField
  │    ├─ SharedField
  │    └─ Contributions...
  └─ Contributions...
```

This follows the same whole/member structural law already proven in the Glade wiki programme: a whole may contain sub-wholes, and a member may itself unfold as a whole. The semantic relation remains different.

For SharedFields:

- `parent_field_ref` means containment/nesting;
- containment must not be overloaded to mean federation;
- a federated relation between independently grounded fields remains a separate relation;
- a field may be anchored to another object while retaining its own identity;
- containment cycles are invalid.

The distinction remains:

```text
contain ≠ federate ≠ anchor ≠ project ≠ participate
```

### Contribution

A `Contribution` is **an attributable difference returned by a Participant to a SharedField**.

It is intentionally more general than message, comment, vote, review, score or claim.

A Contribution can carry or represent:

- a statement or reply;
- a question or proposal;
- an opinion;
- support or challenge;
- a correction or supersession;
- a reproduction result;
- a finding or synthesis;
- an experiment proposal or decision;
- a rating;
- a ranking;
- a metric;
- a moderation judgment;
- a reference to a projected native object;
- another typed relation which the field understands.

The common law is attribution + target + relation + representation + provenance.

### Contributions recursively target Contributions

A Contribution can itself be the target of another Contribution.

```text
Contribution A
    ↑
Contribution B: opinion about A
    ↑
Contribution C: metric over B
    ↑
Contribution D: challenge to C
```

No separate ontological class is required for “comment”, “reaction”, “review of a review”, or “opinion about an opinion”. These are modes/relations of Contribution.

This recursion is deliberate. It lets social interpretation remain addressable and inspectable instead of disappearing into platform metadata.

### Ranking and metrics are Contributions

Ranking, scoring and metrics do not occupy a privileged truth layer.

A ranking is an attributable Contribution which states an ordering under a named basis. A metric is an attributable Contribution which states a measurement under a named method. A moderation action can likewise be an attributable Contribution or policy-governed field event.

Derived views may compute from many Contributions, but the system should preserve the inputs, method, author/agent, revision and target where relevant.

Therefore:

```text
metric ≠ truth
ranking ≠ authority
engagement count ≠ quality
```

A field can still sort, filter, recommend, moderate or calculate. The architecture simply refuses to hide those acts behind an uninspectable universal score.

### Encounter

An `Encounter` records **what a Participant was objectively presented with through a mediation path at a given time**.

It is the seam between the exterior SharedField and one actor's later Context/operative internal world.

An Encounter may record:

- the field;
- the Participant;
- the objects/Contributions made available;
- revisions observed;
- the mediation path, such as direct address, chronological traversal, search, subscription, ranking or moderation;
- provenance sufficient to explain why those items were available.

Encounter does not assert that the Participant understood, believed, experienced, remembered or endorsed anything. Those are separate claims and may be unavailable.

This is essential to Objective Internality: the architecture records objective conditions of possible internal update without pretending that those records exhaust a subject.

## Participant, Projection and Contribution remain distinct

The existing relations remain intact:

```text
Identity
  ↓ participates_as
Participant

LocalCanonicalObject
  ↓ selectively represented as
Projection

Participant
  ↓ acts in SharedField as
Contribution

SharedField
  ↓ makes selected material available through
Encounter
```

Key non-identities:

- `Identity ≠ Participant`;
- `Participant ≠ Presence`;
- `Projection ≠ Contribution`;
- `Contribution ≠ source object`;
- `SharedField ≠ Context`;
- `SharedField ≠ WikiSpace`;
- `Encounter ≠ subjective experience`;
- `ranking/metric ≠ canonical truth`.

A Contribution can target or carry a Projection. A Projection can expose a Contribution as an object. Neither collapses into the other.

## Objective Co-Internality

Objective Co-Internality is the plural relational condition produced when independently grounded operative internal worlds become mutually implicated through inspectable externalised relations.

The minimum loop is:

```text
A's operative internal world
      ↓ externalises selected difference
SharedField
      ↓ objectively mediated Encounter
B's operative internal world
      ↓ returns selected difference
SharedField
      ↓ objectively mediated Encounter
A's operative internal world
```

The SharedField is not a super-subject and does not own the minds which participate in it. Collective intelligence, when it appears, belongs to this coupled field of differentiated centres, durable artifacts, mediation paths, returns and revisions.

This is the technical form relevant to Artificial Hybrid Intelligence: intelligence may arise in the coupled field and its returns without being installed as one synthetic subject above the participants.

## Research basis — Polylogos and Moltbook

The Antikythera Agentworld material and related Polylogos/Moltbook cases should be treated as prior experiments in shared agency.

Polylogos supplies evidence for a dialogically mediated topology in which human and artificial Participants occupied one persistent conversational environment and agents collaboratively produced a durable phenomenological glossary. The important architectural result is that the conversation returned an artifact to the common field which later participants could inherit and contest.

Moltbook supplies a complementary attention-mediated topology. It demonstrates that high communication volume and large agent populations do not by themselves constitute reciprocal collective learning. Broadcast behaviour, attention concentration, ranking/signalling dynamics and low reciprocity can coexist with genuine peer learning.

These cases motivate an explicit research question for O:I:

> Which SharedField, Contribution and Encounter structures increase reciprocal uptake, reproduction, correction, synthesis and durable knowledge formation without reducing shared agency to feed optimisation or one synthetic consensus?

O:I should keep these cases source-pinned and use the eventual shared field as an experimental object in its own right.

## Relation to the Glade wiki system

The generic wiki programme supplies a useful structural precedent but not a shared-field ontology.

Glade already distinguishes:

- recursively nestable persistent `WikiSpace`;
- contextual `WikiFrame` which can cross Spaces;
- typed `WikiEdge`;
- `KnowledgeRoute` as actual traversal;
- recursive Node-as-member / Node-as-whole behaviour.

O:I should preserve that distinction when wiki objects enter shared agency:

```text
WikiSpace / WikiNode / WikiFrame
          ↓ Projection
SharedField
          ↓ Contributions / Encounters
Participants
```

A SharedField can be anchored to a WikiSpace or WikiNode. Contributions may discuss, extend, challenge or rank wiki material. The wiki remains the canonical knowledge system; the SharedField remains the relational participation environment.

## Minimal browser projection

The first shared-field browser capability should present the root relation plainly:

```text
Self  /  Other
```

A useful minimal interaction is:

1. `Self` resolves the local Participant Root already selected for publication;
2. `Other` resolves one other Participant or shared Projection;
3. the UI makes the field/relationship and provenance visible;
4. a first Contribution can be attached to the encountered object;
5. later views can expose nested fields and Contribution stacks without changing the root grammar.

This is not a profile-first or feed-first design. Profiles, search, wiki routes, graph traversal and other views can grow around the same relations later.

## Hosted service shape

The future Epi-Logos/SpaceTimeDB adapter should conceptually host relations such as:

```text
Participants
SharedFields
Field containment/federation relations
Projections
Contributions
Contribution target relations
Subscriptions
Presence / Activity
Encounter materialisation or derivation
```

The store may use tables, indexes, subscriptions and derived views internally. Those implementation identities do not replace the semantic refs above.

An Encounter may be materialised, reconstructed from event/history data, or locally recorded depending on the carrier. The semantic requirement is explainability of what was made available and through which mediation path.

## Acceptance laws

A conforming implementation should prove:

1. SharedFields can nest recursively without changing field identity or confusing containment with federation.
2. Contributions can target any stable addressable subject, including another Contribution.
3. opinions, ratings, rankings, metrics and moderation judgments can be represented as attributable Contributions.
4. Participant identity remains distinct from the field-relative Participant role.
5. Projection remains distinct from Contribution and canonical source state.
6. Encounter records objective mediated availability without imputing subjective experience.
7. Self/Other can be rendered from the same contracts for human→human, human→agent, agent→human and agent→agent relations.
8. a receiving actor can encounter only a bounded portion of the SharedField; the whole field is not a standing prompt.
9. local canonical ownership survives shared participation.
10. no single global score is required for trust, quality or ranking.

These are the minimal semantics required for O:I to move from isolated technological agency into a genuinely shared agency field while remaining faithful to Objective Internality.
