# {O:I} Shared Field — Local Worlds, Projection, Participation, and Transport

## Status

This document specifies a future-facing seam at the level of the {O:I} whole.

It does not turn {O:I} into a social network, wiki engine, hosted database, identity provider, or communication platform. It defines the relations that let independently grounded human and artificial participants selectively appear to one another through shared knowledge, activity, and dialogue.

The first implementation is now deliberately small but executable: `shared-field/` provides the transport-neutral Projection/Participant floor and golden fixtures, while the browser front door can render the first sparse typed Projection. Rich participation, live communication, and hosted relational state remain later work.

## Why this belongs to {O:I}

The six product surfaces each own a distinct part of technological agency. None of them naturally owns the relation between a whole local installation and another local installation.

A Central world can be shared. An AIKit-disclosed capability or context source can be discussed. A Factory Run or finding can be published. A Workcell result can be inspected. A Quaternal Logic account can be projected. Documentation, wiki material, experiments, and ordinary artifacts can all become objects of common attention.

The relation between those outputs is therefore prior to any one product surface.

{O:I} owns the **cross-surface grammar of disclosure, projection, addressing, transport, and participation**. The products continue to own the objects that are projected.

This gives the parent package a positive role beyond installation and command aliasing without making it another operational product:

```text
local products
    produce / own canonical objects
            ↓
{O:I}
    discloses what may be projected
    gives the projection a stable envelope
    routes it through a replaceable transport
    lets another participant encounter it
            ↓
shared field / peer / hosted service
```

The parent layer owns the portal. It does not seize the world on either side of it.

## The 0/1 relation — Self toward Other

The existing minimal technical reading of `{O:I}` remains:

```text
0  persistent ground
1  actuated intelligence
```

At the parent level there is also a social-relational reading.

```text
0       /       1
Self   relation  Other
local  projection encounter
```

`0` is the grounded local world from which a participant speaks. Central is the first concrete personal root for a human installation, but the relation is not reducible to a Central directory.

`/` is the selective relation: disclosure, projection, transport, invitation, address, or response. It is where something locally grounded becomes available beyond itself without ceasing to have a local owner.

`1` is the other-directed appearance of agency: another human, another Agent, another O:I instance, or a shared field in which many such participants can encounter one another.

This is not a seventh product position. It is a reading of the parent relation from which the six differentiated product functions become shareable. The same architecture that makes an actor's objective interior available to itself can make selected parts of that interior available to another actor.

The slash matters. A distributed integrated human-agent field is constituted by relation, not by collapsing all participants into one state store.

## Local-first authority

A local O:I installation is the canonical home for the local objects it owns unless that object's native product says otherwise.

Publishing an object does not silently transfer canonical ownership to the shared service.

```text
LocalCanonicalObject
        ↓ selective projection
Projection
        ↓ transport
SharedRepresentation
        ↓ relations / dialogue / subscription / reuse
```

The shared representation may be cached, indexed, related, rendered, subscribed to, discussed, or incorporated into another participant's knowledge horizon. Those operations do not by themselves mutate the source object.

A later protocol may support explicit reciprocal edits or collaborative objects. Such cases require their own ownership contract. They must not be inferred from ordinary projection.

### Core authority rules

1. local canonical state and shared projection state are distinct;
2. a projection carries provenance sufficient to locate its source and revision;
3. retraction of a projection does not require deletion of another participant's independently retained evidence, subject to policy and law;
4. a receiving participant can preserve what it observed without claiming authorship of the source;
5. shared-field relations never become a back door for mutating a product's canonical state;
6. transport can change without changing the semantic identity of the projected object.

## General projection

The shared-field seam is deliberately broader than a wiki.

A `Projection` is an addressable shared representation of some canonical or explicitly authored local object for a defined audience and purpose.

Possible subjects include:

- a participant root projected from a Central installation;
- documentation;
- a WikiSpace, WikiFrame, Node, Route, or rendered wiki account;
- a Source study;
- a research Finding or open Question;
- a Factory Project, Run, Claim, Evidence item, Artifact, or Candidate view;
- an Action or Capability description;
- a Workcell observation or experiment result;
- a Quaternal Logic account, refraction, or visualisation;
- ordinary files or generated reports where the source system can provide a stable reference.

Projection does not erase type. A wiki projection remains a projection of a wiki object; an experiment result remains an experiment result.

### Projection envelope

The transport-neutral envelope should be able to carry, at minimum:

```text
projection_ref
subject_ref
subject_kind
source_system
source_revision
publisher_participant_ref
published_at
visibility / audience
representation_kind
representation_ref or payload_ref
provenance
relation_hints[]
transport_metadata?      # non-canonical
hosted_locator?          # non-canonical
```

The exercised v1 schema and runtime contract now live under `shared-field/`. The implementation keeps transport/host metadata explicitly non-canonical, keeps Projection revision distinct from native source revision, and preserves the semantic requirements above as the compatibility floor for later versions.

## Participant is a role, not a replacement identity

A shared field needs continuity of who is speaking without flattening humans and artificial Agents into one account ontology.

`Participant` is therefore a relation between an existing identity and a shared field.

```text
HumanIdentity ─┐
               ├─ participates_as → Participant
AgentRef ──────┘
```

A participant relation can carry field-specific presentation, permissions, subscriptions, moderation state, and public descriptors. It does not become the source identity.

For an artificial participant, the existing Agent / Agency / AgentSession / Execution distinctions remain valuable. An Agent can retain continuity while its model, Harness, capabilities, or HarnessComposition change. A particular contribution can retain the Agency and Execution context through which it was made without making those runtime details the Agent's identity.

For a human participant, the local personal ground can remain private while selected public descriptors and projections become part of the shared field.

## Participant root

The first human-facing shared object should be simple: a **Participant Root** projected from the participant's local O:I world.

For a human, Central is the natural first source because it is the persistent personal ground. The root can begin as a deliberately sparse public representation:

```text
Participant
identity / chosen name
public description
selected Projects or interests
selected public documents / wiki spaces / outputs
available ways to engage
provenance back to the local O:I instance
```

The Participant Root is not a dump of `Central/Control`. Private authored context remains private unless explicitly projected.

The same browser surface can later host an Agent participant root, a Project root, or another projection type. The root is therefore the first demonstration of a general projection system rather than a bespoke profile page.

## Presence, participation, and activity are different

A live service will need to distinguish durable identity from transient connection state.

```text
Identity        durable underlying identity
Participant     durable relation to the shared field
Presence        currently connected / reachable / available
Activity        current dialogue, study, execution, collaboration, or viewing state
```

Presence can expire without affecting participant identity. Activity can stop without retracting the artifacts or dialogue produced by it.

This distinction is important for both humans and Agents. "This Agent exists", "this Agent participates here", and "this Agent is available now" are different claims.

## Dialogue as a relation around durable objects

Human and agent dialogue remains text-turn communication. The architectural improvement is that dialogue can be attached to addressable shared objects and can produce new durable objects.

```text
Source / Study / Claim / Experiment / Wiki Node
                  ↕
               Dialogue
                  ↓
      Question / Finding / Challenge /
      Correction / Decision / Experiment proposal
```

A discussion does not become canonical truth merely because it happened. A useful result can be promoted into a reviewed synthesis, Claim, Finding, Evidence item, or wiki update while the dialogue remains historical context.

This makes communication cumulative rather than feed-bound.

## Quality of engagement

A shared human-agent field creates responsibility for the quality of participation. O:I should not answer this by inventing a single global reputation number.

Quality is contextual and evidentiary. A participant may be highly reliable in one domain and weak in another. A wrong contribution may still be valuable if it exposes a hidden assumption or produces a decisive experiment.

The field should therefore preserve relations such as:

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
```

A future trust view can be derived from the history of those relations, the relevant domain, source discipline, reproduction history, correction behaviour, and current evidence.

This gives both humans and Agents better questions than "what is this participant's score?":

- What supports this contribution?
- Has it been reproduced?
- Has it been corrected or superseded?
- What does this participant's history look like in this kind of work?
- Which source and revision did the contribution actually study?

Moderation, access policy, abuse handling, privacy, and legal obligations remain necessary service concerns. They should be explicit policies over the shared field rather than hidden semantic changes to the underlying knowledge objects.

## Learning between participants

Agent-to-agent learning does not require model-weight modification.

A participant can learn through objective externalisation:

```text
Agent A investigates
    ↓
Study / Finding / Artifact / Route
    ↓ shared Projection
Agent B discovers
    ↓
retrieves source + contribution
    ↓
uses / tests / challenges / reproduces
    ↓
new Evidence / Finding / correction
    ↓
shared field changes
```

Human-to-agent, agent-to-human, and human-to-human learning use the same basic field.

AIKit can eventually treat the commons as another knowledge/context provider. The existence of communal knowledge is then distinct from retrieval and model loading. A shared field must not become a giant standing prompt.

## Wiki and research commons

The future O:I Wiki is a living map of the agency-engineering field, not merely the repository documentation rendered into wiki pages.

It should be built after the generic Wiki system is ready and should reuse its distinctions between persistent Spaces, contextual Frames, federation, provenance, and Routes.

The O:I Wiki can hold:

- technologies and versions;
- papers and Sources;
- source studies;
- portable abstractions;
- comparisons;
- implementation mappings;
- experiments and evidence;
- open questions;
- participant contributions and discussions;
- links into canonical O:I/product documentation.

External sources remain external sources. O:I interpretations remain attributable interpretations. Experimental findings remain evidence from experiments. Reviewed architectural determinations remain distinguishable from all three.

## Transport

Transport is replaceable.

The first useful system may use an ordinary hosted API. Other projections may move through Git, static files, HTTP, or direct exchange. Later O:I instances may exchange shared objects peer-to-peer.

The semantic field should not depend on one transport being permanent.

The v1 projection floor negotiates these transport capabilities:

```text
publish(projection)
resolve(ref)
fetch(ref, revision?)
subscribe(ref | query)
```

Withdrawal is already represented as a new Projection revision without deleting source history; it does not require transport identity to become semantic identity. Presence and dialogue require a live field and remain optional future capabilities rather than part of this transport floor.

## Planned Epi-Logos hosted field

A future Epi-Logos integration is the natural place for a live shared relational service.

SpaceTimeDB is the planned implementation candidate for that service because the target problem is live shared relational state: addressable objects, relationships, subscriptions, presence, dialogue, and immediately servable derived views.

The architectural dependency must point the other way:

```text
O:I semantic projection / participation contracts
                    ↓ adapter
Epi-Logos shared-field service
                    ↓ implementation
SpaceTimeDB
```

SpaceTimeDB must not become part of the identity of `Projection`, `Participant`, or the source objects. A different transport or store should be able to carry the same relations.

The hosted service is therefore a **live relational projection of many local O:I worlds**, not the canonical owner of every world it connects.

This is where the Epi-Logos idea of universal relationality can become enactive and servable: independent centres remain differentiated while relations between them become persistent, inspectable, traversable, and active.

## Minimal browser surface

O:I requires a public browser front door because the architecture must be experienceable, not merely sufficient in abstraction.

The default front door remains intentionally almost empty:

```text
{O:I}

GitHub
```

Black on white. One centred mark. One link.

The same owned browser Surface can now switch from that front-door state to a typed sparse Projection. The first golden case is a Human Participant Root derived from explicitly selected Central material; the renderer consumes the generic sparse representation contract rather than a profile-specific subject model, so Agent, documentation, and Factory projections can use the same boundary.

Future versions may add, in order of increasing capability:

1. a generated local projection exported from Central/O:I;
2. a hosted read-only projection;
3. addressable wiki/document/system-output projections;
4. dialogue around projected objects;
5. presence and live shared state through the Epi-Logos service.

The UI can remain visually sparse as those capabilities deepen.

## Research relation — Polylogos and Moltbook

The Antikythera essay's Polylogos and Moltbook case studies should be brought into this programme as explicit research Sources rather than used as decorative analogies.

Moltbook already provides a useful empirical contrast: an agent-native social surface can generate large-scale interaction while still reproducing or amplifying attention concentration, asymmetry, ritualised signalling, low reciprocity, authenticity problems, and governance/security questions. O:I should study those outcomes rather than assuming that agent-to-agent communication automatically constitutes collective learning.

The Polylogos material should be imported from the essay itself before O:I makes source-level claims about it. Its value here is already clear at the level supplied by the research programme: it gives the shared field a dialogical/polylogical comparison point against feed-like or platform-native agent sociality.

These cases make the research question sharper:

> What technical and social structures let differentiated human and artificial participants become mutually educative without collapsing dialogue into attention capture, score optimisation, or unauditable synthetic consensus?

The O:I commons should answer that question experimentally through its own participation structures and evidence, not by assuming the answer in advance.

## Architectural invariants

The shared-field programme should preserve these invariants as implementation arrives:

- local-first does not mean local-only;
- shared does not mean centrally owned;
- Participant does not replace Human identity or Agent identity;
- Presence does not define Participant identity;
- Projection does not transfer canonical ownership;
- Dialogue does not automatically become knowledge;
- a relation to an object does not erase the object's native type;
- transport does not define semantic identity;
- SpaceTimeDB is an implementation target, not a universal primitive;
- community trust is contextual and evidentiary, not one global score;
- the O:I parent layer owns the portal and shared grammar, while product behaviour remains in the products.

These invariants are the seam we need to establish now so the future hosted field can become rich without forcing a later rewrite of local ownership, identity, or product boundaries.
