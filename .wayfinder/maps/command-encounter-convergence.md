# Command encounters, terminal work and usable Agent creation

Standing: owner-commissioned design and local implementation Wayfinder, 25 September 2026. Planning only: no runtime implementation, install, live provider proof or human acceptance is claimed by publication.

Classification: [command-encounter-classification.md](command-encounter-classification.md). It classifies every one of the 76 current AIKit root commands and the other native command families, including leaf exceptions and compatibility treatment. Do not repeat that design as a prerequisite to coding; reconcile only genuine source/local deltas.

Containing work: O:I #65 for whole-product experience/proof and #220 for native joins. Continue `.wayfinder/maps/agent-praxis-document-world.md`, the existing terminal design in AIKit `docs/v2/23-TUI-HUMAN-EXPERIENCE-SPEC.md`, O:I's accepted Factory/Agency and session-grounding work, current configuration-plane/state/context work and the native Agent creation implementation. This is a bounded convergence track within that work, not a new platform or replacement campaign.

Upstream authored ground: `docs/positions/FOUNDING-POSITIONS.md` and `docs/positions/PRAXIS-AND-OPERATIVE-LANGUAGE.md`.

## 0. The intended difference and the evidence already present

The owner wants the system to be sensible, functional, clean, simple and usable at the point of encounter. A person or Agent should recognise what it can do, find appropriate practice, shape an Agent's operative World, enter or continue real work and understand the result without first learning a directory of implementation seams.

Three coordinated lanes deliver that difference:

- **A — Native command language:** AIKit and the other five owner CLIs, contextual action discovery/invocation, executable praxis support and required owner-native lifecycle joins.
- **B — Terminal experience:** one ordinary terminal application with World orientation, universal search, composition, Direct/Factory work and useful recovery.
- **C — O:I and desktop:** the containing CLI/application affordances and the existing desktop Agent creator/card/conversation path, using the same underlying operations as A and B.

One local coordinator owns the common contract, mutable-file claims, integration, builds/installation and final evidence. At most three direct workers. No recursive fan-out.

### What the source inspection established

AIKit's current `cli.rs` contains the owner's 76 peer command heads. Native operations, human navigation, authoring and callbacks are mixed in the same first help screen. The underlying stores and services do not need replacement to repair this organisation.

The existing TUI already has one `ApplicationSurface`, `TuiState`/runtime and shared relation projections. `ApplicationSurfaceRequest::new` already selects `WorkspaceSection::Worlds`. The task is to finish the usable default experience and actual integrations, not claim that Worlds or a unified reducer are missing or simply add another startup tab.

The desktop's `MintAgent.tsx` routes reusable Agents to `NativeAgentLauncher`; temporary/team formation uses a separate form. The reusable path already calls native roster, proposal, review, exact acceptance and Direct-session preparation operations. Its current draft and request types carry individual `skillRefs`/`skill_refs`; the launcher displays individual Skill checkboxes and then hands a prepared AgentSession to conversation/harness selection. The temporary/team form still renders explicit unavailable Start/change-session/grant rows. These are specific places to continue native work, not evidence that all Agent creation is a mock.

The creator controller already preserves critical distinctions: source revision and digest, acceptance matching the reviewed source, preparation with `provider_started: false`, and ambiguous-write recovery without blind replay. Keep and extend those protections. The proposed simpler experience must finish the lifecycle without falsifying any of those states.

O:I already has sparse World profiles, a configuration plane, product executable resolution, a kernel/application boundary and native Agent participation/human/A2A card composition. Reuse them. O:I's `setup_terminal.rs` is a bootstrap/setup interaction, not a second full work application. Keep bootstrap usable when AIKit is absent; do not make installing AIKit a dependency of the installer.

AIKit's `alias` command concerns user-authored harness/model/profile/place command families. These are not just fuzzy-search aliases or learned familiarity. Preserve them as a discoverable composition feature.

These observations are source facts. The owner's installed build, local uncommitted work and actual provider experience must be checked locally before repair. A newer source may already close an observed gap; prove and consume it instead of overwriting it.

### Non-goals

Do not build another Action registry, World/Agent/NOW store, workflow DSL, daemon, remote transport, credential store, context index, state manager or terminal chat engine. Do not rewrite the desktop shell, mode structure, Day/Flow documents, QL ontology or the current Git/install machinery. Do not turn this into a wholesale module relocation. Do not require all six products, Redis, Jev, QL or a Gateway for basic standalone AIKit operation.

## 1. The common encounter

### 1.1 Ordinary CLI and structured entry

Implement the classification's compact AIKit and O:I root groups. Their exact listed target paths are design decisions, not a claim that those paths already exist. Existing spellings remain same-handler aliases during migration.

The ordinary discovery sequence is:

    orient in the actual World
      -> search for a thing or an undertaking
      -> inspect its relevant Actions or praxis
      -> obtain the exact invocation contract
      -> perform an explicit act
      -> read back the owner result and next useful action

Bare interactive AIKit/O:I may enter the shared terminal experience only when the relevant terminal streams are actually TTYs. Explicit `ui` remains available. Bare `--json` returns one bounded structured orientation reading and never opens a TUI, prompts, consumes stdin as a request, launches a provider or changes durable state. A bare non-TTY text invocation prints bounded noninteractive orientation/help and exits. Help/version never cause setup or discovery side effects that mutate source/state.

Reuse AIKit `whoami`, `status`, `refocus` and O:I `current-world`/participation readings. Their meanings differ: combine by reference where appropriate, do not declare one existing schema to mean something it did not. Default orientation shows the current World/Project/purpose/NOW/session where known, selected repertoire, active work, pending attention and a few available next actions. Degraded or missing readings are named, not collapsed into an empty list. Detailed traces are opt-in.

Do not compute this reading by serially probing every remote provider. Use the established local/context read model and cached native availability; disclose its age and update explicitly/asynchronously.

### 1.2 Search, aliases and actions

Keep the existing shared resolver and operative-expression grammar. Do not invent a natural-language execution parser. Search is inert: no work launch, generation, source mutation, invocation observation or trust change. Index search destinations, relevant Actions, Skills/Methods/Methodologies, SkillSets, World resources and user command-family entries through their existing descriptors.

Search results must explain what becomes possible, not only name a resource. A bounded result should carry the canonical ref/type, useful outcome, owner/source, current availability or reason unavailable, and the next inspect/describe/action route. Display names and aliases never become identity. Subject-specific Actions must retain their actual subject; an ActionRef alone is not always an executable request.

Preserve three alias classes: compatibility spellings; resource handles/aliases/familiarity; authored command families. Let a user find, inspect and compose a command family without requiring them to learn the alias implementation first. Do not bake newly named convenience shell functions into Rust or let fuzzy matching select arbitrary shell text.

Add or complete a thin `act` doorway over existing contextual Action invocation. It must support discovery for a subject, describing the exact input/output/effect contract, and explicit invocation. The coordinator records the precise CLI spelling and schema binding during E0; it is one transport over existing owner operations, not a new registry. Reuse existing `action run`, `action invoke` or application handlers underneath. Keep the exported-capsule `run` path distinct until an actual adapter proves equivalence.

For mutation, resolve the exact action plus subject and input; bind the actual context/authority; apply current stale-revision checks; invoke the native owner once; return its real outcome. Do not shell-evaluate labels, search strings or arbitrary schema strings. Where the existing boundary uses a CLI child process, use resolved executable plus an argv vector and controlled stdin; where an application service exists, call it directly.

A search hit can be inspected even if not currently runnable. Describe why and offer the real setup/permission/capability route. No automatic grant, trust decision, bypass or installation is part of search or action discovery.

### 1.3 A creator that produces an operable Agent

Use the same compact interaction in terminal and desktop, adapted to host geometry:

**Purpose and place.** Start with the person's exact purpose and an optional/appropriate name, the currently selected Project/World and whether this is a reusable Agent, temporary help or a reusable team. Current legitimate defaults are visible and editable. Do not make every person type native refs or reconstruct their root World.

**Repertoire and capabilities.** Select existing SkillSets first. Show nested membership, description and source, then allow individual Skill/Method/Methodology exceptions. Search should answer what the repertoire enables. Governance, information, harness/model, runtime/Workcell, workspace/NOW and target details remain available as focused refinements, not a mandatory ten-page form. Retain all distinctions in the accepted ten-part composition specification; simplify their presentation, not their semantics.

**Review and enter.** Present purpose, repertoire, relevant information, World/Project, actual harness/model, material location, continuation relation, scope, effects and blocking conditions. Separate source authored by the user from resolved defaults and suggestions. Show what will be saved, accepted, projected, loaded next-session or activated live. A source change invalidates the relevant preview; it does not silently overwrite the draft or mutate an existing session.

The primary actions can be **Save Agent** and **Save and start Direct work**. **Start Factory work** remains an explicit separate developmental choice with Commission/evidence inputs. For an already accepted Agent, use **Start** or **Continue**. Do not keep five coequal implementation-step buttons merely because the operations are semantically distinct.

A compound Save-and-start is allowed only after the review clearly names its component effects and scope. It calls the current native save/accept/prepare/launch operations in order and does not manufacture authority. Where authority is absent, surface the real request/authorisation decision. Authoring acceptance and execution permission remain separate even when presented in one coherent flow.

Source saved is not running; preparation is not a started provider; projected is not loaded. If launch fails after save, report **Saved; not running**, preserve the Agent, name the failing stage and resume that stage only. Do not roll back accepted human source merely to make a multi-owner flow look atomic. Carry the native request/receipt IDs and recover an uncertain outcome before retrying.

### 1.4 What Start and Continue must actually do

Start must resolve and validate the intended Agent/AgentProfile, World/Project, selected repertoire and information policy, scope/authority, current work/NOW relation, SessionSpace and target. It then uses the existing owner launcher/Encounter route to start the actual body and opens/focuses the resulting conversation or terminal projection. Required grounding must be bound before provider dispatch, not after the first turn.

Use Central for authored source and temporal ground, AIKit for composition/context/session, Actuation for agency/authority/occupancy, Workcell for material placement, and Factory only when developmental work was commissioned. Preserve these identities and their references; do not use a pane ID, PID, model name or Profile label as Agent identity.

NOW selection must be a meaningful existing owner operation, not `now-context prepare` renamed as entry to a World. Do not implicitly create/roll a human Day. Where an operation requires a bounded child NOW, use the current native binding procedure and retain its Return address. Standalone non-O:I sessions stay legitimate without invented Central records.

Continue distinguishes: focus an existing live projection; attach to a running native session; resume via the harness's supported protocol; rehydrate into a fresh body; explicitly re-place on another Workcell. The UI can present a simple choice and useful default, but the result must disclose which actually happened. Preserve Direct versus Factory ancestry.

Temporary help must not silently become a durable Agent. A team must use the existing team/Agency composition rather than a new JSON array that only looks like a team. Where a target cannot support the requested form, report its specific unsupported operation rather than a generic demo card.

### 1.5 Terminal and desktop behaviour

One ordinary terminal application: AIKit's current ApplicationSurface/reducer is the starting implementation. `oi ui` supplies the composed World through the established owner/provider boundary; standalone `aikit ui` operates over what is actually available. There is no separate O:I work-TUI controller. Bootstrap setup remains a specialised lifecycle interaction until the terminal application can host it without breaking minimal installation.

The default terminal view must tell the user where they are and present a small set of meaningful actions: Continue, Start Direct work, Start Factory work, Compose Agent, Search/Explore, and Repair where needed. Existing Worlds/Compose/Work/Knowledge/History/System destinations remain. Search/Context/Explain are ambient. Lists are supporting views, not the entire product.

The desktop keeps its existing mode/workspace/Agents/Run/Context structure. Simplify the existing creator and card surfaces rather than adding another mode or global layout. Reuse current context/state/draft infrastructure, HTML/document hosts and native kernel bindings. Cards show exact purpose, carried and operative repertoire, where the Agent participates, current activity and useful actions. Metadata/source/revision/authority details remain accessible without dominating the card. Human and A2A cards continue deriving from native participation; A2A export/publication is never automatic from Save.

## 2. One shared operation contract, existing owners

### 2.1 E0 contract decisions

The coordinator freezes a small consumer-facing table for the first vertical slice. For each required operation record:

- existing owner Action/operation and subject type;
- exact input and output schema/ref and any native request/receipt key;
- source revision and observed availability;
- effect timing: read, source edit, projection, preparation, launch, live change or next-session;
- authority/preflight/stale-write rules and refusal/recovery route;
- CLI binding, terminal action and desktop/kernel binding;
- existing implementation/test and the bounded gap being assigned.

This table is maintained development evidence, not another runtime registry. Generate runtime discovery from the native parser/command table/Action descriptors plus the minimum missing authored descriptions. O:I aggregates or adapts owner contributions; it does not hand-maintain a replacement list of every leaf. Static capability matrices/source snapshots remain distinct from installed and currently eligible operations.

Do not normalise every owner's JSON envelope in this track. Preserve native passthrough exactly. A composed O:I operation can have a small containing result which retains native sub-results and classifies success, refused, unsupported, unavailable, cancelled or outcome-unknown. A zero child exit alone does not establish domain success; a parseable error JSON is not success. Preserve structured owner refusals on their documented stream and never silently substitute a different executable after a receipt fails.

### 2.2 Executable support for praxis

Keep Skill, Method and Methodology on the current Skill identity/lifecycle. Method/Methodology classification is not a new ResourceKind. A SkillSet is a repertoire, not a workflow engine; a Routine is repeatable invocation over an eligible/proven Method, not every act of reading one.

Use existing capsule/script/tool/hook support and the current Method/Routine native runner or Encounter runner. A deterministic helper belongs with its source-owned praxis package, with its inputs, required owner operations, preflight, expected outputs and validation. Resolve assets relative to the installed package/source rather than an assumed caller working directory. Do not copy logic into three UI callbacks or export absolute developer paths/secrets.

Automate the mechanical obligations: validate required refs and revisions; prepare bounded inputs; call the named owner operations; collect exact outputs; check postconditions; return a native evidence/receipt link. Keep judgement and authored prose with the Agent/human. A script exit cannot prove that the Agent reasoned correctly, used every instruction or produced a semantically adequate result. Verification checks the returned result separately.

Use at least two existing relevant practices as vertical tests: composition/projection and verification/close-out. Bind to the actual registered Method/Skill refs found locally; do not invent a capability because an example has a convenient name. Keep package exports to Claude/Codex/Pi intact by reusing current SkillSet packaging; this track is not another plugin exporter project.

### 2.3 State, latency and failure

One semantic operation can have different host renderings. Share stable refs, request/result/effect semantics and native source resolution, not React component state or Ratatui layout state.

Where a required headless trait is currently located in a terminal crate, move only the shared contract to the existing lower application/core layer as a bounded A task. Do not make the desktop depend on a terminal renderer, and do not create a new universal framework crate by default.

No network/provider discovery, catalogue reindex or suite-wide hashing on each keystroke/render. Reuse existing caching and invalidation. Search can present fast exact/local results before an explicitly indicated slower enrichment; late/cancelled results cannot replace a newer query. Provider failures must be independently visible, not block unaffected choices. Drafts and selected context survive refresh, mode changes and the existing supported restart persistence path without leaking between Projects or participants.

Adopt provisional local interaction budgets: first loading/feedback within 100 ms; cached local filtering/selection p95 within 100 ms on a recorded representative catalogue. These are design targets, not measured claims. Record the machine, catalogue and actual numbers, separate external provider time, and amend only with an explicit reason. Structural checks require zero provider calls or projection writes per ordinary keystroke and no stale query replacing current results.

## 3. Bounded implementation packets

These packets are execution units, not three independent redesigns. Use the existing Wayfinder methodology and atomic-task/atomisation Method. For an external local subagent choose its actual prompt-export path; where native Factory/NOW execution is already operative, use that path and its canonical custody. Do not maintain both a private task list and a competing Factory truth. Bundle two to five adjacent atoms only where owner, context and write locality make that useful.

Every packet returns a changed artifact, focused tests, native readback, exact source/build evidence, remaining concrete gaps and any pressure on this map. Documentation alone does not close an implementation packet.

### E0 — Coordinator: establish the first callable vertical contract

**Difference:** all lanes act on the same Agent and operation, not similar local models.

Read the current local `AGENTS.md`, selected methodology/atomic-task skills, this map/classification and only the source needed for the first slice. Inspect current checkouts, dirty paths, active workers, installed/running provenance and build activity. Compare the classified source blobs with current local code. Preserve unrelated work; do not fetch/reset/build all repositories merely as a ritual.

Choose one existing Project and a bounded test Agent/repertoire with no private data exposure. Bind the actual roster/review/accept, SkillSet resolution, preview, generation/preparation, authority, work entry, observation and Return operations. Pin shared request/result semantics, assign owner gaps to A and write claims to B/C. Record CLI invocations as existing or proposed, never blur them.

**Exit:** a compact operation/owner matrix, actual baseline reproduction and disjoint write claims. E0 is not a demand that every implementation gap be closed before independent UI/CLI work begins.

### A1 — Native CLI grouping, help and orientation

**Write ownership:** AIKit `crates/aikit-cli/src/cli.rs`, root dispatch and help; Central `ctrl/src/cli_frontdoor.rs` and necessary parser integration; Actuation command table; Factory CLI; Workcell CLI entry; QL CLI. Update associated native tests and each changed owner's documentation.

Implement the classification with minimal parser/dispatch changes. Preserve original handlers and argument envelopes. Provide brief outcome-based help, a complete discoverable reference and generated structured command metadata. Strip CASE numbers, ADR stage prose and implementation diary language from everyday descriptions without losing source-level documentation. Make `aikit --json` bounded inert orientation. Standalone native tools remain useful without O:I.

**Verify:** every old root/alias still parses to its original semantic handler; new grouped paths reach that handler; structured output is clean; `--help`/bare non-TTY does not block, initialise, consume request stdin or launch; folded SessionSpace works; no lost flags or silently narrowed capabilities. Compare generated inventory to the actual parser, including operator and protocol surfaces.

### A2 — Contextual discovery and canonical invocation

**Write ownership:** existing AIKit resource/search/contextual-action and application dispatch seams; necessary native Action descriptor additions. Shared files touched by A1/A2 are serialised within lane A.

Complete task-oriented search results and the `act` doorway from §1.2. Preserve current resolver grammar, exact refs, subject requirements, authority and ranking law. Expose authored alias families and their useful entries as typed composition resources without treating aliases as separate capabilities. Keep basic search working when a deep provider, Jev or Gateway is absent.

**Verify:** source-backed queries locate applicable practices/actions; describe returns the actual input shape; unknown/ambiguous refs cannot mutate; search produces zero invocation/familiarity/trust events; explicit successful use records the existing observation exactly once; denied/unavailable/stale actions return precise recovery; static catalogue availability is not confused with installed eligibility.

### A3 — Tested executable praxis support

**Write ownership:** selected native Skill/Method package sources and their existing helper/runner tests; Method/Routine runner only for proven missing integration.

Bind deterministic support to two current practices using §2.2. The Agent encounters the Method and its clear invocation route, not a hand-assembled chain of hidden CLI leaves. Scripts call stable owner operations; they do not replace knowledge/custody/state owners. Preserve progressive loading and target-native package exports.

**Verify:** wrong/missing input, stale source and missing authority fail before effect; repeated/unknown outcomes use native request lookup/idempotency where provided; owner result is independently read back; a successful shell exit without required postconditions fails verification; package-relative assets work outside the author's checkout; no generated skill tree is edited.

### A4 — Native Agent/repertoire/work completion

**Write ownership:** Central AgentProfile authoring/review/acceptance schemas and handlers only where missing; AIKit profile/SkillSet resolution, direct-agent-session, Encounter/inhabit/continuity operations; bounded Actuation/Workcell/Factory joins as needed.

Extend the real creator path to carry SkillSet refs and preserve individual exceptions, exact purpose and source acceptance. Prefer existing Central fields over adding parallel ones. Complete owner-side preview/preparation/start/resume routes needed by B/C. Preserve per-participant context, native scope and independent authority. Same accepted Agent must resolve the same operative repertoire in CLI/TUI/desktop.

**Verify:** save/edit/reopen round-trip; nested sets and withheld members; changed source invalidates preview; exact purpose persists; generation/projection versus actual harness loading; provider starts only after correct native binding; actual first-turn behaviour can use the intended practice; failure preserves saved source and native partial results; no duplicate Agent/session/launch on recovery. Preserve caller-independent minimal Direct work.

### B1 — One usable terminal entry

**Write ownership:** AIKit `crates/aikit-tui/src/application_surface.rs`, workspace/navigation/rendering, and `crates/aikit-cli/src/ui.rs`. A owns CLI enum and root dispatch; B requests changes there through the coordinator.

Keep the one reducer/application architecture. Make the resting World show actual context and a few actionable next steps rather than an undifferentiated resource list. Universal navigation finds destinations, resources, practices and Actions; context-aware help explains outcomes. Keep Quick mode genuinely quick and Workspace available. Reuse existing terminal restoration, glyph/accessibility and selected-ref behaviour.

**Verify:** wide/medium/narrow keyboard and mouse parity, ASCII/Unicode, named loading/empty/unavailable states, no vanished capabilities at narrow width, back/dismiss/query/staging behaviour, terminal restoration on exit/cancellation. Do not replace the accepted graph implementation as part of this task.

### B2 — Compose and enter real work

**Write ownership:** current TUI compose spine/preview, project-world/work and session-space surface adapters; tests over A's actual services.

Render §1.3's short ordinary path with advanced refinements over the accepted composition domains. Select SkillSets, show actual defaults and support Save/Start/Continue/Factory outcomes with exact native stage readback. Keep text ref entry available for experts but not required for an ordinary new Agent. Reuse the existing provider/harness/Encounter stream or native process handoff; do not write a terminal chat runtime.

**Verify:** create/select Agent, choose repertoire, preview, explicitly accept where needed, project and launch real Direct work; reopen/focus/resume the same native subject; separately start a Factory Commission; stop/leave/return preserve their native meanings. A prepared record or a rendered button is not closure.

### B3 — Terminal responsiveness, state and legacy entry convergence

**Write ownership:** TUI caches/invalidation/render scheduling and terminal tests; no new semantic store.

Keep a fast local navigator and responsive progress/cancel/error handling through slow or unavailable providers. Retain selected context/draft across safe navigation. All ordinary entry routes, including O:I-hosted entry after C1, reach the same terminal implementation. Keep the bootstrap wizard specialised, not a second work application.

**Verify:** interaction budgets/zero-keystroke-probe checks; late-response and cancellation races; large representative catalogues; provider loss/reconnect without losing selection; no duplicate action dispatch through mouse and keyboard; cleanup of genuinely retired controller/menu code only after equivalent paths are proven.

### C1 — O:I whole-product CLI/application affordances

**Write ownership:** O:I `cli/src/frontdoor.rs`, product command/executable resolution, existing agent/World/composition/application facade and corresponding kernel adapters/tests. Coordinate any shared config/profile files with their current owners.

Add the small whole-World entry and contextual search/action/Agent/work affordances. Reuse native product operations and the same headless consumer contract as terminal/desktop. Do not shell out through an entire UI controller or copy AIKit resolution into O:I. Preserve transparent `oi <product> ...` dispatch and minimal installation. `oi ui` delegates to the existing terminal implementation with the applicable World/provider field. Retain `oi setup` when AIKit is absent.

**Verify:** O:I and direct-owner operations return matching native identities/effects/denials; signal/stdin/stdout/stderr/exit parity on native passthrough; invalid active receipt never falls back to stale PATH; one command does not repeat full-suite validation per sub-operation; unavailable optional products leave valid standalone paths usable.

### C2 — Extend the existing desktop creator, not a second one

**Write ownership:** `desktop/cradle/src/agency/NativeAgentLauncher.tsx`, `nativeAgent.ts`, readiness/client/types, `MintAgent.tsx` formation routing and their existing kernel/native backend bindings/tests. A owns any required native product schema/handler changes.

Implement SkillSet-first selection and §1.3's task-oriented form over real owner operations. Extend the existing draft/request types; do not create a parallel draft or Agent store. Preserve held drafts, late-response guards, exact reviewed revision/digest and unknown-outcome recovery. Use the current design system, keyboard/focus behaviour and loading states. Human purpose remains exact; model suggestions are clearly proposals.

**Verify:** creation/edit/readback with native source, non-default repertoire and individual exception; inherited/withheld distinction; cancel keeps source unchanged where no operation was submitted; switching Project cannot submit stale scope; source change requires new review; refresh/mode navigation does not erase the draft; missing services show useful recovery, not a demo success.

### C3 — Finish creation-to-conversation/NOW/Factory integration

**Write ownership:** existing desktop prepared-session event/Encounter/Agents/Run/Context integration and the O:I kernel/app orchestration. Claim `CradleFrame.tsx`, shared bridge/types or Rust kernel routers explicitly before editing; they are integration hotspots.

Join the current `oi:agent-session-prepared` / conversation-selection path to real launch after reviewed runtime selection. Present one coherent action while retaining native stage outcomes. Bind correct Project/NOW/AgentSession and information/praxis before first provider turn. Offer legitimate Continue and an explicit Factory work route. Complete temporary/team paths with the existing native formation capability; remove obsolete unavailable scaffolding only when its replacement works.

**Verify:** actual provider reply with correct Agent/repertoire/context; fresh-body loading where required; distinct concurrent Agents do not receive each other's context; Direct work does not mint Factory provenance; Factory work produces genuine Commission/Run/evidence; setup repair returns to the held task and retries only the incomplete stage; unknown launch outcomes are reconciled, not duplicated.

### C4 — Useful cards, shared readings and cleanup

**Write ownership:** current human Agent card/participation/roster/actions and existing desktop context/state hooks, not a new global store.

Show what the Agent is for, what it carries, what is currently operative, where it works, current activity/attention and the useful next action. Use existing human/A2A participation builders; a Source saved, projected, prepared, running, unavailable or unknown state cannot all look like an active card. Expose edit, use/start, continue, inspect and relevant sharing/export through the same operation bindings. Remove duplicated forms, demo fixtures from production routing and dead path-specific vocabularies only where replacement coverage exists.

**Verify:** the same AgentRef and source/repertoire revisions are read in CLI, TUI, card and active session; browser/render tests never supply production success fixtures; public A2A omits private source and does not disclose more than the current projection allows; a returned result and subsequent source proposal use the existing receiving path.

### V1 — Coordinator plus fresh independent verifier

Inspect each packet's diff and actual tests before integration. Build once through the current supported development/install route. Run the complete local experience matrix in §5 on the installed/running cut. A fresh verifier gets the ordinary entry, the task and lawful scope, not the implementation author's secret CLI sequence. Record every additional hint, failed attempt and repair. The implementation Agent can then repair failures and the verifier repeats the affected whole journey.

Update native documentation/capability matrices, the classification when routes changed, the existing Wayfinder frontier and related #65/#220 evidence. No green result is inferred from a file, schema, button, PR, prepared session or fixture alone.

## 4. Scheduling, write ownership and local execution

### Dependency order

    E0: actual baseline + first vertical contract + write claims
        |
        +-- A1/A2: owner discovery + invocation -----------+
        |                                                |
        +-- B1: terminal orientation/search               |
        |       -> B2 consumes A2/A4 -> B3                |
        |                                                |
        +-- C1: O:I bindings -> C2 creator                |
                -> C3 consumes A4 -> C4                   |
                                                         |
        A3: deterministic praxis support -> joined use --+
        A4: native repertoire/launch gaps ----------------+
                                                         |
        V1: integrated installed proof + cleanup + Return

A1, B1 and C1/C2 may begin concurrently after E0 has fixed their shared contract and files. B2/C3 can implement presentation against the real schema while A4 completes a missing owner operation, but they cannot certify runtime success with a mock. No UI worker privately fabricates a missing owner result. Do not make the entire suite wait for an unrelated optional provider or every advanced feature before proving the first useful slice.

### First joined slice

Before broad completion, prove one meaningful vertical:

    ordinary entry in an existing Project
      -> search/select a real SkillSet or applicable practice
      -> author/select an Agent with exact purpose
      -> preview its resolved repertoire/body/context
      -> native save/accept and projection/preparation
      -> actual Direct work in the correct native scope/NOW
      -> one useful practice invocation and result
      -> inspect loaded/observed evidence
      -> Return through the existing destination

Use this same slice to expose contract gaps early. Then extend it to Factory work, continuation/recovery, temporary/team formation and the degraded cases. The first slice is not permission to drop the rest.

### Worktrees, builds and installations

Use the owner's existing working arrangement and as few checkouts as practicable. Inspect actual dirty state and current writers before edits. Default to disjoint file claims in the existing shared development checkout per repository. Workers do not create branches/worktrees, stash/reset/clean, switch shared branches, install packages, restart services or perform competing builds. The coordinator serialises Git/index mutations and any operations on a common build target or installed package.

Prefer one coordinated development build state per repository/platform and one installed acceptance package. Do not prescribe a single shared target directory across independent trees; do not create separate multigigabyte targets for every subagent. Use the existing build/install coordination and current suite commands, with explicit machine-specific overrides already accepted. The coordinator owns any narrowly necessary exception.

Published planning branch is not a worktree requirement. Read or bring in only these planning files through normal Git operations without switching/clobbering someone else's active checkout. Planning publication does not authorise merging unrelated branches. Local agents preserve newer accepted work and report changed source facts rather than restoring the inspected snapshot.

### Worker packet and Return

Each worker receives: intended difference, the bounded current source slice, exact operation/owner contracts, permitted paths, dependencies, acceptance checks, native work/NOW/custody references where present, and its Return address. It gets the real selected Skill/Method bodies via the existing projection/loading mechanism. Do not call a skill loaded because its name appears in a prompt.

A worker owns necessary nearby repairs inside its claim and reports cross-lane/shared-contract changes to the coordinator immediately. The coordinator resolves such a dependency and resumes the same task; it does not hand the user another planning exercise. After a prerequisite repair, immediately retry the original blocked action.

Return a compact record: changed paths/commits; original and final reproduction; exact commands/tests and actual outcomes; source/build/install/running identity where relevant; native request/receipt/Agent/session/NOW/Run refs; remaining unavailable or unverified conditions; cleanup completed; and the next specific frontier. These are existing Factory/NOW/Wayfinder records, not a new telemetry database.

## 5. Acceptance and closure

### Real experience matrix

| ID | Ordinary undertaking | Required evidence |
|---|---|---|
| X1 | A fresh Agent asks where it is. | Bounded orientation with true Project/World/work/scope and useful next actions; no giant catalogue or implicit mutation. |
| X2 | Find how to verify this implementation. | Applicable registered praxis/action found from task language; exact invocation learned from ordinary describe/context, no source archaeology or `--help-all` rescue. |
| X3 | Use a named alias family or handle. | Correct type/owner/target resolved; ambiguity shown; invocation preserves authority and records real outcome once. |
| X4 | Create an Agent with a non-default SkillSet. | Exact purpose and native AgentProfile source saved/reviewed/accepted; nested repertoire and exceptions survive reopen. |
| X5 | Preview then project the Agent. | Authored/effective/withheld and target effects shown; source drift invalidates; real generation/projection receipt, not just selected metadata. |
| X6 | Start Direct work from the creator in TUI and desktop. | Actual body/conversation, correct native Agent/Project/NOW/SessionSpace and selected practice delivered before first turn; no Factory ancestry. |
| X7 | Start developmental work. | Real Factory Commission/Run, proper agency/material/context relation, result/evidence/Return; no merely prepared request. |
| X8 | Continue work after view close and restart. | Same semantic subject; focus/attach/native resume/fresh rehydration accurately distinguished; no duplicate launch. |
| X9 | Edit purpose/repertoire while another session is running. | Native source update/review semantics; existing session is not silently rewritten; live versus next-session effect is explicit and proven. |
| X10 | Launch fails after source save or the reply is lost. | Saved-not-running/unknown presented honestly; original outcome reconciled before retry; no lost accepted source or duplicate session. |
| X11 | Request temporary help and a reusable team. | Actual existing formation path, no unwanted durable Agent and no fake team; exact unsupported targets remain explicit. |
| X12 | Use the same Agent through direct CLI, O:I, terminal and desktop. | Same native refs, source/repertoire basis, authority outcomes and readbacks; no display-local identity. |
| X13 | Work with a missing optional product/provider or denied operation. | Unaffected entry/search/standalone paths work; precise missing/denied condition, actionable repair and safe return to held task. |
| X14 | Invoke executable Method support and close out. | Required mechanical steps have native results/postcondition proof; semantic result independently checked; genuine Return/receiving, not a script-success claim. |
| X15 | Search and navigate during slow provider work. | Measured responsiveness, immediate feedback, cancellation/late-response safety, no provider calls per keystroke, no draft/context loss. |
| X16 | Exercise compatibility and cleanup. | All current root/folded/protocol callers either work via same-handler routes or have an explicit accepted replacement; obsolete menus/controllers/catalogues removed without lost capability. |

Use real local provider/terminal/desktop interactions for their respective claims. Fixtures, mocked transports, schema checks and screenshots have useful but limited evidential roles. Do not infer actual harness loading solely from a projected file; inspect the provider's real supported evidence and test the intended capability in a fresh body where required. Do not claim material reliance or human acceptance from a machine receipt.

The fresh-agent test is about discoverability, not banning exact references: the Agent should obtain the correct refs and schemas through the ordinary surface. Measure task completion, unnecessary discovery steps, malformed calls, manual hints and relevant context volume against the current baseline. A smaller help count is not the product verdict.

### Closure

Close only when the ordinary user/Agent can discover, compose, save/project, start/continue, use and inspect/return actual work across the three surfaces; the owner APIs remain usable; the installed cut reproduces the experience; the existing Agent creator is no longer a disconnected metadata/configuration stop; and duplicate surface implementations have actually been removed or have a bounded, justified remaining role.

A partial result names exactly which matrix items and provider/human claims remain unproven. It does not call them complete from unit tests. The coordinator finishes with one concise human return: what is usable, where to enter it, what was actually tested and any exact remaining limitation. Do not end at a plan, a prototype form, a prepared session or “ready to start.”

## Source and continuity pointers

Repository sources inspected in this planning pass, in addition to the classification's source table:

- O:I `docs/positions/FOUNDING-POSITIONS.md`, blob `b7ad25210ce71025b15219e710989de9eadab95a`.
- O:I `.wayfinder/maps/agent-praxis-document-world.md`, blob `11f6bd95b9397fe3de2d9d0632654088ddfdb076`.
- AIKit `crates/aikit-core/src/resource/action_search.rs`, blob `daf65e5c6fbe1c6d484c84d8746ffa6f8bbaf7ad`.
- AIKit `crates/aikit-tui/src/application_surface.rs`, blob `1240032dd2dd20d4bdfd34f8bf21746b075eb5b6`.
- AIKit `AGENTS.md`, blob `4d1ce6f76be7ecc198118acf3bec3afb2ee8d27f`.
- O:I `desktop/cradle/src/agency/MintAgent.tsx`, blob `224e31d30f56b238ce17d4fa6aa9a41f0c3d71f4`.
- O:I `desktop/cradle/src/agency/NativeAgentLauncher.tsx`, blob `eb18c18bbc180349a7cade70b2b782ab4d8e19b1`.
- O:I `desktop/cradle/src/agency/nativeAgent.ts`, blob `64b421780dc19e9fbc3a2650804522a9fcaa1618`.
- O:I `cli/src/agent_command.rs`, blob `e4bf43eac96bd63a5bd31f75e256cc714c9e1b93`.
- O:I `cli/src/setup_terminal.rs`, blob `610f6db406cd79631e7e19949c8671bab692c1e4`.

These are Git blobs, not executable versions. The repository tree inspection observed O:I commit `4ce422f7b7403316fa733c3580dd86a3cf4f67e3`; per-file reads were taken from current main and may reflect newer heads. The local coordinator records actual commit/build/install/running provenance and follows successors.

Relevant existing tests and sources to inspect narrowly: AIKit CLI parse/every-command/JSON-envelope/search-surface-parity/praxis/direct-agent-session/scoped-praxis/session-space tests; the TUI application/surface/navigation/composition/working-field/host/performance tests; O:I native Agent/session, participation, six-product command parity, kernel/context/configuration and desktop interaction tests; current Central AgentProfile/SkillSet-related source contracts; and current Method/Routine/package support. Test names are pointers to existing families, not a demand to run every repository's full suite before the first change.
