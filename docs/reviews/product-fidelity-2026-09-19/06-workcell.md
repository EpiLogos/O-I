# 06 — Workcell product-fidelity review

**Review date:** 2026-09-19. **Finding prefix:** WC. **Mode:** report only.

**Conclusion.** Workcell is substantially more than a process launcher or an intended provider interface. The reviewed source contains material planning, persistent control, existing-directory attachment, provider registration, service ownership, recovery receipts, bounded write protection, connection grants and a compound OpenSandbox adapter. Those achievements must survive alignment. The strongest remaining source-level risks are concentrated in the newer place lifecycle: uncertainty can become absence, automatic provider fallback can follow a possibly successful creation, and the address and release scope are weaker than the generation-safety language suggests. Server-wide sandbox administration must also remain distinguishable from owner-scoped work cleanup. The complete Workcell → Central NOW → AIKit session → actual Agency/work → human control → Return relation is not established by a place receipt, the local desktop terminal, or the historical native-process campaign.

This is a substantive source review with explicit coverage boundaries, not an installed-system certificate. No personal host was contacted; no installation, credential, provider, process, worktree, source implementation or running campaign was changed. No native tests were executed by this review. Historical test claims are attributed to their actual source cuts rather than reported as new observations.

## 1. Intended product experience, authority and scope

### The intended whole

The person should be able to find where useful work can actually live, understand the material consequences of choosing that place, run or continue appropriately bounded work, inspect what is present, and recover or release exactly the material they are entitled to affect. Local host processes, long-lived services, existing source directories, attached storage, remote cells, sandboxes and stronger provider arrangements are legitimate alternatives. They are not successive mandatory maturity levels, and a new task does not intrinsically require a VM, worktree or semantic World. The hosted-VM deployment profile concerns a durable service placement; it is not authority for per-task infrastructure proliferation. [A1] [W-architecture] [W-profiles]

Workcell owns the material-provider, hosting, connectivity and lifecycle relation. Central remains the source and temporal owner, including root/child NOW identity and placement policy. AIKit resolves and binds practices, models, harnesses and SessionSpaces; Actuation owns realised Agency, delegated authority, Activity and Return; Factory owns developmental structure, Candidate/attempt meaning, verification and warranted learning. O:I composes these owners and supplies shared human-facing configuration and presentation without becoming a second native settings or lifecycle store. A provider-native sandbox ID, pane, PID, executable instance, AgentSession and task are different facts even when they are correlated. [A1] [A2] [W-caw] [C-placement] [K-placement] [AC-realised]

Persistent machine presence is equally important. Each participating Workcell supplies material for a Central-owned root NOW; bounded child NOWs localise work beneath that horizon. The person's Day can receive and compose several such presents. Day rollover does not kill live work, pane recreation does not author a new NOW, and reopening a view is not relocation. Material replacement needs fresh material provenance and current authority; semantic continuation is established by the appropriate owners, not inferred from a familiar name. [A2, §§1–5, 10–12]

### Sources used as authority

The shared README and BASELINE were read in full from O-I main. Founding Positions, the Workcell NOW temporal-field clarification, Session Grounding and the September 18 Factory UI Integration Handoff were recovered in full. The latter is the receiving-UI authority used here: **Run / Agents / Context** in the right sidebar, **Desk / Tasks** in the centre, with the existing mode entrances retained. This report does not restore an obsolete multi-tab Factory dashboard. [R-protocol] [R-baseline] [A1] [A2] [A3] [A4]

Workcell's README, architecture, CAW material operations, deployment profiles, place census, cross-cell connections, OpenSandbox source integration, public SDK and operation/provider-authoring Skills supply the native capability field. Workcell #72 and its Candidate/NOW/environment amendment supply specific lifecycle obligations. The amendment inspected here was posted on **2026-09-10 at 20:55:01 UTC**: actual Candidate code/worktree/cwd is distinct from NOW/T and the person's primary checkout; supplied boundaries and revisions survive recovery; Surface detachment is not material loss; cleanup preserves active work, uncommitted/artifact bytes and outstanding Returns. Its thread is mutable, so that timestamp and the linked source wording delimit this review's use. [W-72] [W-72-amendment]

The O-I #65 and #220 spines and relevant integration issue material were consulted, but their entire historical comment archives were not reread. Where a later native implementation or the full current handoff contradicts an older narrative, the report identifies that difference rather than treating the narrative as implementation truth. Additional uninspected authorities and code are named in §§3 and 10.

### Scope restrictions

QL-MEF internals are excluded. SharedField is considered only as a consumer of explicitly projected material/temporal relations. Installation documentation and historical proof returns are evidence, not permission to run an installation. This report neither changes the ongoing cut nor makes completion of this review a new campaign gate.

## 2. Exact revision, candidate, UI and evidence ledger

### Frozen implementation vector

| Owner | Frozen baseline inspected | Final bounded comparison with main | Installed comparison |
|---|---|---|---|
| Workcell | `04160f51d37e78d600f32440b4f5275c02b78e9c` | Identical | No current install receipt inspected |
| Central | `0a58a32c7587f5576ace4239a1fd6d9bde868510` | Identical | Unknown |
| AIKit | `944e00e1cbec79d4a23b46d78231b78816b5dad5` | Identical | Unknown |
| Actuation | `47f4fa3c184850e254ef5089696bf5fbbad907ec` | Identical | Unknown |
| Factory | `bbb8f48943cf1cf398005ae40ee8fa29c111c3a5` | Identical | Unknown |
| O:I | `a1c7010fa290219d58f78ee03f55651ac14ed75d` | Four commits ahead at `a5012f5aa44d0fed317a261b009250d70013ccb5`; bounded delta examined below | Unknown |

The immutable links throughout this report resolve to those cuts, except sources explicitly marked O-I final delta. The shared README blob was `e4ab325585184845d54993d2bd8251b8edb8dfa0`; BASELINE blob was `011d9340a1b6c97df88f595ccc006c8b3ad8b5b8`. The Workcell recursive tree returned `truncated: false`; its open-PR collection returned an empty array during this review. That establishes the queried GitHub state, not the absence of unpublished work on a machine.

### Reviewed developmental returns and candidates

| Return/candidate | Actual disposition and cut | What it establishes; what it does not |
|---|---|---|
| Workcell #73, CAW material lifecycle | Merged; merge `549e13ad05786f007584ef04ab8a589330436242`; final PR head `e6a1dd80acbb7980883a56619de24cc675b7c517` | Its body reports native evidence against earlier head `f3a5be9fc751ee94b78aff11411e0cde65a46e4c`, tested merge `92cc3e7a1b1e84f58f0b09c13cc8782d393e7e7c`. Those are not interchangeable with the final PR head or installed cut. [W-73] |
| #73 native campaign | Referenced Actions run `34508092650`, artifact `10164674237`; body reports 289 tests, positive Landlock cases, concurrent/idempotent material preparation and recovery | Preserves meaningful real-process/kernel evidence. The body explicitly says its disposable processes were not actual AIKit Agents/gateways, and two placements on one host were not physical second placement. Artifact bytes were not independently downloaded or rerun here. [W-73] |
| Workcell #71, system disclosure | Merged; merge `0c3ad1efafdeb254366b7b6122306fe657916a10`; head `c4f30e20a45b6bb9d274f48558e8cc20aba092b4` | The nine-section disclosure and truthful unavailable faculties are landed, not a pending design. Remote settings disclosure remains explicitly unsupported by that control interface. [W-71] |
| Workcell #90, harmonised cut | Merged at the Workcell baseline; head `39251a8ed5b67e711f4f7bf523e69813bae74924` | Integrated Linux secret origin, OpenSandbox runtime composition and hosted-VM planning. Its body reports 443 passing Mac tests at its tip. This is an attributed author return, not this review's execution or a complete six-owner installed receipt. [W-90] |
| Historical Central/AIKit join gaps in #73 | Superseded in part by frozen source | `central_placement.rs` now consumes actual Central operations and emits Workcell write/storage requirements. Herdr is also registered in the AIKit working-environment field. Do not reproduce the earlier blanket “join not written” or “Herdr not publicly registered” diagnoses. [K-placement] [K-working] |
| September 18 UI integration handoff | Authored current destination at O-I baseline | Full handoff read. Claims concerning additional parallel/local UI work without an inspected commit remain pending/unavailable evidence, not proved absence or proved closure. [A4] |
| O-I #385 final delta | Landed at `a5012f5aa44d0fed317a261b009250d70013ccb5` | Actual route now prepends `session-space` to the main AIKit executable, retaining the old spelling as an alias; configuration discovery now consults a resolvable composition registration. The authoritative strap source is now explicitly the O-I repository file. [O-route-final] [O-registry-final] [O-strap-final] |

The O-I comparison listed 24 changed files, including suite update code, configuration transport, source-routing tests, guardian shipment and campaign executable binding. This review read the materially relevant final route, registry and strap source, and the commit explanation; it did not certify every changed installer path. The inspected desktop terminal and configuration frontend files were not among that changed-file set. Final-delta evidence does not change the frozen Workcell findings into installed findings. [O-delta]

### Access and method

Evidence was obtained through native GitHub file, tree, issue, PR and compare reads. Some broad code-search queries returned no usable match; those results are **not** absence evidence. Exact known files and native trees were used instead. Partial file reads are marked below. No shell authentication, local repository worktree, host probe, secret read, deployment or test execution was used.

## 3. Capability, entrypoint, setting and consumer coverage

“Matched” below means the specified relationship exists in inspected source, not that every branch or real deployment passed. A capability matrix is a declared public field; it is not a substitute for actual registration, execution or acceptance.

| Capability / entry | Native producer and actual consumer evidence | Standing and coverage |
|---|---|---|
| Public material field and provider offers | Workcell architecture, JSON capability matrix, SDK, CLI `discover`, `providers`, `plan` routes | Native field recovered. JSON matrix read in full; Markdown matrix read in substantial ranges, not every row. No independent exhaustive provider certification. [W-matrix] [W-sdk] [W-cli] |
| Host / Workcell / executable instance identity | Instance registry persistence and process-generation type → AIKit Workcell instance intake | Matched registry/intake boundary; AIKit inspected intake retains PIDs but not the newer per-execution start-marker field. Whether another active-session route supplies equivalent proof remains uninspected. Inventory is not continuity authority. [W-instances] [K-instances] |
| Existing source and NOW directory attachment | CAW operations, local runtime composition → Central placement and AIKit `directory_storage_requirements` | Existing directories remain externally owned; no source deletion, exclusive capacity or semantic NOW ownership implied. Exact runtime storage implementation and all adversarial tests were not reread. [W-caw] [W-local] [C-placement] [K-placement] |
| Actual local execution | Runtime host-process family; AIKit `ConnectionProcess` and `AgentSessionHost` | Actual child process and ordered session transport inspected. These are distinct lifetime/protocol roles, not proof every launch traverses a Workcell confinement provider. [K-process] [K-host] |
| Long-lived control / reconnect | Workcell `ControlService`, TCP transport, CAW journal/recovery contract → remote CLI and Factory material calls | Persistent control and native consumers exist. Network/service source read in bounded ranges/full transport. Partial provider-effect recovery remains explicitly blocking, not automatic rollback. [W-network] [W-control] [W-caw] [F-material] |
| Target-native services | `ExternalServiceCommand::run`, service declarations, `recover_service` → runtime registration | Positive explicit acquisition/ownership, ten-second command bound, post-recovery readiness. Release tail and every service subtype not independently audited. [W-external] [W-local] |
| Resource observation | Place/instance census contract and registry → AIKit instance intake; resource-usage disclosure documented | CPU/process-oriented observation is not GPU, network, cost or application completion. Full usage sampler and hardware drivers not inspected; no fabricated metrics. [W-census] [W-instances] [K-instances] |
| Places / tmux / Herdr | `request_place_live`, `release_place_live` → Factory `request_place` / `release_place`; AIKit public working-surface registry | Actual place producer/consumer and public environment control inspected. WC-001–004; live tests are gated and were not run. [W-place] [F-place] [K-working] [K-surface] |
| Local versus remote operation | Native local and remote CLI dispatch | Explicit remote lifecycle selection, with no local-source/service projection. Remote whitelist does not contain `places`, `place` or `instances`; this is a verified route limitation, not a repository-wide missing-provider claim. WC-006. [W-remote-cli] |
| Connection grants / expiry / revocation | Cross-cell contract, `ControlService` request checks, TCP framing → remote CLI | Per-request authorization is distinct from offered capability and from terminating already-running effects. Credential-store internals and all grant persistence tests not reread. [W-connections] [W-control] [W-network] |
| Secrets / use without read | OpenSandbox integration, SDK secret boundary, local composition and #90 return | Actual provider integration present in source; vault route semantics recovered. Linux Secret Service, Mac Keychain ACLs, live revocation and leak resistance need their own inspected/runtime evidence. Not certified here. [W-opensandbox] [W-90] |
| Sandbox lifecycle / lease / checkpoint | Source-pinned OpenSandbox lifecycle integration; actual server reconciler | Native protocol family and runtime registration exist. Checkpoint/renewal/data-plane internals largely document-level in this review; server-wide reconciliation code directly inspected. WC-005. [W-opensandbox] [W-reconcile] [W-local] |
| Storage / PVC lifetime | OpenSandbox source integration and CAW directory contract | Execution, source workspace, attached storage and artifact storage remain separate. Existing-volume release does not claim deletion. Live mount isolation, quota and rematerialised byte preservation unproved here. [W-opensandbox] [W-caw] |
| Network path / exposure / egress | OpenSandbox integration and native Workcell architecture | Policy enforcement is not reachability; native endpoints are not a Workcell data-plane proxy. No blanket claim that Tailscale, Docker or Kubernetes is currently available. Provider-specific mount/egress source audit incomplete. [W-opensandbox] [W-architecture] |
| Write confinement | `PreparedWriteBoundary`, strict requirements and capability probe → AIKit Central requirements and enforcement classification | Strong positive bounded contract. Unsupported coverage refuses; prepared state is not execution; Linux file-write coverage is not network/read/live-revocation coverage or Mac confinement. Actual installed launch proof pending. [W-boundary] [K-placement] [K-enforcement] |
| Factory Candidate / attempt material | Workcell interop → `attempt_material_admission`, `attempt_material`, `attempt_place` | Actual consumers retain developmental ownership and block unresolved lifecycle worlds. Full Candidate topology, dispatch and Return verification are Factory review scope, not claimed here. [W-factory] [F-admission] [F-material] [F-place] |
| Configuration disclosure | `workcell system --json`, #71 and remote `system` route | Landed descriptive surface, including named unavailable faculties. A disclosure is not automatically mutable configuration. [W-71] [W-remote-cli] |
| Configuration mutation / profiles | Workcell CLI has `config` and `config-contribution`; O-I production `liveSource.ts` and final owner registry | Owner contribution and O-I composition are legitimate. Detailed Workcell setting validators/plan/apply/reset implementations were not fully inspected; do not certify them from route presence. Remote mutation explicitly unsupported. [W-cli] [O-config-live] [O-registry-final] |
| CLI / TUI / app material visibility | Native CLI, AIKit working-surface code, actual desktop terminal and current UI handoff | CLI effects and local desktop PTY inspected. TUI complete views and all Observatory joins not inspected; pending UI claims kept separate. WC-006/007. [K-surface] [O-terminal] [O-pty] [A4] |
| Provider SDK extension / removal | SDK and provider-authoring Skill | Thin public façade and port-conformance checks; not dynamic-plugin lifecycle certification. Provider lifecycle, version migration and live backend tests remain provider-specific. [W-sdk] [W-provider-skill] |
| Skills / source editing / actual loading | Workcell operation/provider Skills; current O-I strap; AIKit owner relations | Full relevant authoring/operation sources read. End-to-end current Skill import/edit/project/reload implementation and actual harness loading not traced in full; explicit open links in §5. [W-operation-skill] [W-provider-skill] [O-strap-final] |
| QL-MEF internals / production campaign changes | None | Excluded by commission; no inspection or mutation. |

Consequential negative searches are bounded: the remote-operation limitation comes from the actual `run_remote` match, not search absence; the place-grant shape comes from its producer and Factory's strict consumer; the local terminal limitation comes from both React and Tauri implementations. No claim of globally absent NOW or remote support is inferred from those narrower facts.

## 4. Positive architecture to retain

### Material identities are relations, not substitutes for the work

The existing Workcell design correctly accepts provider-neutral demand and opaque caller subjects while retaining provider/material provenance. A compound sandbox can serve several distinct bindings. A change of provider does not entitle Workcell to change Project, Agent, Candidate or NOW identity. Factory's interop explicitly resists leaking Candidate vocabulary into the Workcell core. Actuation's realised-body representation separately carries harness, session, process, model and material relations; its observed actuality requires evidence rather than a declaration that a body exists. [W-opensandbox] [W-factory] [AC-realised]

### Persistent material has a real recovery boundary

The CAW implementation is not just a desired service contract. It includes persistent control, durable intent/publication records, exact-demand idempotency and release/supersession semantics. Its own return correctly refuses to call unknown interrupted provider effects successfully recovered. Known dead owned children and persisted material are recoverable under the documented conditions; ambiguous effects leave a blocking journal. That conservative boundary is valuable and should also govern the newer place fallback paths. [W-caw] [W-73]

Factory consumes this distinction. `validate_new_work` and its `blocked` predicate block worlds with dispatching/uncertain recovery or release and released/superseded material. Its material retention logic follows validated recovery predecessors, checks owner/world/demand/subject relations, and uses bounded compare-and-swap attempts for receipt bookkeeping. A receipt-store retry is not an instruction to replay the external material effect. [F-admission] [F-material]

### Source policy and actual enforcement are already connected in part

Central's allocation checks policy/source revisions, object identity, lifecycle and expiry. Its response does not pretend to enforce the filesystem. AIKit's actual Central adapter consumes those native actions, preserves the allocated NOW and creates Workcell-native directory/write requirements. Workcell's write-boundary parser rejects unsupported coverage and stale/expired requirements, records exact objects, and discloses a prepared-not-executed state. These are complementary responsibilities, not redundant schemas to collapse. [C-placement] [K-placement] [W-boundary]

The remaining proof is that the actual selected launch uses the required protection and later reports its observed coverage. A successful planner or prepared ruleset alone is not that proof. Likewise AIKit distinguishes material enforcement, a blockable harness hook and advisory guidance; a post-tool hook cannot retrospectively block a write. [K-enforcement]

### Services, sessions and provider surfaces legitimately differ

An observed target-native service is not automatically owned for restart. `recover_service` requires provider acquisition/ownership and a declared native command; it verifies readiness and explicitly avoids asserting process/session identity. Its command implementation bounds the child group and names uncertain timeout effects. Preserve that native-service path alongside managed child processes. [W-external]

AIKit's process transport owns OS bytes/lifetime, while its AgentSession host demultiplexes canonical sessions and carries ordered signals. An interrupt request is distinct from an observed interruption. Dropping a turn handle does not cancel a turn. The host does not claim that a restarted connection proves session continuity. Those distinctions directly support the user's request not to equate panes, processes, sessions and tasks. [K-process] [K-host]

### Truthful absence and native differences are strengths

The place census names absent CLI, no server, unreachable server, unparsed output and provider error states rather than inventing healthy rooms. Remote CLI selection rejects unsupported projection of local source/service declarations. Cross-cell grant authorization is separate from discovery and from workload data protocols. OpenSandbox policy enforcement is separate from network path provision, and credential use is separate from raw credential readability. Preserve those distinctions while fixing the narrower places where uncertainty is lost. [W-census] [W-remote-cli] [W-control] [W-opensandbox]

## 5. Complete cross-owner trace and where proof stops

### Material NOW / tmux / Herdr plane

| Step / owner | Actual producer → actual consumer | Identity / state that must survive | Current standing and receiving requirement |
|---|---|---|---|
| 1. Find material — Workcell | Local runtime discovery, instance registry and place census → AIKit Workcell intake and working-environment discovery | Workcell/host, provider, material locator, observation time, process generation where relevant | Exists. Inventory may be stale/unavailable without deleting the logical work. Current CLI can disclose material; multi-host joined reading remains unproved. [W-instances] [W-census] [K-instances] |
| 2. Identify machine relation — Central | Authored machine/Workcell relation → Central placement context and suite consumers | Machine relation is source; Workcell observation is evidence, not NOW identity | Relation document read; machine adoption implementation not exhaustively reviewed. No adoption performed. [C-machine] |
| 3. Resolve root/child NOW — Central | `central.work.policy`, `central.now.allocate/read`, `central.work.validate` → AIKit `NativeCentralPlacement` | Exact source/policy/Now revisions, expiry, writable/protected paths, task continuity | Concrete allocation/validation pair exists. The complete multi-Workcell parent/root correlation is not established by this older task-allocation request alone; keep #150/#153 joins explicit. [C-placement] [C-continuous] [K-placement] [A2] |
| 4. Attach material — Workcell | Existing-directory storage and write boundary → AIKit supplied material requirements / actual provider | Existing NOW and Candidate paths remain distinct; external source stays owned by Central/person | Requirement construction exists. Directory attachment must not relocate source or silently broaden protection. Installed actual launch coverage remains proof work. [W-caw] [W-boundary] [K-placement] |
| 5. Bind working environment — AIKit | `working_environment_field` → `session_space_working_surface` | SessionSpace/provider selection separate from pane and current view | Herdr publicly registered; focus of an absent binding is not silent creation. A refreshed surface observation is not proof of task or AgentSession resume. [K-working] [K-surface] |
| 6. Obtain a room — Workcell → Factory | `request_place_live` → Factory `request_place` / strict grant decode | Provider room receipt, PID/start marker; caller retains attempt/Agent meaning | Concrete paired route. It does not currently prove host/server generation or complete shared-room ownership. WC-001–004. [W-place] [F-place] |
| 7. Execute actual Agency/work — AIKit / Actuation / Factory | Real `ConnectionProcess` and `AgentSessionHost`; Actuation actualisation/realised body; Factory material admission | Agent, Agency, AgentSession, model, permissions, temporal address, developmental unit remain separate | Actual native operations exist; inspected pieces do not establish every Workcell place is joined to that actual Agent. No inference from a shell name or green process to completed work. [K-process] [K-host] [AC-actualisation] [AC-realised] [F-admission] |
| 8. Open / attach / inspect — O:I / AIKit | AIKit provider-surface operations; O-I local PTY React → Tauri handlers | View identity/lease separate from material lifetime and remote execution address | Local PTY is proven source, not a remote NOW attachment. Actual remote place/instance CLI forwarding is absent from the inspected whitelist. TUI/Observatory full joins not verified. WC-006. [W-remote-cli] [O-terminal] [O-pty] |
| 9. Observe results — native owners | AIKit ordered turn events and observed stop; Factory material receipts; Actuation evidence-bearing actuality | Issued interrupt ≠ observed stop; material receipt ≠ test success, verified Return or Recognition | Positive types/consumers inspected. Independent end-to-end work/test/Return and late receiving were not executed here. A terminal transcript alone is insufficient. [K-host] [F-material] [AC-realised] |
| 10. Detach, recover, relocate, release — each owner at its boundary | View checkpoint/reattach; Workcell inspect/recover/release; Factory lifecycle admission; Central revalidation | Preserve pending permissions, unknown effects, worktree bytes, Returns and old/new material provenance | Existing good native lifecycle retained. Surface close, owned PTY stop, room close, task cancellation and Day closure require distinct controls. Relocation is explicit new placement, not a transparent local fallback. [A2] [A4] [W-caw] [F-admission] [O-pty] |

**Where the complete trace is still open:** there is no independently observed operation in this review carrying one real Agent's work through both physical Workcells, the exact Central root/child refs, AIKit's persisted provider binding, visible remote ingress, authoritative Activity/Return and recovery. This is not a claim that none of that code exists. It is a precise refusal to award joined acceptance from isolated producer, fixture or host-process evidence. The existing #72/#150/#153/#275/#277/#195/#220 integration lanes remain the location for closure. [A2, §11]

### Skills and editing — relevant Workcell specimen

| Stage | Source/owner route | Inspected evidence and unresolved join |
|---|---|---|
| Discover practice | AIKit discovers operation/provider Skills; O:I strap routes orientation rather than copying lifecycle instructions | Workcell operation and provider-authoring descriptions read. Neither description begins `METHOD:`; do not label them Methods merely because they contain a procedure. Discovery selection and near-miss tests were not executed. [W-operation-skill] [W-provider-skill] [R-protocol] |
| Inspect purpose/source/scope/version | Native Workcell repository source and AIKit resource/projection records | Preserve source revision and permitted editing scope. An unavailable provider or locked secret store is not evidence that the Skill body is missing. |
| Edit or propose | Edit the authorized Workcell Skill/provider source; owner-ratified O:I strap changes belong to its actual O-I file | Final delta explicitly retires the nonexistent Central provenance pointer. Derived Control/capsule/harness copies remain derived, receipt-gated and must not become competing authorities. [O-strap-final] |
| Validate | SDK port checks plus provider lifecycle/adversarial tests and native verification | Port identity/offer conformance is not sufficient lifecycle evidence. A Skill edit also needs trigger, prerequisite, authority and result interpretation checks. [W-sdk] [W-provider-skill] |
| Select / project | AIKit composition and trust; O:I shipment for its own strap | SkillSet is not AgentSet. Selecting a Skill does not grant process, source or credential permission. Current projection/import implementation was not fully traced here; no universal loading claim is made. [O-strap-final] |
| Activate / restart | Actual selected harness/session owner, with Workcell material availability where required | Configured/projected/linked/loaded/used are separate. Changing a pointer or capsule is not evidence the resident Agent reread it. Needed restart is a visible operation, not silent destruction of ongoing work. [O-strap-final] [K-host] |
| Subsequent effective use / Return | Actual operation and later owner readback, then attributable Return | Start from a fresh root/child scope change, require appropriate practice selection, real authorized effect/refusal and later correct observation. Preserve foreign/local edits and retain explicit recovery when loading fails. No frozen replacement strap or duplicate Guardian definitions. [O-strap-final] |

## 6. Findings

For all findings, the revision vector is §2. Workcell, Central, AIKit, Actuation and Factory final main checks were identical to baseline. No installed receipt was inspected. Proposed copy below is expressly proposed, not an assertion that a button or phrase already exists.

### WC-001 — Failed material observation can be treated as a failed generation proof rather than unknown evidence

**Activity and authority.** Releasing a stale tmux/Herdr place, or deliberately using the provider-native close escape hatch. Workcell #72, the Candidate/NOW amendment, and the place contract require exact material evidence and preservation of unrelated/live work. [W-72] [W-72-amendment] [W-census]

**Positive / negative requirement.** Retain normal PID plus start-marker refusal and the legitimate explicit administrative close of an orphan room. Do not convert inability to observe into proof that the former execution is gone or no longer belongs to the room.

**Current code and paired seam.** `Workcell::release_place_live` uses `read_pid_table().unwrap_or_default()`. `gather_provider_snapshot` converts every unsuccessful tmux `has-session` exit into `session_exists: false`; Herdr pane parsing uses `unwrap_or_default`, and failed per-pane process observations are filtered away. With the explicit `provider_close` flag, failed generation proof can select the provider-native close decision. `execute_provider_close` then verifies only current provider existence before issuing room-wide close. Factory's `release_place` supplies PID/start marker and does **not** request this escape hatch, which is important counter-evidence. Seam: Workcell `release_place_live` → Factory `release_place`, under `workcell.place-grant/v1`. [W-place, symbols above] [F-place]

**Evidence standing / revision / priority.** Static-proven loss of uncertainty; potential destructive consequence requires the explicit close path and suitable live/provider state. It is not evidence that ordinary release always kills unrelated work. Present at Workcell baseline/final; no reviewed repair candidate; installed standing unknown. **High priority; high confidence in error-state loss, conditional confidence in collateral effects until executed safely.**

**Restoration and compatibility.** Preserve structured unknown/error observations through the decision layer. Require positively established stale/gone evidence, or a separately scoped explicit administrative decision that accurately declares uncertainty. Do not let a process-read error manufacture the stale precondition. Keep existing safe release/refusal documents compatible where possible; version any changed decision/receipt contract deliberately. This correction belongs in observation/decision boundaries, not a new scheduler.

**Receiving experience.** Workcell CLI and the selected material's Inspect/Run depth should say, as proposed copy, “Cannot verify this execution; nothing was closed,” with native error, observation time and retry/inspect route. An administrative whole-room close must name that scope and its separate authority. A missing consumer must not replace the producer failure with “gone.”

**Discriminating proof.** From the existing `workcell place release` entry, use controlled providers with a still-live granted room and a failing PID read; separately return successful but malformed Herdr pane output and denied tmux inspection. Normal and provider-close variants must not mistake those failures for verified absence. Then restore observation, reread the exact generation, and exercise the legitimately stale administrative case. Extend the existing place decision/CLI tests; a disconnected close handler must not generate a successful receipt. No real personal process is a test target. [W-place-tests]

**Execution placement.** Repository-only Workcell repair and deterministic/native disposable tests; coordinate Factory only for any wire change. Actual Herdr/tmux version, server, TTY and process-generation behavior requires an authorized disposable native environment, with Mac/Omarchy acceptance separately recorded.

### WC-002 — Automatic place fallback can create a second room after an uncertain first creation

**Activity and authority.** Requesting an automatic place for one bounded attempt. The authored material law requires attributable effects and prohibits provider loss or unsupported placement from silently changing the work arrangement. [W-caw] [W-72-amendment]

**Positive / negative requirement.** Preserve useful Herdr-first/tmux fallback when the first provider is positively unavailable before effects. Do not treat every Herdr error as permission to allocate elsewhere, or discard evidence that the first provider may already have created material.

**Current code and paired seam.** `request_place_live(PlacePolicy::Auto, ...)` catches any `request_herdr_place` refusal, records it in a temporary evidence map, then tries tmux. A successful tmux request returns its grant directly, without that accumulated first-attempt evidence. The Herdr request has creation followed by observation/readback, so an error need not mean zero effects. Factory `request_place` makes one request and consumes one strict grant; it does not introduce its own retry loop. Seam: Workcell `request_place_live` → Factory `request_place`. [W-place, especially `request_place_live`, `request_herdr_place`] [F-place]

**Evidence standing / revision / priority.** Static-proven unconditional fallback policy and discarded successful-fallback evidence; duplicate/orphan consequence is a plausible execution risk, not a reproduced host event. Present at baseline/final, no candidate repair inspected, installation unknown. **High priority; high confidence in control flow.**

**Restoration and compatibility.** Distinguish pre-effect unavailability, no-effect refusal, already-existing material and uncertain/post-effect failure. Only the first categories can transparently fall back. Reconcile the first request before a second consequential allocation, retaining caller correlation and material evidence. Preserve existing one-grant success for clean paths; uncertain state must be explicit rather than hidden in a successful replacement grant. Reuse the persistent lifecycle's existing uncertainty discipline; do not require a new World per attempt.

**Receiving experience.** At place selection and Run/Inspect, proposed copy: “The provider may have created this place; inspect before retrying elsewhere.” Offer inspect/reconcile of the first place and explicit re-placement only after its effects are accounted for. Do not display the tmux result as though it were the only material action.

**Discriminating proof.** Enter through Factory's existing place request using a controlled Herdr that creates once but loses/malforms readback. Assert no tmux creation, retained uncertainty, later discovery of the original room and one attributable grant/recovery. Also prove true pre-effect Herdr absence still permits tmux fallback and that an already-existing refusal is not silently adopted. A fake success response without actual material must fail subsequent inspect.

**Execution placement.** Workcell decision/receipt correction and paired Factory tests are repository work on the existing material line. Real provider interruption/reconnect proof belongs in an authorized sandbox/native test host, not the person's ongoing session.

### WC-003 — Place address and room-wide release need stronger scope evidence than one pane generation

**Activity and authority.** Inspecting or releasing the exact granted place without reaching a different server or affecting work subsequently sharing the room. #72 expressly requires host/server/workspace and process-generation safety; the temporal-field law forbids pane/name recreation from hijacking another child. [W-72] [A2, §12]

**Positive / negative requirement.** Retain opaque native place refs, generation checks, strict names and legitimate whole-room ownership. Do not treat a socket label that is ignored operationally, a recycled name or proof about one pane as proof of all material affected by a room-wide close.

**Current code and paired seam.** `parse_place_ref` accepts the tmux socket and session components, but observed/release commands shown in `gather_provider_snapshot`, `execute_release` and `execute_provider_close` invoke the default tmux endpoint without consuming that socket component. The grant does not carry an explicit Workcell/server generation. A verified member PID/start marker leads to `tmux kill-session` or `herdr workspace close`, which affects the room, not only that pane. Factory's `WorkcellPlaceGrant` pins v1 with `deny_unknown_fields`, so casually adding new producer fields can break the actual consumer. [W-place] [F-place]

**Evidence standing / revision / priority.** Static-proven address/operation mismatch and wider close effect. Wrong-server or unrelated-pane impact depends on supplied refs, provider reuse and sharing; not physically reproduced. Baseline/final affected; no inspected candidate repair; install unknown. **High priority for cross-host/shared use; high confidence in mismatch, conditional runtime risk.**

**Restoration and compatibility.** Either reject unsupported non-default sockets explicitly or faithfully address them; do not advertise one address and operate another. Bind host/server generation or equivalent provider evidence at the appropriate material boundary. Before room-wide close, establish ownership/scope of everything affected, or require an explicit administrative whole-room act distinct from child release. Do not give Workcell ownership of Central child identity. Coordinate a versioned grant evolution with Factory's strict decoder, AIKit consumers and old persisted receipts; reject underqualified old receipts for newly hazardous operations rather than pretending they gained proof.

**Receiving experience.** Inspect must expose machine/Workcell, provider endpoint/server, room, selected pane/process and evidence age beneath useful labels. Proposed separate controls: “Close this view,” “Stop this execution,” and “Close entire provider room.” The last must disclose other observed members and unknown ownership, not merely the selected Agent's name.

**Discriminating proof.** From the native release entry, supply a non-default-address receipt against two isolated controlled servers, including a same-name room on each. Unsupported addressing must refuse or touch only the addressed server. Add a second independently owned pane to the granted room and prove child-scoped release cannot destroy it. Exercise name/PID reuse, changed start marker and old-receipt decoding, then inspect both affected and protected material. Existing CLI round-trip is insufficient because it covers one simple room. [W-place-tests]

**Execution placement.** Versioned producer/consumer work in Workcell and Factory, with AIKit/O:I presentation dependencies coordinated on the same feature line. Real server replacement, two independent hosts and Mac/Omarchy provider differences require explicit native proof.

### WC-004 — A bounded number of provider commands is not a bounded lifecycle operation

**Activity and authority.** Listing, requesting, inspecting or releasing material without hanging the human/agent control path or replaying uncertain effects after a timeout. The protocol demands bounded failures/retries; Workcell already has a bounded native-service command implementation to preserve. [R-protocol, §5] [W-external]

**Positive / negative requirement.** Retain provider-native argv, truthful timeout/uncertain-effect reporting, TCP frame limits and existing caller timeouts. Do not describe plain blocking `.output()` calls as bounded operation time, or infer rollback because a consumer stopped waiting.

**Current code and paired seam.** The place live path invokes tmux/Herdr through synchronous `Command::output()` without an explicit deadline or output cap. Factory consumes the place operation through its bounded native-owner invocation, but that consumer bound does not itself certify cancellation or cleanup of provider effects. Workcell TCP transport has frame/read bounds, while synchronous dispatch may still wait on a provider operation. By contrast `ExternalServiceCommand::run` enforces a ten-second process-group bound and warns about effects needing reconciliation. [W-place] [F-place] [W-network] [W-external]

**Evidence standing / revision / priority.** Static resource/control-flow risk, not measured latency or a demonstrated leak on the user's host. Present at baseline/final; no repair candidate inspected; install unknown. **Medium-high priority; high confidence in missing local deadline, runtime impact workload-dependent.**

**Restoration and compatibility.** Reuse an owner-scoped command runner with time/output bounds, cancellation and explicit post-timeout uncertainty. Preserve long-running workload lifetime separately from short control-command deadlines. Bound the whole operation as well as individual probes where needed. Do not introduce automatic retries of create/close merely because observation timed out. Keep native provider differences and the current control/data-plane split.

**Receiving experience.** CLI and Run/Inspect should distinguish request timed out, provider unavailable, cancellation requested, observed stop and unknown effects. A timed-out create offers reconciliation, not an unqualified Retry button. No permanently spinning healthy badge.

**Discriminating proof.** Start through `workcell places`, `place request` and the Factory caller with disposable providers that stall, produce excessive output or create before losing their response. Verify bounded caller completion, attributable timeout, no duplicate side effect, preserved ability to inspect later and no unrelated-process kill. A slow legitimate execution behind a responsive control provider must continue rather than being treated as a hung command.

**Execution placement.** Repository-only runner/decision tests followed by native disposable provider tests; owner is Workcell, with Factory timeout/result interpretation paired. No infrastructure redesign or personal-host experiment is needed to implement the initial correction.

### WC-005 — Server-wide sandbox administration is not owner-scoped orphan cleanup

**Activity and authority.** Reconciling expired material or clearing snapshots on a shared sandbox lifecycle service. Preserve authorized operator administration while honoring the existing rule that attempt cleanup cannot destroy unrelated work or retained evidence. [W-72-amendment] [W-opensandbox]

**Positive / negative requirement.** Keep report-only reconciliation, explicit asserted-ID administration, unknown-lease protection and per-target failure reporting. Do not equate an expired lease with ownership by the current caller, or expose a server-wide sweep as ordinary child/attempt cleanup.

**Current code and seam boundary.** `SandboxServerReconciler` is intentionally constructed from endpoint, optional API key and transport, without World/demand/owner identity. `reconcile(true, false)` deletes every listed expired-lease sandbox. With snapshots included and release enabled, it deletes every listed snapshot, with no owner/age filter in that loop. `release_asserted` is separately explicit. The native CLI registers the `sandboxes` family, but this review did not inspect every `command_sandboxes` argument branch; no automatic Factory invocation of this reconciler is alleged. Factory's actual attempt material path uses world-scoped native operations and has its own admission protection. [W-reconcile, `reconcile`, `release_asserted`] [W-cli] [F-admission]

**Evidence standing / revision / priority.** Static-proven broad administrative scope; a plausible confused-scope risk if reused/delegated as ordinary cleanup, not proof the existing explicit administrator is unauthorized. Baseline/final affected as a contract boundary; no candidate repair inspected, installation unknown. **High priority before shared/delegated exposure; high confidence in effect scope.**

**Restoration and compatibility.** Preserve the clearly named server-administration faculty. Add an explicitly scoped preview/target set and appropriate authority for shared use, or keep it unavailable to task cleanup. Revalidate relevant lease/ownership conditions close to deletion; lease renewal after listing is not automatically accounted for by the current loop. Snapshot deletion needs its own scope and retention evidence. Do not silently change existing explicit administrative intent into a different semantic operation; provide a separate owner-scoped route where needed.

**Receiving experience.** System/provider administration must show endpoint identity, target count/IDs, snapshot inclusion, ownership standing and irreversible scope before effects. Task/Run recovery must show only the relevant world resources or a clear refusal. Proposed copy: “Server-wide cleanup” must not be shortened to “Clean up this task.”

**Discriminating proof.** Through the actual supported administration entry, prepare controlled material for two owners plus retained snapshots; report-only mode must mutate nothing. Exercise owner-scoped cleanup and require unrelated resources to survive, including an expired resource not owned by the caller and a renewed lease. Explicit server-wide authority should still permit the separately disclosed sweep. Later independent listing must agree with each deletion/failure receipt.

**Execution placement.** Workcell contract/CLI/SDK tests first; actual shared OpenSandbox server proof in an authorized disposable deployment. Do not run a sweep on the current installation or repurpose its credential scope.

### WC-006 — The joined machine/NOW/session control plane has concrete exposure limits and is not yet proved as a whole

**Activity and authority.** Seeing which machine, work and actual Agent are present, then opening or continuing the same work locally or remotely. The authority is the full material NOW specimen and existing Session Grounding/current UI handoff, not a newly invented infrastructure dashboard. [R-protocol, §4] [A2] [A3] [A4]

**Positive / negative requirement.** Preserve Central-owned temporal identity, AIKit's public Herdr/provider registry, explicit remote lifecycle selection and the useful local desktop terminal. Do not call that local PTY a cross-machine NOW attachment, equate a view lease with host identity, or award continuation from a stale inventory row.

**Current code and paired seams.** Workcell's remote `run_remote` whitelist supports material lifecycle operations but not `places`, `place` or `instances`; remote configuration explicitly refuses unsupported operations. AIKit's working-surface reader and focus/open operations exist, while its inspected Workcell instance projection does not carry the newer execution start markers. O-I `TerminalSurface` calls `terminal_attach(id,cwd,dimensions)`; the Tauri handler reuses a Surface-keyed local PTY or starts a local login shell. It has no Workcell/root-NOW/child-NOW/AgentSession input. These are precise path limitations, not proof all remote/Observatory code is absent. [W-remote-cli] [K-surface] [K-instances] [O-terminal] [O-pty]

**Evidence standing / revision / priority.** Static-proven selected entrypoint limits plus active/pending cross-owner integration and unavailable whole-operation evidence. Frozen AIKit's Herdr registration and final O-I folded session route are counter-evidence against older blanket missing-feature claims. Baseline/final status is §2; no installed receipt or unpublished UI code inspected. **High integration priority; high confidence in the inspected path descriptions, no claim of global absence.**

**Restoration and compatibility.** Close the existing joined route using native owner references and capabilities: host observation, Central root/child address, AIKit session/provider binding, actual Agency/work and native Return. Where remote material inspection/control is supported, expose it through the actual selected connection; otherwise refuse with a useful route and reason. Generation evidence may be an additional correlated reading rather than a new semantic identity. Preserve local ad-hoc terminals and old safe aliases; do not force every shell into a Factory task or new World. Audit the actual pending UI line before duplicating it.

**Receiving experience.** Use the current footer/Observatory ingress and Run/Agents/Context structure. The person must see machine/Workcell and local-versus-remote access, selected work and actual Agent, root/child NOW relation, provider/process evidence age, and why an action is enabled. Open here, open remote and move work are separate. Unknown/offline must preserve work identity and expose inspect/reconnect/re-authorize paths rather than launch locally.

**Discriminating proof.** Start from ordinary Project Now or Run ingress, with one child genuinely executing remotely. Open it through another view without a second execution; disconnect the UI and reconnect; then replace the provider generation and require explicit reconciliation rather than attachment by name. Disconnect the visible Open/Inspect handler and ensure the test fails rather than passing from fixture rows. Finally verify actual Activity/Return and original temporal address through later native reads. Two physical hosts and the actual Mac app/TUI are required for the full claim; two guests prove only a narrower layer.

**Execution placement.** Reuse Central #150/#153, AIKit #275/#277 and existing session/TUI lanes, Workcell #72, Factory #195 and O-I #220/#65/#155/#289/#292. Repository contract/consumer work can proceed without host changes; actual installed joins, TTY/provider behavior and human comprehension require authorized native/Mac/Omarchy proof.

### WC-007 — The local terminal keeps polling after EOF

**Activity and authority.** Keeping an ended terminal visible for inspection without continuing unnecessary background control traffic. The current UI contract calls for coherent, bounded live observation rather than proliferating per-view polling. [A4] [R-protocol, §5]

**Positive / negative requirement.** Preserve bounded PTY buffering, view leases, serialized writes, checkpoints, visible exit state and access to the transcript. An EOF reading should not automatically schedule another empty poll forever while the view remains mounted.

**Current code and paired seam.** `TerminalSurface` sets `exited` from `terminal_poll`'s `out.eof`, then schedules the next poll at zero or forty milliseconds whenever it is not disposed, without an EOF stop condition. Tauri `poll_session` already returns EOF when the reader ended and buffered bytes are drained. This is a local-shell observation issue, not evidence that every Workcell/provider poll is unbounded. [O-terminal, `poll`] [O-pty, `poll_session`]

**Evidence standing / revision / priority.** Static-proven repeated scheduling; approximately 25 empty scheduling opportunities per second is a timer-derived upper-order estimate, not measured CPU/load. O-I baseline file unchanged in the final delta. No repair candidate or installed observation inspected. **Medium priority; high confidence in control flow.**

**Restoration and compatibility.** Stop output polling at EOF while retaining the transcript and explicit exit/re-entry state; distinguish output EOF from any separately needed child-exit observation. Preserve view migration/checkpoints and native child reaping. Reuse an owner-level observation mechanism where appropriate rather than adding another status store. No wire incompatibility is inherently needed.

**Receiving experience.** An ended terminal remains inspectable with “Shell exited” or a more exact native state; no spinner or implied current Agency. Reopening a transcript must not secretly start work. Existing Attach selection remains context selection, not provider attach.

**Discriminating proof.** Through the actual terminal surface, end a disposable shell, drain output and verify subsequent poll calls stop while text and selection remain usable. Move/reattach the view and check stale leases still reject input. A disconnected EOF handler must fail the call-count/readback assertion. Measure resource benefit separately before quoting a performance improvement.

**Execution placement.** O-I frontend/PTY tests on the current UI line, then real Tauri/Mac behavior. No Workcell process ownership redesign, no personal session termination and no production modification in this review.

## 7. Code cohesion, readability and consolidation

No runtime path is certified dead by this review. The SDK, conditional compilation, CLI registration, external consumers and persisted receipts make superficial “unused” judgements unsafe.

| Candidate / relationship | Consequence and retained boundary | Required checks before removal or consolidation |
|---|---|---|
| Place live command/error handling | Repeated raw subprocess/parse logic has already diverged from the more careful request-side tmux no-server classification and bounded target-service runner. WC-001/004 identify concrete consequences. | Consolidate genuinely shared command/deadline/error semantics, not tmux/Herdr native address or lifecycle meaning. Preserve strict argv and provider-specific output/version handling. |
| Workcell and AIKit mux adapters | Workcell observes/hosts/releases material; AIKit plans/focuses/binds working surfaces. Similar CLI calls do not by themselves establish duplicate domain ownership. | Check all public environment registrations, aliases, direct harness use, TUI routes, alternate platforms and grant consumers before deleting either adapter. Prefer shared wire/observation helpers only where responsibilities truly coincide. |
| Local/remote Workcell CLI | The remote launcher includes the local CLI implementation and reuses parsers rather than inventing a second planner. The explicit remote whitelist is maintainable but can drift from local capability exposure. | Add a supported-operation crosswalk/conformance test; do not route every local secret/machine/connection command remotely merely for symmetry. |
| Provider SDK and legacy provider implementations | Thin exported ports and external consumers justify compatibility; older provider code is not dead because OpenSandbox is newer. | Actual registration, feature flags, SDK examples, build targets, supported platforms, migration receipts and live provider use must be checked before retirement. Those checks were not exhausted here. |
| O-I session-space alias | Final delta retains `oi aikit-session-space` as a compatibility spelling but routes to `aikit session-space`; this is a meaningful repair, not an extra product. | Keep compatibility tests and remove stale operative companion assumptions, not the safe alias. The complete installer delta was not audited by this desk. [O-route-final] |
| Large implementation files | `place.rs`, CLI and connection/session files carry significant responsibilities, but size alone is not a defect. | Extract only along observed responsibilities: provider I/O, generation decision, lifecycle receipts and presentation. Preserve error provenance and test seams; no generic abstraction programme. |

The page cap in sandbox reconciliation bounds list work, but the inspected report has no explicit “listing truncated at cap” field. This is a limited completeness/disclosure question, not proof of an infinite loop or a new high-priority defect. Receipt-CAS retries in Factory are bounded and are not equivalent to retrying provider effects. Those distinctions prevent a misleading blanket efficiency diagnosis. [W-reconcile] [F-material]

## 8. Visibility, configuration and operative-practice contracts

### Human receiving contract

The following are restoration requirements derived from [A2]/[A4], with suggested phrases marked as proposed copy. They are not claims that all corresponding controls are already implemented.

| Existing destination | Subject and actual native read | Standing, action and authority | Result, timing, failure and depth |
|---|---|---|---|
| Global System / provider detail | Selected Workcell, native `system`, provider discovery, connection/lease and material observations | Show declared/effective/active/staged separately. Unavailable GPU/fabric/settings faculties remain unavailable. Configuration changes use native contributed operations, not a copied O-I provider model. | Receipt plus later native re-read; expose pending restart, partial apply, stale observation and unsupported remote settings. Show executable/source/install provenance only when actually known. |
| Agents tab | Selected actual Agent/Agency, AIKit harness/model/session and material-binding readings | Skill selection is not permission. Requested/resolved/observed model and host are distinct. A process listed by Workcell is not automatically this Agent. | Explain missing capability versus missing Skill, unavailable host, locked credential store, or unproved activation. Preserve resident session and pending permissions. |
| Run tab / Observatory depth | Exact current work, Workcell/root-child NOW, actual AgentSession/process, native Activity/Return | Inspect/open/interrupt/cancel/stop/release are separate owner operations. Administrative whole-room close requires its actual wider scope. | Update through owner event/cursor semantics; no fake healthy state from a port, no success from issued cancellation, no inferred Return from process exit. Retain unknown effects and executable recovery route. |
| Context tab | Selected source objects and effective context/projection state | Selected/highlighted is not loaded, authorized, shared or recognised. Edit only the permitted native source, or propose an authored change. | Show source/scope/revision, stale or withheld state, projection/activation receipt and actual later use. Do not mutate generated copies or expose private root Control by parent membership. |
| Project Now / footer / Personal Today | Central temporal readings correlated with eligible Workcell observations | Open the same work without reminting its child NOW. End Day is Central's temporal action, not machine reset. | Offline machine remains identifiable; late Return retains occurrence time and original root/child address. Reconnect is not local fallback. |
| Terminal surface | The actual local PTY, view lease, cwd and transcript | Clear screen is presentation only. “Attach selection @” proposes context; it does not attach a remote provider. Closing the owned local shell surface can invoke local PTY lifecycle; it must not be represented as generic task cancellation. | Preserve transcript/readback, explicit EOF/error, stale-lease refusal and bounded polling. Remote work needs a separately verified binding/control, not a relabelled local shell. |

### Configuration and recovery

The production O-I `liveSource.ts` is a useful positive specimen: it reads the native contribution registry, holds desired values separately, binds plans to the producing requests, refuses apply when that session binding is missing, and projects native result/error shapes. Profile activation records the active desired document rather than pretending all owners have applied it. Preserve those semantics. [O-config-live]

Final O-I registry source now consults a resolvable composition-registered executable before falling back to the catalogue, which repairs a concrete developer-source discovery mismatch. This desk did not exhaustively prove all combinations of active-suite receipt, explicit executable override and registry discovery, and therefore does not award universal executable-selection parity. The actual dispatch route's override/active-receipt/registration order is separately visible in source. [O-registry-final] [O-route-final]

Workcell disclosure, mutability contribution and actual lifecycle are three different surfaces. A settings descriptor cannot authorize a service restart; a staged profile does not establish an active provider; a recorded endpoint does not prove application health. Reset should be a native supported setting operation with its own scope and receipt, not deletion of a provider state root. Unknown partial effects require inspection/reconciliation, not dropping the journal to make health green. Remote Workcell configuration is explicitly unsupported by the inspected control route and must be shown that way. Detailed individual Workcell setting implementations remain an explicit coverage limit. [W-71] [W-remote-cli] [W-caw]

Secret references, authorization scope and store availability can be disclosed; secret values must not appear in arguments copied to reports, UI diagnostics or ordinary receipts. Required mounted paths, egress enforcement, read confidentiality and live revocation must be shown as separate supported/unsupported facts. Landlock write support cannot stand in for those guarantees. [W-boundary] [W-opensandbox]

### Agent practice

Workcell operation descriptions should lead the actor to inspect requirements, actual provider availability, permitted effect and expected result before invocation. Provider-authoring descriptions should lead to the public SDK and concrete lifecycle evidence, not just compilation. The current O-I strap explicitly routes to native discovery and applicable maintained practices; preserve it as editable native source with receipt-gated projections. Do not substitute this report as a frozen operational strap. [W-operation-skill] [W-provider-skill] [O-strap-final]

Tests should begin from the user's ordinary task and actual entry surface, without teaching the actor the expected command or hidden answer. Include near-misses: an unavailable provider is not a missing Skill; changing a Skill is not starting a process; selecting an AgentSet is not selecting a SkillSet; a source edit is not effective loading; and a readable root file is not authorization to project private context.

## 9. Bounded alignments in dependency order

These are proposals for a later commission, not work executed by this report. Reuse the existing owner feature lines and one reusable workspace for a coherent change; do not create a worktree per finding or move builds onto the personal Mac because a remote adapter is inconvenient.

| Order / packet | Native owner and smallest scope | Dependencies and compatibility | Proof and place |
|---|---|---|---|
| 1. Preserve uncertainty at place boundaries | Workcell #72: WC-001/002/004; provider observation, typed failure/effect standing, bounded command execution | Pair Factory's existing place consumer; preserve ordinary v1 success/refusal compatibility where possible. No automatic uncertain-effect replay. | Original CLI/Factory entry, scripted failure states and disposable native providers. Repository work first; no personal host required. |
| 2. Exact material address and release scope | Workcell #72 plus Factory attempt-place consumer: WC-003 | Coordinate versioned grant evolution and persisted old receipts; retain legitimate native provider differences. Depends on packet 1's uncertainty handling. | Two controlled servers, generation/name reuse, shared-room protection, old/new decode. Then authorized real Mac/Omarchy provider proof. |
| 3. Separate administration from owned cleanup | Workcell existing sandbox/reconciliation line: WC-005 | Explicit server authority versus world/attempt scope; preserve safe report-only/admin usage and retained snapshots. No Factory developmental ownership in Workcell. | Mixed-owner disposable server, renewed leases, snapshot retention, later independent listing. |
| 4. Join temporal/session/actual-work evidence | Central #150/#153; AIKit #275/#277/session lanes; Workcell #72; Factory #195; O-I #220 | Consume exact native root/child, material generation, selected Agent and actual Return. Inspect pending source before duplicating it. Packet 2 informs safe cross-host controls. | Paired owner conformance first, actual installed Agent/permissions/Return second, two physical hosts for distributed acceptance. |
| 5. Receive in the current UI and practices | O-I #65/#155/#289/#292 and AIKit existing TUI work | Use Run/Agents/Context and Desk/Tasks, native config/profile engine and editable maintained Skills. WC-006/007; no new dashboard/status store. | Disconnected-handler negatives, explicit stale/denied/unknown states, later readback, actual Mac/Tauri/TUI/harness loading and human comprehension. |

The report deliberately does not introduce a new provider programme, new temporal ontology, new semantic World per task, or infrastructure redesign. Repository-level corrections should not be delayed merely because their final physical proof belongs on Omarchy or the Mac; equally, passing repository tests must not be relabelled as that physical proof.

## 10. Final delta, limits, physical questions and publication state

### Final delta disposition

The five native-owner comparisons other than O-I were identical to the frozen vector. O-I had advanced four commits to `a5012f5aa44d0fed317a261b009250d70013ccb5`. The inspected final route, registry and strap repairs are credited in this report; the local terminal files underlying WC-007 were unchanged in that delta. Historical statements that Workcell #71 is still pending, Herdr lacks a public AIKit provider, the Central-to-Workcell requirements join is wholly unwritten, or the O-I session-space companion must still be shipped are not retained as current findings. [O-delta] [O-route-final] [O-registry-final] [K-working] [K-placement]

A branch report cannot establish what is currently installed. No private machine locator, credential or local installation receipt was obtained. The running installation campaign remains untouched. Any later synthesis should compare the exact returned install vector with these source-bound findings rather than infer installation from a merged PR.

### Coverage limits

This review did not read every line of every provider or all six products. It recovered the full Workcell material field from its native authorities and read the principal paired operations described above. In particular, complete GPU/hardware observation, every Docker/Arrakis/OpenSandbox adapter path, Mac Keychain and Linux Secret Service internals, all config setting validators/reset handlers, the complete TUI/Observatory implementation, all current Skill projection/loading code, every Central machine/root-NOW implementation branch and Factory's full independent verification/Return lifecycle remain uninspected or only partially inspected.

Some protocol-linked archival authorities—complete Stories, Practice Conditions, Document Operations, all local-campaign modules and full historical #65/#220 comment sequences—were not read in full. The authority for actionable findings is therefore the explicitly linked full founding/temporal/current-UI/native sources and the exact #72 amendment, not an assertion of exhaustive archival recovery. These limits do not erase the paired static findings; they prevent a broad completion certificate or a claim that missing evidence means missing code. No runtime path is declared dead.

### Questions that require actual physical or provider proof

| Proof environment | What can be established there | What must not be inferred |
|---|---|---|
| Repository tests / controlled native processes | Parser/error-state distinctions, exact argv and refs, grant compatibility, bounded operations, receipt readback, configured isolation negatives on a suitable test kernel | Installed human World, actual credentials/harness loading, independent verification or hardware acceptance |
| One sandbox / guest | Its actual backend lifecycle, allowed/denied mounts and egress, lease renewal, checkpoint restore, credential injection/revocation, persistence and recovery | A second independent machine, distributed identity, physical network/power failure or Mac behavior |
| Two guests on one physical host | Distinct guest identities/endpoints, cross-guest control, separation and reconnect behavior within that topology | Two independent physical Workcells or resilience to the common host's loss |
| Real Omarchy | Actual user-service persistence, Herdr/tmux CLI/TTY/server generations, Linux Secret Service availability, kernel-supported confinement, root/child material presence, headless continuation | That the Mac selected the same suite, that UI access is correctly remote, or that another physical machine behaved correctly |
| Real Mac | Exact installed executable/GUI/TUI route, Keychain permissions, local terminal view lifecycle, native unsupported confinement disclosure, actual harness loading and source-preserving setup | Linux Landlock support, Omarchy service ownership or remote result continuity |
| Mac plus Omarchy as two physical machines | Independent host identities and receipts; one actual Agent/workflow's original temporal address across remote open, UI disconnect, provider replacement, late Return and Day rollover | Success from two fixture rows, two ports, one guest twice, or a process-name match |

Specific adversarial acceptance still needed: real PID/name/server reuse; reused service ports with the wrong application; unknown/orphan resources after interrupted creation; lease renewal and revocation during reconnect; no duplicate consequential effect; exact protected-source/uncommitted/artifact/Return preservation; unsafe mount and denied-egress canaries; vault sidecar recreation and reauthorization; native cancellation versus observed completion; and a real visible action whose disconnected handler causes the test to fail. Hardware and application-health claims require actual corresponding observations, not a healthy generic transport.

### Publication state

This document is the sole authorized report artifact for this desk. It is submitted on a report-only branch from current O-I main. Publication requires changed-path verification, normal PR checks/review, merge and main-branch readback; the PR and final chat receipt record the resulting publication commit. No source repair or campaign mutation is included, and this text does not predeclare a merge before that readback occurs.

### Immutable evidence index

The link labels below are used at the relevant claims above. Functions and sections identify the reviewed material within each pinned file; no tool-local citation is required to recover the evidence.

[R-protocol]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/docs/reviews/product-fidelity-2026-09-19/README.md
[R-baseline]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/docs/reviews/product-fidelity-2026-09-19/BASELINE.json
[A1]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/positions/FOUNDING-POSITIONS.md
[A2]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/experience/WORKCELL-NOW-TEMPORAL-FIELD.md
[A3]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/experience/SESSION-GROUNDING.md
[A4]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/docs/experience/FACTORY-UI-INTEGRATION-HANDOFF.md
[W-architecture]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/ARCHITECTURE.md
[W-profiles]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/DEPLOYMENT-PROFILES.md
[W-matrix]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/ProjectCentral/user/capability-matrix.json
[W-caw]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/CAW-MATERIAL-OPERATIONS.md
[W-census]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/PLACE-CENSUS.md
[W-connections]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/CROSS-CELL-CONNECTIONS.md
[W-opensandbox]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/OPENSANDBOX-SOURCE-INTEGRATION.md
[W-factory]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/docs/FACTORY-INTEROP.md
[W-sdk]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-sdk/src/lib.rs
[W-operation-skill]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/skills/workcell-operation/SKILL.md
[W-provider-skill]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/skills/provider-authoring/SKILL.md
[W-place]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/place.rs
[W-place-tests]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-cli/tests/places.rs
[W-instances]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/instance_registry.rs
[W-local]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/local.rs
[W-external]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/external_service.rs
[W-boundary]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-runtime/src/write_boundary.rs
[W-network]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-control/src/network.rs
[W-control]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-control/src/service.rs
[W-reconcile]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-opensandbox/src/reconcile.rs
[W-cli]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-cli/src/main.rs
[W-remote-cli]: https://github.com/EpiLogos/Workcell/blob/04160f51d37e78d600f32440b4f5275c02b78e9c/crates/workcell-cli/src/bin/workcell.rs
[W-72]: https://github.com/EpiLogos/Workcell/issues/72
[W-72-amendment]: https://github.com/EpiLogos/Workcell/issues/72#issuecomment-5625308088
[W-71]: https://github.com/EpiLogos/Workcell/pull/71
[W-73]: https://github.com/EpiLogos/Workcell/pull/73
[W-90]: https://github.com/EpiLogos/Workcell/pull/90
[C-machine]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/docs/MACHINE-WORKCELL-RELATION.md
[C-placement]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/continuous_work/placement.rs
[C-continuous]: https://github.com/EpiLogos/Central/blob/0a58a32c7587f5576ace4239a1fd6d9bde868510/ctrl/src/continuous_work/mod.rs
[K-placement]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/central_placement.rs
[K-enforcement]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/placement_enforcement.rs
[K-instances]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/workcell_instance_intake.rs
[K-working]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/working_environment_field.rs
[K-surface]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-cli/src/session_space_working_surface.rs
[K-process]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/connection_process.rs
[K-host]: https://github.com/EpiLogos/ai-kit/blob/944e00e1cbec79d4a23b46d78231b78816b5dad5/crates/aikit-adapters/src/agent_session_host.rs
[AC-actualisation]: https://github.com/EpiLogos/Actuation/blob/47f4fa3c184850e254ef5089696bf5fbbad907ec/crates/actuation-runtime/src/actualisation.rs
[AC-realised]: https://github.com/EpiLogos/Actuation/blob/47f4fa3c184850e254ef5089696bf5fbbad907ec/crates/actuation-runtime/src/realised.rs
[F-place]: https://github.com/EpiLogos/Factory/blob/bbb8f48943cf1cf398005ae40ee8fa29c111c3a5/factory/src/attempt_place.rs
[F-admission]: https://github.com/EpiLogos/Factory/blob/bbb8f48943cf1cf398005ae40ee8fa29c111c3a5/factory/src/attempt_material_admission.rs
[F-material]: https://github.com/EpiLogos/Factory/blob/bbb8f48943cf1cf398005ae40ee8fa29c111c3a5/factory/src/attempt_material.rs
[O-config-live]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src/configuration/liveSource.ts
[O-terminal]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src/terminal/TerminalSurface.tsx
[O-pty]: https://github.com/EpiLogos/O-I/blob/a1c7010fa290219d58f78ee03f55651ac14ed75d/desktop/cradle/src-tauri/src/terminal.rs
[O-route-final]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/cli/src/product_command_route.rs
[O-registry-final]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/cli/src/configuration/kernel/registry.rs
[O-strap-final]: https://github.com/EpiLogos/O-I/blob/a5012f5aa44d0fed317a261b009250d70013ccb5/skills/central-session-strap/SKILL.md
[O-delta]: https://github.com/EpiLogos/O-I/compare/a1c7010fa290219d58f78ee03f55651ac14ed75d...a5012f5aa44d0fed317a261b009250d70013ccb5
