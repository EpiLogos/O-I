# {O:I} Encounter Security — Security Grammar for Shared and Composable Spaces

**Status:** architectural companion specification; cloud implementation ratified by `OI-017-ENCOUNTER-SECURITY-FINAL-RECEIPT.md`  
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

The live SpaceTimeDB service is treated as a **multi-world live shared-state surface**, not as a trusted copy of every participant's interior.

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

The ratified implementation proves, through the exact provider/runtime boundaries recorded in `OI-017-ENCOUNTER-SECURITY-FINAL-RECEIPT.md`:

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

Provider capabilities are not assumed from product names. The adopted boundary is pinned and executed in CI, and any provider-specific physical acceptance not present in hosted evidence remains an explicit non-claim in the final receipt.

### Pollution resistance

The live field ensures that the ability to write a Contribution does not imply the ability to:

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

O:I therefore classifies **relationship metadata as potentially sensitive source material**, not harmless platform exhaust.

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

The final security audit surface follows the same rule: it records scoped principal fingerprints and bounded allow/deny facts, rejects raw private relationship graphs/content/secrets, and requires explicit audit-read scope.

Future training or research use of shared-field traces is a separate consent/projection relation. Participation does not imply permission to use private relationship metadata for model training.

---

## 7. Untrusted content and executable material

The field separates **semantic contribution** from **code execution**.

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

For the current live declarative browser/Tauri host, hostile rich content is proven unable to acquire native bridge/execution authority without an exact execution grant. Executable package/component material may additionally require exact artifact/revision attestation, and a valid attestation is still not activation authority.

No general archive/document parser or malware-scanning pipeline is present in the ratified ancestry; the final receipt therefore does not invent a file-scanner claim for a non-live ingestion surface. Any future native file-ingestion path must add its own parser/content-security acceptance.

For agentic systems, external text and retrieved material remains **untrusted data with provenance**, not automatically higher-priority instructions or tool authority.

The transition from representation to executable capability is explicit and reversible.

---

## 8. Security evidence and audit

Security decisions are inspectable without turning every user interaction into permanent surveillance.

High-value evidence includes:

```text
which scoped principal acted
which Boundary/policy version applied
which authority grant was used
which mediation path caused availability
which Contact/admission transition occurred
which component/package/source revision was involved
which Action or mutation actually executed
what was denied and at which boundary when useful
```

`oi.security-audit/v1` supplies a privacy-minimised representative audit seam with explicit read scope, finite retention, principal fingerprinting, provenance and hash-chain integrity. It deliberately stores no content payload, secret value or private relationship graph.

Security evidence follows the same privacy/minimisation principles as other state. Auditability is not justification for retaining all content indefinitely.

---

## 9. Relation to quality and moderation

Moderation is a service/policy expression over this security grammar, not the grammar itself.

A moderation judgment can remain an attributable Contribution or policy event while Boundary and Admission determine its operational effect.

Likewise spam/abuse controls, reputation/trust views, malware scanning, rate limiting, blocking and sandboxing are implementation systems derived from the primitives above.

No single global reputation score becomes O:I truth.

---

## 10. Research/development requirement

The #31 research programme compared and exercised concrete mechanisms across authentication/credential binding, authority/capability boundaries, provenance/attestation, private relation handling, Contact/rate control, SpaceTimeDB enforcement, hostile rich content, browser/desktop containment, process/material execution, prompt-injection boundaries, A2A identity/return quarantine, package supply-chain provenance, privacy-safe audit and index-pollution resistance.

The ratified choices and deliberate rejections/non-claims are recorded in `OI-017-ENCOUNTER-SECURITY-FINAL-RECEIPT.md`. Research products such as Sigstore/in-toto, general policy engines, sandbox runtimes and malware scanners are not constitutional dependencies merely because they were considered. Native products retain their own enforcement semantics and can replace providers beneath the common security distinctions.

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
- executable material crosses explicit provenance/admission/capability boundaries appropriate to the live surface;
- artifact attestation does not imply trust, Capability grant, Action authority or activation;
- authentication does not imply Participant/Agent identity, participation, trust or authority;
- secret materialisation does not imply execution authority;
- private Context, credentials and connection graphs do not flow into composed components by default;
- training/research reuse of interaction traces requires an explicit policy/projection basis;
- implementation security systems remain replaceable beneath the semantic grammar.

## 12. Ratification boundary

The exact implementation heads, CI/provider receipts, twelve attack fixtures, audit/retention statement and all physical/provider non-claims are fixed in `OI-017-ENCOUNTER-SECURITY-FINAL-RECEIPT.md`.

That receipt is the governing implementation-status document for #31. This file remains the semantic security grammar. Future provider or product additions extend their native security acceptance without retroactively collapsing the distinctions ratified here.
