# Central product-fidelity review — 19 September 2026

**Desk:** Central. **Finding prefix:** CT. **Standing:** evidence-qualified review, not a new specification, release gate or implementation commission. **Publication scope:** this file and [02-central-evidence.md](02-central-evidence.md) only.

**Conclusion.** Central already has a substantial native architecture for a human-owned root meta-Project: in-place source relations, source-qualified reading, durable practice, bounded native Actions, temporal source, receiving and material-placement policy. The important defects are not adequately described as “Central is only a configuration directory” or “the whole system needs rebuilding.” They occur where older adoption writers, temporal consumers and current UI readers fail to preserve or complete the architecture. Two bounded executions against the published Central binary demonstrate an adoption race and an incompatible temporal call. The receiving pagination defect and the new Context panel’s root-scope exclusion are directly visible in callable consumer code. Original HTML document fidelity, complete Workcell-root-NOW inhabitance and actual later-agent loading remain distinct from these established defects.

## 1. Intended experience, authority and scope

### 1.1 The product recovered from its sources

The human-position sections of [Central’s account][central-account] describe a minimal, recursive filesystem home for Human–Agent work: conditions around an Agent’s activity persist outside a harness session; ordinary projects retain their useful source; a person deliberately tends what propagates into later work. The [vision][central-vision] and [Control source protocol][control-protocol] make this more than a directory convention. Central is the root meta-Project in which personal intention, project relations, machine declarations, continuing work and durable practice have identifiable homes. A child Project is a situated participant in that ground, not the model for the root itself.

The source distinction is substantive. Human-authored or explicitly adopted intention is not an Agent inference; an observed machine state is not a desired declaration; a generated projection is not its master; an Agent-maintained Wiki is not permission to rewrite human ground. Roles, standing, authorship, scope and revision must survive inspection, selection, editing, projection and subsequent use. Filename conventions can discover candidates but cannot ratify their authority.

The intended experience therefore includes ordinary external-editor work, root and Project discovery, adoption without forced copying, explicit migration, current and historical source reading, Wiki relations, durable Agents/profiles/Skills/Methods, machine declaration/recovery, source returns, Day/Flow/NOW continuity, settings and native operations. It cannot be reduced to a successful `ctrl root`, a settings screen, or one demonstration Flow.

### 1.2 Source precedence

This review follows the [common protocol][review-protocol] and [frozen vector][review-baseline], both read in full before the investigation. The [founding positions][founding] govern native ownership. Central’s account and source protocols establish product meaning; its [capability matrix][matrix] is an explicitly source-recovered, largely **agent-inference** inventory, not human acceptance of every cell. The native Action catalogue establishes callable exposure, not end-to-end fitness.

[O:I #65][spine], [#220][caw-spine], [#268][adoption-spine] and [#375][ui-spine], read with their substantive corrections, govern the current receiving experience. The [session grounding][session-grounding] and [Workcell/NOW temporal field][temporal-field] supply the material-temporal distinction. Relevant native developments include Central [#150][c150], [#151][c151], [#152][c152], [#153][c153], [#167][c167] and [#180][c180]. Issue/PR statements in this report were retrieved on **19 September 2026**; their text is mutable. Specific historical assertions below retain a comment URL, exact candidate SHA, or the stated receipt time.

Two corrections matter particularly. The root is not a fake child Project created to satisfy a consumer’s parameter. And the older account’s “Central first install” must not be universalised into a compulsory learner install: #268’s later hosted 5/0 Library-learning correction is distinct from the useful native Central/Actuation/AIKit adoption route. Likewise, current parallel-UI work is the receiving design; the donor app is implementation evidence, not permission to restore a superseded layout.

### 1.3 Exclusions and method

QL-MEF internals, production changes, Skill edits, canonical-source edits, issue-state changes, deployment, runtime commissioning and active Day/NOW work were excluded. Repository evidence was read through the native GitHub connector. Existing CI artifacts were inspected. The only executed product probes used an already-published Linux `ctrl` artifact in new disposable reviewer-container directories, with an empty HOME and no providers, models, remote services or user World. The annex records exact scope and results.

This is a complete report of the investigation performed, **not a claim to have executed every public Action, exhaustively audited every implementation line, or certified the private running UI**. Coverage limitations are explicit in sections 3 and 10.

## 2. Revision and evidence ledger

### 2.1 Published vector and bounded final recheck

| Owner | Frozen baseline | Final published recheck before report publication | Consequence |
|---|---|---|---|
| Central | `0a58a32c7587f5576ace4239a1fd6d9bde868510` | Same | Central findings remain applicable to published source. |
| AIKit | `944e00e1cbec79d4a23b46d78231b78816b5dad5` | Same | Both the older temporal hook and newer placement/source adapters are present. |
| Actuation | `47f4fa3c184850e254ef5089696bf5fbbad907ec` | Same | Source-bound Agency admission remains separate from profile persistence. |
| Factory | `bbb8f48943cf1cf398005ae40ee8fa29c111c3a5` | Same | Native attempt placement and receiving adapters inspected at this cut. The canonical repository is `EpiLogos/Factory`. |
| Workcell | `04160f51d37e78d600f32440b4f5275c02b78e9c` | Same | Directory-storage/material ownership inspected at this cut. |
| O:I | `a1c7010fa290219d58f78ee03f55651ac14ed75d` | `a5012f5aa44d0fed317a261b009250d70013ccb5` | Four commits ahead. The compared file list includes namespace/configuration/update changes and the review packet; it does not change the inspected receiving panel, receiving client, NOW detail or material client. No blanket claim is made that all intervening code was audited. |

The [bounded O:I comparison][oi-final-compare] is part of the revision qualification, not a reset of the six-owner baseline.

### 2.2 Pushed candidates and actual UI

| Candidate | Exact source and disposition | What this review establishes |
|---|---|---|
| Central [PR #161][c161] | Head `7bc00200e75427d69f726e2df94d669699637b0b`; open, unmerged, reported non-mergeable at final read; retained CI test-merge `fece91246f28acc2d52d5159e304829c4def80af` | Source/artifact inspection supports already-implemented document reconciliation/restoration, notes, fair root receiving, retained draft evidence and separate acknowledgement/pending facts. These are integration work, not missing features to commission again. The candidate explicitly does **not** implement the complete original standalone HTML editor/import experience. |
| O:I parallel UI | `agent/expression-world-convergence-20260917` at `7747d5e67d2814a29a44788d0b901750cb553215` | Actual pushed `ContextPlane`, `SettingsPageV2` and `DocumentReturns` were read. The branch diverges from the frozen O:I baseline, with merge base `35fa86d4bb8f22b91723e6784113a745caa3e272`; it is not interchangeable with current main. The Returns blob is `21f62ba601d69c6c299024374a7918f1090e6677`, the same reviewed implementation. |
| Unpublished local UI/work | Dirty local continuation described in #65; no exact readable local tree available here | No claim that pushed code equals the current running UI or contains every local repair. No local process, installation or workspace was touched. |

PR #161’s retained artifact is from [run 34645210224][candidate-run], artifact `10282007135`, ZIP SHA-256 `80c1ac36b22f95fe5ff1a4d336fba78e2ed3c1e323d62a72751ec670ef63e572`. The retained log reports 428 passed across its test summaries. That is evidence at the **test-merge**, not a new run of today’s main, original-template acceptance, or private-machine proof. Its successful concurrent task allocation also does not cover the older Project-adoption writer tested in CT-002.

### 2.3 Returned installed cut

The [#65 cut receipt][cut-receipt], created **2026-09-19 15:52:30 UTC**, reports Mac installation of O:I `d6d92503`, Central `0a58a32`, Actuation `47f4fa3`, Factory `bbb8f48`, with AIKit `944e00e1` and Workcell `04160f5` already installed. It reports successful doctor/verification and explicitly **defers actual app-consumer/physical acceptance**. This is returned owner evidence, not execution by this reviewer. Existing resident sessions and companion binaries must retain their own identities; an installed CLI hash does not certify their loaded code, source or practice.

### 2.4 Executed reviewer evidence

The published Central artifact came from [run 35451667163][baseline-run], artifact `10586801877`. ZIP SHA-256: `e9d9ee055827a68d4dc0b5423d84183bdb30a58e0daf1231f2163db77180849b`. Executed binary SHA-256: `eeebe0b2d1ac3ab7fbd90481b5272e72b14bad5dae11b9197cd610df20a57b3f`; reported version `ctrl 0.1.0 (0a58a32c7587)`.

The annex separates four observations: 167 registered Actions; rejected obsolete Flow call; parallel Project initialisation failures; and accepted benign out-of-Project symlink adoption. A native configuration contribution was also read successfully. None of these observations establishes GUI quality, arbitrary-write containment or actual model loading.

## 3. Capability, entry, setting and consumer coverage

The capability matrix’s dated catalogue is historical evidence, not the complete current binary. The annex enumerates **all 167 Actions actually returned** by the pinned binary. The following field inventory combines that census with the authored capability accounts and inspected interfaces.

| Capability / meaningful entry | Producer and receiver inspected | Assessment / limit |
|---|---|---|
| Root selection, health, initialisation, recognition | `root.rs`, `recognition.rs`; native `central.root/init/doctor/recognize`; root-aware AIKit composition | Substantial good code. Explicit/canonical root recognition is stronger than the older adoption path. Initialisation executed only in a disposable World. |
| Existing Work listing, search, open/reveal; personal entry | Matrix, CLI/public descriptors and root/project callers | Public powers recovered. Real OS opening, notification and physical picker interaction not executed. |
| Project inspect/init/adopt/migrate and reproject | `projectcentral_ops.rs`; AIKit `ProjectCentralFilesystemBinding`; native catalogue and reviewer probes | CT-002/003. Original files preserved in the probes. Explicit migration is legitimate, not redundant materialisation merely because it copies. |
| Authored ground, self-description, tier/UX/EX relations, remembered proposals | Control protocol, matrix, public `ground.*`, `self.*`, `remember` descriptors; AIKit source/actor consumers | Meaning recovered; not every mutation or guided-authoring path was executed. No inference that a generated proposal is recognised. |
| Source authorship, roles, exclusions and World propagation | Control protocol; `file_map.rs`, `source_history.rs`; AIKit World-policy and Project source adapters | Current native map preserves canonical identity, explicit external registration, managed-link verification and scope policy. CT-003 concerns the older adoption entry, not absence of these protections everywhere. |
| Native file inspection, write, history and restoration | Public `central.files.*`, authored filesystem contract in matrix; source/document consumers | Operations present. Exhaustive binary/encoding/large-file/native-editor acceptance not inspected. Ordinary file reading must not invent semantic adoption. |
| File map, BKMR-backed index, locate/resolve, import, move and projection records | Native file-map source/registration/resolve; public catalogue; AIKit file-map and skill-source consumption | Native owner and identity seam inspected. Every backend import/move/rollback branch was not executed; preservation tests remain required before consolidating older paths. |
| Wiki reading, exact source/history/recovery and incremental changes | `source_history.rs`; source-horizon contract; AIKit ProjectCentral and knowledge service | Current source and history authority preserved. CT-007/008 cover actual consuming discovery/rebuild paths. Git provider setup and restore through the physical editor remain unverified. |
| Legacy Project NOW, handoff, rollover and promotion | `PROJECTCENTRAL-NOW.md`, registry, older AIKit temporal hook and dispatcher | Still callable and not dead. CT-001: mixed-generation hook invokes a removed Flow operation. Root legacy inspection requires `project`; this is not proof that every newer Central root operation does. |
| Native task NOW, policy, lifecycle, obligations, thoughts/learnings | `continuous_work/placement.rs`, native descriptors, AIKit current placement adapter, Factory attempt adapter | Good allocation/revalidation contract. Complete persistent per-Workcell root-NOW join remains a separate integration obligation, CT-006. |
| Human Day, civil-time policy and rollover | `continuous_work/temporal.rs`, source protocols, #150/#151, candidate recovery | Positive timezone/boundary and source-preservation code. No private Day rollover or migration run. Human Day is not task completion or a pane/process lifetime. |
| Flow/Dialogue/document editing, external changes, portable retained copies | Original HTML-facing `flow/instance.ts`; native `documents.rs`; receiving client/panel; #161 | CT-004. JSON-native document proof is useful but not proof of the original HTML editor. Candidate recovery must be integrated, not rewritten as absent. |
| Receiving, late results, review/include/recover | Native receiving; Factory `attempt_receiving`; O:I old and pushed-new UI | CT-005/006. Arrival, review, acceptance and inclusion are already distinct. Candidate fair root aggregation/acknowledgement remain unmerged. |
| Durable Agent, AgentProfile, AgentSet and World relations | Matrix/public Actions; AIKit `central_agent_profile`, `actor_composition`, `agency_admission`; Actuation actualisation | Source selection is not Agency authority. Root NativeWorld binding and exact-source admission are positive implementations. Full member availability/cycle matrix not executed here. |
| Skills, Methods, standing, retirement and later projection | `control_skills.rs`; AIKit managed `skill_sources.rs`, profile/actor composition; contribution plane | Actual snapshot/sync/promote/current-owner-revision checks read. No private Skill body or actual later harness-loaded context obtained. Method discovery/trigger quality and all target-native adapters remain partial coverage. |
| Machine intent, inspect/plan/apply/verify, recovery and notification | Authored accounts and full public catalogue; Workcell material boundary | Capability is not missing. Central’s machine declarations do not replace Workcell execution. Physical providers, OS permissions, services and recovery were not exercised. |
| Settings disclosure versus mutable contribution | Central `configuration.rs`; successful contribution read; O:I kernel configuration binding and pushed `SettingsPageV2` | Legitimate shared composition preserved. Policy disclosure is read-only; writable Skill standing uses existing Central verbs. Full UI apply/partial-failure/restart acceptance not executed. |
| CLI / agent / TUI / app / external harness | Complete native descriptor census; hook dispatch; O:I receiving/configuration and new sidebar | Same semantic operation, not identical pixels, is the requirement. Guided picker and all TUI branches were not exhaustively inspected. No claim of a missing universal Central-specific TUI. |
| QL / private corpus / installed sessions | Deliberately excluded or unavailable | No internal QL audit, private-source publication, runtime reset or loaded-practice claim. |

**Absence discipline.** Indexed code searches returned empty/incomplete results and were not used to declare absence. Known paths, repository trees, native registration and the executed catalogue supplied stronger evidence. The removed Flow claim is specifically the absence of `projectcentral.flow.list` from the pinned callable catalogue plus its actual rejection. Root Context exclusion and document pagination are statements about fully read component branches, not a search of the whole UI. No broad dead-code claim follows from these observations.

## 4. Positive architecture and implementation to retain

**Root and source.** [Root recognition][recognition] records canonical/redirected location and filesystem identity and checks structural directories without treating observation as adoption. [File-map registration and resolution][file-map] avoid minting a second identity for a Project-owned source encountered at root, require explicit external registration, revalidate managed links, enforce requesting-World relations and support expected revision. These should become the shared discipline for older adoption paths, not be replaced with another root/Project registry.

**History and human authorship.** [Source history][source-history] resolves a participating current SourceRef, checks retrieval eligibility, asks an optional native history provider, and refuses to fetch a recovery payload against a moved current basis. Recovery preview does not mutate or confer authority. A missing Git provider is not evidence that Central must make every source a repository. Existing source history, source return/proposal authority and ordinary file CAS should remain the editing substrate.

**Temporal and material ownership.** [Civil-time/Day code][temporal] reads recognised policy and preserves non-empty human material. [Task placement][placement] exposes the limits of native enforcement rather than asserting that unrelated host writes are prevented. AIKit’s [current placement adapter][aikit-placement] allocates against explicit policy, checks returned identity, revalidates the actual directory and refuses stale/expired allocations rather than silently renewing or replacing a NOW. Factory’s [attempt adapter][factory-central] independently performs policy → allocation → destination validation and fresh preflight. These are real native interfaces, distinct from the stale legacy hook.

Workcell’s [directory-storage driver][workcell-storage] binds an existing logical material reference to verified directory identity. It does not author NOW semantics or erase Central’s source. Releasing this borrowed material detaches it without deleting the directory. The separate [directory workspace provider][workcell-workspace] legitimately materialises a source into a provider-owned target; it must not be confused with borrowed writable NOW storage. O:I’s [material client][oi-material] validates receipt/world correlation and exposes sequential, non-atomic reading instead of inventing an atomic cross-owner snapshot.

**Practice and Agency.** [Central Skill manifests][central-skills] retain standing, provenance, scope, retirement and unknown authored fields. AIKit’s [managed source pipeline][skill-sources] copies validated source into immutable content-addressed candidates, includes owner revision and standing in the basis, separates sync from promotion, and revalidates owner snapshots at promotion and active-registry reading. A source edit therefore does not justify falsely saying an already-running harness has learned it.

AIKit’s [actor composition][actor-composition] reads the selected scoped profile, refuses ambiguity and rereads source. Its [Agency admission adapter][agency-admission] validates exact source bytes, invokes Actuation’s native operation, rechecks the source and suppresses imported private owner errors from shared diagnostics. [Actuation actualisation][actualisation] evaluates governing binding, grant, bounds and lineage. A durable AgentProfile is neither a grant nor an actualised Agency; a root NativeWorld binding is not an invented child Project.

**Results and presentation.** [Factory receiving][factory-receiving] submits a readable Factory Return with deterministic producer identity, source basis and available task/run/session/NOW/Day relations. It does not accept/include/Recognise the result for the human. The [document panel][document-returns] already keeps acceptance separate from inclusion, displays occurrence and receipt clocks, rereads uncertain state and exposes recovery. Preserve those behaviours while repairing its pagination and transport omissions.

**Configuration.** [Central contribution code][central-config] intentionally separates read-only authored policy from the one writable Skill-standing family. Its mutable operations delegate to native retire/restore, with derived plan/receipt state outside authored Control. [O:I’s configuration kernel][oi-config] delegates to the installed O:I composition engine rather than reimplementing product semantics. The pushed [Settings/System split][ui-settings] is a real receiving design, not an empty UI; held intent, sparse profiles, owner disclosure and native effects must remain separate axes.

## 5. Complete cross-owner traces and their proof boundaries

| Trace stage | Actual source / caller → owner → receiver | Result, failure and remaining proof |
|---|---|---|
| **A1. Existing Project is encountered** | Root/Work recognition → Project inspect/preview in `projectcentral_ops` | Source choice precedes mutation; existing source may remain in place. Root is not initialised as a child. |
| **A2. Project is adopted** | `projectcentral.init/adopt/migrate` → manifest, Wiki relations, root federation and provenance | Original files survive the reviewer probe. Concurrent calls can fail during shared federation after partial local work, CT-002. The alias preview accepts a target later withheld by AIKit, CT-003. |
| **A3. Later agent encounters it** | AIKit `ProjectCentralFilesystemBinding::inspect` → native manifest/relations, eligible source descriptors → current knowledge/actor composition | Real producer/consumer followed. Selection uses native Project identity; descriptors are not proof of loaded content. Use fresh owner resolution when material is actually required. |
| **A4. Human opens/edits and continues** | Native World/file-map locator → exact source/file read → ordinary editor/source-write or proposal → horizon/history → later consumer | Native pieces exist. External edit, relocation, exclusion and stale-basis regression must cross the same entry; do not repair by re-adopting or copying a new master. Full desktop sequence not executed. |
| **B1. Practice is found and edited** | `control.skills.inspect`, native source locator and manifest → permitted ordinary source edit or authored-change proposal | Purpose/body, Method description, scope, standing and revision belong to source. `.agents`/target projections are not editing masters. Human and Agent authority remain different. |
| **B2. Candidate is prepared** | AIKit `skill_sources::sync` → native Central source preparation/owner receipt → validated tree and content-addressed snapshot | Owner revision, bytes, standing and retirement metadata participate. Source change does not silently overwrite a promoted snapshot. |
| **B3. Practice is selected/projected** | `promote`/active registry → scoped AgentProfile/SkillSet references → AIKit effective composition → target-native projection | Promotion and trust/selection are distinct from authority to act. `active_registries` revalidates current owner basis. Exact target projection/loading must be disclosed, not inferred from catalogue membership. |
| **B4. Later agent uses it** | Existing harness or new session → actual target loading/reload → next act and returned evidence | This last physical/model-loaded step was **not executed**. Needed proof: one innocuous changed practice, exact source/candidate/projected/loaded revisions, natural subsequent task, stale and retired negatives. Do not hard-code the expected answer into a new strap. |
| **C1. Task is situated** | Existing external request or O:I session → AIKit context/profile → Actuation source-bound admission where required | External work does not gain Factory ancestry merely because visible. Root context binding already has a NativeWorld representation. |
| **C2. Developmental work requests a place** | AIKit Factory commission → Factory native Run/Attempt → `attempt_central::prepare` → `central.work.policy`, `central.now.allocate`, `central.work.validate` | Exact task, participants, source and policy returned. Factory stores its native attempt evidence, not Central’s ownership of NOW. |
| **C3. Material becomes operative** | Central allocation source/path → AIKit placement revalidation/boundary projection → Workcell material binding/observation → actual provider/session | Central temporal identity, Workcell material World/receipt, and AIKit session/provider bindings must remain related, not renamed into one ID. Read-only proofs do not establish host containment. |
| **C4. Work produces a result** | Actual worker/provider → Factory Attempt/Return and material recovery → `attempt_receiving` → `central.receiving.submit` | Factory keeps Run/Attempt/Return ownership. Central receives a proposal at exact source basis with available original lineage; receipt time does not create an occurrence time or human Day. Actual model circuit not run here. |
| **C5. Result is received and included** | Central receiving read → document/Context presentation → separate human review → include/recover → source history | Existing review/CAS/recovery retained. CT-004/005/006 prevent calling the original HTML/root/new-UI experience complete. #161 already carries several missing baseline operations. |
| **C6. Work survives interruption/day close** | NOW lifecycle/obligations + Day source → Workcell observation + AIKit session binding → reopen/attach or explicit recovery | End Day, close view, stop process, cancel task and archive NOW are different operations. No active Day/NOW or process was restarted to test them. Required discriminating tests are in section 8. |

These are source-grounded complete traces, not a claim that all stages were executed as one live circuit. The first trace has bounded Central execution; later-agent loading and the full task/provider/UI circuit remain expressly unverified.

## 6. Findings

### CT-001 — Reachable temporal regrounding invokes an Action the paired Central no longer exposes

**Seam:** AIKit → Central / `projectcentral.flow.list` via `reground_for_hook` and `read_central_temporal_ground`.

**Activity/authority.** A person resumes ordinary work in an existing harness; current NOW/Flow material should be available at session/prompt/compaction boundaries. The authority is [session grounding][session-grounding], [temporal field][temporal-field] and Central’s NOW/source capability, not a mock’s assumed response.

**Current code/evidence.** [AIKit hook dispatch][aikit-hook] calls [temporal regrounding][aikit-temporal-cli]. [The adapter][aikit-temporal] reads legacy NOW and then requires `projectcentral.flow.list`/read. A Flow failure aborts the assembled reading, discarding the usable NOW result. The pinned Central binary actually rejects `projectcentral.flow.list` with `invalid_input`, exit 2; its 167-Action catalogue contains no such Action. The root-discovery logic of this particular hook is also child-Work-path based. This is a reachable mixed-generation consumer, not dead code.

**Standing/revisions.** Static-proven paired-interface defect plus observed callee rejection. Both owners’ final main SHAs equal baseline; the returned installed CLI receipt names those cuts. Actual resident-hook execution on the Mac was not observed. Confidence high; **priority high** for ordinary continuation.

**Positive/negative.** Preserve current native NOW/source reading and the newer, separate AIKit placement adapter. Do not equate “some native temporal operation works” with a working hook; do not resurrect a deleted Flow store solely to satisfy this caller. Do not generalise this hook’s root gap to AIKit’s already-implemented root actor/Agency composition.

**Restoration/UI.** Update this existing hook to the selected native temporal/source contracts, with explicit root/child scope and independent optional source failures. Keep a useful partial reading with named denied/unavailable/version states rather than silently dropping all NOW context. The agent Context surface should show what was actually regrounded and at what source revisions; it must not claim loaded Flow when only a reference is present.

**Proof/placement.** Reuse the original hook event entry against the actual paired binary in a disposable World: initial start, an external source edit, next prompt, root invocation, missing optional Flow, excluded source and stale reference. The current unknown-Action failure must first reproduce; a disconnected/mock-only handler must still fail the test. Repository repair in AIKit, coordinated with the existing Central temporal line; real harness reload/use proof on authorised Omarchy/Mac later.

### CT-002 — Project adoption writes shared federation non-transactionally and leaves partial failure

**Seam:** Central `projectcentral.init/adopt/migrate` → `ensure_root_federation` → later AIKit Project/source discovery.

**Activity/authority.** Bring existing work into Central while preserving source, stable identity and a recoverable result. This follows the [account][central-account], [matrix lifecycle entry][matrix] and in-place source protocol.

**Current code/evidence.** [Project lifecycle code][adoption] writes multiple local artifacts and performs an unlocked root-Wiki read/modify/plain-write. Manifest publication precedes later federation/provenance steps. Twelve parallel `projectcentral.init` calls against twelve existing disposable directories produced **7 successes and 5 verification failures**, all failing to parse the shared root Wiki because of `EOF while parsing a value at line 1 column 0`. All original human files were retained; seven root references corresponded to the seven successful calls. **This run does not demonstrate lost successful registrations.** It demonstrates an observable race and partially completed failed adoption. The stricter existing-manifest check makes blind rerun an unsafe recovery strategy; that rerun consequence is source analysis, not another executed result.

**Standing/revisions.** Observed baseline defect; high confidence, **high priority**. Central final main and returned installed `ctrl` match. #161’s successful same-task allocation uses a different locking path and does not repair this writer.

**Positive/negative.** Retain original Wiki files, explicit selection, additive structure and root federation. Forbid reporting failure as though nothing changed, creating a second Project identity on retry, or resetting existing source to obtain green.

**Restoration/UI.** Use one bounded adoption transaction/recovery discipline across local manifest, federation and provenance: protect shared root updates, publish atomically, revalidate source identity, and record enough stage/basis information to resume or report partial state. Reuse the stronger existing source-safety/locking facilities after checking their scope; a whole-workspace lock or new catalogue is unnecessary. Preview and failure UI must state preserved files, published identity, remaining registration step and the exact native recovery/retry basis.

**Proof/placement.** Original CLI/agent adoption entry, parallel distinct Projects and same-Project contention; inject interruption between manifest and federation; preserve pre-existing Wiki/unknown fields; retry without duplicate IDs; inspect with AIKit afterward. Repo/CI work in Central; native filesystem proof on Linux and macOS. No active user Project migration is authorised by this report.

### CT-003 — Older adoption accepts lexical source aliases that the downstream reader will withhold

**Seam:** Central adoption preview/manifest → AIKit `ProjectCentralFilesystemBinding` source descriptor.

**Activity/authority.** Adopt an existing source in place with truthful location, scope and retrieval standing. Recognition, source identity and actual readable material must agree.

**Current code/evidence.** [Adoption][adoption] checks lexical membership and follows ordinary metadata/read operations while discovering JSON; its discovery also lacks the explicit retrieval-marker pruning found in newer readers. A harmless symlink from the selected disposable Project to a sibling JSON file was accepted by both preview and adoption, which recorded `linked.json`. The sibling bytes were unchanged. In contrast, [AIKit’s descriptor helpers][projectcentral-reader] (`push_source`, `path_agent_readable`) explicitly withhold direct symlinks and excluded sources. [Central’s current file map][file-map] already supports deliberate external registration and verified managed links.

**Standing/revisions.** Observed producer acceptance plus static consumer mismatch; confidence high for that mismatch, **medium priority**. **No private-source leak or model disclosure was demonstrated.** Downstream withholding is important counter-evidence, not a reason to describe the accepted adoption as fully usable. Baseline/final Central and AIKit unchanged; unreviewed private aliases are outside evidence.

**Positive/negative.** Preserve legitimate in-place and explicit external-source participation. Forbid silently treating a lexical path as proof of same-Project identity or agent readability; also forbid “fixing” the mismatch by weakening AIKit’s exclusion guard.

**Restoration/UI.** Bring preview/adoption onto the native location/identity/retrieval discipline. Show source owner, canonical target, encountered alias, declared external/link relation and whether the next agent may read it. Reject or explicitly route an unregistered alias; do not auto-copy the source or grant retrieval. Review `.no-agent-retrieval` consistently at discovery and use.

**Proof/placement.** Benign internal file, explicit permitted external registration, managed link, redirected/unregistered symlink, excluded subtree and source replacement between preview/apply; verify AIKit’s actual subsequent read. Central producer repair with AIKit regression; filesystem tests in disposable native environments. No weaponised/private-file probe is needed.

### CT-004 — Native JSON document success is being used beside an original-HTML experience it does not implement

**Seam:** original Flow/Day HTML (`flow/instance.ts`) ↔ Central `central.contribution-document/v1` ↔ O:I receiving/document controls.

**Activity/authority.** Continue an actual Day or Flow, write freely, retain notes/fields/media and external-editor changes, receive a result into that same source, and reopen without changing identity. [#151][c151], [#180][c180], #65 and the document capability establish the obligation; an invented smaller fixture does not replace it.

**Current code/evidence.** [Original HTML instance code][html-instance] works with the embedded `ql-doc` carrier. [Central documents][documents] parse and operate on native JSON `central.contribution-document/v1`. The [shared-field Return walk][return-walk] deliberately creates such a native JSON document and opens those bytes; it proves useful source/review mechanics, not the original standalone HTML editor. [The receiving client][receiving-client] exposes only the baseline document operations. #161 adds external reconciliation, retained-copy restoration, entry insertion and notes to the **existing JSON owner**, with separate current and last-native bases. It explicitly excludes full original-template import/standalone editing and does not make that limitation disappear by exporting HTML.

**Standing/revisions.** Source-proven carrier/consumer distinction and **active pending integration**, not a claim that no document code exists. High confidence; **high priority** for the requested everyday writing experience. #161 is open/non-mergeable at the recorded head. Pushed UI does not turn its unmerged native operations into installed capability. Private current UI rendering remains unverified.

**Positive/negative.** Preserve exact source identity, author attribution, CAS, protected human edits, sanitisation, operation history and the useful candidate recovery code. Forbid translating a person’s original page into a proxy document and claiming the original was continued; forbid filling unknown template fields or replacing Day source on mount.

**Restoration/UI.** Reconcile the existing #150–#153/#180 feature line and #161 first. Decide and implement the source-preserving carrier interface explicitly, including the actual original fields/IDs and external-byte basis. Route editor, source selection, Return and recovery to that one owner; do not create another inbox/editor store. The current UI needs a clear external-change state, compare/reconcile route, preserved cursor/selection, and review of exact proposed insertion. Blank writing and quiet empty state are first-class, not gated on a loaded conversation. Native recovery availability must be detected, not assumed.

**Proof/placement.** Use the real original Day/Flow fixtures, including all required fields, blanks, notes/replies, media and unknown retained payload. Edit externally while the page is open; deliver a stale Return; reconcile without losing human bytes; interrupt inclusion; reopen/export/restore the same source. Compare the actual file, rendered form and native history. Reuse #161’s tests rather than commission them again. Repo work in the current Central/document and O:I editor line; browser/native rendering and human writing judgement require their actual environment. Do not restart or migrate the active Day/NOW to prove a fixture.

### CT-005 — Document receiving ignores pagination, hides failures, and cannot carry the full available task lineage

**Seam:** Central `central.receiving.list/submit` ↔ O:I receiving client/kernel ↔ `DocumentReturns`.

**Activity/authority.** A person reading a source must discover its actual Returns and understand which work produced them, including late arrival. An empty result, denied read, unreachable owner and incompatible version are different states.

**Current code/evidence.** [DocumentReturns][document-returns] requests `{kind:"list",limit:50}`, filters that first page by `source_ref`, and ignores subsequent cursors. A matching Return beyond the first 50 scoped records is therefore invisible through repeated refresh. Its catch-all sets `unavailable` and returns `null`, hiding arbitrary read failures as if the owner lacked the capability. [The typed client][receiving-client] and [kernel request][oi-flow] carry `task_ref` on submit but omit the native optional `now_ref`, `day_ref`, `run_ref` and `session_ref` fields available in Central/Factory’s submission path. These are specific consumer omissions, not proof of lost lineage in Factory’s correct direct adapter.

**Standing/revisions.** Static-proven consumer defects; high confidence, **medium-high priority**. The complete component was read at both the frozen implementation and pushed UI `7747d5e`; identical blob. The bounded final O:I comparison does not modify these files. No rendered 51-record test was executed here.

**Positive/negative.** Retain acceptance versus inclusion, exact source basis, native error/state reread, occurrence/receipt clocks and recovery. Do not solve discovery by auto-accepting, copying another inbox, loading all private proposal bodies, or treating every error as “no Returns.”

**Restoration/UI.** Consume native pagination with bounded continuation or an explicitly supported owner-side source filter. Preserve selection while more records load; guard stale responses after scope/document switches. Render named denied/unavailable/version states and retry instead of disappearing. Forward supported optional native lineage without inventing missing Factory or Day membership. Extend existing client/kernel types together with the selected owner contract, including #161 only when available.

**Proof/placement.** Open the original document with 50 unrelated Returns before its matching record, then paginate; fail/recover the owner; revoke access; switch source during an in-flight read; submit one result with and one without valid NOW/Day/Run/session relations. Verify exact native readback. Repo/browser work in O:I against a real disposable Central binary, coordinated with the existing receiving feature line.

### CT-006 — The pushed Context receiver treats root as no Project; NOW detail stops before material/session continuation

**Seam:** new Factory `ContextPlane` / O:I `NowRelations` ↔ Central root receiving/NOW ↔ Workcell material / AIKit session bindings.

**Activity/authority.** Inhabit Central as the root meta-Project, see work across its participating Workcell, and locate/open/continue the actual work. This follows the explicit root instruction, [temporal field][temporal-field] and current #65/#375 receiving design.

**Current code/evidence.** The pushed [ContextPlane][ui-context] has `if (!project || fixture?.returns.length) return` before its real receiving read. For root `project:null`, no native root read is made; with no previous rows it keeps the “Reading the project’s receiving state” presentation. On scope changes it also does not reset the previous rows before this early return. The native receiving client already represents root explicitly, and [kernel root handling][oi-flow] removes the `project` argument for explicit null rather than inventing a child. This root omission is therefore an actual consumer defect, not evidence that the owner has no root capability.

Separately, [NowRelations][now-panel] faithfully reads the named native NOW but renders sources and continuations as text. It does not join Workcell material observation or an AIKit session binding into open/attach controls. Task-clearance records in [placement][placement] are real and useful; they are not, by themselves, proof of the complete persistent per-Workcell root-NOW/child-NOW/Day relationship. The current [material client][oi-material] and AIKit root/placement code are positive pieces to join, not missing owners to recreate.

**Standing/revisions.** Root Context exclusion: static-proven at UI `7747d5e`, high confidence, **high priority** for root use. Complete material-NOW experience: unfinished cross-owner integration / unavailable physical proof, not a blanket backend defect. Main/final owner vector is unchanged except the qualified O:I delta. Unpublished local UI could differ and was not inspected.

**Positive/negative.** Preserve the new Run/Agents/Context arrangement, fixture labels, exact Return refs, owner errors and existing material/session owners. A fixture-marked source pool is not falsely presented as live data; retain that honesty. Forbid a fabricated “Central” child, pane = NOW, material World = temporal SourceRef, closing a view = stopping work, or Day close = archival/cancellation.

**Restoration/UI.** Make the existing receiver root-aware, reset state per subject, read root plus explicitly selected Project scopes according to the native grant/cursor contract, and expose unsupported root aggregation truthfully until the candidate is integrated. Join the native readings in section 8 by returned refs. Use “Open source”, “Open working material” and “Continue session” as separate proposed controls; none may derive a process or path from a display label. Do not add a second temporal registry.

**Proof/placement.** Select root from an existing child view; prove no stale child rows or permanent loading. Read permitted root/child Returns with a denied-child negative. Keep a task active across view closure and Day rollover; close a provider and distinguish resumable source from dead process; redirect material and require revalidation. Repo UI/adapter work can be done independently of private source. Real two-Workcell/provider/session and hardware proof belongs to authorised Omarchy/Mac work, without interrupting current Day/NOW for this audit.

### CT-007 — Central-backed knowledge operations repeatedly rebuild the runtime rather than use the available change boundary

**Seam:** Central source/file-map/horizon → AIKit `with_knowledge` and knowledge materialisation.

**Activity/authority.** Revisit an already-known World or source quickly while external edits remain visible. The current source/history and incremental-horizon capabilities exist specifically to preserve currentness without making every encounter equivalent to first use.

**Current code/evidence.** In [AIKit’s knowledge service][knowledge], `with_knowledge` invalidates the cached runtime when Central is expected; materialisation reconstructs owner-backed entities and invokes `SqliteWikiProvider::rebuild`. This is a reachable service path, not merely an unused helper. Current file-map connection and World-policy withholding are good and must survive. The source-reading/history contract already gives identity, revision and change boundaries.

**Standing/revisions.** Static-proven repeated-work mechanism; confidence high for the mechanism, **medium priority**. No latency, CPU, memory or rescanning percentage was measured, and this finding does not attribute all reported app slowness to this function. AIKit final main unchanged.

**Positive/negative.** Preserve fresh disclosure, exact source provenance and fail-closed inherited World material; independent local Project sources remain available where allowed. Forbid using a permanently cached graph to hide policy withdrawal, source movement or external edits. Also forbid a new Central-owned semantic Wiki to avoid an AIKit rebuild.

**Restoration/UI.** Retain the knowledge runtime against an explicit owner/source revision and policy basis; consume bounded changes where supported, mark affected projections stale, and rebuild only the necessary layer or explicitly fall back after an invalid cursor. Resolve actual content again when selected. Preserve already-open content/selection during refresh with a truthful updating or stale signal. This is a proposed implementation alignment, not a newly authored caching architecture.

**Proof/placement.** Instrument original repeated knowledge/UI reads in a controlled World: unchanged requests, one external edit, exclusion/withdrawal, moved source, stale cursor and owner outage. Assert reduced repeated work separately from correct fresh output; benchmark rather than infer user-visible latency. AIKit repository/CI work with Central currentness contract; representative installed performance proof later. Coordinate with the existing workspace/cache line rather than creating a new programme.

### CT-008 — The registered NOW search lens still selects an older Project directory shape

**Seam:** Central task-NOW placement → AIKit `NowFieldSourcePoolProvider::standard` → knowledge service registration.

**Activity/authority.** Search current work after a task allocates a native NOW, including root and child source, without memorising implementation paths.

**Current code/evidence.** [The NOW provider][now-provider] has a bounded standard roster including legacy Project `Work/*/ProjectCentral/now` locations. The current [native placement][placement] uses Project agent-NOW material under `ProjectCentral/agents/now`. [Knowledge service registration][knowledge] actually connects the standard provider unless explicitly disabled, so this is not proven dead code. Other root patterns and other source providers can still return useful results; the claim is limited to **this registered NOW lens**, not all AIKit retrieval.

**Standing/revisions.** Static producer/consumer path mismatch; high confidence, **medium priority**. AIKit/Central final main unchanged. No claim that a private Project’s entire NOW is currently invisible in every UI.

**Positive/negative.** Preserve bounded traversal, symlink refusal, live body reading and retrieval exclusions. Legacy data can remain readable during deliberate migration. Do not repair by recursively ingesting all of Work, copying task files into the old layout, or making the projection’s path convention the owner’s source law.

**Restoration/UI.** Discover native temporal sources through current owner refs/maps; where a filesystem compatibility lens remains necessary, explicitly cover the supported old/new layouts with declared version/provenance and deduplicate the same native source. Search results should name scope, source revision and current/archived standing, and open the native source rather than its index entry.

**Proof/placement.** Allocate through the original native Action, then search through the actual AIKit service. Include root/child, old/new layout, duplicate managed link, archive, exclusion and moved-source cases. Repo work in AIKit with Central contract fixtures; no user-directory migration or active-NOW restart.

## 7. Code health, consolidation and compatibility

The evidence supports **selective consolidation**, not a speculative rewrite.

| Candidate | Reachability / compatibility evidence | Bounded direction |
|---|---|---|
| Legacy temporal adapter versus current placement/source adapters | Hook dispatch proves the older route is reachable; newer placement serves different actual callers. | Repair the caller composition; retire obsolete Flow invocation only after the real hook regression passes. Do not delete the legacy NOW ledger or its human history merely because task NOW exists. |
| Older adoption filesystem helpers versus current recognition/file-map/source safety | Public init/adopt/migrate reach weaker lexical/plain-write helpers; the stronger native modules already exist. | Consolidate identity, safety and transaction responsibility. Retain explicit migration, original source, provenance and compatible manifests. |
| Direct AIKit Wiki materialisation/write helpers versus native owner source operations | Public adapter methods and read callers exist; exhaustive external SDK/write-caller reachability was not completed. Fixed temporary-write/CAS sequences warrant contention tests. | **Removal candidate only**, not declared dead. Enumerate SDK, CLI, tests and migration consumers before replacement; preserve agent-maintained Wiki semantics and human-source protection. |
| Multiple temporal/source discovery layouts | Actual NOW provider registration and native allocation disagree; other readers remain useful. | Versioned compatibility and native-ref deduplication, followed by explicit migration retirement. Avoid inventing a second identity per alias or table index. |
| Rebuild-on-every-read knowledge runtime | Actual shared knowledge service path; static repeated work identified. | Owner-revision/currentness boundary, not indiscriminate TTL caching or wider ingestion. |
| Central #161 and superseded #155/#156 | #161 has retained native proof but is unmerged; older superseded branches are not fresh implementation plans. | Reconcile the current feature line once. Keep the evidence-qualified improvements; do not merge production as part of this report. |
| Dated matrix/CLI prose | Matrix labels its catalogue as observed 6 September and some entries cite removed legacy Flow-era interfaces. The current binary is the authoritative exposure census. | Preserve historical verification dates. Add a future explicit current-contract crosswalk where needed; do not call a dated statement a current runtime defect or edit the source in this review. |

Large files, old names and indirect adapters alone are not findings. No claim of globally dead code was made. Security findings are limited to demonstrated/static boundary behaviour; no credential, private source, sensitive machine locator or exploit payload is published.

## 8. Exact receiving, editing and agent-practice obligations

### 8.1 The material NOW plane: what a person must be able to read and do

The join needs owner-issued relations, not a new store. The following operations/readings already provide important pieces; the missing UI joins are explicitly named.

| Human question / proposed control | Native reading and identity basis | Action / state law |
|---|---|---|
| “Which World and Project am I in?” | Central root/World/Project reading and native manifest/source relations; AIKit root `NativeWorld` or actual Project binding | Display root distinctly. An absent child selection does not make root unavailable. Never derive identity from the folder label alone. |
| “Which NOW is this work in?” | `central.now.list/read`, exact `now_ref`, source ref, scope, task/purpose, participants, lifecycle, policy revision, obligations and continuations | The current `NowRelations` already performs the read. Add navigation using those refs; do not allocate a fresh NOW simply to render the panel. |
| “Where are its actual files?” / **Open source** | `central.file-map.locate/resolve` with scope and expected revision, or a returned ordinary-file location through `central.files.read`; document/source read for a semantic source | Open the existing source; resolve aliases and policy at use. Denied, stale, missing, unregistered and absent are distinct. Reading ordinary files does not adopt them. |
| “Which machine/material World holds the work?” / **Open working material** | Existing Workcell material receipt/binding and observation, via O:I’s material client; exact receipt World correlation and exposure | Show owner-returned path/material status only when actually present and permitted. Observe/attach is distinct from materialisation; borrowed storage release preserves source bytes. A path inferred from `now_ref` is insufficient. |
| “Which agent/session can continue it?” / **Continue session** | AIKit SessionSpace/session/provider bindings and availability; current UI already uses `agency_read` for scoped space disclosure and `encounter` provider readings; Actuation source-bound Agency where required | Follow the actual returned binding into existing open/attach/resume operations. Root needs a root-aware binding, not a synthetic child. A saved profile, tmux pane or past receipt is not current process liveness. Missing live provider should still allow source-based continuation without claiming the old process resumed. |
| “What did it produce and where did it go?” | Factory’s native Run/Attempt/Return; Central receiving ref/current revision, exact proposed/applied source basis; occurrence, receipt and inclusion facts | Context → Produced/Needs you and the source-adjacent Return should point to the same record. A proposal’s arrival does not mutate Day or source. Root aggregation must use explicit selected scopes/grants/cursors, not copied inbox rows. |
| “What can I safely close?” | Separate NOW lifecycle/obligations, human Day lifecycle, Workcell material status, AIKit session/provider state and Factory task status | Separate close view, detach material, interrupt, stop process, cancel task, archive/re-enter NOW and end Day. State the effect before action. None is an alias for another. |

The native task record and provider material alone do not yet demonstrate the whole per-Workcell persistent root-NOW relation. The owner-approved law is one human Day gathering the appropriate temporal relations without taking ownership of Factory work or Workcell material. Preserve that law while completing the existing integration. No new “horizon object” or root register should be invented just to make a table look complete.

### 8.2 Skill editing and later use

The current Settings/System split and agent Context/Agents surfaces should expose a single traceable chain: **native source → current owner revision → candidate snapshot → promoted snapshot → scoped selection/effective resolution → target projection → actual loaded state**. These states must not collapse into one green “enabled” badge.

List/search needs purpose, the actual `METHOD:` description where applicable, native source location, owner/scope and standing. Inspect needs the precise source and version, prerequisites, effects and authority. Edit opens the permitted Central master or creates an attributed proposal for human ground; it must not edit a generated target copy. Validation reports actual source/schema problems. Sync prepares a candidate; promotion/select/project remains deliberate. A changed or retired source can invalidate a candidate/active owner basis without changing an already-loaded process. The UI should say what remains stale and what native reprojection/reload is required; “no restart required” for a standing-source write is not proof that every external harness hot-loads it.

AgentSet is not SkillSet; a Method is not an extra authority kind; selected practice is not an Actuation grant. Missing capability, denied source, unresolved standing, no selected Skill and not-yet-loaded projection need different messages. This review found useful code along this chain but did not obtain private source bodies, all target-native adapters, natural trigger/near-miss observations or a later agent’s loaded context. Those are named proof gaps, not licence for another frozen strap or duplicate Guardian definitions.

### 8.3 Settings and source recovery

Keep Central’s `oi.product-settings-disclosure/v2` reading distinct from `oi.configuration-contribution/v1`. O:I may hold desired intent, sparse profiles and overlays and perform owner validate/plan/apply/reset with re-read reconciliation. That is legitimate composition, not owner mirroring. Central’s contribution advertises authored civil-time/placement/authority facts read-only and Skill standing as writable; machine-scoped Skills exist natively even though this particular contribution’s mutation scope is ground/Project. Do not advertise an unsupported machine mutation by extrapolation.

For every proposed edit show target subject, native SourceRef/location, current basis, caller authority, effect timing and failure/recovery. A conflict must keep the human’s draft and show current versus proposed source; it must not silently reread and overwrite. An external HTML/JSON edit needs the selected document owner’s reconciliation capability, not a generic “mark clean.” Secret references can cross configuration; credential material must not enter forms, shared diagnostics, source projections or report evidence. The inspected Agency adapter’s private-error suppression is a pattern worth retaining.

The actual pushed `ContextPlane` already labels fixture material and separates native receiving reads from fixture-only controls. Preserve this and wire real source/return operations into that receiver. The existing modal/selection/editor quality obligation is not satisfied merely by returning JSON; precise interaction and original-template proof remain on the active UI line.

## 9. Bounded alignment and proof order

These are proposals for the existing owners/feature lines, **not new issues, a new Wayfinder or permission to begin changes**.

| Order / coherent packet | Existing ownership and precise work | Dependencies and independent proof |
|---|---|---|
| 1. Safe adoption and source-bound encounter | Central lifecycle + source safety/file map; CT-002/003. Shared federation transaction/recovery, consistent preview/apply identity and exclusions. | Can proceed independently of document UI. Real concurrent native CLI regression and subsequent AIKit read; preserve original source and existing manifests. |
| 2. Temporal regrounding and source discovery | AIKit hook, NOW provider, current Central source/temporal contracts; CT-001/008. | Coordinate the selected temporal contract with #150–#153; do not change active Day/NOW. Actual paired binary/hook tests, root and external-edit negatives. |
| 3. Reconcile the existing document/receiving continuation | Central #161 with #150–#153/#180; O:I document client/kernel; CT-004/005. | Reconcile the already-written candidate before adding missing original-HTML carrier work. Preserve retained history and exact external/native bases. Original-template and source-adjacent Return tests are the acceptance entry. |
| 4. Root and material/session receiving in the current UI | Existing #65/#220/#375 parallel UI, Factory Context panel, Central root/child reading, Workcell and AIKit bindings; CT-006. | Root early-return/pagination repair can be repository work now. Full material/session join depends on exact current owner refs and the selected receiving contract, not a redesign of Run/Agents/Context. Two-Workcell and actual process/Day proof remains native. |
| 5. Incremental knowledge materialisation | AIKit knowledge service with Central map/horizon/policy basis; CT-007. | Preserve policy withdrawal and source-currentness regression before performance optimisation. Coordinate with the existing workspace-caching line. Measure repeated read cost separately from end-to-end app latency. |
| 6. Practice and configuration acceptance | Existing Skill/source/profile pipeline and Settings/Agents/Context consumers. | Not a claim of a missing native subsystem. Prove source edit → promotion → target projection → actual later use, retirement/stale negatives and partial config failure in an authorised environment. No private Skill rewrite or Guardian replacement. |

Use one bounded reusable workspace per coherent feature line. Distinct reviewers/agents do not justify proliferating worktrees or duplicating dependency/build artifacts. Repository-only implementation can use native GitHub actions under a later commission; consequential filesystem/provider/GUI/harness tests belong to an authorised disposable Omarchy/native environment, followed by the required Mac/human proof. This report neither blocks legitimate ongoing cut work nor starts any such work.

## 10. Final delta, limits and publication

The final published recheck preserved Central, AIKit, Actuation, Factory and Workcell at their frozen SHAs. O:I advanced to `a5012f5...`; its complete compared path list does not change the receiving/source-detail files underlying CT-004/005/006. The pushed UI was separately pinned and inspected at `7747d5e...`; Central #161 remained open/unmerged at `7bc0020...`. The report branch starts from current O:I main `a5012f5aa44d0fed317a261b009250d70013ccb5`, not from a stale review baseline.

**Still required, without inference of absence:** exhaustive machine/provider and TUI acceptance; full applicable story/obligation-module and all operator-Method trigger coverage; every native import/move/backend/recovery branch; exact original-template browser/media/selection interaction; private policy/credential adoption; real two-Workcell material enforcement; the running app’s local delta; actual projection and later harness-loaded practice; complete natural task → provider → Factory result → same original source/Day circuit. The reviewer did not access these by reading a public repository. The matrix/registered Action census is broad capability recovery, not execution of all implementations.

**Do not restart the active Day/NOW.** Pending integration should use the existing continuation and original fixtures. Private-machine questions should be answered with purpose-built authorised evidence, not a destructive replay of the user’s live work.

**Publication:** report-only branch `review/central-product-fidelity-2026-09-19`; only this report and its matching evidence annex are authorised changes. Normal PR checks and merge govern publication. The merge/readback result and containing publication commit are returned in chat; this document does not invent a pre-merge commit receipt. No production source, Skill, test, canonical document, issue state, install or running process is changed by this review.

[review-protocol]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/docs/reviews/product-fidelity-2026-09-19/README.md
[review-baseline]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/docs/reviews/product-fidelity-2026-09-19/BASELINE.json
[founding]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/positions/FOUNDING-POSITIONS.md
[central-account]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ProjectCentral/user/central.html
[central-vision]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/docs/CENTRAL-VISION.md
[control-protocol]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/docs/CONTROL-CONTENT-PROTOCOL.md
[matrix]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ProjectCentral/user/capability-matrix.md
[spine]: https://github.com/EpiLogos/O-I/issues/65
[caw-spine]: https://github.com/EpiLogos/O-I/issues/220
[adoption-spine]: https://github.com/EpiLogos/O-I/issues/268
[ui-spine]: https://github.com/EpiLogos/O-I/issues/375
[session-grounding]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/experience/SESSION-GROUNDING.md
[temporal-field]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/experience/WORKCELL-NOW-TEMPORAL-FIELD.md
[c150]: https://github.com/EpiLogos/Central/issues/150
[c151]: https://github.com/EpiLogos/Central/issues/151
[c152]: https://github.com/EpiLogos/Central/issues/152
[c153]: https://github.com/EpiLogos/Central/issues/153
[c167]: https://github.com/EpiLogos/Central/issues/167
[c180]: https://github.com/EpiLogos/Central/issues/180
[c161]: https://github.com/EpiLogos/Central/pull/161
[candidate-run]: https://github.com/EpiLogos/Central/actions/runs/34645210224
[baseline-run]: https://github.com/EpiLogos/Central/actions/runs/35451667163
[cut-receipt]: https://github.com/EpiLogos/O-I/issues/65#issuecomment-5743244181
[oi-final-compare]: https://github.com/EpiLogos/O-I/compare/a1c7010fa290219d58f78ee03f55651ac14ed75d...a5012f5aa44d0fed317a261b009250d70013ccb5
[recognition]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/recognition.rs
[adoption]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/projectcentral_ops.rs
[file-map]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/file_map.rs
[source-history]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/source_history.rs
[temporal]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/continuous_work/temporal.rs
[placement]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/continuous_work/placement.rs
[documents]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/continuous_work/documents.rs
[central-skills]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/control_skills.rs
[central-config]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/configuration.rs
[aikit-hook]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/hook.rs
[aikit-temporal-cli]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/temporal.rs
[aikit-temporal]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/central_temporal.rs
[aikit-placement]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/central_placement.rs
[projectcentral-reader]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/projectcentral.rs
[knowledge]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/app/knowledge.rs
[now-provider]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/now_field.rs
[skill-sources]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/skill_sources.rs
[actor-composition]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/actor_composition.rs
[agency-admission]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/agency_admission.rs
[actualisation]: https://github.com/EpiLogos/Actuation/blob/47f4fa3c184850e254ef5089696bf5fbbad907ec/crates/actuation-runtime/src/actualisation.rs
[factory-central]: https://github.com/EpiLogos/Factory/blob/bbb8f48943cf1cf398005ae40ee8fa29c111c3a5/factory/src/attempt_central.rs
[factory-receiving]: https://github.com/EpiLogos/Factory/blob/bbb8f48943cf1cf398005ae40ee8fa29c111c3a5/factory/src/attempt_receiving.rs
[workcell-storage]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/directory_storage.rs
[workcell-workspace]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-workspace/src/directory.rs
[oi-material]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/kernel/src/material.rs
[oi-config]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/kernel/src/configuration.rs
[oi-flow]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/kernel/src/flow.rs
[html-instance]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src/flow/instance.ts
[receiving-client]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src/receiving/client.ts
[document-returns]: https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/receiving/DocumentReturns.tsx
[now-panel]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src/receiving/NowRelations.tsx
[return-walk]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/walk/scenarios/shared-field-return.mjs
[ui-context]: https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/contributions/factory/sidebar/ContextPlane.tsx
[ui-settings]: https://github.com/EpiLogos/O-I/blob/7747d5e67d2814a29a44788d0b901750cb553215/desktop/cradle/src/workspace/settings/v2/SettingsPageV2.tsx
