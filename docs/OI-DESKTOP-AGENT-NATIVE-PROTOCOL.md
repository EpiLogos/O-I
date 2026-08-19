# O:I Desktop Agent-Native Application Protocol

## One addressable application field for humans and agents

**Status:** application/design commitment; companion to `OI-DESKTOP-APPLICATION-SPEC.md`  
**Owner:** distributed by native product ownership; O:I owns whole-level projection/host integration only  
**Authored ground:** `docs/positions/FOUNDING-POSITIONS.md`  
**Architectural source:** Software Factory Agent-Native standard and Action architecture  
**Coordinates with:** O:I #18/#23/#24/#103–#111; AIKit #28/#42/#53/#67/#108/#113/#114; Factory #23/#32/#49/#71/#73/#143/#145/#155; Actuation #4/#15/#16; current Central and Workcell public Action/read/application contracts.

This document makes explicit a cross-cutting law that the desktop application specification otherwise risks leaving implicit:

> **The O:I desktop is not merely a human GUI over the six products. It is one human Surface of an Agent-Native application field in which humans, embedded/situated Agents, CLI/headless clients, MCP, A2A, automation and other authorised Surfaces address the same native objects and meaningful operations.**

The desktop therefore succeeds only when its experienced affordances are also semantically addressable without screen scraping or a second shadow API.

This is not a proposal to make every product implement the same transport, framework or storage model. It is a protocol of **identity, operation, discovery, authority, disclosure and return** across heterogeneous native owners.

---

# 1. Why Agent-Native belongs in the desktop specification

A professional agentic workbench has two simultaneous users:

```text
human
    sees / reads / edits / selects / invokes / recognises

Agent
    resolves / reads / acts / explains / returns
```

If the human GUI and Agent interface are built as unrelated systems, the application acquires two meanings:

```text
human meaning in UI callbacks and page state
agent meaning in a separate tool/API layer
```

That drift is exactly what the Agent-Native architecture exists to prevent.

The governing Factory standard is:

```text
one meaningful domain operation
        ↓
one canonical Action identity + authoritative handler
        ↓
appropriate projections
UI | embedded Agent | HTTP/API | MCP | A2A | CLI | automation
```

Not every Action must be exposed through every projection. Exposure is governed by native meaning, policy, scope, authority and target capability.

The consequence for O:I is concrete:

> **Anything consequential a person can do in the desktop should be inspected for its canonical native Action/read/application seam; anything consequential an Agent can do should be capable of becoming legible in the human application through the same refs, authority and returned result where a human Surface is appropriate.**

---

# 2. Agent-Native Protocol is not a transport protocol

Keep these layers separate:

```text
AGENT-NATIVE APPLICATION PROTOCOL
    canonical subjects
    readings/resources
    Actions
    authority/policy
    context/disclosure
    caller lineage
    result/evidence/return
    Surface projection

TRANSPORT / CLIENT PROTOCOLS
    ACP        agent-session / conversation client relation
    MCP        tool/resource protocol projection
    A2A        inter-agent communication / task exchange
    HTTP/API   remote application operation
    CLI        command projection
    automation scheduled/event invocation
```

Therefore:

```text
ACP != Agent-Native
MCP != Agent-Native
A2A != Agent-Native
```

They may carry an Agent-Native Action or resource relation, but they do not define its semantic identity.

Likewise:

```text
A2A Task != Factory Run
MCP tool name != ActionRef
ACP session != Agent identity
HTTP route != semantic object identity
UI button != Action identity
```

The native owner remains authoritative.

---

# 3. Minimum protocol grammar

For desktop integration, every native product should be inspected for the following classes. Concrete schemas remain owner-specific where no shared type is necessary.

## 3.1 Stable semantic subject

An operation or reading should address a stable native subject/reference rather than a presentation locator.

Examples:

```text
ProjectRef
SourceRef / ResourceRef
AgentRef / AgencyRef
AgentSessionRef
RunRef / CandidateRef
ActionRef
SurfaceRef
Workcell/material binding ref
ProjectionRef / WorldPresentationRef
QL reading/coordinate ref
```

Presentation IDs, process IDs, DOM IDs, tab IDs, provider session IDs and network endpoints do not replace these identities.

## 3.2 Reading / resource descriptor

A human or Agent should be able to discover/read a subject through a structured application seam carrying enough truth for correct use, such as:

```text
ref
kind
native owner
human-readable meaning
revision / provenance
availability
source / authority standing where relevant
relation neighbourhood or inspect operations where relevant
permission/disclosure conditions
```

Readings are not automatically Actions.

## 3.3 Canonical Action

A meaningful side-effecting or domain operation should preserve, where the native owner supports it:

```text
ActionRef
owner
human-readable description
input contract
output/result contract
subject applicability
side-effect class
permission / authority requirements
approval / Recognition requirement where applicable
idempotence/retry semantics where applicable
expected activation effect where applicable
handler / invocation lineage
```

One Action may have several Surface projections while retaining one meaning and handler lineage.

## 3.4 Action Catalog / contextual discovery

Actions must be discoverable without scraping UI implementation.

The relevant operative subset is resolved contextually rather than dumping the whole suite catalog into every Agent prompt:

```text
Project / world
Agency / authority
Focus / selection
Profile / SkillSet / Method
available Components / providers
current Surface / target
        ↓
AIKit/native resolution
        ↓
relevant Action + resource horizon
```

AIKit is the natural context-scoped index/resolver where the current native architecture uses it. AIKit does not become owner of application business logic merely because it indexes an Action.

## 3.5 Surface exposure policy

For each Action/resource, preserve whether it is valid through:

```text
desktop UI
TUI
embedded/root Agent
CLI/headless
MCP
A2A
HTTP/API
automation
harness-native Surface
```

Exposure is explicit and may vary by scope, target edition or authority. “Exists” does not imply “exposed everywhere”.

## 3.6 Caller lineage

A consequential invocation should retain who/what initiated it through which projection, without turning transport identity into semantic identity.

Useful lineage includes equivalents of:

```text
human UI
embedded/situated Agent
remote Agent
CLI/headless
MCP
A2A
HTTP/API
automation
application Component

caller Agent/Agency/Participant ref where legitimate
Surface / transport provenance
invocation ref
subject ref
ActionRef
result/evidence ref
```

Caller lineage supports audit, Factory evidence and human intelligibility.

## 3.7 Authority and approval

Agent-Native parity does not mean Agent authority equals human authority.

Preserve:

```text
Action available
    !=
Action visible
    !=
Action authorised
    !=
Action invoked
    !=
Action succeeded
    !=
returned result recognised/adopted
```

A human UI button cannot bypass native policy, and an Agent-visible Action cannot confer authority by being discoverable.

Consequential Actions may require native approval/Recognition. Factory HumanRequest, Central accepted mutation, Actuation bounds, package permissions and other owner-specific gates remain distinct.

## 3.8 Context / disclosure

Agent-Native access is not ambient context access.

Preserve at least:

```text
object exists
    !=
object addressable
    !=
object selected in UI
    !=
object permitted for this Agency
    !=
object retrieved
    !=
object loaded/disclosed into Agent Context
    !=
object projected/shared publicly
```

Desktop selection should propagate stable refs. AIKit/native disclosure decides what material actually becomes operative for an Agent.

## 3.9 Result / event / evidence / Return

An Action invocation should return through its native owner with enough structure to correlate:

```text
invocation
result / failure / refusal
changed subject revision where relevant
observed side effects
provider/material provenance where relevant
Event / Trace / Evidence refs where relevant
Return / proposal / Recognition state where relevant
```

The desktop renders this returned reality. It must not infer success from optimistic UI state or replace the owner's result with local mutation.

---

# 4. Readings, Actions and Surfaces must not collapse

The composable desktop makes this distinction especially important:

```text
Resource / subject
    what is being referred to

Reading
    a structured view/observation of it

Action
    a meaningful operation upon/in relation to it

Surface
    a locus through which reading/action/encounter is presented

Component / contribution
    how a capability/reading/action/Surface becomes available in an effective body
```

Therefore:

```text
interactive UI != Action automatically
Surface != Action
Component != Capability != Action
read-only graph != mutation API
opening a tab != domain mutation unless the native owner says it is
```

A UI can contain local presentation operations such as split/resize/focus that are legitimately desktop-owned. Those are distinct from domain Actions.

---

# 5. Desktop interaction law

Every meaningful desktop interaction should be classified during implementation as one of:

```text
PRESENTATION OPERATION
    focus / split / resize / local layout / close presentation
    O:I desktop provider owns it

NATIVE READING / NAVIGATION
    read/search/relations/explain/history over canonical refs
    native application owner remains authoritative

CANONICAL ACTION
    domain/source/configuration/material/social mutation
    native Action owner remains authoritative

PROTOCOL / SURFACE OPERATION
    attach/resume/send/cancel/open alternate Surface
    AIKit/target protocol owner remains authoritative
```

This prevents `onClick` handlers from becoming accidental business logic.

---

# 6. The Agent should inhabit the same workbench field semantically

The Agent does not need a pixel-level copy of the desktop. It needs the same addressable field.

For the currently selected Project/world, an authorised Agent should be able to ask structured equivalents of:

```text
What Project/world am I in?
What objects/resources are relevant and addressable?
What is selected/focused?
What Context was actually disclosed to me?
What Actions are legal on this subject?
Who owns each Action?
What would it change?
What approval is required?
Which Surfaces can I open/focus?
What happened when the Action ran?
What evidence/history/Return resulted?
```

The desktop may make these relations visually immediate. The Agent receives them through descriptors/application services/Skills/Action Catalog/Explain rather than screen scraping.

---

# 7. Agent resources are part of the application world

The protocol must account for project/application agent resources as first-class addressable material, including where current native owners provide them:

```text
instructions / guidance
Skills
Methods
SkillSets
UsageOverlays
ContextSources / Knowledge
Agents / Agencies
memories / episodic material under owner/privacy rules
MCP connections
Components / Surfaces
models / harnesses
scheduled/automation resources
Action Sets / Action Catalog
```

These should be visible in Navigator/System/Search where human-facing and structurally discoverable to Agents through AIKit/native application services.

Generated harness projections remain derived; they do not become source merely because an Agent sees them.

---

# 8. Six-product implications

## Central

Human-authored source and personal/project Actions must be agent-addressable through Central's public contracts where authorised. Agent mutation must preserve Central proposal/adoption/source-standing law. No agent-specific filesystem backdoor.

## Actuation

Agent/Agency/WorldBinding/bounds determine who is acting and with what authority. Metagentic availability is not conferred by UI placement or Action discovery. ActuationStream/Return provide attributable unfolding/return where current contracts support them.

## AIKit

AIKit indexes/resolves the actor's operative Action/resource/capability/context horizon and projects it into supported harness/Surface forms. It owns neither native application business Actions nor Actuation semantic authority. Harness adapters report real target faculties; unsupported projections remain unsupported.

## Software Factory

Factory remains the strongest conformance owner for the Agent-Native standard itself. Its Action catalog/dispatcher/projection-parity work should be consumed directly. Build GUI Actions, TUI Actions, headless operations and Agent operations must retain the same Factory ActionRefs/handler lineage. Factory #71/#73 remain key parity fixtures at the current design level; P0 must inspect their actual implementation state.

## Workcell

Material operations should be invocable/inspectable through the public client/control contract without exposing provider internals as semantic Actions. Agent use remains constrained by native authority, and Workcell process/provider identities remain material provenance.

## Quaternal Logic / Epi

QL readings may be structured agent-readable and human-rendered without every reading becoming an Action. Epi/domain instruments should expose their meaningful operations and current selected coordinates/subjects through structured refs/Actions so canonical Epi Agents and humans co-refer without DOM automation.

---

# 9. Explore, A2A and the social field

Explore extends the same Agent-Native law outward.

Human and Agent clients should share semantic operations equivalent to current Explore grammar:

```text
search
read
relations
route/traverse
sources
explain
history
watch
contribute
project/publish where authorised
```

A2A is one communication projection over eligible Agent loci, not the social ontology.

Preserve:

```text
AgentRef != A2A Agent Card / endpoint
A2A Task != Actuation != Factory Run
A2A Message != Contribution automatically
A2A Artifact != Projection automatically
```

A returned A2A difference enters the SharedField only through explicit O:I admission/Projection/Contribution authority.

Desktop, hosted Explore and structured Agent clients should therefore be able to co-refer to the same projected object and invoke the same canonical social Actions without page scraping.

---

# 10. System / configuration implications

System should expose not only six-product configuration but the **Agent-Native projection state** of that configuration.

Where current owners support it, a person should be able to inspect:

```text
which Actions/resources exist?
who owns them?
which are selected/effective for this Project/Agency?
which Surfaces/transports expose them?
which are blocked/degraded and why?
what permissions/approval rules apply?
which harness adapter supplied the projection?
which MCP/A2A/CLI/desktop mappings are active?
what caller lineage/history exists?
what would a staged composition change add/remove/rebind?
```

System must not become the Action catalog owner. It renders the native/effective catalogs and projection relations.

---

# 11. Security law

Agent-Native means semantic parity, not universal access.

Mandatory invariants:

```text
renderer visibility != authority
Agent discovery != authority
Action exposure != credential access
Action invocation != raw secret access
selected object != disclosed Context
local addressability != public Projection
package installed != contribution active != Action authorised
remote protocol availability != trusted caller
```

Use current authentication, package permission, Central privacy, Actuation authority, AIKit credential/projection and Workcell materialisation owners. Do not introduce a desktop shortcut around them.

---

# 12. Desktop Surface Ledger extension

The P0 Desktop Surface Ledger must be extended with Agent-Native protocol columns.

For every material capability/object/experience record at least:

```text
native subject/ref kind
Reading/application service
canonical ActionRef(s), if any
Action owner / handler lineage
input/output contract location
side-effect / approval class
agent discoverable? how?
AIKit indexed/resolved? how?
desktop projection
TUI projection
CLI/headless projection
MCP projection
A2A projection
HTTP/API/automation projection where applicable
Surface exposure policy
caller lineage / audit evidence
context/disclosure rule
result/evidence/Return relation
current implementation / issue / PR / revision
missing protocol seam + correct owner
```

Use `N/A` when a projection is semantically inappropriate. Do not force every Action into every protocol for symmetry.

The ledger should be able to reveal four different gaps:

```text
HUMAN-SURFACE GAP
    native operation exists but desktop cannot present/use it

AGENT-SURFACE GAP
    human operation exists but no structured agent path exists

PARITY GAP
    both exist but identity/handler/authority/result semantics diverge

DISCLOSURE/AUTHORITY GAP
    operation is addressable but Context, permission or caller lineage is not truthful
```

---

# 13. P0 live-state audit requirements

Before P1–P7 coding, P0 must inspect the actual current implementation—not just the old Factory constitutional intention—of:

```text
Factory Action catalog / dispatcher / policy / lineage
Factory UI/embedded/headless/MCP/A2A parity fixtures
AIKit Action/resource indexing and ContextResolution
AIKit Surface/Component projection
AIKit harness adapter SDK / target faculties
AIKit Explain/History Action state
current native product Action/read application contracts
O:I package/contribution Action authority
O:I SharedField/A2A projection/admission
current desktop privileged Action dispatch
current TUI/CLI structured projections
```

Seed current owner tickets include, but must be reverified:

```text
Factory #23   Agent-Native/MCP/A2A source inspection
Factory #32   Agent-Native/context-disclosure prototype
Factory #49   Action catalog/policy/dispatcher/lineage
Factory #71   CLI/headless/MCP/A2A Action parity
Factory #73   canonical projection parity fixture
AIKit #53     Component/Surface/action projection relation
AIKit #67     GUI/TUI parity over shared application state
AIKit #114    harness adapter SDK / admission faculties
O:I #24       A2A SharedField participation
O:I #23       desktop human-and-agent Surface host
```

The ticket numbers are orientation only. P0 must record actual current code/PR/main evidence and close/supersede stale assumptions.

---

# 14. End-to-end acceptance

The desktop programme is Agent-Native only when at least one real representative operation can be followed through the whole relation:

```text
native semantic subject
    ↓
canonical ActionRef / authoritative handler
    ↓
contextual discovery / authority
    ├─ desktop UI invocation
    ├─ embedded/situated Agent invocation
    └─ one external/headless projection (CLI/MCP/A2A/API as appropriate)
    ↓
same invocation semantics / caller lineage
    ↓
native result + evidence
    ↓
same changed subject/revision/Return
    ↓
Explain/History reconstructs what happened
```

Final P7 acceptance must prove this for representative operations from more than one native owner, including at minimum:

- one Central/source or proposal operation;
- one AIKit composition/Context/Surface operation;
- one Factory Run/Candidate/Recognition or developmental Action;
- one Workcell material operation when current public contract permits;
- one O:I Projection/Explore/shared-field operation;
- one QL/Epi structured operation or reading where QL/Epi is part of the tested candidate.

At least one Action must be exercised from both human desktop and situated Agent surfaces, and at least one through a real external/headless projection. The result must retain the same ActionRef, authority semantics and native handler lineage.

---

# 15. Non-goals

This protocol does not require:

- one framework for all six products;
- one transport for all agent operations;
- exposing every Action through every Surface;
- a universal mutable Action database in O:I;
- MCP or A2A as semantic authority;
- Agent access to raw UI state, filesystem or secrets;
- a new O:I Agent runtime;
- turning read-only resources/readings into Actions;
- replacing rich target-native Surfaces with lowest-common-denominator forms.

---

# 16. Closure

The desktop is correctly Agent-Native when **the human and Agent inhabit the same addressable application world at the semantic level**.

The human may see a filesystem tree, an editor, Factory waterfall, graph, sidecar, System composer or Explore page. The Agent may receive structured refs, bounded Context, Action descriptors, Skills and protocol projections. Those presentations differ, but they converge on the same native objects, operations, authority and returned reality.

That is the relation this protocol protects:

```text
one world
    ↓
canonical subjects + meaningful operations
    ↓
many human / Agent / protocol Surfaces
    ↓
one attributable returned reality
```
