# SharedField State, Discovery and Shared Stage

**Standing:** owner-directed integration lock, 16 September 2026.  
**Programme:** O:I #18 SharedField/Explore, O:I #306 Expression Field and O:I #65 two-world acceptance.  
**Companions:** `docs/SHARED-FIELD-QL-EPI-INTEGRATION-WAYFINDER.md`, `docs/experience/SHARED-FIELD-DESKTOP.md`, `docs/cradle/EXPRESSION-FIELD.md`, `docs/contracts/EXPRESSION-APPLICATION-V1.md`, `shared-field/WORLD-PRESENTATION.md`.  
**Purpose:** make state ownership, project/workspace continuity, Search/Resolve discovery and optional live shared staging explicit before SharedField development resumes.

This document does not create a second state store, workspace model, search system or SharedField ontology. It connects the state laws already present in the Cradle, AIKit, Explore, Expression and SharedField work.

---

## 1. Governing relation

The system needs continuity without collapsing unlike kinds of state into one bucket.

```text
canonical World / Project state
        ↓ stable refs + revisions
local O:I Workspace state
        ↓ focus / context / open Surfaces
AIKit Search / Knowledge read state
        ↓ resolution / routes / bounded local whole
Projection staging
        ↓ explicit audience selection
SharedField live state / optional Shared Stage
        ↓ SpaceTimeDB materialisation + subscriptions
renderer / material state
```

The governing law is:

> **Workspace state follows the person's work. Shared Stage state follows the encounter. Canonical subject state stays with its native owner.**

A state may refer to another layer by stable ref. Reference does not transfer ownership.

---

## 2. Six state layers

### 2.1 Canonical World / Project state

Owned by Central / ProjectCentral and the actual product-native source owners.

Examples:

- project/root identity and source revisions;
- files, authored documents and Wiki topology;
- Human/Agent/World identities;
- native Actions, permissions and authority;
- saved `oi.expression/v1` revisions;
- WorldPresentation revisions;
- Projection revisions;
- accepted Contributions after their Return reaches an owner;
- Agent Activity and Method records in their native systems.

This layer is not owned by O:I Workspace state or SpaceTimeDB merely because the material is open or shared.

### 2.2 O:I Workspace / application state

The Cradle's existing Workspace law extends across **all** O:I Surfaces. A Workspace is freeform, user-nameable and continuously autosaved host application state, not a Project, SessionSpace or source store.

A Workspace may retain, by stable refs and compact view state:

```text
workspace_ref / name
root or project context
focused subject / Surface
open tabs / splits / detached Surface refs
selected Expression / WorldPresentation / page
scene / focus / camera / view where local restoration requires them
graph query / filters / bounded-local-whole focus
Explore query / selection / route history
summoned source / graph / Agent / Studio / Activity depths
bound AgentSession_ref / SessionSpace_ref
local draft / working-presentation refs and dirty standing
joined / watched SharedField refs
local presence relation for an entered SharedField
```

The Workspace owns **restoration of the person's constellation**, not the semantic objects inside it.

Required continuity:

- Project opening focuses the relevant Workspace without reminting Project state;
- Work, Personal and Explore can open different Surfaces while preserving one coherent local application world;
- tabs/splits for the same Project share project context;
- switching Workspace restores the exact valid constellation rather than rebuilding from a dashboard;
- kill/relaunch mid-work restores the autosaved Workspace and reconciles every semantic object by stable ref/revision;
- detached/re-docked Surfaces remain the same Surface/subject relation;
- opening a SharedField or another World never silently replaces local project context, AgentSession or SessionSpace.

### 2.3 AIKit Search / Knowledge derived read state

AIKit Search/Resolve is the common discovery relation for human and Agent use. It does not become another source store.

Search state includes:

```text
query
resolution scope / current project or world context
result ResourceRefs
selected ResourceRef
resolved routes / typed relations
bounded local whole
source/explain readings
History / familiar routes
provider availability / degradation
```

The existing law remains:

```text
SEARCH  find the thing
ACTION  open / inspect / watch / traverse / contribute
HISTORY recover meaningful destinations and routes
```

Search is broad, fuzzy and low-latency at its base. Semantic/vector/graph providers may enrich the result but do not gate addressability.

Search and navigation must resolve the same stable identities across Quick, Workspace, LIST, TREE, GRAPH, page and Expression views.

### 2.4 Projection staging

Projection staging is the local preparation of an outward representation. It is neither Workspace state nor public state.

It binds:

```text
native subject / source refs + revisions
selected WorldPresentation / Expression refs + revisions
outward Being / Thing presentation roles
permitted typed relations
chosen audience / destination
redaction / withholding decisions
live-renderer eligibility
image / video / frozen HTML fallback
expiry / revocation policy where present
working preview
```

`preview != Projection`.

Publication creates or advances the actual audience-scoped Projection revision through its owner operation. Merely arranging a preview or selecting a remote destination has no publication effect.

### 2.5 SharedField live state and optional Shared Stage

SpaceTimeDB may materialise the live shared application state of an admitted SharedField. Semantic refs remain explicit fields; database row IDs are implementation details.

The ordinary shared floor includes:

- SharedField identity/intention/lifecycle;
- Participants and Presence;
- membership / Contact / Watch;
- Encounter;
- Contribution and Contribution-on-Contribution;
- shared semantic refs;
- Projection / WorldPresentation / Expression revision refs;
- attributable Activity / Action result refs;
- availability / reconnect / currentness metadata needed for the live relation.

#### Shared Stage

A SharedField may **explicitly opt into** a `Shared Stage`: a synchronised collaborative presentation locus over material already admitted to the field.

Candidate Shared Stage state:

```text
shared_stage_ref + revision
field_ref
current projected subject_ref
current WorldPresentation_ref / Expression_ref + revision
current scene_ref when meaningful
shared focus / selected Being or Thing
presenter_ref? / follower relations
approved authored presentation parameter or scene changes
Activity / Action refs that caused meaningful shared changes
causal revision / timestamps
```

The stage is not automatically created for every field and does not mean every visitor shares a camera or editor.

Local by default:

```text
window geometry / tabs / splits
local camera unless explicitly staged
personal filters and reading position
private drafts
unprojected source
private Agent context / transcripts
raw Nara / body / journal state
local SessionSpace / HarnessComposition
GPU / particle / resonator buffers
```

Following a presenter is an explicit relation. Leaving `follow` returns the participant to their own local view without leaving the field.

Shared Stage operations must be revision checked and attributable. They can alter the **shared presentation state** that policy permits; they do not mutate native source, Wiki truth or Personal state.

### 2.6 Material/runtime state

Material/runtime state belongs to the actual infrastructure and renderers:

- SpaceTimeDB process/storage/subscriptions;
- Workcell placement, lifecycle, persistence, backup and recovery;
- Gateway/network/Tailscale reachability;
- Explore search index / caches;
- Expression renderer/GPU state;
- local audio/material runtime;
- transport locators and provider-specific IDs.

These may be rebuilt or relocated while semantic refs remain stable. The Explore index is derived and rebuildable; SpaceTimeDB is not the search ontology; renderer state is not SharedField state.

---

## 3. Search reveals the living web

The new ontology changes **what Search can reveal**, not who owns Search.

A query or current focus may resolve native objects and then discover their eligible presentations:

```text
query + project/root/world context
        ↓
AIKit Search / Resolve
        ↓
native subjects + routes + typed relations
        ↓ presentation resolution
eligible Being / Thing bindings
Expression(s) / WorldPresentation(s) / page(s)
        ↓
local reveal or bounded local whole
        ↓ if projected
Explore index
        ↓
another World can discover / open
        ↓
SpaceTimeDB supplies live SharedField relation if entered
```

Search results may therefore reveal:

- Beings: people, Agents/Epii and admitted presences;
- Things: Wiki/Bimba/M coordinates, works, files, pages, Projects, Methods, artefacts and collections;
- Expressions that present one subject or bounded local whole;
- WorldPresentations/pages containing those Expressions;
- projected worlds / SharedFields / Contributions;
- source and relation routes by which the result is intelligible.

The result must retain the distinction between **subject**, **presentation**, **Projection** and **live SharedField occurrence**.

A useful result can therefore read conceptually as:

```text
Thing: M2-…
  native subject_ref
  presented by: Expression E7
  occurs in: WorldPresentation W4
  projected in: World P / SharedField F
  related Beings / Things: …
```

without inventing a new aggregate identity.

### 3.1 Current focus is a search seed, not a disclosure

Workspace/project/current-subject state may seed Search scope and ranking locally. It is not automatically sent to another World or Agent.

Opening Explore preserves the local Project context and can search globally. Choosing a global result does not mutate the chosen local Project. A deliberate `open in project`, `relate`, `import`, `watch`, `contribute` or other owner Action establishes a new relation.

History records routes and destinations, not semantic truth or personal preference authority.

---

## 4. Observable and navigable interconnected HTML worlds

The web of authored HTML, WorldPresentations and Expressions becomes observable because the underlying documents carry stable structured bindings — **not because O:I scrapes arbitrary HTML**.

The carrier relation is:

```text
native authored source / HTML
        ↕ structured subject/source bindings
Wiki / Knowledge relations
        ↕
WorldPresentation
        ↕ admitted Expression / other component bindings
Projection
        ↓
Explore index + SharedField refs
```

For projected material the rebuildable Explore index may index:

- stable world / subject / presentation / Expression refs;
- titles, aliases and admitted text fields;
- Being / Thing presentation roles;
- typed relations and adjacency;
- source/provenance descriptors allowed outward;
- Projection / SharedField membership;
- addressable component / contribution refs;
- optional embeddings or analytic projection as enrichment.

Opening one result resolves a bounded local whole instead of loading the entire web. LIST / TREE / GRAPH / page / Expression are alternate readings over that same admitted relation state.

This lets a collection of interconnected HTML pages become a genuinely navigable world while preserving the actual semantic owners underneath it.

Arbitrary hosted HTML/JS receives no ambient filesystem, credential, AgentSession or Action authority. Rich native interaction goes through admitted component/Action boundaries.

---

## 5. State flow across Surfaces

The ordinary continuity should feel simple even though ownership is layered:

```text
Work Workspace
  Project A / Thing X / Expression E / AgentSession S
        ↓ open Explore
Explore Surface
  query is seeded by explicit user input / current local context
  local Project A remains selected in the Workspace
        ↓ open projected Being Y
WorldPresentation Y
  summon relations / Agent / source
        ↓ enter SharedField F
SharedField Surface
  Presence is live through SpaceTimeDB
  optional Shared Stage follows projected Expression E2
        ↓ leave follow / leave field
Explore state restores
        ↓ return Work
Project A / Thing X / Expression E / AgentSession S restore
```

No transition above requires copying canonical Project state into Explore or SpaceTimeDB.

### 5.1 Workspace and Project relation

Project context is a stable Workspace relation, not a routing side effect.

A Surface can read another World or SharedField while the Workspace still knows which local Project owns the person's active local work. If a remote contribution is accepted into a Project, that happens through the Project/native owner Action and becomes a new canonical revision.

### 5.2 SessionSpace relation

Preserve the existing AIKit distinction:

```text
SessionSpace != Project
SessionSpace != Workspace
SessionSpace != ContextResolution
SessionSpace != AgentSession
SessionSpace != HarnessComposition
SessionSpace != Surface
SessionSpace != Actuation
```

Workspace may retain refs to the bound AgentSession / SessionSpace. It does not absorb their semantics or lifetime.

---

## 6. Shared Stage operations

The first Shared Stage contract should stay small and application-level.

Recommended operation family:

```text
open / close shared stage
set current projected subject
set WorldPresentation / Expression locus
set / clear shared focus
follow / unfollow presenter
advance admitted scene
apply admitted shared presentation edit
observe current stage revision
```

Consequential native operations remain native Actions. A stage edit that proposes a new Expression revision uses the Expression application CAS path; a Return to source uses the source owner path. The stage itself never writes canonical source.

Concurrent updates require revision/currentness handling rather than last-writer opacity. A client that reconnects receives current shared-stage state, reconciles semantic refs and preserves its own local Workspace view unless it explicitly resumes following.

---

## 7. SF0–SF6 consequences

This state/discovery contract sharpens the existing SF units; it does not introduce SF7.

### SF0 — owner/state lock

Record the six state layers and their owners. Lock Workspace ≠ Project ≠ SessionSpace ≠ Shared Stage ≠ Projection ≠ source. Define the minimal Shared Stage schema and Search presentation-resolution seam before runtime expansion.

### SF1 — carrier + Workspace continuity

In addition to carrier/Projection requirements:

- mount Explore and SharedField through the existing Workspace/Surface system;
- restore local Project/Work/Personal state exactly after an Explore/SharedField journey;
- retain query/selection/history/apertures and stable subject/presentation refs;
- kill/relaunch and reconcile by ref/revision rather than cloned payload.

### SF2 — SpaceTimeDB live relation

Extend the hosted floor with explicit shared-stage state only where enabled:

- Presence/Watch/Encounter/Contribution remain ordinary live state;
- SharedStage/SharedStageMember-or-follow state is revisioned and subscribable;
- reconnect restores the current field/stage without importing local Workspace state;
- renderer buffers never enter SpaceTimeDB.

### SF3 — presentation carrier

Ensure WorldPresentation/HTML/Expression outward bindings expose the structured refs required for Search/index/navigation and live/fallback renderer resolution. No DOM scraping becomes the index source.

### SF4 — AIKit Search / discovery / Agent reading

Use existing AIKit Search/Resolve/Knowledge operations to discover native subjects and their eligible Being/Thing/Expression/WorldPresentation forms. Search, human browse and Agent browse consume the same stable refs and bounded local-whole state.

### SF5 — Contribution / Return / state causality

Contribution and Shared Stage operations retain causal refs/revisions. A stage interaction may yield an Expression/Contribution proposal; accepted Return advances the native owner and optionally a new Projection. Stage state itself never becomes source.

### SF6 — two-world lived cut

Prove:

- two independent identities/worlds;
- local Workspace and Project restoration on both sides;
- projected Search → Being/Thing/Expression discovery;
- live Presence/Watch/Encounter;
- optional presenter/follower Shared Stage;
- local unfollow without leaving the field;
- Contribution → native Return → reprojection;
- reconnect / server restart / source-offline hosting;
- no private Workspace, Agent or Nara state leaks into shared state.

---

## 8. Acceptance walks

### A — local continuity

```text
open Project A / Expression E in Work
→ open Personal and return
→ open Explore and search globally
→ open projected Thing Y in a WorldPresentation
→ enter SharedField F
→ leave F / Explore
→ return Project A
→ exact valid Project/Expression/AgentSession/Surface constellation restored
→ kill and relaunch
→ same Workspace restored by refs/revisions
```

### B — Search reveals presentations

```text
search for a native subject
→ see native Thing plus eligible Expression / page presentation
→ open bounded local whole
→ follow a relation to a Being
→ open its WorldPresentation
→ inspect source/provenance
→ return through History
```

Human and Agent readings identify the same refs and routes.

### C — shared stage

```text
World A projects Expression E / WorldPresentation W
→ World B discovers it through Explore Search
→ both enter SharedField F
→ Presence is live
→ A opens Shared Stage and chooses projected E
→ B explicitly follows A
→ A advances an admitted scene / focus
→ B observes the shared stage revision
→ B unfollows and retains a local view
→ B contributes a refinement
→ owner accepts through native Expression/source Action
→ new revision is optionally reprojected
```

At no point are A's local tabs/camera/private draft/Agent context/Nara internals copied merely because B follows the stage.

### D — observable HTML web

```text
project several interlinked Beings / Things / pages
→ rebuild Explore index from admitted structured bindings
→ search an alias / subject
→ open page
→ traverse typed relation to another page / Expression
→ recenter bounded local whole
→ enter live SharedField occurrence if one exists
```

The route survives SpaceTimeDB restart and index rebuild because semantic refs, not row IDs, are authoritative.

---

## 9. Closure law

The state/discovery fold is complete when:

- the person's Workspace can carry coherent project/work/personal/explore continuity across every Surface;
- AIKit Search can resolve the native world and reveal relevant Beings, Things, Expressions and WorldPresentations without creating another store;
- projected structured HTML/WorldPresentation relations form a real observable/navigable web;
- SpaceTimeDB carries the explicitly shared live relation and optional Shared Stage, not local or canonical state;
- two worlds can encounter the same projected semantic refs while retaining independent local workspaces and privacy;
- Return reaches actual native owners and a shared stage never becomes hidden source authority.

This is the state shape required to resume SharedField development cleanly.