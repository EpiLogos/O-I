# Agent praxis, documentation and experiential document world

Standing: owner-commissioned implementation Wayfinder, 24 September 2026.

This map develops the current O:I founding position that human authorship should remain causally present in artificial agency, the current Agent/World and Skill/SkillSet implementation, the documentation methodology work, and the existing Cradle HTML document field into one joined development programme.

Starting O:I main for this map: `54760988b2fed1055f8d44aef1e4eb4783c6a530` ("contracts: World inhabitation across Workcells, and teams (#514)"). Read current successor heads before implementation. This file is an implementation map, not an assertion that the described end state already exists.

Canonical upstream meaning: `docs/positions/FOUNDING-POSITIONS.md`.
Relevant current document/runtime sources include `docs/experience/DOCUMENT-OPERATIONS.md`, `.wayfinder/maps/canvas-editor-context.md`, `desktop/cradle/documents/forms.json`, the supplied Day/Flow forms, Central AgentProfile/World sources, AIKit Skill/Method/SkillSet resolution, O:I Guardian composition and the current World-inhabitation/SharedField contracts.

The central product determination is:

> Human authorship should become most intense where meaning, intention, taste and recognition enter the system. For the desktop, crafted experiential HTML documents are one of the principal places where that authorship becomes directly encounterable. For Agents, the corresponding structure is a small authored Agent expression carrying a discoverable repertoire into a World. The two sides meet through explicit source, context, action, evidence and Return relations.

This Wayfinder does not create another document database, Agent identity system, workflow engine or UI framework. It joins the systems already present and makes their intended relation explicit.

---

## 0. The whole: two situated participants in one authored World

The human and the Agent should not be modeled as mirror-image configuration objects. They meet the World differently.

For the Agent, the principal relation is:

    Agent expression / intent
        -> reusable praxis
        -> situated method
        -> methodology
        -> repertoire
        -> inhabited World
        -> action / encounter
        -> Return

For the person, the principal relation is:

    authored meaning / intent
        -> crafted document
        -> direct encounter and manipulation
        -> Commission / selection / editing
        -> Agent and material action
        -> evidence / returned difference
        -> Recognition / revision

The product should make these relations mutually legible without collapsing them.

The human should be able to shape meaningful experiential documents directly. The Agent should be able to disclose how it is situated and which praxis and context actually participate in an act. The same source and Return infrastructure should let each side meet the other's contribution without pretending that observation from outside exhausts the other's internal determining field.

---

## 1. Agent praxis sixfold

Treat the Agent as the `0/1` whole of a praxis/World reading.

| Position | Agent relation | Question |
|---|---|---|
| 0/1 | Agent | What situated whole is acting? |
| #0 | Intent / Agent Expression | Why am I here? |
| #1 | Skill | What can I do? |
| #2 | Method | How do I act for this kind of undertaking? |
| #3 | Methodology | How do I orient among possible ways of acting? |
| #4 | SkillSet | What repertoire do I carry here? |
| #5 | World | What whole operative environment do I inhabit and participate in? |
| 5 -> 0 | Return | What changed, and which earlier determination is pressured or renewed? |

This is a read-model and authoring grammar over native owners, not six new stores.

### #0 — Agent Expression

Use the existing Central AgentProfile / Agent expression relation as the durable authored pole.

It may carry identity, purpose, intent provenance, World relation, governance, selected SkillSets and other durable refs. It is not a runtime prompt dump.

The preferred authored Agent relation should become small:

    Agent identity
    + intent / purpose
    + selected SkillSet refs
    + World relation
    + specific explicit exceptions where genuinely needed

Do not make people enumerate every Skill individually for ordinary Agent creation.

### #1 — Skill

A Skill remains reusable organised intelligent praxis.

It answers a determinate faculty question: research, source navigation, domain modeling, HTML document craft, architecture authoring, verification, etc.

### #2 — Method

A Method remains the same Skill identity classified by a `METHOD:` description prefix.

It expresses reusable situated/compositional praxis: how relevant Skills, Actions, capabilities, sources and verification/Return relations are brought together for a class of work.

Method is not a new ResourceKind and is not a universal sequencing DSL.

### #3 — Methodology

Add a sibling `METHODOLOGY:` classification over the same Skill identity/lifecycle.

A Methodology expresses field-level praxis:

- the vocabulary and distinctions of a field;
- which kinds of determination exist;
- how they relate;
- which Methods and Skills apply in different situations;
- how attention/retrieval should be narrowed;
- how verification and Return propagate.

Wayfinder and Documentation Field are the two immediate major Methodology candidates in this programme.

### #4 — SkillSet

SkillSet is the normal repertoire carried by an Agent.

It is additive and nestable. It can contain Skills, METHOD-classified Skills, METHODOLOGY-classified Skills and child SkillSets.

Membership does not imply invocation, loading, authority, trust or precedence.

The system should favour:

    Agent carries rich SkillSets
        !=
    Agent loads every member body

Descriptions/relations remain cheaply discoverable. Full bodies load progressively when Methodology/Method/undertaking selection requires them.

### #5 — World

World is the full operative environment in relation to which the Agent becomes situated:

- Projects and source;
- knowledge and history;
- other Agents and Agencies;
- authority;
- capabilities and Actions;
- tools and MCP servers;
- harnesses and models;
- sessions;
- Workcells and material locations;
- SharedFields;
- network/provider/environment relations;
- current work and Return routes.

The latest O:I World-inhabitation work means this must be grounded in the real multi-Workcell/SharedField relation rather than flattened into one local context bag.

---

## 2. Constitutive involvement and external attribution

Preserve the distinction:

    authored source
        -> situated involvement
        -> Return
        -> observation
        -> attribution
        -> possible Recognition

A Skill existing or being carried does not prove it constituted an act.

The system must be able to distinguish at least:

    exists
    eligible
    available
    selected
    projected
    loaded
    invoked
    materially relied upon
    returned result
    verified result

Likewise, an observer seeing successful behaviour must not be treated as direct evidence that a particular Skill, Method, context source or internal determination caused it.

Self-disclosure should expose actual operative composition where available. Activity/evidence supplies the complementary outside observation.

This is the practical reason the Agent self-disclosure surface matters.

---

## 3. First-class Agent self-disclosure

Provide one coherent projection over existing AgentProfile, SkillSet/ContextResolution, Activity/Return and World state.

A human or Agent should be able to ask:

- **Why am I here?** — Agent expression / purpose / current Focus.
- **What can I do?** — effective Skills and capabilities.
- **How do I work?** — relevant Methods.
- **How do I orient?** — available/selected Methodologies.
- **What do I carry?** — authored and effective SkillSets.
- **Where am I?** — World / Project / Workcell / session / source horizon.
- **Who else is here?** — Agents, Agencies, participants, owners.
- **What is operative now?** — selected/loaded/invoked praxis and context.
- **What changed?** — Activity / Return / evidence.
- **Where does it go back?** — receiving source, Wiki, Factory, NOW, owner or human Recognition.

The original compact language remains first class:

    where am I?
    what do I carry?
    who else is here?
    what changed?
    what can I do?
    where does this go back?

Do not require each `SKILL.md` to reproduce those headings. Compose the disclosure from native records.

---

## 4. Core developmental repertoire and Wayfinder

Recover rather than reinvent the previously established core developmental repertoire:

- writing-great-skills;
- wayfinder;
- grilling;
- research;
- prototype;
- domain-modeling.

Current AIKit first-party praxis has absorbed or renamed some functions through `operation`, `knowledge-navigation`, `product-understanding`, `skill-authoring`, `meta-harness-craft`, `verification` and others. Do not assume that semantic overlap authorises deletion of the earlier repertoire.

Find the actual current source and reconcile identities/roles.

The expected classification to test against the bodies is:

| Praxis | Candidate form |
|---|---|
| research | Skill |
| domain-modeling | Skill |
| writing-great-skills / current successor | Skill |
| grilling | Method |
| prototype | Method |
| wayfinder | Methodology |

Do not force a classification whose body does not support it.

### Wayfinder as Methodology

If the source supports the reading, Wayfinder should own developmental orientation:

- originating intent;
- the whole undertaking;
- development topology;
- dependencies;
- native owners;
- work packages;
- current frontier;
- relevant documentation/source field;
- implementation paths;
- acceptance/evidence;
- Return and map revision.

Factory should consume Wayfinder Methodology rather than copying its logic into every Factory Skill.

Wayfinder is not "make a plan". It is the maintained field through which development stays answerable to the original whole while reality changes.

---

## 5. Documentation repertoire and Documentation Methodology

The documentation system is the first major Methodology-shaped repertoire built on the general praxis architecture.

Promote/reconcile Central `skills/docs-methodology/SKILL.md` as:

    METHODOLOGY: Documentation Field ...

Its field is:

    Authored Ground
        -> Vision
        -> Design
           -> Mockup
           -> Architecture
               <-> Diagrams
        -> Capability relations
        -> Implementation
        -> Evidence
        -> Return
        -> upstream pressure / recognised revision

These are roles, not a compulsory count of files.

### Primary document Skills

Implement/reconcile:

**vision-authoring**  
Primary experiential carrier: HTML.  
Owns the authored whole: why the product exists, what it is for, intended experience, meaningful distinctions and direction.

**design-authoring**  
Primary carrier: Markdown.  
Owns deliberate experience, interaction, behaviour, state, information structure, journeys, visual relation and design determinations.

**ui-mockup-authoring**  
Primary experiential carrier: standalone HTML.  
Owns encounterable projections of Design: screens, surfaces, state, interaction, transitions, responsive conditions, failure/degraded conditions and direct manipulation.

**architecture-authoring**  
Primary carrier: Markdown.  
Owns structural contracts, boundaries, ownership, components, state ownership, interfaces, lifecycle, data flow, integration, invariants and implementation-facing obligations.

**diagram-authoring**  
Primary source: Mermaid `.mmd`.  
Owns visual articulation of bounded structural questions: context/topology, sequence, state, data/information flow and dependency. Rendered SVG/PNG/HTML remains projection.

### Existing composing Skills

Reuse rather than copy:

- product-understanding;
- knowledge-navigation;
- structured-account-authoring;
- html-account / successor HTML document craft;
- documentation-standing;
- capability-matrices;
- projection-authoring;
- verification;
- skill-authoring.

---

## 6. Documentation Methods

Provide Method-classified praxis for recurrent movements, without making them mandatory pipelines.

### Product / major capability

    Ground
    -> Vision
    -> Design
    -> Mockup and/or Architecture
    -> capability reconciliation
    -> implementation
    -> evidence
    -> Return

### UI refinement

    relevant Vision grain
    -> Design
    -> Mockup
    -> capability/Architecture where required
    -> implementation
    -> experiential verification
    -> Return

### Architecture development

    relevant Vision / Design
    -> Architecture
    -> diagram where useful
    -> capability reconciliation
    -> implementation
    -> verification
    -> Return

### Evidence-led repair

    evidence
    -> identify nearest pressured determination
    -> implementation / architecture / design / vision
    -> repair
    -> re-verification
    -> Return

### Documentation reconciliation

    changed source or evidence
    -> affected relations
    -> relevant authoring Skill(s)
    -> capability/Wiki reconciliation
    -> verification
    -> Return

### Reverse recovery

    authored fragments + history + implementation + evidence
    -> product-understanding
    -> candidate Vision/Design/Architecture
    -> appropriate Recognition
    -> established source field
    -> capability/Wiki reconciliation

### Experimental development

    authored question
    -> bounded relevant source
    -> Design / Mockup / Architecture candidate
    -> prototype / implementation
    -> evidence
    -> returned understanding
    -> appropriate upstream proposal

---

## 7. Wayfinder and Documentation Methodology are parallel

Do not create one universal super-workflow.

For substantial product work:

**Wayfinder Methodology** answers:

- what developmental field are we in?
- what is the current frontier?
- who owns the work?
- what dependencies and evidence matter?
- what work should happen next?

**Documentation Methodology** answers:

- what representations carry the meaning?
- which Vision/Design/Mockup/Architecture grains matter?
- what document relations are pressured?
- what should be returned into authored source?

A Factory developmental Agent can carry both.

A normal act can therefore resolve:

    Agent / intent
        -> core-development SkillSet
            -> Wayfinder Methodology
        -> documentation SkillSet
            -> Documentation Methodology
        -> current undertaking
        -> selected Methods / Skills
        -> narrowed source/context
        -> development
        -> verification
        -> Return to both fields where warranted

Small mechanical work should stop shallow and not ritualistically load either entire Methodology.

---

## 8. Jev and progressive disclosure

The rich repertoire and documentation field should not become context bloat.

Normal selection:

    Agent carries SkillSets
        -> compact descriptions and relations
        -> Methodology selection
        -> Method selection
        -> selected Skill bodies
        -> Knowledge/Jev relevance over source inventory
        -> exact source grains
        -> primary model context

For documentation work, expose a compact inventory containing enough information for relevance selection:

- source ref;
- revision;
- role;
- standing;
- scope;
- compact description/determination;
- relation refs;
- capability refs;
- unit ids / coordinates where present.

Jev may identify required, supporting, jointly required and irrelevant sources, and may report catalogue insufficiency.

The selected exact grains become prepared participant NOW context through the existing AIKit/Redis route where configured.

Warm context remains valid until a materially relevant source/dependency/capability/Return change invalidates it.

---

## 9. SkillSet portability and package SDK

SkillSet should be authored once and capable of becoming a native package in several agent ecosystems.

Canonical direction:

    native source-owned SkillSet
        -> portable package reading
        -> target adapter
        -> target-native plugin/package
        -> target validation / discovery evidence

The exported package never becomes the canonical SkillSet.

### Portable package relation

A package projection should be able to carry:

- package identity / name / description / version;
- source SkillSet ref and revision;
- exact member refs/revisions;
- Skills/Methods/Methodologies included;
- references, assets and scripts;
- tool / MCP dependencies;
- hook requirements;
- environment / credential requirements without secret values;
- compatibility;
- target-specific overlays;
- licensing / attribution where relevant.

### SDK / praxis

Create a reusable package/export SDK plus a Skill and Method around it.

The application operation should support approximately:

    inspect
    plan
    validate
    export
    diff
    verify

and a Method:

    METHOD: Export a SkillSet to a native agent package ...

The plan must expose what translates directly, what needs a target-native adapter and what the target cannot represent.

Do not silently discard unsupported semantics.

### Target families

Verify each live provider contract at implementation time.

Initial supported targets:

- portable OpenAI/Codex plugin package;
- Claude Code plugin;
- Pi package with ordinary Skills and executable TypeScript extensions where genuinely required.

Use native provider conventions. Do not turn every Pi Skill into an extension or every Claude SkillSet into commands/subagents merely because those package forms support them.

Target adapters should be extensible so new harnesses can implement the same package contract without changing SkillSet source.

---

## 10. #5 World as outward participation and citizenship

World is also the boundary at which an Agent becomes legible to other participants.

Build one native World-participation reading from existing owners rather than another Agent identity.

Conceptually it should be able to describe:

- Agent ref and World ref;
- expression / purpose;
- role in this World;
- residence / participation relation;
- selected SkillSets;
- publicly disclosed capabilities;
- supported interaction surfaces;
- authority summary;
- material/execution presence where relevant;
- Agent / Agency / Project relations;
- current availability;
- attributable contribution / Return history;
- recognition / acceptance / standing;
- disclosure boundary.

### Citizenship

"Citizenship" is the human-facing synthesis of established World participation.

Do not make one opaque scalar the native truth.

Expose inspectable dimensions such as:

- residence / presence;
- role / purpose;
- repertoire;
- reach;
- authority;
- relation;
- contribution;
- reciprocity / Return;
- verified reliability;
- recognition;
- continuity.

A UI can later derive a compact badge/status/summary. If a score is ever useful, it must be transparently derived from named components rather than becoming hidden authority.

### Human Agent Card

The Cradle/Buzz-style Agent creator and Agent surfaces should render a human Agent Card from the same native Agent/World reading.

A compact card should answer:

- who / why am I?
- what can I do?
- how do I work?
- how do I orient?
- what do I carry?
- where do I live/participate?
- what is my current World/citizenship?
- what am I doing now?

It should progressively reveal exact refs, SkillSets, praxis and World relations.

The card is a presentation, not an independently editable duplicate identity.

### A2A Agent Card

Generate standards-compliant A2A Agent Card projection from the same native reading when an Agent is exposed through A2A.

Public card disclosure is deliberately narrower than internal repertoire:

    internal SkillSet != public A2A skill/capability disclosure

Human Agent Card and A2A Agent Card are two projections from the same Agent/World relation, not two separately maintained profiles.

---

## 11. HTML as the experiential document medium

The desktop needs an explicit product policy:

> Cradle is the stable habitat. Crafted HTML documents are first-class experiential bodies inside that habitat.

Do not implement every meaningful experience as permanent React application chrome.

The shell owns common application responsibilities:

- navigation;
- tabs/panes/workspace state;
- source identity;
- file operations;
- Agents;
- Run;
- Context;
- permissions;
- native commands;
- persistence;
- receiving;
- accessibility boundaries;
- process/material integration.

The HTML body owns the particular experiential character of the thing:

- visual composition;
- prose;
- imagery;
- stateful presentation;
- direct manipulation;
- embedded diagrams;
- interaction;
- motion where useful;
- bespoke art direction.

This is already partially real: Day and Flow are retained self-contained owner-supplied HTML forms with embedded structured payloads; Vision/Goal/Beings/Things/Epi-Card are in the form system; source opens through Central; document receiving exists; selection/context has an existing Wayfinder and implementation.

Develop that relation rather than replacing it.

---

## 12. Shared Cradle Document Surface contract

Create or extract one small native host contract for experiential documents.

Do not give arbitrary document JavaScript unrestricted access to the desktop.

The host should provide bounded semantic operations approximately equivalent to:

### Identity

- current source/document ref;
- source owner;
- exact revision / dirty snapshot basis;
- document family/template lineage.

### Save

- persist through the native source owner;
- optimistic/stale revision protection;
- preserve exact authored payloads and unknown fields;
- distinguish template source from created document.

### Selection

- expose meaningful semantic selections;
- preserve exact source range / semantic unit identity;
- never imply dispatch merely because text was selected.

### Context

- add/reveal/remove selected material in the existing Context plane;
- prepare participant-specific context;
- explicit reviewed send through the normal conversation.

### Agents

- address or summon allowed Agents relative to the document/selection;
- preserve actual Agent/session identity and authority.

### Receiving

- show source-bound material returned to this document;
- review/accept/reject/include through native owner operations;
- arrival never silently edits authored source.

### Relations

- navigate relevant Wiki/capability/source/document/Run relations;
- preserve exact source refs and provenance.

### History

- inspect meaningful source revisions and returned differences where native owners expose them.

### Export / Projection

- standalone portable export where the form supports it;
- audience-filtered Projection stays distinct from full-copy export and canonical source.

### Document bridge law

The host bridge must remain small. An HTML form should not reimplement Central, AIKit, Actuation, Factory or Workcell.

---

## 13. Source, experience, relations and history

Every experiential document can be understood through four dimensions:

**Source**  
Exact underlying bytes / structured authored payload.

**Experience**  
The HTML form through which the person encounters and manipulates the thing.

**Relations**  
Context, Agents, capabilities, Wiki, Run, receiving and other linked objects.

**History**  
Revisions and returned differences.

Do not force these into four visible tabs.

The normal path should favour the experiential authored surface. Source mode is available when appropriate. Relations emerge through the existing Run / Agents / Context accompaniment and document-specific controls. History appears where it serves the act.

Generic arbitrary HTML may still need source editing. Do not lossily serialize arbitrary documents through contenteditable.

---

## 14. Experiential document families

The current roster already includes or retains:

- Flow / Dialogue / Journal;
- Day / 4+2;
- Beings;
- Things;
- Epi-Card;
- Goal;
- Vision;
- retained/withdrawn Yoshimoto source.

This programme adds UI Mockup as a first-class project documentation family and may later add other forms.

These are not forced into identical visual shells.

Commonality lives in document identity, state/provenance and host bridge.

Their art direction can remain distinct:

**Day** — temporal/orienting field.

**Flow** — conversational, reflective and evolving.

**Vision** — editorial, spatial, visual, aspirational but precise.

**UI Mockup** — looks and behaves like the proposed experience.

**Beings** — presence, identity, relation and World.

**Things** — subject/work/collection and relation.

**Agent human presentation** — outward expression of Agent/World participation.

The value of HTML is exactly that these forms can be beautiful and idiosyncratic while remaining native citizens of the same application.

---

## 15. Project documentation shape

The default project documentation medium should become intentionally opinionated without becoming mandatory.

A healthy rich Project may contain:

    Vision HTML
    Design Markdown
    Mockups/*.html
    Architecture/ARCHITECTURE.md
    Architecture/*.mmd
    capability matrix
    implementation
    evidence / Returns

This is not an adoption gate. Small/ordinary Projects remain valid without every form.

The Documentation Methodology chooses the smallest sufficient field for the undertaking.

### Human creative attention

Vision and Mockup are especially important human Recognition surfaces.

Vision is the authored experiential whole.

Mockup is where Design becomes directly encounterable before implementation.

Day and Flow are the person's temporal/dialogical authored surfaces.

These are appropriate places for high human creative investment because they preserve wording, image, movement, relation and aesthetic judgement instead of translating intention immediately into tickets/configuration.

Architecture and Design remain precise textual sources rather than being forced into HTML for symmetry.

---

## 16. Direct manipulation

Do not reduce "HTML authoring" to source-code editing.

Where the form supports semantic editing, the person should be able to interact directly with the authored body.

Examples:

### Vision

- click and edit prose;
- manipulate imagery;
- move/reorganise meaningful sections where the form permits;
- open embedded Mockups;
- select a determination and ask an Agent to develop or investigate it;
- inspect related Design / capability / implementation Return.

### Day

- capture thoughts;
- manipulate entries;
- receive and review contributions;
- connect to Flow / Goals / NOW;
- preserve the original Day payload and visual form.

### Flow

- write and converse;
- select passages;
- collect media/notes;
- receive Agent contributions;
- turn a determination into a Goal/Vision/work item through explicit native operations.

### UI Mockup

- operate the actual proposed controls/state;
- switch relevant states;
- annotate a specific component or transition;
- select that state into Agent context;
- connect it to exact Design and capability refs.

Do not make every form into a page-builder. Direct manipulation should follow the semantic object the form owns.

---

## 17. Run / Agents / Context around the document

Keep the established right-hand accompaniment.

For the currently open experiential body:

**Run**  
What development/action is happening relative to this thing?

**Agents**  
Who is participating, available or addressed relative to this thing?

**Context**  
What source/selection/relation is cognitively prepared relative to this thing?

The document itself remains central.

Do not replace the experiential body with a giant inspector or move document-specific work into generic sidebars.

State management should retain open documents, local view state and relevant selection across mode changes/restarts according to the current workspace continuity architecture.

---

## 18. HTML document craft Skill

Refine `html-account` or introduce the smallest coherent successor/common Skill so higher-level document Skills do not independently reinvent interactive HTML.

The common craft should own:

- self-contained portable HTML where appropriate;
- responsive, accessible presentation;
- structured embedded state;
- semantic addressability;
- direct manipulation hooks;
- source/revision identity;
- host-bridge integration;
- selection/context;
- receiving;
- safe asset handling;
- standalone export;
- rendering/projection distinction.

Higher Skills supply domain meaning:

    vision-authoring
    ui-mockup-authoring
    Day / Flow form-specific praxis
    Beings / Things
    Agent presentation
        -> shared HTML document craft

Do not collapse all form-specific meaning into the common HTML Skill.

---

## 19. Ownership map

| Concern | Native owner | Consumer / projection |
|---|---|---|
| human-authored ground / AgentProfile / source identity | Central | AIKit, O:I/Cradle |
| Agent/Agency/authority/Activity/Return semantics | Actuation | O:I/Factory/AIKit |
| Skills, Method/Methodology classification, SkillSets, ContextResolution, package export | AIKit | harnesses, Factory, O:I |
| developmental Run / Commission / evidence / Wayfinder use | Factory | O:I desktop / Agents |
| material body / Workcell / provider execution | Workcell | World / Agent participation |
| formal QL definitions where genuinely operational | QL-MEF | optional praxis/docs relations |
| whole-field composition and Cradle presentation | O:I | human/Agent surfaces |
| document source standing / matrices | Central + document's native Project | Documentation Methodology |

Do not move source ownership merely because O:I renders the joined experience.

---

## 20. Implementation work packages

### APD-W0 — Current-cut reconciliation

Before implementation, record current exact sources and revisions for:

- AgentProfile;
- Agent/World/SharedField inhabitation;
- AIKit Skill/Method/SkillSet;
- current core developmental Skills;
- O:I Guardian repertoire;
- document forms and source bridge;
- canvas/editor/context;
- receiving;
- workspace persistence;
- Factory Wayfinder/development praxis;
- package/harness adapters.

Resolve contradictions in operative prose against actual owner decisions and code.

Exit: a bounded source-to-owner ledger sufficient to build without inventing duplicate structures.

### APD-W1 — Praxis classification and disclosure

Implement/reconcile Skill / METHOD / METHODOLOGY classification in AIKit with ordinary Skill identity.

Restore the first-class self-disclosure relation over existing source/resolution/activity state.

Exit: a real Agent can disclose #0–#5 and operative use without claiming that carried repertoire was loaded or invoked.

### APD-W2 — SkillSet repertoire and nesting

Finish native authored/persisted nested SkillSets if current core support is not exposed end to end.

Prefer AgentProfile -> SkillSet refs for new default authoring.

Recover the core developmental repertoire and classify Wayfinder from actual source.

Exit: one Agent carries core-development + documentation repertoire without copying all member lists or loading all bodies.

### APD-W3 — Documentation Methodology and form Skills

Promote/reconcile Documentation Methodology.

Implement/reconcile Vision, Design, UI Mockup, Architecture and Diagram authoring Skills and the initial Methods.

Bind templates and exact form carriers.

Exit: the Methodology can select different bounded document fields for a UI task, architecture task and small code fix.

### APD-W4 — SkillSet package SDK

Implement neutral package model, exporter Skill/Method and target adapters for OpenAI/Codex, Claude Code and Pi.

Use actual current provider package contracts.

Exit: the same source SkillSet exports to all three targets with exact source/member revisions and explicit unsupported relations.

### APD-W5 — Agent World participation, cards and citizenship

Join Central AgentProfile, Actuation/World state, AIKit repertoire and material presence into one World-participation read model or nearest correct existing owner seam.

Render:

- human Agent Card for current Agent/Guardian/Buzz-style creator;
- A2A Agent Card when externally exposed;
- multidimensional citizenship/participation summary.

Exit: both cards derive from one Agent identity and internal SkillSet members do not leak merely because they are carried.

### APD-W6 — Shared experiential Document Surface host

Extract/implement the bounded host contract over the existing source/material/editor/context/receiving architecture.

Do not create a parallel document store.

Exit: at least two existing forms use the same semantic bridge for identity, save, selection/context and receiving while retaining distinct appearance.

### APD-W7 — Vision and UI Mockup first vertical

Make Project Vision and one UI Mockup the first project-document proof.

Vision: real project source, human-editable experiential HTML, direct semantic selection and related-document navigation.

Mockup: real standalone HTML, state/interaction, annotation/selection and relation to Design/capability source.

Exit: edit Vision -> select a determination -> send to Agent -> develop/update Mockup or downstream source -> returned material arrives against the originating source and can be reviewed without silent mutation.

### APD-W8 — Day / Flow integration

Bring the already-supplied Day and Flow forms through the same host contract without flattening their payloads or rebuilding their designs.

Preserve all existing Day/Flow acceptance obligations.

Exit: edit/save/export/reopen, selected context and receiving use the common bridge while exact original form semantics remain.

### APD-W9 — Project document relations

Bind Vision / Design / Mockup / Architecture / diagram / capability / implementation / evidence through existing SourcePool/SemanticWiki/ProjectMap relations.

Do not create a new document graph.

Exit: traverse both directions from a Vision determination to implementation/evidence and from implementation/capability back to the relevant authored reason.

### APD-W10 — Factory developmental join

Use Wayfinder + Documentation Methodology together in one actual Factory undertaking.

Wayfinder selects developmental topology; Documentation Methodology selects the representation/source field; AIKit/Jev narrows context; Factory develops; verification returns evidence.

Exit: no human relay between separate "planning", "docs" and "coding" Agents is required for the ordinary joined path.

### APD-W11 — Installed/local acceptance

Run the actual local Cradle against current installed products/harnesses.

Prove workspace persistence, HTML interaction, source saving, Agent context, real provider turn where authorised, receiving, package export/discovery and Agent Card/World reading.

Human experience remains separately reported by the person.

Exit: useful lived local vertical, not merely source/fixture green.

---

## 21. First executable vertical

Do not begin by implementing every document form or package target UI.

The first joined vertical should be:

1. Open a real Project Vision HTML in Cradle.
2. Edit a meaningful Vision determination directly in its experiential surface.
3. Save through the actual Central/Project source owner with revision protection.
4. Select that exact determination naturally.
5. Add it into existing Context without invoking a model implicitly.
6. Address an Agent carrying the core-development and documentation SkillSets.
7. Agent self-disclosure shows relevant World/repertoire and selects Wayfinder + Documentation Methodology without loading the entire corpus.
8. Knowledge/Jev resolves only the relevant Design/Mockup/Architecture/capability grains.
9. Commission one concrete UI refinement.
10. Open/manipulate the resulting real UI Mockup HTML inside the same document host.
11. Carry the implementation through Factory/native owners.
12. Return evidence/material to the originating Vision/Mockup source relation.
13. Show it in the existing document receiving field.
14. Human reviews/accepts/rejects without automatic source mutation.
15. Reopen the Project and recover the Vision/Mockup/workspace state and relevant Agent/Run relations.

This one path exercises the actual architecture rather than separate demos.

Day/Flow then adopt the same host bridge without losing their existing form.

---

## 22. Acceptance cases

### APD01 — Praxis forms

Ordinary Skill, METHOD and METHODOLOGY are all ordinary Skill identities with one source/lifecycle. Detection is unambiguous; no Methodology ResourceKind appears.

### APD02 — Repertoire versus use

An Agent carries a SkillSet containing ten+ praxis members while only relevant descriptions and then two selected bodies enter the act. "Carried" is never rendered as "loaded" or "used".

### APD03 — Wayfinder

A substantial developmental commission selects Wayfinder Methodology. A small mechanical code fix does not automatically load it.

### APD04 — Documentation Methodology

A UI design undertaking selects Vision/Design/Mockup and relevant Architecture; a backend-local bug stops at local code/contracts/evidence when deeper sources do not bear on the question.

### APD05 — Jev bounded attention

Prepared relevance chooses exact source grains and can state catalogue insufficiency. Changing an unrelated document does not invalidate the participant preparation; changing a selected source does.

### APD06 — Nested SkillSets

Core-development + documentation + product repertoire compose without duplicating every member. A withheld child remains withheld.

### APD07 — Portable export

One real SkillSet exports to OpenAI/Codex, Claude Code and Pi. Exact source/member revisions survive. Provider-specific overlays remain derived.

### APD08 — Unsupported package relation

A target incapable of representing one hook/extension/MCP relation reports it in plan/receipt rather than silently dropping it.

### APD09 — Human Agent Card

The card derives Agent purpose, repertoire summary, World participation and current state from native records; editing display does not mint another Agent identity.

### APD10 — A2A Card

Public A2A Agent Card derives from the same Agent/World relation and discloses only intended external capabilities.

### APD11 — Citizenship

An Agent participating in two Worlds has two distinguishable participation readings. No global opaque reputation score silently replaces them.

### APD12 — Vision craft

Vision is directly editable as an authored experiential HTML document. The edit persists in its real source and survives reopen.

### APD13 — Mockup craft

Mockup interaction is live enough to encounter intended states. Selection/annotation addresses the exact state/element and links back to Design/capability basis.

### APD14 — Common host, distinct design

Vision and Day use the same source/context/receiving bridge while retaining materially different authored HTML experience.

### APD15 — No source collapse

Rendered/experiential surface, exact source, context selection, prepared model context, receiving proposal and accepted revision remain distinct states.

### APD16 — Return

A real development result returns to the originating document relation. Arrival is visible before adoption. Rejection leaves authored source unchanged.

### APD17 — Reverse provenance

From a changed implementation/capability the Agent can find the relevant Architecture/Design/Vision relation without inferring purpose solely from code.

### APD18 — Workspace continuity

Close/reopen/mode switch retains useful open document, view state, selection/context relation and associated Run/Agent references according to existing workspace policy.

### APD19 — Security

Arbitrary authored HTML cannot directly acquire filesystem, authority, credential or unrestricted desktop access. Host operations are explicit and bounded.

### APD20 — Independent verification

A fresh verifier can sever one key join (e.g. selection->prepared context, Return->document receiving, source->save, SkillSet->export) and the relevant acceptance fails rather than passing from cosmetic UI.

---

## 23. Local implementation rules

This Wayfinder is intentionally suitable for the local Mac development lane.

Follow the owner's simplified Git/worktree model currently in force. Do not reactively create one worktree per subagent. Use the existing bounded development worktree topology and one coherent feature line where possible.

Do not run competing app installs/builds from several worktrees against the same target. Keep one deliberate source-built candidate and one installed application state at a time.

Reuse current workspace/state/document/sidebars rather than building parallel shells.

Preserve active unrelated work and inspect dirty state before changing shared files.

Use local installed/provider/computer-use evidence for claims that require the real machine. Repository/controlled tests remain different evidence.

---

## 24. Required Return

The implementation Return should contain:

- exact starting and ending revisions per touched repository;
- source/ownership decisions actually used;
- reconciled core developmental repertoire and Wayfinder source;
- Skill/Method/Methodology implementation;
- Agent self-disclosure and SkillSet resolution;
- package SDK/export evidence;
- Agent World/citizenship/card integration;
- documentation Methodology and authoring Skills;
- shared experiential Document Surface host;
- first Vision -> Mockup -> development -> Return vertical;
- Day/Flow adoption of the host relation;
- tests actually executed and their evidential scope;
- remaining gaps by owner;
- exact next action.

Update this Wayfinder when returned reality changes the developmental topology. Do not preserve a false plan merely because it was authored first.

The completion target is a Cradle in which the person can author the World through beautiful, manipulable documents, an Agent can inhabit that World through a small intelligible repertoire and progressive context, and development can move between the two without losing source, ownership, evidence or Return.
