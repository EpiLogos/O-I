# O:I Desktop Application Specification

## The installed workbench for a composed world of agency

**Status:** application/design commitment  
**Owner:** O:I application host and whole-level composition  
**Authored ground:** `docs/positions/FOUNDING-POSITIONS.md`  
**Coordinates with:** O:I #23, #26, #18, #84, #85, #86, #93; current desktop-workbench implementation; Central #51/#70/#72/#74/#82; Actuation #4/#15/#16; AIKit #28/#42/#53/#67/#108/#113/#114; Software Factory #143/#144/#145/#155; Workcell #21–#29 as applicable; current Quaternal Logic / Epi integration work.

This document specifies **what the installed O:I desktop application is meant to become as an experienced product**.

It does not replace the semantic contracts owned by Central, Actuation, AIKit, Software Factory, Workcell or Quaternal Logic. It gives those independently owned capabilities a coherent local application body.

It also does not make present code retroactively define the intended product. Read this document together with current implementation, tickets and acceptance evidence using the ordinary provenance distinction:

```text
authored position
    !=
design commitment
    !=
research proposition
    !=
implementation fact
    !=
observed result
    !=
current development state
    !=
inference
```

The real SessionSpace / AgentSession / Knowledge work developed through the current desktop-workbench line is an **inherited application substrate** for this specification. The desktop programme must consume and refine that work; it must not make reimplementation of that already-developed floor a blocker.

---

# 1. Why the desktop exists

O:I has a public site, product CLIs/TUIs, agent-native operations, shared-field / Explore surfaces and six independently meaningful products. None of those alone is the place where a person can naturally **inhabit the composed local whole**.

The desktop exists to make that whole directly workable.

A person should be able to:

- enter the Project or personal world they already have;
- see and edit the files, authored ground, Wiki/knowledge, current working material and developmental state relevant to it;
- work beside one or more real Agents through their canonical sessions and Surfaces;
- open terminals, previews, trajectories, evidence, processes and remote material worlds without changing semantic identity merely because the presentation changes;
- inspect and shape how the six products are contributing to the current world;
- move deliberately between private/local material and explicit social/shared projection through Explore;
- understand why the system is configured as it is and what a proposed change will actually affect.

The desired consequence is not a larger dashboard. It is a professional software environment in which the surrounding structure of technological agency becomes **usable, inspectable and composable** enough that the person can spend less time reconstructing state and more time authoring, judging and acting.

---

# 2. What the desktop is — and is not

The O:I desktop is:

> **the privileged local application projection and composition host for the O:I world, expressed as a professional, IDE-grade workbench over native product Surfaces, Actions, resources and application services.**

It is not:

- a seventh semantic product;
- a second Project, Agent, SessionSpace, Run, Wiki, package, model, context or settings ontology;
- a generic admin dashboard;
- an O:I-owned chat runtime;
- an ambient filesystem/shell backdoor;
- a replacement for product CLIs/TUIs or harness-native interfaces;
- a requirement that all useful work happen inside O:I;
- a hard-coded collection of six bespoke mini-applications.

The desktop can be spatially IDE-like because the IDE/workbench grammar is unusually suitable for persistent worlds made of documents, code, knowledge, conversations, processes, evidence and alternate tools. That interaction grammar is a **functional design reference**, not an ownership transfer. Antigravity and other professional agentic IDEs are useful references for the felt integration of editor/workspace, filesystem navigation, agent sidecar and material execution; O:I retains its own product semantics and visual language.

---

# 3. One workbench, several native worlds

The default application body is:

```text
┌──────────────┬────────────────────────────────────┬──────────────────────┐
│ NAVIGATOR    │ PRIMARY CANVAS / SURFACE STACK     │ AGENT / INSPECTOR    │
│              │                                    │                      │
│ Projects     │ tabs / groups / splits             │ situated Agent       │
│ Files        │ document / editor                  │ conversation         │
│ Ground       │ Wiki / reading                     │ selected subject     │
│ Wiki         │ graph / tree / list                │ Actions              │
│ Knowledge    │ Factory Build                      │ Explain / History    │
│ Runs         │ preview / browser                  │ provenance           │
│ Surfaces     │ Epi / QL instrument                │ return / evidence    │
│              │ Explore / presentation             │ alternate Surfaces   │
├──────────────┴────────────────────────────────────┴──────────────────────┤
│ LOWER / DEEP REGION                                                     │
│ terminal · trajectory · events · problems · evidence · processes        │
├─────────────────────────────────────────────────────────────────────────┤
│ STATUS / CONTEXT                                                        │
│ Project · SessionSpace · Agency · harness/body · Workcell · sync/state  │
└─────────────────────────────────────────────────────────────────────────┘

           universal Search / Command / Action entry over the whole
```

These are **host regions and interaction roles**, not semantic object classes.

A Product Surface may occupy the canvas, inspector, navigator, lower region or more than one region when its native contract permits it. A Surface can move between regions or providers without changing the semantic identity of the underlying Project, Agent, Run, source object or Action.

The shell must support resizable/collapsible regions, keyboard-first movement, tabs and useful split views. Provider-local layout state is presentation state; it does not become SessionSpace, Project or Agent identity.

---

# 4. The navigator is the person's world, not a fake filesystem

The left side is a first-class navigator over the current local world.

It should be able to disclose and navigate, according to the active Project/world and installed owners:

```text
Projects / Work
Files / source
human-authored Ground
Agent-maintained Wiki / SemanticWiki
ProjectMap / semantic ↔ code reflection
Knowledge / Sources / CodeReferences
NOW / DAY current material
Skills / Methods / praxis
Runs / Candidates / evidence
Agents / AgentSessions
available native Surfaces
```

The familiar filesystem tree is important because Projects actually contain ordinary files and people understand that grammar. But the renderer does **not** receive ambient arbitrary filesystem authority merely to emulate an editor.

The governing relation is:

```text
native Project / Central / AIKit source application seam
        ↓ stable source/resource refs + authorised operations
O:I navigator
        ↓
canvas / inspector / Agent co-reference
```

A plain file can therefore remain a plain file while also being related to authored Ground, a Wiki node, a CodeReference, a Factory Claim/Evidence object or a Project concept without creating duplicate content identities.

The navigator should support familiar professional affordances where owner contracts permit them:

- expand/collapse trees;
- file/type/status decorations;
- open in current/new split;
- reveal related Wiki/code/evidence/provenance;
- search/filter;
- recent/changed state;
- safe rename/create/delete/edit through the actual native owner;
- drag/drop as a presentation/action shortcut only where the resulting mutation remains explicit and owner-governed.

---

# 5. The canvas is a Surface host, not a page switcher

The centre of the application is the **current work**, not a dashboard about the current work.

The canvas must be able to host, through the shared Surface/contribution architecture:

- file/document/editor Surfaces;
- rich authored-ground or proposal/diff Surfaces;
- Wiki readings and graph/tree/list projections;
- Project/code reflection Surfaces;
- Factory Run/Candidate/Build Surfaces;
- local preview/browser Surfaces;
- Explore / WorldPresentation Surfaces;
- Workcell/remote application Surfaces where appropriate;
- Epi / Pratibimba / Quaternal Logic instruments and other domain-native rich Surfaces;
- native, web, graphical, audio or remote/passthrough bodies where the contribution contract supports them.

The canvas needs a professional document/workspace interaction grammar:

```text
open
focus
pin
close
reopen
split
move between groups
open related subject
restore presentation layout
```

A specialised Surface may own a rich internal layout. O:I should not reduce every instrument to one common widget kit.

The canonical invariant remains:

```text
Surface presentation != semantic ownership
```

---

# 6. The right side is a real Agency encounter, not DesktopChat

The persistent right region is the human's encounter with situated Agency and with the selected object.

The ordinary relation is:

```text
Agent / Agency / WorldBinding
        ↓ realised Actuation
AIKit-resolved Profile / Context / praxis / model / harness / body
        ↓
canonical AgentSession
        ↓
conversation / Cradle / other communication Surface
        ↓
O:I sidecar | IDE | cmux/tmux | harness-native UI | other Surface
```

The desktop must not create an O:I transcript or model/session identity simply because it renders the conversation.

The sidecar should be able to show, progressively:

- Agent / Agency identity and current world relation;
- current AgentSession and connection/body provenance;
- human↔Agent conversation through the actual provider seam;
- send / continue / interrupt / cancel where supported;
- current selected semantic subject and the bounded context actually disclosed;
- available canonical Actions on that subject;
- relevant Skill/Method/Profile/Context/model/harness provenance;
- Actuation / bounds / Return state where supplied;
- ActuationStream events as that richer contract becomes available;
- alternate Surfaces through which the same Agent/session can be encountered.

## Chat / conversation provider law

AIKit's Surface / harness-adapter architecture is the correct home for making heterogeneous conversation interfaces usable through the desktop.

A target adapter should be able to expose the real faculties of a target edition, for example:

```text
create / attach / resume
send / continue
stream
interrupt / cancel
attachments / selected references
provider-native history
permission interactions
model/body metadata
open target-native UI
```

only where that target actually supports them.

O:I mounts the effective Surface. It does not manufacture uniform capabilities the underlying target does not have.

---

# 7. The lower region shows material unfolding

The lower/deep region is for the material and evidential depths which matter during work but should not dominate the primary semantic canvas.

Eligible Surfaces include:

```text
terminal / shell Surface
Factory trajectory / spans / tool calls
ActuationStream / events
problems / diagnostics
verification / evidence
processes / services
Workcell lifecycle/material state
logs where a native owner exposes them
preview/service endpoints
native harness trace links
```

This region should permit multiple tabs and useful side-by-side depth, but should remain progressive disclosure.

The lower panel is not a universal event store. Factory trace, ActuationStream, Workcell lifecycle events, harness-native traces and diagnostics retain their distinct identities and provenance.

---

# 8. Search and Command are universal apertures

The desktop needs one fast universal entry for:

```text
SEARCH
    find a Project, file, source, Wiki node, Agent, Run, Candidate,
    Action, Surface, Skill, Method, model, provider or shared object

COMMAND / ACTION
    operate on the selected/current object through canonical Actions

HISTORY
    recover meaningful destinations, routes, sessions, changes and layouts
```

This should consume native application/search services rather than build a desktop-global truth database.

A result should preserve at least:

```text
stable ref
kind / representation
native owner
Project/world relation
provenance / revision
availability
relevant contextual Actions
```

Deep semantic providers can enrich the fast path; they must not make direct address/ref/fuzzy lookup depend on a slow global reasoning service.

---

# 9. Six products become six native dimensions of one local experience

The desktop should be composed **as much as possible from direct interactions with the six products**. O:I owns their placement and whole-level coherence, not their domain semantics.

## 9.1 Central — Ground / Personal / Work

Central contributes the person's and Project's durable authored world.

Primary desktop experiences include:

```text
Personal
  You        Control/user
  Agents     Control/agents
  Machines   Control/machines
  Praxis     Control/skills + Control/methods where present
  Work       Projects

ProjectCentral
  human-authored Ground
  Agent Wiki
  Skills / Methods
  NOW / DAY where used
  source/adoption/provenance relations
```

The desktop should support browsing, writing, search, recent/changed material, proposals, diffs, review, accepted source mutation, safe open/reveal and machine/personal Actions through Central's native seams.

Central should feel like the **centre of the authored operative world**, not a preferences form.

## 9.2 Actuation — Agency / bounds / unfolding / Return

Actuation contributes the semantic account of realised agency.

The desktop should be able to present:

```text
Agent / Agency
WorldBinding
root/situated position
current Actuation(s)
participating loci where present
determination / bounds / authority
realised loop/body relation
ActuationStream where present
Return / pending returned difference
metagentic Actions where genuinely authorised
```

Most of this belongs naturally in the Agency sidecar, inspector and lower stream/trajectory regions rather than a permanent full-screen admin page.

## 9.3 AIKit — cognition / composition / models / harnesses / Surfaces

AIKit supplies much of the desktop's working-environment intelligence:

```text
Project / Profile / scope
ContextResolution
information horizon / ContextSources
Knowledge / SemanticWiki / ProjectMap / CodeReference
Skills / UsageOverlays / Methods / SkillSets
models / providers / credentials refs
Harness / HarnessComposition
Components / requirements / provider bindings
AgentSessions / SessionSpaces
Surfaces / projection bindings
Explain / History
Generation / Procedure / staged effects
```

The desktop should expose these relationally, with the same essential grammar as the AIKit TUI/application state, rather than through raw config files.

## 9.4 Software Factory — Build is inside the application

Software Factory contributes the complete developmental workbench:

```text
Project
Run / Run Map / current frontier
Decisions / WorkNodes
Candidates
Claims / Evidence / Assessments
HumanRequests
Recognition / Return
active Agencies / Executions
SessionSpace / Workcell / preview relations
trajectory / native trace depth
```

The existing SSSF-derived GUI programme is not a sketch to redraw from memory. Its functional logic and information shape are to be **consumed/imported at source fidelity from the actual current Factory implementation line**, then integrated through the current Factory semantics and retrofitted to the O:I design system and host conventions.

The target remains three related depths:

```text
SEMANTIC
    why the development exists / Run / frontier / Candidates / evidence / Recognition

LIVE
    which Agencies / sessions / material worlds are carrying it now

TRAJECTORY
    SSSF-derived execution chronology / spans / tools / processes / native trace
```

Factory owns the Build contribution and its Actions/read models. O:I hosts it as a first-class application experience.

## 9.5 Workcell — material world / services / providers

Workcell contributes the inspectable material conditions beneath agency and development.

Useful desktop experiences include:

```text
local / remote Workcells
material world / bindings
process and service lifecycle
storage / artifact relations
service exposure / endpoints
Fabric / reachability / policy result
provider availability / degradation
Control Service where present
persistent agent-hosting material state
model-serving materialisations
accelerator / hardware offers where observed
provider SDK / conformance status
```

These should appear through System, inspector and lower/deep Surfaces, and through dedicated material-workspace Surfaces when that depth is the task.

Process, endpoint, host and provider identities remain material facts; they do not replace Agent/Model/Project/Run identity.

## 9.6 Quaternal Logic — formal / refractive / instrument depth

Quaternal Logic contributes optional formal, harmonic, relational and refractive capabilities.

Ordinary desktop correctness does not depend on QL being enabled. Where QL or Epi uses the desktop, it may contribute:

- formal/refractive readings over current semantic objects;
- coordinate/relation/harmonic instruments;
- provenance-bearing lens/context-frame readings;
- rich Epi/Pratibimba Surfaces, including native/graphical/audio/remote bodies;
- structured source/parity/readiness views.

The current Epi programme is an important stress test of this host law: a deep domain should be able to inhabit the same navigator/canvas/Agency/lower/System grammar without rebuilding a generic Epi-only IDE.

---

# 10. System is a six-product composition and configuration workbench

`System` is not merely health/status and it is not a giant O:I-owned settings database.

It is the place where the person can understand **what constitutes the current O:I world and how it can be changed through its real owners**.

The top-level System view should always account for:

```text
Central
Actuation
AIKit
Software Factory
Workcell
Quaternal Logic
```

and for O:I-level package/application/shared-field composition itself.

For every configurable relation, the UI should preserve as applicable:

```text
AUTHORED / DECLARED
    what source says should be present

EFFECTIVE / RESOLVED
    what the native owner selected after scope/provider resolution

ACTIVE / MATERIALISED
    what the target/runtime/provider actually exposes now

STAGED
    what the human/Agent proposes to change

EXPECTED EFFECT
    live | next-session | restart | Generation | Procedure | provider action

PROVENANCE / OWNER
    where the state and authority come from
```

Product-native examples:

### Central

- personal/project ground and source apertures;
- machines and environment intent;
- proposals / accepted changes;
- privacy/retrieval boundaries;
- connectors / personal OS capabilities.

### Actuation

- current Agents/Agencies/WorldBindings;
- bounds and delegated authority;
- realised Actuation availability;
- returns and metagentic capabilities.

### AIKit

- Profiles / SkillSets / Methods;
- ContextSources / information horizon;
- models / harnesses / providers;
- Components / Contracts / Surfaces;
- SessionSpace and target projection;
- Explain / History;
- staged composition changes.

### Factory

- Project/development configuration and policies only where Factory exposes them;
- current Run/development environment relations;
- evidence/recognition configuration where native.

### Workcell

- Workcells / providers / material offers;
- services / storage / Fabric / exposure;
- remote control and lifecycle;
- model-serving material conditions;
- conformance and degraded state.

### Quaternal Logic

- provider/kernel availability;
- supported operators/readings/lenses;
- optional formal integrations and current readiness;
- no implication that a formal reading owns the object it refracts.

A durable mutation always dispatches through the native owner. The desktop must never become correct only because it edited a private config file behind the owner's back.

---

# 11. Explore is the outward/social face of the same addressable world

Explore is not a local-product settings tab and not a seventh O:I product. It is the social/shared-field layer through which independently grounded worlds can selectively encounter one another.

Desktop and Explore should therefore be **harmonised but not conflated**.

## Shared application grammar

Where a local object is eligible for both contexts, preserve common semantics for:

```text
stable refs
Search
read
relations
GRAPH | TREE | LIST
Wiki / Knowledge relations
WorldPresentation
Projection revisions
provenance
canonical Actions
agent structured access
```

## The privacy/projection boundary

The local desktop can inhabit a much richer private horizon than Explore.

Preserve every step:

```text
source exists locally
    !=
source is Agent-readable
    !=
source was retrieved
    !=
source is selected for local presentation
    !=
source is selected for Projection
    !=
Projection is admitted/shared
    !=
Projection is public/hosted
```

The desktop should make this transition legible and deliberate.

A useful experience is:

```text
local file / Wiki node / Project account / Skill / Agent / result
        ↓
Preview Projection / WorldPresentation
        ↓
choose audience / field / contribution relation
        ↓
publish through O:I authority
        ↓
open the same stable projected object in Explore
```

Returned edits/contributions from Explore remain projections/contributions until the native source owner explicitly accepts a source return.

## Visual parity

The site and desktop should retain one O:I visual family: foundation/semantic tokens, typography/rhythm, focus, relation and projection grammar, accessibility and scarce use of gold for the shared/meta relation.

They need not use the same layout. Explore is an open social/discovery environment; desktop is a dense local workbench.

---

# 12. Composability is an experienced property

The architecture is only meaningfully composable if the person can experience different native bodies entering the same application without O:I hard-coding their semantics.

The target relation is:

```text
native product/domain
    owns resource / application service / Reading / Action / Surface
        ↓
AIKit Component/Surface composition where applicable
        ↓
O:I package/registration envelope where packaged
        ↓
O:I effective contribution field
        ↓
Navigator | Canvas | Sidecar | Inspector | Lower | System | Command
```

Required laws:

```text
Package != Component != Surface != Action != semantic resource

Surface available != active
active != authorised
visible != trusted
selected != disclosed to Agent
installed != target loaded
provider present != healthy
```

O:I may implement renderer adapters, region placement, layout, focus, drag/split behaviour and safe native bridge handles. Those are application mechanics, not new semantic identities.

Third-party or rich native bodies must not receive ambient privileged bridge authority merely because they are visible.

---

# 13. Surface accounting law

From this specification onward, **no significant human-facing capability in the six products should be allowed to become invisible to the desktop programme by accident**.

Every current or new native capability with a human-facing consequence gets a Desktop Surface Ledger disposition.

Allowed dispositions:

```text
NAVIGATOR
    addressable in the local-world navigation tree/index

CANVAS
    first-class primary editor/reading/instrument Surface

SIDECAR
    Agency / selected-context / inspector contribution

LOWER
    terminal / trajectory / event / process / evidence depth

SYSTEM
    composition / configuration / lifecycle / health experience

COMMAND
    search/action/command contribution

EXPLORE
    has a deliberate local ↔ shared Projection / social relation

ALTERNATE-NATIVE
    primarily lives in another native Surface; desktop can open/focus/explain it

NOT-HUMAN-FACING
    structured/agent/implementation capability with no direct human UI obligation

DEFERRED
    real future surface with an owner ticket and acceptance condition
```

One capability may have several compatible dispositions.

The ledger must record at least:

```text
product
capability / object / experience
native owner
canonical ref / contract / application service
actual current issue / PR / revision
read | edit | action | compose | materialise abilities
intended desktop region(s)
permission / privacy requirements
TUI / CLI / agent equivalents
Explore / Projection relation
current implementation state
selected integration action
```

The ledger is regenerated/reconciled before major desktop implementation cuts and again before suite convergence/acceptance.

---

# 14. Design language: professional software, recognisably O:I

The desktop must look and behave like serious daily software.

The visual target is **clean, calm, deliberate and dense where the work requires density**. It should not feel like a prototype dashboard built from repeated cards.

## Required interaction quality

- stable global application frame;
- strong typography and hierarchy;
- resizable/collapsible side and lower regions;
- tabs and useful split groups;
- clear hover/focus/selected/active/staged/degraded states;
- command palette and keyboard navigation;
- context menus/actions where discoverable and useful;
- drag/reorder only where it shortens a real interaction;
- persistent/restorable provider-local layout;
- narrow-window progressive disclosure;
- no essential meaning encoded only in colour;
- responsive performance on large source trees, traces and knowledge sets through lazy/virtualised loading.

## House language

Continue the shared O:I design tokens and visual relations:

```text
surface / raised surface
text / muted text
rule / border
relation
focus / selection
projection / outward relation
human / agent distinctions where warranted
positive / warning / danger / degraded / staged
```

Gold remains scarce and relational: active projection, selected connective relation or similarly meaningful meta-state—not generic success or CTA decoration.

A Factory trajectory may be denser/darker than a Nara writing Surface. A graph instrument may be spatial. A Workcell topology may be operational. The house system provides coherence without flattening those experiences.

---

# 15. Preparatory live-state reconciliation before implementation

This specification deliberately does **not** freeze the prompt-time issue/PR graph into the architecture.

Before the implementation children execute, run a dedicated reconciliation phase across:

```text
O:I desktop + packages + Explore
Central
Actuation
AIKit
Software Factory
Workcell
Quaternal Logic
and directly dependent Epi/domain lines where they already define desktop Surfaces
```

For each product:

1. inspect current `main`;
2. inspect open PRs/branches and the current authoritative tickets;
3. identify capabilities already implemented beyond old ticket prose;
4. identify native application/read/action/surface contracts ready to consume;
5. identify rich existing GUI/body work that must be imported rather than recreated;
6. identify only the genuine missing owner seams;
7. populate the Desktop Surface Ledger;
8. create/update native-owner tickets only where a real missing seam exists;
9. define the exact cross-product dependency order for the desktop implementation cut.

The reconciliation pass must treat the current SessionSpace / AgentSession / Knowledge desktop work as inherited state. It verifies and accounts for it; it does not use the pass to restart it.

Factory must specifically inspect the **actual current SSSF-derived GUI implementation/branch**, not merely #143/#144/#145 prose, and select the import/retrofit path from that returned reality.

Explore must specifically inspect the current live SharedField/SpaceTimeDB/WorldPresentation/authoring line so desktop-local presentation and social projection do not evolve as unrelated application grammars.

The QL/Epi active computational programme may remain an explicit active/deferred convergence exception while still having all current/future desktop Surfaces accounted for in the ledger.

---

# 16. Development sequence

After live-state reconciliation, implementation proceeds in dependency order derived from the ledger. The expected shape is:

```text
P0  live six-product + Explore surface reconciliation
        ↓
P1  professional composable workbench frame + design/application grammar
        ↓
P2  native Project/files/Ground/Knowledge navigator + document/editor Surfaces
        ↓
P3  canonical Agent/Agency sidecar + provider-neutral conversation/Cradle relation
        ↓
P4  Factory SSSF-derived Build GUI import + O:I retrofit
        ↓
P5  six-product System / composition / configuration workbench
        ↓
P6  local desktop ↔ Explore Projection/social parity and deep-linking
        ↓
P7  dynamic Surface composition + parity + end-to-end application acceptance
```

This order is not permission to defer already-available product contributions. P0 may show that several phases can advance in parallel or that an existing implementation already satisfies part of a later phase.

---

# 17. Minimum end-to-end acceptance

The desktop application is ready to enter serious local/physical use when one exact candidate can demonstrate the following without feature-branch mythology or semantic duplication:

1. open one real existing Project from the person's actual world;
2. navigate its ordinary files, authored Project ground, Agent Wiki/Knowledge and semantic↔code relations through one navigator;
3. open and edit one real source/document Surface through its native owner path;
4. select a stable source/semantic object and preserve the same ref across navigator, canvas, inspector and Agent encounter;
5. continue a real canonical AgentSession through the right sidecar and open/focus the same session in at least one alternate supported Surface without identity drift;
6. open a terminal or equivalent material Surface in the lower region for the same working world;
7. open Factory Build in the canvas and move from Project/Run/frontier → Candidate/evidence → SSSF-derived trajectory → returned semantic subject;
8. inspect one live/degraded Workcell/material relation supporting the working world without process/endpoint identity collapse;
9. open System and explain the current contribution/configuration state of all six products, including authored/effective/active distinctions where applicable;
10. stage and apply at least one real native configuration/composition change through the owning product, then see the returned effective state and Explain/History evidence;
11. inspect the current situated Agency / bounds / Return relation where Actuation supplies it;
12. open one optional rich Quaternal Logic/Epi or equivalent domain Surface through the same contribution/canvas grammar without a parallel generic shell;
13. take one eligible local object through explicit WorldPresentation/Projection preview into Explore and preserve source/projection distinction;
14. receive or edit a projected/shared representation without silently mutating local canonical source;
15. prove GUI/TUI/CLI/agent semantic parity for representative refs and Action invocation lineage;
16. account for every in-scope human-facing capability in the current Desktop Surface Ledger as implemented, alternate-native, not-human-facing or explicitly deferred with owner.

Visual acceptance is human evidence. Semantic identity/authority/provenance parity is executable product evidence. Both are required for a professional application.

---

# 18. Closure

The desktop programme is complete when O:I is no longer experienced as a set of good underlying products with a thin status shell above them.

A person can instead inhabit one coherent local software environment in which:

```text
their authored world is navigable,
the thing being worked on occupies the centre,
real situated agency is beside them,
material unfolding is available below,
the six products are inspectable and shapeable underneath,
and selected parts of the same world can be projected outward into Explore.
```

The application remains composable because those capabilities retain native ownership and can enter through shared Surfaces/Actions/read models rather than through O:I-specific semantic copies.

That is the intended installed experience of the O:I whole.