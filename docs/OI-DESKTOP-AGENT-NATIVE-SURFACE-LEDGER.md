# O:I Desktop + Agent-Native Surface Ledger

**Status:** O:I #104 P0 reconciliation artifact  
**Inspected:** 2026-08-19  
**Owner:** O:I whole-application coordination; native semantics remain with the six products  
**Design basis:** PR #102 (`docs/OI-DESKTOP-APPLICATION-SPEC.md`, `docs/OI-DESKTOP-AGENT-NATIVE-PROTOCOL.md`)  
**Implementation programme:** #105–#111

This ledger is the executable bridge between the accepted/current six-product field and the desktop implementation programme. It records **returned implementation reality**, not an aspirational symmetry table.

## 1. Provenance and interpretation law

Keep these categories distinct:

```text
authored position
!= design commitment
!= research proposition
!= implementation fact
!= observed result
!= current development state
!= inference
```

Current code tells what is real now; it does not retroactively define why the project exists. Open implementation PRs are recorded as **active/current**, not accepted-main implementation. Physical/provider claims remain separate acceptance evidence.

Projection law:

```text
native semantic subject
    ↓
native Reading / canonical ActionRef
    ↓
native owner + authority + canonical handler
    ↓
appropriate projections
```

`N/A` means the projection is not currently implemented or does not make semantic sense. It does not mean parity is required.

Preserve throughout:

- Agent-Native != ACP != MCP != A2A.
- Resource != Reading != Action != Surface != Component.
- UI control != ActionRef.
- UI selection != Agent Context disclosure.
- Action discoverable != authorised != invoked != succeeded != recognised/adopted.
- local addressability != disclosure != Projection != publication.
- provider/process/endpoint IDs are provenance/material facts, not Agent/Project/Run/semantic identity.

## 2. Exact inspected revision field

### Accepted/current mains

| Product | Main revision | Current status |
|---|---|---|
| O:I | `9a34a83158dada7df236aa04efaa24f47704263d` | accepted main; desktop host + SharedField/security base |
| Central | `a332b26eb08b95581533fc5053a2d16a22cf1f69` | accepted main; Action registry + ProjectCentral base |
| Actuation | `0c6a9147a780329007733df643eb07108f589ac6` | accepted main; Agency/model-bearing contract floor |
| AIKit | `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c` | accepted main; Resource/Context/Knowledge/SessionSpace application floor |
| Software Factory | `02627a2373ada04369e9d2d338cfd0809f49725c` | accepted main; Factory Build read model + SSSF-derived GUI + native Action executor/provider |
| Workcell | `8a744b1ddbdc694ad71b7aea72064f7def6620d2` | accepted main; provider-neutral materialisation workspace/CLI/control/runtime/SDK crates |
| Quaternal Logic / MEF | `385a0b8693cfa9f50b52410d484f04a70a702cde` | accepted main; typed QL/MEF service/readings + C/Rust formal product |

### Relevant active implementation/design heads

| Owner | PR / branch | Head | Status / convergence relation |
|---|---|---|---|
| O:I design | #102 `design/desktop-application-spec` | `5f5b1f8e76e00d4fd56aa10282b02bd83b5276ae` | open draft; consume design directly, do not pretend main contains it |
| O:I inherited desktop | #99 `agent/oi-desktop-workbench-94` | `dd862fad5bfc51532b4974039bf646612be1f494` | open draft; **consume-now #94 substrate**, not a P1 blocker |
| O:I Explore | #72 `agent/explore-projection-space` | `d4334a2147d417baf3d192b916c3eb51e121c596` | open draft; current renderer-neutral Explore/SharedField application line |
| Central Ground | #73 `agent/projectcentral-authored-ground` | `7865ddba7d4eb91a276f8a248f4e7a93d5c7282f` | open draft; current authored-ground relation line |
| Central NOW/DAY | #75 `agent/projectcentral-now-day` | `ab354c1278396b0d50620bf8a43c40eedc26b907` | open draft; current temporal working-field line |
| Central governance | #80 `feat/layered-agent-governance-sources` | `9068b1452a270124a75039a9328a8e1e664d0e25` | open draft stack; AIKit owns operational precedence |
| Actuation realised loop | #17 `agent/realised-actuation-loop` | `85ac3dee1eb9cc1ad0761eb8451ae51d2167c4e3` | open draft; current WHAT-of-instantiated-agency reading |
| AIKit praxis/reflection | #115 `agent/praxis-project-reflection` | `e36e8fc98ec9b6ee126dcc4cb7ea32081065515a` | open implementation; current Method/project-reflection line |
| AIKit harness adapter | #116 | `9974e7ed61a57123442b2f464a1d174081a55bac` | open draft stacked on #115; current public harness-adapter line |
| Factory reflection | #159 `agent/projectcentral-praxis-reflection` | `60e61c29172a92badd2658e6df6aae38a2365171` | open implementation; current ProjectCentral/praxis/reflection consumer |
| Epi host foundation | O:I #87 `agent/oi-epi-mode-kernel-bridge` | `aa4bc55198461feaa68d1adccd44383af4dbe417` | active convergence exception; domain Surface, not generic blocker |
| Epi Nara | O:I #88 `agent/oi-epi-nara-lived-vertical` | `f9f1a53111826938e6d6791b761973e50628cb38` | active stack; rich native Nara Surface |
| Epi Personal | O:I #89 `agent/oi-epi-personal-450-return` | `b1b42f3a0a90eea157fcd9377b3d4d3108d6184c` | active stack; Nara/Epii/Anuttara return |
| Epi PRE-D | O:I #100 `agent/oi-pre-d-personal-map-lineage` | `7bd18d15e367113fdd8be2410d1e3fecd8664408` | active stack; coordinate-lineage host reconciliation only |

O:I #96/#97 own final convergence selection. O:I #65 owns physical/developer/two-person acceptance. This P0 ledger does not merge/rebase/race those lines.

## 3. Inherited desktop substrate — do not rebuild

O:I #94 / PR #99 already implements the generic workbench substrate against AIKit main `42127820d6e5bf4ea5ee248e88e305e14c5c1a7c`:

- `SessionSpaceApplicationStore` list/read/focus/history and authored stage/apply/basis/receipt authority;
- stable SessionSpace identity separated from runtime observation;
- canonical AgentSession over AIKit ACP connection/process seams, with provider-native session IDs remaining distinct;
- Knowledge path `ProjectCentral → SemanticWikiIndex/Provider → KnowledgeApplication → O:I`;
- Search/LIST/TREE/GRAPH/Reading/Explain/History over stable refs;
- one stable semantic subject across canvas/Knowledge/AgentSession encounter/Explain/History/SessionSpace focus;
- native Action authority retained through privileged dispatch rather than O:I callbacks.

Remaining #94-era real-provider/restart/target-activation proofs belong to #65 / native owner acceptance. **They are not a requirement to re-design or re-implement the semantic floor in #105–#110.**

## 4. Product surface ledger

Legend for Desktop disposition: `NAVIGATOR · CANVAS · SIDECAR · LOWER · SYSTEM · COMMAND · EXPLORE · ALTERNATE-NATIVE · NOT-HUMAN-FACING · DEFERRED`.

### 4.1 Central — authored human/project ground

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| Work / ProjectCentral | Central Project/Work refs; ProjectCentral inspection/adopt/migrate services | Central source identity; existing source remains source | main `ctrl/src/projectcentral*.rs` | CLI/headless real; AIKit consumes refs/read models; MCP/A2A N/A | NAVIGATOR, CANVAS, SYSTEM | CONSUME; no DesktopProject store |
| Core Central Actions | `ActionDescriptor`, `ActionRegistry`, `action.list`, `work.*`, machine/recovery/control actions | Central handler registry; mutation class explicit | main `ctrl/src/action.rs` | CLI/headless real; structured Agent path via native Action/resource ingestion where composed | COMMAND, SYSTEM | CONSUME; desktop must not call filesystem/connectors directly |
| Human-authored Ground | `projectcentral.ground.inspect/plan/apply`; source relations `central.project.ground-relations/v1` | `human-accepted`; path does not prove authorship; source bytes/path retained | active #73 `7865...` | structured read/action line; AIKit account/Wiki consumers; MCP/A2A N/A | NAVIGATOR, CANVAS, COMMAND | CONSUME ACTIVE; selection != disclosure; do not promote Agent output by location |
| Agent Wiki | canonical ProjectCentral Agent Wiki source / WikiSpace; Central source separate from AIKit semantic maintenance | Agent-maintained source; difference never auto-mutates human source | main ProjectCentral + AIKit main Knowledge | TUI/CLI/Agent Knowledge via AIKit; desktop via PR #99 | NAVIGATOR, CANVAS | CONSUME; no DesktopWiki |
| NOW / DAY | `projectcentral.now.inspect/init/return/update/promote/rollover`; bounded refs | human scratch direct; Agent returns attributed; human durable promotion requires `human-accepted`; Agent wiki return `agent-return` | active #75 `ab354...` | CLI/headless current owner; AIKit ContextSource consumer expected | NAVIGATOR, CANVAS, SIDECAR contextual, SYSTEM | CONSUME ACTIVE; no Session/Run/Focus replacement |
| Agent governance | root/project governance source refs/read models | human-authored/adopted; AIKit owns precedence/composition | active #80 `9068...` | structured source read; operational resolution in AIKit | SYSTEM, NAVIGATOR | CONSUME ACTIVE; never make Central prompt-resolution owner |
| Personal proposal/notification | `personal.show`, proposal/review/apply, `personal.notify` on current Central Action line | explicit proposal/adoption; connector caller lineage where supported | existing Central programme | CLI/headless/native connector; UI should invoke same Action | SIDECAR, SYSTEM, COMMAND | CONSUME; no O:I notification/source mutation authority |
| Machines | authored + observed + derived machine account, native machine Actions | authored != observed; provider facts remain evidence | Central machine-account/action lines | CLI/headless; Workcell provides live material facts | SYSTEM, LOWER inspector | CONSUME; do not turn Central into Workcell observation DB |

**Central gap ownership:** owner-world physical acceptance remains Central #76 / O:I #65. Active #73/#75/#80 must be consumed as active/current until convergence selects accepted revisions. No new desktop-native semantic seam is required.

### 4.2 Actuation — WHAT agency is instantiated

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| Agent / Agency | `actuation.agency/v1` family; Agent/Agency identity distinct from model/session/body | WorldBinding, RootScope, MetagencyGrant, Determination; visibility never grants authority | accepted main + research/contract ancestry | structured/native; no need for generic human mutation Surface | SIDECAR, SYSTEM | CONSUME; no O:I Agent identity |
| Realised Actuation | `actuation.realised/v1` read model; body/session/material refs opaque | availability != authority; continuity delta preserves Agent identity | active #17 `85ac...` | structured read for Agent/system; transport projections owner-dependent | SIDECAR, SYSTEM | CONSUME ACTIVE; WHAT only, not AIKit HOW |
| ActuationStream | stream/event/trajectory refs owned by Actuation | observed trajectory; no hidden chain-of-thought | current Actuation contracts | structured Agent/read path; GUI rendering optional | LOWER, SIDECAR deep | ADAPT read presentation only |
| Return | Return refs/difference/recognition relation | determining/recognition authority remains native | accepted/active Actuation contracts | structured; downstream Factory/Central may retain refs | SIDECAR, LOWER, SYSTEM | CONSUME; do not equate with A2A return or Factory Run |

**Actuation gap ownership:** no missing desktop semantic owner seam was found. #17 is current active implementation of the realised loop. Any richer action authority must remain situated Agency/WorldBinding/Determination semantics, not System visibility.

### 4.3 AIKit — HOW the operative world is resolved/projected

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| Resource field | stable `ResourceRef`, `ResourceRecord`, `ResourceKind`; `ResourceIndex` | source/provider/eligibility/preference are distinct | main `resource/*` | same field feeds human search and ContextResolution | NAVIGATOR, COMMAND, SYSTEM | CONSUME DIRECTLY; this is P1/P2 shared identity floor |
| Contextual Actions | canonical `ResourceKind::Action`; `ContextualActionDescriptor { action, subject, stageability }` | discoverable/stageable does not imply trusted/eligible/authorised | main `resource/search.rs`, `action_search.rs` | structured Action horizon; one Action identity across subjects | COMMAND, SIDECAR, SYSTEM | CONSUME DIRECTLY; no O:I Action catalog |
| ContextResolution | project + scopes + Agent/Agency/Host + capabilities/actions/context sources/models/harnesses/execution offers/projection/retrieval | availability independent from eligibility/preference; exact resolver/catalog evidence | main `context_resolution.rs` | CLI/TUI/Agent consumers can read same resolution | SIDECAR, SYSTEM, COMMAND | CONSUME DIRECTLY; presentation must show axis distinctions |
| KnowledgeApplication / SemanticWiki | KnowledgeAddress/readings/search/LIST/TREE/GRAPH/Explain | source authority retained; bounded retrieval | main Knowledge family + PR #99 host | TUI/CLI/Agent structured; desktop inherited | NAVIGATOR, CANVAS | CONSUME; no parallel graph/wiki store |
| ProjectMap / CodeReferences | semantic/source/code refs and provider readings | code index remains provider/source-owned | main + active #115 reflection | structured Agent/read; human graph/tree/list | NAVIGATOR, CANVAS, SYSTEM | CONSUME; reverse code→meaning only from real anchors |
| Skills / SkillSets / Methods / UsageOverlays | stable resources; Method composes existing skills/actions/context refs | Method downstream of ContextResolution; no new authority | main Skills + active #115 `e36e...` | TUI/CLI/Agent structured | NAVIGATOR, SYSTEM, SIDECAR detail | CONSUME ACTIVE where Method needed |
| SessionSpace | stable `SessionSpaceRef`, authored application state + runtime observations; stage→preview→basis→apply→receipt→re-read | AIKit owns authored SessionSpace relation; host/provider refs remain external | main `session_space_application.rs`; PR #99 consumes | TUI/CLI/desktop/Agent-addressable through AIKit app services | SYSTEM, SIDECAR, canvas host relation | CONSUME INHERITED; never recreate #94 |
| AgentSession / ACP | canonical AgentSession separated from ACP/provider session and Agent identity | adapter/provider capability governs create/resume/send/cancel | AIKit adapter floor + PR #99 | desktop sidecar + alternate native harness/terminal; ACP is one transport | SIDECAR, ALTERNATE-NATIVE | CONSUME INHERITED; no DesktopChat |
| Explain / History | native Explain/History resources/actions and evidence | read-only explanatory authority; provenance retained | main exports `explain_history*` | TUI/CLI/Agent/desktop | SIDECAR, SYSTEM, COMMAND | CONSUME |
| HarnessComposition / Components / Contracts / Surfaces | composition/read/diff/stage/apply bindings | authored/effective/active distinctions; target activation evidence | main composition family + active #116 `9974...` | CLI/TUI/Agent; alternate target Surfaces | SYSTEM, SIDECAR deep | CONSUME; provider/target facts not semantic identity |
| Harness adapter SDK | `aikit.harness-adapter/v1`; discover→plan→project→activate→verify→explain→update/retract | exact edition/version/source; degraded/unsupported explicit | active #116 | harness-native/CLI/structured Agent; desktop inspects | SYSTEM, ALTERNATE-NATIVE | CONSUME ACTIVE; physical target proofs remain owner acceptance |
| Models/providers/credentials | Resource records + candidates/provider offers/credential refs | secret material never ordinary UI state; availability observed | accepted main | structured; human System projection | SYSTEM, SIDECAR detail | CONSUME; Workcell material facts remain separate |

**AIKit gaps:** persisted/live real provider and target activation/edition proofs remain AIKit #114/#116 and O:I #65. No evidence of generic MCP/A2A parity for every AIKit resource/Action was found; record `N/A` unless a native projection actually exists.

### 4.4 Software Factory — developmental application / Build

#### Source-fidelity disposition

Current Factory **main** already contains the SSSF-derived GUI and source-fidelity record. It is not a future design only.

Pinned upstream:

```text
upstream: disler/super-simple-software-factory
revision: de31374882e7a4e3e5b7bb9bd09e69dc2f779356
visualizer: .claude/skills/sssf/apps/visualizer
```

Current Factory files:

- `factory-ui/README.md`
- `docs/GUI-SSSF-SOURCE-FIDELITY.md`
- `factory-ui/src/BuildSurface.tsx`
- `factory/src/build.rs`
- `factory/src/build_provider.rs`

Classification:

| SSSF / Factory body | P4 disposition |
|---|---|
| execution trace chronology/waterfall | **MECHANICALLY PORTED / CONSUME DIRECTLY** from current Factory React port |
| session cards, phases/spans, tools args/results, pagination behaviour | **CONSUME DIRECTLY**; do not redraw from screenshots |
| direct SSSF SQLite/Bun storage | already **REPLACED FOR EXPLICIT REASON** by Factory read-model/provider seam |
| Vue renderer | already **REPLACED FOR EXPLICIT REASON** by Factory React port for O:I host |
| semantic Project/Run/frontier/Candidate/Claim/Evidence/HumanRequest depth | **CONSUME DIRECTLY** from `BuildSurface` |
| Live Agency/Execution/AgentSession/SessionSpace/Harness/Workcell refs | **CONSUME DIRECTLY**; native refs only |
| O:I visual tokens/layout integration | **ADAPT** host presentation only; preserve density/chronology |

`BuildSurface` already exposes three depths: `semantic`, `live`, `trajectory`. Its semantic buttons emit only `{ actionRef, subjectRef }`.

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| Project / Run / frontier / Candidate / Claim / Evidence / HumanRequest | Factory refs/read models | Factory canonical developmental state | Factory main `factory/src/build.rs` + broader Run core | structured Agent can read owner models; UI not semantic owner | CANVAS, NAVIGATOR, SIDECAR selection | CONSUME |
| Build read model | `factory.build-view/v1` snapshot/read model | provider provenance includes Factory state/Run/RunMap revisions | main | embedded/structured read possible through provider | CANVAS | CONSUME DIRECTLY |
| Build Action | canonical ActionRef(s), currently including `REQUEST_MORE_EVIDENCE_ACTION_REF`; subject+run invocation | `FactoryActionAuthority` + native owner/capability grant; `FactoryActionExecutor` authoritative handler; `FactoryBuildFileProvider` persists and rereads | main `build.rs` / `build_provider.rs` | desktop Action projection real; broad external projection parity not complete | CANVAS, COMMAND | CONSUME; do not make O:I handler |
| SSSF trajectory | native trace/provenance refs, no semantic-ID substitution | evidence/provider provenance | main Factory UI | Agent structured path reads trace/read models rather than DOM | CANVAS, LOWER | CONSUME DIRECTLY |
| praxis/project reflection | Run-bound ProjectDevelopmentLedger, owner-return proposals | source/meaning/code owners retained | active #159 `60e6...` | structured | NAVIGATOR, CANVAS, LOWER evidence | CONSUME ACTIVE where landed |

**Factory genuine gaps:** broad Action catalog/policy/caller-lineage and external projection parity remain correctly owned by existing Factory #49, #71 and #73. The current Build Action proves a native authoritative handler path, but P0 does **not** claim full CLI/MCP/A2A parity. #108 can proceed by consuming the current Build body; #111 must use only a projection actually implemented at final acceptance.

### 4.5 Workcell — material execution/services/providers

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| Workcell material domain | Workcell/material refs, ExecutionDemand, BindingGraph, MaterialisedExecutionWorld | provider/binding IDs are material provenance only | main Rust workspace | client/CLI structured; no need for MCP/A2A semantic projection | SYSTEM, LOWER | CONSUME read model |
| control operations | `discover · plan · prepare · observe · expose · collect · release · reconcile` | Workcell control/application layer owns material mutation; semantic caller retains Project/Run/etc identity | main architecture + core/control/CLI crates | native CLI/embedded client real | SYSTEM, LOWER, COMMAND where safe | CONSUME; no React provider calls |
| providers/offers/placement | provider-neutral requirements/offers/bindings | required/preferred/optional explicit; provider loss changes availability not caller identity | main provider/runtime/placement crates | structured | SYSTEM, LOWER | CONSUME |
| process/service/storage/artifact/candidate | opaque material services and bindings | native service protocol stays native data plane | main runtime/artifact/candidate crates | structured | LOWER, SYSTEM, CANVAS links | CONSUME |
| client/provider SDK | `workcell-sdk` plus conformance programme | external/provider version/compatibility explicit | main SDK crate; owner ticket #23 remains open for full conformance | CLI/SDK/Agent-capable structured use | SYSTEM inspector; NOT a generic human editor | CONSUME CURRENT + track #23 |
| remote Control Service | same eight semantic control operations over remote service | transport != Workcell/semantic identity | owner #21 open | not accepted as full remote parity yet | SYSTEM when real; otherwise DEFERRED | DEFER CURRENT; owner #21 |
| persistent hosting | ordinary process/service/binding/storage/fabric relation; no AgentGateway ontology | AIKit owns Agent/Harness/Session meaning | owner #22 open | structured material support | SYSTEM, LOWER | DEFER physical/full conformance; owner #22 |
| Fabric/reachability | logical relationship != endpoint/path/provider | provider/path provenance; private/public/policy states distinct | owner #26 open; foundation exists | structured | SYSTEM, LOWER | DEFER rich/live proof; owner #26 |

**Workcell gap ownership:** #21 Control Service, #22 persistent hosting, #23 client/provider SDK conformance, #26 Fabric, provider-specific/physical acceptance. These are material/provider gates, not reasons to invent O:I material semantics.

### 4.6 Quaternal Logic / Epi — formal Reading vs domain Surface

| Capability / object | Canonical subject / Reading / Action | Authority / lineage | Current implementation | Agent + projection disposition | Desktop disposition | Selected integration action / gap |
|---|---|---|---|---|---|---|
| QL/MEF service | client-native subject remains itself; service requests `Capabilities`, `Locate`, `Refract`, `Relate`, `Synthesise` | QL provider/reading provenance; subject identity distinct from lens/provider/reading | QL-MEF main `ql-service` / `ql-semantic` / `ql-mef` | structured API/library reading; AIKit QL client can consume | SYSTEM capability, CANVAS/INSPECTOR where requested | CONSUME structured Reading; do not call this a domain Action |
| deterministic QL kernel/MEF registry | QL refs/forms/addresses/operators | executable formal product only; research proposition remains distinct | QL-MEF main Rust + C floor | structured/library/CLI as implemented | ALTERNATE-NATIVE / CANVAS instrument when useful | CONSUME; QL optional |
| Epi primitive host reading | stable Epi refs, e.g. Nara/M4′; O:I hosts opaque Epi-owned packet | Epi provider + QL/Epi provenance; O:I validates but does not own | active O:I #87 `aa4b...` | root Agent receives same Epi ref structurally | CANVAS, SIDECAR, SYSTEM | ACTIVE CONVERGENCE EXCEPTION |
| Nara lived Surface | protected Epi episode/selection refs; canonical `epi.action.nara.selection.sendoff` | Epi owns persistence/action; bounded grant; protected body local | active O:I #88 `f9f1...` | situated region receives exact governed selection packet | CANVAS rich native | CONSUME when convergence permits; no second Epi IDE |
| Personal 4/5/0 | same Nara selection → Epii/Anuttara/Bimba/proposal/history | Epi identities canonical; Central receives bounded refs/status; durable return requires Central human acceptance | active O:I #89 `b1b4...`, PRE-D #100 `7bd1...` | structured Epi packets + native Central Action return | CANVAS/SIDECAR/NAVIGATOR | ACTIVE EXCEPTION; host slots must remain compatible |

**QL/Epi law:** ordinary desktop correctness is not blocked by completion of QL/Epi. The current rich Epi lines are excellent P7 composition specimens if accepted/current enough at that time. Until convergence, they remain explicit branch-bound exceptions.

## 5. Explore / SharedField / A2A ledger

Current Explore application line is O:I PR #72 `d4334a2147d417baf3d192b916c3eb51e121c596`.

Canonical relation already implemented on that line:

```text
local/native source
    ↓ explicit oi.projection/v1
SpaceTimeDB SharedField
    ↓ caller-filtered subscriptions
renderer-neutral Explore application model
    ↓
SEARCH → local whole → GRAPH/TREE/LIST → Reading + WorldPresentation
    ↓ AUTHOR
same WorldPresentation → putProjection → next revision → subscription return
```

| Capability | Semantic owner / subject | Human projection | Agent / protocol projection | Authority / privacy | Desktop cut |
|---|---|---|---|---|---|
| SharedField / Participant / Projection / Contribution / Encounter | O:I shared-field semantic refs; SpaceTimeDB rows are material/storage identity only | hosted Explore | structured application/API | admission/authority explicit; local source remains native | CONSUME same application model |
| Search/READ/GRAPH/TREE/LIST | same Explore application relation | browser and desktop renderers | structured Agent access | caller-filtered visibility | desktop thin renderer; no second store |
| WorldPresentation / Projection authoring | source ref/revision distinct from projection revision | authoring UI | same structured operation where exposed | human/Participant authority; publication explicit | CANVAS/EXPLORE |
| Contribution ingress | Contribution quarantine/admission lineage (#47/#51 etc.) | social/authoring views | A2A returns enter generic ingress when routed | message/artifact does not auto-publish | EXPLORE/SYSTEM inspector |
| Watch/contact | Watch is neutral; notification is separate native Action | hosted/desktop views | structured | availability != notification authority | EXPLORE/SIDECAR optional |
| A2A binding/exchange | canonical Agent ref → distinct Participant → explicit A2A binding → endpoint/reachability | inspect/focus eligible binding | A2A v1 exchange | endpoint != Agent identity; Task != Actuation/Run; Message != Contribution; Artifact != Projection | EXPLORE/SYSTEM; no desktop A2A stack |

Privacy ladder that #110 must preserve:

```text
local source exists
!= local Agent addressability
!= retrieved
!= disclosed into Agent Context
!= rendered locally
!= selected for Projection
!= admitted to SharedField
!= public
!= remote Agent authorised
```

**Remaining owner frontier:** real hosted SpaceTimeDB + actual local Projection provider, first genuinely authored world/human acceptance, live AIKit effective contribution field, one real canonical Action through native owner+Evidence, second independently authored world/federation. These remain O:I #18/#24 descendants and #65; they are not a reason to fork desktop Explore.

## 6. Gap ledger

| Gap type | Exact gap | Owner | Existing owner ticket / line | Desktop consequence |
|---|---|---|---|---|
| HUMAN-SURFACE | professional host frame does not yet compose all native contributions | O:I | #105 | implement host/presentation only |
| HUMAN-SURFACE | Central/Knowledge/project field not yet presented as one professional navigator/editor | O:I presentation over Central+AIKit | #106 | consume stable refs/readings; no DesktopWiki/fs backdoor |
| HUMAN-SURFACE | situated agency not yet presented as full sidecar/Cradle | O:I presentation over AIKit+Actuation | #107 | consume #99 + Actuation #17 + AIKit resource horizon |
| HUMAN-SURFACE | Factory GUI not yet hosted as O:I workbench Surface | O:I host; Factory owns body | #108 | import current `factory-ui`; no redraw |
| HUMAN-SURFACE | suite composition not yet legible in one System workbench | O:I | #109 | render native authored/effective/active/staged states |
| HUMAN-SURFACE | desktop Explore not yet harmonised with hosted Explore | O:I | #110 / #18 | thin renderer over same app model |
| AGENT-SURFACE | Factory broad CLI/headless/MCP/A2A projection parity incomplete | Software Factory | #71, #73; catalog/lineage #49 | do not fake parity; final P7 uses only real projection |
| AGENT-SURFACE | some Workcell remote/provider paths not service-backed/conformance-proven | Workcell | #21/#23 | local/native structured control can be used now; show unavailable/deferred remote truthfully |
| PARITY | final real Action has not yet been proven through desktop + situated Agent + external/headless on final candidate | O:I acceptance + native Action owner | O:I #111 plus native owner fixture; Factory #71/#73 if Factory Action selected | P7 barrier only, not P1–P6 blocker |
| DISCLOSURE/AUTHORITY | Central Action acceptance currently semantic in active Ground line, not cryptographic caller attestation | Central | current #73 boundary / future strengthening if required | UI must not imply stronger caller proof than owner records |
| DISCLOSURE/AUTHORITY | UI selection vs actual AIKit Context disclosure must be surfaced truthfully | AIKit/O:I presentation | AIKit ContextResolution/Explain + #106/#107 | preserve state distinction; no auto-disclosure |
| DISCLOSURE/AUTHORITY | Explore/A2A returned material requires explicit ingress/admission/projection | O:I | #18/#24 security descendants | A2A exchange never publishes by itself |
| physical/provider acceptance | real model, target adapter, Workcell remote/fabric, owner Central world, hosted Explore | native owners + O:I acceptance | O:I #65; Central #76; AIKit #114/#116; Workcell #21/#22/#23/#26; O:I #18 | not P1–P6 semantic blockers; final acceptance reruns on real candidate |

No genuinely unowned native semantic gap was found; therefore #104 creates **no mirror native-owner issue**.

## 7. Returned implementation cut for #105–#111

### #105 — professional workbench frame / Search / Command

Consume:

- PR #102 design directly while open;
- #99 stable SessionSpace/selection/Knowledge/AgentSession substrate;
- AIKit main `ResourceRef` + `ResourceSearchIndex` + contextual Actions + `ContextResolution`.

Implement only professional host mechanics: Navigator/Canvas groups/splits/Sidecar/Lower/System shell, local presentation persistence, Search/Command rendering and canonical dispatch routing. Search/Command must never become an O:I Action registry.

Can start immediately. Do not wait for #94 physical proofs. Do not race #99/#102; integrate by contract/stable refs.

### #106 — Projects/files/Ground/Knowledge

Consume:

- Central main ProjectCentral + Action registry;
- active #73 Ground, #75 NOW/DAY, #80 governance as current owner lines where needed;
- AIKit main KnowledgeApplication/SemanticWiki/ProjectMap/CodeReferences/ResourceRef;
- #99 inherited Knowledge host.

Implement human presentation/editing through native source/application services. Preserve `selected != retrieved != disclosed`, human source != Agent Wiki != derived NOW/DAY. No Tauri ambient fs or DesktopWiki.

Frame placement depends on #105; data adapters/read models can proceed in parallel.

### #107 — Agency sidecar / conversation / Cradle

Consume:

- #99 canonical AgentSession/ACP implementation;
- AIKit Resource/Context/Action horizon and Explain/History;
- AIKit #116 where adapter/edition capability truth is needed;
- Actuation main + active #17 realised Actuation reading.

ACP is one conversation Surface. Sidecar must additionally expose selected stable subject, bounded Context disclosure, legal native Actions and Actuation/Return depth. No O:I Agent identity, runtime or transcript store.

Sidecar host depends on #105; owner adapters can progress in parallel.

### #108 — Factory Build

**Start from Factory main, not screenshots or memory.**

Consume directly:

- `factory-ui/src/BuildSurface.tsx`;
- `factory-ui` SSSF trace components;
- `docs/GUI-SSSF-SOURCE-FIDELITY.md`;
- `factory/src/build.rs`;
- `factory/src/build_provider.rs`.

Preserve semantic/live/trajectory depths and current source-fidelity behaviour. O:I supplies hosting, shared selection and visual-system retrofit only. Current GUI already emits canonical `{actionRef, subjectRef}` to a Factory-owned executor/provider.

Do not wait for Factory #49/#71/#73 to import the GUI; those issues own broader catalog/lineage/external projection parity and feed #111 where required.

### #109 — System

Compose, do not centralise:

- Central authored/config/machine source/readings;
- Actuation Agency/Actuation/authority readings;
- AIKit ContextResolution, composition, model/provider/credential/harness/Surface state;
- Factory owner configuration/read models only;
- Workcell material/provider/binding lifecycle;
- optional QL service/readiness.

Show AUTHORED / EFFECTIVE / ACTIVE / STAGED / EXPECTED EFFECT / PROVENANCE as distinct. System renders Action/resource exposure but never becomes authority.

Largely parallel once #105 region exists.

### #110 — Explore

Consume PR #72 renderer-neutral Explore application model and current SharedField/A2A/security line. Desktop Explore is a workbench renderer of the same Search/Reading/GRAPH/TREE/LIST/WorldPresentation/Projection relations as browser/structured Agent access.

No desktop social ontology, no implicit source mutation, no A2A publication shortcut. Hosted/federation real-world acceptance remains #18/#65.

Can progress in parallel after the #105 canvas contract; provider work remains independent.

### #111 — final parity / whole-application acceptance

Barrier after the required #105–#110 slices and final convergence selection.

Regenerate this ledger against accepted final revisions and prove **one real canonical Action** through:

```text
desktop human
+ situated Agent
+ one actually implemented external/headless projection
```

with identical:

```text
subject Ref
ActionRef
native handler
authority semantics
caller lineage
result semantics
Evidence / Return relation
```

Preferred candidate should be selected from returned final reality, not predetermined. Factory's current Build Action already has a native GUI→handler path, but Factory #71/#73 must supply a real external projection before it can be claimed as the P7 three-way fixture. A Central Action is a valid alternate only if the situated-Agent path preserves the required caller/authority lineage in the final cut.

P7 also reruns #96/#97 selected-main and #65 physical/degraded/security evidence. QL/Epi is an optional rich composition specimen, not an ordinary desktop blocker.

## 8. Dependency and parallelism graph

```text
#104 P0 reconciliation  ← this ledger
        │
        ▼
#105 stable professional host + shared Search/Command contracts
        │
        ├────────► #106 Projects/Ground/Knowledge
        ├────────► #107 Agency sidecar
        ├────────► #108 Factory Build
        ├────────► #109 System
        └────────► #110 Explore

Native adapter/read-model work for #106–#110 may proceed in parallel
before all #105 polish is complete, provided they target the stable host contract.

#111 = barrier over required #105–#110 slices
       + one real native three-projection Action fixture
       + final selected convergence revisions
       + physical/degraded/security acceptance where required
```

Do **not** serialize #106–#110 behind one another. Do **not** serialize P1–P6 behind QL/Epi convergence. Do **not** reopen #94.

## 9. Already solved — must not be rebuilt

1. AIKit stable ResourceRef/resource field and contextual Action search.
2. ContextResolution separation of availability/eligibility/preference and native resource horizons.
3. SessionSpace authored/runtime distinction and application mutation law.
4. #94/#99 SessionSpace + AgentSession/ACP + Knowledge desktop substrate.
5. AIKit KnowledgeApplication/SemanticWiki/ProjectMap/Explain/History floor.
6. Central native Action registry and ProjectCentral source identity.
7. Central active authored-Ground/NOW-DAY/governance owner lines; consume without stealing their semantics.
8. Factory current SSSF-derived React GUI, source-fidelity map, three-depth Build body and native Build Action executor/provider.
9. Workcell provider-neutral material identity, BindingGraph/MaterialisedExecutionWorld and eight-operation control grammar.
10. QL-MEF typed service/readings (`locate/refract/relate/synthesise`) with preserved client subject identity.
11. Explore renderer-neutral application relation over SharedField + WorldPresentation/Projection.
12. A2A identity/admission distinctions and generic Contribution ingress/security line.
13. Current Epi native/pratibimba Surfaces as active domain specimens; host them, do not reconstruct them.

## 10. Next execution order

1. **#105** — establish the stable professional host and native Search/Command presentation contract.
2. **In parallel:** #106, #107, #108, #109, #110 against that host contract; begin owner adapter/read-model work immediately where no frame dependency exists.
3. Prioritise **#108 early in the parallel wave** because the actual Factory GUI already exists and is a high-value proof that the host can consume a rich native product without semantic copying.
4. Prioritise **#107 alongside #108** because #99 already supplies the canonical AgentSession substrate and the sidecar is the human/Agent co-reference spine for the rest of the workbench.
5. Let #106/#109/#110 integrate their native worlds in parallel; do not create cross-product semantic dependencies for presentation convenience.
6. **#111 last**: select an actually real canonical three-projection Action, rerun ledger/parity on accepted revisions, then execute physical/degraded/security/human acceptance.

This is the authoritative P0 implementation cut until final convergence changes an owner revision. Any such change should revise this ledger explicitly rather than being silently absorbed into desktop code.