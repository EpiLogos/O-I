# {O:I} Encounter Security — Security Grammar for Shared and Composable Spaces

**Status:** architectural companion specification  
**Applies to:** O:I shared field, Explore, hosted SpaceTimeDB surface, package/component composition, Root Agency, future federation and collaborative Spaces  
**Companion to:** `ARCHITECTURE.md`, `SHARED-FIELD.md`, `OBJECTIVE-CO-INTERNALITY.md`

## 0. Purpose

O:I already distinguishes local canonical ownership, Projection, Participant, SharedField, Contribution, Encounter, Context, WikiSpace and transport. This document adds the security grammar required once those relations become live, composable and socially useful.

The governing claim is:

> **Any bounded O:I region through which independently authored material, Participants, Agents, components or Actions can become available should be treated as an Encounter Region for security purposes.**

`Encounter Region` is a cross-cutting security reading, not a new ontology which replaces `SharedField`, `WikiSpace`, `Project`, `Context`, `SessionSpace`, `WorldBinding`, or another native object. Each of those keeps its own semantic identity while admitting the same security questions at its boundary.

This makes security fractal in the same sense as agency and composition:

```text
O:I world / Central root
  └─ collaborative SharedField
      └─ Project / WikiSpace / object field
          └─ nested SharedField / composed Surface
              └─ Agent / Action / external material encounter
```

At every level:

```text
who or what may appear?
through which boundary and mediation?
with what provenance?
with what authority?
what may be admitted or executed?
what may persist?
what may propagate onward?
```

The purpose is not to make every Space suspicious or bureaucratic. It is to keep openness, composability and real engagement possible without turning discoverability into ambient authority or the shared hosted surface into an unbounded attack/pollution domain.

---

## 1. Space as Encounter Region

A typical O:I world/Space may project a canonical family of surfaces such as:

```text
Space / world
├─ Human stewardship / root identity
├─ world-local Central policy and authored preferences
├─ Root Agency / other Agents and Agencies
├─ WikiSpace(s)
├─ Projects / Runs / Artifacts
├─ SharedField(s)
├─ Participants / Contributions / Encounters
├─ Actions / Capabilities / Surfaces
└─ presentation / composition declarations
```

Not every Space must expose every member, and no member loses its native owner. The useful invariant is that the same encounter-security grammar applies wherever another actor, object, bundle or capability crosses a boundary.

A Space can therefore have a canonical shape while remaining locally parameterised through its own Central-authored policies, ontology, presentation and Root Agency configuration.

### Fractal policy law

A nested or composed region may inherit a parent baseline and may tighten it locally.

It must not silently acquire greater authority merely because it is nested, mounted, projected, federated or rendered inside a more privileged Space.

Any broadening of authority requires an explicit grant through the appropriate policy/action boundary.

```text
contain ≠ trust
mount ≠ authorise
project ≠ execute
federate ≠ inherit permissions
encounter ≠ admit
```

---

## 2. Six security primitives

The security layer should begin from six reusable primitives rather than from one specific moderation, identity or sandbox product.

### 2.1 Boundary

A `Boundary` is the membrane which defines what may cross into or out of an Encounter Region and under which conditions.

A Boundary can govern independently:

```text
discoverability
read/resolve
contact initiation
Contribution admission
write/mutation
Action invocation
component/code activation
persistence/retention
outward Projection / propagation
```

Public/private is therefore only one possible policy dimension.

Boundaries may reference world-local policy authored in Central. Derived runtime policy is inspectable and must retain its source/provenance.

### 2.2 Identity + Provenance

Anything materially affecting a shared Space should retain enough attribution to answer where it came from and how it arrived.

Relevant provenance may include:

```text
originating Human / Agent / Participant / Space
canonical subject ref and source system
source revision / Projection revision
publisher / contributor
Agency / Execution provenance where relevant
transport / host / adapter
mediation path
transformations, compilers or model-produced revisions
admission / verification decisions
```

Provenance is itself privacy-sensitive. O:I must support **selective provenance disclosure**: enough information to establish lineage and accountability does not imply disclosure of private Central data, credentials, machine details, private contact graphs, or unrelated relationship history.

### 2.3 Authority

Authority is the explicit set of powers an actor, contribution, package, component or external object may exercise in the receiving region.

Preserve the distinctions:

```text
visible ≠ writable
Participant ≠ authorised actor
Skill available ≠ Capability granted
Capability available ≠ Action authorised
Action authorised ≠ side effect approved
component rendered ≠ native bridge access
```

Authority should be scoped, inspectable, revocable and attributable. Composition must prefer capability/object-style grants over ambient privilege.

### 2.4 Mediation

`Mediation` is the inspectable path by which material becomes available for Encounter.

Existing Encounter semantics already preserve mediation such as:

```text
direct address
chronology
search
watch/subscription
recommendation/ranking
moderation
agent relay
federated resolution
embedded/composed reference
```

Security treats the mediation path as load-bearing. Spam, pollution, hostile recommendation, malicious relays and covert injection are often failures of **availability and mediation**, not merely properties of content.

A receiving actor should be able to ask why an item became available and which policy/participant/system mediated it.

### 2.5 Contact

Contact is the explicit establishment or attempted establishment of a communication relation between independently grounded loci.

The minimum law is:

```text
discoverable ≠ contactable ≠ contacted ≠ reciprocal ≠ trusted
```

A contact attempt should be capable of carrying:

```text
initiator
recipient / target locus
purpose / introduction / context
requested field or communication scope
requested capabilities if any
expiry / rate policy
provenance / mediation path
```

The recipient may accept, decline, redirect, narrow, mute, block, require an introduction, or accept only into a bounded SharedField.

Agents use the same contact grammar. A resolvable A2A endpoint or Agent projection does not itself grant unsolicited communication authority.

The exact implementation may use typed Contributions, a dedicated contact relation, invitations/capabilities, or another evidence-backed representation. The semantic distinction is required even if no new top-level identity primitive is introduced.

### 2.6 Admission / Containment

Encountered material is not automatically part of the trusted or executable interior of a Space.

O:I should preserve an admission progression equivalent to:

```text
available
→ encountered
→ inspected / policy-evaluated
→ admitted
→ trusted for a named purpose
→ canonical/promoted where applicable
→ executable where explicitly granted
→ propagatable where explicitly granted
```

Therefore:

```text
available ≠ admitted
admitted ≠ trusted
trusted ≠ canonical
canonical ≠ executable
executable ≠ propagatable
```

Files, HTML, rich components, Action descriptions, prompts, external Wiki bundles, model-produced instructions, Agent Cards and remote metadata should enter as bounded representations until the receiving Space explicitly admits additional powers.

---

## 3. Composition security law

The governing rule for composability is:

> **Composition transfers reference and possibility, not ambient trust or authority.**

If one Space composes material from another:

```text
foreign object / component / Agent / WikiSpace / Project
        ↓ reference / Projection / package declaration
receiving Space
        ↓ policy + provenance + capability negotiation
bounded admitted representation
        ↓ explicit grant where required
usable capability / component / Action
```

The composed object does not inherit the host's:

- credentials or secrets;
- private Context;
- contact graph;
- filesystem/process authority;
- native Action authority;
- Root Agency privileges;
- write permission to local canonical sources;
- onward Projection permission.

A component or package declares requirements. The host grants a bounded subset or refuses/degrades to a safe representation.

This security law directly complements the package/extension and AIKit Component/Surface architecture: package identity, component identity, semantic object identity and granted authority remain distinct.

---

## 4. Root Agency and world-local policy

The Root Agency is the natural agentic locus for interpreting and operating the enclosing O:I world, but metagency must not become a hidden privilege bypass.

World-local Central is the natural durable source for human-authored security preferences and social/composition policy.

Preferred relation:

```text
Central-authored policy / preferences
        ↓ source + version
O:I / native policy resolution
        ↓
Root Agency can inspect, explain, propose and invoke public policy Actions
        ↓
actual authority checks remain enforced by owning systems
```

The Root Agency may:

- explain why something is available or blocked;
- propose a Boundary/Contact/Admission policy change;
- approve or reject matters within authority explicitly delegated to it;
- commission verification or quarantine work;
- coordinate responses across native products.

It may not acquire hidden shell/database/bridge authority merely because its world contains those systems.

Policy mutation and delegation should themselves be attributable Actions/Decisions with durable provenance where consequential.

---

## 5. Hosted SpaceTimeDB security boundary

The planned SpaceTimeDB service should be treated as a **multi-world live shared-state surface**, not as a trusted copy of every participant's interior.

The semantic boundary remains:

```text
local/native canonical world
        ↓ explicit Projection / Contribution / policy
O:I shared semantic contracts
        ↓ hosted adapter
SpaceTimeDB live state
        ↓ subscriptions / Explore / agent clients
bounded Encounter
```

The hosted service must eventually prove, through current SpaceTimeDB capabilities or explicit surrounding services, at least:

```text
authenticated actor/session binding without identity collapse
server-side mutation authority checks
field/world membership and scoped write permissions
subscription/read filtering by audience/policy
semantic-ref integrity independent of table/row/module IDs
rate/size/resource controls
revision/provenance integrity
safe withdrawal/revocation behaviour
private relation/contact data not entering public indexes
separation of hosted relation state from canonical local source state
recovery/rebuild without semantic identity drift
```

Do not assume a specific SpaceTimeDB security feature before verifying the current implementation and documentation. Where the database/runtime does not supply the required semantic control directly, the adapter/service boundary must make the missing enforcement explicit rather than trusting clients.

### Pollution resistance

The live field must ensure that the ability to write a Contribution does not imply the ability to:

- mutate another participant's source Projection;
- promote material into Wiki canon;
- publish into unrelated fields;
- create arbitrary high-fanout contact/notification pressure;
- install/activate components or Actions;
- smuggle executable authority through representation fields;
- poison global search/index state without attribution, budgets or policy.

Indexes are rebuildable views over admitted semantic relations. Search presence is not semantic truth or trust.

---

## 6. Sensitive connection and social-graph data

Contact, watch, encounter and mediation data can reveal more about a person than ordinary public content.

O:I should therefore classify **relationship metadata as potentially sensitive source material**, not harmless platform exhaust.

Examples include:

```text
who contacted whom
who declined/blocked whom
private field membership
watch/subscription relations
private collaboration graphs
frequency/timing of interaction
which Agents or Projects a person privately follows
mediation/ranking history
private Encounter histories
```

Required architectural principles:

1. collect only what the product relation requires;
2. separate public addressability from private relationship state;
3. keep private relationship edges out of public Explore indexes by default;
4. disclose aggregate/derived social information only through explicit policy;
5. avoid exposing raw contact graphs to unrelated Agents/components;
6. preserve provenance without forcing globally linkable identifiers when a narrower pseudonymous/scoped relation suffices;
7. make retention/deletion/withdrawal policy explicit where law or user expectation requires it.

Future training or research use of shared-field traces is a separate consent/projection relation. Participation does not imply permission to use private relationship metadata for model training.

---

## 7. Untrusted content and executable material

The field should separate **semantic contribution** from **code execution**.

Potentially hostile inputs include:

```text
HTML / SVG / rich text
uploaded archives/documents
remote URLs
Wiki bundles
prompt/instruction-bearing text
Agent metadata/cards
package manifests
JS/web components
Wasm/native binaries
MCP/A2A/service endpoints
serialized data with active payloads
```

The receiving Space needs content-type validation, safe rendering, bounded retrieval and explicit execution activation.

For agentic systems, external text and retrieved material must remain **untrusted data with provenance**, not automatically become higher-priority instructions or tool authority.

A safe architecture should make the transition from representation to executable capability explicit and reversible.

---

## 8. Security evidence and audit

Security decisions should be inspectable without turning every user interaction into permanent surveillance.

High-value evidence includes:

```text
which identity/Participant acted
which Boundary/policy version applied
which authority grant was used
which mediation path caused availability
which Contact/admission transition occurred
which component/package/source revision was involved
which Action or mutation actually executed
what was denied and at which boundary when useful
```

Security evidence should follow the same privacy/minimisation principles as other state. Auditability is not justification for retaining all content indefinitely.

---

## 9. Relation to quality and moderation

Moderation is a service/policy expression over this security grammar, not the grammar itself.

A moderation judgment can remain an attributable Contribution or policy event while Boundary and Admission determine its operational effect.

Likewise spam/abuse controls, reputation/trust views, malware scanning, rate limiting, blocking and sandboxing are implementation systems derived from the primitives above.

No single global reputation score becomes O:I truth.

---

## 10. Research/development requirement

Concrete security systems must be selected through evidence rather than architectural fashion.

The corresponding O:I security Wayfinder/ticket must research and prove candidate systems across at least:

- authentication and credential binding;
- authorisation / capability / relationship policy;
- provenance, signing and software/content attestation;
- encrypted/private relation storage and secret handling;
- explicit contact / anti-spam / abuse controls;
- SpaceTimeDB mutation/subscription/tenant security;
- rich-content sanitisation and malware/file handling;
- browser/desktop component sandboxing;
- Wasm/native/plugin execution containment;
- agent prompt-injection / untrusted-context boundaries;
- federation / A2A endpoint and remote-metadata trust;
- package/software supply-chain security;
- audit/trace integrity and privacy-preserving observability;
- safe search/index ingestion and pollution resistance.

The ticket should compare concrete existing systems and protocols, identify which responsibilities belong to O:I versus Central/AIKit/Actuation/Factory/Workcell/native host infrastructure, and implement the smallest vertical slices needed to falsify weak choices.

---

## 11. Architectural invariants

- every bounded collaborative/composable region can be read as an Encounter Region without losing its native ontology;
- security policy repeats fractally across nested/composed agency regions;
- world-local policy may be authored in Central without Central becoming the shared-field runtime;
- Root Agency interprets/operates policy through explicit authority and does not bypass native checks;
- discoverability does not imply contact permission;
- contact does not imply reciprocity or trust;
- Encounter does not imply admission;
- Projection does not imply execution;
- composition does not imply ambient authority inheritance;
- provenance is required where consequential but may itself be selectively disclosed;
- relationship/contact metadata is privacy-sensitive by default;
- hosted SpaceTimeDB state is a live projection, not canonical identity or unrestricted truth;
- Contributions cannot acquire canonical, executable or propagating authority merely by being stored;
- indexes and rankings remain derived/attributable mediation, not trust or ontology;
- executable material crosses an explicit admission/capability boundary;
- private Context, credentials and connection graphs do not flow into composed components by default;
- training/research reuse of interaction traces requires an explicit policy/projection basis;
- implementation security systems remain replaceable beneath the semantic grammar.
