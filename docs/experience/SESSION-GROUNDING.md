---
Register: episteme
Standing: agent-inference
---

# Session grounding and continuity — integration map

**Commissioned 2026-09-14.** This is the source-grounded implementation/testing map requested after the Factory/Agency design was adopted. It connects existing contracts and records current findings; it does not promote the attached session's metaphors or proposed defaults into new authored law. The accepted human experience remains [FACTORY-AGENCY.md](FACTORY-AGENCY.md).

**Native integration:** [O:I #220](https://github.com/EpiLogos/O-I/issues/220). **Desktop integration:** [#289 / #292](https://github.com/EpiLogos/O-I/issues/289). **Inhabited reference World:** [#158](https://github.com/EpiLogos/O-I/issues/158) / [#159](https://github.com/EpiLogos/O-I/issues/159). **Whole proving:** [#201](https://github.com/EpiLogos/O-I/issues/201), #202–#205 and [#65](https://github.com/EpiLogos/O-I/issues/65). The [source module](session-grounding.json) binds the detailed obligations to existing UX stories and the existing matrix.

## 1. What the complete interaction must make true

A person chooses an Agent and work, continues in an existing environment or chooses another suitable one, and sees what actually became operative. Closing the view leaves permitted background work alive. Returning opens the intended work, not a similarly named replacement. Working from another computer can mean contacting the same remote execution; deliberately moving execution is a separate operation with its own recovery evidence.

For commissioned development, the same arrangement carries a real Run, independent work and verification, actual Git changes, artifacts and continuation. The Factory UI presents that relation through the accepted centre/right/footer arrangement. Native layers make it true:

| Concern | Native responsibility | What the person/Agent can rely on |
|---|---|---|
| Durable purpose, source, machine roles and working destination | Central | Real authored scope and references, explicit proposals/defaults, legitimate root or Project NOW |
| Who may perform which act | Actuation | Real Agent/Agency/WorldBinding and bounded, current authority; attributable Activity and Return |
| What becomes operative for this act | AIKit | Selected context/praxis/model/harness, effective composition, AgentSession and SessionSpace relations |
| Persistent terminals and other concrete environments | AIKit environment adapters and the native providers | Exact native workspace/pane/window/connection bindings and truthful provider-specific lifecycle |
| Where the processes/services/storage/network exist | Workcell | Actual material placement, observation, supported persistence/recovery and finite resource/effect boundaries |
| Developmental purpose and accountability | Factory | Commission/Journey/Run, exact attempt, independent work, evidence, Candidate and Recognition |
| Human and Agent access | Native Surfaces, Gateway, O:I and the OS host | Appropriate forms of the same permitted state and operations, with stable return routes |

These are interacting owners, not seven compulsory deployment stages. A valid thin/local or externally started session remains useful without a persistent multiplexer, Factory, remote service or QL. The Omarchy reference specifically requires the richer Herdr/Hyprland/Gateway experience under #158/#159; generic portability does not excuse dropping that reference branch.

## 2. Source and current starting position

Read the sources for the seam being changed, retaining their scope:

- [Founding positions](../positions/FOUNDING-POSITIONS.md), [persistent agency/hosting](../PERSISTENT-AGENCY-AND-MATERIAL-HOSTING.md), [operative front door §7](../OI-OPERATIVE-FRONTDOOR-WAYFINDER.md#7-guardian-composition).
- AIKit [runtime composition §§70–83](https://github.com/EpiLogos/ai-kit/blob/main/docs/v2/09-COMPOSABLE-RUNTIME-ENVIRONMENTS.md), [persistent Surfaces §§84–90](https://github.com/EpiLogos/ai-kit/blob/main/docs/v2/10-PERSISTENT-AGENCY-AND-MATERIAL-HOSTING.md), #53/#114, completed #61–#63/#139 and current #274–#277.
- Workcell [multi-Workcell placement](https://github.com/EpiLogos/Workcell/blob/main/docs/MULTI-WORKCELL-PLACEMENT.md), [control/service hosting](https://github.com/EpiLogos/Workcell/blob/main/docs/CONTROL-SERVICE-AND-AGENT-HOSTING.md), [resource usage](https://github.com/EpiLogos/Workcell/blob/main/docs/RESOURCE-USAGE.md) and #72.
- Central [machine relation](https://github.com/EpiLogos/Central/blob/main/docs/MACHINE-WORKCELL-RELATION.md), #137/#142/#143/#153; Actuation [World-bound agency](https://github.com/EpiLogos/Actuation/blob/main/docs/WORLD-BOUND-ROOT-AGENCY.md) and [#84](https://github.com/EpiLogos/Actuation/issues/84); Factory [hosting alignment](https://github.com/EpiLogos/agent-system-design/blob/main/docs/canon/PERSISTENT-AGENCY-MATERIAL-HOSTING-ALIGNMENT.md) and #221/#222.

### Observed source cut

| Repository | Inspected main |
|---|---|
| O:I | 5d6538dbecf4e77229de8bbc18a0a8768868e686 |
| AIKit | 856f454778e5a44e8055751bb59ed933caf210ce |
| Workcell | e4e40a91fe7ed1776e634cad768f1049c39fd34e |
| Actuation | 67e6b296b85bd3eb1554802fd55a476c474aa566 |
| Central | 39efa03ea8607bdd8a79b0e317457c2ccc3ead4c |
| Factory | a335048b0a5b907adc5d09f0dcbda05b98f79a05 |

These identify the investigation, not future fixed execution pins. Source, built binary, installed binary, running service and provider integration versions must be reconciled at execution.

Preserve existing Omarchy work:

- O:I `/home/frank/Central/Work/O-I/.worktrees/cradle-factory-arrangement`, observed local HEAD `ef5d1213da77da984098822d4ffa1cc671953012`, unpublished/dirty work beyond #292.
- AIKit `/home/frank/Central/Work/ai-kit/.worktrees/session-space-working-surface`, observed local HEAD `cee4cc15596bc559dc8b661afb2485956fc83e50`, beyond published #311 `461dcc86e03f4242488e99764b4d4f9cab084955`. Pending changes include `session_space_working_surface.rs` tests, `aikit-store/src/encounter.rs` and new `encounter_addressing.rs`.

The native integration stream takes responsibility for continuing that AIKit owner work; the desktop stream consumes its contracts. Record the ownership handover in #220/#311 before either writes. Preserve unpublished work rather than replacing the worktree with the published PR head.

### Concrete findings

1. AIKit already has `aikit-adapters/src/herdr.rs`, with explicit canonical/native bindings and a pinned upstream revision. Current `aikit-cli/src/working_environment_field.rs::detect` lists tmux/cmux; its ordinary operation dispatch likewise uses that narrower field. #311's exact working-Surface operations consume it. Finish the public Herdr integration instead of writing another adapter.
2. Workcell `instance_scan.rs` observes detected harness executables and live processes. `instance_registry.rs` deliberately permits several PIDs per executable-based contract identity. That record is not one execution/session/pane. It currently cannot supply the full exact place-to-process relation by itself.
3. Workcell `resource_usage.rs` already checks process start marker and executable across observations. Reuse this discipline; do not invent a new PID-only continuity checker.
4. Central current `ctrl/src/world.rs` already has `default_agent_set_ref` and `orchestrator_agent_ref`. #137/#143's older “the fields do not exist” blockage is stale. Generic support, actual selected source and local adoption remain separate facts.
5. Actuation #58 is closed. Continue its accepted Rust contract; #84 owns the particular local authority/admission join. Research #79/#80 is separate active work to preserve.
6. #311 provides useful persisted binding, model-control and replay work. Its `ReobservedUnproven` / `ReboundByExplicitOpen` distinctions correctly avoid claiming continuity from a recreated terminal plan. Retain them or compatible stronger evidence.

## 3. Place, identity and the meaning of continuity

SessionSpace is a semantic arrangement independent of Project, AgentSession, provider and machine. It can bind several Surfaces/providers and several sessions. An actual process can already exist before AIKit is involved; a new session can also require AIKit to request an appropriate environment. Both paths are legitimate.

Use the current owner types to retain the relevant chain:

`Agent / Agency / World / purpose → AgentSession / composition revision → SessionSpace / Surface binding → addressed provider and material placement → native process/place observations → Activity / output`.

This is a required trace relation, not a mandate for a new aggregate record containing every field.

| Transition | What must be established |
|---|---|
| Open another view / remote access | Existing execution is still the target; no spawn or restart merely to show it |
| Detach/reconnect while host lives | Exact provider binding and process evidence; useful work progressed once while detached |
| Provider/server restart | Report what was restored: layout, screen history, native session or a newly prepared body |
| Rehydration | New runtime receives the selected permitted context/obligations; retained text alone proves nothing about uptake |
| Move execution to another host | New material placement and validated native continuation or explicit successor session/attempt |
| Same name, pane ID or numeric PID reappears | No continuity inference without namespace, generation/start and owner evidence |

A process identity is scoped by its material host and native start/generation evidence. Different machines can have the same numeric PID; the same machine can reuse one. Provider IDs can also be scoped to a server/socket/generation. The brief's demand that “PID must differ” is not a portable correctness rule.

Stable Agent/Project/Journey identity must survive presentation/material changes where its native law requires. Provider session continuity is conditional, and any AgentSession/body/attempt replacement must remain visible. Terminal output, a checkpoint and a native conversation token are different evidence.

## 4. Source, working destination and resident placement

Central's machine roles declare intended relations; Workcell reports the material facts. Root/Project NOW owns bounded working material. Repository/worktree source, build output, provider state, credentials and task scratch keep their different existing destinations.

Resolve the actual human/World/Project, selected Agent or eligible participant, source revisions, context permission and task destination before preparation. An existing external repository without ProjectCentral is valid ground. Two concurrent tasks receive distinct writable task material; same-task retry reuses the intended allocation.

The observed `omarchy-resident-worker` is an existing native tmux session, not proof of a recognised resident Agent or a universal required “house”. Inspect any existing authored resident convention and its machine/provider binding. Only explicit adopted policy can choose that default. Preserve it during testing; use agent-owned isolated targets.

A default environment is a preference subject to capability/authority. A required environment/host is a constraint: no silent fallback. Herdr is the first rich Omarchy reference, tmux is the thin provider, cmux is optional where installed. Missing cmux on Omarchy neither fails tmux nor certifies cmux.

Do not bind all Agent work to one resident session. Workspace sharing, writable subject sharing and execution authority are different relations. Per-session/private context and permitted worktree writes must remain bounded even when the same provider server hosts several Agents.

## 5. Material census and multi-Workcell placement

Use Workcell's existing discovery, placement, material-world, service and observation APIs. The “meta-workcell” concern is already substantially carried by discovery sources, placement decisions and Central machine relations. Extend these public readbacks only where needed; do not introduce a third Central-like register, global Agent store or compulsory control daemon.

For each accessible material field, establish:

- actual addressed Workcell/provider/server identity and fresh/failed/stale observation;
- process start/executable evidence and provider workspace/tab/pane/container relation;
- known canonical session/Surface/work correlations only from explicit owner bindings;
- pre-existing external/unclaimed work, with no fabricated Agent or Factory ancestry;
- lifecycle ownership, storage retention, reachability and supported recovery;
- limits of observation and permission.

A failed or partial scan does not mean everything disappeared. Aggregate executable identity must not collapse simultaneous executions. Workcell consumes provider observations at their material scope; AIKit continues to own SessionSpace/Surface bindings and Actuation owns actual Agency.

Multi-Workcell discovery can present several actual machines or nested material worlds. A network endpoint, hostname, `workcell:local` alias, terminal label or PID is insufficient global identity. Resolve aliases in the addressed context and preserve the owner's WorkcellRef and transport provenance.

Retain the existing distinction between desired placement, plan, prepared world and observed live material. A short-lived command cannot promise its own child service survives its exit. Select target-owned persistence or a supported persistent host where the task requires it. Explicit material confinement must be tested; shared tmux/Herdr panes alone are not a filesystem/security sandbox.

## 6. Native provider lifecycle and safe addressing

Continue AIKit's environment/provider application, including #311. Wire Herdr through ordinary discovery, selection and exact persisted open/focus/attach/reconnect operations, retaining tmux/cmux and graphical providers. Inspect each version's true support instead of advertising a common capability superset.

Opening an existing binding should reuse it. Creating or recreating is a deliberate operation. Crash between provider creation and binding persistence must reconcile the already-created material rather than duplicate the task. Foreign panes/processes and local configuration survive reconciliation.

Every input, interrupt or close addresses the exact current provider binding under its permitted operation. A stale target must not silently redirect to another session or newly recycled pane. Where atomic/native protection is unavailable, report that limitation and withhold operations whose required guarantee cannot be met.

The TM02 incident is concrete: on the inspected Omarchy tmux server, `detach-on-destroy` was `off`. The native client switched to the resident session when the test session was killed. The [tmux manual](https://github.com/tmux/tmux/wiki/Getting-Started) and installed option/command help are the version basis for selecting the supported remedy. Prove client isolation and safe detachment with scoped provider settings/handles, not a global user-configuration rewrite.

Closing a view, closing a pane, interrupting an Agent turn, stopping a process, releasing a material world and ending a Factory attempt are separate operations. Preserve meaningful failures and supported recovery. In particular, Herdr's native status label “done” does not certify Factory evidence or Recognition.

## 7. Effective composition and agent-accessible operation

AIKit's composition grammar already spans Components, Contracts, providers, contributions, scopes, lifecycle and Surfaces. #158/#53 explicitly extend its application beyond one harness: Herdr, graphical environment and client/UI composition must not be forced into a HarnessComposition-shaped object.

Resolve and explain three separate questions: why source/configuration was selected; where its effects are active; what owns their lifetime. A Project-selected Skill or component can activate for one session only.

Use the shared native composition path to join selected identity/participation, praxis/SkillSets/Methods, Knowledge/Context, model policy/route, harness edition, environment and authority. Methods retain the current Skill/Capability classification. Model/harness choice and runtime environment are coupled by actual required tools, modalities, costs and faculties.

Verify what entered the actual target: generated file, projected configuration, loaded instruction, usable tool and observed enforcement are distinct. Test two sessions in the same Project with different selected skills/context; changing one must not silently mutate the other's active state. Activation now, reconnect, new session and reversible external procedure remain truthful target modes.

Agent and human Surfaces invoke the same native Action handlers and receive the same attributable results within their disclosure scope. “Complete structured access” means complete permitted access, not unrestricted private world capture. Static and richly composable harnesses remain valid; preserve DSH/Pi/other existing evidence and require fresh proof only where changed contracts pressure it.

## 8. Authority, dispatch, services and Guardian agency

Central profiles, machine roles and Guardian formations do not issue runtime grants. Actuation #84 closes the scoped governing-authority join using existing grant/WorldBinding/determination contracts; AIKit #274/#275 composes and delivers through the actual supported body. Factory #221 correlates only the admitted execution that really acted.

Prove selected Agent → exact prepared context → actual harness request → substantive result → attributable Activity and return. A gateway journal append, transport acknowledgement, instantiation record or prepared terminal is not this proof.

Preserve addressed messages, session contribution, bounded delegation and independently grounded cooperation. Each child keeps subject/basis, effects, authority, independent verification, budgets, return route and lifecycle. One human unsent draft cannot become the dispatch buffer for machine messages.

Gateway application service, Workcell Control Service, provider multiplexer server and UI client retain their actual lifetimes. Restart one and observe precisely which relations survived. Supported communication and work continue while the desktop is closed; unresolved delivery must be reconciled before consequential retry.

Guardians are already specified in the O:I front-door/covenant and Central #137. Recover the real Field Guardian and product Agents, their authored expressions, formation/default relation, exact skill refs and current adoption. Their differentiation comes from enduring purpose, product Focus/Knowledge and work—not a new privileged profile class. Actuation Root Agency is relative to the enclosing World, not operating-system root.

Central can finish generic source/read/proposal/provenance and working-destination gaps independently. AIKit owns effective default/explicit selection and per-harness projection/loading. A closed design ticket does not prove the live default was adopted; explicit legitimate selection remains usable while any genuinely unadopted default awaits the owner's decision. Do not let old chart-time absence claims block current code.

## 9. Remote access, recovery and moving execution

Remote access to a living host normally leaves work where it is. SSH/provider remote attachment and Gateway conversation are different routes to the same permitted work, not migration.

The [current Herdr machine documentation](https://herdr.dev/docs/connecting-machines/) describes multiple remote connections while each target retains its own server/processes. Its [restore documentation](https://herdr.dev/docs/session-state/) distinguishes live detach, snapshot/layout restore, terminal history and native Agent resume. These current upstream descriptions do not certify the installed 0.8.2 integration; pin and test actual target support.

Deliberate re-placement follows this existing-owner sequence:

1. Resolve the target's real offers, storage/source availability, authority, credentials and required capabilities; retain explicit no-fallback constraints.
2. Account for in-flight requests, pending tools/permissions, uncommitted work and uncertain external effects. Quiesce or fence competing consequential execution where required.
3. Preserve bounded permitted context, native continuation artifacts where portable, exact Git/source basis, outstanding obligations and return route. Keep private source and secrets within their authorised transfer mechanisms.
4. Prepare the target material world; invoke supported native resume or explicit rehydration/successor creation. Revalidate grants, model policy and skills/context activation.
5. Prove actual target-side operation and correlate old/new material and any session/attempt change. Reconcile late source-host output against the current basis.
6. Release old material only according to its owner/lifecycle and after retained material and outstanding effects are accounted for.

Do not promise universal exactly-once delivery, portable hidden model state, or process migration. Same-host supported live service handoff can preserve processes; server reboot generally cannot. A two-directory test is not second-machine evidence.

## 10. Factory, Git, returns, temporal work and native presence

Factory's required developmental arrangement uses this same operative path. Express environment/persistence/isolation and verification needs through ExecutionDisposition; AIKit resolves the session/environment and Workcell the material demand. Factory does not prescribe a provider unless the declared reference/purpose requires it.

Correlate the real attempt with exact repository/worktree and source basis, Agency, AgentSession, SessionSpace/working Surface, material observation, Activity range and evidence. Retain independent writer/barrier and verification laws; a recovered process does not erase a failed attempt.

The UI consumes actual outputs through the accepted HTML/template and native diff/preview Surfaces. Those bodies and the structured handoff stay reachable when a terminal view closes. A handoff identifies exact continuation basis and remaining work. Git integration, evidence and Recognition remain separate.

Central NOW/Inbox/DAY receives references to the real work, and AIKit Routine/provider scheduling can re-enter it under current proof/authority. Reconnect and DAY rollover do not schedule work or replenish exhausted bounds.

O:I #159 handles native Omarchy entry/focus/attention. Provider-bound window keys, panel/tray and desktop should open the exact canonical subject. Hyprland permission denial is a negotiated operation failure, not a new philosophical ban on automation or reason to bypass the compositor. Preserve authorised visible control, keyboard/pointer and the host's actual permission model.

The factory and architecture streams share these producer/consumer contracts. No terminal/provider business commands, grant issuance, private session store or material registry belongs in React.

## 11. Work allocation and concurrency

The owner now requests parallel UI and native architecture work. This supersedes earlier instructions that made the Factory UI integrator write every native dependency.

| Lane | Owning work and files | Boundary / return |
|---|---|---|
| **A — native integration lead** | O:I #220; AIKit #274/#275/#277/#276, #53/#114 and existing #311; Actuation #84; Factory #221/#222 and required cross-owner contract joins | Owns AIKit core/session/provider changes and convergence. Publishes exact operations/versions, source cuts, evidence and ready consumer entry points in #220/#289. Does not edit the Factory UI. |
| **W — material provider stream, independently startable** | Workcell #72, existing runtime instance_scan/registry/resource_usage, placement and service/provider tests | Extends material observation/placement/lifetime and real local/second-placement proof. Does not implement AIKit SessionSpace or Factory ancestry. Publishes native contract/evidence to A. |
| **C — source and Guardian stream, independently startable** | Central #137/#143/#153; machine/world/AgentSet/profile/source/placement operations and their tests | Reconciles current source and generic owner support, exact Guardian/skill/default provenance and working-destination law. AIKit reader/projection changes go to A. Private adoption remains an actual scoped owner act. |
| **U — existing Factory UI stream** | O:I #289/#292, desktop Cradle/Tauri/owner-consumer code, template family, placement and app walk | Continues adopted design and uses A/W/C's public results. Existing AIKit #311 work transfers to A after reconciling its unpublished state; U avoids competing native writes. |
| **V — independent verification, after a usable joined cut** | #201/#202–#205 and #65; existing native runners and installed-world procedures | Repeats complete work and failure/recovery with fresh actor/verifier separation. Required H is supplied by the human, never inferred from tests. |

A alone sequences shared AIKit dispatch/context/placement writes and native integration. W and C can run independently against current seams; if they are not separately launched, A performs those native repairs. They are optional staffing, not human relay prerequisites. Do not launch another parallel AIKit session on #311. Preserve existing Actuation research and any live owner changes; #58 is completed, not an active refoundation queue.

Each assignment carries the current source basis, owned files, permitted effects, tests and a concrete returned native operation. Publish changes in the owning repository, with typed consumer/readback examples before dependent integration. Coordinate shared machine tests in isolated provider targets and serialize any operation touching the same running service. A integrates returned changes and updates readiness; U continues independent presentation work meanwhile.

## 12. Acceptance units and existing UX mapping

These identifiers name bounded integration/proof units, not new product primitives or new UX story IDs. Full branch detail lives in [session-grounding.json](session-grounding.json).

| Unit | Required proof | Existing stories | Lead |
|---|---|---|---|
| Unit SG1 source-place | Existing/new work, real root/Project destination, required/preferred environment and no forced migration/default adoption | TM01, TM02, AG01, MC01, DV02 | A + C |
| Unit SG2 identity | Exact semantic/native bindings; same names/PIDs, two simultaneous sessions, stale generations and no duplicate task | TM02, AG06, DV05, WK04 | A + W |
| Unit SG3 census | Real provider/process census, external work, failed/stale reads, executable aggregation versus each live execution | TM03, WK04, MC03, MC07 | W |
| Unit SG4 provider | Herdr public entry path plus tmux/optional cmux; precise open/attach/focus/close/recreate; resident isolation/errors | TM02, TM06, TM08, AG09 | A |
| Unit SG5 composition | Real selected and effective context/praxis/body, scopes/lifetimes, two-session isolation, actual tooling | AG03, AG04, PX02, PX03, PX04, PX06, TM01 | A + C |
| Unit SG6 authority-delivery | Real authority and response, finite plural work, native modes, no journal-only completion | AG07, AG08, GW06, GW09, DV01, TM03 | A |
| Unit SG7 recovery | Detached work, service/provider death, pending permission/effects, rehydration/replay and safe retry | AG06, AG09, GW05, GW07, MC06, DV04 | A + W |
| Unit SG8 remote | Same-host remote access versus deliberate second placement, source/authority/continuation proof, no silent fallback | MC02, MC04, MC08, GW08, TM09 | W + A |
| Unit SG9 guardians | Existing Guardian/source/default relations resolve and actually load under ordinary authority; profile-less valid work | AG01, AG02, AG05, AG08, TM01, TM03 | C + A |
| Unit SG10 factory-return | Real commissioned change, independent verification/Git basis, output/handoff/NOW and recurrence | DV01, DV02, DV03, DV04, WR05, WR06, TM05 | A + U |
| Unit SG11 presence | Exact host/desktop/TUI/Gateway access and attention; permission-aware focus and retained arrangement | UI02, UI04, UI05, TM07, TM09, GW05 | U + A |
| Unit SG12 joined | Full native and installed workflow, all applicable provider branches, independent verification | DV08, TM03, TM10, MC06, GW08 | A then V |

### Required connected walk

From actual recognised source, choose one existing Agent and an economical eligible harness/model. Allocate permitted task material and bind an existing terminal/workspace; demonstrate a separate deliberately created one. Verify operative identity/context/skills and legitimate writes, including two sessions with different scoped repertoire.

Carry a real Factory change in the **Herdr reference** while a Direct tmux session and external native harness coexist. Workcell reports actual places/processes; only the actual Factory execution has Run ancestry. One bounded child performs independent work and an independent verifier checks the actual changed Git state.

Close the views, receive attributable progress/output through another permitted Surface, reopen the exact work and inspect the accepted Factory output/handoff. Exercise provider/connection loss, stale target/name, cancelled/late output and a restart requiring explicit recovery. Then access the same remote work from the primary machine and separately test deliberate second-placement recovery with real material evidence.

Continue through NOW and supported recurrence with authority/proof revalidation. Retain no-QL usefulness and the existing Epi/Nara/Factory presentation parity. Test every available admitted harness against its true faculties; Herdr, tmux, cmux, Gateway and harness-specific passes remain distinct.

## 13. TM02 evidence and test repair

The original record is local to Omarchy: `/home/frank/tm02-field-test/receipts/90-scorecard.md` plus 10/20/30/40 receipts and screenshots, from task “Execute RUN-SHEET.md exactly”, 2026-09-13. Preserve it as failed full certification with bounded successes. The attached planning brief is interpretation of that record.

| Evidence | Retained meaning / next proof |
|---|---|
| tmux 3.7c and Herdr 0.8.2 pane processes kept running across view cycles | Same-host live continuity observed; not suite integration or reboot/migration proof |
| tmux test client switched to resident when target died; current detach-on-destroy off | Reproduce safely in isolated provider world; verify supported scoped remedy and exact input target |
| Herdr stale-session attach panicked in a non-TTY | Separate missing-session handling from terminal-init/preflight; exercise valid PTY and no-TTY; preserve original failure |
| Herdr prescribed pane-read syntax was invalid, corrected positional form worked | Fix version-pinned run-sheet command, retain original failed result |
| Duplicate-count assertion shared a token across tmux and Herdr | Use per-execution correlation and count within actual host/provider scope; do not label two intended jobs one duplicate |
| True PID reuse was not demonstrated | Use meaningful deterministic stale-binding/start-marker negative tests and real process replacement; do not require exhausting the host PID space |
| Herdr sampled reconstructed IDs differed | Sample evidence only; test native ID lifetime/server generation, never promise global non-reuse |
| cmux absent | Its real provider branch remains unavailable; no inference from tmux/Herdr |

Repository tests exercise production operations and their actual failure cases. Provider protocol fixtures can prove D/C only. Real installed processes and remote connections supply P/M; the human supplies H. Do not expose private terminal history, environment, source or credentials in telemetry/public receipts merely to prove continuity. Publish exact safe commands, versions, hashes, refs and bounded results.

## 14. Completion and return

Each unit returns the native operation that now works, exact changed source, required checks executed, live evidence where applicable and unresolved branches. Keep implemented, published, installed, observed and human-accepted separate. Source compilation of this map establishes none of those runtime outcomes.

The native lead finishes by giving the UI lead a usable current producer cut and completing the joined native flow. The UI lead completes the accepted experience against that cut. Independent verification follows the same real work across both. Remaining human judgement or genuinely unavailable material is named precisely; no passing provider slice closes the larger Factory, #158 or #65 programmes.


## 15. Native Agent creation and Direct-session delivery — 20 September 2026

This section continues SG12 and the existing #220/#65 campaign. The creation and
session consumers are production code, not renderer-only Agent records. Their
installation, actual model behaviour and human experience remain separately
proved. Both near-term outcomes remain standing: installable/self-inhabiting
technology **and** the complete source-backed published corpus. This lane does
not claim the Factory, voice, QL or publication programmes complete.

### Exact source and review boundary

The implementation is [O:I #424](https://github.com/EpiLogos/O-I/pull/424), branch
`agent/native-agent-session-20260920`. Its recovered UI source is
`060f0165a8ecbdc2fb3bece48c7c4d48d05e2610`, not an assumed main. The original
`agent/expression-world-convergence-20260917` ref was subsequently retired; the
immutable review anchor `agent/native-agent-review-base-060f0165` names those
same bytes. #424 is retargeted to that anchor so its review shows the bounded
Agent/session delta, not hundreds of inherited UI changes. **Do not merge the
review anchor into current main or restore its old UI wholesale.** Local
integration takes the reviewed delta into the actual reconciled application.

Native dependencies, with the exact inspected production cuts:

| Native owner | Required contract | Inspected head |
| --- | --- | --- |
| [Central #202](https://github.com/EpiLogos/Central/pull/202) | `agent-profile.review`, authenticated `.accept`, accepted `.roster`, exact source locking | `d0001cb7ca9eb2886c7158f05aa65272da198fa1` |
| [AIKit #358](https://github.com/EpiLogos/ai-kit/pull/358) | accepted Direct Agent binding, effective Skill discovery, preparation/readback, parent context and credential boundary | See #358's final head/CI receipt; production descended from `79790ad48d98c228d4f5162617333a059c755617` |
| [AIKit #356](https://github.com/EpiLogos/ai-kit/pull/356) | exact native model capability/read/write and observed-session guard | `8290196495e83605fdcafa986c2130939a19fc64` |
| [AIKit #364](https://github.com/EpiLogos/ai-kit/pull/364) | real folded `aikit session-space` owner startup and model/task self-spawn | `62161b00249111ae797a41c825bc75e5054b4de0` |

#364's actual commit parent is `37994265f5727af50ec6446687ed629dde047412`.
A PR's moving base SHA is not the historical parent of its implementation.
The joined CI applies the published native deltas only to its disposable test
checkout, records the exact composition, and never merges or pushes that assembly.

The merged [setup #406](https://github.com/EpiLogos/O-I/pull/406), merge
`574ef564523b8e1c582a47aa4c6f5a90811c1f75`, and D's current successors must be retained.
In particular, do not replace its reviewed `SetupFlowController`/PlanDrawer with
older files inherited by the UI anchor. SettingsHome and SettingsPageV2 carry
small, explicitly dependent target/return hunks only; their general forms and
W1's shell/layout remain with those owners. The same rule applies to the small
AgentLayer, CradleFrame, kernel-operation and type registrations. Preserve the
Context/editor and Factory writers' independent hunks.

AIKit #360 and #364 overlap at native startup/credential delivery; Central #204
and #202 overlap at profile storage. Inspect the actual successor/merge state
before integration. Preserve #202's stronger descriptor-relative acceptance and
locking protections. Do not resolve a conflict by restoring an entire older file.
Actuation's existing harness/admission/permission contracts are consumed, not
replaced; model choice is never an Actuation grant.

### What the new path does

The person names a reusable Agent, writes its purpose and explicitly confirms the
native root or child-Project scope. The surface discovers actual effective Skills;
untrusted, disabled or unavailable revisions cannot become selectable by a renderer
flag. References are retained through proposal and source review. Central creates
the definition through its existing expression path. Its generated provenance
remains generated; a separate authenticated human acceptance receipt binds the
exact revision and source digest. The consumer rereads both the source and the
native roster before offering preparation. A lost acceptance reply triggers a
read, never another silent write.

AIKit then prepares an existing native SessionSpace/AgentSession attachment under
an idempotent request identity. An interrupted partial preparation is disclosed
as partial and continues only under that same identity. Preparation starts no
provider, creates no Factory ancestry and grants no execution authority. Durable
Agent identity, a temporary task role and the runtime session remain different
objects. No Guardian replacement or renderer-side Agent store is introduced.

Opening that session uses the existing native discovery, harness startup,
handshake, stream, tool/permission, cancellation and supported reconnect paths.
The composer reads model options from the exact resident harness. ACP may expose
a writable session selector; Pi's launch-time policy does not become a fabricated
resident selector. Older owners without the capability field stay read-only.
Native policy pins and observed session identity constrain writes. Lost or
contradictory acknowledgements are unknown, not success or an automatic retry.

The parent receives the current accepted native definition and exact effective
Skill bytes on the actual prompt path. Changed accepted source or Skill digests
are refused before a subsequent turn. A native submission receipt records hashes
and source relationships, not private body text. Submission, provider response and
independent model consumption remain different observations. Brokered-child
activation is explicitly **not established** by the parent receipt; children need
their own context and authority admission. The implementation does not quietly
promise parent Skills to every descendant.

The sidebar's repair excursion names the native owner, topic and operation when
available, selects the actual owner Settings receiver, and offers credential
presence/reference controls rather than secret-material fields. World and
acceptance repair retain their Central operation identity. Returning rereads
readiness without submitting the held Agent purpose, replaying a turn or clearing
the conversation draft. General setup and secure credential material remain native
owner operations. No key is entered into chat, this packet, a profile, browser
persistence, telemetry or a PR.

The new Direct-definition route is presently scoped to Central root and an exact
registered Work Project. Central remains the root meta-project. Existing other
native World/Agency/session routes are retained; this is not a claim that every
harness or arbitrary external World acquired a new selector or admission path.

### Executed evidence and original failures

O:I production source `3b8f46433e8f453e20dd35a0dccc380d736a6ae1` passed run
[35531934485](https://github.com/EpiLogos/O-I/actions/runs/35531934485): 34 controller
regressions, nine actual-component Chromium checks, 16 packet tests, full production
TypeScript/Vite build, 12 focused kernel tests, full kernel **105 passed / 0 failed /
51 existing native-owner-gated ignores**, and strict kernel Clippy. Artifact
`10611184741` retains the actual tested source and logs; the workflow's trigger SHA
is the preceding source-publication step, not the tested commit. The later packet
context-receipt assertion is tested separately at the final PR head.

Central #202's source passed **508 workspace tests**, its six focused acceptance
cases and an explicit `ctrl` build. Its repository-wide formatting and strict lint
are not green: the separately retained baseline at `12ee31313e710378845baae190efc1a4b3e7ebdb`
reproduces formatting changes and the harness connector's redundant-closure lint.
Baseline artifact `10602979237` and current artifact `10603657859` preserve that
comparison. Those unrelated files were not reformatted or their checks disabled.

AIKit source `66abc6bee7a61f0539e339f1b327981aa86ad5ad` passed the full native suite:
**2,942 passed / 0 failed / 35 existing ignores**, plus full strict Clippy. The
original QL-provider failure also passed its separate fresh three-case rerun;
that observation is not a claim to have repaired QL production code. The native
joined checks in #358 exercise actual `ctrl`, `aikit`, stores and production ACP
handlers with a test-only peer, including fragmented streams, source-dependent
returns, permission denial, cancellation, disconnect, owner restart, native
identity refusal and effective Skill byte delivery. Their final result and exact
composed tree are in #358's closing receipt, not inferred from the desktop build.

Retain the original failed runs. O:I `35522541087` exposed a missing SessionSpace
version in the controlled peer; `5f702302` corrected it and added malformed/missing
version refusal. `35526825805` then passed those focused cases but encountered
`ETXTBSY` in the existing full-kernel temporary-script test; the fresh full run
above passed without changing that test. AIKit's joined test first incorrectly
waited for `Idle` instead of the native `Resident` state, then correctly refused
an enabled but unreviewed test Skill. The repair performs the native trust-review
operation for that controlled revision, not an eligibility bypass. A test assembly
using #364's moving PR base rather than its real parent also failed; its patch and
failure remain retained. Earlier selector-format, formatter, preview-interface,
browser-render and rejected-workflow-push failures in #356/#424 remain in their
historical CI receipts. None is relabelled as a pass.

These are repository and controlled-process results. No live commercial/local
model, installed Mac candidate, microphone, voice conversation or human acceptance
has been observed by this remote lane.

### Bounded local packet and integration walk

Use `desktop/cradle/tests/agent-native-local.py` with Python 3.11 or later and the
actual selected `ctrl`, `aikit` and `oi` executable paths. The default preflight is
read-only. It records their SHA-256s, the native scope, eligible Skills and the
roster. Every subsequent phase uses a **new private receipt file** and the previous
receipt; a changed candidate or scope is refused rather than quietly reusing it.

```sh
python3 desktop/cradle/tests/agent-native-local.test.py
python3 desktop/cradle/tests/agent-native-local.py --help
python3 desktop/cradle/tests/agent-native-local.py \
  --ctrl "$CTRL" --aikit "$AIKIT" --oi "$OI" --cwd "$WORLD_DIR" \
  --receipt "$PRIVATE_RECEIPTS/01-preflight.json"
```

Resolve the arguments from those actual readings, not a guessed model or Agent.
The phase sequence is:

| Phase | Additional explicit input | Evidence required before the next phase |
| --- | --- | --- |
| `propose` | `--execute --name … --purpose-file … --confirm-scope …`, optional repeated native `--skill` | Real source ref and reviewed body; no acceptance implied |
| `review` | Previous receipt or an actual `--profile-ref` | Exact native source and digest shown for human review |
| `accept` | `--execute --prior … --reviewed-digest …` | Existing native human-authority channel, then source and roster readback |
| `prepare` | `--execute --prior …` | Original request correlation and complete native attachment, no provider yet |
| `connect` | `--execute --prior … --provider …` | Actual eligible provider discovery, startup and native handshake |
| `live` | `--execute --prior … --provider … --source …` | A new source-dependent assistant return and fresh matching parent context-delivery receipt |
| `resume` | Same as live with the previous live receipt and a **new** source nonce | Same persisted native identity and another fresh source-dependent return |

The purpose file is the exact desired text, including an explicitly reviewed
trailing-newline choice; the packet never silently trims authored words. No phase
creates a human authority source, installs a credential, invents a provider or
makes a private rule authoritative. Missing genuine setup goes through its native
owner and a reviewed human decision. A stored proposal does not substitute for it.

The source probe's first line is `OI_AGENT_PROBE_` followed by a new random
32-digit hexadecimal value. Keep the source within the explicitly selected World;
its bytes must never appear in the prompt. The live phase delegates to the existing
`agent-native-live.py`, checks new output from the exact native session and requires
healthy completion. It additionally reads new journal events and compares the
accepted Agent and effective Skill digests to preparation. Parent submission is
not relabelled as independent model consumption or child activation. A timeout,
disconnect or refusal preserves the receipt and never automatically replays work.
Provider use may be billable. Permission requests remain visible for human review.

After integrating the delta and selected native dependencies, repeat the activity
through the actual desktop: create/review/accept, read the roster, select the native
harness/model, retain a draft through one setup excursion, return useful work,
deny one harmless requested effect, interrupt and explicitly reopen where supported.
Use both root and one genuine child Project without manufacturing a fake child
for root. A native process restart and a UI close/reopen are different observations.
The local operator starts the supported native owner before the packet's resume
phase; the packet itself never installs products or kills resident services.

Open `tests/agent-native-device.html` in the actual candidate for explicit local
microphone capture/stop/playback and record human listening, denial or unavailable
capture honestly. It uploads and persists no audio. Ordinary-browser playback is
not Mac app microphone or Nara/dictation proof. Native keyboard, focus, window and
voice integration are separate local checks. Return exact source/build/install/
running/provider identity and bounded failures to these same PRs and #65. Keep
private receipts private; publish safe hashes and outcomes, not personal source,
transcripts, keys or device names. Local integration owns merging and installation;
this remote lane performed neither.
