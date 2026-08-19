# O:I Desktop + Agent-Native Surface Ledger

Status: **P0 reconciliation evidence for O:I #104**  
Date: **2026-08-19**  
Design authority: O:I PR #102 (`docs/OI-DESKTOP-APPLICATION-SPEC.md`, `docs/OI-DESKTOP-AGENT-NATIVE-PROTOCOL.md`)  
Programme: O:I #103 → #104 → #105–#111

This ledger is a returned-reality bridge, not a new product ontology. It records what the current owners actually expose, what is only active on an open implementation head, what the desktop should consume, and where a real owner gap remains.

## 1. Authority and status law

Keep these classes distinct:

```text
authored position
!= design commitment
!= research proposition
!= implementation fact
!= observed result
!= current development state
!= inference
```

Current code states implementation fact at the inspected revision. Open PR code is **ACTIVE/CURRENT**, not accepted-main fact. CI or portable fixtures are observed evidence for their exact revision; they do not prove physical/provider state that was not exercised.

Likewise:

```text
Reading != Action
Surface != Action
UI control != ActionRef
MCP tool name != ActionRef
ACP session != Agent identity
A2A endpoint/card != Agent/Participant identity
A2A Task != Actuation != Factory Run
A2A Message != Contribution automatically
A2A Artifact != Projection automatically
UI selection != Agent Context disclosure
local addressability != Projection != publication
```

Projection legend used below:

- **REAL** — implementation inspected in accepted main or the explicitly named active implementation head.
- **ACTIVE** — implementation exists on an open current head and must converge before final-main acceptance.
- **PARTIAL** — a bounded/read-only or descriptor layer is real, but the full operation/projection is not.
- **N/A** — that projection is not semantically required.
- **DEFERRED** — intentionally later/current owner work.

## 2. Live revision and convergence matrix

| Owner | Accepted/current `main` inspected | Active/current implementation lines relevant to desktop | P0 convergence disposition |
|---|---|---|---|
| O:I | `fcf603839d094799317a3de09e812e7eec34e212` | PR #99 `dd862fad5bfc51532b4974039bf646612be1f494`; PR #102 `5f5b1f8e76e00d4fd56aa10282b02bd83b5276ae`; Explore PR #72 `d4334a2147d417baf3d192b916c3eb51e121c596`; Epi consumer lines remain active exceptions | #99 = inherited substrate to consume, not restart. #102 = design authority while open. #72 = shared Explore application source. #96/#97 own final branch convergence. |
| Central | `a332b26eb08b95581533fc5053a2d16a22cf1f69` | Ground PR #73 `7865ddba7d4eb91a276f8a248f4e7a93d5c7282f`; NOW/DAY PR #75 `ab354c1278396b0d50620bf8a43c40eedc26b907`; governance PR #80 `9068b1452a270124a75039a9328a8e1e664d0e25`; Personal Actions PR #53 `3f0551090ae39bcef260a27b1a9db0da4729d8a3`; machine account PR #64 `7bf76c8ab3bd37f970b47265324cfa5bfff3a7d2` | Consume accepted core now; consume active owner contracts by exact head where required, then re-pin after #96 convergence. Physical owner-world proof remains separate. |
| Actuation | `0c6a9147a780329007733df643eb07108f589ac6` | realised Actuation PR #17 `85ac3dee1eb9cc1ad0761eb8451ae51d2167c4e3`; older Agency research/contract PR #6 remains ancestry to reconcile | Main owns Agency/Return/model-bearing floor. #17 is active richer read-model pressure for P3/System; not a P1/P2 blocker. |
| AIKit | `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c` | Method/Project reflection PR #115 `e36e8fc98ec9b6ee126dcc4cb7ea32081065515a`; harness admission SDK PR #116 `9974e7ed61a57123442b2f464a1d174081a55bac` | Main already owns Resource/Context/Knowledge/SessionSpace/Surface application floor. #115/#116 enrich it; they do not justify a second O:I resolver. |
| Software Factory | `02627a2373ada04369e9d2d338cfd0809f49725c` | ProjectCentral/praxis PR #159 `60e61c29172a92badd2658e6df6aae38a2365171`; Agent-Native owner issues #49/#71/#73 remain open | **Factory GUI is already on main. Consume it.** P4 does not wait for external protocol parity; P7 does. |
| Workcell | `8a744b1ddbdc694ad71b7aea72064f7def6620d2` | no open PR in the inspected live cut; owner tickets #22/#23 retain provider/physical frontier | SDK/control/material floor is accepted main. Physical/provider assertions remain gated and are shown truthfully in System/Lower. |
| Quaternal Logic | `385a0b8693cfa9f50b52410d484f04a70a702cde` | Q6 PR #19 `7c36317c49684aec3cb2dd46b1551fdbdcd72e42`; external CF reading PR #68 `45aaa567c4b3960042db7b6ea11e6bd768c768e2`; PRE-D Bimba parity PR #67 `6ef7bccfc48f527004e6b8897693cb714a52bc49`; current Epi/Pratibimba consumer stack in O:I/Epi | Explicit active convergence exception. Ordinary no-QL desktop correctness must remain valid. Rich Epi/QL Surfaces are composition stress cases, not generic blockers. |

**P0 repair note.** During this reconciliation an accidental transient creation of `docs/OI-DESKTOP-APPLICATION-SPEC.md` on O:I `main` was immediately removed. Current main `fcf6038…` therefore contains two corrective history commits but no intended product-file delta from the pre-P0 meaningful main `9a34a83158dada7df236aa04efaa24f47704263d`. The actual design document remains owned by open PR #102, as intended.

## 3. O:I host reality before P1

Accepted desktop `main` is already a Rust-owned security/presentation shell:

```text
rendered UI
  -> named Tauri commands
  -> oi-desktop-core BridgePolicy
  -> native/O:I read models
```

It deliberately has no generic shell/filesystem/process/network/secret bridge. Current accepted-main root commands remain a narrow presentation set (`shell_snapshot`, `contribution_catalog`, `select_semantic_ref`, `open_destination`). This means **P1/P2 must add native application services, not solve navigation by granting React ambient filesystem power**.

PR #99 is materially developed inherited substrate and contains concrete code, not only ticket prose:

- `desktop/core/src/aikit_workbench.rs` uses AIKit `SessionSpaceApplicationStore` for canonical list/read/focus/history and applies focus through AIKit stage/apply receipts;
- `desktop/core/src/agent_surface.rs` uses AIKit `AcpV1ConnectionAdapter` + `ConnectionProcess`, retains canonical `agent-session/*` separately from provider-native session identity, and stores no desktop transcript;
- `desktop/core/src/project_knowledge.rs` binds ProjectCentral to AIKit `KnowledgeApplication` / `SemanticWikiIndex`, exposes bounded search/read/relations/Explain/History, and deliberately does not ambiently load the Central root Human Wiki.

Therefore #94/#99 is **CONSUME / CONVERGE**, never “finish before desktop can start”. Its current visual arrangement is replaceable presentation; its semantic owner bindings are the floor.

## 4. Native capability / object / action ledger

The tables are split so the full required accounting remains readable. Row IDs join identity/action facts to projection/disclosure facts.

### 4.1 Identity, Reading, Action, authority and exact source

| ID | Product / capability | Canonical subject / ref kind | Reading / application service + contract location | Canonical ActionRef(s) / authoritative handler | Side effect / authority / Recognition / result | Exact current implementation state |
|---|---|---|---|---|---|---|
| OI-1 | Desktop host / native contribution presentation | stable native `ResourceRef` / contribution refs; O:I destination is presentation only | `oi.desktop-host-reading/v1`; `desktop/core`, `desktop/src-tauri`, `desktop/ui` | Presentation operations only on accepted main; semantic mutations must route to native owner | Rendering grants no native authority; Tauri bridge remains allowlisted | **REAL main** `fcf6038…`; P1 replaces route/card feel, not security ownership |
| OI-2 | SessionSpace application | AIKit `session-space/*`, `ResourceRef` focus target | `SessionSpaceApplicationStore`; #99 `desktop/core/src/aikit_workbench.rs` | AIKit stage/apply `SessionSpaceMutation`; O:I only requests mutation | AIKit basis/receipt/history are authoritative; runtime observation remains separate | **ACTIVE #99** `dd862fad…`; inherited floor |
| OI-3 | Canonical AgentSession conversation / ACP Surface | `agent-session/*`; provider connection/native session remain separate | AIKit connection adapter; #99 `desktop/core/src/agent_surface.rs` | protocol operations create/load/resume/send/cancel/close; not domain ActionRefs | Native host owns process config; no O:I transcript; provider capability determines supported operations | **ACTIVE #99** `dd862fad…`; real ACP process tests |
| OI-4 | Local/private Knowledge workbench | Project/Wiki `ResourceRef`, `KnowledgeAddress` | AIKit `KnowledgeApplication`, `SemanticWikiIndex`; #99 `desktop/core/src/project_knowledge.rs` | read/search/relations/Explain/History; source mutations remain Central/native-owner Actions | Retrieval/navigation receipts are derived/learned; no publication implied | **ACTIVE #99** `dd862fad…`; do not rebuild as DesktopWiki |
| C-1 | Core Central/Work application Actions | Central root, Control roots, Work item | `ctrl/src/action.rs` `ActionRegistry`, `ActionDescriptor`, Connector SDK | `central.root`, `central.init`, `central.doctor`, `action.list`, `control.open`, `control.search`, `work.list/search/open/reveal`, machine/recovery Actions | mutation class is explicit; open/reveal use provider-neutral Ports; one registry handler per Action id | **REAL Central main** `a332b26…` |
| C-2 | ProjectCentral lifecycle + Agent Wiki | ProjectCentral manifest/project ref, `central:wiki:root`, WikiSpace refs | `ctrl/src/projectcentral.rs`, `projectcentral_ops.rs`; AIKit `ProjectCentralFilesystemBinding` | inspect/init/adopt/migrate/doctor family via ProjectCentral extension layer | ambiguous source requires human decision; adopted/migrated source preserves provenance | **REAL main** lifecycle floor; consumed by #99 Knowledge |
| C-3 | Human-authored Project Ground | source refs + `central.project.ground-relations/v1` | PR #73 Ground inspect/read model | `projectcentral.ground.inspect`, `.plan`, `.apply` | `.apply` requires semantic `acceptance=human-accepted`; source bytes/path can remain unchanged | **ACTIVE #73** `7865ddba…`; caller cryptographic identity not yet proven by this Action layer |
| C-4 | Layered Agent governance source | deterministic Central source refs for `Control/agents/governance/**` and Project governance | PR #80 read model `inspect_*_governance`; `.no-agent-retrieval` | direct source editing / explicit recognised relation; no new CLI Action family by design | Central owns authorship/scope; AIKit owns operational precedence/composition | **ACTIVE #80** `9068b145…` |
| C-5 | Project NOW / DAY temporal field | stable NOW handoff refs, DAY source snapshots, external Run/Session/Focus refs remain opaque | PR #75 ProjectCentral NOW application | `projectcentral.now.inspect/init/return/update/promote/rollover` | human source promotion requires `human-accepted`; Agent learning return requires `agent-return`; DAY snapshot precedes cleanup | **ACTIVE #75** `ab354c12…` |
| C-6 | Personal source proposals + notification | Control source refs, proposal refs, notification subject refs | PR #53 Personal Action registry extension + `UserNotification 1.0.0` Port | `personal.show`, `control.propose-change/review-proposal/apply-proposal`, `personal.notify` | proposal does not mutate source; apply requires `accepted_by_ref`; notification receipt keeps caller lineage and does not fake human acknowledgement | **ACTIVE #53** `3f055109…`; convergence/physical extension ancestry remains open |
| C-7 | Current machine account | stable local machine id; authored role vs observed machine evidence | PR #64 `machine.account` composed read model | `machine.account`; existing `machine.inspect/plan/apply` | observation never writes Control; provider provenance retained; stale cached observation labelled stale | **ACTIVE #64** `7bf76c8a…`, currently non-mergeable and therefore not accepted cut |
| A-1 | Agent / Agency / WorldBinding / root position / Return | Actuation AgentRef/AgencyRef/WorldBinding/RootScope/Return refs | `contracts/agency-v1.schema.json`, `contracts/agency.mjs`; main plus ancestry PR #6 | principally Readings/authority relations, not a universal Action catalog | MetagencyGrant/Determination bound authority; Return precedes Recognition/world mutation | **REAL main floor**, with older PR #6 requiring convergence classification |
| A-2 | Realised Actuation / acting loop | realised Actuation ref + opaque body/session/material refs | `actuation.realised/v1` in PR #17 | Reading/observation contract; Actions remain domain/application owned | `acting=true` + evidence required for observed; availability/model presence is insufficient | **ACTIVE #17** `85ac3dee…`; P3/System enrichment, not P1 blocker |
| K-1 | Resource/Action horizon and contextual Action search | AIKit `ResourceRef`; `ContextualActionDescriptor` binds Action ref + subject ref | `crates/aikit-core/src/resource/*`, especially `action_search.rs`; ContextResolution/ProjectWorld | AIKit indexes/searches owner-supplied Actions; it is not a universal domain executor | search changes no stageability/trust/eligibility/authority; native owner remains handler | **REAL AIKit main** `42127820…` |
| K-2 | Context/disclosure / ProjectWorld | ResourceRef + ContextSource/Project/Agency/Focus relations | `context_resolution.rs`, `context_source.rs`, `project_world.rs` | disclosure/retrieval operations are AIKit application semantics; downstream domain Actions separate | available != retrieved != disclosed; selection is not Context materialisation | **REAL main** |
| K-3 | Knowledge / SemanticWiki / ProjectMap / CodeReference | Wiki/Project/Code ResourceRefs | `knowledge_*`, `project_map.rs`, `knowledge_navigation.rs` | read/search/relations/Explain/History; source change remains source-owner operation | provenance/revision/provider relation meanings preserved | **REAL main**; #115 deepens reflection/praxis |
| K-4 | SessionSpace / Component / Surface composition | `session-space/*`, AgentSession, Component, Surface, ProjectionBinding refs | `session_space*`, `composition*`, `surface_material`, store application | AIKit application mutations stage/preview/apply; target activation separately observed | authored/effective/active remain distinct; no fake `Active` without provider observation | **REAL main**, consumed by #99 |
| K-5 | Method / Project reflection / praxis | `ResourceKind::Method`, SourceRef/ProjectMap/CodeReference | PR #115 `docs/v2/20-*`–`22-*` + core implementation | Method uses existing Skills/Actions/UsageOverlay refs; no new mutation system | downstream of ContextResolution; does not create Agency authority | **ACTIVE #115** `e36e8fc…`, green but not main |
| K-6 | Harness admission / adapter SDK | target product/edition/version/source revision; optional realised Actuation ref | `aikit.harness-adapter/v1` PR #116 over `TargetAdapter`/`ProjectionPlan` | discover/plan/project/activate/reload/verify/explain/update/retract adapter operations | generated projection != loaded target; activation truth requires observation | **ACTIVE #116** `9974e7ed…` |
| F-1 | Factory Build read/application model | `ProjectRef`, `RunRef`, frontier, Candidate/Claim/Evidence/HumanRequest/Execution refs | `factory.build-view/v1`; `factory/src/build.rs`, `build_provider.rs` | current exemplar `action:01ARZ3NDEKTSV4RRFFQ69G5FAP` (`request-evidence`) -> `FactoryActionExecutor`; `FactoryBuildFileProvider.execute_action` persists returned state | `FactoryActionAuthority` carries owner/capability granted/action authorised; next revision + created HumanRequest are native result | **REAL Factory main** `02627a23…` |
| F-2 | SSSF-derived Factory Build GUI | same Factory refs; SSSF ids retained only as native evidence refs | `factory-ui/BuildSurface.tsx`, `read-model.ts`, `sssf.ts`; `docs/GUI-SSSF-SOURCE-FIDELITY.md` | UI emits only `{actionRef, subjectRef}` via `onAction`; no UI business store | source fidelity pinned to `disler/super-simple-software-factory@de313748…`; Factory owner handles mutation | **REAL Factory main**; three depths semantic/live/trajectory |
| F-3 | Project developmental orientation / praxis return | RunRef-bound ground/reflection/praxis observations | PR #159 `factory/src/project_development.rs` + canon doc | owner-return proposals only; no Central/AIKit/Actuation mutation ownership | stale source/reflection pressure returns to owner for Recognition | **ACTIVE #159** `60e61c29…` |
| F-4 | Full Agent-Native Action catalog / caller-lineage / external parity | canonical Factory subject + ActionRef | owner programme #49/#71/#73 | target is one authoritative handler across UI, Agent, CLI/headless, MCP/A2A where appropriate | caller lineage/projection-loss/reconciliation must be proven, not inferred from current one-Action executor | **GAP — existing owner tickets OPEN**; no new O:I semantics |
| W-1 | Workcell client/control application | ExecutionDemand, Workcell/provider/material refs | `crates/workcell-sdk`, `workcell-control`; `ControlClient`, direct/length-prefixed transports | SDK/control operations; no inspected universal `ActionRef` layer is claimed | embedded vs service-backed transport must preserve semantic contract; provider IDs remain material provenance | **REAL Workcell main** `8a744b1d…` |
| W-2 | Providers/offers/process-service/storage/artifact/exposure/Fabric | ProviderRef/OfferRef/Allocation/Operation/Observation/release + material refs | Workcell public SDK provider traits + control/runtime/workspace/artifact crates | provider/material operations through public SDK/control service | finite material authority/receipts; physical/provider state must be observed | **REAL main floor**; #22/#23 retain provider/physical acceptance frontier |
| Q-1 | QL formal readings/refraction | external target ref + QL provider/lens/operator/revision/provenance | accepted QW0–QW4 main; active Q5/Q6 | Reading operations; QL does not become target/domain mutation authority | no-QL parity retained; derived reading cannot silently become canonical domain truth | **REAL main + ACTIVE Q5/Q6** |
| Q-2 | External sixfold Context Frame Reading | six externally owned refs + mapping source/digest | `ql.mef.context-frame-reading/1.0.0` PR #68 | Reading only; ActionRef **N/A** | exact/partial/ambiguous/no-reading; `is_runtime_authority() == false` | **ACTIVE #68** `45aaa567…`; ordinary O:I does not depend on it |
| Q-3 | Bimba coordinate / M↔M′ source-parity field | source coordinate/ref and relation identities; implementation readiness separate | PRE-D PR #67 + locked Epi source `Epi-Logos-C-Experiments@daa660c…` | structural/read/conformance operations; domain Actions remain Epi-owned | coordinate exists != implemented/provider/rendered/disclosed | **ACTIVE #67** `6ef7bccf…`; explicit generic-suite convergence exception |
| E-1 | Nara lived personal Surface / selection | Epi episode/selection/coordinate refs | current Epi producer + O:I PR #88/#89/#90/#100 consumer lines | `epi.action.nara.selection.sendoff` + `epi.capability.nara.selected-context`; native Epi/O:I bounded authority path | protected body local; exact selection/range preserved; Agent/Projection receives only governed material | **ACTIVE Epi/Pratibimba exception**, not generic-main requirement |
| X-1 | Explore renderer-neutral application | semantic Explore/world/object refs; Projection and WorldPresentation refs remain distinct | PR #72 `shared-field/explore-surface.mjs`, `spacetimedb-explore-surface.mjs` | Search/read/relations are Readings; authoring uses current semantic operation + authoritative `putProjection` reducer; no separate canonical ActionRef is claimed by this inspected layer | caller-visible field authority + Participant governs write; returned Pn+1/Wn+1 arrives from subscription; source revision unchanged | **ACTIVE #72** `d4334a21…`; same model used by web/desktop/structured consumers |
| X-2 | SharedField / Contribution / Watch / Contact / exchange | SharedField/Participant/Projection/Contribution refs; transport ids remain provenance | `shared-field/spacetimedb/src/index.ts` + security/admission/exchange stack | reducers/Admission/exchange authority are native O:I shared-field operations; domain ActionRefs only where explicitly bound | visibility, admission, exchange and execution authority remain distinct | **ACTIVE shared-field stack**; #96/#97 must converge historical phases |
| X-3 | A2A binding/exchange | semantic AgentRef -> Participant -> published binding; endpoint/card/task/message/artifact remain transport objects | O:I #24 / PR #37 and current shared-field acceptance | A2A transport exchange; returned difference requires explicit Admission before Contribution/Projection | endpoint availability confers no trust/identity/authority/publication | **ACTIVE current A2A line**; use, do not reimplement in desktop |

### 4.2 Desktop disposition, Agent addressability and projection matrix

| ID | Desktop disposition / intended region | Agent discoverable / AIKit resolution | Desktop | TUI | Embedded Agent | CLI/headless | MCP | A2A | API/automation / alternate-native | Disclosure / privacy / source-authority | Explore / Projection relation | Selected integration action / native follow-up |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OI-1 | **SYSTEM / COMMAND / host all regions** | host catalog can expose native refs; AIKit resolves owner resources where registered | REAL shell; P1 expansion required | N/A as O:I host | structured native refs, not DOM | O:I CLI REAL for suite ops | N/A unless native owner projects | N/A | Tauri/native host | renderer gets no ambient privileged authority | hosts Explore but does not publish by rendering | **ADAPT host only**; no semantic copies |
| OI-2 | **SIDECAR / SYSTEM / COMMAND** | AIKit native Resource/SessionSpace application | ACTIVE #99 | AIKit TUI PARTIAL/REAL owner surface | REAL structured subject | AIKit CLI/headless owner paths | N/A unless adapter exists | N/A | alternate SessionSpace Surfaces REAL/PARTIAL | selected focus != disclosed payload | no automatic Projection | **CONSUME #99**, reposition in P1/P3 |
| OI-3 | **SIDECAR / ALTERNATE-NATIVE** | AgentSession/connection descriptors via AIKit | ACTIVE #99 | alternate AIKit/harness Surface | REAL conversation Surface semantics | provider/headless dependent | MCP servers may be carried inside ACP session config; **not Action identity** | N/A | ACP + harness-native | canonical AgentSession separate from provider session; host command/cwd trusted-native only | A2A is unrelated unless separately bound | **CONSUME #99**; P3 adds Agency/Action/context horizon |
| OI-4 | **NAVIGATOR / CANVAS / COMMAND** | AIKit KnowledgeApplication and ResourceRefs | ACTIVE #99 | AIKit TUI owner capability | REAL structured read/search/relations | owner CLI/headless PARTIAL | N/A unless explicit knowledge projection | N/A | application service | Central root Human Wiki not ambient; retrieval != disclosure | local retrievability != Projection | **CONSUME #99**, P2 supplies professional navigator/editor |
| C-1 | **NAVIGATOR / COMMAND / SYSTEM / ALTERNATE-NATIVE** | descriptors can be indexed as owner Actions; AIKit may contextualise but does not execute for Central | host projection missing/partial | AIKit TUI can consume structured descriptors where wired | structured Action registry is Agent-addressable | **REAL `ctrl --json`/CLI** | N/A inspected | N/A | Connector/provider ports | Action availability != caller authority; direct authored editing remains owner operation | only explicit selected readings/projectors leave Central | P2/P5 consume descriptors/handlers; **do not build Central settings DB** |
| C-2 | **NAVIGATOR / CANVAS** | ProjectCentral binding consumed by AIKit | ACTIVE via #99 Knowledge | AIKit Knowledge paths | structured ProjectCentral/Wiki refs | `ctrl` lifecycle | N/A | N/A | filesystem + Connector SDK | Wiki != human source; source adoption explicit | selected account/reading may feed WorldPresentation only explicitly | P2 consume current lifecycle/source contracts |
| C-3 | **NAVIGATOR / CANVAS / SIDECAR review** | Ground source refs/read model can enter AIKit Project world | P2 missing host presentation | PARTIAL once AIKit consumer wired | structured inspect/plan/apply possible | ACTIVE `ctrl` on #73 | N/A | N/A | native source files alternate editor | `human-accepted` required for relation mutation; current #73 says caller not cryptographically identified | Projection refinement cannot mutate source automatically | **ACTIVE owner dependency #73**; caller-attestation is DISCLOSURE/AUTHORITY gap under Central #70/convergence |
| C-4 | **NAVIGATOR / SYSTEM** | AIKit ContextSource/Profile/ContextResolution is operative owner | host presentation missing | AIKit TUI natural owner | REAL/PARTIAL via ContextSource when wired | direct files/read model | N/A | N/A | native editor | `.no-agent-retrieval`; human-authored scope != operational precedence | only explicit projection | Consume #80 when converged; no new Central runtime |
| C-5 | **NAVIGATOR / CANVAS / SIDECAR context** | should enter AIKit ContextSource horizon; refs stay external | host presentation missing | PARTIAL future consumer | structured actions/readings on active head | ACTIVE `ctrl` | N/A | N/A | filesystem source + Actions | human scratch vs Agent return separate; promotion explicit | no automatic publication | Consume #75; do not model NOW as Session/Run/Focus |
| C-6 | **NAVIGATOR / CANVAS review / COMMAND / ALTERNATE-NATIVE** | owner Action descriptors can be indexed | host presentation missing | PARTIAL consumer | structured Actions exist on active head | ACTIVE `ctrl` | N/A | N/A | native notification provider / OS Surface | proposal before source mutation; caller lineage present for notification, proposal acceptance explicit | notification/Control source is not social Projection | Keep behind current convergence; P2/P5 may consume after owner selection |
| C-7 | **SYSTEM / LOWER / INSPECTOR** | machine Resource/Action can be indexed after owner convergence | host missing | plausible TUI consumer | structured Action/read model | ACTIVE CLI | N/A | N/A | native MachineInspector provider | authored role != observed machine; cached observation labelled stale | N/A | Do not depend until #64 is rebased/accepted; System may show absence/degraded |
| A-1 | **SIDECAR / SYSTEM / LOWER(Return)** | AIKit may carry opaque Agency refs; authority remains Actuation | presentation partial through Factory/O:I readings | PARTIAL | structured Agency contract | schema/headless read | N/A | N/A | alternate agent/harness Surfaces via AIKit | visibility/root position != authority; bounded MetagencyGrant governs | projected Agent identity remains distinct from Participant/A2A binding | P3/P5 consume readings, never mint authority |
| A-2 | **SIDECAR / LOWER / SYSTEM** | optional realised Actuation ref enters AIKit #116 adapter | missing until owner consumed | PARTIAL | structured Reading | headless contract | N/A | N/A | harness-native body remains external | observed requires evidence; body/session/material changes do not rename Agent | N/A | Consume #17 progressively; no generic desktop blocker |
| K-1 | **COMMAND / SIDECAR / SYSTEM** | **native owner of contextual indexing/search** | P1 host missing | REAL/PARTIAL TUI | REAL structured descriptors | REAL/PARTIAL CLI | only where native adapters exist | only where native adapters exist | harness-native resources | discoverable != authorised != invoked; AIKit cannot mint downstream authority | projected resources still obey source/privacy | **P1 uses descriptors, not O:I Action catalog** |
| K-2 | **SIDECAR / SYSTEM / inspector** | native ContextResolution | P2/P3 presentation missing | REAL/PARTIAL | REAL structured disclosure model | headless application | N/A | N/A | target projection | selection/addressability/retrieval/disclosure all distinct | Projection selection is separate | P2/P3 must surface truthful disclosure when explainable |
| K-3 | **NAVIGATOR / CANVAS / COMMAND** | native | #99 ACTIVE | REAL/PARTIAL | REAL | PARTIAL | N/A | N/A | provider-specific SourcePool/CodeIndex | bounded/lazy; source/provider provenance retained | selected source may be projected only through O:I explicit path | Consume #99 + #115 where converged |
| K-4 | **SIDECAR / SYSTEM / canvas/lower Surface hosting** | native composition resolver | #99 ACTIVE | REAL/PARTIAL | REAL | PARTIAL | adapter-specific | adapter-specific | cmux/tmux/IDE/harness-native alternate Surfaces | target activation requires observation | Surface presence does not publish | P1/P3/P7 consume, no duplicate Surface ontology |
| K-5 | **NAVIGATOR / SYSTEM / COMMAND** | native on #115 | host future | TUI/CLI later convergence | ACTIVE structured | ACTIVE/PARTIAL | N/A unless explicitly projected | N/A | target Skill/Method projections | Method source/overlay/effective state distinct | projectable only explicitly | Consume after #115 convergence; not P1 blocker |
| K-6 | **SYSTEM / SIDECAR / ALTERNATE-NATIVE** | native adapter registry on #116 | future | future TUI consumer | structured capability declarations | SDK/headless | adapter-specific | adapter-specific | target/harness-native | projection generated != target loaded | N/A by default | P3/P5 show capability/activation truth; keep active head status explicit |
| F-1 | **CANVAS / COMMAND / SIDECAR / LOWER** | Factory Action descriptors can be indexed by AIKit contextual horizon | host import P4 | no inspected dedicated Factory TUI parity claim | native structured read/action executor exists | local provider callable; full public CLI parity **GAP** | **GAP #71** | **GAP/#71 where appropriate** | Factory provider API/library | Action descriptor != authority; `FactoryActionAuthority` required | Factory result may later be selected for Projection, not automatic | P4 consume current handler; P7 waits on #49/#71/#73 for required external parity |
| F-2 | **CANVAS + LOWER trajectory**, navigator refs | Agent reads FactoryBuildView/Action descriptors, never DOM | missing in O:I, source ready | N/A | structured read model REAL | library/headless read | N/A currently | N/A currently | standalone Factory React package | SSSF IDs evidence only; no UI authority | only selected Factory subjects/projected accounts | **CONSUME DIRECTLY**; mechanically host/adapt O:I tokens/layout, do not redraw |
| F-3 | **CANVAS / SIDECAR / LOWER evidence** | structured Run ledger | future P4 | N/A | ACTIVE | library/headless | N/A | N/A | native Factory Skills | owner return proposal requires Recognition; no foreign mutation | may inform Project account/Projection later | Consume after #159 convergence; not prerequisite to mount current BuildSurface |
| F-4 | **NOT a separate human Surface**; visible via COMMAND/SYSTEM explanation | target Agent-native application index | not yet complete | not yet complete | bounded current path only | **GAP** | **GAP** | **GAP where appropriate** | native dispatcher/adapter work | caller lineage/authority/result must be common | projected social action only if semantically valid | **OWNER GAP: Factory #49/#71/#73** |
| W-1 | **SYSTEM / LOWER / COMMAND / ALTERNATE-NATIVE** | structured SDK/control calls can be used by Agents under caller authority | host missing | N/A inspected | headless/public SDK usable | **REAL CLI/control/service** | N/A inspected | N/A | direct/service transports | transport/provider id != Project/Agent/Run identity | material state is not publication | P5/Lower consume public client; no provider-specific React semantics |
| W-2 | **LOWER / SYSTEM / INSPECTOR** | provider/material read models | host missing | N/A | structured SDK | REAL/PARTIAL CLI/service | N/A | N/A | provider-native/admin surfaces | physical/provider state must be observed, finite authority retained | N/A | consume accepted main; leave #22/#23 physical gates explicit |
| Q-1 | **SYSTEM / CANVAS rich optional / COMMAND reading** | QL provider/resource may be optional in AIKit | optional | N/A inspected | structured QL Reading | provider/client | N/A by default | N/A | QL native service/experiment Surfaces | derived formal reading != domain truth/authority | project only if explicitly selected | host optional; no ordinary blocker |
| Q-2 | **SYSTEM / CANVAS inspection; NOT mutation** | external mapping can be passed structurally | DEFER/optional | N/A | ACTIVE Reading | library/provider | N/A | N/A | QL-native | explicitly no runtime authority | N/A by default | consume only after #68/#19 convergence; do not create O:I ContextFrame runtime |
| Q-3 | **CANVAS/NAVIGATOR rich Epi case; SYSTEM readiness** | structured coordinate/readiness data for Epi/Agents | active Epi exception | N/A | structured source/parity readings | compiler/conformance | N/A | N/A | Epi/QL rich native instruments | coordinate existence != disclosure/readiness | only explicit Epi WorldPresentation/Projection | P7 stress-case after active programme settles; not generic blocker |
| E-1 | **CANVAS (Nara), SIDECAR (Epii), NAVIGATOR/KNOWLEDGE (Anuttara/Bimba), rich deep ALTERNATE/CANVAS** | canonical Epi refs supplied structurally; generic AgentSession remains AIKit | ACTIVE Epi host lines | N/A generic parity claim | structured packets/Actions | provider bridge/headless acceptance | N/A | N/A unless separately projected Participant | Epi-native provider/instruments | protected Nara body requires bounded disclosure; source/coordinate/proposal standing retained | publication explicit; A2A never auto-publishes | keep active convergence exception; use C or D only as P7 rich specimen when ready |
| X-1 | **EXPLORE / CANVAS** | same application model is explicitly renderer-neutral and Agent-consumable | ACTIVE #72 thin desktop renderer | N/A | **REAL/ACTIVE structured model** | Node/application headless | N/A unless explicit adapter | N/A at application model | web/SpaceTimeDB provider | source exists != rendered != selected Projection != admitted/public | this row *is* the local/social projection application | **CONSUME #72**, no second desktop Explore model |
| X-2 | **EXPLORE / SYSTEM inspector** | structured Views/reducers under caller identity/Participant authority | ACTIVE | N/A | structured API access | SpaceTimeDB/client | possible mediated ingress only where current | current exchange/admission | SpaceTimeDB API/service | caller-filtered privacy; Admission != index != exchange != execution | explicit SharedField owner | P6 consumes; #18 remaining live effective-contribution/native-Action/two-world acceptance |
| X-3 | **EXPLORE / SIDECAR alternate communication Surface** | Agent/Participant binding is structured | ACTIVE | N/A | structured | HTTP+JSON A2A fixture | N/A | **ACTIVE REAL path** | A2A endpoint | endpoint/card/task/message/artifact retain transport identity only | returned difference requires explicit Admission | P6 opens/focuses/explains existing binding; **do not implement A2A in desktop** |

## 5. Rich/native bodies that must be consumed rather than recreated

### Factory Build — source fidelity is already solved at the owner

Factory `main` already contains the destination React/TypeScript body. `docs/GUI-SSSF-SOURCE-FIDELITY.md` pins the inspected upstream visualizer at:

```text
disler/super-simple-software-factory
de31374882e7a4e3e5b7bb9bd09e69dc2f779356
```

The owner has already mechanically ported the useful SSSF interaction logic:

- newest-first session/execution review;
- status/request/stats/phase progress;
- per-agent event chronology;
- engineer/code/agent lanes;
- request leading zone;
- non-overlapping readable phase geometry;
- queued phases;
- tool ticks inside phases;
- progressive phase/span/tool detail;
- args/results/errors/durations/agent attribution;
- cursor-ordered event draining;
- honest missing-field behaviour.

`BuildSurface` already wraps that optic in the Factory semantic/live/trajectory relation and already emits canonical Action refs instead of mutating locally.

**#108 disposition:** `CONSUME DIRECTLY` for `factory-ui`; mechanically integrate into the O:I build/toolchain; adapt placement/tokens/focus/selection; replace only host-specific wiring for an explicit reason. Never redraw from screenshots or reduce to cards.

### AIKit TUI / alternate native Surfaces

AIKit remains an alternate-native owner for dense composition/context/session operations. O:I should open/focus/explain those Surfaces where useful rather than reproducing every TUI affordance. Semantic parity is shared refs/application services, not identical layouts.

### Central native files / OS operations

Human-authored Central/Project files remain ordinary source and may be edited in native editors where appropriate. `work.open`/`work.reveal`, machine/notification providers and OS-specific Surfaces remain alternate-native mechanisms; the desktop may invoke/explain them through native Actions rather than copying platform mechanics.

### Epi / Pratibimba instruments

Nara/Cosmic/deep instruments are rich domain Surfaces. O:I owns workbench composition, not a second Epi IDE. Their internal visual/audio/instrument logic remains Epi-owned and should enter the Canvas/sidecar through stable refs and native Surface contracts.

## 6. Gap ledger — only real gaps

### HUMAN-SURFACE GAPS

1. **O:I host/presentation:** the accepted desktop is still the older destination shell. P1–P6 must provide the professional Navigator/Canvas/Sidecar/Lower/System/Explore composition. Owner: O:I #105–#110.
2. **Central Ground/NOW/governance/machine presentation:** native source/read models exist on main/active owner heads, but the professional desktop does not yet place them. Owner of presentation: O:I #106/#109. Native semantics remain Central.
3. **Workcell material inspection:** public client/control SDK exists, but no composed O:I Lower/System material workbench yet. Owner: O:I #109 plus P1 lower-region host.

### AGENT-SURFACE GAPS

1. **Factory full external projection:** current main proves a canonical GUI-facing Action descriptor/executor/provider, but the inspected current state does **not** prove the full CLI/headless/MCP/A2A projection programme or complete caller lineage. Native owner already exists: Factory #49, #71, #73. **No new mirror ticket.**
2. **Explore current effective contribution/native-Action vertical:** #72 explicitly leaves feeding authoring from the live AIKit effective contribution field and one real canonical native Action from an authored Explore binding as remaining #18 work. Owner: O:I #18/current SharedField application line.

### PARITY GAPS

1. **Final desktop + situated Agent + external/headless Action proof:** cannot be claimed from the present Factory one-Action GUI/provider path alone. Owner split: Factory #49/#71/#73 supplies canonical projection/caller-lineage proof; O:I #111 consumes it in whole-application acceptance.
2. **Historical O:I branch stacks:** several old security/package/desktop PRs still appear as active alternatives even where newer code exists. This is not a semantic desktop rebuild task; O:I #96/#97 owns convergence/retirement before P7 freezes a final-main candidate.

### DISCLOSURE / AUTHORITY GAPS

1. **Central Ground caller attestation:** PR #73 deliberately states its current Action layer uses semantic `acceptance=human-accepted` but does not cryptographically identify the caller. This is a real authority-evidence limitation, not a reason for O:I to invent identity. Owner: Central #70/current convergence/physical-owner acceptance.
2. **Provider activation truth:** AIKit #116 exists because projection/generated material cannot prove a target loaded it. System/sidecar must display supported/degraded/unknown truth and never infer `Active`. Owner: AIKit #114/#116.
3. **Physical/material truth:** Workcell provider/hardware reachability and Central owner-machine behaviour remain physical evidence under Workcell #22/#23, Central #76/current physical issues and O:I #65. They are not desktop implementation blockers, but System must show them as unproven/unavailable where applicable.

No additional native-owner issue is required by this P0 pass. Every discovered semantic gap already has a current owner.

## 7. Returned implementation graph for #105–#111

The original linear numbering is a programme order, not a strict dependency chain. Returned reality supports this execution graph:

```text
                        O:I #104 CLOSED/P0 LEDGER
                                  |
                    converge/consume #99 substrate
                                  |
                 +----------------+----------------+
                 |                                 |
              #105 P1                           #106 P2
        workbench frame/regions          navigator/editor over #99
                 |                     + Central/AIKit native field
                 |                                 |
                 +---------------+-----------------+
                                 |
                         #107 P3 sidecar
                  #99 ACP/AgentSession floor
              + Actuation #17 / AIKit #116 as available

#108 P4 Factory Build can proceed in parallel once #105 exposes the Canvas/Lower
host contract. It consumes Factory `main/factory-ui`; it does NOT wait for
Factory #71 external-protocol parity merely to import the GUI.

#109 P5 System can proceed in parallel after #105 establishes the frame and after
P0 pins the owner read/application seams. Physical provider proof is displayed as
state; it is not a build dependency.

#110 P6 can proceed once #105/#106 provide host + local selection/Projection entry.
It consumes #72's same Explore model and #37/current A2A path; it does not build a
new social model.

                     #105/#106/#107/#108/#109/#110
                                  |
                                  v
                              #111 P7
                    exact accepted/current revisions
                    + #96/#97 convergence truth pass
                    + real canonical Action parity
                      (Factory #49/#71/#73 or an
                       equally strong native action)
                    + #65 physical alpha handoff
```

### Parallelism

- #105 shell/frame can begin without waiting for Central physical acceptance, Workcell hardware acceptance, QL/Epi convergence, or Factory external protocol parity.
- #106 and #107 can begin from #99 semantics as soon as they can safely share the P1 host contract; neither should rebuild #99.
- #108 can prepare/import Factory `factory-ui` in parallel with #107 and #109 after host placement contracts exist.
- #109 can consume read-only/effective owner state while mutating paths remain gated by native stage/apply/authority.
- #110 can integrate the current Explore application model independently of A2A implementation work; A2A is consumed only for the communication slice.

### Hard P7 dependencies only

- the selected final candidate revisions must be explicit and no essential capability may remain stranded on an undeclared feature branch;
- one real canonical Action must prove the **same subject Ref + ActionRef + handler + authority + caller lineage + result/Evidence/Return semantics** through desktop human + situated Agent + one appropriate external/headless projection;
- convergence exceptions, especially QL/Epi, must be named and must not make ordinary no-QL correctness depend on them;
- P0 ledger must be regenerated against the final accepted cut.

## 8. Exact P1–P7 implementation cut

### #105 — professional workbench frame

Consume:

- accepted Rust/Tauri security boundary from O:I main;
- #99 stable ResourceRef selection/SessionSpace/Knowledge floor;
- AIKit main `ContextualActionDescriptor` / contextual Action search and native Resource field;
- Central/Factory native Action descriptors when installed/available.

Already solved: native security boundary, shared design tokens, stable semantic-ref selection concept, native contribution reading floor.

Implement: regions/tabs/splits/layout persistence; dynamic Surface placement; universal Search/Command as an **aggregator of native Reading/Action descriptors**, never a new Action catalog/dispatcher.

Do not reimplement: SessionSpace, AgentSession, Knowledge, Factory actions, Central Actions, filesystem authority.

### #106 — Projects/files/Ground/Knowledge

Consume:

- #99 `LocalProjectKnowledge` and shared stable refs;
- Central main ProjectCentral lifecycle and exact active Ground/NOW/governance owner heads selected by convergence;
- AIKit main KnowledgeApplication/SemanticWiki/ProjectMap/ContextSource plus #115 reflection when accepted.

Already solved: local/private Knowledge search/read/relations/Explain/History and ProjectCentral Wiki binding.

Implement: professional filesystem-shaped Project navigator; source/document editor through native owner write seams; Ground/Wiki/source/reflection/praxis placement; bounded/lazy relation views; selection-to-sidecar without automatic disclosure.

Do not reimplement: Wiki graph/store, ProjectCentral source ownership, Context resolver.

### #107 — Agency sidecar / conversation / Cradle

Consume:

- #99 `AikitAgentSurface` real ACP connection process and canonical AgentSession binding;
- AIKit Resource/Action horizon + Context disclosure state;
- Actuation main Agency/Return and active #17 realised-Actuation read model when converged;
- AIKit #116 harness faculty declarations/activation truth when converged.

Already solved: create/load/resume/send/cancel/close ACP conversation floor; canonical AgentSession != provider session; no desktop transcript.

Implement: Agency-first sidecar spatial experience; selected subject + actual disclosure + legal Action horizon + Explain/History/Return + alternate Surface continuity. Cradle depth enriches the same encounter.

Do not reimplement: chat runtime, Agent identity, model/harness provisioning, Actuation authority.

### #108 — Factory Build

Consume **exact owner main source**:

- `factory-ui/src/BuildSurface.tsx`;
- SSSF adapter/read models/components;
- `docs/GUI-SSSF-SOURCE-FIDELITY.md` source pin;
- `factory.build-view/v1` + `FactoryBuildFileProvider` + `FactoryActionExecutor`;
- #159 developmental ledger only after/if converged.

Already solved: SSSF source inspection, mechanical React port, semantic/live/trajectory three-depth product body, canonical `{actionRef, subjectRef}` GUI emission, first native executor/provider.

Implement: package/host import, O:I Canvas/Lower/Sidecar composition, cross-Surface selection, native provider binding, O:I visual retrofit without losing density.

Do not reimplement: SSSF visualizer, Factory read model, Factory Action handler, trajectory semantics.

External CLI/MCP/A2A parity remains Factory #49/#71/#73 and is a **P7 acceptance dependency**, not a prerequisite to mount the real GUI.

### #109 — System

Consume native owner read/configuration/application services. Represent:

```text
authored != effective != active != staged != expected effect != provenance
```

Use AIKit stage/preview/apply and Explain/History; Central proposal/acceptance; Workcell public client/control; Actuation authority readings; optional QL Readings. O:I owns composition presentation and package/suite state only.

Do not create `oi-settings.json`, global Action authority, provider-specific model of every product, or infer active state from generated configuration.

### #110 — desktop ↔ Explore

Consume PR #72's renderer-neutral `createExploreSurfaceModel`, live SpaceTimeDB adapter/provider, WorldPresentation/Projection semantics, and current #37 A2A binding/exchange/admission path.

Already solved: shared Search/read/relations/GRAPH/TREE/LIST/WorldPresentation application meaning across web/desktop/structured consumer; live subscription authoring path; source revision distinct from Projection revision.

Implement: local-source selection → Projection preview/authority → shared field → desktop/browser co-reference; return/rebound through native owner; actual AIKit effective-contribution feed and canonical native Action vertical owned by #18.

Do not reimplement: Explore ontology/read model, A2A client semantics, SpaceTimeDB semantic identity.

### #111 — final parity and dynamic composition

Regenerate this ledger against exact accepted/current revisions. Exercise heterogeneous native Surfaces and failure/degraded cases.

The final canonical Action proof should prefer an operation whose native owner can prove the full lineage. The present Factory `request-evidence` Action is a strong candidate because the GUI/read/provider/handler identity already exists, **but #111 must not claim the external leg until Factory #49/#71/#73 (or an equally strong owner path) supplies it**.

Epi/Pratibimba is the preferred rich-domain stress specimen only when its current C/D line is sufficiently settled. Its absence must not fail ordinary suite acceptance.

## 9. What is already solved and must not be rebuilt

- Rust-owned O:I desktop security boundary and absence of ambient shell/fs/process/network/secret authority.
- AIKit SessionSpace application identity/basis/receipt semantics.
- Generic canonical AgentSession conversation via AIKit ACP adapter on #99.
- Local/private ProjectCentral → SemanticWiki → AIKit KnowledgeApplication binding on #99.
- AIKit stable ResourceRef/ContextResolution/ProjectWorld/Action-descriptor search floor.
- Central core Action registry and provider-neutral Work/Connector operations.
- Central ProjectCentral lifecycle and source/Wiki ownership separation.
- Factory SSSF source inspection, exact source pin, mechanical React port, semantic/live/trajectory `BuildSurface`, native Build read model and first canonical Action executor/provider.
- Workcell public SDK/client/control/provider/material contract floor.
- QL no-QL parity and formal Reading/target-provenance distinction.
- Explore renderer-neutral application model, WorldPresentation/Projection revision distinction and live SpaceTimeDB join on #72.
- A2A semantic-identity non-collapse and explicit returned-material Admission law in the current #24 line.

## 10. Recommended next execution order

1. **Converge/consume #99 as the inherited desktop substrate without redesigning it.** #96/#97 chooses merge/rebase history; P1 does not restart semantics.
2. **Start #105 P1** from the accepted host security boundary + #99 application floor.
3. **Run #106 and #107 as parallel application slices** once P1's region/selection contract is stable enough; both consume #99 rather than fork it.
4. **Run #108 in parallel with late #107/#109**, importing Factory `main/factory-ui` source directly.
5. **Run #109** against current native owner read/configuration seams, keeping physical/provider truth explicit.
6. **Run #110** by mounting the existing #72 Explore model and explicit Projection flow; consume #37/current A2A rather than writing another transport stack.
7. **Complete Factory #49/#71/#73 or choose an equally strong native Action parity specimen** before #111 claims whole-application Agent-Native parity.
8. **Run #111 only against an explicit accepted/current revision cut**, re-run this ledger, then hand the resulting candidate to #65 physical alpha.

QL/Epi active work remains a named convergence exception throughout. It can enter #111 as a rich native Surface specimen when ready, but it does not sit on the critical path for the ordinary professional desktop.

## 11. Epi D Current Situated Matheme / `epi.cosmic.123` amendment

**Status:** ACTIVE/DRAFT returned implementation state for Prompt D. This section is the current Epi-D amendment to the earlier P0 snapshot above; it does not retroactively turn open PR state into accepted-main fact.

### 11.1 Exact D cut

| Relation | Exact inspected state | Standing |
|---|---|---|
| QL-MEF PRE-D whole-Map provider | accepted `main` `d418abfff6f9e001c8c5ff083206329b298eddcf`; locked Epi Map source `daa660cbc1b8c5da83828698665a753852cb0287`; dataset tree `cd4f4f77c13f27e2563c5a6753d2f8bf2b605f15` | **REAL accepted source/parity floor** |
| Epi Current Situated producer | Epi PR #22 head `29fcb77be55c216b2d5e5855d1999f1fd3ba01fd`; `epi.current-situated-matheme/v1` + `epi.cosmic.123/v1` | **ACTIVE; Epi bridge CI green at this head** |
| O:I opaque host | O:I PR #117 head `699e4f0ffde2b1e5f90668bb46c148819e9551f1`; `desktop/core/src/local_epi_cosmic.rs` | **ACTIVE; cross-repo acceptance running at amendment time** |
| Corrected C return | Epi #18 + O:I #112 | **OWNER TICKETS OPEN; final corrected-C implementation return not yet present at this inspected cut** |

D is therefore a stable implementation floor over the accepted PRE-D source identity, but **not yet a final C↔D acceptance claim**. When #18/#112 return, D must reconcile onto those exact heads without minting a second Personal event or substituting profile equality for same-event identity.

### 11.2 Native Surface / Action descriptor ledger

| ID | Product / Surface | Canonical identity carried by Epi | O:I disposition | Action / deep-open relation | Current standing |
|---|---|---|---|---|---|
| E-D0 | Current Situated Matheme | one Epi `eventRef`; same `subjectRef` + existing `episodeRef`; `DAY/NOW`; world observation; M1/M2/M3 same event; `#4.4.4.4`; `qIdentity · qTransit · qActivity → Qcomposed`; exact Map/source/provider revisions | host returned JSON opaquely; validate identity/provenance invariants only; never compute M/astrology/QL semantics | `epi.action.current-situated.read` | **ACTIVE producer**; Epi CI green; live-world standing still provider-dependent |
| E-D1 | `epi.cosmic.123` parent | Epi `surfaceRef` over the same event; parent M1/M2/M3 contributions; same Personal subject; `.0/.5` boundary expressions | Canvas / Inspector / RootAgency / Status native contribution; heterogeneous Epi body allowed; no fake React depth | `epi.action.cosmic.current.read`; `epi.action.cosmic.open-depth` | **ACTIVE host floor**; parent product does not imply deep completion |
| E-D2 | `epi.deep.m1` descriptor | same `eventRef` + `ql:m-coordinate:pratibimba:M1` + `.0/.5` boundary refs | selectable/openable deep Surface ref; O:I does not implement K²/Ananda instrument | `epi.action.cosmic.open-depth` | **PARTIAL descriptor only; `completionClaimed=false`** |
| E-D3 | `epi.deep.m2` descriptor | same `eventRef` + `ql:m-coordinate:pratibimba:M2` + `.0/.5` boundary refs | selectable/openable deep Surface ref; provider state remains Epi-owned and truth-classed | `epi.action.cosmic.open-depth` | **PARTIAL descriptor only; `completionClaimed=false`; dense cymatic/frequency lab deferred** |
| E-D4 | `epi.deep.m3` descriptor | same `eventRef` + `ql:m-coordinate:pratibimba:M3` + `.0/.5` boundary refs | selectable/openable deep Surface ref; same M2 world observation must survive into M3 | `epi.action.cosmic.open-depth` | **PARTIAL descriptor only; `completionClaimed=false`; transcription/clock workbench deferred** |

This D amendment intentionally lists only the Cosmic deep descriptors M1/M2/M3. It **does not claim that `epi.deep.m0`, `epi.deep.m4`, or `epi.deep.m5` are completed**, and it does not reinterpret the parent Personal 4/5/0 product as those deep instruments. Prompt E remains the owner of the six deep-product completion tranche.

### 11.3 Same-event Personal law at the host boundary

The O:I D adapter fails closed unless the Epi reading preserves a relation stronger than `profileRef` equality:

```text
eventRef
+ subjectRef
+ existing episodeRef
+ epi.personal.450
+ #4.4.4.4 / M4-4-4-4'
+ qIdentity
+ qTransit
+ qActivity
+ Qcomposed
+ one worldObservationRef shared by M2 and M3
+ exact M1/M2/M3 MCoordinateRefs
```

O:I validates presence/co-reference and leaves computation in Epi. Raw situated quaternion material remains protected Epi semantic state; an O:I workbench selection/context is not that semantic state, and a renderer presentation is neither of them.

### 11.4 Provider and degraded-state law

The current Epi repository has deterministic harmonic/correspondential projection, but this reconciliation did **not** find an accepted real astronomical/transit provider capable of proving a live current solar/planetary/decan observation. The D producer therefore distinguishes `live-provider`, `fixture`, and `derived-only` observations.

The coordinated O:I acceptance uses a fixture observation on purpose. It must arrive as:

```text
M2 status = degraded
current-world = no-live-now-claim
```

and O:I refuses to upgrade fixture/derived state. A later real provider may satisfy the same Epi contract without changing `eventRef + MCoordinateRef + SurfaceRef` semantics; only then may the specific observation claim live-now.

### 11.5 First-D disposition

The superseded first-D work is classified rather than silently reused:

- **KEEP / EVIDENCE:** shared kernel/profile operators; no-local-table discipline; useful source/operator provenance; material-provider non-overclaim.
- **REFACTOR:** coarse M1′/M2′/M3′ and “deep workspace” handles become exact Map-rooted MCoordinateRefs plus deep Surface descriptors.
- **REPLACE:** profile/tick-derived Cosmic ref as semantic event identity; profile-derived M2 as live-world fact; Cosmic↔Personal proof by profileRef equality.
- **RETIRE:** any implication that D completes the full six deep instruments/products.

This preserves the distinction the whole ledger is built to protect: authored product meaning, implementation fact, observed CI evidence, provider truth and current development state are related, but they are not interchangeable.