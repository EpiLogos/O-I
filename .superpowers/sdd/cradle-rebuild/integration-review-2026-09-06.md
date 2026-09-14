# O-I desktop integration review — 6 September 2026

**Standing:** read-only integration research for the next UI review and fresh-session handoff. This is a proposed integration map, not an amendment to design authority or a capability acceptance. All 166 records in the current capability matrix receive a proposed integration track in Appendix A. Native standing is inherited verbatim; a `landed` native capability does not mean the Cradle has a working UI for it.

## 1. Authority and evidence boundary

Read: `docs/cradle/01-DESIGN.md`, `docs/cradle/03-UX-STATES.md`, `docs/OI-DESKTOP-APPLICATION-SPEC.md`, current wayfinder §3–§9, `docs/CANONICAL-PRODUCT-FIELD.md`, `docs/CAPABILITY-MATRIX.md`, its machine-readable companion, P1/P2/P3/P4 historical host contracts, Sept2 surface ledger, `quarry/oi-branches.md` and the host/project/System/Explore/Flow/Living Wiki/authored-relations/convergence branch notes. No AGENTS.md was present in O-I or Central root; the user-supplied production instruction and latest explicitly authorised UI-mock scope govern. The capability-matrix steward skill was read; its conservative, timestamp-bound evidence rules are applied without changing the matrix or regenerating its source ledger.

Source order for implementation: current owner instructions/rulings → current design/architecture/spec → wayfinder → current accepted product contracts at suite pins → current Cradle implementation/receipts → quarry as recoverable evidence. A retired branch cannot override a current design law. This report has not rerun product tests, changed owner repos, changed design documents, touched the git index, or checked out a branch.

Current HEAD observed: `5e6f79b1ab884a76b88dd7766ff223f11818b96f` (matrix landing). Worktree has concurrent shell/study changes plus unrelated ProjectCentral changes. Native pins are listed at the end; notably Central is now `f66794a…`, whereas the U1.1–U1.3 receipts consumed `832f2e5…`. Fresh acceptance must name its actual selected pin; neither old receipt nor new pin silently proves the other.

### Three kinds of truth must stay separate

1. The Sept2 ledger calls the old desktop candidate `IMPLEMENTED`. The old `desktop/ui` and `desktop/core` were physically removed under U0.7. Its claims are historical semantic evidence, not current Cradle feature completion.
2. The Sept6 166-record matrix has 75 landed, 75 partial, 15 claimed-only, one historical. Those are conservative source-wide recovery standings, not direct live desktop state. For example the old ledger describes Factory Action parity as implemented while the matrix's broader `cap.software-factory.action-projection-parity` remains claimed-only. This is a granularity/evidence conflict to reconcile against exact sources, not permission to select the optimistic wording.
3. The current `?study` is an explicitly illustrative interaction study. Its visual scenario checks cannot prove owner writes, agent continuation, permission gates, projection admission, or safe Return.

## 2. Proposed shell model for the next mockups

### One navigation place; many bound surfaces

Use **Central** as the labelled root. This is the actual authored-ground product, not a replacement profile labelled “My World.” Under it are owner-disclosed Project nodes. Each project row has three small, labelled-on-hover/keyboard-focus controls: **Chats/tasks**, **Files**, **Wiki**. Chats/tasks is the default row lens, as requested. This lens changes the contents beneath that project; it does not create inner graph tabs or another navigation column. Shared Field gets its own relational icon, visually distinct from Central's rooted ground icon.

A project row's identity and selected lens are separate. Opening a chat/file/wiki item binds a canvas Surface. Selecting a project’s wiki lens focuses that project’s neighborhood in the same graph vocabulary; Central’s wiki lens shows the local rooted federation. Shared Field enters the admitted outward reading. A graph selection can expose its source and Actions, but a second Graph/List switch inside the canvas is redundant: the left tree is the list/tree reading.

**Interpret the user's “one shared field graph” as one coherent relational experience, not one universal mutable database.** The existing contracts explicitly say SharedField ≠ WikiSpace, Space ≠ Frame, and private source ≠ projected public object. Central's private whole can be rendered with the same node/edge vocabulary as the shared graph while remaining a local reading. A node may have a source ref plus explicit Projection representations; never expose a local private subtree merely because its ancestor is visible in Shared Field. Scope comes from the left project/field navigation, with a small breadcrumb/read-scope label in the canvas; no competing scope tabs inside a graph.

### Chat is a Surface, including at full depth

The far-left Agent affordance can open/focus a **chat tab** bound to the chosen canonical conversation/session relation. The right encounter panel is another presentation of that same binding. “Expand chat” should promote this existing binding to full canvas area, preserve the left bar, and provide an explicit return action/keyboard toggle. It must not create a second conversation, lose Flow drafts, or silently change focus when tokens arrive.

D17 currently prescribes a full overlay with the canvas masked; the user's new chat-tab idea prescribes normal canvas membership. Both can be supported by one binding with distinct presentation state, but the product still needs a ruling on which is the primary default: **open chat tab** vs **temporarily maximise encounter**. The mockups should demonstrate both using the same sample session ID and restoring the prior layout. Avoid a third independently stateful full-chat implementation.

A normal chat tab is closable/movable/tilable; closing its view does not stop the agent. Stop/interrupt is a separate owner Action. A session can survive material/provider restart, but the binding may become unavailable: preserve identity and disclose the provider failure.

### Make the window manager visible through useful operations

Thin title and tab strips define pane boundaries. Each pane has tabs and one active Surface; exactly one pane owns keyboard focus. A restrained layout control exposes split right/down, tile, move to next group, close group, and restore arrangement; pane/tab context menus expose the same host operations. Show a clear active-pane edge and divider hit targets, not stacked card borders. Dragging a tab shows prospective drop zones; a keyboard route performs the identical operation. A tile is a host binding placement, not a new source/session identity.

Separate **host actions** (split/move/close, owned by the O-I Surface binding) from **subject actions** (read/write/run/propose, disclosed by the native owner) in a context menu. This resolves the superficial contradiction between “exactly owner-disclosed Actions” and ordinary window controls. UI discovery grants no execution authority.

### Persist the right dimensions at the right scope

| State | Proposed lifetime/owner | Required behavior |
|---|---|---|
| Workspace name, pane tree/weights, open bindings, active tab per pane, focused pane, side/lower depth and widths | O-I workspace; autosaved presentation state | Restore exactly after restart; unresolved owner bindings return visibly unavailable rather than being dropped |
| Project row expansion and Chats/files/wiki lens | O-I workspace navigation state keyed by stable ProjectRef | Return to same lens across tabs in that workspace; another workspace may differ |
| Current semantic subject | One kernel focus relation | Every consumer gets the same ref from one event; keyboard focus alone need not disclose context |
| Tab's ProjectRef, WorldRef, bound session/encounter ref | O-I binding references to owner identity | A file from another project keeps its source route when workspace/project changes |
| Graph centre, viewport, expanded relation neighborhood, selected node | Surface-local view state | Switching to a source/chat tab and back restores graph view; opening another graph binding can have a different viewport |
| Sidebar scope when focused tab belongs to another project | Proposed focus-following by default, with explicit held/browse scope if supported | Do not silently retarget an open graph. The sidebar visibly identifies its current project scope; changing its lens never rewrites another tab's binding |
| Dirty text and base revision | Held draft per SourceRef, separate from Central canonical source | Restore draft safely and report moved basis; closing/maximising/switching cannot lose it |
| Transcript, source revisions, Wiki contents, AgentSet membership, session continuity | Native owner | Never duplicate as workspace-local business state |
| Permission dialog, context menu, hover, pending drag | Transient interaction | Not restored as fresh authority after restart |
| Full-chat return target | O-I transient promotion state, optionally included in saved arrangement | Return to previous focus/panes; no automatic promotion by notification |

**Unresolved:** pinning a sidebar scope is a proposed optional mechanism, not yet an owner ruling. The simplest seed can always follow the focused tab's project and preserve that project's lens. Explicitly opening a project via navigation should focus its saved workspace per D19; opening a file from search may remain a cross-project tab without rewriting source ownership.

## 3. Feature integration tracks — full native coverage without six dashboards

Appendix A maps every matrix record to one of these tracks. Track disposition is a proposed UI obligation; it is not a promotion of native standing.

| Track | Feature and entry/context | Native contract/owner | Cradle state and integration debt | Wayfinder / acceptance |
|---|---|---|---|---|
| F — Frame, focus, contribution host | Thin bars, tabs, splits, tile/move, context menus, promotion/detach, workspace restore, notification-safe focus | O-I kernel + binding host; AIKit Surface/Component composition preserves distinct refs | Surface engine exists; workspace experiment incomplete. Only source-oriented KernelOps exist. Rich dynamic host and detached/native parity not restored | U0.3b/U1.4/U1.5; same ref across panes, restore dirty cross-project workspace, detach/rejoin without session drift |
| G — Central ground and source | Central/project Files lens; open/reveal; ordinary editor; history/diff; proposals; machine recognition | Central `projectcentral.source.*`, WorldGraph, SourceChangeHorizon, AgentProfile/source mutations | World/source/CAS/history implemented and walked against earlier pin. Actual filesystem management beyond read/write and full proposal/recognition UI missing | U1.1–U1.3/U3.3/U3.5; safe conflict, authored vs generated, no direct desktop writer |
| K — Wiki and knowledge | Project Wiki control, Central federation, selection aperture, backlinks, changed/affected/pending, source/semantic/code lenses, Remember | Central owns sources/revisions; AIKit SemanticWiki/ProjectMap/SourcePool/CodeIndex, familiarity, impact/freshness | Study graph is sample data. No native graph/knowledge aperture in current kernel. Need owner readings and lazy neighborhood queries | U3.1–U3.5/W1.5; exact node/edge counts and provenance; no automatic model invocation on changes |
| A — Agency and encounter | Agent icon→chat tab; side encounter; full chat; intent creation; Activity/Context/Actions/Raw; permission/Return; alternate surfaces | Actuation Agency/WorldBinding/bounds/Return; AIKit AgentSession/session host/SessionSpace/ContextResolution | Old ACP contracts are quarry. Current source kernel has no session operation; sample messages prove only UI | U2.1–U2.6/W1.1/W1.2; Pi main-test passthrough, stream/interrupt/resume, real permission gate, no model chooser in desktop |
| L — Flow and knowledge Return | Ordinary Flow editor; selection route; commission record; proposed edits/wiki results; Journey continuity; explicit Contemplate | Central Flow identity/CAS; AIKit standing context/Resolve/Contemplate; Factory Journey; Actuation Return | Held writing exists; sample handoff is not a commission. Owner Flow create/bind/return integration absent | U4.1–U4.3/W1.3–W1.5/W1.7; authored ≠ sent ≠ returned ≠ accepted; blank Flow owner identity; zero automatic call |
| C — Composition and System | System canvas, six product sections; source→effective→active; profiles/SkillSets/Methods/Routines; harness/providers/credentials; staging/Explain/History | Six native owners; AIKit composition; Central authored configuration; Workcell material state | Study only; U1.6 exists but one real config change is not exhaustive subfeature integration | U1.6 + named follow-on coverage; every actionable row has exact native operation and expected effect (live/next session/restart/Procedure) |
| D — Factory development | Project Tasks/Journeys entry→Build tab; semantic frontier/Candidates/Recognition; live agency; lower trajectory/waterfall/spans | Factory Journey/Run/RunMap/Candidate/Claim/Evidence/Action contracts; exact `factory-ui` source | No current Cradle Build body. Retired pinned mirror proved source-fidelity method, not current availability. Several richer Factory claims remain claimed-only | Presently §2.4 fog, U2.6 activity→Run and U4.3 Journey only. Needs explicit import and complete Build acceptance units |
| M — Material and alternate native | Lower terminal/process/services/trace, inspect Workcell/placement/recovery; remote surface; context-sensitive machine affordance | Workcell offers/plans/materialisation/Fabric; AIKit provider SessionSpace; Central machine source | No real lower material Surface in current Cradle. Owner capability often landed; integration still missing | W1.6 is only a waypoint. Add bounded terminal/provider lifecycle, degraded recovery, remote/native same-ref verification |
| E — Shared Field / Explore | Distinct Shared Field icon, admitted graph neighborhood, WorldPresentation Read/Author/Preview, audience/projection, contributions/return | O-I SharedField modules/SpaceTimeDB; Central source owner; AIKit relation/Surface composition | Shared renderer-neutral application and SpaceTimeDB code survive outside removed desktop; Cradle study does not consume them | U3.4 partially covers visualization; full spec §11/§17.13–14 has no complete §5 unit. Add explicit projection/admission/return slice |
| Q — Optional instruments | Invoked QL/Epi refraction/instrument Surface, lens in inspector, system availability; audio/native bodies where owner supports | QL native provider/kernel/readings; AIKit provider seam; rich host containment | No restored current Cradle mounting path. Research-capability standing is not an ordinary desktop blocker | §2.4 fog; APP-SPEC §9.6/§17.12. Explicit alternate-native/deferred dispositions, ordinary correctness without QL |
| V — Verification/research/governance | Release evidence and owner-method operations; some inspectable in System/Build, otherwise not a UI control | Source-owner tests/conformance/manifests/research | Do not make a “capabilities dashboard” out of engineering evidence. Matrix remains discoverable source; operations exposed only if real | Suite parity + exact-pin acceptance and capability set-completeness, not aggregate passing count |

## 4. What to recover from the retired desktop, precisely

- **Host #105, `quarry/notes/agent-oi-desktop-p1-host-105.md`:** region-generic placement, ContextResolution availability guard, canonical camelCase Action emission, native command. Re-derive typed host regions and authority commit seam; do not import old shell state. Old tests that assert strings are clues, not sufficient new functional tests.
- **Project #106:** `LocalProjectField::discover`, `search_sources/read_source/explain_source/reflection`; `LocalProjectKnowledge` search/read/relations/explain/history. Preserve Human-authored Ground / Agent Wiki / NOW–DAY distinctions and `selected != retrieved != disclosed`. One ShellSnapshot CurrentWorld, one selection. This is the semantic basis of project-row lenses, not permission to list all source classes in one undifferentiated tree.
- **P3 Agency contract:** canonical AgentSession binding distinct from provider-native ACP identity; SessionSpace is not desktop workspace. Negotiated resume/create faculties and missing per-subject disclosure receipts must remain truthful. Render “not observed” where no receipt exists. Sidecar/canvas/terminal are alternate views of one relation.
- **Living Wiki #135:** parse `central.source-change-horizon/v1`; reject any advertised payload exposure or automatic agent invocation; derive transitive impact in AIKit; carry impact paths; last owner reading is `last-observed`, not current after provider loss. Returned plans project `{resource_ref, revision, object_kind}` plus human proposals, never duplicate Wiki objects in O-I.
- **Authored-relations branch:** parse/compile Markdown in AIKit, preserve unresolved/ambiguous authored links as pending evidence. Current Flow may project transiently as observed relation input, never acquire canonical Wiki standing from a graph selection. Same resolved relation can retain distinct inline/metadata provenance.
- **Flow #138:** reuse normal native document Surface; dirty source cannot bind as if canonical. Contemplate is deliberate preflight over the already-open ACP session, never a second session path. `flow_mutations` are expected-revision owner intents; free-form agent chat prose cannot become durable knowledge. No payload leakage from preflight descriptors.
- **P4 Factory source fidelity:** `docs/OI-DESKTOP-P4-FACTORY-SOURCE-FIDELITY.md` records the exact owner mirror of BuildSurface/types/read-model/SessionCards/TraceWaterfall/SpanDetail and notices; O-I wrapper handles placement/context only. Current pin must be re-inspected: do not consume the old SHA blindly. Candidate artifacts/preview activation and evidence-detail richness were explicit owner gaps in that receipt. The new matrix's richer candidate/re-entry/recursion claims cannot be replaced by fake desktop controls.
- **P5 System:** six owners × seven state axes; effective resolution never proves active materialisation; System consumes the shell CurrentWorld, no independent fetch/store. The quarry's “no System unit” warning is **resolved by current U1.6** and must not be carried forward as a present gap.
- **P6 Explore:** import one shared `createExploreSurfaceModel` for desktop/web/agent parity. Read/Author/Preview modifies a working WorldPresentation without minting another Projection identity or acquiring publication authority. Keep audience/admission/source-return explicit.
- **Projection-space:** deterministic focus-centred bounded layout preserves refs/counts/edges; recentering is presentation only. Source revision stays distinct from Projection revision/supersedes chain. SpaceTimeDB subscription feeds the existing model; transport identity cannot become semantic identity. Empty public field is truthful when no projections arrive.
- **Epi/Nara chain:** protected local bodies and parent-bounded authority, same subject/ref through native mounting and Return, proposal-until-recognised Central source. Recover generic host/privacy patterns now; do not import the wider S′/M/M′ domain programme into this S-level completeness claim.
- **W7/convergence branches:** keep multi-world owner-role scenario and no-background-Agent invariant; discard superseded CI finalizer programmes. `physical_evidence_claimed:false` remains a warning against describing deterministic artifacts as visual evidence.

## 5. Ambiguities and conflicts needing harmonisation before full development

| Priority | Conflict or missing decision | Concrete proposed resolution / evidence needed |
|---|---|---|
| Blocking handoff | “Quiet writing first” in D1/D3 vs later desktop-first and wiki-first owner direction | Record distinction explicitly when owner authorises doc harmonisation: full shell capability first; opening/rest content is an intentional workspace choice; Flow remains authored primitive; wiki+search navigation central. Do not let brittle six-DOM-node rest checks arbitrate product intent |
| Blocking handoff | D17 overlay-full chat vs latest agent-icon canvas chat tab | One canonical binding, two host presentations. Decide primary default and shortcut; ensure no duplicate transcript, no layout movement on activity, exact return restoration |
| Blocking handoff | One shared graph experience vs SharedField≠WikiSpace and private source boundary | One renderer/relation grammar, contextual local/admitted readings; source ref plus optional Projection refs. Prove private ancestor traversal cannot disclose unselected descendants |
| Blocking handoff | Global focus vs per-pane selections vs sidebar browsed project | Define kernel interaction focus separately from each tab's selected object and sidebar browse scope; specify click/focus/order and single event fan-out. Sidebar follow mode and pinned scope must be explicit, not accidental state |
| Blocking handoff | Workspace project switching vs cross-project tabs | Workspace can hold multiple project-bound surfaces; selecting project may activate its default workspace. Focusing a cross-project tab updates current context without silently migrating the tab or overwriting workspace identity |
| Important | “Chats/tasks” conflates conversation, AgentSession, Journey and bounded Run | One default grouped lens with typed rows and distinct icons/status; tasks owned by their native relation. No desktop Task database or renaming sessions as Runs |
| Important | Agent activity left vs project sidebar dominant + redundant second bar | One compact rail/agent affordance and one navigator; agency map is a selected/promoted context using same left region, not second persistent wide column |
| Important | Central passthrough implies filesystem operations not currently integrated | Files lens must use actual read/inspect/list and disclosed rename/move/create/delete/reveal capabilities. Missing native operations get honest absence; mock only as an explicitly illustrative future operation |
| Important | Panel controls vs owner-only contextual actions | Host frame actions act on SurfaceBinding; native object actions on SubjectRef. Separate menu groups and authority paths; unavailable ≠ unauthorised |
| Important | Full capabilities matrix vs §5 programme stopping at U4.3 | Add named acceptance slices for Factory, material/lower, shared projection+return, dynamic contributions, alternate/native, configuration subdomains. No vague fog accepted as final completion |
| Important | Journey owner mismatch | U4.3 labels S→S1; matrix/APP-SPEC/Sept2 ledger establish Factory Journey with Actuation relations. Correct owner mapping in authorised programme revision |
| Important | W1.7 route syntax vs raw strings becoming identities | Display approachable @ choices; resolve to canonical typed refs with Explain/familiarity. Draft route is preview, not invocation; unknown/ambiguous address stays unresolved |
| Important | “Remember” destinations and recognition | Separate Agent Wiki maintenance from proposed Human Ground; show destination, provenance and basis. Acceptance cannot be inferred from opening a card or agent prose |
| Important | Surface/session closing, detaching, provider stop | Close view ≠ stop session. Maximise ≠ new session. Detached window may be a second view of same binding; provider loss retains identity and last-observed state |
| Important | Matrix landed source vs not at pinned build | Resolve every consumed API at exact suite pin through static exports and then functional owner test. Do not build from unpushed owner working trees |
| Later design waypoint | Chat edit/retry, branch/fork, transcript pagination, interruption, offline reconnect | W1.1/W1.2 require real negotiated provider faculties. Mock visual states without promising unsupported uniform actions |
| Later design waypoint | Graph scale, open neighborhood, relation filtering, search, zoom keyboard/accessibility | Define bounded owner queries, viewport restore, deterministic positioning, directional navigation, reduced motion and non-colour semantics; node count tests alone do not prove usable traversal |

## 6. Handoff programme proposal (not an edit to the wayfinder)

1. **Review these UI studies and choose shell behavior.** Demonstrate Central/project lenses, shared-field scope, full-chat/tab relation, four-surface tiling/context menus, cross-project context and exact return. State persistence is part of the mock, not decorative.
2. **Harmonise source documents only with explicit owner authorisation.** Current instruction forbids changing them. Produce a patch proposal/ruling register first, identifying the affected D1/D3/D17/D19/D21, UX B/C/D states, and verification rules. Do not silently rewrite them as implementation convenience.
3. **Repair and finish F/G foundation on a released checkout.** Existing green 172 baseline is superseded by unfinished spatial regressions; before any completion claim restore all required real-Central checks and add actual focus/workspace/tiling/state recovery cases. Establish exact source pins, no concurrent-actor contamination.
4. **Implement current native verticals in resolved dependency order.** G→K gives real source-bound graph; A depends on host/ref/focus and owner session seam; L depends on A+G+K. C can begin with real CurrentWorld but requires track-by-track native configuration acceptance beyond one checkbox. Do not let sample UI become the production data store.
5. **Give uncovered obligations concrete units.** D Factory import; M lower terminal/material/provider recovery; E working/published Projection and source return; F dynamic contribution/containment and alternate/native surface; Q optional instrument. Each gets native API/pin, browser/native operation, permission/error case, receipt, and ledger disposition.
6. **Final set-completeness review.** Join all 166 capability IDs against actual integration or explicit ALTERNATE-NATIVE/NOT-HUMAN-FACING/DEFERRED-with-owner-and-condition. Every APP-SPEC §17 step and UX-state family must be exercised or explicitly accepted out of scope. Passing tests are candidate evidence, not proof that the selected set covers the product.

## 7. Concrete mock review scenes

- **Central workspace:** project rows default to chats/tasks; one row switches Files then Wiki; canvas graph follows the selected context, no inner graph mode tabs. Open a node as source beside graph and show same selected ref in context.
- **Classic chat:** Agent icon opens an ordinary chat tab; expand the encounter for full-screen classic chat with left access retained; return restores previous splits. Context/Activity stay internal planes of same encounter.
- **Tiled development:** graph + Flow + chat + source in genuine independent pane groups; show tab move/drop, horizontal/vertical split, maximise/restore, contextual native vs host actions; lower tray tied to focused project.
- **Shared Field boundary:** selected projected subset around user-world centre with distinct Shared Field icon; local/private counts not represented as public; inspect provenance/audience/source and Projection revisions. Preview refinement does not mutate source.
- **Persistence:** switch a workspace mid-draft, return, reload, and preserve pane tree, lens, graph centre, text, focused tab, conversation binding and panel widths. A second project source must retain owner route.

## Appendix A — all 166 capability records assigned

This is a set-complete proposed routing table. Track descriptions above supply UI entry, state ownership, dependencies and acceptance. Full native claims and all source verdicts remain in `suite/capability-matrix.json`; the evidence column below carries the first two available reconciled citations (or claim citations when no reconciled evidence exists). **These citations are inherited static evidence, not independently reverified current-pin acceptance.** A native `landed` row with a proposed desktop track is still an integration obligation until the new Cradle receipt exists. A claimed-only row must not be made executable by fabricated UI.

| Capability ID | Native standing | Proposed track | Native source claim | Inherited evidence |
|---|---|---|---|---|
| `cap.o-i.cas-source-editing` | partial | G/K | O-I#190, O-I#157 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.cradle-frame-grammar` | partial | F | O-I#190 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.cradle-kernel` | partial | F | O-I#190, O-I#155 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.cradle-verification` | partial | V/F | O-I#190 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.currentworld-reading` | partial | C | O-I#131, Central#51 | file: O-I:cli/src/current_world.rs; file: Central:ctrl/src/machine.rs |
| `cap.o-i.desktop-agency-encounter` | partial | A | O-I#190, ai-kit#61, ai-kit#53 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.desktop-embodiment` | partial | F | O-I#155, O-I#190 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.o-i.desktop-surface-host` | partial | F | O-I#23, ai-kit#28, Actuation#1 | git-log: O-I@f18cad1; file: O-I:desktop |
| `cap.o-i.flow-loop` | partial | L/A | O-I#190, O-I#149 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.inhabitation-reading` | landed | C | O-I#158, ai-kit#53, ai-kit#61 | file: ai-kit:crates/aikit-adapters/src/herdr.rs; file: ai-kit:crates/aikit-adapters/src/hyprland.rs |
| `cap.o-i.living-wiki-desktop` | partial | K | O-I#134, O-I#149 | file: Central:ctrl/src/source_horizon.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_living.rs |
| `cap.o-i.omarchy-integration` | landed | M/V | O-I#158 | file: ai-kit:crates/aikit-adapters/src/herdr.rs; file: ai-kit:crates/aikit-adapters/src/hyprland.rs |
| `cap.o-i.rooted-world-navigator` | partial | G/K | O-I#190, Central#65 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.search-aperture` | partial | K | O-I#190, ai-kit#142, ai-kit#34 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.o-i.session-observatory` | partial | A | O-I#155, O-I#190, ai-kit#61 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.o-i.shared-field-front-door` | landed | E | O-I#9 | file: O-I:shared-field/social-schema-v1.json; file: O-I:shared-field/social.mjs |
| `cap.suite.activity-and-attention` | partial | A | O-I#155, O-I#190 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.agent-creation-chain` | partial | A | O-I#190, Central#51, ai-kit#10, Actuation#1 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.suite.agentset-primitive` | partial | A | O-I#155, Central#51, ai-kit#53 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.authored-relation-surface` | landed | K | O-I#149 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_source.rs |
| `cap.suite.composable-agentic-freedom` | landed | A | O-I#158, ai-kit#53 | file: ai-kit:crates/aikit-adapters/src/herdr.rs; file: ai-kit:crates/aikit-adapters/src/hyprland.rs |
| `cap.suite.existing-world-adoption` | landed | C | O-I#93 | docs: ai-kit:docs/v2/HARNESS-ADMISSION-AND-ADAPTER-SDK.md; file: ai-kit:crates/aikit-adapters/src/actuation_harness_detection.rs |
| `cap.suite.explain-chain` | landed | C | O-I#93, ai-kit#142, ai-kit#34 | docs: ai-kit:docs/v2/HARNESS-ADMISSION-AND-ADAPTER-SDK.md; file: ai-kit:crates/aikit-adapters/src/actuation_harness_detection.rs |
| `cap.suite.explicit-co-internality` | partial | A | O-I#155 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.git-provider` | landed | G/K | O-I#157 | file: ai-kit:crates/aikit-adapters/src/native_git.rs; file: Central:ctrl/src/source_history.rs |
| `cap.suite.local-wiki-world` | partial | K | O-I#84, Central#65, ai-kit#34 | file: Central:ctrl/src/projectcentral.rs; file: ai-kit:crates/aikit-adapters/src/projectcentral_authored_wiki.rs |
| `cap.suite.participant-addressing` | partial | L/A | O-I#155, O-I#190 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.physical-reference-world` | landed | M/V | O-I#158 | file: ai-kit:crates/aikit-adapters/src/herdr.rs; file: ai-kit:crates/aikit-adapters/src/hyprland.rs |
| `cap.suite.recursive-worlds` | partial | G/K | O-I#155, Central#51 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.research-commons` | landed | E | O-I#9 | file: O-I:shared-field/social-schema-v1.json; file: O-I:shared-field/social.mjs |
| `cap.suite.semantic-identity-precedence` | partial | F | O-I#155, O-I#157 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.shared-field-grammar` | landed | E | O-I#9 | file: O-I:shared-field/social-schema-v1.json; file: O-I:shared-field/social.mjs |
| `cap.suite.shared-field-projection-contract` | landed | E | O-I#9 | file: O-I:shared-field/social-schema-v1.json; file: O-I:shared-field/social.mjs |
| `cap.suite.suite-skills-composition` | landed | C | O-I#93 | docs: ai-kit:docs/v2/HARNESS-ADMISSION-AND-ADAPTER-SDK.md; file: ai-kit:crates/aikit-adapters/src/actuation_harness_detection.rs |
| `cap.suite.versioned-world-faculty` | partial | G/K | O-I#157, O-I#190 | file: ai-kit:crates/aikit-adapters/src/native_git.rs; file: Central:ctrl/src/source_history.rs |
| `cap.suite.wiki-publish-projection` | partial | E/K | O-I#149, O-I#84 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_source.rs |
| `cap.suite.workcell-placement-intent` | partial | M/V | O-I#155, ai-kit#53, Central#51 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.suite.world-relative-agent-knowledge` | partial | K | O-I#155, O-I#190, O-I#134 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.central.acceptance-matrix-hosted-controller` | landed | V | Central#1 | file: Central:ctrl; docs: Central:docs/CENTRAL-VISION.md |
| `cap.central.authorship-provenance-separation` | partial | G | Central#65, O-I#84 | file: Central:ctrl/src/projectcentral.rs; docs: Central:docs/PROJECTCENTRAL-CONTRACT.md |
| `cap.central.ctrl-native-contract` | landed | V | Central#1 | file: Central:ctrl; docs: Central:docs/CENTRAL-VISION.md |
| `cap.central.desktop-ground-projection` | partial | G | Central#51, O-I#23, Actuation#1 | file: Central:ctrl/src/world.rs; file: Central:ctrl/src/personal.rs |
| `cap.central.durable-edit-proposals` | partial | G | Central#51 | file: Central:ctrl/src/world.rs; file: Central:ctrl/src/personal.rs |
| `cap.central.machine-workcell-binding` | partial | C/M | O-I#131, Central#51 | file: O-I:cli/src/current_world.rs; file: Central:ctrl/src/machine.rs |
| `cap.central.product-foundation` | partial | G | Central#1, Central#51 | file: Central:ctrl; docs: Central:docs/CENTRAL-VISION.md |
| `cap.central.projectcentral-convention` | partial | G | Central#65, O-I#84 | file: Central:ctrl/src/projectcentral.rs; docs: Central:docs/PROJECTCENTRAL-CONTRACT.md |
| `cap.central.real-environment-evidence` | landed | V | Central#1 | file: Central:ctrl; docs: Central:docs/CENTRAL-VISION.md |
| `cap.central.root-wiki-federation` | landed | K | Central#65, QL-MEF#7 | file: Central:ctrl/src/projectcentral.rs; docs: Central:docs/PROJECTCENTRAL-CONTRACT.md |
| `cap.central.source-ref-canonicalisation` | partial | G | O-I#190 | file: O-I:desktop/cradle/kernel/src; file: O-I:desktop/cradle/src/surface |
| `cap.central.wiki-adopt-migrate` | landed | K | Central#65 | file: Central:ctrl/src/projectcentral.rs; docs: Central:docs/PROJECTCENTRAL-CONTRACT.md |
| `cap.actuation.actuation-stream` | partial | A | O-I#84 | file: Central:ctrl/src/projectcentral.rs; file: ai-kit:crates/aikit-adapters/src/projectcentral_authored_wiki.rs |
| `cap.actuation.agency-ontology` | partial | A | Actuation#4, Actuation#1, O-I#23, Central#51 | docs: Actuation:docs/WORLD-BOUND-ROOT-AGENCY.md; file: Actuation:contracts/agency.mjs |
| `cap.actuation.agency-read-model` | landed | A | Actuation#4 | docs: Actuation:docs/WORLD-BOUND-ROOT-AGENCY.md; file: Actuation:contracts/agency.mjs |
| `cap.actuation.epistemic-cultivation` | partial | V/Q | Actuation#1 | file: Actuation:experiments/ql-runtime; docs: Actuation:docs/QL-RUNTIME-MIGRATION.md |
| `cap.actuation.loop-runtime-seam` | partial | V/Q | Actuation#1, agent-system-design#94 | file: Actuation:experiments/ql-runtime; docs: Actuation:docs/QL-RUNTIME-MIGRATION.md |
| `cap.actuation.model-bearing-agency` | partial | A | Actuation#1 | file: Actuation:experiments/ql-runtime; docs: Actuation:docs/QL-RUNTIME-MIGRATION.md |
| `cap.actuation.portable-agency-semantics` | partial | A | Actuation#1 | file: Actuation:experiments/ql-runtime; docs: Actuation:docs/QL-RUNTIME-MIGRATION.md |
| `cap.actuation.ql-runtime-programme` | partial | V/Q | agent-system-design#94, Actuation#1, agent-system-design#115 | file: Software-Factory:ql-agent-experiments/foundation/runtime-contract; file: Software-Factory:ql-agent-experiments/comparison/STATUS.md |
| `cap.actuation.ql-series1-experiment` | historical | V/Q | agent-system-design#94 | file: Software-Factory:ql-agent-experiments/foundation/runtime-contract; file: Software-Factory:ql-agent-experiments/comparison/STATUS.md |
| `cap.actuation.realised-agency` | partial | A | O-I#93, Actuation#1 | docs: ai-kit:docs/v2/HARNESS-ADMISSION-AND-ADAPTER-SDK.md; file: ai-kit:crates/aikit-adapters/src/actuation_harness_detection.rs |
| `cap.actuation.recursion-continuity` | partial | A | Actuation#4, Actuation#1 | docs: Actuation:docs/WORLD-BOUND-ROOT-AGENCY.md; file: Actuation:contracts/agency.mjs |
| `cap.actuation.return-discipline` | partial | A | Actuation#4, Actuation#1 | docs: Actuation:docs/WORLD-BOUND-ROOT-AGENCY.md; file: Actuation:contracts/agency.mjs |
| `cap.actuation.suite-integration` | partial | A | Actuation#1, O-I#93, ai-kit#53 | file: Actuation:experiments/ql-runtime; docs: Actuation:docs/QL-RUNTIME-MIGRATION.md |
| `cap.ai-kit.action-semantic-profile` | landed | K/C | ai-kit#142 | file: ai-kit:crates/aikit-tui/src/application.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.ai-kit.agent-profiles` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.agent-world-disclosure` | landed | C/A | ai-kit#142 | file: ai-kit:crates/aikit-tui/src/application.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.ai-kit.authored-relation-extraction` | landed | K/C | O-I#149 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_source.rs |
| `cap.ai-kit.codeindex-providers` | landed | K/C | ai-kit#34 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/bkmr.rs |
| `cap.ai-kit.composition-grammar` | landed | F/C | ai-kit#53, ai-kit#23, O-I#158 | docs: ai-kit:docs/v2/09-COMPOSABLE-RUNTIME-ENVIRONMENTS.md; file: ai-kit:crates/aikit-adapters/src/deepseek_harness.rs |
| `cap.ai-kit.composition-identity-separation` | landed | F/C | ai-kit#53 | docs: ai-kit:docs/v2/09-COMPOSABLE-RUNTIME-ENVIRONMENTS.md; file: ai-kit:crates/aikit-adapters/src/deepseek_harness.rs |
| `cap.ai-kit.context-cognitive-control-plane` | landed | C/A | ai-kit#23 | docs: ai-kit:docs/v2; file: ai-kit:crates/aikit-core/src/context_resolution.rs |
| `cap.ai-kit.coordination-blackboard` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.credential-injection` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.harness-activation-boundaries` | landed | C/A | ai-kit#2 | git-log: ai-kit@73ea71a; file: ai-kit:crates/aikit-cli/src/skill_sources.rs |
| `cap.ai-kit.harness-adapter-matrix` | partial | C/A | ai-kit#10, O-I#93 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.harness-composition-adapters` | landed | C/A | ai-kit#53, O-I#158 | docs: ai-kit:docs/v2/09-COMPOSABLE-RUNTIME-ENVIRONMENTS.md; file: ai-kit:crates/aikit-adapters/src/deepseek_harness.rs |
| `cap.ai-kit.living-knowledge-operations` | partial | K/C | O-I#134, ai-kit#23, O-I#149 | file: Central:ctrl/src/source_horizon.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_living.rs |
| `cap.ai-kit.managed-source-lifecycle` | landed | C/A | ai-kit#2 | git-log: ai-kit@73ea71a; file: ai-kit:crates/aikit-cli/src/skill_sources.rs |
| `cap.ai-kit.mcp-management` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.method-praxis-paths` | landed | K/C | ai-kit#142 | file: ai-kit:crates/aikit-tui/src/application.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.ai-kit.model-catalogue` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.model-harness-router` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.project-identity-skillsets` | landed | C/A | ai-kit#2 | git-log: ai-kit@73ea71a; file: ai-kit:crates/aikit-cli/src/skill_sources.rs |
| `cap.ai-kit.projectmap-lenses` | landed | K/C | ai-kit#34, ai-kit#23 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/bkmr.rs |
| `cap.ai-kit.ql-mef-provider-seam` | landed | Q/K | ai-kit#142 | file: ai-kit:crates/aikit-tui/src/application.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.ai-kit.runtime-identity-stability` | landed | F/C | ai-kit#53 | docs: ai-kit:docs/v2/09-COMPOSABLE-RUNTIME-ENVIRONMENTS.md; file: ai-kit:crates/aikit-adapters/src/deepseek_harness.rs |
| `cap.ai-kit.search-route-grammar` | landed | K/C | ai-kit#28, ai-kit#34 | docs: ai-kit:docs/v2/04-INTERFACES-TUI-AND-SOFTWARE-DESIGN.md; file: ai-kit:crates/aikit-tui/src/application.rs |
| `cap.ai-kit.semantic-wiki` | landed | K/C | ai-kit#34, QL-MEF#7 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/bkmr.rs |
| `cap.ai-kit.session-governance` | partial | C/A | ai-kit#10 | file: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md; test: ai-kit#crates/aikit-core/tests/model_roster_acceptance.rs |
| `cap.ai-kit.sessionspace-framing` | landed | A/M | ai-kit#61 | docs: ai-kit:docs/v2/13-COMPOSITION-CONNECTION-TUI-CONVERGENCE-EVIDENCE.md; file: ai-kit:crates/aikit-adapters/src/session_space_reconstruction.rs |
| `cap.ai-kit.sessionspace-providers` | landed | A/M | ai-kit#61 | docs: ai-kit:docs/v2/13-COMPOSITION-CONNECTION-TUI-CONVERGENCE-EVIDENCE.md; file: ai-kit:crates/aikit-adapters/src/session_space_reconstruction.rs |
| `cap.ai-kit.skillset-composition` | landed | C/A | ai-kit#2 | git-log: ai-kit@73ea71a; file: ai-kit:crates/aikit-cli/src/skill_sources.rs |
| `cap.ai-kit.sourcepool-providers` | landed | K/C | ai-kit#34 | file: ai-kit:crates/aikit-adapters/src/okf.rs; file: ai-kit:crates/aikit-adapters/src/bkmr.rs |
| `cap.ai-kit.tui-environment-composition` | landed | C/A | ai-kit#28, ai-kit#23 | docs: ai-kit:docs/v2/04-INTERFACES-TUI-AND-SOFTWARE-DESIGN.md; file: ai-kit:crates/aikit-tui/src/application.rs |
| `cap.ai-kit.vak-operative-syntax` | landed | K/C | ai-kit#142 | file: ai-kit:crates/aikit-tui/src/application.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.ai-kit.verification-discipline` | landed | V | ai-kit#23 | docs: ai-kit:docs/v2; file: ai-kit:crates/aikit-core/src/context_resolution.rs |
| `cap.software-factory.action-projection-parity` | claimed-only | D | SF-§21:S7-002, SF-§21:S7-004, SF-§21:PP-006, SF-§21:SI-008 | file: Software-Factory:factory/src/action_projection.rs; file: Software-Factory:contracts/factory/interop |
| `cap.software-factory.agent-agency-contract` | partial | D | SF-§21:RC-007 | file: Software-Factory:factory/src/build.rs; file: ai-kit:docs/v2/01-PRODUCT-AND-OWNERSHIP.md |
| `cap.software-factory.agent-run-view` | partial | D | SF-§21:S3-004 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:factory/src/core/run/model.rs |
| `cap.software-factory.aikit-integration-seam` | landed | D | SF-§21:SI-002, SF-§21:MR-001 | file: Software-Factory:factory/src/execution_intelligence.rs; docs: ai-kit:docs/v2/15-MODEL-ROSTER-CAPABILITY-FIT.md |
| `cap.software-factory.architecture-gates` | partial | V/D | SF-§21:AG-001, SF-§21:AG-002, SF-§21:AG-005, SF-§21:S0-003 | file: Software-Factory:.github/workflows/factory-rust.yml; file: Software-Factory:contracts/factory |
| `cap.software-factory.authorial-ratifications` | partial | D | SF-§21:HD-001, SF-§21:HD-002 | file: Software-Factory:contracts/factory; file: Software-Factory:docs/canon/wayfinders/02-PROJECT-WORLD.md |
| `cap.software-factory.build-surface` | landed | D | agent-system-design#143, agent-system-design#163, O-I#23 | docs: Software-Factory:docs/GUI-SSSF-SOURCE-FIDELITY.md; file: Software-Factory:factory-ui/THIRD_PARTY_NOTICES.md |
| `cap.software-factory.candidate-experience` | claimed-only | D | SF-§21:PP-005, SF-§21:S5-003 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:factory-ui/src |
| `cap.software-factory.candidate-recognition-contract` | partial | D | SF-§21:RC-006, SF-§21:S1-003 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:docs/program/QL-SOFTWARE-FACTORY-ROOT-BUILD-PROGRAM.md |
| `cap.software-factory.canonical-ref-contract` | claimed-only | D | SF-§21:RC-002, SF-§21:S0-001, SF-§21:MR-002 | file: Software-Factory:contracts/factory/ref.schema.json; file: Software-Factory:factory/src/structural_ground.rs |
| `cap.software-factory.capability-action-contract` | partial | D | SF-§21:RC-008, SF-§21:S3-001 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:factory/src/action_projection.rs |
| `cap.software-factory.claim-evidence-contract` | partial | D | SF-§21:RC-005, SF-§21:S1-002 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:docs/canon/QL-SOFTWARE-FACTORY-ARCHITECTURE-SPEC.md |
| `cap.software-factory.constitutional-authority-manifest` | partial | V/D | SF-§21:RC-001, SF-§21:RC-002, SF-§21:RC-013 | file: Software-Factory:factory/src/authority.rs; file: Software-Factory:contracts/factory/authority-manifest.json |
| `cap.software-factory.context-resolution-contract` | landed | D | SF-§21:RC-009, SF-§21:S2-002 | file: ai-kit:crates/aikit-core/src/context_resolution.rs; file: ai-kit:crates/aikit-adapters/src/gitnexus.rs |
| `cap.software-factory.generic-epi-profiles` | claimed-only | Q/D | SF-§21:S3-002, SF-§21:S3-006, SF-§21:S9-004, SF-§21:SI-010 | file: Software-Factory:factory/src/build.rs; file: ai-kit:docs/v2/01-PRODUCT-AND-OWNERSHIP.md |
| `cap.software-factory.github-runmap-projection` | claimed-only | D | SF-§21:S7-001 | file: Software-Factory:factory/src; file: Software-Factory:factory/src/action_projection.rs |
| `cap.software-factory.high-altitude-read-models` | partial | D | SF-§21:S5-001, SF-§21:PP-003 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:factory-ui/src/read-model.ts |
| `cap.software-factory.human-attention-decisions` | claimed-only | D | SF-§21:RC-004, SF-§21:S5-002, SF-§21:PP-004 | file: Software-Factory:factory/src/build.rs; file: Software-Factory:factory/src/authority.rs |
| `cap.software-factory.journey-altitude` | partial | L/D | O-I#155, O-I#93 | file: Central:ctrl/src/world.rs; file: O-I:shared-field/addressing.mjs |
| `cap.software-factory.learned-ergonomics` | claimed-only | D | SF-§21:S6-003 | file: ai-kit:crates/aikit-core/tests/familiarity_v2.rs; file: Software-Factory:factory/src |
| `cap.software-factory.long-absence-reentry` | claimed-only | D | SF-§21:S6-002, SF-§21:PP-002, SF-§21:S6-004 | file: Software-Factory:factory/src/journey.rs; file: Software-Factory:factory/src |
| `cap.software-factory.method-precedent-pinning` | claimed-only | V/D | SF-§21:SI-005 | file: Software-Factory:transcripts/01-david-ondrej-dexter-horthy-agentic-workflow.txt; file: ai-kit:docs/adr/0002-managed-skill-sources-and-project-routing.md |
| `cap.software-factory.minimum-semantic-circuit` | partial | D | SF-§21:S1-004 | test: Software-Factory#factory/tests/run_map.rs; file: Software-Factory:factory/tests |
| `cap.software-factory.pi-harness-provider` | partial | D | SF-§21:S3-003, SF-§21:SI-003 | file: ai-kit:crates/aikit-adapters/src/session_space_reconstruction.rs; file: ai-kit:crates/aikit-adapters/src/clients/claude.rs |
| `cap.software-factory.praxis-fitness-evidence` | landed | D | O-I#93 | docs: ai-kit:docs/v2/HARNESS-ADMISSION-AND-ADAPTER-SDK.md; file: ai-kit:crates/aikit-adapters/src/actuation_harness_detection.rs |
| `cap.software-factory.project-entry-bootstrap` | claimed-only | D | SF-§21:PP-001, SF-§21:S2-003, SF-§21:S2-006 | file: Software-Factory:factory/src/project_development.rs; file: ai-kit:crates/aikit-core/src/actor_bootstrap.rs |
| `cap.software-factory.project-map` | partial | D | SF-§21:S2-001, SF-§21:S2-004, SF-§21:S2-005, SF-§21:SI-004, SF-§21:SI-007 | file: ai-kit:crates/aikit-adapters/src/gitnexus.rs; file: ai-kit:crates/aikit-adapters/src/composition_topology.rs |
| `cap.software-factory.project-run-runmap-contract` | landed | D | SF-§21:RC-003, SF-§21:S1-001 | file: Software-Factory:factory/src/core/run/model.rs; file: Software-Factory:contracts/factory/run-map.schema.json |
| `cap.software-factory.ql-dependency-firewall` | landed | V/D | SF-§21:S9-003, SF-§21:AG-004, SF-§21:RE-001, SF-§21:RE-002 | test: Quaternal-Logic#crates/ql-mef/tests/research_firewall.rs; file: Quaternal-Logic:crates/ql-wiki/src/refraction.rs |
| `cap.software-factory.ql-refraction-contract` | partial | Q/D | SF-§21:RC-013, SF-§21:S9-002 | file: Quaternal-Logic:crates/ql-mef/src/refraction.rs; file: Software-Factory:factory/src/structural_ground.rs |
| `cap.software-factory.recovery-matrix` | claimed-only | V/D | SF-§21:MR-002, SF-§21:MR-003 | file: Software-Factory:factory/src; file: ai-kit:crates/aikit-adapters/src/session_space_reconstruction.rs |
| `cap.software-factory.recursion-effects` | claimed-only | D | SF-§21:S6-001 | file: Software-Factory:docs/program/QL-SOFTWARE-FACTORY-ROOT-BUILD-PROGRAM.md; file: Software-Factory:factory/src |
| `cap.software-factory.run-thought-field` | partial | D | agent-system-design#163, O-I#149, O-I#134 | file: Software-Factory:factory/src/core/run/model.rs; file: Software-Factory:factory/src/build_cognitive.rs |
| `cap.software-factory.self-hosting` | claimed-only | V/D | SF-§21:S10-001, SF-§21:S10-002 | file: Software-Factory:factory/src; file: Software-Factory:docs/program/QL-SOFTWARE-FACTORY-ROOT-BUILD-PROGRAM.md |
| `cap.software-factory.semantic-store-outbox` | claimed-only | D | SF-§21:S0-001, SF-§21:RC-012 | file: Software-Factory:seed-docs/QL-SOFTWARE-FACTORY-ARCHITECTURE-SPEC.md; file: Software-Factory:factory/src |
| `cap.software-factory.session-remote-projections` | partial | D | SF-§21:S3-005, SF-§21:SI-006, SF-§21:S7-003 | file: ai-kit:crates/aikit-adapters/src/session_space_connection.rs; file: ai-kit:crates/aikit-core/tests/session_space_substrate_harmonization_v2.rs |
| `cap.software-factory.source-integration-discipline` | landed | V/D | SF-§21:RC-011, SF-§21:S0-002, SF-§21:AG-003, SF-§21:SI-001 | file: Software-Factory:factory/src/structural_ground.rs; file: Software-Factory:contracts/factory/source-ground.json |
| `cap.software-factory.telemetry-discipline` | claimed-only | D | SF-§21:S8-001, SF-§21:S8-002, SF-§21:S8-003 | file: Software-Factory:factory-ui/src/trace-conformance.test.ts; file: Software-Factory:factory/src |
| `cap.workcell.arrakis-microvm-provider` | landed | M/C | Workcell#1, SF-§21:S4-004, SF-§21:SI-009 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.binding-graph` | landed | M/C | Workcell#1, SF-§21:S4-003 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.candidate-materialisation` | landed | M/C | Workcell#1, SF-§21:S4-003, SF-§21:S4-005, SF-§21:RC-010 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.connectivity-fabric` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.control-service-and-hosting` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.deployment-profiles-reference-ubuntu` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.execution-demand` | landed | M/C | Workcell#1, SF-§21:RC-010, SF-§21:S4-001 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.external-contract` | landed | M/C | Workcell#1, SF-§21:S4-001 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.factory-conformance` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.inhabitable-local-workcell` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.operational-offer-planning` | landed | M/C | Workcell#1, SF-§21:S4-001 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.provider-port-algebra` | landed | M/C | Workcell#1, SF-§21:S4-001 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.reconciliation-lifecycle-recovery` | partial | M/C | Workcell#1, SF-§21:S4-003, SF-§21:MR-003 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.remote-placement-seam` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.runtime-service-providers` | landed | M/C | Workcell#1, SF-§21:S4-002 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.sdk-and-remote-parity` | landed | M/C | Workcell#1 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.workcell.workspace-docker-providers` | landed | M/C | Workcell#1, SF-§21:S4-002, SF-§21:SI-009 | file: Workcell:crates/workcell-core/src/contract; file: Workcell:crates/workcell-placement/src/lib.rs |
| `cap.ql-mef.ananda-music-bridge` | partial | Q | Epi-Logos-C-Experiments#32, QL-MEF#78 | file: epi:Epi-Logos-C-Experiments/Idea/Bimba/Seeds/M/M1'/M1-2-ANANDA-VORTEX-ARCHITECTURE.md; file: epi:Epi-Logos-C-Experiments/Body/S/S0/epi-lib/src/m1.c |
| `cap.ql-mef.context-frame-reading` | partial | Q | O-I#84, O-I#93, QL-MEF#7 | file: Central:ctrl/src/projectcentral.rs; file: ai-kit:crates/aikit-adapters/src/projectcentral_authored_wiki.rs |
| `cap.ql-mef.cross-language-kernel-contract` | landed | V/Q | QL-MEF#78 | file: Quaternal-Logic:crates/ql-core/src/kernel.rs; file: Quaternal-Logic:crates/ql-core/src/face.rs |
| `cap.ql-mef.epi-desktop-integration` | landed | Q | QL-MEF#30, QL-MEF#71, O-I#23 | docs: Quaternal-Logic:docs/integrations/epi-logos/EPI-LOGOS-DEVELOPMENT-WAYFINDER.md; file: Quaternal-Logic:docs/integrations/epi-logos/EPI-BIMBA-PRATIBIMBA-COORDINATE-PARITY.md |
| `cap.ql-mef.epi-parity-discipline` | landed | V/Q | QL-MEF#30 | docs: Quaternal-Logic:docs/integrations/epi-logos/EPI-LOGOS-DEVELOPMENT-WAYFINDER.md; file: Quaternal-Logic:docs/integrations/epi-logos/EPI-BIMBA-PRATIBIMBA-COORDINATE-PARITY.md |
| `cap.ql-mef.epi-reconstitution-programme` | landed | Q | Epi-Logos-C-Experiments#2 | file: Quaternal-Logic:docs/integrations/epi-logos/r1-source-snapshot.json; file: Quaternal-Logic:docs/integrations/epi-logos/epi-m-capability-field.json |
| `cap.ql-mef.janko-instrument-projection` | partial | Q | Epi-Logos-C-Experiments#32 | file: epi:Epi-Logos-C-Experiments/Idea/Bimba/Seeds/M/M1'/M1-2-ANANDA-VORTEX-ARCHITECTURE.md; file: epi:Epi-Logos-C-Experiments/Body/S/S0/epi-lib/src/m1.c |
| `cap.ql-mef.kernel-downstream-reuse` | landed | V/Q | QL-MEF#78, agent-system-design#163 | file: Quaternal-Logic:crates/ql-core/src/kernel.rs; file: Quaternal-Logic:crates/ql-core/src/face.rs |
| `cap.ql-mef.musical-derivation` | partial | Q | QL-MEF#78, Epi-Logos-C-Experiments#32 | file: Quaternal-Logic:crates/ql-core/src/kernel.rs; file: Quaternal-Logic:crates/ql-core/src/face.rs |
| `cap.ql-mef.native-kernel-core` | landed | Q | QL-MEF#78 | file: Quaternal-Logic:crates/ql-core/src/kernel.rs; file: Quaternal-Logic:crates/ql-core/src/face.rs |
| `cap.ql-mef.refraction-provider-contract` | partial | Q | QL-MEF#7, SF-§21:S9-001, SF-§21:SI-011 | file: Quaternal-Logic:crates/ql-wiki/src/refraction.rs; file: Quaternal-Logic:crates/ql-wiki/src/living_methods.rs |
| `cap.ql-mef.relation-conjugation-algebra` | landed | Q | QL-MEF#7 | file: Quaternal-Logic:crates/ql-wiki/src/refraction.rs; file: Quaternal-Logic:crates/ql-wiki/src/living_methods.rs |
| `cap.ql-mef.standalone-provider` | landed | Q | QL-MEF#7, agent-system-design#115 | file: Quaternal-Logic:crates/ql-wiki/src/refraction.rs; file: Quaternal-Logic:crates/ql-wiki/src/living_methods.rs |
| `cap.ql-mef.theory-reference-bundle` | landed | V/Q | QL-MEF#78 | file: Quaternal-Logic:crates/ql-core/src/kernel.rs; file: Quaternal-Logic:crates/ql-core/src/face.rs |
| `cap.ql-mef.wiki-contemplation-conformance` | partial | Q | O-I#134, QL-MEF#7, QL-MEF#30 | file: Central:ctrl/src/source_horizon.rs; file: ai-kit:crates/aikit-adapters/src/authored_wiki_living.rs |

Coverage: 166 unique input IDs, 166 rows, no omitted IDs. This is enumeration, not a capability acceptance.

## Appendix B — observed pins and implementation evidence

- central: `f66794a712609ea29760355d66f632d669ad7c98` (accepted-main).
- actuation: `faa5b79f75230ef259d5e523fcade491b23dc3eb` (accepted-main).
- ai-kit: `25cfdc72c29671673f1434abdea454442c91a47c` (accepted-main).
- software-factory: `3d9094177a7216697619db0a3c16bafb6bb815ca` (accepted-main-with-active-research-exceptions).
- workcell: `dc076fdf0c3e12835c17ded95ef199e200f7f8e1` (accepted-main-with-physical-provider-gates).
- quaternal-logic: `781981374eaa1f02952249dcdbca1af671d1ece4` (parallel-native-owner-exception).

Current Cradle evidence inspected: `desktop/cradle/kernel/src/lib.rs::KernelOp` contains WorldRead, ProjectRead, source operations and SurfaceOpen/Close/Focus; there are no current session, wiki, Factory or shared projection operations in that enum. `desktop/cradle/src/workspace/store.ts::Workspace` currently persists id/name/project/layout/writing; it does not itself define the full D19 bound-session/navigation-lens state. `desktop/cradle/src/surfaces/` currently contains only navigator. `desktop/cradle/src/study/Seed.tsx` is an illustrative separate entry, not native integration.

Surviving shared application evidence: `shared-field/explore-surface.mjs`, `shared-field/presentation-projection.mjs`, `shared-field/presentation-authoring.mjs`, `shared-field/activity.mjs`, `shared-field/versioned-world-application.mjs`, SpaceTimeDB adapters and `shared-field/spacetimedb/application-return-live-acceptance.ts`. Their presence supports a reuse path; it does not prove current owner pins or the new desktop binding are accepted.

The progress ledger remains the source of timestamp-bound Cradle walks. U1.1–U1.3 were walked before unfinished spatial work. Study 19/19 is intentionally separate from real product acceptance. No test/build or live owner mutation was performed for this research report.
