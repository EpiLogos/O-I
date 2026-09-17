# SharedField Desktop — Explore, encounter and participation

**Standing:** owner-approved synthesis of the existing SharedField/Explore, Self/Other, Personal Web, Expression Field and desktop interaction laws, updated 16 September 2026. This is the explicit desktop UX contract for O:I #18 and the SF0–SF6 bridge in `docs/SHARED-FIELD-QL-EPI-INTEGRATION-WAYFINDER.md`.

**Upstream design authority:**

- `.superpowers/sdd/cradle-rebuild/SELF-OTHER-FIELD-UX-2026-09-08.md` — Self/Other, one pane system, shared NOW, spatial travel and publication journey;
- O:I #18 — Explore as the open searchable field of projected worlds;
- `shared-field/ACCOUNT-PROJECTION.md` and `shared-field/WORLD-PRESENTATION.md` — projected world/page composition and human/Agent parity;
- `docs/cradle/PERSONAL-WEB.md` — Work/Personal, Beings/Things, page↔Wiki↔graph continuity;
- `docs/cradle/EXPRESSION-FIELD.md`, `docs/experience/EXPRESSION-FIELD.md`, `docs/contracts/EXPRESSION-APPLICATION-V1.md` — living Expression body and structured human/Agent operations;
- `docs/SHARED-FIELD-STATE-DISCOVERY.md` — Workspace/Project continuity, AIKit Search/Reveal, Projection staging and optional SpaceTimeDB Shared Stage;
- O:I #155 / current desktop interaction law — one Surface/window grammar, auxiliary contextual depth, participant/addressing and Activity/Attention;
- `docs/SHARED-FIELD-QL-EPI-INTEGRATION-WAYFINDER.md` — hosting, Projection, Expression and two-world execution.

This document gives SharedField a concrete place in the desktop. It creates no new semantic owner, shell, graph store, workspace store or social-feed ontology.

---

## 1. Product placement

The desktop has two broad experiential horizons:

```text
SELF / MY WORLD
  Central-rooted local world
  Work and Personal arrangements
  Projects, files, knowledge, Agents, Runs, pages, Expressions

OTHER / OPEN FIELD
  Explore
  projected people / worlds / Agents / projects / knowledge / Expressions
  SharedFields and encounters among them
```

**Explore** is the stable desktop entrance to the open/shared horizon.

`Work / Personal` continues to organise the person's own world. Explore is not a third filesystem mode and is not scoped to the currently selected Project. It is a global O:I destination which opens in the ordinary canvas/Surface system and remembers its own navigation/view state.

A **SharedField** is an addressable collaborative field encountered through Explore or a direct native ref. It opens as an ordinary O:I Surface. It does not create another desktop shell.

### Stable desktop entry

The desktop must expose a first-class **Explore** destination in the global navigation/rail at the same application altitude as other whole-world destinations, not buried inside a Project page or System settings.

Opening Explore:

- leaves current local Work/Personal/Project Workspace state intact;
- opens/focuses the existing Explore Surface in the canvas;
- restores its last query, selected world/field, navigation history and camera/constellation state where valid;
- preserves the Workspace's bound AgentSession/SessionSpace refs without starting or replacing either;
- does not automatically disclose the current local selection to any remote participant or Agent;
- does not start a new AgentSession.

Returning to local work restores the prior local arrangement without closing watched fields, active authorised shared sessions or background subscriptions.

**Workspace state follows the person's work; Shared Stage state follows the encounter; canonical subject state stays with its native owner.**

---

## 2. Explore at rest

Explore is an **open searchable field**, not a feed or dashboard.

The resting canvas shows the currently meaningful open field:

```text
projected worlds / Beings / Things / Agents / fields
             related through admitted relations
```

Search is the primary ingress. The existing AIKit Search/Resolve grammar resolves addressable Human roots, Agents, Projects, Wiki subjects, Projections, Expressions, WorldPresentations, SharedFields and Contributions through shared application/read models.

Search may reveal several related presentation forms without collapsing them:

```text
native subject / ResourceRef
    ├─ Being or Thing presentation role
    ├─ eligible Expression(s)
    ├─ WorldPresentation / page
    ├─ projected occurrence
    └─ SharedField occurrence where one exists
```

The result keeps subject, presentation, Projection and live occurrence distinct. Search is a resolution/revelation layer, not another store.

Workspace/project/current-subject context may seed local scope and ranking. Opening Explore globally does not mutate the chosen local Project, and local focus is not automatically disclosed to another World or Agent.

The default presentation may use a bounded constellation/field reading with sparse O:I relation language. Expression-based presentation may enrich an eligible result or local whole, but the desktop does not require every search result to instantiate a particle renderer.

There is no infinite engagement feed. Watched changes, recent encounters and invitations are explicit secondary readings of the field.

### Minimal persistent chrome

Explore keeps application chrome restrained. The stable visible controls are only those needed to orient and act, such as:

- search / command aperture;
- current field or world identity when one is entered;
- back / forward / return-to-field navigation;
- Watch / Join / Share state where applicable;
- participant/presence micro-signals when inside a live SharedField;
- ordinary Surface controls for split/full/detach/close.

Source, provenance, relations, Contributions, people and Agent depth are summoned contextually rather than permanently occupying the canvas.

---

## 3. Opening a world, Being or Thing

A selected projected subject opens its **WorldPresentation** as the primary canvas body.

Possible bodies include:

```text
HTML / prose / image / Card / Cube / Wiki reading
live Expression
captured Expression fallback
other admitted WorldPresentation renderer
```

If a live Expression renderer is available, the selected Expression may become the living body of the page. If it is unavailable, the declared image/video/frozen-HTML fallback renders honestly.

The same subject and Projection refs survive renderer choice.

### Contextual depth

From the primary presentation the person may summon:

- local relations / bounded graph;
- source and provenance;
- linked files/material;
- Contribution history;
- people / Agents involved;
- Watch / membership / permission state;
- current Actions;
- Explain / history where owners provide them.

These appear through the established auxiliary/pane/pop-out grammar. They are not a second SharedField inspector shell.

The September Self/Other placement remains binding:

- a bounded relation/tree/constellation can frame the current subject on the left **inside the active Surface** when useful;
- details/files/Contribution depth can open on the right **inside that Surface**;
- either depth can collapse, overlay, split, detach or disappear;
- neither is required at rest.

### Personal Agent remains separate

The person's own accompanying Agent remains the ordinary optional Agent/auxiliary Surface.

Opening another person's Agent, a SharedField participant or an Agent Being does not silently replace the person's AgentSession. A shared Agent may open as a participant/profile/Activity subject in the canvas or contextual depth. The person may separately summon their own Agent to help them explore.

Field selection never silently discloses selected content to the person's Agent.

---

## 4. Entering a SharedField

A SharedField Surface has one primary purpose: **inhabit the shared subject and its current collaborative relation**.

At rest it should feel like the field itself, not a collaboration administration page.

The Surface is composed from:

```text
field identity / intention
bound projected worlds / subjects
current primary WorldPresentation or Expression
participant presence
Contribution relations
Watch / membership / authority state
optional Shared Stage state
```

### Field strip

A minimal field strip may disclose:

- title / short intention;
- public/private/audience standing;
- Watch state;
- Join / Leave / Request access where meaningful;
- small participant/presence indicators;
- Follow / Unfollow presenter only when a Shared Stage actually exists;
- contextual overflow for field-level Actions.

Do not repeat large title/description/status blocks above the actual shared material.

### Main body

The main canvas hosts the actual shared subject:

- a WorldPresentation;
- an Expression;
- a Wiki/knowledge local whole;
- an HTML/page body;
- a shared NOW working object;
- another admitted material Surface.

When a SharedField has several bound subjects, the current selected subject remains primary and the rest form its bounded field context. Do not render every bound object simultaneously merely to prove membership.

---

## 5. Presence, participants and addressing

Presence is felt lightly in the field.

Use compact avatars/names/status dots or equivalent restrained signals. A full participant roster is contextual depth, not permanent chrome.

Selecting a participant opens their projected Being/profile and available relations without implying trust, endorsement or authority.

Use the existing typed participant/addressing grammar:

```text
membership
addressing / To: / @
invocation
authority
attention
```

These remain distinct.

A human, Agent or AgentSet can be addressed where the field permits it. Addressing an Agent does not grant it authority. Invoking an Agent uses the current Gateway/AgentSession ecology and native authority path.

---

## 6. Contributions — the main shared act

A SharedField is object-centred collaborative space, so **Contribution** is the ordinary shared act.

A person who is authorised to contribute can invoke a contextual `Contribute` interaction from:

- the current SharedField;
- a selected Being or Thing;
- a relation;
- another Contribution;
- the current Expression/page selection.

The composer remains attached to the work rather than replacing the canvas.

A Contribution may contain or reference:

- prose/response;
- a relation proposal;
- a source/Wiki proposal;
- a Thing/page/artifact;
- an Expression revision or scene;
- an image/video/file where admitted;
- a Method/praxis reference;
- another native object supported by the Contribution contract.

The composer can use `To:` / `@` for addressed participation without flattening Contribution into chat.

A dialogue-oriented SharedField may present contributions conversationally. That presentation does not create a separate message ontology.

### Contribution stack

Contribution-on-Contribution remains addressable. When inspecting a selected object, its contribution stack can open as contextual depth with author, revision, standing, evidence/provenance and available Actions.

Accepting a Contribution into source is never an inline UI mutation of canonical source. It invokes the native Return/proposal/owner Action and shows its exact result.

---

## 7. Publishing from the local desktop

Sharing starts from the actual local subject.

Representative flow:

```text
local Being / Thing / page / Expression / Wiki subject
        ↓ Share / Project
publication preview
        ↓
exact outward representation + omissions
        ↓
audience / destination / live-vs-fallback choices
        ↓
Projection revision
        ↓
Open in Explore / SharedField
```

The preview must show what another world will actually receive:

- selected source/readings;
- WorldPresentation modules;
- live Expression eligibility and fallback;
- linked outward relations;
- withheld/private omissions;
- audience and expiry/revocation facts where relevant.

Linked private material does not become public by association.

`Save Expression`, `Export`, `Publish Projection`, `Contribute` and `Return to source` are separate acts.

After successful publication the person can remain in local work or choose **Open in Explore** to encounter the public/shared representation as another Surface reading.

The publication preview is local Projection staging. It is not a live Shared Stage and it does not change the current Workspace until the person actually opens/focuses another Surface.

---

## 8. Knowledge travel inside Explore

Explore consumes the same bounded local-whole law as local Wiki/Knowledge.

A selected subject can reveal its admitted neighbourhood and allow:

```text
search
open / recenter
back / forward
pin / follow
relations
sources
page / Expression
```

Spatial travel uses real relation data. Distant constellations may provide orientation; arriving resolves the selected local whole. Motion is interruptible and reduced-motion has equivalent navigation.

The current Expression/point-cloud language may make the field alive where it carries the actual projection. Decorative geometry never manufactures neighbours or relation standing.

LIST / TREE / GRAPH / page / Expression are readings over the same selected projected state and stable selection.

Interconnected HTML/WorldPresentation pages are navigable because their admitted subject/component bindings and typed relations feed the same Explore index/read model. The desktop never has to scrape arbitrary page DOM to infer the world.

---

## 9. Shared NOW

A SharedField can become or contain a time-bounded **shared NOW** through Central's existing NOW semantics.

A shared NOW is created from:

```text
intention
+ one or more projected World/Thing refs
+ participant membership
+ admitted capabilities / permissions
+ lifecycle
```

Entering a NOW keeps the SharedField's visual language and pane system. It does not open a separate task-management application.

The working surface foregrounds the actual shared material/Expression/Flow. Participant and Activity depth is summoned as needed.

Closing a temporary NOW presents an explicit retain/return step for selected outputs. Retention uses owner operations and keeps origin/intention/NOW lineage. Failure to retain is recoverable before destructive closure.

A Shared NOW may use a Shared Stage for its current presentation locus, but the two are not identical: NOW is Central's temporal/intention relation; Shared Stage is the optional synchronised presentation relation.

---

## 10. Watch, Activity and Attention

**Watch** is the preferred durable relation to a world, Being, Thing, Project, Wiki subject or SharedField.

Watch changes future availability/notification readings. It is not endorsement, trust or semantic truth.

SharedField Activity uses the ordinary O:I Activity/Notification/Attention altitudes:

- Activity — something meaningful happened;
- Notification — transient projection of change;
- Attention — something now requires or invites human response.

Routine presence or renderer updates do not flood Attention.

A notification deep-links to the exact projected subject/Contribution/field. Opening it restores the relevant Explore/SharedField state rather than routing to a generic inbox page.

---

## 11. Expression and Agent-native operation

`oi.expression/v1` is already the structured human/Agent application seam.

Inside SharedField this means:

- live Expression pixels are presentation, not semantic addresses;
- an Agent receives exact Expression/scene/entity/subject/revision bindings;
- an authorised Agent can inspect/compose/focus/edit through structured operations;
- shared edits are attributable and revision checked;
- visible Agent edits correlate with actual Expression receipts/Activity;
- private local runtime state is not uploaded merely because the Agent can see it locally.

The SharedField desktop must expose the same semantic state to human and Agent Surfaces. No Agent workflow may depend on scraping the rendered Explore page.

The Workspace may remember refs to the person's AgentSession and AIKit SessionSpace. Neither becomes Workspace state internally, and neither is copied to SharedField merely because its ref is bound locally.

---

## 12. Workspace, view state and lifecycle

SharedField uses the normal O:I Workspace + Surface/window lifecycle.

The Workspace is the host-level continuity relation across Work, Personal, Explore, pages, Expressions and SharedFields. It is not a Project, SessionSpace, AgentSession or semantic source.

Persist compact local state such as:

- Workspace ref/name and current root/project context;
- focused subject / Surface;
- open tabs/splits/detached Surface refs;
- selected Expression/page/scene and local focus;
- active Explore destination;
- current Search query and selected ResourceRef;
- selected world/field/Projection;
- navigation/History routes;
- bounded graph/local-whole camera and filters;
- open contextual depths/apertures;
- refs to bound AgentSession / SessionSpace;
- dirty working-presentation/draft standing where the owner contract permits it;
- joined/watched refs as ordinary application relations.

Do not persist cloned remote payloads, Agent transcripts, private remote source or graph stores as desktop semantic state.

### Project continuity across every Surface

A person may open Explore or a SharedField while Project A remains their local project context. Reading World B does not silently change Project A. If they deliberately import/relate/return a remote contribution into Project A, the native Project owner Action establishes that new relation.

Work/Personal/Explore switching restores the appropriate Surface constellation and selection while the stable local Project context remains intelligible. Tabs for the same Project share project context. A detached window is still part of the same Workspace constellation.

### Kill/relaunch

Autosave must survive ordinary process loss/relaunch. On restore, semantic state is reconciled by stable refs/revisions; stale or unavailable remote objects degrade explicitly rather than being replaced by cached clones.

Workspace restoration and SharedField reconnection are independent operations. A restored Workspace can show a temporarily unavailable shared Surface while SpaceTimeDB reconnects.

Hidden/offscreen rich renderers pause/release unnecessary GPU/media/subscriptions according to their host contract. Closing a view does not leave the SharedField, unwatch it or stop an Agent unless an explicit Action says so.

Detached windows retain the same Surface/subject identity and re-dock through the standard frame grammar.

---

## 13. Shared Stage — optional synchronised presentation

A SharedField may expose an explicit **Shared Stage** when participants deliberately want to inhabit the same changing presentation locus.

The stage can synchronise application-level state such as:

```text
current projected subject
WorldPresentation / Expression revision
current scene
shared focus / selected Being or Thing
presenter / follower relation
approved authored presentation edits
causal Activity / Action refs
```

It does **not** synchronise by default:

- local tabs/splits/window layout;
- local camera or reading position;
- private drafts;
- local Search history;
- Agent transcripts/context;
- SessionSpace/Harness state;
- raw Nara/private source state;
- GPU/particle/audio buffers.

### Presenter / follower UX

When a participant begins an admitted stage, another participant may choose **Follow**. Follow means their shared material locus tracks the stage revision. It does not surrender their whole Workspace.

They can **Unfollow** at any time and continue from a local view without leaving the SharedField. Re-follow reconciles to the current stage revision.

A stage edit that creates a new Expression revision uses the Expression CAS/owner operation. A Return to source uses the source owner operation. Shared Stage itself is never source authority.

Presence, stage updates and reconnect are suitable SpaceTimeDB live state. Renderer simulation buffers are not.

---

## 14. SF0–SF6 desktop ownership

The desktop experience develops with the hosted work rather than being postponed. All units consume `SHARED-FIELD-STATE-DISCOVERY.md`; state continuity is not deferred to SF6.

### SF0 — hosted floor

Must establish real second-world connectivity and expose honest service/offline/reconnect state to the desktop. Lock the Workspace/Project/Projection/SharedStage/material-state distinctions and minimal revisioned Shared Stage schema. No rich Explore implementation is required to prove the service.

### SF1 — first real desktop place

SF1 owns the first complete desktop embodiment needed for the Projection carrier:

1. add the stable global **Explore** destination to the desktop navigation;
2. mount/restore Explore and SharedField Surfaces through the existing Workspace mechanics;
3. search/open a real projected WorldPresentation from the hosted/read-model path;
4. render an admitted live Expression or its explicit fallback;
5. preserve exact World/Projection/Presentation/Expression refs across open, full, split, detach and return;
6. provide contextual source/provenance/relations depth without permanent new sidebars;
7. keep the personal Agent independent and summonable;
8. implement local **Share / Project** preview for one ordinary Expression/Thing with real audience filtering and **Open in Explore**;
9. show Watch/Join/availability state where the backing contracts already support it;
10. persist/restore Explore query/selection/history/view state;
11. return to the prior Work/Personal/Project constellation exactly where valid;
12. kill/relaunch and reconcile the same Workspace by stable refs/revisions.

SF1 acceptance is a running desktop walk, not carrier tests alone.

### SF2 — living knowledge encounter

Deepens Explore with AIKit Search/Resolve over projected subjects and their eligible Beings/Things/Expressions/WorldPresentations, bounded Wiki/M0/knowledge constellation projection, spatial travel, recenter/back/pin/follow and source/Actions over the exact projected local whole.

### SF3 — Agent / Being encounter

Adds rich projected Beings, participants, presence, typed addressing and permitted Agent/Epii interaction through the existing Gateway/session ecology while preserving Workspace-bound personal AgentSession/SessionSpace refs.

### SF4 — Contribution / Return

Adds the attached contribution composer, contribution stacks, Contribution-on-Contribution and exact native Return/proposal flows. Shared Stage presentation edits remain causally distinct from Return/source mutation.

### SF5 — protected Nara / M′ encounter

Adds safe Nara/Epi expressions, explicit shared-presence consent and the rich local/shared instrument path without publishing protected personal state. Shared Stage may synchronise admitted presentation refs only.

### SF6 — two-world lived cut

Runs the complete experience across the real two-machine/two-world topology with human visual/interaction acceptance, independent local Workspaces and an optional presenter/follower Shared Stage.

---

## 15. SF1 acceptance walk

SF1 cannot close until this works in the running desktop against the real carrier/service available at that point:

```text
Project A / Expression E open in local Work Workspace
→ open global Explore
→ Search resolves an addressable projected Thing/world
→ result reveals eligible Expression / WorldPresentation without collapsing identity
→ WorldPresentation becomes the main canvas body
→ live Expression renders, or explicit safe fallback renders
→ summon relations/source depth and dismiss it
→ summon personal Agent without replacing the shared subject
→ full/split/detach/re-dock the presentation
→ return to Explore field with selection/history intact
→ return to prior Project A / Work/Personal Workspace intact
→ kill/relaunch
→ same valid Workspace constellation restores by refs/revisions

local Thing / ordinary Expression
→ Share / Project
→ inspect exact outward preview and omissions
→ choose admitted audience/destination
→ create Projection
→ Open in Explore
→ see the exact projected representation/ref
```

Also prove:

- offline/unavailable SharedField state is honest and does not erase local work;
- private sentinel data is absent from outward payload and fallback;
- opening a projected Agent does not replace the person's AgentSession;
- SessionSpace does not become Workspace/SharedField state;
- no new sidebar, graph store, chat store, workspace store or desktop SharedField database exists;
- human and structured Agent readings identify the same projected subject and revisions;
- projected HTML navigation is driven by structured refs/relations rather than DOM scraping.

Human judgement must confirm that Explore feels like entering another world/field rather than opening a platform administration dashboard.

---

## 16. Shared Stage acceptance walk

```text
World A projects Expression E / WorldPresentation W
→ World B discovers it with Explore Search
→ both enter SharedField F
→ Presence becomes live
→ A opens Shared Stage over projected E
→ B explicitly chooses Follow
→ A changes admitted scene / shared focus
→ B receives the new stage revision
→ B chooses Unfollow and keeps a local reading
→ B contributes a refinement
→ owner accepts through the native Expression/source Action
→ optional reprojection advances the outward representation
```

Prove that A's local tabs/camera/private drafts/Agent context and Nara internals never appear in B merely because B followed the stage.

---

## 17. Visual character

SharedField inherits O:I's current visual language and the Self/Other direction:

- soft paper / graphite relation field in light mode;
- restrained dark field with subdued distant nodes and sparse live emphasis;
- slender relation geometry;
- minimal gold reserved for active relation/projection/focus;
- World/Being art direction is allowed to dominate its own WorldPresentation;
- Expression presentations retain their authored visual character;
- host chrome stays quiet, sparse and native;
- no card-grid social feed as the primary experience;
- no permanent analytics/dashboard framing.

The intended feeling is **travel, encounter and making together**: another person's world becomes present as a coherent world, not as a profile card surrounded by platform chrome.

---

## Closure

The SharedField desktop is real when the person can preserve their local Workspace and Project constellation; leave Work/Personal for Explore; use Search to discover native subjects and their relevant Beings, Things, Expressions and WorldPresentations; enter another projected world; inhabit its page/Expression/knowledge relations; watch or join a SharedField; optionally follow a shared presentation without surrendering local state; contribute under real authority; involve Agents without losing subject/session continuity; return accepted differences through native owners; and move back into the local world without those presentation transitions reminting the underlying people, worlds, subjects or sessions.